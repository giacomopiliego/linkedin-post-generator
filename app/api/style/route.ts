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
    const data = await redis.get('style');
    if (data) {
      return NextResponse.json(typeof data === 'string' ? JSON.parse(data) : data);
    }
    return NextResponse.json({ aboutMe: '' });
  } catch (error) {
    console.error('Style GET error:', error);
    return NextResponse.json({ aboutMe: '' });
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
    await redis.set('style', JSON.stringify({ aboutMe: body.aboutMe ?? '' }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Style POST error:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
