import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp } from '@/lib/firebase/admin';
import fs from 'fs/promises';
import path from 'path';

const adminApp = getFirebaseAdminApp();
const auth = getAuth(adminApp);

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge', 'principles');

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildMarkdown(data: KnowledgeEntry): string {
  const lines: string[] = [];

  lines.push(`# ${data.title}`);
  lines.push('');

  if (data.summary) {
    lines.push('## Summary');
    lines.push(data.summary);
    lines.push('');
  }

  if (data.useWhen?.length) {
    lines.push('## Use When');
    data.useWhen.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }

  if (data.avoidWhen?.length) {
    lines.push('## Avoid When');
    data.avoidWhen.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }

  if (data.decisionRules?.length) {
    lines.push('## Decision Rules');
    data.decisionRules.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }

  if (data.movementBias?.length) {
    lines.push('## Movement Bias');
    data.movementBias.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }

  if (data.loadingGuidance?.length) {
    lines.push('## Loading Guidance');
    data.loadingGuidance.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }

  if (data.coachingNotes?.length) {
    lines.push('## Coaching Notes');
    data.coachingNotes.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  }

  return lines.join('\n').trim();
}

function parseMarkdown(content: string, filename: string): KnowledgeEntry {
  const lines = content.split('\n');
  const entry: KnowledgeEntry = {
    id: filename.replace('.md', ''),
    title: '',
    summary: '',
    useWhen: [],
    avoidWhen: [],
    decisionRules: [],
    movementBias: [],
    loadingGuidance: [],
    coachingNotes: [],
  };

  let currentSection = '';

  for (const line of lines) {
    if (line.startsWith('# ')) {
      entry.title = line.slice(2).trim();
    } else if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim().toLowerCase().replace(/\s+/g, '');
    } else if (line.startsWith('- ') && currentSection) {
      const item = line.slice(2).trim();
      if (currentSection === 'usewhen') entry.useWhen?.push(item);
      else if (currentSection === 'avoidwhen') entry.avoidWhen?.push(item);
      else if (currentSection === 'decisionrules') entry.decisionRules?.push(item);
      else if (currentSection === 'movementbias') entry.movementBias?.push(item);
      else if (currentSection === 'loadingguidance') entry.loadingGuidance?.push(item);
      else if (currentSection === 'coachingnotes') entry.coachingNotes?.push(item);
    } else if (currentSection === 'summary' && line.trim()) {
      entry.summary = (entry.summary ? entry.summary + '\n' : '') + line.trim();
    }
  }

  return entry;
}

export interface KnowledgeEntry {
  id?: string;
  title: string;
  summary?: string;
  useWhen?: string[];
  avoidWhen?: string[];
  decisionRules?: string[];
  movementBias?: string[];
  loadingGuidance?: string[];
  coachingNotes?: string[];
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await auth.verifyIdToken(token);

    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
    const files = await fs.readdir(KNOWLEDGE_DIR);
    const entries: KnowledgeEntry[] = [];

    for (const file of files.filter((f) => f.endsWith('.md'))) {
      const content = await fs.readFile(path.join(KNOWLEDGE_DIR, file), 'utf-8');
      entries.push(parseMarkdown(content, file));
    }

    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: 'Failed to load knowledge' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await auth.verifyIdToken(token);

    const body: KnowledgeEntry = await req.json();
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });

    const id = body.id || slugify(body.title);
    const filename = `${id}.md`;
    const markdown = buildMarkdown(body);

    await fs.writeFile(path.join(KNOWLEDGE_DIR, filename), markdown, 'utf-8');

    return NextResponse.json({ id, success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save knowledge' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await auth.verifyIdToken(token);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await fs.unlink(path.join(KNOWLEDGE_DIR, `${id}.md`));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete knowledge entry' }, { status: 500 });
  }
}
