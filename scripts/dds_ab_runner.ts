import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { getAdminDb } from '../src/lib/firebase/admin';
import {
  buildWorkoutDraftFromHistory,
  type CategoryContextForDraft,
  type ClientContextForDraft,
  type ClientMovementProfileForDraft,
  type HistoricalWorkoutForDraft,
  type MovementContextForDraft,
  type StructureSectionForDraft,
} from '../src/lib/ai/workoutDraft';

type Candidate = {
  workoutId: string;
  clientId: string;
  categoryName?: string;
  structureTemplateId: string;
  dateMillis: number;
};

type DraftMetrics = {
  generationMs: number;
  rounds: number;
  movementUsages: number;
  missingMovementIds: number;
  unsafePickCount: number;
  progressionContinuityRatio: number;
  manualEditsProxy: number;
  coachConfidenceProxy: number;
};

type SampleComparison = {
  workoutId: string;
  clientId: string;
  categoryName?: string;
  structureTemplateId: string;
  baseline: DraftMetrics;
  current: DraftMetrics;
};

const DEFAULT_SAMPLE_SIZE = 24;
const RECENT_HISTORY_LIMIT = 24;

function timestampToMillis(value: unknown): number {
  if (!value) return 0;
  const maybe = value as { toMillis?: () => number; seconds?: number };
  if (typeof maybe.toMillis === 'function') return maybe.toMillis();
  if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  return 0;
}

function resolveTemplateId(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const text = value.trim();
  if (text.startsWith('structure-fill:')) return text.slice('structure-fill:'.length);
  if (text.startsWith('structure:')) return text.slice('structure:'.length);
  // Persisted workouts usually store raw structure template IDs directly.
  // Accept plain IDs as valid template references for offline A/B sampling.
  if (!text.includes(':')) return text;
  return undefined;
}

function hasMeaningfulTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const data = target as Record<string, unknown>;
  return Boolean(
    (typeof data.reps === 'string' && data.reps.trim()) ||
    (typeof data.weight === 'string' && data.weight.trim()) ||
    (typeof data.time === 'string' && data.time.trim()) ||
    typeof data.percentage === 'number' ||
    (typeof data.rpe === 'string' && data.rpe.trim())
  );
}

function computeDraftMetrics(input: {
  generationMs: number;
  rounds: Array<{ movementUsages?: Array<{ movementId?: string; targetWorkload?: unknown }> }>;
  blockedMovementIds: Set<string>;
}): DraftMetrics {
  const allUsages = input.rounds.flatMap((round) => round.movementUsages || []);
  const usageCount = allUsages.length;
  const missingMovementIds = allUsages.filter((usage) => !usage.movementId).length;
  const unsafePickCount = allUsages.filter((usage) => usage.movementId && input.blockedMovementIds.has(usage.movementId)).length;
  const continuityHits = allUsages.filter((usage) => hasMeaningfulTarget(usage.targetWorkload)).length;
  const progressionContinuityRatio = usageCount > 0 ? continuityHits / usageCount : 0;
  const manualEditsProxy = missingMovementIds + unsafePickCount * 2 + Math.max(0, 0.65 - progressionContinuityRatio) * 4;
  const coachConfidenceProxy = Math.max(
    1,
    Math.min(5, 4.6 - manualEditsProxy * 0.45 + progressionContinuityRatio * 0.8)
  );

  return {
    generationMs: input.generationMs,
    rounds: input.rounds.length,
    movementUsages: usageCount,
    missingMovementIds,
    unsafePickCount,
    progressionContinuityRatio,
    manualEditsProxy,
    coachConfidenceProxy,
  };
}

