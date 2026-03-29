import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getClient } from '@/app/lib/redis';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      console.error('LinkedIn callback: no session');
      return NextResponse.redirect(new URL('/', req.url));
    }

    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const error = req.nextUrl.searchParams.get('error');
    const errorDesc = req.nextUrl.searchParams.get('error_description');

    console.log('LinkedIn callback params - code:', !!code, 'state:', !!state, 'error:', error, 'errorDesc:', errorDesc);

    if (error) {
      console.error('LinkedIn OAuth error:', error, errorDesc);
      return NextResponse.redirect(new URL('/?linkedin=error', req.url));
    }

    if (!code || !state) {
      console.error('LinkedIn callback: missing code or state');
      return NextResponse.redirect(new URL('/?linkedin=error', req.url));
    }

    const redis = getClient();
    const savedState = await redis.get('linkedin_oauth_state');
    console.log('OAuth state check - match:', state === savedState);
    if (state !== savedState) {
      console.error('LinkedIn OAuth state mismatch');
      return NextResponse.redirect(new URL('/?linkedin=error', req.url));
    }
    await redis.del('linkedin_oauth_state');

    // Exchange code for access token
    const redirectUri = 'https://linkedin-post-generator-ashy.vercel.app/api/auth/linkedin/callback';
    console.log('Token exchange - redirect_uri:', redirectUri, 'client_id:', process.env.LINKEDIN_CLIENT_ID);

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    });

    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });

    const tokenText = await tokenRes.text();
    console.log('Token exchange response:', tokenRes.status, tokenText.substring(0, 200));

    if (!tokenRes.ok) {
      console.error('LinkedIn token exchange failed:', tokenRes.status, tokenText);
      return NextResponse.redirect(new URL('/?linkedin=error', req.url));
    }

    const tokenData = JSON.parse(tokenText);

    // Get LinkedIn user ID using /v2/me
    const meRes = await fetch('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const meText = await meRes.text();
    console.log('/v2/me response:', meRes.status, meText.substring(0, 200));

    if (!meRes.ok) {
      // If /v2/me fails, try /v2/userinfo as fallback
      console.log('Trying /v2/userinfo as fallback...');
      const uiRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const uiText = await uiRes.text();
      console.log('/v2/userinfo response:', uiRes.status, uiText.substring(0, 200));

      if (!uiRes.ok) {
        // Store token without user info — we'll get the ID from the post response
        console.log('Storing token without user profile info');
        await redis.set('linkedin_tokens', JSON.stringify({
          access_token: tokenData.access_token,
          expires_at: Date.now() + (tokenData.expires_in * 1000),
          linkedin_sub: '',
          linkedin_name: 'LinkedIn User',
        }));
        return NextResponse.redirect(new URL('/?linkedin=connected', req.url));
      }

      const uiData = JSON.parse(uiText);
      await redis.set('linkedin_tokens', JSON.stringify({
        access_token: tokenData.access_token,
        expires_at: Date.now() + (tokenData.expires_in * 1000),
        linkedin_sub: uiData.sub || '',
        linkedin_name: uiData.name || 'LinkedIn User',
      }));
      return NextResponse.redirect(new URL('/?linkedin=connected', req.url));
    }

    const meData = JSON.parse(meText);
    await redis.set('linkedin_tokens', JSON.stringify({
      access_token: tokenData.access_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      linkedin_sub: meData.id,
      linkedin_name: `${meData.localizedFirstName || ''} ${meData.localizedLastName || ''}`.trim() || 'LinkedIn User',
    }));

    return NextResponse.redirect(new URL('/?linkedin=connected', req.url));
  } catch (err) {
    console.error('LinkedIn callback uncaught error:', err);
    return NextResponse.redirect(new URL('/?linkedin=error', req.url));
  }
}
