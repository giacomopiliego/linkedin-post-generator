import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/auth';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { posts, count = 3, focus } = await req.json();

    if (!posts?.trim()) {
      return NextResponse.json({ error: 'No profile posts provided' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const systemPrompt = `You are an expert LinkedIn ghostwriter and content strategist.

TODAY'S DATE: ${today}
ABSOLUTE CUTOFF DATE: ${cutoffDate} (7 days ago)

You will:
1. Analyse the user's existing LinkedIn posts to extract their unique writing voice, topic profile, tone, and stylistic patterns
2. Search the web for the most recent news that matches those topics — ONLY from the last 7 days (published on or after ${cutoffDate})
3. Draft high-quality LinkedIn posts in the user's exact voice

CRITICAL DATE RULES:
- ONLY use articles published within the last 7 days (on or after ${cutoffDate})
- When searching, add date filters like "after:${cutoffDate}" or "past week" to your searches
- VERIFY the publication date of every article before using it
- If an article has no clear publication date, DO NOT use it
- REJECT any article older than 7 days — no exceptions
- Include the article's publication date in the "publishedDate" field of your output
- Prefer articles from the last 72 hours over older ones within the 7-day window

STYLE ANALYSIS — extract from the user's posts:
- Narrative structure (how they open, build, and close)
- Sentence rhythm and length patterns
- Use of white space and line breaks
- Vocabulary register (technical, strategic, analytical)
- Perspective framing (first person observations, strategic insights)
- Tone (authoritative but reflective, constructively critical of hype)
- Topic clusters — infer from the user's actual posts, do not assume fixed topics

POST GENERATION RULES:
- Each post must be grounded in a SPECIFIC recent news article or development found via web search
- Match the user's exact stylistic DNA — do not use generic LinkedIn voice
- Do NOT use hashtags unless the user's posts consistently use them
- Include the article URL as the source field when available
- Posts should be 200–400 words, formatted with white space like the user's examples
- Each post must cover a DIFFERENT topic/article
- Do not repeat topics already covered in the user's existing posts
- Think critically, not just descriptively — add the user's analytical layer
- CRITICAL: Do NOT include any <cite>, </cite>, or citation markup tags in the post content. The post content must be clean, readable text only.
- When quoting or referencing specific facts from articles, use regular quotation marks ("") around the quoted text — never XML-style citation tags
- The source URL goes ONLY in the "source" JSON field, not inline in the post

OUTPUT FORMAT — respond with ONLY valid JSON, no other text:
{
  "posts": [
    {
      "content": "The full post text here",
      "articleTitle": "Short title of the source article",
      "source": "https://url-of-article.com",
      "publishedDate": "YYYY-MM-DD"
    }
  ]
}`;

    // Send only the most recent 10 posts to the AI for style analysis
    const postSeparator = '\n\n---\n\n';
    const allPosts = posts.split(postSeparator);
    const recentPosts = allPosts.slice(0, 10).join(postSeparator);

    const focusInstruction = focus
      ? `\n\nFOCUS DIRECTIVE: The user wants posts specifically about: "${focus}". Search for recent news SPECIFICALLY about this topic. All generated posts MUST be related to this focus area. Still write in the user's voice and style.`
      : '';

    const userMessage = `Today is ${today}.

Here are my most recent LinkedIn posts — analyse my writing style and topic profile from these:

---
${recentPosts}
---

Now search the web for the most recent news (published ONLY in the last 7 days, after ${cutoffDate}) that aligns with ${focus ? `the focus topic "${focus}"` : 'my topics'} but that I have NOT already posted about. Prioritize articles from the last 72 hours. VERIFY each article's publication date — reject anything older than 7 days.${focusInstruction}

Generate ${count} LinkedIn posts in my exact voice, each based on a different recent article. Include the publishedDate for each. Return only the JSON.`;

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = client.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            system: systemPrompt,
            tools: [
              {
                type: 'web_search_20250305',
                name: 'web_search',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any,
            ],
            messages: [{ role: 'user', content: userMessage }],
          });

          stream.on('text', (text) => {
            controller.enqueue(encoder.encode(text));
          });

          await stream.finalMessage();
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode('\n__STREAM_ERROR__'));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate posts. Check your API key and try again.' },
      { status: 500 }
    );
  }
}

export const maxDuration = 60;
