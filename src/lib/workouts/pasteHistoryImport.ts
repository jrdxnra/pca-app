export interface ParsedMovementEntry {
  movementName: string;
  sets: number;
  reps?: string;
  load?: string;
}

export interface ParsedHistoryRound {
  sectionName: string;
  entries: ParsedMovementEntry[];
}

export interface ParsedHistorySession {
  date: Date;
  sessionLengthMinutes?: number;
  rounds: ParsedHistoryRound[];
}

export interface ParsedHistoryResult {
  sessions: ParsedHistorySession[];
  movementRows: number;
  warnings: string[];
}

interface MutableSession {
  date: Date;
  sessionLengthMinutes?: number;
  rounds: Map<string, ParsedMovementEntry[]>;
  currentSection: string;
}

const DATE_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
const DOT_DATE_RE = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/;
const ISO_DATE_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/;

const NOISE_HEADERS = new Set([
  'date',
  'date:',
  'session length',
  'completed',
  'movement',
  'sets',
  'reps',
  'load',
  'primary/horizontal',
  'supplement/vertical',
  'additional',
  'mobility',
  'stability',
  'olympic lifts',
  'tempos',
  'weight',
  '%',
  'cardio',
]);

function cleanCell(value: string | undefined): string {
  return (value || '').replace(/\u00A0/g, ' ').trim();
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  cells.push(current);
  return cells;
}

function splitLine(line: string, delimiter: '\t' | ','): string[] {
  if (delimiter === '\t') {
    return line.split('\t');
  }
  return parseCsvLine(line);
}

function toSectionName(value: string): string | null {
  const cleaned = cleanCell(value);
  if (!cleaned) return null;

  const normalized = cleaned.toLowerCase();
  if (normalized === 'warm up' || normalized === 'warmup') {
    return 'WARM UP';
  }
  if (normalized.includes('working sets')) {
    return cleaned.toUpperCase();
  }
  if (normalized === 'cardio') {
    return 'CARDIO';
  }

  return null;
}

