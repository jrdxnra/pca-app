import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';
import { getAdminDb } from '@/lib/firebase/admin';
import { MASTER_UID } from '@/lib/firebase/services/memberships';
import {
	buildWorkoutDraftFromHistory,
	type CategoryContextForDraft,
	type ClientContextForDraft,
	type ClientMovementProfileForDraft,
	type GenerateWorkoutDraftRequest,
	type HistoricalWorkoutForDraft,
	type MovementContextForDraft,
	type StructureSectionForDraft,
} from '@/lib/ai/workoutDraft';

const DEFAULT_DDS_RECENT_WORKOUT_LIMIT = 24;
type DdsEngineMode = 'current' | 'baseline';
type DdsFlow = 'single' | 'monthly' | 'weekly';
const FILL_DRAFT_ADMIN_DEBUG_NOTE =
	'CHECKLIST: verify Firebase Admin credentials in deployment env (FIREBASE_SERVICE_ACCOUNT_KEY/FIREBASE_SERVICE_ACCOUNT/GOOGLE_APPLICATION_CREDENTIALS), service account IAM access to Firestore, and correct project binding.';

function resolveRecentWorkoutLimit(): number {
	const raw = process.env.DDS_RECENT_WORKOUT_LIMIT;
	if (!raw) return DEFAULT_DDS_RECENT_WORKOUT_LIMIT;

	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_DDS_RECENT_WORKOUT_LIMIT;
	}

	return Math.min(Math.floor(parsed), 50);
}

function resolveDdsEngineMode(): DdsEngineMode {
	const raw = (process.env.DDS_ENGINE_MODE || '').trim().toLowerCase();
	if (raw === 'baseline') return 'baseline';
	return 'current';
}

function resolveRequestFlow(request: NextRequest): DdsFlow {
	const raw = (request.headers.get('x-dds-flow') || '').trim().toLowerCase();
	if (raw === 'monthly') return 'monthly';
	if (raw === 'weekly') return 'weekly';
	return 'single';
}

function parseEnvFlag(raw: string | undefined, fallback: boolean): boolean {
	if (!raw) return fallback;
	const normalized = raw.trim().toLowerCase();
	if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
	if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
	return fallback;
}

function isFlowEnabled(flow: DdsFlow): boolean {
	if (flow === 'monthly') {
		return parseEnvFlag(process.env.DDS_ENABLE_MONTHLY_FILL, true);
	}

	if (flow === 'weekly') {
		return parseEnvFlag(process.env.DDS_ENABLE_WEEKLY_FILL, true);
	}

	return parseEnvFlag(process.env.DDS_ENABLE_SINGLE_FILL, true);
}

type FillDraftTelemetryFields = {
	flow: DdsFlow;
	engineMode: DdsEngineMode;
	accountId?: string;
	userId?: string;
	status: number;
	latencyMs: number;
	templateId?: string;
	categoryName?: string;
	errorCode?: string;
	errorMessage?: string;
	strategy?: string;
	recentWorkoutsAnalyzed?: number;
};

function logFillDraftTelemetry(event: 'success' | 'error', fields: FillDraftTelemetryFields): void {
	const payload = {
		event,
		...fields,
	};

	void persistFillDraftTelemetry(payload);

	if (event === 'success') {
		console.info('[Fill Draft API][telemetry]', payload);
		return;
	}

	console.warn('[Fill Draft API][telemetry]', payload);
}

async function persistFillDraftTelemetry(payload: {
	event: 'success' | 'error';
	flow: DdsFlow;
	engineMode: DdsEngineMode;
	accountId?: string;
	userId?: string;
	status: number;
	latencyMs: number;
	templateId?: string;
	categoryName?: string;
	errorCode?: string;
	errorMessage?: string;
	strategy?: string;
	recentWorkoutsAnalyzed?: number;
}): Promise<void> {
	try {
		const db = getAdminDb();
		await db.collection('ddsFillTelemetry').add({
			...payload,
			createdAt: new Date(),
		});
	} catch (error) {
		// Keep telemetry best-effort so draft generation never fails on logging.
		console.warn('[Fill Draft API][telemetry_persist_failed]', {
			error: error instanceof Error ? error.message : String(error),
			flow: payload.flow,
			status: payload.status,
			accountId: payload.accountId,
		});
	}
}

