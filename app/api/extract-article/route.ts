import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

const MAX_CONTENT_CHARS = 8000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return NextResponse.json({ error: 'Only http/https URLs are supported' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PostCraftBot/1.0; +https://postcraft.app)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
    } catch {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Could not fetch the article (timeout or network error). Paste the text instead.' },
        { status: 502 }
      );
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Article fetch failed (${res.status}). Paste the text instead.` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) {
      return NextResponse.json(
        { error: 'URL did not return an HTML page. Paste the text instead.' },
        { status: 422 }
      );
    }

    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent || article.textContent.trim().length < 200) {
      return NextResponse.json(
        { error: 'Could not extract article content. Paste the text instead.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      title: article.title ?? '',
      byline: article.byline ?? '',
      siteName: article.siteName ?? '',
      content: article.textContent.trim().slice(0, MAX_CONTENT_CHARS),
    });
  } catch (error) {
    console.error('Article extraction error:', error);
    return NextResponse.json(
      { error: 'Could not read this article. Paste the text instead.' },
      { status: 502 }
    );
  }
}

export const maxDuration = 30;
