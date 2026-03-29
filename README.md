# PostCraft — LinkedIn Intelligence

A mobile-first web app that searches recent news matching your LinkedIn topic profile and generates posts in your exact voice.

## What it does

1. **Profile tab** — Paste your existing LinkedIn posts. Stored persistently.
2. **Generate tab** — Searches the last 72h of news for topics you cover, drafts posts in your voice.
3. **Drafts tab** — Review, edit, and copy posts to LinkedIn.

---

## Deploy to Vercel (free tier)

### 1. Push to GitHub
```bash
git init && git add . && git commit -m "init"
# Create a repo at github.com and push
```

### 2. Deploy
- Go to vercel.com/new → Import your repo → Deploy

### 3. Add environment variables (Vercel dashboard → Settings → Env Vars)
| Variable | Value |
|---|---|
| ANTHROPIC_API_KEY | Your key from console.anthropic.com |

### 4. (Optional) Persistent storage
- Vercel dashboard → Storage → Create KV Database → Connect to project
- This adds KV_REST_API_URL and KV_REST_API_TOKEN automatically

### 5. Add to iPhone home screen
- Open your Vercel URL in Safari → Share → Add to Home Screen

---

## Local dev
```bash
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY
npm run dev
```

## Cost
- Vercel free tier: sufficient for personal use
- Anthropic API: ~$0.02-0.08 per generation (3-5 posts)