const RequestSchema = z.object({
	clientId: z.string().min(1),
	categoryName: z.string().optional(),
	structureTemplateId: z.string().optional(),
	sessionDurationMinutes: z.number().int().positive().max(300).optional(),
	currentTitle: z.string().optional(),
	currentNotes: z.string().optional(),
	goals: z.string().optional(),
	includeDecisionTrace: z.boolean().optional(),
});

function hasAdminFirestoreCredentials(): boolean {
	return Boolean(
		process.env.FIRESTORE_EMULATOR_HOST ||
		process.env.GOOGLE_APPLICATION_CREDENTIALS ||
		process.env.FIREBASE_SERVICE_ACCOUNT ||
		process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
		process.env.GOOGLE_CLOUD_PROJECT
	);
}

function createMissingAdminCredentialResponse() {
	return NextResponse.json(
		{
			error: 'Firebase Admin credentials are not configured for Fill Draft API.',
			code: 'missing_admin_credentials',
			debugNote: FILL_DRAFT_ADMIN_DEBUG_NOTE,
			environment: process.env.NODE_ENV || 'unknown',
		},
		{ status: 503 }
	);
}

function timestampToMillis(value: unknown): number | undefined {
	if (!value) return undefined;

	const maybeTimestamp = value as { toMillis?: () => number; seconds?: number };
	if (typeof maybeTimestamp.toMillis === 'function') {
		return maybeTimestamp.toMillis();
	}

	if (typeof maybeTimestamp.seconds === 'number') {
		return maybeTimestamp.seconds * 1000;
	}

	return undefined;
}

async function resolveAccountIdForUser(userId: string): Promise<string | null> {
	if (userId === MASTER_UID) {
		return 'master';
	}

	const db = getAdminDb();
	const membershipSnapshot = await db.collection('memberships').where('userId', '==', userId).limit(5).get();
	if (membershipSnapshot.empty) {
		return null;
	}

	const membershipDoc = membershipSnapshot.docs.find((doc) => {
		const data = doc.data();
		return typeof data.accountId === 'string' && data.accountId.trim().length > 0;
	});

	if (!membershipDoc) {
		return null;
	}

	const membership = membershipDoc.data();
	return membership.accountId || null;
}

async function fetchStructureSections(
	accountId: string,
	structureTemplateId?: string
): Promise<StructureSectionForDraft[]> {
	if (!structureTemplateId) return [];

	const db = getAdminDb();
	const templateDoc = await db.collection('workoutStructureTemplates').doc(structureTemplateId).get();
	if (!templateDoc.exists) return [];

	const data = templateDoc.data();
	if (!data || !Array.isArray(data.sections)) {
		return [];
	}

	// Support both legacy and current ownership models.
	// Some templates were saved without ownerId but with accountId, and some
	// system/legacy templates have neither field populated.
	const ownerId = typeof data.ownerId === 'string' ? data.ownerId.trim() : '';
	const templateAccountId = typeof data.accountId === 'string' ? data.accountId.trim() : '';
	const hasExplicitOwner = ownerId.length > 0 || templateAccountId.length > 0;
	const belongsToAccount = ownerId === accountId || templateAccountId === accountId;

	if (hasExplicitOwner && !belongsToAccount) {
		return [];
	}

	// Collect all workoutTypeIds so we can fetch their descriptions in one batch
	const workoutTypeIds: string[] = [];
	for (const section of data.sections) {
		if (typeof section.workoutTypeId === 'string' && section.workoutTypeId.trim()) {
			workoutTypeIds.push(section.workoutTypeId.trim());
		}
	}

	const workoutTypeDescriptions: Record<string, string> = {};
	if (workoutTypeIds.length > 0) {
		const uniqueIds = Array.from(new Set(workoutTypeIds));
		const typeDocPromises = uniqueIds.map((id) => db.collection('workoutTypes').doc(id).get());
		const typeDocs = await Promise.all(typeDocPromises);
		for (const typeDoc of typeDocs) {
			if (typeDoc.exists) {
				const typeData = typeDoc.data();
				if (typeData && typeof typeData.description === 'string' && typeData.description.trim()) {
					workoutTypeDescriptions[typeDoc.id] = typeData.description.trim();
				}
			}
		}
	}

	return data.sections.map((section: any) => ({
		order: Number(section.order) || 0,
		workoutTypeId: section.workoutTypeId,
		workoutTypeName: section.workoutTypeName,
		workoutTypeDescription: section.workoutTypeId ? workoutTypeDescriptions[section.workoutTypeId] : undefined,
		workoutIntentId: section.workoutIntentId,
		workoutIntentKey: section.workoutIntentKey,
		workoutIntentName: section.workoutIntentName,
		configuration: section.configuration
			? {
					defaultDuration: section.configuration.defaultDuration,
					defaultStructure: section.configuration.defaultStructure,
					focusArea: section.configuration.focusArea,
					aiGuidance: section.configuration.aiGuidance,
				}
			: undefined,
	}));
}

