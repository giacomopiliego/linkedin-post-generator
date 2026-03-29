import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getClient } from '@/app/lib/redis';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    console.error('LinkedIn OAuth error:', error);
    return NextResponse.redirect(new URL('/?linkedin=error', req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/?linkedin=error', req.url));
  }

  // Verify state
  const redis = getClient();
  const savedState = await redis.get('linkedin_oauth_state');
  console.log('OAuth state check - received:', state, 'saved:', savedState);
  if (state !== savedState) {
    console.error('LinkedIn OAuth state mismatch - received:', state, 'saved:', savedState);
    return NextResponse.redirect(new URL('/?linkedin=error', req.url));
  }
  await redis.del('linkedin_oauth_state');

  // Exchange code for access token
  const redirectUri = `${process.env.NEXTAUTH_URL || 'https://linkedin-post-generator-ashy.vercel.app'}/api/auth/linkedin/callback`;

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('LinkedIn token exchange failed:', tokenRes.status, err);
    console.error('Used redirect_uri:', redirectUri);
    console.error('Used client_id:', process.env.LINKEDIN_CLIENT_ID);
    return NextResponse.redirect(new URL('/?linkedin=error', req.url));
  }

  const tokenData = await tokenRes.json();
  console.log('LinkedIn token received, expires_in:', tokenData.expires_in);

  // Get LinkedIn user ID using /v2/me
  const meRes = await fetch('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!meRes.ok) {
    const err = await meRes.text();
    console.error('LinkedIn /v2/me failed:', meRes.status, err);
    return NextResponse.redirect(new URL('/?linkedin=error', req.url));
  }

  const meData = await meRes.json();
  const linkedinId = meData.id;
  const firstName = meData.localizedFirstName || '';
  const lastName = meData.localizedLastName || '';
  console.log('LinkedIn user:', linkedinId, firstName, lastName);

  // Store tokens and user info in Redis
  await redis.set('linkedin_tokens', JSON.stringify({
    access_token: tokenData.access_token,
    expires_at: Date.now() + (tokenData.expires_in * 1000),
    linkedin_sub: linkedinId,
    linkedin_name: `${firstName} ${lastName}`.trim(),
  }));

  return NextResponse.redirect(new URL('/?linkedin=connected', req.url));
}
