import type { ClientWorkoutRound, ClientWorkoutTargetWorkload, MovementConfiguration } from '@/lib/types';

export interface GenerateWorkoutDraftRequest {
  clientId: string;
  categoryName?: string;
  structureTemplateId?: string;
  sessionDurationMinutes?: number;
  currentTitle?: string;
  currentNotes?: string;
}

export interface ClientContextForDraft {
  notes?: string;
  goals?: string;
  eventGoals?: Array<{ description?: string; date?: string }>;
  trainingPhases?: Array<{ periodName?: string; startDate?: string; endDate?: string }>;
  targetSessionsPerWeek?: number;
  sessionCounts?: {
    thisWeek?: number;
    thisMonth?: number;
    total?: number;
  };
}

export interface GenerateWorkoutDraftResponse {
  draft: {
    title: string;
    notes?: string;
    rounds: ClientWorkoutRound[];
    structureTemplateId?: string;
  };
  source: {
    recentWorkoutsAnalyzed: number;
    strategy: 'history-with-structure' | 'history-clone' | 'fallback';
  };
}

export interface HistoricalMovementUsage {
  movementId: string;
  categoryId?: string;
  note?: string;
  targetWorkload?: Partial<ClientWorkoutTargetWorkload>;
}

export interface HistoricalWorkoutForDraft {
  id: string;
  categoryName?: string;
  title?: string;
  notes?: string;
  rounds?: ClientWorkoutRound[];
  dateMillis?: number;
}

export interface CategoryContextForDraft {
  name: string;
  description?: string;
}

export interface MovementContextForDraft {
  categoryId?: string;
  name?: string;
  instructions?: string;
  configuration?: Partial<MovementConfiguration>;
}

export interface StructureSectionForDraft {
  workoutTypeId?: string;
  workoutTypeName?: string;
  workoutTypeDescription?: string;
  order: number;
  configuration?: {
    defaultDuration?: number;
    defaultStructure?:
      | 'straight-sets'
      | 'supersets'
      | 'circuits'
      | 'amrap'
      | 'emom'
      | 'intervals';
    focusArea?: string;
    aiGuidance?: string;
  };
}

const DEFAULT_TARGET_WORKLOAD: ClientWorkoutTargetWorkload = {
  useWeight: false,
  weightMeasure: 'lbs',
  useReps: false,
  useTempo: false,
  useTime: false,
  useDistance: false,
  distanceMeasure: 'mi',
  usePace: false,
  paceMeasure: 'mi',
  usePercentage: false,
  useRPE: false,
  unilateral: false,
};

// Default configuration for movements without explicit config metadata
const DEFAULT_MOVEMENT_CONFIGURATION: Partial<MovementConfiguration> = {
  useWeight: true,
  weightMeasure: 'lbs',
  useReps: true,
  useTempo: false,
  useTime: true,
  timeMeasure: 's',
  useDistance: false,
  distanceMeasure: 'mi',
  usePace: false,
  paceMeasure: 'mi',
  unilateral: false,
  usePercentage: false,
  useRPE: false,
};
  

type MovementStat = {
  movementId: string;
  count: number;
  latestCategoryId?: string;
  latestNote?: string;
  latestTargetWorkload?: Partial<ClientWorkoutTargetWorkload>;
  latestWorkoutIndex: number;
};

type HistoricalRoundTemplate = {
  round: ClientWorkoutRound;
  workoutIndex: number;
  roundIndex: number;
};

const NOISE_WORDS = new Set([
  'and',
  'the',
  'for',
  'with',
  'from',
  'that',
  'this',
  'your',
  'into',
  'used',
  'work',
  'workout',
  'section',
  'default',
  'clear',
  'across',
  'through',
  'movement',
  'movements',
  'session',
  'training',
  'round',
  'rounds',
]);

function hasTextValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number') {
    return !Number.isNaN(value);
  }

  return false;
}

function inferTargetWorkloadFlags(target: ClientWorkoutTargetWorkload): ClientWorkoutTargetWorkload {
  return {
    ...target,
    useWeight: target.useWeight || hasTextValue(target.weight) || target.weightMeasure === 'bw',
    useReps: target.useReps || hasTextValue(target.reps),
    useTempo: target.useTempo || hasTextValue(target.tempo),
    useTime: target.useTime || hasTextValue(target.time),
    useDistance: target.useDistance || typeof target.distance === 'number',
    usePace: target.usePace || hasTextValue(target.pace),
    usePercentage: target.usePercentage || typeof target.percentage === 'number',
    useRPE: target.useRPE || hasTextValue(target.rpe),
  };
}

