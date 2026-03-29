import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getClient } from '@/app/lib/redis';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { content, source } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 });
    }

    const redis = getClient();
    const data = await redis.get('linkedin_tokens');
    if (!data) {
      return NextResponse.json({ error: 'LinkedIn not connected' }, { status: 401 });
    }

    const tokens = JSON.parse(data as string);

    if (Date.now() > tokens.expires_at) {
      return NextResponse.json({ error: 'LinkedIn token expired. Please reconnect.' }, { status: 401 });
    }

    // Build post text — append source URL if available
    const postText = source ? `${content}\n\n${source}` : content;

    // Create post using LinkedIn Posts API
    const postRes = await fetch('https://api.linkedin.com/v2/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: `urn:li:person:${tokens.linkedin_sub}`,
        commentary: postText,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
      }),
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      console.error('LinkedIn post failed:', err);
      return NextResponse.json({ error: 'Failed to post to LinkedIn' }, { status: 500 });
    }

    // Save to profile posts for future style analysis
    const profileData = await redis.get('profile');
    if (profileData) {
      const profile = JSON.parse(profileData as string);
      if (profile.posts) {
        profile.posts = `${content}\n\n---\n\n${profile.posts}`;
        await redis.set('profile', JSON.stringify(profile));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('LinkedIn post error:', error);
    return NextResponse.json({ error: 'Failed to post' }, { status: 500 });
  }
}
