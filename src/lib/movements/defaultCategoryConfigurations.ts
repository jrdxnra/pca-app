import type { MovementConfiguration } from '@/lib/types';

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Accessory': 'Support work used to build muscle, address weak links, and round out the main lifts in a session.',
  'Balance': 'Balance-focused drills that challenge stability, coordination, and body control under reduced support.',
  'Cardio': 'Conditioning work meant to raise heart rate and build aerobic output through sustained or repeat efforts.',
  'Carry': 'Loaded carry patterns that train posture, grip, trunk stiffness, and full-body control while moving.',
  'Complex': 'Linked movement sequences performed continuously to build coordination, power, and metabolic demand.',
  'Cool Down': 'Low-intensity work used at the end of a session to downshift, breathe, and restore range of motion.',
  'Core - Anti-Rotation': 'Core exercises that resist twisting and teach the trunk to stay stable against rotational forces.',
  'Core - Rotation': 'Core work that trains controlled rotational strength and the ability to produce or absorb turning forces.',
  'Functional Mobility': 'Mobility drills that improve usable range of motion, joint control, and movement quality.',
  'Hinge': 'Hip-dominant lower-body patterns centered on loading the posterior chain through a hinge mechanic.',
  'Hinge Sup': 'Supplemental hinge work used to reinforce posterior-chain strength, position, and hinge patterning.',
  'Horizontal Pull': 'Upper-body pulling movements where the resistance path is primarily horizontal, such as rows and pulls to the torso.',
  'Horizontal Push': 'Upper-body pressing movements where force is applied horizontally, such as push-ups and benching variations.',
  'Knee Pain Rehab': 'Rehab-oriented drills chosen to rebuild knee tolerance, control, and strength with appropriate loading.',
  'Lunge': 'Split-stance and stepping patterns that train unilateral lower-body strength, control, and coordination.',
  'Lunge Sup': 'Supplemental unilateral lower-body work that supports or progresses primary lunge patterns.',
  'Macros': 'Nutrition-focused entries used to track or prescribe macro targets alongside training.',
  'Olympic Lifts': 'Explosive barbell lifts and derivatives that emphasize speed, timing, and power production.',
  'OYO Workout': 'Category reserved for OYO-specific resistance exercises and workout structures.',
  'Pin Movements': 'Pin-based or fixed-start variations that emphasize starting strength, positioning, or constrained ranges.',
  'Planks': 'Static trunk-bracing variations used to train core stiffness, positioning, and endurance.',
  'Post-Natal': 'Training options intended for post-natal athletes with an emphasis on gradual rebuilding and control.',
  'Resistance - Accommodated': 'Resistance work using bands, chains, or other tools that change load across the range of motion.',
  'Rest': 'Rest intervals or recovery blocks used to structure pacing between efforts in a session.',
  'Squat': 'Lower-body squat patterns that emphasize knee and hip flexion under load for strength and control.',
  'Squat Sup': 'Supplemental squat work used to reinforce positions, address weak points, or add lower-body volume.',
  'Stability': 'Exercises that challenge positional control and the ability to maintain alignment under instability or asymmetry.',
  'Vertical Pull': 'Upper-body pulling patterns where the line of pull is primarily vertical, such as pull-ups and pulldowns.',
  'Vertical Push': 'Upper-body pressing patterns where force is directed vertically, such as overhead presses.',
  'Vo2 Max Training Protocol': 'High-output conditioning intervals designed to push aerobic power and improve top-end conditioning capacity.',
  'Warm Ups': 'Preparation drills used before training to raise readiness, groove positions, and prime the session.',
  'Workout': 'Full workout entries or session containers used to represent the broader training piece rather than a single movement.',
};

export const GENERIC_STRENGTH_CONFIGURATION: MovementConfiguration = {
  useReps: true,
  useTempo: false,
  useTime: false,
  timeMeasure: 's',
  useWeight: true,
  weightMeasure: 'lbs',
  useDistance: false,
  distanceMeasure: 'mi',
  usePace: false,
  paceMeasure: 'mi',
  unilateral: false,
  usePercentage: false,
  useRPE: false,
};

export const LEGACY_GENERIC_STRENGTH_CONFIGURATION: MovementConfiguration = {
  useReps: true,
  useTempo: false,
  useTime: false,
  timeMeasure: 's',
  useWeight: true,
  weightMeasure: 'lbs',
  useDistance: false,
  distanceMeasure: 'm',
  usePace: false,
  paceMeasure: 'km',
  unilateral: false,
  usePercentage: false,
  useRPE: false,
};

const TIME_BASED_CONFIGURATION: MovementConfiguration = {
  ...GENERIC_STRENGTH_CONFIGURATION,
  useReps: false,
  useWeight: false,
  useTime: true,
};

const CARDIO_CONFIGURATION: MovementConfiguration = {
  ...TIME_BASED_CONFIGURATION,
  useDistance: true,
  distanceMeasure: 'mi',
  usePace: true,
  paceMeasure: 'mi',
};

const CARRY_CONFIGURATION: MovementConfiguration = {
  ...GENERIC_STRENGTH_CONFIGURATION,
  useReps: false,
  useTime: true,
  useWeight: true,
};

const CORE_CONFIGURATION: MovementConfiguration = {
  ...GENERIC_STRENGTH_CONFIGURATION,
  useWeight: false,
  useTime: true,
};

const MOBILITY_CONFIGURATION: MovementConfiguration = {
  ...GENERIC_STRENGTH_CONFIGURATION,
  useWeight: false,
  useTime: true,
};

const OLYMPIC_CONFIGURATION: MovementConfiguration = {
  ...GENERIC_STRENGTH_CONFIGURATION,
  usePercentage: true,
};

