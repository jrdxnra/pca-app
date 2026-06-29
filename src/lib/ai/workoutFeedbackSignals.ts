import type { ClientMovementFeedback, WorkoutLog } from '@/lib/types';

export type FeedbackSignal = ClientMovementFeedback['signal'];

export type FeedbackSignalInput = {
  workoutId?: string;
  movementId?: string;
  familyKey?: string;
  signal: FeedbackSignal;
  note?: string;
  score?: number;
  createdBy?: string;
};

const SIGNAL_REGEX: Array<{ signal: FeedbackSignal; regex: RegExp }> = [
  { signal: 'pain', regex: /\b(pain|hurt|hurting|sharp|ache|aching|twinge|strain|flare|injur\w*)\b/i },
  { signal: 'poor_tolerance', regex: /\b(nausea|nauseous|dizzy|lightheaded|gassed|exhausted|overwhelmed|could\s*not\s*recover|couldn't\s*recover)\b/i },
  { signal: 'too_hard', regex: /\b(too\s*hard|crushed|smoked|max\s*effort|all\s*out|failed|failure)\b/i },
  { signal: 'too_easy', regex: /\b(too\s*easy|underloaded|light\s*work|not\s*challenging|could\s*do\s*more)\b/i },
  { signal: 'great_quality', regex: /\b(felt\s*good|smooth|solid|great\s*form|great\s*quality|stable)\b/i },
  { signal: 'time_overrun', regex: /\b(ran\s*long|over\s*time|time\s*overrun|too\s*long|could\s*not\s*finish\s*on\s*time|couldn't\s*finish\s*on\s*time)\b/i },
  { signal: 'good_tolerance', regex: /\b(tolerated\s*well|good\s*tolerance|recovered\s*well|felt\s*fine\s*after)\b/i },
];

function normalizeNote(note?: string): string | undefined {
  if (!note) return undefined;
  const cleaned = note.trim().replace(/\s+/g, ' ');
  if (!cleaned) return undefined;
  return cleaned.slice(0, 280);
}

function parseSignalsFromText(note?: string): FeedbackSignal[] {
  if (!note) return [];
  return SIGNAL_REGEX.filter((rule) => rule.regex.test(note)).map((rule) => rule.signal);
}

function addIfNew(
  bucket: FeedbackSignalInput[],
  item: FeedbackSignalInput,
  seen: Set<string>
): void {
  const key = [
    item.workoutId || '',
    item.movementId || '',
    item.familyKey || '',
    item.signal,
    (item.note || '').toLowerCase(),
  ].join('|');

  if (seen.has(key)) return;
  seen.add(key);
  bucket.push(item);
}

export function extractFeedbackSignalsFromWorkoutLogInput(input: {
  workoutId: string;
  sessionRPE?: number;
  athleteNotes?: string;
  exercises?: WorkoutLog['exercises'];
  createdBy?: string;
}): FeedbackSignalInput[] {
  const results: FeedbackSignalInput[] = [];
  const seen = new Set<string>();

  const athleteNote = normalizeNote(input.athleteNotes);
  const sessionSignals = parseSignalsFromText(athleteNote);
  for (const signal of sessionSignals) {
    addIfNew(
      results,
      {
        workoutId: input.workoutId,
        signal,
        note: athleteNote,
        createdBy: input.createdBy,
      },
      seen
    );
  }

  const rpe = typeof input.sessionRPE === 'number' ? input.sessionRPE : undefined;
  if (typeof rpe === 'number' && Number.isFinite(rpe) && rpe > 0) {
    if (rpe >= 9) {
      addIfNew(
        results,
        {
          workoutId: input.workoutId,
          signal: 'too_hard',
          note: `Session RPE ${rpe}`,
          score: Math.min(10, Math.max(1, Math.round(rpe))),
          createdBy: input.createdBy,
        },
        seen
      );
    } else if (rpe <= 5) {
      addIfNew(
        results,
        {
          workoutId: input.workoutId,
          signal: 'too_easy',
          note: `Session RPE ${rpe}`,
          score: Math.min(10, Math.max(1, Math.round(rpe))),
          createdBy: input.createdBy,
        },
        seen
      );
    } else {
      addIfNew(
        results,
        {
          workoutId: input.workoutId,
          signal: 'good_tolerance',
          note: `Session RPE ${rpe}`,
          score: Math.min(10, Math.max(1, Math.round(rpe))),
          createdBy: input.createdBy,
        },
        seen
      );
    }
  }

  for (const exercise of input.exercises || []) {
    const movementId = typeof exercise.movementId === 'string' ? exercise.movementId : undefined;
    const note = normalizeNote(exercise.notes);
    if (!note) continue;

    for (const signal of parseSignalsFromText(note)) {
      addIfNew(
        results,
        {
          workoutId: input.workoutId,
          movementId,
          signal,
          note,
          createdBy: input.createdBy,
        },
        seen
      );
    }
  }

  return results;
}
