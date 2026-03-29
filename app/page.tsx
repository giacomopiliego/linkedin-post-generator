'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

type Tab = 'generate' | 'posts' | 'profile';
type Post = { id: string; content: string; source?: string; generatedAt: string };
type GeneratedPost = { content: string; source?: string; articleTitle?: string };

export default function Home() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>('generate');
  const [savedPosts, setSavedPosts] = useState<string>('');
  const [loadedPosts, setLoadedPosts] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [draftPosts, setDraftPosts] = useState<Post[]>([]);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<string>('');
  const [generateStatus, setGenerateStatus] = useState<string>('');
  const [postCount, setPostCount] = useState(3);

  useEffect(() => {
    if (status === 'authenticated') {
      loadProfile();
      loadDrafts();
    }
  }, [status]);

  async function loadProfile() {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.posts) {
        setLoadedPosts(data.posts);
        setSavedPosts(data.posts);
        setProfileStatus('Profile loaded.');
      }
    } catch {}
  }

  async function loadDrafts() {
    try {
      const res = await fetch('/api/drafts');
      const data = await res.json();
      if (data.drafts) setDraftPosts(data.drafts);
    } catch {}
  }

  async function saveProfile() {
    if (!savedPosts.trim()) return;
    setIsSavingProfile(true);
    setProfileStatus('Saving...');
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: savedPosts }),
      });
      setLoadedPosts(savedPosts);
      setProfileStatus('✓ Profile saved successfully.');
    } catch {
      setProfileStatus('Error saving profile.');
    }
    setIsSavingProfile(false);
  }

  async function generate() {
    if (!loadedPosts.trim()) {
      setGenerateStatus('Please save your LinkedIn posts in the Profile tab first.');
      return;
    }
    setIsGenerating(true);
    setGeneratedPosts([]);
    setGenerateStatus('Searching recent news and generating posts...');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: loadedPosts, count: postCount }),
      });
      const data = await res.json();
      if (data.posts) {
        setGeneratedPosts(data.posts);
        setGenerateStatus('');
      } else {
        setGenerateStatus(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setGenerateStatus('Error generating posts.');
    }
    setIsGenerating(false);
  }

  async function saveDraft(post: GeneratedPost, index: number) {
    const newDraft: Post = {
      id: Date.now().toString(),
      content: post.content,
      source: post.source,
      generatedAt: new Date().toISOString(),
    };
    const updated = [newDraft, ...draftPosts];
    setDraftPosts(updated);
    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drafts: updated }),
    });
    if (res.ok) {
      setSavedId(`gen-${index}`);
      setTimeout(() => setSavedId(null), 2000);
    }
  }

  async function updateDraft(post: Post) {
    const updated = draftPosts.map(p => p.id === post.id ? post : p);
    setDraftPosts(updated);
    setEditingPost(null);
    await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drafts: updated }),
    });
  }

  async function deleteDraft(id: string) {
    const updated = draftPosts.filter(p => p.id !== id);
    setDraftPosts(updated);
    await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drafts: updated }),
    });
  }

  function copyPost(text: string, id: string, source?: string) {
    const fullText = source ? `${text}\n\n${source}` : text;
    navigator.clipboard.writeText(fullText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (status === 'loading') {
    return (
      <div className="app-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
          <span className="spinner" style={{ width: 32, height: 32, border: '3px solid #e0ddd7', borderTopColor: '#1a1a2e' }} />
        </div>
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          html,body{background:#faf9f7;font-family:sans-serif;min-height:100dvh}
          .app-shell{max-width:480px;margin:0 auto}
          .spinner{border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block}
          @keyframes spin{to{transform:rotate(360deg)}}
        `}</style>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-shell">
        <div className="login-screen">
          <div className="login-card">
            <div className="logo-mark" style={{ width: 56, height: 56, fontSize: 20, margin: '0 auto 20px' }}>GP</div>
            <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 28, fontWeight: 400, marginBottom: 8 }}>PostCraft</h1>
            <p style={{ color: '#6b6760', fontSize: 14, marginBottom: 32 }}>Sign in to access your LinkedIn post generator</p>
            <button className="primary-btn" onClick={() => signIn('google')} style={{ maxWidth: 300 }}>
              Sign in with Google
            </button>
          </div>
        </div>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          html,body{background:#faf9f7;font-family:'DM Sans',sans-serif;min-height:100dvh}
          .app-shell{max-width:480px;margin:0 auto}
          .login-screen{display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:24px}
          .login-card{text-align:center}
          .logo-mark{width:56px;height:56px;background:#c9a84c;color:#1a1a2e;border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:'DM Serif Display',serif;font-size:20px}
          .primary-btn{width:100%;padding:16px;background:#1a1a2e;color:#fff;border:none;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;cursor:pointer}
        `}</style>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo-mark">GP</div>
          <h1 className="app-title">PostCraft</h1>
          <button className="sign-out-btn" onClick={() => signOut()} title="Sign out">
            {session.user?.image ? (
              <img src={session.user.image} alt="" className="avatar" />
            ) : (
              <span>Sign out</span>
            )}
          </button>
        </div>
      </header>

      <main className="app-main">
        {tab === 'generate' && (
          <div className="tab-content">
            <div className="section-label">GENERATE</div>
            <p className="section-desc">
              Searches the last 72 hours of news matching your topic profile and drafts posts in your voice.
            </p>

            <div className="count-row">
              <span className="count-label">Posts to generate</span>
              <div className="count-controls">
                {[2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    className={`count-btn${postCount === n ? ' active' : ''}`}
                    onClick={() => setPostCount(n)}
                  >{n}</button>
                ))}
              </div>
            </div>

            <button
              className="primary-btn"
              onClick={generate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <span className="btn-inner"><span className="spinner" /> Searching &amp; writing...</span>
              ) : (
                <span className="btn-inner">↗ Generate posts</span>
              )}
            </button>

            {generateStatus && (
              <div className={`status-msg ${generateStatus.includes('Error') || generateStatus.includes('Please') ? 'status-error' : 'status-info'}`}>
                {generateStatus}
              </div>
            )}

            {generatedPosts.length > 0 && (
              <div className="results-section">
                <div className="results-header">
                  {generatedPosts.length} posts generated
                </div>
                {generatedPosts.map((post, i) => (
                  <div key={i} className="post-card post-card-generated">
                    {post.articleTitle && (
                      post.source ? (
                        <a href={post.source} target="_blank" rel="noopener noreferrer" className="post-source-tag" style={{ textDecoration: 'none' }}>↗ {post.articleTitle}</a>
                      ) : (
                        <div className="post-source-tag">↗ {post.articleTitle}</div>
                      )
                    )}
                    <div className="post-body">{post.content}</div>
                    {post.source && (
                      <a href={post.source} target="_blank" rel="noopener noreferrer" className="post-link">
                        {post.source}
                      </a>
                    )}
                    <div className="post-actions">
                      <button className="action-btn action-copy" onClick={() => copyPost(post.content, `gen-${i}`, post.source)}>
                        {copiedId === `gen-${i}` ? '✓ Copied' : 'Copy'}
                      </button>
                      <button className="action-btn action-save" onClick={() => saveDraft(post, i)}>
                        {savedId === `gen-${i}` ? '✓ Saved' : 'Save draft'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'posts' && (
          <div className="tab-content">
            <div className="section-label">DRAFTS</div>
            <p className="section-desc">Your saved posts. Edit before copying to LinkedIn.</p>

            {draftPosts.length === 0 ? (
              <div className="empty-state">
                No drafts yet. Generate posts and save the ones you like.
              </div>
            ) : (
              draftPosts.map(post => (
                <div key={post.id} className="post-card post-card-draft">
                  {editingPost?.id === post.id ? (
                    <div className="edit-mode">
                      <textarea
                        className="edit-textarea"
                        value={editingPost.content}
                        onChange={e => setEditingPost({ ...editingPost, content: e.target.value })}
                        rows={10}
                      />
                      <div className="post-actions">
                        <button className="action-btn action-save" onClick={() => updateDraft(editingPost)}>Save</button>
                        <button className="action-btn action-edit" onClick={() => setEditingPost(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="post-date">
                        {new Date(post.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="post-body">{post.content}</div>
                      {post.source && (
                        <a href={post.source} target="_blank" rel="noopener noreferrer" className="post-link">{post.source}</a>
                      )}
                      <div className="post-actions">
                        <button className="action-btn action-copy" onClick={() => copyPost(post.content, post.id, post.source)}>
                          {copiedId === post.id ? '✓ Copied' : 'Copy'}
                        </button>
                        <button className="action-btn action-edit" onClick={() => setEditingPost(post)}>Edit</button>
                        <button className="action-btn action-delete" onClick={() => deleteDraft(post.id)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div className="tab-content">
            <div className="section-label">YOUR PROFILE</div>
            <p className="section-desc">
              Paste your recent LinkedIn posts below. The app analyses your writing style, topics, and tone to generate posts that sound like you.
            </p>
            <textarea
              className="profile-textarea"
              value={savedPosts}
              onChange={e => setSavedPosts(e.target.value)}
              placeholder="Paste your LinkedIn posts here, separated by blank lines or dashes..."
              rows={14}
            />
            <button
              className="primary-btn"
              onClick={saveProfile}
              disabled={isSavingProfile || !savedPosts.trim()}
            >
              {isSavingProfile ? 'Saving...' : 'Save profile'}
            </button>
            {profileStatus && (
              <div className={`status-msg ${profileStatus.includes('Error') ? 'status-error' : 'status-success'}`}>
                {profileStatus}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="bottom-nav">
        {([
          { id: 'generate', label: 'Generate', icon: '✦' },
          { id: 'posts', label: 'Drafts', icon: '◈' },
          { id: 'profile', label: 'Profile', icon: '◎' },
        ] as { id: Tab; label: string; icon: string }[]).map(t => (
          <button
            key={t.id}
            className={`nav-btn${tab === t.id ? ' nav-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --ink:#0f0f0f;--paper:#faf9f7;--cream:#f2f0eb;--accent:#1a1a2e;
          --gold:#c9a84c;--gold-light:#f0e4c0;--muted:#6b6760;--border:#e0ddd7;
          --success:#2d6a4f;--error:#c0392b;--radius:12px;
        }
        html,body{background:var(--paper);color:var(--ink);font-family:'DM Sans',sans-serif;font-size:16px;line-height:1.6;min-height:100dvh;-webkit-font-smoothing:antialiased}
        .app-shell{display:flex;flex-direction:column;min-height:100dvh;max-width:480px;margin:0 auto;background:var(--paper)}
        .app-header{background:var(--accent);padding:20px 24px 16px;position:sticky;top:0;z-index:10}
        .header-inner{display:flex;align-items:center;gap:12px}
        .logo-mark{width:36px;height:36px;background:var(--gold);color:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'DM Serif Display',serif;font-size:14px;flex-shrink:0}
        .app-title{font-family:'DM Serif Display',serif;font-size:22px;color:#fff;font-weight:400;letter-spacing:-0.3px}
        .sign-out-btn{margin-left:auto;background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center}
        .avatar{width:32px;height:32px;border-radius:50%;border:2px solid var(--gold)}
        .app-main{flex:1;overflow-y:auto;padding:24px 20px 100px}
        .tab-content{display:flex;flex-direction:column;gap:16px}
        .section-label{font-size:11px;letter-spacing:2px;color:var(--gold);font-weight:600}
        .section-desc{font-size:14px;color:var(--muted);line-height:1.5}
        .count-row{display:flex;align-items:center;justify-content:space-between;background:var(--cream);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px}
        .count-label{font-size:14px;color:var(--ink);font-weight:500}
        .count-controls{display:flex;gap:6px}
        .count-btn{width:36px;height:36px;border-radius:8px;border:1.5px solid var(--border);background:var(--paper);color:var(--muted);font-size:14px;font-weight:500;cursor:pointer;transition:all 0.15s}
        .count-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}
        .primary-btn{width:100%;padding:16px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius);font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;cursor:pointer;transition:opacity 0.15s,transform 0.1s;letter-spacing:0.2px}
        .primary-btn:disabled{opacity:0.5;cursor:not-allowed}
        .primary-btn:active:not(:disabled){transform:scale(0.98)}
        .btn-inner{display:flex;align-items:center;justify-content:center;gap:8px}
        .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        .status-msg{padding:12px 16px;border-radius:var(--radius);font-size:14px;line-height:1.4}
        .status-info{background:var(--gold-light);color:#7a6030;border:1px solid #e8d49a}
        .status-error{background:#fdf0ef;color:var(--error);border:1px solid #f5c6c2}
        .status-success{background:#edf7f2;color:var(--success);border:1px solid #b7dfc8}
        .results-section{display:flex;flex-direction:column;gap:16px}
        .results-header{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);font-weight:600;padding-top:4px}
        .post-card{background:var(--cream);border:1px solid var(--border);border-radius:var(--radius);padding:18px;display:flex;flex-direction:column;gap:12px}
        .post-card-generated{border-left:3px solid var(--gold)}
        .post-card-draft{border-left:3px solid var(--accent)}
        .post-source-tag{font-size:11px;color:var(--gold);font-weight:600;letter-spacing:0.5px;text-transform:uppercase}
        .post-date{font-size:11px;color:var(--muted);letter-spacing:0.5px}
        .post-body{font-size:14px;line-height:1.65;color:var(--ink);white-space:pre-wrap;word-break:break-word}
        .post-link{font-size:12px;color:var(--gold);text-decoration:none;font-weight:600;letter-spacing:0.3px;word-break:break-all}
        .post-actions{display:flex;gap:8px;flex-wrap:wrap}
        .action-btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid;font-family:'DM Sans',sans-serif;transition:all 0.15s}
        .action-btn:active{transform:scale(0.96)}
        .action-copy{background:var(--accent);color:#fff;border-color:var(--accent)}
        .action-save{background:transparent;color:var(--accent);border-color:var(--accent)}
        .action-edit{background:transparent;color:var(--muted);border-color:var(--border)}
        .action-delete{background:transparent;color:var(--error);border-color:#f5c6c2}
        .edit-textarea{width:100%;background:var(--paper);border:1.5px solid var(--border);border-radius:8px;padding:12px;font-family:'DM Sans',sans-serif;font-size:14px;line-height:1.65;color:var(--ink);resize:vertical}
        .edit-textarea:focus{outline:none;border-color:var(--accent)}
        .profile-textarea{width:100%;background:var(--cream);border:1.5px solid var(--border);border-radius:var(--radius);padding:16px;font-family:'DM Sans',sans-serif;font-size:14px;line-height:1.65;color:var(--ink);resize:vertical;min-height:280px}
        .profile-textarea:focus{outline:none;border-color:var(--accent)}
        .empty-state{text-align:center;color:var(--muted);font-size:14px;padding:48px 24px;background:var(--cream);border-radius:var(--radius);border:1px dashed var(--border)}
        .bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:rgba(250,249,247,0.95);backdrop-filter:blur(12px);border-top:1px solid var(--border);display:flex;padding:8px 0 env(safe-area-inset-bottom,8px);z-index:20}
        .nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;background:none;border:none;cursor:pointer;color:var(--muted);transition:color 0.15s}
        .nav-active{color:var(--accent)}
        .nav-icon{font-size:18px;line-height:1;transition:transform 0.15s}
        .nav-active .nav-icon{transform:scale(1.15)}
        .nav-label{font-size:11px;font-weight:600;letter-spacing:0.5px;font-family:'DM Sans',sans-serif}
      `}</style>
    </div>
  );
}
