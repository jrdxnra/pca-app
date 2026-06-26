"use client";

import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Upload, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ClientWorkoutRound, Movement } from '@/lib/types';
import { createClientWorkout } from '@/lib/firebase/services/clientWorkouts';
import { fetchClientWorkouts } from '@/lib/firebase/services/clientWorkouts';
import { updateClientWorkout } from '@/lib/firebase/services/clientWorkouts';
import { useMovements } from '@/hooks/queries/useMovements';
import {
  normalizeMovementName,
  parsePastedWorkoutHistory,
  type ParsedHistorySession,
} from '@/lib/workouts/pasteHistoryImport';

interface ClientHistoryImportDialogProps {
  clientId: string;
  clientName: string;
  inline?: boolean;
}

const DEFAULT_CATEGORY = 'Workout';
const DEFAULT_PERIOD_ID = 'history-import';
const LEGACY_CLUSTER_WINDOW_MS = 5 * 60 * 1000;
const IMPORT_ALIAS_STORAGE_KEY = 'pca-import-movement-aliases-v1';
const UNASSIGNED_ALIAS_VALUE = '__unassigned__';
const SUPPORTED_PASTE_TYPES = [
  { badge: 'SHEET', label: 'Google Sheets / Excel Paste' },
  { badge: '.CSV', label: 'CSV Exports' },
  { badge: '.TSV', label: 'Tab-Separated Text' },
  { badge: '.MD', label: 'Markdown Workout Notes' },
  { badge: '.TXT', label: 'Plain Text Session Notes' },
];

type MovementAliasMap = Record<string, string>;

interface ImportArchiveSessionSummary {
  id: string;
  title: string;
  sourceDate?: string;
  movementCount: number;
  editorText: string;
  unmatchedNames: string[];
}

interface ImportArchiveBatch {
  id: string;
  createdAt: number;
  sessions: ImportArchiveSessionSummary[];
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }

  if (value && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item === undefined) return;
      cleaned[key] = stripUndefinedDeep(item);
    });
    return cleaned as T;
  }

  return value;
}

function toMillis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in (value as Record<string, unknown>)) {
    const candidate = value as { toMillis: () => number };
    return candidate.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return Date.now();
}

function extractBatchIdFromNotes(notes?: string): string | null {
  if (!notes) return null;
  const match = notes.match(/Import Batch:\s*([^\n]+)/i);
  return match?.[1]?.trim() || null;
}

function extractSourceDateFromNotes(notes?: string): string | null {
  if (!notes) return null;
  const match = notes.match(/Source Date:\s*(\d{4}-\d{2}-\d{2})/i);
  return match?.[1] || null;
}

