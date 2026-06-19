import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'

export default function DocsPage() {
  return (
    <>
      <TopBar />

      <main className="docs-page">
        <aside className="docs-sidebar">
          <div className="docs-group">
            <div className="docs-group-title">Getting Started</div>
            <a className="docs-link active" href="#">
              Introduction <span>•</span>
            </a>
            <a className="docs-link" href="#">
              Quickstart
            </a>
            <a className="docs-link" href="#">
              FAQ
            </a>
          </div>
          <div className="docs-group">
            <div className="docs-group-title">Guides</div>
            <a className="docs-link" href="#">
              Workspaces
            </a>
            <a className="docs-link" href="#">
              Dependencies
            </a>
            <a className="docs-link" href="#">
              Access Tokens
            </a>
            <a className="docs-link" href="#">
              CI/CD Integration
            </a>
          </div>
          <div className="docs-group">
            <div className="docs-group-title">CLI</div>
            <a className="docs-link" href="#">
              Overview
            </a>
            <a className="docs-link" href="#">
              Commands
            </a>
            <a className="docs-link" href="#">
              Configuration
            </a>
          </div>
          <div className="docs-group">
            <div className="docs-group-title">Publishing</div>
            <a className="docs-link" href="#">
              Publishing Packages
            </a>
            <a className="docs-link" href="#">
              Package Versions
            </a>
            <a className="docs-link" href="#">
              Dist-tags
            </a>
          </div>
          <div className="docs-group">
            <div className="docs-group-title">Packages</div>
            <a className="docs-link" href="#">
              Discover Packages
            </a>
            <a className="docs-link" href="#">
              Versioning
            </a>
            <a className="docs-link" href="#">
              Scopes
            </a>
          </div>
          <div className="docs-group">
            <div className="docs-group-title">Organizations</div>
            <a className="docs-link" href="#">
              Managing Organizations
            </a>
            <a className="docs-link" href="#">
              Teams & Members
            </a>
            <a className="docs-link" href="#">
              Roles & Permissions
            </a>
          </div>
          <a className="docs-link" href="#">
            Security
          </a>
          <a className="docs-link" href="#">
            API Reference
          </a>
          <a className="docs-link" href="#">
            Changelog
          </a>
          <div className="side-card" style={{ marginTop: 20 }}>
            <h3>Yogi CLI</h3>
            <p style={{ color: 'var(--muted)', margin: '0 0 12px' }}>
              The fastest way to work with Yogi Registry.
            </p>
            <a className="link-blue" href="#">
              View CLI Docs →
            </a>
          </div>
        </aside>

        <article className="docs-main">
          <div className="breadcrumb">
            Documentation <span>›</span> Getting Started <span>›</span> Introduction
          </div>
          <h1>Getting Started</h1>
          <p>
            Welcome to Yogi Registry. This guide helps you set up and start using
            the modern, secure package registry for your projects and teams.
          </p>

          <div className="doc-feature-grid">
            <div className="doc-tile">
              <span className="stat-icon">⬡</span>
              <h3>Private by default</h3>
              <p>Secure private packages with fine-grained access.</p>
            </div>
            <div className="doc-tile">
              <span className="stat-icon">⚡</span>
              <h3>Blazing fast</h3>
              <p>Global CDN and efficient package delivery.</p>
            </div>
            <div className="doc-tile">
              <span className="stat-icon">♙</span>
              <h3>Team ready</h3>
              <p>Organizations, roles, and collaboration built in.</p>
            </div>
            <div className="doc-tile">
              <span className="stat-icon">◇</span>
              <h3>Trusted & reliable</h3>
              <p>Immutable packages and audit-ready logs.</p>
            </div>
          </div>

          <section id="installation" className="docs-section">
            <h2>1. Installation</h2>
            <p>
              Install the Yogi CLI to interact with the registry from your
              terminal.
            </p>
            <div className="tabs">
              <button className="tab active">npm</button>
              <button className="tab">Homebrew</button>
              <button className="tab">Shell Script</button>
              <button className="tab">Windows</button>
            </div>
            <pre className="code-block" id="docs-install">
              <button className="copy-btn">Copy</button>
              <span className="prompt">$</span> npm i -g @yogi/cli
            </pre>
            <div className="note">
              ⓘ Note: Requires Node.js 16+ and an active Yogi Registry account.
            </div>
          </section>

          <section id="initialize" className="docs-section">
            <h2>2. Initialize a project</h2>
            <p>
              Initialize a new project and link it to your registry.
            </p>
            <pre className="code-block" id="docs-init">
              <button className="copy-btn">Copy</button>
              <span className="prompt">$</span> yogi init
              {'\n'}
              <span className="prompt">$</span> yogi add @scope/package
              {'\n'}
              <span className="prompt">$</span> yogi add @scope/another-package@latest
            </pre>
            <p>
              This creates a <span className="kbd">yogi.json</span> file in your
              project to manage dependencies and sources.
            </p>
          </section>

          <section id="publish" className="docs-section">
            <h2>3. Publish a package</h2>
            <p>Publish your package to share it with your team or the world.</p>
            <pre className="code-block" id="docs-publish">
              <button className="copy-btn">Copy</button>
              <span className="prompt">$</span> yogi publish
            </pre>
            <div className="note success">
              ✓ Your package is now live on Yogi Registry!{' '}
              <a className="link-blue" href="/package">
                View your package →
              </a>
            </div>
          </section>

          <section id="next" className="docs-section">
            <h2>4. Next steps</h2>
            <p>
              Dive deeper and customize Yogi Registry for your workflow.
            </p>
            <div className="next-grid">
              <a className="next-card" href="#">
                <div>
                  <strong>Explore CLI</strong>
                  <p>Learn all CLI commands and configuration options.</p>
                </div>
                <span>→</span>
              </a>
              <a className="next-card" href="#">
                <div>
                  <strong>Publishing Guide</strong>
                  <p>Best practices for publishing and versioning packages.</p>
                </div>
                <span>→</span>
              </a>
              <a className="next-card" href="#">
                <div>
                  <strong>API Reference</strong>
                  <p>Integrate Yogi Registry with your tools and platforms.</p>
                </div>
                <span>→</span>
              </a>
            </div>
          </section>
        </article>

        <aside className="docs-toc">
          <div className="toc-title">On this page</div>
          <a className="active" href="#">
            Overview
          </a>
          <a href="#installation">1. Installation</a>
          <a href="#initialize">2. Initialize a project</a>
          <a href="#publish">3. Publish a package</a>
          <a href="#next">4. Next steps</a>

          <div className="side-card quick-links">
            <h3>Quick links</h3>
            <a className="side-link" href="#">
              Yogi CLI Docs <span>↗</span>
            </a>
            <a className="side-link" href="#">
              Configuration <span>↗</span>
            </a>
            <a className="side-link" href="#">
              Publishing Guide <span>↗</span>
            </a>
            <a className="side-link" href="#">
              API Reference <span>↗</span>
            </a>
          </div>
        </aside>
      </main>

      <Footer />
    </>
  )
}