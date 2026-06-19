'use client'

import { useState } from 'react'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'

type InstallTab = 'install' | 'usage' | 'cdn'
type ContentTab = 'readme' | 'versions' | 'dependencies' | 'dependents' | 'security'

export default function PackageSlugPage() {
  const [installTab, setInstallTab] = useState<InstallTab>('install')
  const [contentTab, setContentTab] = useState<ContentTab>('readme')

  return (
    <>
      <TopBar />

      <main className="page-shell container">
        <div className="breadcrumb">
          Packages <span>›</span> @core <span>›</span> http
        </div>

        <section className="package-hero">
          <div className="package-title-row">
            <div className="big-package-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div>
              <h1>
                @core/http <span className="badge">v2.3.1</span>
              </h1>
              <p>Lightweight, composable HTTP client for Node.js and the browser.</p>
              <div className="hero-meta">
                <span>@core</span>
                <span className="badge">Maintainer</span>
                <span>⇩ 1.28M weekly downloads</span>
              </div>
            </div>
          </div>
          <div className="actions-row">
            <button className="btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Star 1.2k
            </button>
            <button className="btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Follow 230
            </button>
            <button className="btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
          </div>
        </section>

        <section className="install-panel">
          <div className="tabs">
            <button
              className={`tab ${installTab === 'install' ? 'active' : ''}`}
              onClick={() => setInstallTab('install')}
            >
              Install
            </button>
            <button
              className={`tab ${installTab === 'usage' ? 'active' : ''}`}
              onClick={() => setInstallTab('usage')}
            >
              Usage
            </button>
            <button
              className={`tab ${installTab === 'cdn' ? 'active' : ''}`}
              onClick={() => setInstallTab('cdn')}
            >
              CDN
            </button>
          </div>

          {installTab === 'install' && (
            <div className="code-line" id="install-command">
              <span className="prompt">$</span>&nbsp; yogi add @core/http
              <button className="copy-btn">Copy</button>
            </div>
          )}

          {installTab === 'usage' && (
            <div className="code-line" id="usage-command">
              <span className="prompt">$</span>&nbsp; import {'{ request }'} from {'@core/http'};
              <button className="copy-btn">Copy</button>
            </div>
          )}

          {installTab === 'cdn' && (
            <div className="code-line" id="cdn-command">
              <span className="prompt">$</span>&nbsp; {'<script src="https://cdn.yogi.dev/@core/http"></script>'}
              <button className="copy-btn">Copy</button>
            </div>
          )}

          <p style={{ color: 'var(--muted)', margin: '12px 0 0' }}>
            Supports Node.js 16+ · ESM & CommonJS
          </p>
        </section>

        <div className="package-layout">
          <section>
            <div className="content-tabs">
              <button
                className={`${contentTab === 'readme' ? 'active' : ''}`}
                onClick={() => setContentTab('readme')}
              >
                README
              </button>
              <button
                className={`${contentTab === 'versions' ? 'active' : ''}`}
                onClick={() => setContentTab('versions')}
              >
                Versions <span className="badge">36</span>
              </button>
              <button
                className={`${contentTab === 'dependencies' ? 'active' : ''}`}
                onClick={() => setContentTab('dependencies')}
              >
                Dependencies <span className="badge">12</span>
              </button>
              <button
                className={`${contentTab === 'dependents' ? 'active' : ''}`}
                onClick={() => setContentTab('dependents')}
              >
                Dependents <span className="badge">812</span>
              </button>
              <button
                className={`${contentTab === 'security' ? 'active' : ''}`}
                onClick={() => setContentTab('security')}
              >
                Security
              </button>
            </div>

            <div className="metrics">
              <div className="metric">
                <small>Weekly Downloads</small>
                <strong>1.28M</strong>
                <div className="spark"></div>
              </div>
              <div className="metric">
                <small>Total Downloads</small>
                <strong>48.6M</strong>
              </div>
              <div className="metric">
                <small>Current Version</small>
                <strong>2.3.1</strong>
              </div>
              <div className="metric">
                <small>License</small>
                <strong>MIT</strong>
              </div>
              <div className="metric">
                <small>Last Published</small>
                <strong>2 days ago</strong>
              </div>
              <div className="metric">
                <small>Package Size</small>
                <strong>42.6 kB</strong>
              </div>
            </div>

            {contentTab === 'readme' && (
              <article className="readme-card">
                <h2>
                  @core/http <span className="badge">build passing</span>
                </h2>
                <p style={{ color: 'var(--muted)' }}>
                  A tiny, composable HTTP client that works everywhere.
                </p>
                <h3>✨ Features</h3>
                <div className="feature-list">
                  <div>✓ Small and fast — zero dependencies, tree-shakable.</div>
                  <div>✓ Works in Node.js, Deno, Bun, and modern browsers.</div>
                  <div>✓ Promise-based API with async/await support.</div>
                  <div>✓ Interceptors, retries, timeouts, and cancellation.</div>
                  <div>✓ TypeScript-first with smart inference.</div>
                </div>
                <pre className="code-block" id="readme-example">
                  <button className="copy-btn">Copy</button>
                  <span className="prompt">import </span>
                  {'{ request }'} from {'@core/http'};
                  {'\n'}
                  <span className="prompt">const </span>res = await request({'https://api.yogi.dev/v1/users'}, {'{\n  method: '}'GET'{',\n  headers: {\n    Authorization: `Bearer ${token}`,\n  },\n});'}
                  {'\n'}
                  {'const data = await res.json();'}
                </pre>
              </article>
            )}

            {contentTab === 'versions' && (
              <article className="readme-card">
                <h2>Versions (36)</h2>
                <p style={{ color: 'var(--muted)' }}>
                  All published versions of @core/http
                </p>
                <div className="feature-list">
                  <div><strong>v2.3.1</strong> — Latest (2 days ago)</div>
                  <div><strong>v2.3.0</strong> — 2 weeks ago</div>
                  <div><strong>v2.2.4</strong> — 1 month ago</div>
                  <div><strong>v2.2.3</strong> — 1 month ago</div>
                  <div><strong>v2.2.2</strong> — 2 months ago</div>
                </div>
              </article>
            )}

            {contentTab === 'dependencies' && (
              <article className="readme-card">
                <h2>Dependencies (12)</h2>
                <p style={{ color: 'var(--muted)' }}>
                  Runtime dependencies of @core/http
                </p>
                <div className="feature-list">
                  <div>✓ <strong>node-fetch</strong> v3.3.2</div>
                  <div>✓ <strong>form-data</strong> v4.3.0</div>
                  <div>✓ <strong>type-fest</strong> v4.3.1</div>
                  <div>✓ <strong>zod</strong> v3.22.4</div>
                  <div>✓ <strong>events</strong> v3.3.0</div>
                </div>
              </article>
            )}

            {contentTab === 'dependents' && (
              <article className="readme-card">
                <h2>Dependents (812)</h2>
                <p style={{ color: 'var(--muted)' }}>
                  Packages that depend on @core/http
                </p>
                <div className="feature-list">
                  <div>✓ <strong>@core/cli</strong> v1.2.0</div>
                  <div>✓ <strong>yogi-deploy</strong> v0.5.1</div>
                  <div>✓ <strong>@acme/api-client</strong> v3.1.0</div>
                  <div>✓ <strong>next-yogi</strong> v2.0.3</div>
                  <div>✓ <strong>@vercel/yogi</strong> v1.0.0</div>
                </div>
              </article>
            )}

            {contentTab === 'security' && (
              <article className="readme-card">
                <h2>Security</h2>
                <p style={{ color: 'var(--muted)' }}>
                  No known vulnerabilities
                </p>
                <div className="note" style={{ marginTop: 12 }}>
                  ✓ This package has no known security issues. Last scanned 2 days ago.
                </div>
              </article>
            )}
          </section>

          <aside>
            <div className="side-card">
              <h3>Package links</h3>
              <a className="side-link" href="https://github.com/core/http" target="_blank" rel="noopener noreferrer">
                Repository <span>github.com/core/http ›</span>
              </a>
              <a className="side-link" href="https://core.dev/http" target="_blank" rel="noopener noreferrer">
                Homepage <span>core.dev/http ›</span>
              </a>
              <a className="side-link" href="https://docs.core.dev/http" target="_blank" rel="noopener noreferrer">
                Documentation <span>docs.core.dev/http ›</span>
              </a>
            </div>
            <div className="side-card">
              <h3>Keywords</h3>
              <div className="tags">
                <span className="tag">http</span>
                <span className="tag">client</span>
                <span className="tag">fetch</span>
                <span className="tag">promise</span>
                <span className="tag">browser</span>
                <span className="tag">node</span>
                <span className="tag">typescript</span>
                <span className="tag">isomorphic</span>
              </div>
            </div>
            <div className="side-card">
              <h3>Maintainers</h3>
              <div className="maintainers">
                <span className="mini-avatar"></span>
                <span className="mini-avatar"></span>
                <span className="mini-avatar"></span>
                <span className="mini-avatar"></span>
                <span className="tag">+3</span>
              </div>
            </div>
            <div className="side-card">
              <h3>Publish activity</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                2 days ago
                <br />
                Version 2.3.1
              </p>
              <a className="link-blue" href="#">
                View full history →
              </a>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </>
  )
}