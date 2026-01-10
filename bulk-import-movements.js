/**
 * Bulk import movements from Rebrand Fitness
 * Run this in the browser console on the movements page
 */

// Accessory category movements extracted from HTML
const accessoryMovements = [
  'Curl - EZ Bar',
  'Curl - Straight Bar',
  'Rev Grip Curl + OH Press',
  'Rev Grip Curl',
  'Cable Curl',
  'Preacher Curl',
  'DB Hammer Curl',
  'DB Curl',
  'Alt DB Curl',
  'Wide Arm Curl',
  'Banded Curl',
  'Bicep Curl - TRX',
  'Lengthened Curl Variation',
  'Plate Curls',
  'Lateral + Front Raises',
  'Front Raises',
  'Lateral Raises',
  'Rear Delt Flies',
  'Skullcrusher',
  'Tricep Dips',
  'Bench Tricep Dips',
  'Tricep Kickback',
  'Tricep Extension',
  'Tricep Extension - SA',
  'Overhead Tricep Extension',
  'Serratus Press Variation',
  'Machine Tricep Ext',
  'Wrist Curls',
  'Wrist Flexion',
  'Wrist Rotations',
  'Calf Raises',
  'Calf Raises - SS',
  'Supermans',
  'Prone Leg Lifts'
];

// Category mappings from the HTML
const categoryColors = {
  'Accessory': '#FFFFFF',
  'Balance': '#35C0B7',
  'Cardio': '#FFC777',
  'Carry': '#FFC8AA',
  'Cool Down': '#FFFFFF',
  'Core - Anti-Rotation': '#F3CDCD',
  'Core - Rotation': '#EE8181',
  'Functional Mobility': '#D3E2FF',
  'Hinge': '#11734B',
  'Hinge Sup': '#D4EDBC',
  'Horizontal Pull': '#B10202',
  'Horizontal Push': '#0A53A8',
  'Knee Pain Rehab': '#108E86',
  'Lunge': '#5A3286',
  'Lunge Sup': '#E6CFF2',
  'Macros': '#ED0202',
  'Olympic Lifts': '#FFA500',
  'OYO Workout': '#E35416',
  'Pin Movements': '#FFFFFF',
  'Planks': '#FFE5A0',
  'Post-Natal': '#E8ABD2',
  'Resistance - Accommodated': '#ECE4E4',
  'Rest': '#EBEBEB',
  'Squat': '#3D3D3D',
  'Squat Sup': '#A8A8A8',
  'Stability': '#FFFFFF',
  'Vertical Pull': '#FFCFC9',
  'Vertical Push': '#BFE1F6',
  'Vo2 Max Training Protocol': '#61187C',
  'Warm Ups': '#F7F7F7',
  'Workout': '#2E2D2D'
};

// Default movement configuration
const defaultConfig = {
  use_reps: true,
  use_tempo: false,
  use_time: false,
  use_weight: true,
  weight_measure: 'lbs',
  use_distance: false,
  distance_measure: 'm',
  use_pace: false,
  pace_measure: 'km',
  unilateral: false,
  use_percentage: false,
  use_rpe: false
};

console.log('Import data prepared. Run the import script next.');

