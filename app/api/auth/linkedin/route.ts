import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import crypto from 'crypto';
import { getClient } from '@/app/lib/redis';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = crypto.randomBytes(16).toString('hex');

  // Store state in Redis for CSRF verification
  const redis = getClient();
  await redis.set('linkedin_oauth_state', state, 'EX', 600);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL || 'https://linkedin-post-generator-ashy.vercel.app'}/api/auth/linkedin/callback`,
    state,
    scope: 'w_member_social',
  });

  return NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  );
}
