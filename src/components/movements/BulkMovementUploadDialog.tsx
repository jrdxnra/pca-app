"use client";

import { useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Upload, FileDown, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
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
import { toastError, toastInfo, toastSuccess } from '@/components/ui/toaster';
import { MovementCategory } from '@/lib/types';
import { addMovement, getAllMovements, updateMovement } from '@/lib/firebase/services/movements';
import { addMovementCategory, getAllMovementCategories } from '@/lib/firebase/services/movementCategories';

type ParsedMovementRow = {
  categoryNameRaw: string;
  movementNameRaw: string;
  links: string[];
  instructions?: string;
  sourceRow: number;
  sourceColumn?: number;
};

type DryRunResult = {
  sourceFormat: 'legacy-columns' | 'row-template';
  totalParsed: number;
  readyToImport: number;
  updatableExisting: number;
  skippedExisting: number;
  skippedInFileDuplicates: number;
  skippedUnknownCategory: number;
  skippedMissingMovement: number;
  skippedInvalidRows: number;
  unknownCategories: string[];
  unknownCategoryDetails: Array<{
    input: string;
    count: number;
    examples: string[];
    suggestedCategory: string | null;
    confidence: number;
  }>;
  unknownCategoryHints: Array<{
    input: string;
    suggestedCategory: string | null;
    confidence: number;
  }>;
  sampleMessages: string[];
  parsedRows: ParsedMovementRow[];
  importableRows: Array<ParsedMovementRow & { categoryId: string; normalizedMovementName: string }>;
};

const DEFAULT_TEMPLATE_URL = '/templates/movements-template.csv';
const DEFAULT_CATEGORY_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F97316',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#EF4444',
];

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeTokenWord(word: string): string {
  if (word.length > 3 && word.endsWith('s')) {
    return word.slice(0, -1);
  }
  return word;
}

function canonicalCategoryTokens(value: string): string {
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeTokenWord)
    .sort();

  return words.join(' ');
}

function splitLinks(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[|\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function linksEqual(a: string[] = [], b: string[] = []): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if ((a[i] || '').trim() !== (b[i] || '').trim()) {
      return false;
    }
  }
  return true;
}

function pickDefaultCategoryColor(name: string): string {
  const sum = name
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return DEFAULT_CATEGORY_COLORS[sum % DEFAULT_CATEGORY_COLORS.length];
}

function buildImportHighlight(kind: 'new' | 'updated') {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7);

  return {
    kind,
    source: 'bulk-upload' as const,
    at: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(expiresAt),
  };
}

function buildCategoryNewHighlight() {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7);

  return {
    kind: 'new' as const,
    source: 'bulk-upload' as const,
    at: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(expiresAt),
  };
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

function similarityScore(a: string, b: string): number {
  const aa = normalizeName(a);
  const bb = normalizeName(b);
  if (!aa || !bb) return 0;
  const distance = levenshteinDistance(aa, bb);
  const maxLen = Math.max(aa.length, bb.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

function buildUnknownCategoryHints(unknownCategories: string[], categories: MovementCategory[]) {
  return unknownCategories.map((input) => {
    let bestCategory: string | null = null;
    let bestScore = 0;

    categories.forEach((category) => {
      const directScore = similarityScore(input, category.name);
      const tokenScore = similarityScore(canonicalCategoryTokens(input), canonicalCategoryTokens(category.name));
      const score = Math.max(directScore, tokenScore);
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category.name;
      }
    });

    return {
      input,
      suggestedCategory: bestScore >= 0.68 ? bestCategory : null,
      confidence: bestScore,
    };
  });
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }

    if (!inQuotes && char === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }

    cell += char;
    i += 1;
  }

  row.push(cell);
  rows.push(row);

  return rows;
}

function detectHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i += 1) {
    const normalized = rows[i].map((c) => normalizeName(c));
    if (normalized.includes('categoryname') && normalized.includes('movementname')) {
      return i;
    }
  }
  return -1;
}