function buildDraftTitle(categoryName?: string, fallbackTitle?: string): string {
  const source = (fallbackTitle && fallbackTitle.trim()) || `${categoryName || 'Workout'} Draft`;
  return source
    .replace(/\s*\(?ai\)?\s*draft/gi, ' Draft')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function compactText(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .trim();
}

function normalizeText(value?: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function getSectionAliasHints(value?: string): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  if (['wu', 'w u', 'warmup', 'warm up'].includes(normalized)) {
    return ['warm up', 'warmup', 'prep', 'activation', 'mobility'];
  }

  if (['cd', 'c d', 'cooldown', 'cool down'].includes(normalized)) {
    return ['cool down', 'cooldown', 'recovery', 'breath', 'mobility'];
  }

  if (['fin', 'finisher', 'finish'].includes(normalized)) {
    return ['finisher', 'conditioning', 'metcon', 'circuit'];
  }

  if (['esd'].includes(normalized)) {
    return ['conditioning', 'engine', 'cardio', 'metcon'];
  }

  if (['s1', 'strength1', 'strength 1'].includes(normalized)) {
    return ['strength', 'main', 'power'];
  }

  if (['s2', 'strength2', 'strength 2'].includes(normalized)) {
    return ['strength', 'main', 'power'];
  }

  if (['r1', 'round1', 'round 1', 'r2', 'round2', 'round 2', 'r3', 'round3', 'round 3'].includes(normalized)) {
    return [];
  }

  return [];
}

function sectionNameMatches(sectionName?: string, templateSectionName?: string): boolean {
  const sectionNormalized = normalizeText(sectionName);
  const templateNormalized = normalizeText(templateSectionName);

  if (!sectionNormalized || !templateNormalized) return false;
  if (sectionNormalized.includes(templateNormalized) || templateNormalized.includes(sectionNormalized)) {
    return true;
  }

  const sectionHints = getSectionAliasHints(sectionName);
  const templateHints = getSectionAliasHints(templateSectionName);

  if (sectionHints.length === 0 && templateHints.length === 0) {
    return false;
  }

  const sectionSet = new Set([...sectionHints, sectionNormalized]);
  const templateSet = new Set([...templateHints, templateNormalized]);

  for (const hint of sectionSet) {
    if (templateSet.has(hint)) return true;
  }

  return false;
}

function extractMeaningfulKeywords(text: string): string[] {
  const tokens = normalizeText(text)
    .split(' ')
    .filter((token) => token.length >= 3 && !NOISE_WORDS.has(token));

  return Array.from(new Set(tokens)).slice(0, 16);
}

function countKeywordHits(text: string, keywords: string[]): number {
  if (!text || keywords.length === 0) return 0;

  const normalizedText = normalizeText(text);
  let hits = 0;

  for (const keyword of keywords) {
    if (normalizedText.includes(normalizeText(keyword))) {
      hits += 1;
    }
  }

  return hits;
}

function getActualSessionsPerWeek(recentWorkouts: HistoricalWorkoutForDraft[]): number | undefined {
  const datedWorkouts = recentWorkouts.filter((workout) => typeof workout.dateMillis === 'number');
  if (datedWorkouts.length === 0) return undefined;

  const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const recentCount = datedWorkouts.filter((workout) => (workout.dateMillis || 0) >= fourWeeksAgo).length;
  if (recentCount === 0) return undefined;

  return Math.round((recentCount / 4) * 10) / 10;
}

function getContextKeywordHints(text: string): string[] {
  const normalized = text.toLowerCase();
  const hints = new Set<string>();

  if (/(strength|maximal force|deadlift|squat|bench|powerlifting)/.test(normalized)) {
    hints.add('strength');
    hints.add('power');
  }
  if (/(hypertrophy|muscle|mass|bodybuilding)/.test(normalized)) {
    hints.add('accessory');
    hints.add('hypertrophy');
  }
  if (/(condition|engine|cardio|aerobic|anaerobic|endurance|stamina|vo2)/.test(normalized)) {
    hints.add('conditioning');
    hints.add('cardio');
  }
  if (/(speed|agility|quickness|sprint|athletic)/.test(normalized)) {
    hints.add('power');
    hints.add('ballistic');
  }
  if (/(mobility|recovery|pain|return to play|stability|movement quality|prehab|rehab)/.test(normalized)) {
    hints.add('mobility');
    hints.add('recovery');
    hints.add('activation');
  }
  if (/(fat loss|body composition|weight loss)/.test(normalized)) {
    hints.add('conditioning');
    hints.add('cardio');
    hints.add('accessory');
  }

  return Array.from(hints);
}

function cloneTargetWorkload(target?: Partial<ClientWorkoutTargetWorkload>): ClientWorkoutTargetWorkload {
  return inferTargetWorkloadFlags({
    ...DEFAULT_TARGET_WORKLOAD,
    ...(target || {}),
  });
}

function applyMovementConfigurationToWorkload(
  target: ClientWorkoutTargetWorkload,
  source?: Partial<ClientWorkoutTargetWorkload>,
  movementConfiguration?: Partial<MovementConfiguration>
): ClientWorkoutTargetWorkload {

  // Use provided configuration or fallback to sensible defaults
  const config = movementConfiguration || DEFAULT_MOVEMENT_CONFIGURATION;

  return inferTargetWorkloadFlags({
    ...target,
    useReps: target.useReps || Boolean(config.useReps),
    useTempo: target.useTempo || Boolean(config.useTempo),
    useTime: target.useTime || Boolean(config.useTime),
    useWeight: target.useWeight || Boolean(config.useWeight),
    useDistance: target.useDistance || Boolean(config.useDistance),
    usePace: target.usePace || Boolean(config.usePace),
    usePercentage: target.usePercentage || Boolean(config.usePercentage),
    useRPE: target.useRPE || Boolean(config.useRPE),
    unilateral: target.unilateral || Boolean(config.unilateral),
    weightMeasure:
      source?.weightMeasure || config.weightMeasure || target.weightMeasure,
    timeMeasure:
      source?.timeMeasure || config.timeMeasure || target.timeMeasure,
    distanceMeasure:
      source?.distanceMeasure || config.distanceMeasure || target.distanceMeasure,
    paceMeasure:
      source?.paceMeasure || config.paceMeasure || target.paceMeasure,
  });
}

function inferSectionSetCount(section: StructureSectionForDraft): number {
  const structure = section.configuration?.defaultStructure;
  if (structure === 'circuits' || structure === 'amrap' || structure === 'emom' || structure === 'intervals') {
    return 1;
  }
  if (structure === 'straight-sets' || structure === 'supersets') {
    return 3;
  }

  const text = compactText([
    section.workoutTypeName,
    section.workoutTypeDescription,
  ]).toLowerCase();

  if (text.includes('warm-up') || text.includes('warm up') || text.includes('warmup')) return 1;
  if (text.includes('cooldown') || text.includes('cool down') || text.includes('recovery')) return 1;
  if (text.includes('strength') || text.includes('power') || text.includes('main')) return 3;
  if (text.includes('accessory') || text.includes('prep')) return 2;

  return 1;
}

function cloneRounds(rounds?: ClientWorkoutRound[]): ClientWorkoutRound[] {
  if (!rounds || rounds.length === 0) return [];

  return rounds.map((round, roundIndex) => ({
    ordinal: roundIndex + 1,
    sets: typeof round.sets === 'number' && round.sets > 0 ? round.sets : 1,
    sectionName: round.sectionName,
    sectionColor: round.sectionColor,
    workoutTypeId: round.workoutTypeId,
    movementUsages: (round.movementUsages || []).map((usage, usageIndex) => ({
      ordinal: usageIndex + 1,
      movementId: usage.movementId || '',
      categoryId: usage.categoryId || '',
      note: usage.note,
      targetWorkload: hydrateTargetWorkloadFromSetEntries(usage.targetWorkload, usage.setEntries),
      setEntries: usage.setEntries,
    })),
  }));
}

function buildMovementStats(workouts: HistoricalWorkoutForDraft[]): MovementStat[] {
  const stats = new Map<string, MovementStat>();

  workouts.forEach((workout, workoutIndex) => {
    (workout.rounds || []).forEach((round) => {
      (round.movementUsages || []).forEach((usage) => {
        if (!usage.movementId) return;

        const hydratedTarget = hydrateTargetWorkloadFromSetEntries(
          usage.targetWorkload,
          usage.setEntries
        );

        const existing = stats.get(usage.movementId);
        if (!existing) {
          stats.set(usage.movementId, {
            movementId: usage.movementId,
            count: 1,
            latestCategoryId: usage.categoryId,
            latestNote: usage.note,
            latestTargetWorkload: hydratedTarget,
            latestWorkoutIndex: workoutIndex,
          });
          return;
        }

        existing.count += 1;
        if (workoutIndex < existing.latestWorkoutIndex) {
          existing.latestWorkoutIndex = workoutIndex;
          existing.latestCategoryId = usage.categoryId;
          existing.latestNote = usage.note;
          existing.latestTargetWorkload = hydratedTarget;
        }
      });
    });
  });

  return Array.from(stats.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.latestWorkoutIndex - b.latestWorkoutIndex;
  });
}

