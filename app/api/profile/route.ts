import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Simple file-based storage for local dev; swap for Vercel KV in production
const DATA_DIR = join(process.cwd(), '.data');
const PROFILE_FILE = join(DATA_DIR, 'profile.json');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

async function kvGet(key: string): Promise<string | null> {
  // Vercel KV via REST API
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
  try {
    // Try KV first
    const kvData = await kvGet('profile');
    if (kvData) {
      const parsed = JSON.parse(kvData);
      return NextResponse.json(parsed);
    }
    // Fallback to file
    ensureDir();
    if (existsSync(PROFILE_FILE)) {
      const data = JSON.parse(readFileSync(PROFILE_FILE, 'utf-8'));
      return NextResponse.json(data);
    }
    return NextResponse.json({ posts: '' });
  } catch {
    return NextResponse.json({ posts: '' });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = JSON.stringify(body);
    // Save to KV
    await kvSet('profile', payload);
    // Also save to file as backup
    ensureDir();
    writeFileSync(PROFILE_FILE, payload, 'utf-8');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