function parseTemplateRows(rows: string[][], headerRowIndex: number): ParsedMovementRow[] {
  const header = rows[headerRowIndex].map((h) => normalizeName(h));
  const categoryIdx = header.indexOf('categoryname');
  const movementIdx = header.indexOf('movementname');
  const linksIdx = header.indexOf('links');
  const instructionsIdx = header.indexOf('instructions');

  const parsed: ParsedMovementRow[] = [];

  for (let r = headerRowIndex + 1; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const categoryNameRaw = (row[categoryIdx] || '').trim();
    const movementNameRaw = (row[movementIdx] || '').trim();
    const linksRaw = linksIdx >= 0 ? row[linksIdx] : '';
    const instructions = instructionsIdx >= 0 ? (row[instructionsIdx] || '').trim() : '';

    if (!categoryNameRaw && !movementNameRaw && !(linksRaw || '').trim() && !instructions) {
      continue;
    }

    parsed.push({
      categoryNameRaw,
      movementNameRaw,
      links: splitLinks(linksRaw),
      instructions: instructions || undefined,
      sourceRow: r + 1,
    });
  }

  return parsed;
}

function parseLegacyRows(rows: string[][]): ParsedMovementRow[] {
  if (rows.length < 4) return [];

  const categoryRow = rows[2] || [];
  const maybeDuplicateCategoryRow = rows[3] || [];

  let dataStartRow = 3;
  let sameCount = 0;
  let compared = 0;

  for (let c = 0; c < categoryRow.length; c += 1) {
    const a = normalizeName(categoryRow[c] || '');
    const b = normalizeName(maybeDuplicateCategoryRow[c] || '');
    if (!a && !b) continue;
    compared += 1;
    if (a && b && a === b) sameCount += 1;
  }

  if (compared > 0 && sameCount / compared >= 0.6) {
    dataStartRow = 4;
  }

  const parsed: ParsedMovementRow[] = [];

  for (let r = dataStartRow; r < rows.length; r += 1) {
    const row = rows[r] || [];

    for (let c = 0; c < categoryRow.length; c += 1) {
      const categoryNameRaw = (categoryRow[c] || '').trim();
      const movementNameRaw = (row[c] || '').trim();

      if (!categoryNameRaw && !movementNameRaw) {
        continue;
      }

      if (!movementNameRaw) {
        continue;
      }

      parsed.push({
        categoryNameRaw,
        movementNameRaw,
        links: [],
        sourceRow: r + 1,
        sourceColumn: c + 1,
      });
    }
  }

  return parsed;
}

function buildCategoryLookup(categories: MovementCategory[]): {
  exact: Map<string, MovementCategory>;
  tokenized: Map<string, MovementCategory[]>;
} {
  const exact = new Map<string, MovementCategory>();
  const tokenized = new Map<string, MovementCategory[]>();

  categories.forEach((category) => {
    const exactKey = normalizeName(category.name);
    exact.set(exactKey, category);

    const tokenKey = canonicalCategoryTokens(category.name);
    const existing = tokenized.get(tokenKey) || [];
    existing.push(category);
    tokenized.set(tokenKey, existing);
  });

  return { exact, tokenized };
}

function resolveCategoryId(rawName: string, lookup: ReturnType<typeof buildCategoryLookup>): string | null {
  const exactMatch = lookup.exact.get(normalizeName(rawName));
  if (exactMatch) return exactMatch.id;

  const tokenMatches = lookup.tokenized.get(canonicalCategoryTokens(rawName)) || [];
  if (tokenMatches.length === 1) {
    return tokenMatches[0].id;
  }

  return null;
}

function formatCell(row: number, column?: number): string {
  if (!column) return `row ${row}`;
  return `row ${row}, col ${column}`;
}

interface BulkMovementUploadDialogProps {
  categories: MovementCategory[];
  onImportComplete?: () => Promise<void> | void;
}