function buildLibraryMovementStats(
  movementContextById?: Record<string, MovementContextForDraft>,
  recentWorkoutCount = 0
): MovementStat[] {
  if (!movementContextById) return [];

  return Object.entries(movementContextById)
    .filter(([, movement]) => Boolean(movement?.name && movement.name.trim()))
    .map(([movementId, movement]) => ({
      movementId,
      count: 0,
      latestCategoryId: movement.categoryId,
      latestWorkoutIndex: recentWorkoutCount + 1,
    }))
    .sort((left, right) => {
      const leftName = normalizeText(movementContextById[left.movementId]?.name);
      const rightName = normalizeText(movementContextById[right.movementId]?.name);
      return leftName.localeCompare(rightName);
    });
}

function isPseudoMovement(
  movementId: string,
  movementContextById?: Record<string, MovementContextForDraft>,
  categoryContextById?: Record<string, CategoryContextForDraft>,
  categoryId?: string
): boolean {
  const movementName = normalizeText(movementContextById?.[movementId]?.name);
  const categoryName = normalizeText(
    categoryContextById?.[categoryId || movementContextById?.[movementId]?.categoryId || '']?.name
  );

  // Hide pseudo/template categories from movement selection for now.
  if (categoryName === 'workout' || categoryName === 'workouts') {
    return true;
  }

  if (!movementName) return false;
  if (movementName === 'finisher' || movementName === 'workout') return true;
  if (movementName === 'round' || movementName === 'round1' || movementName === 'round2' || movementName === 'round3') return true;

  return false;
}

function mergeMovementStats(primary: MovementStat[], fallback: MovementStat[]): MovementStat[] {
  if (fallback.length === 0) return primary;

  const merged = new Map<string, MovementStat>();

  primary.forEach((movement) => {
    merged.set(movement.movementId, movement);
  });

  fallback.forEach((movement) => {
    const existing = merged.get(movement.movementId);
    if (!existing) {
      merged.set(movement.movementId, movement);
      return;
    }

    // Keep primary ranking behavior, but backfill missing latest metadata from fallback.
    existing.latestCategoryId = existing.latestCategoryId || movement.latestCategoryId;
    existing.latestNote = existing.latestNote || movement.latestNote;
    existing.latestTargetWorkload = existing.latestTargetWorkload || movement.latestTargetWorkload;
    existing.latestWorkoutIndex = Math.min(existing.latestWorkoutIndex, movement.latestWorkoutIndex);
  });

  return Array.from(merged.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.latestWorkoutIndex - b.latestWorkoutIndex;
  });
}

function cloneSetEntries(setEntries?: ClientWorkoutRound['movementUsages'][number]['setEntries']) {
  return setEntries?.map((entry) => ({ ...entry }));
}