async function fetchStructureSections(accountId: string, structureTemplateId: string): Promise<StructureSectionForDraft[]> {
  const db = getAdminDb();
  const templateDoc = await db.collection('workoutStructureTemplates').doc(structureTemplateId).get();
  if (!templateDoc.exists) return [];

  const data = templateDoc.data() as Record<string, unknown> | undefined;
  if (!data || !Array.isArray(data.sections)) return [];

  const ownerId = typeof data.ownerId === 'string' ? data.ownerId : '';
  const templateAccountId = typeof data.accountId === 'string' ? data.accountId : '';
  const hasExplicitOwner = Boolean(ownerId || templateAccountId);
  const belongsToAccount = ownerId === accountId || templateAccountId === accountId;
  if (hasExplicitOwner && !belongsToAccount) return [];

  return data.sections
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const section = item as Record<string, unknown>;
      const config = section.configuration && typeof section.configuration === 'object'
        ? (section.configuration as Record<string, unknown>)
        : undefined;

      return {
        order: typeof section.order === 'number' ? section.order : 0,
        workoutTypeId: typeof section.workoutTypeId === 'string' ? section.workoutTypeId : undefined,
        workoutTypeName: typeof section.workoutTypeName === 'string' ? section.workoutTypeName : undefined,
        workoutTypeDescription: undefined,
        workoutIntentId: typeof section.workoutIntentId === 'string' ? section.workoutIntentId : undefined,
        workoutIntentKey: typeof section.workoutIntentKey === 'string' ? section.workoutIntentKey : undefined,
        workoutIntentName: typeof section.workoutIntentName === 'string' ? section.workoutIntentName : undefined,
        configuration: config
          ? {
              defaultDuration: typeof config.defaultDuration === 'number' ? config.defaultDuration : undefined,
              defaultStructure:
                config.defaultStructure === 'straight-sets' ||
                config.defaultStructure === 'supersets' ||
                config.defaultStructure === 'circuits' ||
                config.defaultStructure === 'amrap' ||
                config.defaultStructure === 'emom' ||
                config.defaultStructure === 'intervals'
                  ? config.defaultStructure
                  : undefined,
              focusArea: typeof config.focusArea === 'string' ? config.focusArea : undefined,
              aiGuidance: typeof config.aiGuidance === 'string' ? config.aiGuidance : undefined,
            }
          : undefined,
      };
    })
    .filter((item): item is StructureSectionForDraft => Boolean(item));
}

async function fetchMovementCategoryContextMap(accountId: string): Promise<Record<string, CategoryContextForDraft>> {
  const db = getAdminDb();
  const snapshot = await db.collection('movement-categories').where('ownerId', '==', accountId).limit(500).get();
  const map: Record<string, CategoryContextForDraft> = {};

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (typeof data.name === 'string' && data.name.trim()) {
      map[doc.id] = {
        name: data.name.trim(),
        description: typeof data.description === 'string' ? data.description.trim() || undefined : undefined,
      };
    }
  }

  return map;
}

async function fetchMovementContextMap(accountId: string): Promise<Record<string, MovementContextForDraft>> {
  const db = getAdminDb();
  const snapshot = await db.collection('movements').where('ownerId', '==', accountId).limit(3000).get();
  const map: Record<string, MovementContextForDraft> = {};

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const config = data.configuration && typeof data.configuration === 'object'
      ? (data.configuration as Record<string, unknown>)
      : undefined;

    map[doc.id] = {
      categoryId: typeof data.categoryId === 'string' ? data.categoryId : undefined,
      name: typeof data.name === 'string' ? data.name : undefined,
      instructions: typeof data.instructions === 'string' ? data.instructions : undefined,
      configuration: config
        ? {
            useReps: Boolean(config.useReps),
            useTempo: Boolean(config.useTempo),
            useTime: Boolean(config.useTime),
            timeMeasure: config.timeMeasure === 'm' ? 'm' : 's',
            useWeight: Boolean(config.useWeight),
            weightMeasure: config.weightMeasure === 'kg' || config.weightMeasure === 'bw' ? config.weightMeasure : 'lbs',
            useDistance: Boolean(config.useDistance),
            distanceMeasure:
              config.distanceMeasure === 'km' ||
              config.distanceMeasure === 'm' ||
              config.distanceMeasure === 'yd' ||
              config.distanceMeasure === 'ft'
                ? config.distanceMeasure
                : 'mi',
            usePace: Boolean(config.usePace),
            paceMeasure: config.paceMeasure === 'km' ? 'km' : 'mi',
            unilateral: Boolean(config.unilateral),
            usePercentage: Boolean(config.usePercentage),
            useRPE: Boolean(config.useRPE),
          }
        : undefined,
    };
  }

  return map;
}

