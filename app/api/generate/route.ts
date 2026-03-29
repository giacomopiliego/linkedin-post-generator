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
    const { posts, count = 3 } = await req.json();

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

    const userMessage = `Today is ${today}.

Here are my existing LinkedIn posts — analyse my writing style and topic profile from these:

---
${posts}
---

Now search the web for the most recent news (published ONLY in the last 7 days, after ${cutoffDate}) that aligns with my topics but that I have NOT already posted about. Prioritize articles from the last 72 hours. VERIFY each article's publication date — reject anything older than 7 days.

Generate ${count} LinkedIn posts in my exact voice, each based on a different recent article. Include the publishedDate for each. Return only the JSON.`;

    // Use web search tool to find recent news
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        } as Parameters<typeof client.messages.create>[0]['tools'] extends Array<infer T> ? T : never,
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    // Extract the final text response
    let finalText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        finalText += block.text;
      }
    }

    // Handle multi-turn if tool use required it
    if (response.stop_reason === 'tool_use') {
      // Continue conversation with tool results handled by Anthropic internally
      // For web_search, the model handles it natively — just extract text blocks
      const allMessages: Anthropic.MessageParam[] = [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: response.content },
      ];

      // Add tool results and continue
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(b => ({
        type: 'tool_result' as const,
        tool_use_id: (b as Anthropic.ToolUseBlock).id,
        content: 'Search completed.',
      }));

      allMessages.push({ role: 'user', content: toolResults });

      const followUp = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
          } as Parameters<typeof client.messages.create>[0]['tools'] extends Array<infer T> ? T : never,
        ],
        messages: allMessages,
      });

      finalText = followUp.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('');
    }

    // Parse JSON from response
    const jsonMatch = finalText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse generated posts' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Strip any <cite> tags and filter out stale posts
    if (parsed.posts && Array.isArray(parsed.posts)) {
      const cutoff = new Date(cutoffDate).getTime();

      parsed.posts = parsed.posts.filter((post: { content?: string; publishedDate?: string }) => {
        // Strip cite tags
        if (post.content) {
          post.content = post.content.replace(/<\/?cite[^>]*>/g, '');
        }

        // Filter out posts with articles older than 7 days
        if (post.publishedDate) {
          const articleDate = new Date(post.publishedDate).getTime();
          if (articleDate < cutoff) {
            console.log('Filtered out stale article from', post.publishedDate);
            return false;
          }
        }
        return true;
      });

      if (parsed.posts.length === 0) {
        return NextResponse.json({
          error: 'No recent enough articles found (within 7 days). Try again later.',
        }, { status: 200 });
      }
    }

    return NextResponse.json(parsed);

  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate posts. Check your API key and try again.' },
      { status: 500 }
    );
  }
}

export const maxDuration = 60;