function formatDateForEditor(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatWorkoutAsEditorText(
  workout: Record<string, unknown>,
  movementNamesById: Map<string, string>
): string {
  const notes = typeof workout.notes === 'string' ? workout.notes : undefined;
  const sourceDate = extractSourceDateFromNotes(notes || undefined);

  const fallbackDate = new Date(toMillis(workout.date));
  const dateText = sourceDate || formatDateForEditor(fallbackDate);

  const lines: string[] = [
    'Date:',
    dateText,
    'MOVEMENT\tSETS\tREPS\tLOAD',
  ];

  const warmups = Array.isArray(workout.warmups)
    ? (workout.warmups as Array<Record<string, unknown>>)
    : [];

  if (warmups.length > 0) {
    lines.push('WARM UP');
    warmups.forEach((warmup) => {
      const text = typeof warmup.text === 'string' ? warmup.text : '';
      if (!text.trim()) return;
      lines.push(`${text}\t1\tna\tna`);
    });
    lines.push('');
  }

  const rounds = Array.isArray(workout.rounds)
    ? (workout.rounds as Array<Record<string, unknown>>)
    : [];

  rounds.forEach((round) => {
    const sectionName = typeof round.sectionName === 'string' && round.sectionName.trim()
      ? round.sectionName
      : 'WORKING SETS: STRENGTH';
    lines.push(sectionName);

    const movementUsages = Array.isArray(round.movementUsages)
      ? (round.movementUsages as Array<Record<string, unknown>>)
      : [];

    movementUsages.forEach((usage) => {
      const movementId = typeof usage.movementId === 'string' ? usage.movementId : '';
      const importedNote = typeof usage.note === 'string' ? usage.note : '';
      const fallbackName = importedNote.startsWith('Imported movement:')
        ? importedNote.replace('Imported movement:', '').trim()
        : 'Unknown Movement';

      const movementName = (movementId && movementNamesById.get(movementId)) || fallbackName;
      const targetWorkload = usage.targetWorkload as Record<string, unknown> | undefined;
      const sets = typeof round.sets === 'number' && round.sets > 0 ? round.sets : 1;
      const reps = typeof targetWorkload?.reps === 'string' ? targetWorkload.reps : '';
      const load = typeof targetWorkload?.weight === 'string' ? targetWorkload.weight : '';

      lines.push(`${movementName}\t${sets}\t${reps || 'na'}\t${load || 'na'}`);
    });

    lines.push('');
  });

  return lines.join('\n').trim();
}

function extractUnmatchedNamesFromWorkout(workout: Record<string, unknown>): string[] {
  const rounds = Array.isArray(workout.rounds)
    ? (workout.rounds as Array<Record<string, unknown>>)
    : [];

  const unmatched = new Set<string>();

  rounds.forEach((round) => {
    const movementUsages = Array.isArray(round.movementUsages)
      ? (round.movementUsages as Array<Record<string, unknown>>)
      : [];

    movementUsages.forEach((usage) => {
      const note = typeof usage.note === 'string' ? usage.note : '';
      const movementId = typeof usage.movementId === 'string' ? usage.movementId : '';
      if (movementId) return;

      if (note.startsWith('Imported movement:')) {
        const parsed = note.replace('Imported movement:', '').trim();
        if (parsed) unmatched.add(parsed);
      }
    });
  });

  return Array.from(unmatched).sort((a, b) => a.localeCompare(b));
}

function buildArchiveBatches(
  workouts: Array<Record<string, unknown>>,
  movementNamesById: Map<string, string>
): ImportArchiveBatch[] {
  const imported = workouts
    .filter((workout) => workout.createdBy === 'history-import')
    .map((workout) => {
      const rounds = Array.isArray(workout.rounds) ? (workout.rounds as Array<Record<string, unknown>>) : [];
      const movementCount = rounds.reduce((sum, round) => {
        const usages = Array.isArray(round.movementUsages)
          ? (round.movementUsages as Array<unknown>).length
          : 0;
        return sum + usages;
      }, 0);

      return {
        id: String(workout.id || ''),
        title: String(workout.title || 'Imported Session'),
        sourceDate: extractSourceDateFromNotes(typeof workout.notes === 'string' ? workout.notes : undefined) || undefined,
        movementCount,
        editorText: formatWorkoutAsEditorText(workout, movementNamesById),
        unmatchedNames: extractUnmatchedNamesFromWorkout(workout),
        createdAt: toMillis(workout.createdAt),
        batchId: extractBatchIdFromNotes(typeof workout.notes === 'string' ? workout.notes : undefined),
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const grouped = new Map<string, ImportArchiveBatch>();
  let lastLegacyTimestamp: number | null = null;
  let legacyIndex = 0;

  imported.forEach((session) => {
    let key = session.batchId;
    if (!key) {
      if (lastLegacyTimestamp === null || Math.abs(lastLegacyTimestamp - session.createdAt) > LEGACY_CLUSTER_WINDOW_MS) {
        legacyIndex += 1;
      }
      key = `legacy-${legacyIndex}`;
      lastLegacyTimestamp = session.createdAt;
    }

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: key,
        createdAt: session.createdAt,
        sessions: [],
      });
    }

    const batch = grouped.get(key)!;
    batch.createdAt = Math.max(batch.createdAt, session.createdAt);
    batch.sessions.push({
      id: session.id,
      title: session.title,
      sourceDate: session.sourceDate,
      movementCount: session.movementCount,
      editorText: session.editorText,
      unmatchedNames: session.unmatchedNames,
    });
  });

  return Array.from(grouped.values()).sort((a, b) => b.createdAt - a.createdAt);
}

function isWarmupSection(sectionName: string): boolean {
  const normalized = sectionName.toLowerCase();
  return normalized.includes('warm up') || normalized.includes('warmup');
}

function loadAliasMap(): MovementAliasMap {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(IMPORT_ALIAS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const aliases: MovementAliasMap = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (!key || typeof value !== 'string' || !value) return;
      aliases[key] = value;
    });

    return aliases;
  } catch {
    return {};
  }
}