export function BulkMovementUploadDialog({ categories, onImportComplete }: BulkMovementUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [createMissingCategories, setCreateMissingCategories] = useState(true);
  const [updateExistingMovements, setUpdateExistingMovements] = useState(true);

  const canImport = useMemo(() => {
    return !!dryRun && !!selectedFile && !importing;
  }, [dryRun, selectedFile, importing]);

  const handleAnalyze = async (file: File) => {
    setAnalyzing(true);
    setDryRun(null);

    try {
      const fileText = await file.text();
      const rows = parseCsv(fileText);
      const headerRowIndex = detectHeaderRow(rows);

      const sourceFormat: DryRunResult['sourceFormat'] = headerRowIndex >= 0 ? 'row-template' : 'legacy-columns';
      const parsed = headerRowIndex >= 0 ? parseTemplateRows(rows, headerRowIndex) : parseLegacyRows(rows);

      const categoryLookup = buildCategoryLookup(categories);
      const allExisting = await getAllMovements();

      const existingKeys = new Set<string>();

      allExisting.forEach((movement) => {
        const key = `${movement.categoryId}::${normalizeName(movement.name)}`;
        existingKeys.add(key);
      });

      const fileKeys = new Set<string>();
      const unknownCategorySet = new Set<string>();
      const unknownCategoryMap = new Map<string, { count: number; examples: string[] }>();
      const messages: string[] = [];

      let skippedExisting = 0;
      let updatableExisting = 0;
      let skippedInFileDuplicates = 0;
      let skippedUnknownCategory = 0;
      let skippedMissingMovement = 0;
      let skippedInvalidRows = 0;

      const importableRows: DryRunResult['importableRows'] = [];

      parsed.forEach((entry) => {
        const movementNameNormalized = normalizeName(entry.movementNameRaw);

        if (!movementNameNormalized) {
          skippedMissingMovement += 1;
          messages.push(`Skipped ${formatCell(entry.sourceRow, entry.sourceColumn)}: missing movement name.`);
          return;
        }

        if (!entry.categoryNameRaw.trim()) {
          skippedInvalidRows += 1;
          messages.push(`Skipped ${formatCell(entry.sourceRow, entry.sourceColumn)}: missing category name.`);
          return;
        }

        const categoryId = resolveCategoryId(entry.categoryNameRaw, categoryLookup);
        if (!categoryId) {
          skippedUnknownCategory += 1;
          const unknownName = entry.categoryNameRaw.trim();
          unknownCategorySet.add(unknownName);

          const currentUnknown = unknownCategoryMap.get(unknownName) || { count: 0, examples: [] };
          currentUnknown.count += 1;
          if (currentUnknown.examples.length < 3) {
            currentUnknown.examples.push(`${formatCell(entry.sourceRow, entry.sourceColumn)} - ${entry.movementNameRaw}`);
          }
          unknownCategoryMap.set(unknownName, currentUnknown);

          messages.push(`Skipped ${formatCell(entry.sourceRow, entry.sourceColumn)}: unknown category "${entry.categoryNameRaw}".`);
          return;
        }

        const key = `${categoryId}::${movementNameNormalized}`;

        if (existingKeys.has(key)) {
          skippedExisting += 1;
          const existing = allExisting.find(
            (m) => m.categoryId === categoryId && normalizeName(m.name) === movementNameNormalized
          );
          const hasCsvMetadata = entry.links.length > 0 || !!entry.instructions?.trim();
          if (existing && hasCsvMetadata) {
            const hasLinkChanges = entry.links.length > 0 && !linksEqual(existing.links || [], entry.links);
            const hasInstructionChanges =
              !!entry.instructions?.trim() && (existing.instructions || '').trim() !== entry.instructions.trim();
            if (hasLinkChanges || hasInstructionChanges) {
              updatableExisting += 1;
            }
          }
          return;
        }

        if (fileKeys.has(key)) {
          skippedInFileDuplicates += 1;
          return;
        }

        fileKeys.add(key);
        importableRows.push({
          ...entry,
          categoryId,
          normalizedMovementName: movementNameNormalized,
        });
      });

      const unknownCategories = Array.from(unknownCategorySet).sort();
      const unknownCategoryHints = buildUnknownCategoryHints(unknownCategories, categories);
      const unknownHintMap = new Map(unknownCategoryHints.map((hint) => [hint.input, hint]));

      setDryRun({
        sourceFormat,
        totalParsed: parsed.length,
        readyToImport: importableRows.length,
        updatableExisting,
        skippedExisting,
        skippedInFileDuplicates,
        skippedUnknownCategory,
        skippedMissingMovement,
        skippedInvalidRows,
        unknownCategories,
        unknownCategoryDetails: unknownCategories.map((name) => {
          const unknown = unknownCategoryMap.get(name);
          const hint = unknownHintMap.get(name);
          return {
            input: name,
            count: unknown?.count || 0,
            examples: unknown?.examples || [],
            suggestedCategory: hint?.suggestedCategory || null,
            confidence: hint?.confidence || 0,
          };
        }),
        unknownCategoryHints,
        sampleMessages: messages.slice(0, 10),
        parsedRows: parsed,
        importableRows,
      });

      if (importableRows.length === 0 && updatableExisting === 0) {
        toastInfo('Analysis complete. No new movements ready to import.');
      } else {
        toastSuccess(
          `Analysis complete. ${importableRows.length} new and ${updatableExisting} existing movements can be applied.`
        );
      }
    } catch (error) {
      console.error('Bulk movement analysis failed:', error);
      toastError('Could not analyze CSV. Please check file format and try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!dryRun) {
      toastInfo('Run analysis first.');
      return;
    }

    setImporting(true);

    try {
      const allCategories = await getAllMovementCategories();
      const categoryLookupInitial = buildCategoryLookup(allCategories);

      if (createMissingCategories && dryRun.unknownCategories.length > 0) {
        for (const categoryName of dryRun.unknownCategories) {
          const existing = resolveCategoryId(categoryName, categoryLookupInitial);
          if (!existing) {
            await addMovementCategory({
              name: categoryName,
              color: pickDefaultCategoryColor(categoryName),
              importHighlight: buildCategoryNewHighlight(),
            });
          }
        }
      }

      const categoriesAfterCreate = await getAllMovementCategories();
      const categoryLookup = buildCategoryLookup(categoriesAfterCreate);
      const allExisting = await getAllMovements();
      const existingMap = new Map<string, (typeof allExisting)[number]>();
      const maxOrdinalByCategory = new Map<string, number>();
      const seenCreateKeys = new Set<string>();

      allExisting.forEach((movement) => {
        const key = `${movement.categoryId}::${normalizeName(movement.name)}`;
        existingMap.set(key, movement);
      });

      allExisting.forEach((movement) => {
        const currentMax = maxOrdinalByCategory.get(movement.categoryId) ?? -1;
        maxOrdinalByCategory.set(movement.categoryId, Math.max(currentMax, movement.ordinal ?? -1));
      });

      let createdCount = 0;
      let updatedCount = 0;
      let skippedUnknown = 0;
      let skippedMissing = 0;

      for (const row of dryRun.parsedRows) {
        const movementName = row.movementNameRaw.trim();
        if (!movementName) {
          skippedMissing += 1;
          continue;
        }

        const categoryId = resolveCategoryId(row.categoryNameRaw, categoryLookup);
        if (!categoryId) {
          skippedUnknown += 1;
          continue;
        }

        const movementKey = `${categoryId}::${normalizeName(movementName)}`;
        const existing = existingMap.get(movementKey);

        if (existing) {
          if (updateExistingMovements) {
            const patch: {
              links?: string[];
              instructions?: string;
              importHighlight?: {
                kind: 'new' | 'updated';
                source: 'bulk-upload';
                at: Timestamp;
                expiresAt: Timestamp;
              };
            } = {};

            if (row.links.length > 0 && !linksEqual(existing.links || [], row.links)) {
              patch.links = row.links;
            }

            if (row.instructions?.trim() && (existing.instructions || '').trim() !== row.instructions.trim()) {
              patch.instructions = row.instructions.trim();
            }

            if (Object.keys(patch).length > 0) {
              patch.importHighlight = buildImportHighlight('updated');
              await updateMovement(existing.id, patch);
              updatedCount += 1;
            }
          }
          continue;
        }

        if (seenCreateKeys.has(movementKey)) {
          continue;
        }
        seenCreateKeys.add(movementKey);

        const currentMax = maxOrdinalByCategory.get(categoryId) ?? -1;
        const nextOrdinal = currentMax + 1;
        maxOrdinalByCategory.set(categoryId, nextOrdinal);

        await addMovement({
          name: movementName,
          categoryId,
          ordinal: nextOrdinal,
          configuration: undefined,
          links: row.links,
          instructions: row.instructions,
          importHighlight: buildImportHighlight('new'),
        });

        createdCount += 1;
      }

      if (createdCount === 0 && updatedCount === 0) {
        toastInfo('Import complete. No changes were needed.');
      } else {
        toastSuccess(
          `Import complete. Created ${createdCount}, updated ${updatedCount}${skippedUnknown > 0 ? `, skipped unknown category rows ${skippedUnknown}` : ''}${skippedMissing > 0 ? `, skipped missing movement rows ${skippedMissing}` : ''}.`
        );
      }

      setOpen(false);
      setSelectedFile(null);
      setDryRun(null);
      setCreateMissingCategories(true);
      setUpdateExistingMovements(true);
      await onImportComplete?.();
    } catch (error) {
      console.error('Bulk movement import failed:', error);
      toastError('Import failed. No changes were rolled back automatically. Re-run analysis before retrying.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-1.5" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Upload Movements (CSV)
          </DialogTitle>
          <DialogDescription>
            Supports your current legacy category-columns sheet and the new row-based template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 bg-muted/20">
            <p className="text-sm font-medium mb-2">Recommended coach flow</p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-5">
              <li>Click Download Template.</li>
              <li>Open in Google Sheets and choose File then Make a copy.</li>
              <li>Fill rows under the header and export as CSV.</li>
              <li>Upload CSV here, run analysis, then import.</li>
            </ol>
            <div className="mt-3">
              <a href={DEFAULT_TEMPLATE_URL} download>
                <Button type="button" variant="outline" size="sm">
                  <FileDown className="h-4 w-4 mr-1.5" />
                  Download Template
                </Button>
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CSV file</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                setDryRun(null);
                if (file) {
                  await handleAnalyze(file);
                }
              }}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          {dryRun && (
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Dry-run results ({dryRun.sourceFormat === 'legacy-columns' ? 'legacy columns format' : 'row template format'})
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="rounded border p-2">Parsed: <strong>{dryRun.totalParsed}</strong></div>
                <div className="rounded border p-2">Ready: <strong>{dryRun.readyToImport}</strong></div>
                <div className="rounded border p-2">Updatable existing: <strong>{dryRun.updatableExisting}</strong></div>
                <div className="rounded border p-2">Existing dupes: <strong>{dryRun.skippedExisting}</strong></div>
                <div className="rounded border p-2">In-file dupes: <strong>{dryRun.skippedInFileDuplicates}</strong></div>
                <div className="rounded border p-2">Unknown category: <strong>{dryRun.skippedUnknownCategory}</strong></div>
                <div className="rounded border p-2">Missing movement: <strong>{dryRun.skippedMissingMovement}</strong></div>
                <div className="rounded border p-2">Invalid rows: <strong>{dryRun.skippedInvalidRows}</strong></div>
              </div>

              {dryRun.unknownCategories.length > 0 && (
                <label className="flex items-start gap-2 text-sm rounded border p-3 bg-muted/20">
                  <input
                    type="checkbox"
                    checked={createMissingCategories}
                    onChange={(e) => setCreateMissingCategories(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Create missing categories automatically during import. Turn this off if you want to fix possible typos first and re-upload.
                  </span>
                </label>
              )}

              <label className="flex items-start gap-2 text-sm rounded border p-3 bg-muted/20">
                <input
                  type="checkbox"
                  checked={updateExistingMovements}
                  onChange={(e) => setUpdateExistingMovements(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Update existing movements when CSV has changed links or instructions for the same category and movement name.
                </span>
              </label>

              {dryRun.unknownCategories.length > 0 && (
                <div className="text-sm rounded border border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 font-medium text-amber-800 mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    Unknown categories found
                  </div>
                  <p className="text-amber-700 mb-2">
                    Rows under unknown categories were skipped. Category names must match your app categories exactly.
                  </p>
                  <p className="text-amber-700 mb-2">
                    Distinct unknown categories: {dryRun.unknownCategories.length} | Skipped rows: {dryRun.skippedUnknownCategory}
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-amber-800">
                    {dryRun.unknownCategoryDetails.slice(0, 20).map((detail) => (
                      <li key={detail.input}>
                        <div>
                          <strong>{detail.input}</strong> ({detail.count} rows)
                          {detail.suggestedCategory
                            ? ` -> did you mean "${detail.suggestedCategory}"?`
                            : ' -> no close match found'}
                        </div>
                        {detail.examples.length > 0 && (
                          <div className="text-amber-700">
                            Examples: {detail.examples.join(' | ')}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {dryRun.unknownCategoryDetails.length > 20 && (
                    <p className="text-amber-700 mt-2">
                      Showing first 20 suggestions.
                    </p>
                  )}
                  <p className="text-amber-700 mt-2">
                    Coach action: fix category labels in the CSV to match app category names, then re-upload.
                  </p>
                </div>
              )}

              {dryRun.sampleMessages.length > 0 && (
                <div className="text-sm rounded border p-3">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <Info className="h-4 w-4" />
                    Validation notes (first {dryRun.sampleMessages.length})
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {dryRun.sampleMessages.map((message, index) => (
                      <li key={`${message}-${index}`}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => selectedFile && handleAnalyze(selectedFile)}
            disabled={!selectedFile || analyzing || importing}
          >
            {analyzing ? 'Analyzing...' : 'Re-run Analysis'}
          </Button>
          <Button type="button" onClick={handleImport} disabled={!canImport || analyzing}>
            {importing ? 'Applying...' : 'Apply Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