async function fetchClientContext(accountId: string, clientId: string): Promise<ClientContextForDraft> {
  const db = getAdminDb();
  const snap = await db.collection('clients').doc(clientId).get();
  if (!snap.exists) return {};
  const data = snap.data() as Record<string, unknown> | undefined;
  if (!data || data.ownerId !== accountId) return {};

  return {
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    goals: typeof data.goals === 'string' ? data.goals : undefined,
    targetSessionsPerWeek: typeof data.targetSessionsPerWeek === 'number' ? data.targetSessionsPerWeek : undefined,
    eventGoals: Array.isArray(data.eventGoals)
      ? data.eventGoals.map((goal) => {
          if (!goal || typeof goal !== 'object') return {};
          const g = goal as Record<string, unknown>;
          return {
            description: typeof g.description === 'string' ? g.description : undefined,
            date: typeof g.date === 'string' ? g.date : undefined,
          };
        })
      : undefined,
    trainingPhases: Array.isArray(data.trainingPhases)
      ? data.trainingPhases.map((phase) => {
          if (!phase || typeof phase !== 'object') return {};
          const p = phase as Record<string, unknown>;
          return {
            periodName: typeof p.periodName === 'string' ? p.periodName : undefined,
            startDate: typeof p.startDate === 'string' ? p.startDate : undefined,
            endDate: typeof p.endDate === 'string' ? p.endDate : undefined,
          };
        })
      : undefined,
    sessionCounts:
      data.sessionCounts && typeof data.sessionCounts === 'object'
        ? {
            thisWeek: typeof (data.sessionCounts as Record<string, unknown>).thisWeek === 'number'
              ? ((data.sessionCounts as Record<string, unknown>).thisWeek as number)
              : undefined,
            thisMonth: typeof (data.sessionCounts as Record<string, unknown>).thisMonth === 'number'
              ? ((data.sessionCounts as Record<string, unknown>).thisMonth as number)
              : undefined,
            total: typeof (data.sessionCounts as Record<string, unknown>).total === 'number'
              ? ((data.sessionCounts as Record<string, unknown>).total as number)
              : undefined,
          }
        : undefined,
  };
}