function hydrateTargetWorkloadFromSetEntries(
  target?: Partial<ClientWorkoutTargetWorkload>,
  setEntries?: ClientWorkoutRound['movementUsages'][number]['setEntries']
): ClientWorkoutTargetWorkload {
  const firstEntry = setEntries && setEntries.length > 0 ? setEntries[0] : undefined;
  if (!firstEntry) {
    return cloneTargetWorkload(target);
  }

  return inferTargetWorkloadFlags(
    cloneTargetWorkload({
      ...(target || {}),
      reps: target?.reps ?? firstEntry.reps,
      tempo: target?.tempo ?? firstEntry.tempo,
      time: target?.time ?? firstEntry.time,
      weight: target?.weight ?? firstEntry.weight,
      distance: target?.distance ?? firstEntry.distance,
      pace: target?.pace ?? firstEntry.pace,
      percentage: target?.percentage ?? firstEntry.percentage,
      rpe: target?.rpe ?? firstEntry.rpe,
    })
  );
}

function cloneMovementUsage(
  usage: ClientWorkoutRound['movementUsages'][number],
  ordinal: number
): ClientWorkoutRound['movementUsages'][number] {
  const setEntries = cloneSetEntries(usage.setEntries);

  return {
    ordinal,
    movementId: usage.movementId || '',
    categoryId: usage.categoryId || '',
    note: usage.note,
    targetWorkload: hydrateTargetWorkloadFromSetEntries(usage.targetWorkload, setEntries),
    setEntries,
  };
}

function hasMeaningfulTargetValue(target?: Partial<ClientWorkoutTargetWorkload>): boolean {
  if (!target) return false;

  return (
    hasTextValue(target.reps) ||
    hasTextValue(target.weight) ||
    hasTextValue(target.tempo) ||
    hasTextValue(target.time) ||
    hasTextValue(target.pace) ||
    hasTextValue(target.rpe) ||
    typeof target.distance === 'number' ||
    typeof target.percentage === 'number'
  );
}

function mergeTargetWorkload(
  primary?: Partial<ClientWorkoutTargetWorkload>,
  fallback?: Partial<ClientWorkoutTargetWorkload>
): ClientWorkoutTargetWorkload {
  const merged = cloneTargetWorkload({
    ...(fallback || {}),
    ...(primary || {}),
  });

  // Preserve enabled workload dimensions if either source enables them.
  // This prevents sparse history/template payloads from disabling movement presets.
  return inferTargetWorkloadFlags({
    ...merged,
    useWeight: Boolean(primary?.useWeight || fallback?.useWeight || merged.useWeight),
    useReps: Boolean(primary?.useReps || fallback?.useReps || merged.useReps),
    useTempo: Boolean(primary?.useTempo || fallback?.useTempo || merged.useTempo),
    useTime: Boolean(primary?.useTime || fallback?.useTime || merged.useTime),
    useDistance: Boolean(primary?.useDistance || fallback?.useDistance || merged.useDistance),
    usePace: Boolean(primary?.usePace || fallback?.usePace || merged.usePace),
    usePercentage: Boolean(primary?.usePercentage || fallback?.usePercentage || merged.usePercentage),
    useRPE: Boolean(primary?.useRPE || fallback?.useRPE || merged.useRPE),
    unilateral: Boolean(primary?.unilateral || fallback?.unilateral || merged.unilateral),
  });
}

function inferRoundSetCount(round?: ClientWorkoutRound): number {
  if (!round) return 1;

  if (typeof round.sets === 'number' && round.sets > 0) {
    return round.sets;
  }

  const inferredFromEntries = (round.movementUsages || []).reduce((max, usage) => {
    const count = usage.setEntries?.length || 0;
    return Math.max(max, count);
  }, 0);

  return inferredFromEntries > 0 ? inferredFromEntries : 1;
}

function buildHistoricalRoundTemplates(workouts: HistoricalWorkoutForDraft[]): HistoricalRoundTemplate[] {
  const templates: HistoricalRoundTemplate[] = [];

  workouts.forEach((workout, workoutIndex) => {
    (workout.rounds || []).forEach((round, roundIndex) => {
      if (!round.movementUsages || round.movementUsages.length === 0) {
        return;
      }

      templates.push({
        round,
        workoutIndex,
        roundIndex,
      });
    });
  });

  return templates;
}

