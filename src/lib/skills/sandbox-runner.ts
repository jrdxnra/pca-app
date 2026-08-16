import {
	defaultSkillSandboxRequest,
	type SkillSandboxRequest,
	type SkillSandboxResponse,
} from '@/lib/skills/sandbox-contract';

const skillReferences = [
	'about.md',
	'skills/skill-0-knowledge-base.md',
	'skills/skill-3-movement-generator.md',
	'skills/skill-7-progression-reasoner.md',
];

const movementLibrary: Record<
	SkillSandboxRequest['trainingStyle'],
	{
		primary: string[];
		secondary: string[];
		accessory: string[];
		finisher: string[];
	}
> = {
	strength: {
		primary: ['Trap Bar Deadlift', 'Safety Bar Squat', 'Paused Front Squat'],
		secondary: ['Rear-Foot Elevated Split Squat', 'Barbell Hip Thrust', 'Chest-Supported Row'],
		accessory: ['Pallof Press', 'Single-Leg RDL', 'Sled Drag'],
		finisher: ['Bike recovery flush'],
	},
	hypertrophy: {
		primary: ['Hack Squat', 'Dumbbell Bench Press', 'Romanian Deadlift'],
		secondary: ['Walking Lunge', 'Lat Pulldown', 'Cable Row'],
		accessory: ['Lateral Raise', 'Leg Curl', 'Cable Crunch'],
		finisher: ['Short pump circuit'],
	},
	power: {
		primary: ['Hang Power Clean', 'Box Jump', 'Med Ball Scoop Toss'],
		secondary: ['Push Press', 'Trap Bar Jump', 'Bounds'],
		accessory: ['Sled Push', 'Landing Drill', 'Pogo Series'],
		finisher: ['Tempo breathing reset'],
	},
	conditioning: {
		primary: ['Assault Bike Intervals', 'Sled Push', 'Kettlebell Swing'],
		secondary: ['Walking Lunge', 'Push-Up', 'Row Erg'],
		accessory: ['Carry Complex', 'Dead Bug', 'Band Pull-Apart'],
		finisher: ['Cooldown walk'],
	},
	endurance: {
		primary: ['Zone 2 Bike', 'Tempo Run', 'Row Erg'],
		secondary: ['Step-Up', 'Single-Arm Row', 'Split Squat'],
		accessory: ['Calf Raise', 'Hamstring Bridge', 'Breathing Drill'],
		finisher: ['Mobility cooldown'],
	},
	skill: {
		primary: ['Turkish Get-Up', 'Handstand Hold', 'Ring Row'],
		secondary: ['Front Foot Elevated Split Squat', 'Dead Bug', 'Farmer Carry'],
		accessory: ['Wrist Prep', 'Scap Push-Up', 'Cossack Squat'],
		finisher: ['Patterning reset'],
	},
	prehab: {
		primary: ['Split Squat Iso Hold', 'Cable Row', 'Glute Bridge'],
		secondary: ['Band External Rotation', 'Heel-Elevated Goblet Squat', 'Dead Bug'],
		accessory: ['Ankle Rocker', 'Pallof Press', 'Hamstring Walkout'],
		finisher: ['Easy bike'],
	},
	mobility: {
		primary: ['90/90 Hip Flow', 'Thoracic Rotation', 'Cossack Squat'],
		secondary: ['Ankle Dorsiflexion Rock', 'Bear Crawl', 'Glute Bridge'],
		accessory: ['Breathing Drill', 'Side Plank', 'Adductor Rockback'],
		finisher: ['Parasympathetic cooldown'],
	},
};

function normalize(values: string[]): string {
	return values.join(' ').toLowerCase();
}