async function fetchClientMovementProfile(accountId: string, clientId: string): Promise<ClientMovementProfileForDraft> {
  const db = getAdminDb();
  const snap = await db.collection('clientMovementProfiles').doc(clientId).get();
  if (!snap.exists) return { preferences: [], familyProfiles: [], feedbackLog: [] };

  const data = snap.data() as Record<string, unknown> | undefined;
  if (!data || data.ownerId !== accountId || data.clientId !== clientId) {
    return { preferences: [], familyProfiles: [], feedbackLog: [] };
  }

  const isPreferenceStatus = (value: unknown): value is 'allow' | 'avoid' | 'preferred' =>
    value === 'allow' || value === 'avoid' || value === 'preferred';

  const isReadiness = (value: unknown): value is 'low' | 'moderate' | 'high' =>
    value === 'low' || value === 'moderate' || value === 'high';

  const isProgressionStage = (value: unknown): value is 'rebuild' | 'base' | 'build' | 'peak' | 'maintain' =>
    value === 'rebuild' || value === 'base' || value === 'build' || value === 'peak' || value === 'maintain';

  const isSignal = (value: unknown): value is 'too_easy' | 'too_hard' | 'pain' | 'great_quality' | 'time_overrun' | 'poor_tolerance' | 'good_tolerance' =>
    value === 'too_easy' ||
    value === 'too_hard' ||
    value === 'pain' ||
    value === 'great_quality' ||
    value === 'time_overrun' ||
    value === 'poor_tolerance' ||
    value === 'good_tolerance';

  return {
    equipmentAccess: Array.isArray(data.equipmentAccess)
      ? data.equipmentAccess.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [],
    restrictions: Array.isArray(data.restrictions)
      ? data.restrictions.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [],
    preferences: Array.isArray(data.preferences)
      ? data.preferences
          .filter((v): v is Record<string, unknown> => Boolean(v && typeof v === 'object'))
          .map((v) => ({
            movementId: typeof v.movementId === 'string' ? v.movementId : '',
            status: isPreferenceStatus(v.status) ? v.status : 'allow',
            reason: typeof v.reason === 'string' ? v.reason : undefined,
          }))
          .filter((v) => v.movementId)
      : [],
    familyProfiles: Array.isArray(data.familyProfiles)
      ? data.familyProfiles
          .filter((v): v is Record<string, unknown> => Boolean(v && typeof v === 'object'))
          .map((v) => ({
            familyKey: typeof v.familyKey === 'string' ? v.familyKey : '',
            readiness: isReadiness(v.readiness) ? v.readiness : undefined,
            progressionStage: isProgressionStage(v.progressionStage) ? v.progressionStage : undefined,
          }))
          .filter((v) => v.familyKey)
      : [],
    feedbackLog: Array.isArray(data.feedbackLog)
      ? data.feedbackLog
          .filter((v): v is Record<string, unknown> => Boolean(v && typeof v === 'object'))
          .map((v) => ({
            movementId: typeof v.movementId === 'string' ? v.movementId : undefined,
            familyKey: typeof v.familyKey === 'string' ? v.familyKey : undefined,
            signal: isSignal(v.signal) ? v.signal : 'good_tolerance',
            score: typeof v.score === 'number' ? v.score : undefined,
          }))
      : [],
  };
}

function buildHistoricalWorkout(rawId: string, raw: Record<string, unknown>): HistoricalWorkoutForDraft {
  return {
    id: rawId,
    categoryName: typeof raw.categoryName === 'string' ? raw.categoryName : undefined,
    title: typeof raw.title === 'string' ? raw.title : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    rounds: Array.isArray(raw.rounds) ? (raw.rounds as HistoricalWorkoutForDraft['rounds']) : undefined,
    dateMillis: timestampToMillis(raw.date) || timestampToMillis(raw.updatedAt),
  };
}