function buildRoundsFromStructure(
  sections: StructureSectionForDraft[],
  roundTemplates: HistoricalRoundTemplate[],
  rankedMovements: MovementStat[],
  categoryContextById?: Record<string, CategoryContextForDraft>,
  movementContextById?: Record<string, MovementContextForDraft>,
  options?: {
    globalContextText?: string;
    targetSessionsPerWeek?: number;
    actualSessionsPerWeek?: number;
    categoryBiasKeywords?: string[];
  }
): ClientWorkoutRound[] {
  const isKnownMovementId = (movementId?: string): boolean => {
    if (!movementId) return false;
    if (!movementContextById) return true;
    return Boolean(movementContextById[movementId]);
  };

  const selectableMovements = rankedMovements.filter(
    (movement) =>
      isKnownMovementId(movement.movementId) &&
      !isPseudoMovement(movement.movementId, movementContextById, categoryContextById, movement.latestCategoryId)
  );

  const usedMovementIds = new Set<string>();
  const usedTemplateKeys = new Set<string>();
  const latestTargetByMovementId = new Map<string, Partial<ClientWorkoutTargetWorkload>>();
  const latestTargetByMovementName = new Map<string, Partial<ClientWorkoutTargetWorkload>>();

  rankedMovements.forEach((movement) => {
    if (movement.latestTargetWorkload) {
      latestTargetByMovementId.set(movement.movementId, movement.latestTargetWorkload);

      const movementNameKey = normalizeText(movementContextById?.[movement.movementId]?.name);
      if (movementNameKey && !latestTargetByMovementName.has(movementNameKey)) {
        latestTargetByMovementName.set(movementNameKey, movement.latestTargetWorkload);
      }
    }
  });

  const resolveLatestTargetForMovement = (movementId?: string): Partial<ClientWorkoutTargetWorkload> | undefined => {
    if (!movementId) return undefined;

    const byId = latestTargetByMovementId.get(movementId);
    if (byId) return byId;

    const movementNameKey = normalizeText(movementContextById?.[movementId]?.name);
    if (!movementNameKey) return undefined;

    return latestTargetByMovementName.get(movementNameKey);
  };

  const textIncludesAny = (text: string, words: string[]): boolean => {
    return words.some((word) => text.includes(word));
  };

  const getSectionKeywords = (section: StructureSectionForDraft): string => {
    const sectionAliases = getSectionAliasHints(section.workoutTypeName);

    return compactText([
      section.workoutTypeName,
      section.workoutTypeDescription,
    ]).toLowerCase();
  };

  const getTargetMovementCount = (section: StructureSectionForDraft): number => {
    const text = getSectionKeywords(section);
    const duration = section.configuration?.defaultDuration || 0;
    const structure = section.configuration?.defaultStructure;

    let count = 2;

    if (structure === 'supersets') count = 2;
    else if (structure === 'circuits' || structure === 'amrap' || structure === 'emom' || structure === 'intervals') {
      count = duration >= 20 ? 4 : 3;
    } else if (textIncludesAny(text, ['cooldown', 'cool down', 'recovery', 'stretch', 'breath'])) count = 1;
    else if (textIncludesAny(text, ['warm-up', 'warm up', 'warmup', 'prep', 'activation', 'mobility'])) {
      count = duration >= 15 ? 3 : 2;
    } else if (textIncludesAny(text, ['strength', 'power', 'main'])) {
      count = duration >= 25 ? 3 : 2;
    } else if (textIncludesAny(text, ['accessory', 'circuit', 'conditioning', 'esd', 'metcon'])) {
      count = duration >= 20 ? 4 : 3;
    } else {
      count = duration >= 20 ? 3 : 2;
    }

    // Lower-frequency clients need more complete sessions. Higher-frequency clients can tolerate more focused sections.
    if ((options?.targetSessionsPerWeek || 0) <= 2 && (options?.actualSessionsPerWeek || 0) <= 2) {
      count += 1;
    }
    if ((options?.targetSessionsPerWeek || 0) >= 4 || (options?.actualSessionsPerWeek || 0) >= 4) {
      count -= 1;
    }

    return Math.max(1, Math.min(count, 4));
  };

  const getPreferredCategoryKeywords = (section: StructureSectionForDraft): string[] => {
    const text = getSectionKeywords(section);
    const globalHints = getContextKeywordHints(options?.globalContextText || '');

    if (textIncludesAny(text, ['cooldown', 'cool down', 'recovery', 'stretch', 'breath'])) {
      return ['mobility', 'recovery', 'cooldown', 'stretch', 'breath', ...globalHints];
    }

    if (textIncludesAny(text, ['warm-up', 'warm up', 'warmup', 'prep', 'activation'])) {
      return ['prep', 'warm', 'mobility', 'activation', 'ballistic', ...globalHints];
    }

    if (textIncludesAny(text, ['strength', 'power', 'main'])) {
      return ['strength', 'power', 'squat', 'hinge', 'push', 'pull', ...globalHints];
    }

    if (textIncludesAny(text, ['conditioning', 'esd', 'metcon', 'circuit'])) {
      return ['conditioning', 'cardio', 'engine', 'power', ...globalHints];
    }

    return globalHints;
  };

  const pickMovementsForSection = (
    section: StructureSectionForDraft,
    count: number
  ): MovementStat[] => {
    const categoryBiasKeywords = options?.categoryBiasKeywords || [];
    const preferredKeywords = Array.from(
      new Set([
        ...getPreferredCategoryKeywords(section),
        ...extractMeaningfulKeywords(getSectionKeywords(section)),
        ...categoryBiasKeywords,
      ])
    );
    const unusedPool = selectableMovements.filter((movement) => !usedMovementIds.has(movement.movementId));
    const fallbackReusePool = selectableMovements;

    // For recovery/cool-down and warm-up sections, exclude high-intensity conditioning movements
    const sectionText = getSectionKeywords(section);
    const isCoolDownSection = textIncludesAny(sectionText, ['cooldown', 'cool down', 'recovery', 'downregulation', 'breath']);
    const isWarmUpSection = textIncludesAny(sectionText, ['warm up', 'warmup', 'warm-up', 'activation', 'prep']);
    const highIntensityKeywords = ['conditioning', 'heart rate', 'energy system', 'cardio', 'assault bike', 'bike', 'rower', 'row', 'sprint', 'metcon', 'engine'];
    const applyIntensityFilter = isCoolDownSection || isWarmUpSection;

    const filterByIntensity = (movementStats: MovementStat[]): MovementStat[] => {
      if (!applyIntensityFilter) return movementStats;
      return movementStats.filter((movement) => {
        const categoryContext = categoryContextById?.[movement.latestCategoryId || ''];
        const movementContext = movementContextById?.[movement.movementId];
        const text = compactText([
          categoryContext?.name,
          categoryContext?.description,
          movementContext?.name,
          movementContext?.instructions,
        ]).toLowerCase();
        return !textIncludesAny(text, highIntensityKeywords);
      });
    };

    const scorePool = (poolSource: MovementStat[]) =>
      poolSource
      .map((movement) => {
        const categoryContext = categoryContextById?.[movement.latestCategoryId || ''];
        const movementContext = movementContextById?.[movement.movementId];
        const categoryText = compactText([
          categoryContext?.name,
          categoryContext?.description,
        ]);
        const movementText = compactText([
          movementContext?.name,
          movementContext?.instructions,
          movement.latestNote,
        ]);
        const categoryHits = countKeywordHits(categoryText, preferredKeywords);
        const movementHits = countKeywordHits(movementText, preferredKeywords);
        const score =
          movement.count * 100 -
          movement.latestWorkoutIndex * 5 +
          categoryHits * 10 +
          movementHits * 5;

        return {
          movement,
          score,
          categoryHits,
          movementHits,
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (right.categoryHits !== left.categoryHits) return right.categoryHits - left.categoryHits;
        if (right.movementHits !== left.movementHits) return right.movementHits - left.movementHits;
        if (right.movement.count !== left.movement.count) return right.movement.count - left.movement.count;
        return left.movement.latestWorkoutIndex - right.movement.latestWorkoutIndex;
      });

    const filteredUnusedPool = filterByIntensity(unusedPool);
    const filteredReusePool = filterByIntensity(fallbackReusePool);
    const scoredUnusedPool = scorePool(filteredUnusedPool);
    const scoredReusePool = scorePool(filteredReusePool);

    const preferredPool =
      preferredKeywords.length === 0
        ? scoredUnusedPool
        : scoredUnusedPool.filter((entry) => entry.categoryHits > 0 || entry.movementHits > 0);

    const preferredReusePool =
      preferredKeywords.length === 0
        ? scoredReusePool
        : scoredReusePool.filter((entry) => entry.categoryHits > 0 || entry.movementHits > 0);

    const picked: MovementStat[] = [];
    for (const candidate of preferredPool) {
      picked.push(candidate.movement);
      usedMovementIds.add(candidate.movement.movementId);
      if (picked.length >= count) break;
    }

    // If history is sparse in this category, prefer reusing matching movements
    // before introducing unrelated high-frequency options from other categories.
    if (picked.length < count) {
      for (const candidate of preferredReusePool) {
        picked.push(candidate.movement);
        if (picked.length >= count) break;
      }
    }

    if (picked.length < count) {
      for (const candidate of scoredUnusedPool) {
        if (usedMovementIds.has(candidate.movement.movementId)) continue;
        picked.push(candidate.movement);
        usedMovementIds.add(candidate.movement.movementId);
        if (picked.length >= count) break;
      }
    }

    // If history is sparse, allow reuse so we never return placeholder/unknown movements.
    if (picked.length < count) {
      for (const candidate of scoredReusePool) {
        picked.push(candidate.movement);
        if (picked.length >= count) break;
      }
    }

    return picked;
  };

  const getRoundTemplateKeywords = (template: HistoricalRoundTemplate): string => {
    const usageText = template.round.movementUsages
      .map((usage) => {
        const movementContext = movementContextById?.[usage.movementId];
        const categoryContext = categoryContextById?.[usage.categoryId];

        return compactText([
          categoryContext?.name,
          categoryContext?.description,
          movementContext?.name,
          movementContext?.instructions,
          usage.note,
        ]);
      })
      .join(' ');

    return compactText([
      template.round.sectionName,
      usageText,
    ]).toLowerCase();
  };

  const pickTemplateForSection = (
    section: StructureSectionForDraft,
    sectionIndex: number
  ): HistoricalRoundTemplate | undefined => {
    if (roundTemplates.length === 0) {
      return undefined;
    }

    const preferredKeywords = Array.from(
      new Set([
        ...getPreferredCategoryKeywords(section),
        ...extractMeaningfulKeywords(getSectionKeywords(section)),
      ])
    );

    const scoredTemplates = roundTemplates
      .map((template) => {
        const templateKey = `${template.workoutIndex}:${template.roundIndex}`;
        const templateKeywords = getRoundTemplateKeywords(template);
        const keywordHits = countKeywordHits(templateKeywords, preferredKeywords);
        const workoutTypeMatch =
          section.workoutTypeId && template.round.workoutTypeId === section.workoutTypeId ? 1 : 0;
        const sectionNameMatch =
          section.workoutTypeName &&
          template.round.sectionName &&
          sectionNameMatches(section.workoutTypeName, template.round.sectionName)
            ? 1
            : 0;
        const ordinalDistance = Math.abs(template.roundIndex - sectionIndex);
        const reusePenalty = usedTemplateKeys.has(templateKey) ? 40 : 0;

        const score =
          keywordHits * 15 +
          workoutTypeMatch * 60 +
          sectionNameMatch * 35 +
          Math.max(0, 20 - ordinalDistance * 5) +
          Math.max(0, 12 - template.workoutIndex * 2) -
          reusePenalty;

        return {
          template,
          templateKey,
          score,
          keywordHits,
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (right.keywordHits !== left.keywordHits) return right.keywordHits - left.keywordHits;
        return left.template.workoutIndex - right.template.workoutIndex;
      });

    const chosen = scoredTemplates[0];
    if (!chosen) {
      return undefined;
    }

    usedTemplateKeys.add(chosen.templateKey);
    return chosen.template;
  };

  const createUsageFromMovement = (
    movement: MovementStat | undefined,
    ordinal: number,
    templateUsage?: ClientWorkoutRound['movementUsages'][number],
    sectionFallbackWorkload?: Partial<ClientWorkoutTargetWorkload>
  ): ClientWorkoutRound['movementUsages'][number] => {
    if (movement) {
      usedMovementIds.add(movement.movementId);
    }

    const movementId = movement?.movementId || templateUsage?.movementId || '';
    const movementLatestWorkload = hasMeaningfulTargetValue(movement?.latestTargetWorkload)
      ? movement?.latestTargetWorkload
      : undefined;
    const templateWorkload = hasMeaningfulTargetValue(templateUsage?.targetWorkload)
      ? templateUsage?.targetWorkload
      : undefined;
    const sourceWorkload =
      templateWorkload ||
      movementLatestWorkload ||
      sectionFallbackWorkload;
    const movementConfig = movementId ? movementContextById?.[movementId]?.configuration : undefined;

    return {
      ordinal,
      movementId,
      categoryId: movement?.latestCategoryId || templateUsage?.categoryId || '',
      note: movement?.latestNote || templateUsage?.note,
      targetWorkload: applyMovementConfigurationToWorkload(
        cloneTargetWorkload(sourceWorkload),
        sourceWorkload,
        movementConfig
      ),
      setEntries: cloneSetEntries(templateUsage?.setEntries),
    };
  };

  return sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section, sectionIndex) => {
      const template = pickTemplateForSection(section, sectionIndex);
      const targetMovementCount = getTargetMovementCount(section);
      const templateUsages = template?.round.movementUsages || [];
      const templateFallbackWorkload = templateUsages
        .map((usage) => hydrateTargetWorkloadFromSetEntries(usage.targetWorkload, usage.setEntries))
        .find((target) => hasMeaningfulTargetValue(target));
      // Determine if this section is strength-type (prefers reps/weight over time)
      const sectionStructure = section.configuration?.defaultStructure;
      const sectionNameLower = (section.workoutTypeName || '').toLowerCase();
      const isStrengthSection =
        sectionStructure === 'straight-sets' ||
        sectionStructure === 'supersets' ||
        sectionNameLower.includes('strength') ||
        sectionNameLower.includes('power') ||
        sectionNameLower.includes('accessory') ||
        sectionNameLower.includes('prep') ||
        sectionNameLower.includes('movement prep') ||
        sectionNameLower.includes('activation');
      // Fallback to global movement history if template has no meaningful workloads
      const sectionFallbackWorkload = templateFallbackWorkload || getGlobalFallbackWorkload(rankedMovements, isStrengthSection);
      const usageCount = Math.max(templateUsages.length, targetMovementCount, 1);
      const selected = pickMovementsForSection(section, usageCount);
      let fillIndex = 0;

      const movementUsages = Array.from({ length: usageCount }, (_, usageIndex) => {
        const templateUsage = templateUsages[usageIndex];
        const hasTemplateMovement = Boolean(templateUsage?.movementId && isKnownMovementId(templateUsage?.movementId));

        if (hasTemplateMovement) {
          usedMovementIds.add(templateUsage!.movementId);
          const latestTarget = resolveLatestTargetForMovement(templateUsage!.movementId);
          const cloned = cloneMovementUsage(templateUsage!, usageIndex + 1);
          const movementConfig = movementContextById?.[templateUsage!.movementId]?.configuration;
          const mergedTarget = mergeTargetWorkload(cloned.targetWorkload, latestTarget);
          // If neither template nor history has values, fall back to section pattern
          const effectiveTarget = hasMeaningfulTargetValue(mergedTarget)
            ? mergedTarget
            : mergeTargetWorkload(sectionFallbackWorkload, mergedTarget);
          return {
            ...cloned,
            targetWorkload: applyMovementConfigurationToWorkload(
              effectiveTarget,
              latestTarget || sectionFallbackWorkload,
              movementConfig
            ),
          };
        }

        const fallbackMovement = selected[fillIndex];
        fillIndex += 1;
        const usage = createUsageFromMovement(
          fallbackMovement,
          usageIndex + 1,
          templateUsage,
          sectionFallbackWorkload
        );
        const latestTarget = fallbackMovement
          ? resolveLatestTargetForMovement(fallbackMovement.movementId)
          : undefined;
        const movementConfig = fallbackMovement
          ? movementContextById?.[fallbackMovement.movementId]?.configuration
          : undefined;
        return {
          ...usage,
          targetWorkload: applyMovementConfigurationToWorkload(
            mergeTargetWorkload(usage.targetWorkload, latestTarget),
            latestTarget,
            movementConfig
          ),
        };
      }).filter((usage) => usage.movementId || usage.categoryId || usage.note || usage.setEntries?.length);

      const finalizedUsages = movementUsages.length > 0
        ? movementUsages
        : [createUsageFromMovement(selected[0], 1, undefined, sectionFallbackWorkload)];

      const templateSets = inferRoundSetCount(template?.round);
      const sectionSets = inferSectionSetCount(section);

      return {
        ordinal: sectionIndex + 1,
        sets: Math.max(templateSets, sectionSets),
        sectionName: template?.round.sectionName || section.workoutTypeName,
        sectionColor: template?.round.sectionColor,
        workoutTypeId: section.workoutTypeId,
        movementUsages: finalizedUsages,
      };
    });
}