function createId(prefix: string): string {
	return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function hasKeyword(values: string[], keywords: string[]): boolean {
	const text = normalize(values);
	return keywords.some((keyword) => text.includes(keyword));
}

function pickMovement(
	style: SkillSandboxRequest['trainingStyle'],
	group: keyof (typeof movementLibrary)['strength'],
	index: number
): string {
	const options = movementLibrary[style][group];
	return options[index % options.length];
}

function applyRestrictions(movement: string, combinedRestrictions: string): string {
	if (combinedRestrictions.includes('shoulder') && /push press|handstand|overhead/i.test(movement)) {
		return 'Landmine Press';
	}

	if (combinedRestrictions.includes('back') && /deadlift|swing/i.test(movement)) {
		return 'Hip Thrust';
	}

	if (combinedRestrictions.includes('knee') && /squat|lunge/i.test(movement)) {
		return 'Box Squat';
	}

	return movement;
}

function isLoadedShoulderPress(movement: string): boolean {
	return /push press|bench press|landmine press|handstand/i.test(movement);
}

function buildPrescription(
	progressionMode: string,
	style: SkillSandboxRequest['trainingStyle'],
	slot: string,
	isDeload: boolean
): string {
	if (slot === 'Warm-Up') {
		return '2 rounds, smooth tempo, stop with 2-3 reps in reserve';
	}

	if (isDeload) {
		return '2-3 sets, cut normal volume by 30-40%, RPE 6';
	}

	if (style === 'power') {
		return progressionMode === 'progress'
			? '4 x 2-3, crisp reps, stop if speed drops >10%'
			: '3 x 2-3, keep bar speed fast and positions clean';
	}

	if (style === 'endurance' || style === 'conditioning') {
		return progressionMode === 'progress'
			? 'Work block increases by 5-10% while keeping pacing repeatable'
			: 'Hold volume steady and keep output even';
	}

	if (slot === 'Primary') {
		return progressionMode === 'progress' ? '4 x 4-6 @ RPE 7-8' : '3-4 x 4-6 @ RPE 6-7';
	}

	if (slot === 'Secondary') {
		return progressionMode === 'progress' ? '3 x 6-8 @ 2 RIR' : '3 x 6-8 @ 3 RIR';
	}

	if (slot === 'Accessory') {
		return '2-3 x 8-12, controlled tempo';
	}

	return '5-8 minutes easy quality work';
}

function buildBlocks(
	request: SkillSandboxRequest,
	progressionMode: string,
	isDeload: boolean
): SkillSandboxResponse['finalWorkout']['blocks'] {
	const restrictionText = normalize([
		...request.clientProfile.restrictions,
		...request.feedbackContext.restrictions,
	]);
	const duration = request.sessionContext.durationMinutes;
	const warmUpDuration = Math.min(10, Math.max(6, Math.round(duration * 0.15)));
	const finisherDuration = request.trainingStyle === 'strength' ? 6 : 8;
	const accessoryDuration = Math.max(10, Math.round(duration * 0.2));
	const mainDuration = Math.max(20, duration - warmUpDuration - finisherDuration - accessoryDuration);

	return [
		{
			name: 'Warm-Up',
			durationMinutes: warmUpDuration,
			movements: [
				{
					slot: 'Warm-Up',
					movement: applyRestrictions(pickMovement(request.trainingStyle, 'accessory', 0), restrictionText),
					prescription: buildPrescription(progressionMode, request.trainingStyle, 'Warm-Up', isDeload),
					intent: 'Prep the main pattern and check tolerance before loading.',
				},
			],
		},
		{
			name: 'Main Work',
			durationMinutes: mainDuration,
			movements: [
				{
					slot: 'Primary',
					movement: applyRestrictions(pickMovement(request.trainingStyle, 'primary', 0), restrictionText),
					prescription: buildPrescription(progressionMode, request.trainingStyle, 'Primary', isDeload),
					intent: 'Drive the primary adaptation for this session.',
				},
				{
					slot: 'Secondary',
					movement: applyRestrictions(pickMovement(request.trainingStyle, 'secondary', 0), restrictionText),
					prescription: buildPrescription(progressionMode, request.trainingStyle, 'Secondary', isDeload),
					intent: 'Support the primary lift without duplicating fatigue.',
				},
			],
		},
		{
			name: 'Accessories',
			durationMinutes: accessoryDuration,
			movements: [
				{
					slot: 'Accessory',
					movement: applyRestrictions(pickMovement(request.trainingStyle, 'accessory', 1), restrictionText),
					prescription: buildPrescription(progressionMode, request.trainingStyle, 'Accessory', isDeload),
					intent: 'Build tissue tolerance and fill the most useful gap for the block.',
				},
			],
		},
		{
			name: 'Finish',
			durationMinutes: finisherDuration,
			movements: [
				{
					slot: 'Finisher',
					movement: pickMovement(request.trainingStyle, 'finisher', 0),
					prescription: buildPrescription(progressionMode, request.trainingStyle, 'Finisher', isDeload),
					intent: 'Close the session without creating next-session interference.',
				},
			],
		},
	];
}

export function runSkillSandbox(request: SkillSandboxRequest = defaultSkillSandboxRequest): SkillSandboxResponse {
	const combinedRestrictionSources = [
		...request.clientProfile.restrictions,
		...request.feedbackContext.restrictions,
		...request.feedbackContext.notes,
		request.calendarContext.notes,
		...request.calendarContext.events.map((event) => `${event.type} ${event.label} ${event.notes}`),
	];

	const hasTravel = request.calendarContext.events.some((event) => event.type === 'travel');
	const hasDeloadWindow =
		request.blockContext.phase === 'deload' ||
		request.calendarContext.events.some((event) => event.type === 'deload') ||
		request.blockContext.notes.toLowerCase().includes('deload');
	const tooHardFeedback = hasKeyword(request.feedbackContext.notes, ['too hard', 'fatigue', 'smoked', 'beat up']);
	const painFeedback = hasKeyword(
		[...request.feedbackContext.notes, ...combinedRestrictionSources],
		['pain', 'irritation', 'flare']
	);
	const easyFeedback = hasKeyword(request.feedbackContext.notes, ['too easy', 'underloaded', 'fresh']);
	const latestReadiness = request.recentWorkoutHistory[0]?.readiness ?? 3;
	const progressionMode = hasDeloadWindow || tooHardFeedback || painFeedback
		? 'protect'
		: easyFeedback || latestReadiness >= 4
			? 'progress'
			: 'hold';

	const blocks = buildBlocks(request, progressionMode, hasDeloadWindow);
	const allMovements = blocks.flatMap((block) => block.movements);

	const contextAnalyzer = {
		skill: 'SKILL 1: Context Analyzer',
		summary: `${request.clientProfile.name} is in a ${request.blockContext.blockName} (${request.blockContext.phase}) ${request.trainingStyle} block with a ${request.timeHorizon} planning horizon.`,
		primaryGoal: request.clientProfile.primaryGoal,
		secondaryGoals: request.clientProfile.secondaryGoals,
		keyConstraints: [...request.clientProfile.restrictions, ...request.feedbackContext.restrictions],
		calendarImpacts: request.calendarContext.events.map((event) => `${event.type}: ${event.label}`),
		recommendedFocus: hasTravel ? 'Get the highest-value work done before travel compresses the week.' : 'Stay on the block objective without overspending fatigue.',
	};

	const sessionPlanner = {
		skill: 'SKILL 2: Session Planner',
		templateName: request.sessionContext.templateName,
		sessionType: request.sessionContext.sessionType,
		durationMinutes: request.sessionContext.durationMinutes,
		sessionDensity: request.sessionContext.durationMinutes < 50 ? 'compressed' : 'standard',
		plannedBlocks: blocks.map((block) => ({
			name: block.name,
			durationMinutes: block.durationMinutes,
		})),
		notes: [
			hasTravel ? 'Bias priority work earlier because travel reduces training flexibility.' : 'Normal session spacing assumptions apply.',
			hasDeloadWindow ? 'Use deload-aware planning and trim non-essential volume.' : 'Maintain normal training density.',
		],
	};

	const progressionReasoner = {
		skill: 'SKILL 7: Progression Reasoner',
		progressionMode,
		targetRPE: hasDeloadWindow ? '6' : progressionMode === 'progress' ? '7-8' : '6-7',
		targetRIR: hasDeloadWindow ? '3-4' : progressionMode === 'progress' ? '1-2' : '2-3',
		targetVelocity: request.trainingStyle === 'power' ? 'Stop set at >10% speed loss' : undefined,
		recommendDeload: hasDeloadWindow || (tooHardFeedback && latestReadiness <= 2),
		deloadProtocol: hasDeloadWindow ? 'Reduce volume 30-40% and keep intent crisp.' : undefined,
		rationale: [
			latestReadiness >= 4 ? 'Recent readiness supports progression.' : 'Recent readiness suggests a controlled session.',
			painFeedback ? 'Protective bias applied because feedback/restrictions mention pain or irritation.' : 'No acute pain signal detected.',
		],
	};

	const movementGenerator = {
		skill: 'SKILL 3: Movement Generator',
		style: request.trainingStyle,
		blocks,
		reasoning: [
			'Primary and secondary movements follow the current block objective.',
			'Movement choices were adjusted against restrictions, feedback, and calendar context.',
			'Prescriptions use progression outputs instead of inferring progression inside the generator.',
		],
	};

	const safetyIssues: string[] = [];
	if (normalize(combinedRestrictionSources).includes('shoulder') && allMovements.some((entry) => isLoadedShoulderPress(entry.movement))) {
		safetyIssues.push('Shoulder-sensitive context still contains pressing exposure that should be coach-reviewed.');
	}
	if (normalize(combinedRestrictionSources).includes('back') && allMovements.some((entry) => /deadlift|swing/i.test(entry.movement))) {
		safetyIssues.push('Back-sensitive context still contains hinge loading that should be reviewed.');
	}

	const progressionIssues: string[] = [];
	if (hasDeloadWindow && progressionMode === 'progress') {
		progressionIssues.push('Progression mode should not increase loading during an active deload window.');
	}
	if (tooHardFeedback && progressionMode === 'progress') {
		progressionIssues.push('Feedback indicates fatigue, but the progression mode is still aggressive.');
	}

	const warnings: string[] = [];
	if (hasTravel) {
		warnings.push('Travel context detected — confirm recovery and logistics before adding extra volume.');
	}
	if (request.sessionContext.durationMinutes < 45) {
		warnings.push('Short session window — verify the block durations still feel realistic.');
	}
	if (request.clientProfile.preferences.length === 0) {
		warnings.push('No client preferences supplied — generated variation may need a coach pass.');
	}

	const qualityValidator = {
		skill: 'SKILL 4: Quality Validator',
		status: safetyIssues.length > 0 ? 'fail' : warnings.length > 0 || progressionIssues.length > 0 ? 'warn' : 'pass',
		safetyIssues,
		progressionIssues,
		warnings,
		checks: [
			'Restriction and pain-history scan',
			'Progression sanity against block phase',
			'Session density sanity against available time',
		],
	};

	const sequencingIssues: string[] = [];
	const lastFocus = request.recentWorkoutHistory[0]?.focus.toLowerCase();
	if (lastFocus && lastFocus.includes(request.sessionContext.templateName.toLowerCase().split(' ')[0])) {
		sequencingIssues.push('Latest workout focus looks similar to this session template — confirm spacing is intentional.');
	}
	if (request.timeHorizon !== 'single' && hasTravel) {
		sequencingIssues.push('Weekly/monthly horizon with travel should be reviewed for knock-on scheduling effects.');
	}

	const sessionSequencer = {
		skill: 'SKILL 5: Session Sequencer',
		status: sequencingIssues.length > 0 ? 'warn' : 'pass',
		sequencingIssues,
		recentWorkoutTitles: request.recentWorkoutHistory.map((entry) => `${entry.date} — ${entry.title}`),
		rationale: sequencingIssues.length > 0
			? 'The sandbox found spacing or horizon-level issues worth a manual review.'
			: 'No obvious weekly/monthly sequencing conflicts were detected from the supplied history.',
	};

	const feedbackSignals = [
		...request.feedbackContext.notes.map((note) => `note:${note}`),
		...request.feedbackContext.restrictions.map((note) => `restriction:${note}`),
		...request.feedbackContext.preferences.map((note) => `preference:${note}`),
	];

	const feedbackInterpreter = {
		skill: 'SKILL 6: Feedback Interpreter',
		signals: feedbackSignals,
		nextSessionActions: [
			tooHardFeedback ? 'Consider holding volume or trimming one accessory slot next session.' : 'No fatigue-driven downshift required.',
			easyFeedback ? 'Progress a primary slot if technique remains clean.' : 'No explicit underload signal detected.',
			painFeedback ? 'Keep pain-sensitive patterns coach-reviewed until symptoms settle.' : 'No acute pain signal detected.',
		],
	};

	const qaStatus = safetyIssues.length > 0 ? 'fail' : progressionIssues.length > 0 || sequencingIssues.length > 0 || warnings.length > 0 ? 'warn' : 'pass';

	return {
		runId: createId('skill-sandbox'),
		requestedAt: new Date().toISOString(),
		references: skillReferences,
		request,
		skillOutputs: {
			contextAnalyzer,
			sessionPlanner,
			progressionReasoner,
			movementGenerator,
			qualityValidator,
			sessionSequencer,
			feedbackInterpreter,
		},
		finalWorkout: {
			title: `${request.clientProfile.name} — ${request.sessionContext.templateName}`,
			sessionDate: request.sessionContext.sessionDate,
			trainingStyle: request.trainingStyle,
			sessionType: request.sessionContext.sessionType,
			coachSummary:
				progressionMode === 'progress'
					? 'Progress the primary work while keeping the session inside the stated constraints.'
					: 'Keep this session controlled and coach-review any flagged exposure before using it in production.',
			blocks,
		},
		qaSummary: {
			status: qaStatus,
			warnings,
			safetyIssues,
			progressionIssues,
			sequencingIssues,
		},
	};
}