function resolveWorkoutStructureTemplateId(raw: Record<string, unknown>): string | undefined {
  const fromSelection = resolveTemplateId(raw.appliedTemplateId);
  if (fromSelection) return fromSelection;

  const direct = raw.workoutTemplateId;
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  return undefined;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function main() {
  const accountId = process.env.DDS_AB_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('DDS_AB_ACCOUNT_ID is required');
  }

  const sampleSize = Math.max(1, Number.parseInt(process.env.DDS_AB_SAMPLE_SIZE || `${DEFAULT_SAMPLE_SIZE}`, 10) || DEFAULT_SAMPLE_SIZE);
  const outputPath = resolve(process.cwd(), process.env.DDS_AB_OUTPUT || 'scripts/dds_ab_results.json');

  const db = getAdminDb();

  const [
    movementCategoryContextById,
    movementContextById,
    workoutsSnapshot,
  ] = await Promise.all([
    fetchMovementCategoryContextMap(accountId),
    fetchMovementContextMap(accountId),
    db.collection('clientWorkouts').where('ownerId', '==', accountId).limit(3000).get(),
  ]);

  const allWorkouts = workoutsSnapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as Record<string, unknown> }))
    .map((item) => ({ id: item.id, workout: buildHistoricalWorkout(item.id, item.data), raw: item.data }))
    .filter((item) => item.workout.dateMillis);

  allWorkouts.sort((a, b) => (b.workout.dateMillis || 0) - (a.workout.dateMillis || 0));

  const candidates: Candidate[] = allWorkouts
    .map((item) => {
      const structureTemplateId = resolveWorkoutStructureTemplateId(item.raw);
      if (!structureTemplateId) return null;
      if (typeof item.raw.clientId !== 'string' || !item.raw.clientId) return null;
      return {
        workoutId: item.id,
        clientId: item.raw.clientId,
        categoryName: typeof item.raw.categoryName === 'string' ? item.raw.categoryName : undefined,
        structureTemplateId,
        dateMillis: item.workout.dateMillis || 0,
      };
    })
    .filter((item): item is Candidate => Boolean(item));

  const sampledCandidates = candidates.slice(0, sampleSize);
  const debugEnabled = process.env.DDS_AB_DEBUG === '1';
  const workoutsByClient = new Map<string, HistoricalWorkoutForDraft[]>();
  for (const item of allWorkouts) {
    const clientId = typeof item.raw.clientId === 'string' ? item.raw.clientId : '';
    if (!clientId) continue;
    const bucket = workoutsByClient.get(clientId) || [];
    bucket.push(item.workout);
    workoutsByClient.set(clientId, bucket);
  }

  for (const [, bucket] of workoutsByClient) {
    bucket.sort((a, b) => (b.dateMillis || 0) - (a.dateMillis || 0));
  }

  const sectionCache = new Map<string, StructureSectionForDraft[]>();
  const contextCache = new Map<string, ClientContextForDraft>();
  const profileCache = new Map<string, ClientMovementProfileForDraft>();

  const comparisons: SampleComparison[] = [];
  let noSectionsCount = 0;
  let noHistoryCount = 0;

  for (const candidate of sampledCandidates) {
    if (!sectionCache.has(candidate.structureTemplateId)) {
      sectionCache.set(
        candidate.structureTemplateId,
        await fetchStructureSections(accountId, candidate.structureTemplateId)
      );
    }

    const sections = sectionCache.get(candidate.structureTemplateId) || [];
    if (sections.length === 0) {
      noSectionsCount += 1;
      continue;
    }

    if (!contextCache.has(candidate.clientId)) {
      contextCache.set(candidate.clientId, await fetchClientContext(accountId, candidate.clientId));
    }

    if (!profileCache.has(candidate.clientId)) {
      profileCache.set(candidate.clientId, await fetchClientMovementProfile(accountId, candidate.clientId));
    }

    const clientContext = contextCache.get(candidate.clientId) || {};
    const movementProfile = profileCache.get(candidate.clientId) || { preferences: [], familyProfiles: [], feedbackLog: [] };
    const blockedMovementIds = new Set(
      (movementProfile.feedbackLog || [])
        .filter((entry) => (entry.signal === 'pain' || entry.signal === 'poor_tolerance') && entry.movementId)
        .map((entry) => entry.movementId as string)
    );

    const history = (workoutsByClient.get(candidate.clientId) || [])
      .filter((workout) => workout.id !== candidate.workoutId)
      .filter((workout) => (workout.dateMillis || 0) <= candidate.dateMillis)
      .filter((workout) => Array.isArray(workout.rounds) && workout.rounds.length > 0)
      .slice(0, RECENT_HISTORY_LIMIT);

    if (history.length === 0) {
      noHistoryCount += 1;
      continue;
    }

    const baselineStart = Date.now();
    const baselineDraft = buildWorkoutDraftFromHistory({
      categoryName: candidate.categoryName,
      structureTemplateId: candidate.structureTemplateId,
      structureSections: sections,
      recentWorkouts: history,
      fallbackTitle: 'A/B Baseline',
      includeDecisionTrace: false,
      categoryContextById: movementCategoryContextById,
      movementContextById,
      sessionDurationMinutes: 60,
      clientContext: {
        targetSessionsPerWeek: clientContext.targetSessionsPerWeek,
        sessionCounts: clientContext.sessionCounts,
      },
      movementProfile: {
        equipmentAccess: movementProfile.equipmentAccess || [],
        restrictions: movementProfile.restrictions || [],
        preferences: [],
        familyProfiles: [],
        feedbackLog: [],
      },
      goals: undefined,
      currentNotes: undefined,
    });
    const baselineMs = Date.now() - baselineStart;

    const currentStart = Date.now();
    const currentDraft = buildWorkoutDraftFromHistory({
      categoryName: candidate.categoryName,
      structureTemplateId: candidate.structureTemplateId,
      structureSections: sections,
      recentWorkouts: history,
      fallbackTitle: 'A/B Current',
      includeDecisionTrace: false,
      categoryContextById: movementCategoryContextById,
      movementContextById,
      sessionDurationMinutes: 60,
      clientContext,
      movementProfile,
      goals: clientContext.goals,
      currentNotes: clientContext.notes,
    });
    const currentMs = Date.now() - currentStart;

    comparisons.push({
      workoutId: candidate.workoutId,
      clientId: candidate.clientId,
      categoryName: candidate.categoryName,
      structureTemplateId: candidate.structureTemplateId,
      baseline: computeDraftMetrics({
        generationMs: baselineMs,
        rounds: baselineDraft.draft.rounds,
        blockedMovementIds,
      }),
      current: computeDraftMetrics({
        generationMs: currentMs,
        rounds: currentDraft.draft.rounds,
        blockedMovementIds,
      }),
    });
  }

  const baselineManualEdits = comparisons.map((row) => row.baseline.manualEditsProxy);
  const currentManualEdits = comparisons.map((row) => row.current.manualEditsProxy);
  const baselineUnsafe = comparisons.map((row) => row.baseline.unsafePickCount);
  const currentUnsafe = comparisons.map((row) => row.current.unsafePickCount);
  const baselineProgression = comparisons.map((row) => row.baseline.progressionContinuityRatio);
  const currentProgression = comparisons.map((row) => row.current.progressionContinuityRatio);
  const baselineConfidence = comparisons.map((row) => row.baseline.coachConfidenceProxy);
  const currentConfidence = comparisons.map((row) => row.current.coachConfidenceProxy);

  const summary = {
    sampleSizeRequested: sampleSize,
    sampleSizeEvaluated: comparisons.length,
    manualEditsProxy: {
      baselineAvg: average(baselineManualEdits),
      currentAvg: average(currentManualEdits),
      delta: average(currentManualEdits) - average(baselineManualEdits),
    },
    unsafePicks: {
      baselineAvg: average(baselineUnsafe),
      currentAvg: average(currentUnsafe),
      delta: average(currentUnsafe) - average(baselineUnsafe),
    },
    progressionCoherence: {
      baselineAvg: average(baselineProgression),
      currentAvg: average(currentProgression),
      delta: average(currentProgression) - average(baselineProgression),
    },
    coachConfidenceProxy: {
      baselineAvg: average(baselineConfidence),
      currentAvg: average(currentConfidence),
      delta: average(currentConfidence) - average(baselineConfidence),
    },
    wins: {
      currentLowerManualEdits: comparisons.filter((row) => row.current.manualEditsProxy < row.baseline.manualEditsProxy).length,
      currentLowerUnsafe: comparisons.filter((row) => row.current.unsafePickCount < row.baseline.unsafePickCount).length,
      currentHigherProgression: comparisons.filter((row) => row.current.progressionContinuityRatio > row.baseline.progressionContinuityRatio).length,
      currentHigherConfidence: comparisons.filter((row) => row.current.coachConfidenceProxy > row.baseline.coachConfidenceProxy).length,
    },
  };

  const report = {
    generatedAt: new Date().toISOString(),
    accountId,
    summary,
    comparisons,
    diagnostics: {
      totalWorkoutsScanned: allWorkouts.length,
      totalCandidatesDetected: candidates.length,
      sampledCandidates: sampledCandidates.length,
      noSectionsCount,
      noHistoryCount,
    },
  };

  if (debugEnabled) {
    console.log('DDS A/B diagnostics:', JSON.stringify(report.diagnostics, null, 2));
    if (sampledCandidates.length > 0) {
      console.log(
        'Sample candidate preview:',
        JSON.stringify(sampledCandidates.slice(0, 5), null, 2)
      );
    }
  }

  await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('DDS A/B evaluation report written to', outputPath);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('DDS A/B runner failed:', error);
  process.exitCode = 1;
});