const UNILATERAL_LOWER_BODY_CONFIGURATION: MovementConfiguration = {
  ...GENERIC_STRENGTH_CONFIGURATION,
  unilateral: true,
};

const CATEGORY_DEFAULTS: Record<string, MovementConfiguration> = {
  'Accessory': GENERIC_STRENGTH_CONFIGURATION,
  'Balance': TIME_BASED_CONFIGURATION,
  'Cardio': CARDIO_CONFIGURATION,
  'Carry': CARRY_CONFIGURATION,
  'Complex': OLYMPIC_CONFIGURATION,
  'Cool Down': MOBILITY_CONFIGURATION,
  'Core - Anti-Rotation': CORE_CONFIGURATION,
  'Core - Rotation': CORE_CONFIGURATION,
  'Functional Mobility': MOBILITY_CONFIGURATION,
  'Hinge': GENERIC_STRENGTH_CONFIGURATION,
  'Hinge Sup': GENERIC_STRENGTH_CONFIGURATION,
  'Horizontal Pull': GENERIC_STRENGTH_CONFIGURATION,
  'Horizontal Push': GENERIC_STRENGTH_CONFIGURATION,
  'Knee Pain Rehab': TIME_BASED_CONFIGURATION,
  'Lunge': UNILATERAL_LOWER_BODY_CONFIGURATION,
  'Lunge Sup': UNILATERAL_LOWER_BODY_CONFIGURATION,
  'Macros': GENERIC_STRENGTH_CONFIGURATION,
  'Olympic Lifts': OLYMPIC_CONFIGURATION,
  'OYO Workout': GENERIC_STRENGTH_CONFIGURATION,
  'Pin Movements': GENERIC_STRENGTH_CONFIGURATION,
  'Planks': CORE_CONFIGURATION,
  'Post-Natal': TIME_BASED_CONFIGURATION,
  'Resistance - Accommodated': GENERIC_STRENGTH_CONFIGURATION,
  'Rest': TIME_BASED_CONFIGURATION,
  'Squat': GENERIC_STRENGTH_CONFIGURATION,
  'Squat Sup': GENERIC_STRENGTH_CONFIGURATION,
  'Stability': TIME_BASED_CONFIGURATION,
  'Vertical Pull': GENERIC_STRENGTH_CONFIGURATION,
  'Vertical Push': GENERIC_STRENGTH_CONFIGURATION,
  'Vo2 Max Training Protocol': CARDIO_CONFIGURATION,
  'Warm Ups': MOBILITY_CONFIGURATION,
  'Workout': GENERIC_STRENGTH_CONFIGURATION,
};

export function getDefaultCategoryConfiguration(categoryName?: string): MovementConfiguration {
  if (categoryName && CATEGORY_DEFAULTS[categoryName]) {
    return { ...CATEGORY_DEFAULTS[categoryName] };
  }

  return { ...GENERIC_STRENGTH_CONFIGURATION };
}

export function getDefaultCategoryDescription(categoryName?: string): string | undefined {
  if (!categoryName) {
    return undefined;
  }

  return CATEGORY_DESCRIPTIONS[categoryName];
}

export function normalizeMovementConfiguration(
  configuration?: Partial<MovementConfiguration> | null
): MovementConfiguration {
  return {
    useReps: configuration?.useReps ?? false,
    useTempo: configuration?.useTempo ?? false,
    useTime: configuration?.useTime ?? false,
    timeMeasure: configuration?.timeMeasure ?? 's',
    useWeight: configuration?.useWeight ?? false,
    weightMeasure: configuration?.weightMeasure ?? 'lbs',
    useDistance: configuration?.useDistance ?? false,
    distanceMeasure: configuration?.distanceMeasure ?? 'mi',
    usePace: configuration?.usePace ?? false,
    paceMeasure: configuration?.paceMeasure ?? 'mi',
    unilateral: configuration?.unilateral ?? false,
    usePercentage: configuration?.usePercentage ?? false,
    useRPE: configuration?.useRPE ?? false,
  };
}

export function areMovementConfigurationsEqual(
  left?: Partial<MovementConfiguration> | null,
  right?: Partial<MovementConfiguration> | null
): boolean {
  const normalizedLeft = normalizeMovementConfiguration(left);
  const normalizedRight = normalizeMovementConfiguration(right);

  return (
    normalizedLeft.useReps === normalizedRight.useReps &&
    normalizedLeft.useTempo === normalizedRight.useTempo &&
    normalizedLeft.useTime === normalizedRight.useTime &&
    normalizedLeft.timeMeasure === normalizedRight.timeMeasure &&
    normalizedLeft.useWeight === normalizedRight.useWeight &&
    normalizedLeft.weightMeasure === normalizedRight.weightMeasure &&
    normalizedLeft.useDistance === normalizedRight.useDistance &&
    normalizedLeft.distanceMeasure === normalizedRight.distanceMeasure &&
    normalizedLeft.usePace === normalizedRight.usePace &&
    normalizedLeft.paceMeasure === normalizedRight.paceMeasure &&
    normalizedLeft.unilateral === normalizedRight.unilateral &&
    normalizedLeft.usePercentage === normalizedRight.usePercentage &&
    normalizedLeft.useRPE === normalizedRight.useRPE
  );
}

export function isUsingGenericMovementConfiguration(
  configuration?: Partial<MovementConfiguration> | null
): boolean {
  if (!configuration) {
    return true;
  }

  return (
    areMovementConfigurationsEqual(configuration, GENERIC_STRENGTH_CONFIGURATION) ||
    areMovementConfigurationsEqual(configuration, LEGACY_GENERIC_STRENGTH_CONFIGURATION)
  );
}