function normalizeCategory(category?: string): string | undefined {
  if (!category) return undefined;
  return category.trim().toLowerCase();
}

function getGlobalFallbackWorkload(
  movements: MovementStat[],
  preferRepsWeight?: boolean
): Partial<ClientWorkoutTargetWorkload> | undefined {
  if (preferRepsWeight) {
    // For strength-type sections, prefer a workload that has reps or weight
    const strengthMatch = movements.find(
      (m) =>
        m.latestTargetWorkload &&
        (hasTextValue(m.latestTargetWorkload.reps) || hasTextValue(m.latestTargetWorkload.weight))
    );
    if (strengthMatch) return strengthMatch.latestTargetWorkload;
  }
  // Otherwise prefer time-based
  const timeMatch = movements.find(
    (m) => m.latestTargetWorkload && hasTextValue(m.latestTargetWorkload.time)
  );
  if (timeMatch && !preferRepsWeight) return timeMatch.latestTargetWorkload;
  // Last resort: any meaningful workload
  return movements.find((m) => hasMeaningfulTargetValue(m.latestTargetWorkload))?.latestTargetWorkload;
}

export function buildWorkoutDraftFromHistory(input: {
  categoryName?: string;
  structureTemplateId?: string;
  structureSections?: StructureSectionForDraft[];
  recentWorkouts: HistoricalWorkoutForDraft[];
  fallbackTitle?: string;
  currentNotes?: string;
  categoryContextById?: Record<string, CategoryContextForDraft>;
  movementContextById?: Record<string, MovementContextForDraft>;
  sessionDurationMinutes?: number;
  clientContext?: ClientContextForDraft;
}): GenerateWorkoutDraftResponse {
  const normalizedCategory = normalizeCategory(input.categoryName);
  const filteredByCategory = normalizedCategory
    ? input.recentWorkouts.filter((workout) => normalizeCategory(workout.categoryName) === normalizedCategory)
    : input.recentWorkouts;

  const candidateWorkouts = filteredByCategory.length > 0 ? filteredByCategory : input.recentWorkouts;
  const historicalMovements = buildMovementStats(candidateWorkouts);
  const allHistoricalMovements = buildMovementStats(input.recentWorkouts);
  const libraryMovements = buildLibraryMovementStats(input.movementContextById, candidateWorkouts.length);
  const categoryEnrichedMovements = mergeMovementStats(historicalMovements, allHistoricalMovements);
  const rankedMovements = mergeMovementStats(categoryEnrichedMovements, libraryMovements);
  const historicalRoundTemplates = buildHistoricalRoundTemplates(candidateWorkouts);
  const actualSessionsPerWeek = getActualSessionsPerWeek(candidateWorkouts);

  const globalContextText = compactText([
    input.categoryName,
    input.currentNotes,
    input.clientContext?.notes,
    input.clientContext?.goals,
    input.clientContext?.eventGoals?.map((goal) => goal.description).filter(Boolean).join(' '),
    input.clientContext?.trainingPhases?.map((phase) => phase.periodName).filter(Boolean).join(' '),
  ]);

  const categoryBiasKeywords = Array.from(
    new Set([
      ...getContextKeywordHints(input.categoryName || ''),
      ...extractMeaningfulKeywords(input.categoryName || ''),
    ])
  );

  const structureSections = input.structureSections || [];

  // Use scheduled event duration as a global density hint when available.
  // Example: a 30-min workout should usually have fewer movements than a 60-min one.
  const totalSessionMinutes =
    typeof input.sessionDurationMinutes === 'number' && input.sessionDurationMinutes > 0
      ? input.sessionDurationMinutes
      : undefined;

  const sectionsWithDuration =
    totalSessionMinutes && structureSections.length > 0
      ? structureSections.map((section) => {
          const hasDefaultDuration = typeof section.configuration?.defaultDuration === 'number' && section.configuration.defaultDuration > 0;
          if (hasDefaultDuration) return section;

          const equalSplit = Math.max(8, Math.round(totalSessionMinutes / structureSections.length));
          return {
            ...section,
            configuration: {
              ...(section.configuration || {}),
              defaultDuration: equalSplit,
            },
          };
        })
      : structureSections;

  if (sectionsWithDuration.length > 0 && totalSessionMinutes) {
    const scaledSections = sectionsWithDuration.map((section) => {
      const baseDuration = section.configuration?.defaultDuration || 0;
      let adjustedDuration = baseDuration;

      // Scale section duration hints by session length tier.
      if (totalSessionMinutes <= 35) {
        adjustedDuration = Math.max(6, Math.round(baseDuration * 0.8));
      } else if (totalSessionMinutes >= 75) {
        adjustedDuration = Math.round(baseDuration * 1.15);
      }

      return {
        ...section,
        configuration: {
          ...(section.configuration || {}),
          defaultDuration: adjustedDuration,
        },
      };
    });

    // Replace for downstream structure-aware generation
    sectionsWithDuration.splice(0, sectionsWithDuration.length, ...scaledSections);
  }

  if (structureSections.length > 0) {
    const rounds = buildRoundsFromStructure(
      sectionsWithDuration,
      historicalRoundTemplates,
      rankedMovements,
      input.categoryContextById,
      input.movementContextById,
      {
        globalContextText,
        targetSessionsPerWeek: input.clientContext?.targetSessionsPerWeek,
        actualSessionsPerWeek,
        categoryBiasKeywords,
      }
    );
    return {
      draft: {
        title: buildDraftTitle(input.categoryName, input.fallbackTitle),
        rounds,
        structureTemplateId: input.structureTemplateId,
      },
      source: {
        recentWorkoutsAnalyzed: candidateWorkouts.length,
        strategy: 'history-with-structure',
      },
    };
  }

  if (candidateWorkouts.length > 0 && candidateWorkouts[0].rounds && candidateWorkouts[0].rounds!.length > 0) {
    return {
      draft: {
        title: buildDraftTitle(input.categoryName, input.fallbackTitle),
        rounds: cloneRounds(candidateWorkouts[0].rounds),
      },
      source: {
        recentWorkoutsAnalyzed: candidateWorkouts.length,
        strategy: 'history-clone',
      },
    };
  }

  return {
    draft: {
      title: buildDraftTitle(input.categoryName, input.fallbackTitle),
      rounds: [
        {
          ordinal: 1,
          sets: 1,
          movementUsages: [
            {
              ordinal: 1,
              movementId: '',
              categoryId: '',
              targetWorkload: cloneTargetWorkload(),
            },
          ],
        },
      ],
    },
    source: {
      recentWorkoutsAnalyzed: candidateWorkouts.length,
      strategy: 'fallback',
    },
  };
}