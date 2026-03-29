import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getClient } from '@/app/lib/redis';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const redis = getClient();
    const data = await redis.get('drafts');
    if (data) {
      return NextResponse.json(typeof data === 'string' ? JSON.parse(data) : data);
    }
    return NextResponse.json({ drafts: [] });
  } catch (error) {
    console.error('Drafts GET error:', error);
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
    const redis = getClient();
    await redis.set('drafts', JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Drafts POST error:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
