import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';
import { getAdminDb } from '@/lib/firebase/admin';
import { MASTER_UID } from '@/lib/firebase/services/memberships';
import {
	buildWorkoutDraftFromHistory,
	type CategoryContextForDraft,
	type ClientContextForDraft,
	type GenerateWorkoutDraftRequest,
	type HistoricalWorkoutForDraft,
	type MovementContextForDraft,
	type StructureSectionForDraft,
} from '@/lib/ai/workoutDraft';

const RequestSchema = z.object({
	clientId: z.string().min(1),
	categoryName: z.string().optional(),
	structureTemplateId: z.string().optional(),
	sessionDurationMinutes: z.number().int().positive().max(300).optional(),
	currentTitle: z.string().optional(),
	currentNotes: z.string().optional(),
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

async function fetchRecentWorkouts(accountId: string, clientId: string): Promise<HistoricalWorkoutForDraft[]> {
	const db = getAdminDb();

	const snapshot = await db
		.collection('clientWorkouts')
		.where('ownerId', '==', accountId)
		.limit(250)
		.get();

	const workouts = snapshot.docs
		.map((doc) => {
			const data = doc.data();
			if (data.clientId !== clientId) return null;

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
		.slice(0, 12);

	return workouts;
}

export async function POST(request: NextRequest) {
	try {
		if (process.env.NODE_ENV === 'development' && !hasAdminFirestoreCredentials()) {
			return NextResponse.json(
				{
					error:
						'Firebase Admin credentials are not configured for local dev. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_KEY, GOOGLE_APPLICATION_CREDENTIALS, or FIRESTORE_EMULATOR_HOST.',
					code: 'missing_admin_credentials',
				},
				{ status: 503 }
			);
		}

		const userId = await getAuthenticatedUser(request);
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const parsed = RequestSchema.safeParse(await request.json());
		if (!parsed.success) {
			return NextResponse.json(
				{ error: 'Invalid request payload', details: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		const payload: GenerateWorkoutDraftRequest = parsed.data;
		const accountId = await resolveAccountIdForUser(userId);
		if (!accountId) {
			return NextResponse.json({ error: 'No active account found' }, { status: 403 });
		}

		const [structureSections, recentWorkouts, clientContext, movementCategoryContextMap, movementContextMap] = await Promise.all([
			fetchStructureSections(accountId, payload.structureTemplateId),
			fetchRecentWorkouts(accountId, payload.clientId),
			fetchClientContext(accountId, payload.clientId),
			fetchMovementCategoryContextMap(accountId),
			fetchMovementContextMap(accountId),
		]);

		// Do not silently degrade to history-clone when a specific structure template
		// was requested but could not be resolved.
		if (payload.structureTemplateId && structureSections.length === 0) {
			return NextResponse.json(
				{ error: 'Selected structure template is unavailable for this account.' },
				{ status: 422 }
			);
		}

		const fallbackTitle = payload.currentTitle?.trim()
			? payload.currentTitle.trim()
			: `${payload.categoryName || 'Workout'} Draft`;

		const draft = buildWorkoutDraftFromHistory({
			categoryName: payload.categoryName,
			structureTemplateId: payload.structureTemplateId,
			structureSections,
			recentWorkouts,
			fallbackTitle,
			currentNotes: payload.currentNotes,
			categoryContextById: movementCategoryContextMap,
			movementContextById: movementContextMap,
			sessionDurationMinutes: payload.sessionDurationMinutes,
			clientContext,
		});

		return NextResponse.json(draft);
	} catch (error) {
		console.error('[Fill Draft API] Failed to generate workout draft:', error);
		const message = error instanceof Error ? error.message : 'Failed to generate draft';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}