function persistAliasMap(aliasMap: MovementAliasMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(IMPORT_ALIAS_STORAGE_KEY, JSON.stringify(aliasMap));
  } catch {
    // noop: localStorage can fail in private mode or restricted environments.
  }
}

function buildMovementLookup(movements: Movement[]): Map<string, Movement> {
  const lookup = new Map<string, Movement>();

  movements.forEach((movement) => {
    const key = normalizeMovementName(movement.name);
    if (key && !lookup.has(key)) {
      lookup.set(key, movement);
    }
  });

  return lookup;
}

function findMovementMatch(
  name: string,
  lookup: Map<string, Movement>,
  aliases: MovementAliasMap,
  movementById: Map<string, Movement>
): Movement | undefined {
  const normalized = normalizeMovementName(name);
  if (!normalized) return undefined;

  const aliasTargetId = aliases[normalized];
  if (aliasTargetId) {
    const aliased = movementById.get(aliasTargetId);
    if (aliased) return aliased;
  }

  const exact = lookup.get(normalized);
  if (exact) return exact;

  // Fuzzy fallback for small naming differences.
  for (const [key, movement] of lookup.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return movement;
    }
  }

  return undefined;
}

function buildWorkoutStructureFromParsedSession(
  session: ParsedHistorySession,
  movementLookup: Map<string, Movement>,
  aliases: MovementAliasMap,
  movementById: Map<string, Movement>,
  unmatchedNames: Set<string>
): { warmups: Array<{ ordinal: number; text: string }>; rounds: ClientWorkoutRound[] } {
  const warmups = session.rounds
    .filter((round) => isWarmupSection(round.sectionName))
    .flatMap((round) => round.entries.map((entry, idx) => ({
      ordinal: idx + 1,
      text: entry.movementName,
    })));

  const rounds: ClientWorkoutRound[] = session.rounds
    .filter((round) => !isWarmupSection(round.sectionName))
    .map((round, roundIdx) => {
      const movementUsages = round.entries
        .map((entry, usageIdx) => {
          const matched = findMovementMatch(entry.movementName, movementLookup, aliases, movementById);
          if (!matched) {
            unmatchedNames.add(entry.movementName);
          }

          return {
            ordinal: usageIdx + 1,
            movementId: matched?.id || '',
            categoryId: matched?.categoryId || '',
            ...(matched ? {} : { note: `Imported movement: ${entry.movementName}` }),
            targetWorkload: {
              useReps: Boolean(entry.reps),
              ...(entry.reps ? { reps: entry.reps } : {}),
              useWeight: Boolean(entry.load),
              ...(entry.load ? { weight: entry.load } : {}),
              weightMeasure: 'lbs' as const,
              useTempo: false,
              useTime: false,
              useDistance: false,
              distanceMeasure: 'mi' as const,
              usePace: false,
              paceMeasure: 'mi' as const,
              usePercentage: false,
              useRPE: false,
              unilateral: false,
            },
          };
        })
        .filter((usage) => Boolean(usage.movementId || usage.note));

      return {
        ordinal: roundIdx + 1,
        sets: Math.max(...round.entries.map((entry) => entry.sets), 1),
        sectionName: round.sectionName,
        movementUsages,
      };
    })
    .filter((round) => round.movementUsages.length > 0);

  return { warmups, rounds };
}