async function fetchMovementCategoryContextMap(accountId: string): Promise<Record<string, CategoryContextForDraft>> {
	const db = getAdminDb();
	const snapshot = await db
		.collection('movement-categories')
		.where('ownerId', '==', accountId)
		.limit(500)
		.get();

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
	const snapshot = await db
		.collection('movements')
		.where('ownerId', '==', accountId)
		.limit(2500)
		.get();

	const map: Record<string, MovementContextForDraft> = {};
	for (const doc of snapshot.docs) {
		const data = doc.data();
		const config = data.configuration && typeof data.configuration === 'object' ? data.configuration : undefined;
		map[doc.id] = {
			categoryId: typeof data.categoryId === 'string' ? data.categoryId.trim() || undefined : undefined,
			name: typeof data.name === 'string' ? data.name.trim() || undefined : undefined,
			instructions: typeof data.instructions === 'string' ? data.instructions.trim() || undefined : undefined,
			configuration: config
				? {
						useReps: Boolean(config.useReps),
						useTempo: Boolean(config.useTempo),
						useTime: Boolean(config.useTime),
						timeMeasure: config.timeMeasure === 'm' ? 'm' : 's',
						useWeight: Boolean(config.useWeight),
						weightMeasure:
							config.weightMeasure === 'kg' || config.weightMeasure === 'bw' ? config.weightMeasure : 'lbs',
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
	const clientDoc = await db.collection('clients').doc(clientId).get();
	if (!clientDoc.exists) return {};

	const data = clientDoc.data();
	if (!data || data.ownerId !== accountId) return {};

	return {
		notes: typeof data.notes === 'string' ? data.notes : undefined,
		goals: typeof data.goals === 'string' ? data.goals : undefined,
		eventGoals: Array.isArray(data.eventGoals)
			? data.eventGoals.map((goal: any) => ({
					description: typeof goal?.description === 'string' ? goal.description : undefined,
					date: typeof goal?.date === 'string' ? goal.date : undefined,
				}))
			: undefined,
		trainingPhases: Array.isArray(data.trainingPhases)
			? data.trainingPhases.map((phase: any) => ({
					periodName: typeof phase?.periodName === 'string' ? phase.periodName : undefined,
					startDate: typeof phase?.startDate === 'string' ? phase.startDate : undefined,
					endDate: typeof phase?.endDate === 'string' ? phase.endDate : undefined,
				}))
			: undefined,
		targetSessionsPerWeek:
			typeof data.targetSessionsPerWeek === 'number' ? data.targetSessionsPerWeek : undefined,
		sessionCounts:
			data.sessionCounts && typeof data.sessionCounts === 'object'
				? {
						thisWeek: typeof data.sessionCounts.thisWeek === 'number' ? data.sessionCounts.thisWeek : undefined,
						thisMonth: typeof data.sessionCounts.thisMonth === 'number' ? data.sessionCounts.thisMonth : undefined,
						total: typeof data.sessionCounts.total === 'number' ? data.sessionCounts.total : undefined,
					}
				: undefined,
	};
}

async function fetchClientMovementProfile(
	accountId: string,
	clientId: string
): Promise<ClientMovementProfileForDraft> {
	const db = getAdminDb();
	const profileRef = db.collection('clientMovementProfiles').doc(clientId);
	const profileDoc = await profileRef.get();

	if (!profileDoc.exists) {
		const bootstrap: ClientMovementProfileForDraft & { ownerId: string; clientId: string; createdAt: Date; updatedAt: Date } = {
			ownerId: accountId,
			clientId,
			equipmentAccess: [],
			restrictions: [],
			preferences: [],
			familyProfiles: [],
			feedbackLog: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		await profileRef.set(bootstrap, { merge: true });
		return {
			equipmentAccess: [],
			restrictions: [],
			preferences: [],
			familyProfiles: [],
			feedbackLog: [],
		};
	}

	const data = profileDoc.data() as Record<string, unknown>;
	if (!data || data.ownerId !== accountId || data.clientId !== clientId) {
		return {
			equipmentAccess: [],
			restrictions: [],
			preferences: [],
			familyProfiles: [],
			feedbackLog: [],
		};
	}

	const isPreferenceStatus = (
		value: unknown
	): value is 'allow' | 'avoid' | 'preferred' =>
		value === 'allow' || value === 'avoid' || value === 'preferred';

	const isReadiness = (
		value: unknown
	): value is 'low' | 'moderate' | 'high' =>
		value === 'low' || value === 'moderate' || value === 'high';

	const isProgressionStage = (
		value: unknown
	): value is 'rebuild' | 'base' | 'build' | 'peak' | 'maintain' =>
		value === 'rebuild' ||
		value === 'base' ||
		value === 'build' ||
		value === 'peak' ||
		value === 'maintain';

	const isFeedbackSignal = (
		value: unknown
	): value is 'too_easy' | 'too_hard' | 'pain' | 'great_quality' | 'time_overrun' | 'poor_tolerance' | 'good_tolerance' =>
		value === 'too_easy' ||
		value === 'too_hard' ||
		value === 'pain' ||
		value === 'great_quality' ||
		value === 'time_overrun' ||
		value === 'poor_tolerance' ||
		value === 'good_tolerance';

	return {
		equipmentAccess: Array.isArray(data.equipmentAccess)
			? data.equipmentAccess.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
			: [],
		restrictions: Array.isArray(data.restrictions)
			? data.restrictions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
			: [],
		preferences: Array.isArray(data.preferences)
			? data.preferences
				.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
				.map((item) => ({
					movementId: typeof item.movementId === 'string' ? item.movementId : '',
					status: isPreferenceStatus(item.status) ? item.status : 'allow',
					reason: typeof item.reason === 'string' ? item.reason : undefined,
				}))
				.filter((item) => item.movementId)
			: [],
		familyProfiles: Array.isArray(data.familyProfiles)
			? data.familyProfiles
				.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
				.map((item) => ({
					familyKey: typeof item.familyKey === 'string' ? item.familyKey : '',
					readiness: isReadiness(item.readiness) ? item.readiness : undefined,
					progressionStage: isProgressionStage(item.progressionStage) ? item.progressionStage : undefined,
				}))
				.filter((item) => item.familyKey)
			: [],
		feedbackLog: Array.isArray(data.feedbackLog)
			? data.feedbackLog
				.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
				.map((item) => ({
					movementId: typeof item.movementId === 'string' ? item.movementId : undefined,
					familyKey: typeof item.familyKey === 'string' ? item.familyKey : undefined,
					signal: isFeedbackSignal(item.signal) ? item.signal : 'good_tolerance',
					score: typeof item.score === 'number' ? item.score : undefined,
				}))
			: [],
	};
}

async function fetchRecentWorkouts(accountId: string, clientId: string): Promise<HistoricalWorkoutForDraft[]> {
	const db = getAdminDb();
	const recentWorkoutLimit = resolveRecentWorkoutLimit();
	const fetchLimit = Math.min(Math.max(recentWorkoutLimit * 4, 120), 400);

	const snapshot = await db
		.collection('clientWorkouts')
		.where('ownerId', '==', accountId)
		.where('clientId', '==', clientId)
		.limit(fetchLimit)
		.get();

	const workouts = snapshot.docs
		.map((doc) => {
			const data = doc.data();

			return {
				id: doc.id,
				categoryName: data.categoryName,
				title: data.title,
				notes: data.notes,
				rounds: data.rounds,
				dateMillis: timestampToMillis(data.date) || timestampToMillis(data.updatedAt),
			} as HistoricalWorkoutForDraft;
		})
		.filter((item): item is HistoricalWorkoutForDraft => Boolean(item))
		.sort((a, b) => (b.dateMillis || 0) - (a.dateMillis || 0))
		// TUNING PARAMETER: Recent history window for DDS analysis.
		// Smaller (e.g., 6) = more recent bias, faster evolution.
		// Larger (e.g., 24-32) = broader patterns, more stable recommendations.
		// Current default: 24 sessions provides good balance of recency + pattern recognition.
		.slice(0, recentWorkoutLimit);

	return workouts;
}

export async function POST(request: NextRequest) {
	const startedAt = Date.now();
	const flow = resolveRequestFlow(request);
	const engineMode = resolveDdsEngineMode();
	const safeTemplateId = request.nextUrl.searchParams.get('templateId') || undefined;
	let telemetryUserId: string | undefined;
	let telemetryAccountId: string | undefined;
	try {
		if (process.env.NODE_ENV === 'development' && !hasAdminFirestoreCredentials()) {
			console.error('[Fill Draft API][missing_admin_credentials]', {
				environment: process.env.NODE_ENV || 'unknown',
				hasFirestoreEmulatorHost: Boolean(process.env.FIRESTORE_EMULATOR_HOST),
				hasGoogleApplicationCredentials: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
				hasFirebaseServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
				hasFirebaseServiceAccountKey: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY),
				hasGoogleCloudProject: Boolean(process.env.GOOGLE_CLOUD_PROJECT),
			});
			logFillDraftTelemetry('error', {
				flow,
				engineMode,
				status: 503,
				latencyMs: Date.now() - startedAt,
				templateId: safeTemplateId,
				errorCode: 'missing_admin_credentials',
				errorMessage: 'Missing Firebase Admin credentials in development.',
			});
			return createMissingAdminCredentialResponse();
		}

		const userId = await getAuthenticatedUser(request);
		telemetryUserId = userId || undefined;
		if (!userId) {
			logFillDraftTelemetry('error', {
				flow,
				engineMode,
				userId: telemetryUserId,
				status: 401,
				latencyMs: Date.now() - startedAt,
				templateId: safeTemplateId,
				errorCode: 'unauthorized',
				errorMessage: 'Missing authenticated user.',
			});
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const parsed = RequestSchema.safeParse(await request.json());
		if (!parsed.success) {
			logFillDraftTelemetry('error', {
				flow,
				engineMode,
				userId: telemetryUserId,
				status: 400,
				latencyMs: Date.now() - startedAt,
				templateId: safeTemplateId,
				errorCode: 'invalid_request_payload',
				errorMessage: 'Request schema validation failed.',
			});
			return NextResponse.json(
				{ error: 'Invalid request payload', details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const payload: GenerateWorkoutDraftRequest = parsed.data;
		if (!isFlowEnabled(flow)) {
			logFillDraftTelemetry('error', {
				flow,
				engineMode,
				userId: telemetryUserId,
				status: 409,
				latencyMs: Date.now() - startedAt,
				templateId: payload.structureTemplateId,
				categoryName: payload.categoryName,
				errorCode: 'dds_flow_disabled',
				errorMessage: `DDS flow disabled for ${flow}`,
			});
			return NextResponse.json(
				{
					error: `DDS +Fill is disabled for ${flow} flow in this environment.`,
					code: 'dds_flow_disabled',
					flow,
				},
				{ status: 409 }
			);
		}

		const accountId = await resolveAccountIdForUser(userId);
		telemetryAccountId = accountId || undefined;
		if (!accountId) {
			logFillDraftTelemetry('error', {
				flow,
				engineMode,
				userId: telemetryUserId,
				accountId: telemetryAccountId,
				status: 403,
				latencyMs: Date.now() - startedAt,
				templateId: payload.structureTemplateId,
				categoryName: payload.categoryName,
				errorCode: 'no_active_account',
				errorMessage: 'No active account found for user.',
			});
			return NextResponse.json({ error: 'No active account found' }, { status: 403 });
		}

		const [structureSections, recentWorkouts, clientContext, movementCategoryContextMap, movementContextMap, movementProfile] = await Promise.all([
			fetchStructureSections(accountId, payload.structureTemplateId),
			fetchRecentWorkouts(accountId, payload.clientId),
			fetchClientContext(accountId, payload.clientId),
			fetchMovementCategoryContextMap(accountId),
			fetchMovementContextMap(accountId),
			fetchClientMovementProfile(accountId, payload.clientId),
		]);

		// Do not silently degrade to history-clone when a specific structure template
		// was requested but could not be resolved.
		if (payload.structureTemplateId && structureSections.length === 0) {
			logFillDraftTelemetry('error', {
				flow,
				engineMode,
				userId: telemetryUserId,
				accountId: telemetryAccountId,
				status: 422,
				latencyMs: Date.now() - startedAt,
				templateId: payload.structureTemplateId,
				categoryName: payload.categoryName,
				errorCode: 'template_unavailable',
				errorMessage: 'Requested structure template unavailable for account.',
			});
			return NextResponse.json(
				{ error: 'Selected structure template is unavailable for this account.' },
				{ status: 422 }
			);
		}

		const fallbackTitle = payload.currentTitle?.trim()
			? payload.currentTitle.trim()
			: `${payload.categoryName || 'Workout'} Draft`;

		const isBaselineEngine = engineMode === 'baseline';

		const draft = buildWorkoutDraftFromHistory({
			categoryName: payload.categoryName,
			goals: isBaselineEngine ? undefined : payload.goals,
			structureTemplateId: payload.structureTemplateId,
			structureSections,
			recentWorkouts,
			fallbackTitle,
			currentNotes: isBaselineEngine ? undefined : payload.currentNotes,
			includeDecisionTrace: payload.includeDecisionTrace,
			categoryContextById: movementCategoryContextMap,
			movementContextById: movementContextMap,
			movementProfile: isBaselineEngine
				? {
					equipmentAccess: movementProfile.equipmentAccess || [],
					restrictions: movementProfile.restrictions || [],
					preferences: [],
					familyProfiles: [],
					feedbackLog: [],
				}
				: movementProfile,
			sessionDurationMinutes: payload.sessionDurationMinutes,
			clientContext: isBaselineEngine
				? {
					targetSessionsPerWeek: clientContext.targetSessionsPerWeek,
					sessionCounts: clientContext.sessionCounts,
				}
				: clientContext,
			engineMode,
		});

		logFillDraftTelemetry('success', {
			flow,
			engineMode,
			userId: telemetryUserId,
			accountId: telemetryAccountId,
			status: 200,
			latencyMs: Date.now() - startedAt,
			templateId: payload.structureTemplateId,
			categoryName: payload.categoryName,
			strategy: draft.source.strategy,
			recentWorkoutsAnalyzed: draft.source.recentWorkoutsAnalyzed,
		});

		return NextResponse.json(draft);
	} catch (error) {
		console.error('[Fill Draft API] Failed to generate workout draft:', error);
		const message = error instanceof Error ? error.message : 'Failed to generate draft';
		const looksLikeMissingAdminCredentials = /default credentials|service account|credential|google_application_credentials|firestore emulator/i.test(message);
		if (looksLikeMissingAdminCredentials) {
			console.error('[Fill Draft API][missing_admin_credentials_runtime]', {
				environment: process.env.NODE_ENV || 'unknown',
				message,
			});
			logFillDraftTelemetry('error', {
				flow,
				engineMode,
				userId: telemetryUserId,
				accountId: telemetryAccountId,
				status: 503,
				latencyMs: Date.now() - startedAt,
				templateId: safeTemplateId,
				errorCode: 'missing_admin_credentials_runtime',
				errorMessage: message,
			});
			return createMissingAdminCredentialResponse();
		}
		logFillDraftTelemetry('error', {
			flow,
			engineMode,
			userId: telemetryUserId,
			accountId: telemetryAccountId,
			status: 500,
			latencyMs: Date.now() - startedAt,
			templateId: safeTemplateId,
			errorCode: 'draft_generation_failed',
			errorMessage: message,
		});
		return NextResponse.json({ error: message }, { status: 500 });
	}
}