function parseDateToken(value: string): Date | null {
  const match = value.match(DATE_RE);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || !day || !year) return null;

  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseDotDateToken(value: string): Date | null {
  const match = value.match(DOT_DATE_RE);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = Number(match[3]);
  if (!month || !day || !year) return null;
  if (year < 100) {
    year += year >= 70 ? 1900 : 2000;
  }

  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseIsoDateToken(value: string): Date | null {
  const match = value.match(ISO_DATE_RE);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!month || !day || !year) return null;

  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseSessionLengthMinutes(values: string[]): number | undefined {
  const combined = values.join(' ');
  const match = combined.match(/(\d{1,3})\s*min/i);
  if (!match) return undefined;

  const minutes = Number(match[1]);
  if (!Number.isFinite(minutes) || minutes <= 0) return undefined;
  return minutes;
}

function isLikelyMovementRow(name: string, sets: string, reps: string, load: string): boolean {
  const normalizedName = name.toLowerCase();
  if (!normalizedName) return false;
  if (NOISE_HEADERS.has(normalizedName)) return false;
  if (normalizedName.startsWith('day ') || normalizedName === 'march' || normalizedName === 'april' || normalizedName === 'may' || normalizedName === 'june') {
    return false;
  }
  if (DATE_RE.test(name)) return false;
  if (ISO_DATE_RE.test(name)) return false;
  if (normalizedName.startsWith('working sets') || normalizedName === 'warm up' || normalizedName === 'warmup') {
    return false;
  }
  if (normalizedName.startsWith('-') && !sets && !reps && !load) {
    return false;
  }

  return Boolean(sets || reps || load);
}

function parseSets(rawSets: string): number {
  const match = rawSets.match(/\d+/);
  if (!match) return 1;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function finalizeSession(session: MutableSession): ParsedHistorySession | null {
  const rounds = Array.from(session.rounds.entries())
    .map(([sectionName, entries]) => ({ sectionName, entries }))
    .filter((round) => round.entries.length > 0);

  if (rounds.length === 0) {
    return null;
  }

  return {
    date: session.date,
    sessionLengthMinutes: session.sessionLengthMinutes,
    rounds,
  };
}

function parseSheetWorkoutHistory(input: string): ParsedHistoryResult {
  const normalizedInput = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedInput.split('\n');
  const delimiter: '\t' | ',' = normalizedInput.includes('\t') ? '\t' : ',';

  const headerLaneStarts = new Set<number>();
  const dateLaneStarts = new Set<number>();
  const rowCells = lines.map((line) => splitLine(line, delimiter));

  rowCells.forEach((cells) => {
    for (let idx = 0; idx <= cells.length - 4; idx += 1) {
      const c0 = cleanCell(cells[idx]).toLowerCase();
      const c1 = cleanCell(cells[idx + 1]).toLowerCase();
      const c2 = cleanCell(cells[idx + 2]).toLowerCase();
      const c3 = cleanCell(cells[idx + 3]).toLowerCase();
      if (c0 === 'movement' && c1 === 'sets' && c2 === 'reps' && c3 === 'load') {
        headerLaneStarts.add(idx);
      }
    }
  });

  rowCells.forEach((cells) => {
    cells.forEach((cell, idx) => {
      const value = cleanCell(cell);
      if (!value) return;
      if (value.toLowerCase().startsWith('date') || DATE_RE.test(value)) {
        dateLaneStarts.add(idx);
      }
    });
  });

  const laneStarts = new Set<number>([...headerLaneStarts, ...dateLaneStarts]);
  const sortedCandidates = Array.from(laneStarts).sort((a, b) => a - b);
  const sortedLaneStarts: number[] = [];
  for (const start of sortedCandidates) {
    if (sortedLaneStarts.length === 0) {
      sortedLaneStarts.push(start);
      continue;
    }

    const prev = sortedLaneStarts[sortedLaneStarts.length - 1];
    if (start - prev > 1) {
      sortedLaneStarts.push(start);
      continue;
    }

    const prevIsHeader = headerLaneStarts.has(prev);
    const currentIsHeader = headerLaneStarts.has(start);
    if (!prevIsHeader && currentIsHeader) {
      sortedLaneStarts[sortedLaneStarts.length - 1] = start;
    }
  }

  const warnings: string[] = [];
  if (sortedLaneStarts.length === 0) {
    return {
      sessions: [],
      movementRows: 0,
      warnings: ['No session dates found. Paste must include dates like 6/23/2026.'],
    };
  }

  const sessionsByLane = new Map<number, MutableSession[]>();
  sortedLaneStarts.forEach((lane) => sessionsByLane.set(lane, []));

  let movementRows = 0;

  rowCells.forEach((cells) => {
    sortedLaneStarts.forEach((laneStart) => {
      const name = cleanCell(cells[laneStart]);
      const sets = cleanCell(cells[laneStart + 1]);
      const reps = cleanCell(cells[laneStart + 2]);
      const load = cleanCell(cells[laneStart + 3]);

      const dateParts = [
        laneStart > 0 ? cleanCell(cells[laneStart - 1]) : '',
        name,
        sets,
        reps,
        load,
      ];
      const dateToken = dateParts.find((part) => DATE_RE.test(part) || ISO_DATE_RE.test(part));
      if (dateToken) {
        const parsedDate = parseDateToken(dateToken) || parseIsoDateToken(dateToken);
        if (parsedDate) {
          const laneSessions = sessionsByLane.get(laneStart) || [];
          laneSessions.push({
            date: parsedDate,
            sessionLengthMinutes: parseSessionLengthMinutes(dateParts),
            rounds: new Map<string, ParsedMovementEntry[]>(),
            currentSection: 'IMPORTED',
          });
          sessionsByLane.set(laneStart, laneSessions);
        }
      }

      const sectionName = toSectionName(name);
      const laneSessions = sessionsByLane.get(laneStart) || [];
      const currentSession = laneSessions.length > 0 ? laneSessions[laneSessions.length - 1] : null;
      if (!currentSession) {
        return;
      }

      if (sectionName) {
        currentSession.currentSection = sectionName;
        if (!currentSession.rounds.has(sectionName)) {
          currentSession.rounds.set(sectionName, []);
        }
        return;
      }

      if (!isLikelyMovementRow(name, sets, reps, load)) {
        return;
      }

      const entry: ParsedMovementEntry = {
        movementName: name,
        sets: parseSets(sets),
        reps: reps || undefined,
        load: load || undefined,
      };

      const section = currentSession.currentSection || 'IMPORTED';
      if (!currentSession.rounds.has(section)) {
        currentSession.rounds.set(section, []);
      }
      currentSession.rounds.get(section)!.push(entry);
      movementRows += 1;
    });
  });

  const sessions = Array.from(sessionsByLane.values())
    .flatMap((laneSessions) => laneSessions)
    .map((session) => finalizeSession(session))
    .filter((session): session is ParsedHistorySession => Boolean(session))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sessions.length === 0) {
    warnings.push('Found dates, but no valid movement rows were parsed.');
  }

  return {
    sessions,
    movementRows,
    warnings,
  };
}

function parseDocWorkoutHistory(input: string): ParsedHistoryResult {
  const lines = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const warnings: string[] = [];
  const sessions: ParsedHistorySession[] = [];

  const baseDate = new Date();
  baseDate.setHours(12, 0, 0, 0);

  let currentSession: MutableSession | null = null;
  let sessionCounter = 0;
  let currentSetHint = 1;
  let movementRows = 0;

  const ensureSession = (date?: Date) => {
    if (!currentSession) {
      const fallback = new Date(baseDate);
      fallback.setDate(fallback.getDate() - sessionCounter);
      sessionCounter += 1;

      currentSession = {
        date: date || fallback,
        rounds: new Map<string, ParsedMovementEntry[]>(),
        currentSection: 'WORKING SETS: STRENGTH',
      };
      currentSetHint = 1;
    }
    if (date) {
      currentSession.date = date;
    }
  };

  const flushSession = () => {
    if (!currentSession) return;
    const finalized = finalizeSession(currentSession);
    if (finalized) {
      sessions.push(finalized);
    }
    currentSession = null;
    currentSetHint = 1;
  };

  const setSection = (section: string) => {
    if (!currentSession) return;
    const session = currentSession as MutableSession;
    session.currentSection = section;
    if (!session.rounds.has(section)) {
      session.rounds.set(section, []);
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^date\s*:?$/i.test(line)) {
      continue;
    }

    if (/^movement\s*[\t, ]+sets\s*[\t, ]+reps\s*[\t, ]+load$/i.test(line)) {
      continue;
    }

    if (/^date\s*[\t, ]+movement\s*[\t, ]+sets\s*[\t, ]+reps\s*[\t, ]+load$/i.test(line)) {
      continue;
    }

    const explicitDate = parseDateToken(line) || parseDotDateToken(line) || parseIsoDateToken(line);
    if (explicitDate) {
      if (currentSession && (currentSession as MutableSession).rounds.size > 0) {
        flushSession();
      }
      ensureSession(explicitDate);
      continue;
    }

    if (/^#{1,6}\s*day\s*\d+/i.test(line) || /^day\s*\d+\s*:/i.test(line) || /^workout\b/i.test(line)) {
      if (currentSession && (currentSession as MutableSession).rounds.size > 0) {
        flushSession();
      }
      ensureSession();
      continue;
    }

    const setHintMatch = line.match(/\((\d+)\s*sets?\)/i);
    if (setHintMatch) {
      const parsed = Number(setHintMatch[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        currentSetHint = parsed;
      }
    }

    if (/^warm\s*up\s*:?/i.test(line)) {
      ensureSession();
      setSection('WARM UP');
      continue;
    }
    if (/^round\s*\d+/i.test(line)) {
      ensureSession();
      setSection(line.replace(/:+$/, '').toUpperCase());
      continue;
    }
    if (/^block\s*\d+/i.test(line)) {
      ensureSession();
      setSection(line.replace(/:+$/, '').toUpperCase());
      continue;
    }
    if (/^finisher\b/i.test(line)) {
      ensureSession();
      setSection('FINISHER');
      continue;
    }
    if (/^core\b/i.test(line)) {
      ensureSession();
      setSection('CORE');
      continue;
    }
    if (/^cool\s*down\b/i.test(line)) {
      ensureSession();
      setSection('COOL DOWN');
      continue;
    }
    if (/^dynamic\s*stretch/i.test(line)) {
      ensureSession();
      setSection('WARM UP');
      continue;
    }
    if (/^prep\b/i.test(line)) {
      ensureSession();
      setSection('PREP');
      continue;
    }

    if (/^[\-–—•]+\s*$/.test(line)) {
      continue;
    }

    ensureSession();
    if (!currentSession) continue;
    const session = currentSession as MutableSession;

    const linkExpanded = line.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    let working = linkExpanded
      .replace(/^\d+\.\s*/, '')
      .replace(/[–—]/g, '-')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!working) continue;
    if (/^(foam\s*roll|rest)$/i.test(working)) continue;
    if (/^[a-z ]+:$/i.test(working)) continue;

    let sets = currentSetHint;
    let reps: string | undefined;
    let load: string | undefined;

    const explicitSetRep = working.match(/\b(\d+)\s*x\s*(\d+(?:-\d+)?(?:ea)?|\d+\s*(?:s|sec|min))\b/i);
    if (explicitSetRep) {
      const parsedSets = Number(explicitSetRep[1]);
      if (Number.isFinite(parsedSets) && parsedSets > 0) sets = parsedSets;
      reps = explicitSetRep[2].replace(/\s+/g, ' ').trim();
      working = working.replace(explicitSetRep[0], ' ').replace(/\s{2,}/g, ' ').trim();
    } else {
      const repOnly = working.match(/\bx\s*(\d+(?:-\d+)?(?:ea)?|\d+\s*(?:s|sec|min))\b/i);
      if (repOnly) {
        reps = repOnly[1].replace(/\s+/g, ' ').trim();
        working = working.replace(repOnly[0], ' ').replace(/\s{2,}/g, ' ').trim();
      } else {
        const timeOnly = working.match(/\b(\d+\s*(?:s|sec|min))\b/i);
        if (timeOnly) {
          reps = timeOnly[1].replace(/\s+/g, ' ').trim();
          working = working.replace(timeOnly[0], ' ').replace(/\s{2,}/g, ' ').trim();
        }
      }
    }

    const loadMatch = working.match(/\b(~?\d+(?:-\d+)?\s?(?:lb|lbs|kg|kgs|db|dbs|kb|kbs|kgs))\b/i);
    if (loadMatch) {
      load = loadMatch[1].trim();
      working = working.replace(loadMatch[0], ' ').replace(/\s{2,}/g, ' ').trim();
    }

    working = working
      .replace(/\(.*?\)/g, ' ')
      .replace(/:+$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!working) continue;
    if (working.length < 2) continue;

    const section = session.currentSection || 'WORKING SETS: STRENGTH';
    if (!session.rounds.has(section)) {
      session.rounds.set(section, []);
    }

    session.rounds.get(section)!.push({
      movementName: working,
      sets,
      reps: reps || undefined,
      load: load || undefined,
    });
    movementRows += 1;
  }

  flushSession();

  if (sessions.length === 0) {
    warnings.push('No parsable workout sessions found in document format.');
  }

  return {
    sessions,
    movementRows,
    warnings,
  };
}

export function parsePastedWorkoutHistory(input: string): ParsedHistoryResult {
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const likelyDoc = /(^|\n)\s*(#{1,6}\s*day\s*\d+|day\s*\d+\s*:|round\s*\d+|block\s*\d+|warm\s*up\s*:)/i.test(normalized);
  const likelySheet = normalized.includes('\t') || /movement\s*[\t,]\s*sets\s*[\t,]\s*reps\s*[\t,]\s*load/i.test(normalized);

  const sheetResult = likelyDoc && !likelySheet
    ? { sessions: [], movementRows: 0, warnings: [] as string[] }
    : parseSheetWorkoutHistory(input);
  const docResult = parseDocWorkoutHistory(input);

  if (sheetResult.sessions.length === 0 && docResult.sessions.length > 0) {
    return docResult;
  }
  if (docResult.sessions.length === 0 && sheetResult.sessions.length > 0) {
    return sheetResult;
  }

  // When the paste clearly looks tabular and sheet parsing produced sessions,
  // prefer sheet output to avoid doc-parser false positives on headers.
  if (likelySheet && sheetResult.sessions.length > 0) {
    return sheetResult;
  }

  if (likelyDoc && !likelySheet && docResult.sessions.length > 0) {
    return docResult;
  }

  if (docResult.movementRows > sheetResult.movementRows) {
    return docResult;
  }

  return sheetResult;
}

export function normalizeMovementName(value: string): string {
  return cleanCell(value)
    .toLowerCase()
    .replace(/\b(sa|db|bb|kb|bw)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