export function ClientHistoryImportDialog({ clientId, clientName, inline = false }: ClientHistoryImportDialogProps) {
  const [open, setOpen] = useState(inline);
  const [rawText, setRawText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    convertedToReference: number;
    unmatchedNames: string[];
    warningText?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveBatches, setArchiveBatches] = useState<ImportArchiveBatch[]>([]);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [selectedArchiveSession, setSelectedArchiveSession] = useState<ImportArchiveSessionSummary | null>(null);
  const [saveSummary, setSaveSummary] = useState<string | null>(null);
  const [movementAliases, setMovementAliases] = useState<MovementAliasMap>({});

  const { data: movements = [] } = useMovements(true, open);

  const preview = useMemo(() => parsePastedWorkoutHistory(rawText), [rawText]);
  const movementLookup = useMemo(() => buildMovementLookup(movements), [movements]);
  const movementNamesById = useMemo(
    () => new Map(movements.map((movement) => [movement.id, movement.name])),
    [movements]
  );
  const movementById = useMemo(
    () => new Map(movements.map((movement) => [movement.id, movement])),
    [movements]
  );
  const movementOptions = useMemo(
    () => [...movements].sort((a, b) => a.name.localeCompare(b.name)),
    [movements]
  );
  const selectedArchive = useMemo(
    () => archiveBatches.find((batch) => batch.id === selectedArchiveId) || null,
    [archiveBatches, selectedArchiveId]
  );
  const archiveUnmatchedNames = useMemo(() => {
    if (selectedArchiveSession) {
      return selectedArchiveSession.unmatchedNames;
    }
    if (!selectedArchive) return [] as string[];

    const names = new Set<string>();
    selectedArchive.sessions.forEach((session) => {
      session.unmatchedNames.forEach((name) => names.add(name));
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [selectedArchive, selectedArchiveSession]);
  const previewUnmatchedNames = useMemo(() => {
    if (!rawText.trim() || preview.sessions.length === 0) return [] as string[];

    const names = new Set<string>();
    preview.sessions.forEach((session) => {
      session.rounds
        .filter((round) => !isWarmupSection(round.sectionName))
        .forEach((round) => {
          round.entries.forEach((entry) => {
            const matched = findMovementMatch(entry.movementName, movementLookup, movementAliases, movementById);
            if (!matched) names.add(entry.movementName);
          });
        });
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [rawText, preview.sessions, movementLookup, movementAliases, movementById]);
  const mappingNames = previewUnmatchedNames.length > 0 ? previewUnmatchedNames : archiveUnmatchedNames;
  const hasSummaryContent = Boolean(result) || Boolean(saveSummary);

  const setAlias = (sourceName: string, targetMovementId: string) => {
    const aliasKey = normalizeMovementName(sourceName);
    if (!aliasKey) return;

    setMovementAliases((current) => {
      const next = { ...current };
      if (!targetMovementId || targetMovementId === UNASSIGNED_ALIAS_VALUE) {
        delete next[aliasKey];
      } else {
        next[aliasKey] = targetMovementId;
      }
      persistAliasMap(next);
      return next;
    });
  };

  useEffect(() => {
    if (!open && !inline) return;
    setMovementAliases(loadAliasMap());
  }, [open, inline]);

  const loadArchive = async () => {
    setArchiveLoading(true);
    try {
      const clientWorkouts = await fetchClientWorkouts(clientId);
      const batches = buildArchiveBatches(
        clientWorkouts as unknown as Array<Record<string, unknown>>,
        movementNamesById
      );
      setArchiveBatches(batches);
      setSelectedArchiveId(batches[0]?.id || null);
      setSelectedArchiveSession(null);
    } finally {
      setArchiveLoading(false);
    }
  };

  useEffect(() => {
    setRawText('');
    setResult(null);
    setError(null);
    setSaveSummary(null);
    setArchiveBatches([]);
    setSelectedArchiveId(null);
    setSelectedArchiveSession(null);
  }, [clientId]);

  useEffect(() => {
    if (!open && !inline) return;
    loadArchive();
  }, [open, inline, clientId, movementNamesById]);

  const resetState = () => {
    setRawText('');
    setResult(null);
    setError(null);
    setSaveSummary(null);
    setSelectedArchiveSession(null);
  };

  const handleSaveSelectedSession = async () => {
    setError(null);
    setSaveSummary(null);
    setResult(null);

    if (!selectedArchiveSession) {
      setError('Select an imported session first.');
      return;
    }

    if (!rawText.trim()) {
      setError('Paste or load a session before saving.');
      return;
    }

    const parsed = parsePastedWorkoutHistory(rawText);
    if (parsed.sessions.length === 0) {
      setError(parsed.warnings[0] || 'Could not parse a session from the editor text.');
      return;
    }

    if (parsed.sessions.length > 1) {
      setError('Save updates only one session at a time. Keep one Date block in the editor.');
      return;
    }

    const session = parsed.sessions[0];
    const unmatchedNames = new Set<string>();
    const { warmups, rounds } = buildWorkoutStructureFromParsedSession(
      session,
      movementLookup,
      movementAliases,
      movementById,
      unmatchedNames
    );

    if (rounds.length === 0) {
      setError('This session has no valid movement rows to save.');
      return;
    }

    setIsSaving(true);
    try {
      const sourceDateKey = session.date.toISOString().slice(0, 10);
      const updatedNotes = [
        'Edited from import archive.',
        `Source Date: ${sourceDateKey}`,
      ].join('\n');

      const updatePayload = stripUndefinedDeep({
        date: Timestamp.fromDate(session.date),
        dayOfWeek: session.date.getDay(),
        notes: updatedNotes,
        ...(typeof session.sessionLengthMinutes === 'number'
          ? { duration: session.sessionLengthMinutes }
          : {}),
        rounds,
        warmups,
        isModified: true,
      });

      await updateClientWorkout(selectedArchiveSession.id, updatePayload);
      await loadArchive();

      const unmatchedText = unmatchedNames.size > 0
        ? ` (${unmatchedNames.size} unmatched movement name${unmatchedNames.size === 1 ? '' : 's'} kept as notes)`
        : '';
      setSaveSummary(`Saved changes to selected session${unmatchedText}.`);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save selected session.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async () => {
    setError(null);
    setSaveSummary(null);
    setResult(null);

    if (!rawText.trim()) {
      setError('Paste workout history first.');
      return;
    }

    if (preview.sessions.length === 0) {
      setError(preview.warnings[0] || 'No sessions could be parsed from this paste.');
      return;
    }

    setIsImporting(true);
    try {
      const unmatchedNames = new Set<string>();
      const seenDateKeys = new Map<string, number>();
      const importAnchor = new Date();
      const importBatchId = `batch-${Date.now()}`;
      let referenceOffsetMinutes = 0;
      let created = 0;
      let skipped = 0;
      let convertedToReference = 0;

      for (const session of preview.sessions) {
        const sourceDateKey = session.date.toISOString().slice(0, 10);
        const previousCount = seenDateKeys.get(sourceDateKey) || 0;
        const isDuplicateDate = previousCount > 0;
        seenDateKeys.set(sourceDateKey, previousCount + 1);

        const workoutDate = isDuplicateDate
          ? new Date(importAnchor.getTime() + referenceOffsetMinutes * 60 * 1000)
          : session.date;

        if (isDuplicateDate) {
          referenceOffsetMinutes += 1;
          convertedToReference += 1;
        }

        const { warmups, rounds } = buildWorkoutStructureFromParsedSession(
          session,
          movementLookup,
          movementAliases,
          movementById,
          unmatchedNames
        );

        if (rounds.length === 0) {
          skipped += 1;
          continue;
        }

        const sessionNote = isDuplicateDate
          ? [
              'Imported as reference session from duplicate source date.',
              `Import Batch: ${importBatchId}`,
              `Source Date: ${sourceDateKey}`,
            ].join('\n')
          : [
              'Imported from pasted workout history.',
              `Import Batch: ${importBatchId}`,
              `Source Date: ${sourceDateKey}`,
            ].join('\n');

        const sessionTitle = isDuplicateDate
          ? `Imported Reference Session - ${sourceDateKey}`
          : `Imported Session - ${session.date.toLocaleDateString()}`;

        const workoutPayload = stripUndefinedDeep({
          clientId,
          periodId: DEFAULT_PERIOD_ID,
          date: Timestamp.fromDate(workoutDate),
          dayOfWeek: workoutDate.getDay(),
          categoryName: DEFAULT_CATEGORY,
          title: sessionTitle,
          notes: sessionNote,
          ...(typeof session.sessionLengthMinutes === 'number'
            ? { duration: session.sessionLengthMinutes }
            : {}),
          rounds,
          warmups,
          isModified: true,
          createdBy: 'history-import',
        });

        await createClientWorkout(workoutPayload);

        created += 1;
      }

      setResult({
        created,
        skipped,
        convertedToReference,
        unmatchedNames: Array.from(unmatchedNames).sort((a, b) => a.localeCompare(b)),
        warningText: preview.warnings.length > 0 ? preview.warnings.join(' ') : undefined,
      });
      await loadArchive();
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Import failed.';
      setError(message);
    } finally {
      setIsImporting(false);
    }
  };

  const content = (
    <>
      {(inline ? false : true) && (
        <DialogHeader>
          <DialogTitle>Import Past Workouts for {clientName}</DialogTitle>
          <DialogDescription>
            Paste copied rows from Sheets or CSV. The importer will create historical sessions so DDS draft generation can use prior training.
          </DialogDescription>
        </DialogHeader>
      )}

      {inline && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Import Past Workouts</h3>
          <p className="text-xs text-muted-foreground">
            Paste copied rows from Sheets or CSV. The importer creates historical sessions DDS can use.
          </p>
        </div>
      )}

        <div className="grid gap-3 md:grid-cols-[280px_1fr] flex-1 min-h-0">
          <Card className="min-h-0 overflow-hidden">
            <CardContent className="pt-4 h-full overflow-y-auto space-y-2">
              <p className="text-sm font-medium">Past Imports</p>
              {archiveLoading && <p className="text-sm text-muted-foreground">Loading import archive...</p>}
              {!archiveLoading && archiveBatches.length === 0 && (
                <p className="text-sm text-muted-foreground">No archived imports yet.</p>
              )}

              {!archiveLoading && archiveBatches.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => setSelectedArchiveId(batch.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    selectedArchiveId === batch.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/60'
                  }`}
                >
                  <p className="text-sm font-medium">
                    Import {new Date(batch.createdAt).toLocaleDateString()} ({batch.sessions.length})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(batch.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </button>
              ))}

              {selectedArchive && (
                <div className="pt-2 border-t space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Sessions in this batch</p>
                  {selectedArchive.sessions.map((session) => {
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => {
                          setRawText(session.editorText);
                          setResult(null);
                          setError(null);
                          setSaveSummary(null);
                          setSelectedArchiveSession(session);
                        }}
                        className={`w-full rounded border px-2 py-1.5 text-xs text-left hover:bg-muted/60 transition-colors ${
                          selectedArchiveSession?.id === session.id ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        <p className="font-medium line-clamp-1">{session.title}</p>
                        <p className="text-muted-foreground">
                          {session.sourceDate ? `Source ${session.sourceDate}` : 'Source date unknown'}
                        </p>
                        <p className="text-muted-foreground mt-0.5">{session.movementCount} movements</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3 overflow-y-auto pr-1 min-h-0">
            <Textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="Paste workout history here..."
              className="h-72 max-h-72 resize-none overflow-auto [field-sizing:fixed]"
            />

            <div className="rounded-md border bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Supported Paste Types
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUPPORTED_PASTE_TYPES.map((item) => (
                  <div
                    key={item.badge}
                    className="inline-flex items-center gap-2 rounded-full border bg-background px-2.5 py-1"
                  >
                    <span className="inline-flex min-w-[46px] items-center justify-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                      {item.badge}
                    </span>
                    <span className="text-xs text-foreground/90">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {hasSummaryContent && (
              <div className="rounded-md border px-3 py-2 text-xs leading-5 space-y-1">
                {result && (
                  <p className="text-muted-foreground">
                    Imported {result.created} | Skipped {result.skipped} | Reference-converted {result.convertedToReference}
                  </p>
                )}
                {saveSummary && <p className="text-green-700">{saveSummary}</p>}
                {result?.unmatchedNames.length ? (
                  <p className="text-muted-foreground">
                    Unmatched names: {result.unmatchedNames.length}
                  </p>
                ) : null}
              </div>
            )}

            {mappingNames.length > 0 && (
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Assign unmatched names to library movements. Saved for future imports.
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {mappingNames.map((name) => {
                      const aliasKey = normalizeMovementName(name);
                      const selectedId = movementAliases[aliasKey] || UNASSIGNED_ALIAS_VALUE;

                      return (
                        <div key={name} className="grid grid-cols-[1fr_220px] gap-2 items-center">
                          <p className="text-xs truncate" title={name}>{name}</p>
                          <Select
                            value={selectedId}
                            onValueChange={(value) => setAlias(name, value)}
                          >
                            <SelectTrigger size="sm" className="w-full">
                              <SelectValue placeholder="Assign movement" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNASSIGNED_ALIAS_VALUE}>No mapping</SelectItem>
                              {movementOptions.map((movement) => (
                                <SelectItem key={movement.id} value={movement.id}>
                                  {movement.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          {!inline && (
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isImporting || isSaving}>
              Close
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleSaveSelectedSession}
            disabled={isImporting || isSaving || !rawText.trim() || !selectedArchiveSession}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
          <Button onClick={handleImport} disabled={isImporting || isSaving || !rawText.trim()}>
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              'Import Sessions'
            )}
          </Button>
        </DialogFooter>
    </>
  );

  if (inline) {
    return <div className="space-y-3">{content}</div>;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Import workout history">
          <Upload className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        {content}
      </DialogContent>
    </Dialog>
  );
}
