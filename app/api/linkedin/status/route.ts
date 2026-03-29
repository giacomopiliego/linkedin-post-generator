import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getClient } from '@/app/lib/redis';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const redis = getClient();
    const data = await redis.get('linkedin_tokens');
    if (!data) {
      return NextResponse.json({ connected: false });
    }

    const tokens = JSON.parse(data as string);
    const expired = Date.now() > tokens.expires_at;

    return NextResponse.json({
      connected: !expired,
      name: tokens.linkedin_name,
      expired,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
