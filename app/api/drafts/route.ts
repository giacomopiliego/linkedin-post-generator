import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { auth } from '@/auth';

const DATA_DIR = join(process.cwd(), '.data');
const DRAFTS_FILE = join(DATA_DIR, 'drafts.json');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

async function kvGet(key: string): Promise<string | null> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data.result ?? null;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: string): Promise<void> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  await fetch(`${url}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([value]),
  });
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const kvData = await kvGet('drafts');
    if (kvData) {
      const parsed = JSON.parse(kvData);
      return NextResponse.json(parsed);
    }
    ensureDir();
    if (existsSync(DRAFTS_FILE)) {
      const data = JSON.parse(readFileSync(DRAFTS_FILE, 'utf-8'));
      return NextResponse.json(data);
    }
    return NextResponse.json({ drafts: [] });
  } catch {
    return NextResponse.json({ drafts: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const payload = JSON.stringify(body);
    await kvSet('drafts', payload);
    ensureDir();
    writeFileSync(DRAFTS_FILE, payload, 'utf-8');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
