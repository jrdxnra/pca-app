import { z } from 'zod';

export const skillSandboxTrainingStyles = [
	'strength',
	'hypertrophy',
	'power',
	'conditioning',
	'endurance',
	'skill',
	'prehab',
	'mobility',
] as const;

export const skillSandboxTimeHorizons = ['single', 'weekly', 'monthly'] as const;

export const skillSandboxPhaseTypes = [
	'accumulation',
	'intensification',
	'deload',
	'return-to-train',
	'peaking',
	'general-prep',
] as const;

const stringListSchema = z.array(z.string().trim().min(1)).default([]);

const recentWorkoutSchema = z.object({
	id: z.string().min(1),
	date: z.string().min(1),
	title: z.string().min(1),
	focus: z.string().min(1),
	summary: z.string().default(''),
	readiness: z.number().min(1).max(5).optional(),
	notes: z.string().default(''),
});

const calendarEventSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	type: z.enum(['travel', 'holiday', 'deload', 'competition', 'custom']),
	impact: z.enum(['low', 'medium', 'high']).default('medium'),
	notes: z.string().default(''),
});

export const skillSandboxRequestSchema = z.object({
	clientProfile: z.object({
		clientId: z.string().min(1),
		name: z.string().min(1),
		trainingAge: z.string().min(1),
		primaryGoal: z.string().min(1),
		secondaryGoals: stringListSchema,
		restrictions: stringListSchema,
		preferences: stringListSchema,
	}),
	trainingStyle: z.enum(skillSandboxTrainingStyles),
	timeHorizon: z.enum(skillSandboxTimeHorizons),
	blockContext: z.object({
		phase: z.enum(skillSandboxPhaseTypes),
		blockName: z.string().min(1),
		weekNumber: z.number().int().positive(),
		weeksRemaining: z.number().int().nonnegative(),
		notes: z.string().default(''),
	}),
	sessionContext: z.object({
		sessionDate: z.string().min(1),
		templateName: z.string().min(1),
		sessionType: z.string().min(1),
		durationMinutes: z.number().int().positive().max(240),
		notes: z.string().default(''),
	}),
	recentWorkoutHistory: z.array(recentWorkoutSchema).max(12).default([]),
	feedbackContext: z.object({
		notes: stringListSchema,
		restrictions: stringListSchema,
		preferences: stringListSchema,
	}),
	calendarContext: z.object({
		events: z.array(calendarEventSchema).max(8).default([]),
		notes: z.string().default(''),
	}),
});

export type SkillSandboxRequest = z.infer<typeof skillSandboxRequestSchema>;

export type SkillOutputStatus = 'pass' | 'warn' | 'fail';

export interface SkillSandboxMovement {
	slot: string;
	movement: string;
	prescription: string;
	intent: string;
	notes?: string;
}

export interface SkillSandboxResponse {
	runId: string;
	requestedAt: string;
	references: string[];
	request: SkillSandboxRequest;
	skillOutputs: {
		contextAnalyzer: Record<string, unknown>;
		sessionPlanner: Record<string, unknown>;
		progressionReasoner: Record<string, unknown>;
		movementGenerator: Record<string, unknown>;
		qualityValidator: Record<string, unknown>;
		sessionSequencer: Record<string, unknown>;
		feedbackInterpreter: Record<string, unknown>;
	};
	finalWorkout: {
		title: string;
		sessionDate: string;
		trainingStyle: SkillSandboxRequest['trainingStyle'];
		sessionType: string;
		coachSummary: string;
		blocks: Array<{
			name: string;
			durationMinutes: number;
			movements: SkillSandboxMovement[];
		}>;
	};
	qaSummary: {
		status: SkillOutputStatus;
		warnings: string[];
		safetyIssues: string[];
		progressionIssues: string[];
		sequencingIssues: string[];
	};
}

export const defaultSkillSandboxRequest: SkillSandboxRequest = {
	clientProfile: {
		clientId: 'client-001',
		name: 'Demo Athlete',
		trainingAge: 'Intermediate (3 years)',
		primaryGoal: 'Build lower-body strength while keeping conditioning touch points',
		secondaryGoals: ['Keep sessions to 60 minutes', 'Avoid flaring shoulder irritation'],
		restrictions: ['Mild right shoulder irritation with high-volume overhead work'],
		preferences: ['Trap bar deadlifts over straight bar pulls', 'Likes supersets for accessories'],
	},
	trainingStyle: 'strength',
	timeHorizon: 'weekly',
	blockContext: {
		phase: 'accumulation',
		blockName: 'Base strength block',
		weekNumber: 3,
		weeksRemaining: 2,
		notes: 'Push training density modestly before deload.',
	},
	sessionContext: {
		sessionDate: '2026-08-18',
		templateName: 'Lower A',
		sessionType: 'Primary lower-body session',
		durationMinutes: 60,
		notes: 'Need a clean, coach-reviewable draft.',
	},
	recentWorkoutHistory: [
		{
			id: 'hist-1',
			date: '2026-08-15',
			title: 'Lower B',
			focus: 'hinge',
			summary: 'Trap bar deadlift emphasis with split squat accessories.',
			readiness: 4,
			notes: 'Moved well. Slight shoulder tension during front rack carries.',
		},
		{
			id: 'hist-2',
			date: '2026-08-13',
			title: 'Upper A',
			focus: 'upper push/pull',
			summary: 'Neutral-grip press, chest-supported row, arm accessories.',
			readiness: 3,
			notes: 'Pressing volume felt fine when kept submaximal.',
		},
	],
	feedbackContext: {
		notes: ['Last week felt productive, not overly fatiguing', 'Keep rest periods honest'],
		restrictions: ['Avoid aggressive overhead loading this week'],
		preferences: ['Prefer clear RPE or RIR guidance'],
	},
	calendarContext: {
		events: [
			{
				id: 'cal-1',
				label: 'Travel day on Friday',
				type: 'travel',
				impact: 'medium',
				notes: 'Want this session to do the heavy work before travel.',
			},
		],
		notes: 'No holidays. Deload expected next microcycle.',
	},
};

export const skillSandboxApiContract = {
	requestSections: {
		clientProfile: [
			'clientId',
			'name',
			'trainingAge',
			'primaryGoal',
			'secondaryGoals[]',
			'restrictions[]',
			'preferences[]',
		],
		trainingStyle: [...skillSandboxTrainingStyles],
		timeHorizon: [...skillSandboxTimeHorizons],
		blockContext: ['phase', 'blockName', 'weekNumber', 'weeksRemaining', 'notes'],
		sessionContext: ['sessionDate', 'templateName', 'sessionType', 'durationMinutes', 'notes'],
		recentWorkoutHistory: ['id', 'date', 'title', 'focus', 'summary', 'readiness', 'notes'],
		feedbackContext: ['notes[]', 'restrictions[]', 'preferences[]'],
		calendarContext: ['events[]', 'notes'],
	},
	defaultRequest: defaultSkillSandboxRequest,
	responseNotes: {
		skillOutputs:
			'Includes step-by-step outputs for Skills 1, 2, 7, 3, 4, 5, and 6 so the UI can inspect intermediate reasoning.',
		finalWorkout: 'Contains the generated workout separate from intermediate skill outputs.',
		qaSummary: 'Aggregates warnings plus safety, progression, and sequencing issues for QA visibility.',
	},
	references: [
		'about.md',
		'skills/skill-0-knowledge-base.md',
		'skills/skill-3-movement-generator.md',
		'skills/skill-7-progression-reasoner.md',
	],
};
