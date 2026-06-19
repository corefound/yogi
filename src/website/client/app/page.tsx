import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'

const packages = [
  {
    name: 'http',
    slug: 'http',
    badge: 'Latest',
    desc: 'Lightweight, composable HTTP client for Node.js and the browser.',
    icon: '~',
    color: '',
    downloads: '1.28M',
    stars: '1.2k',
    version: 'v2.3.1',
  },
  {
    name: 'zod',
    slug: 'zod',
    badge: 'Latest',
    desc: 'TypeScript-first schema validation with static type inference.',
    icon: 'Z',
    color: 'purple',
    downloads: '912K',
    stars: '9.1k',
    version: 'v3.22.4',
  },
  {
    name: 'tailwindcss',
    slug: 'tailwindcss',
    badge: 'Latest',
    desc: 'Utility-first CSS framework for rapidly building custom designs.',
    icon: '~',
    color: '',
    downloads: '856K',
    stars: '21.4k',
    version: 'v3.4.3',
  },
  {
    name: 'drizzle-orm',
    slug: 'drizzle-orm',
    badge: 'Latest',
    desc: 'Performant ORM for TypeScript and SQL databases.',
    icon: 'M',
    color: 'dark',
    downloads: '643K',
    stars: '7.8k',
    version: 'v0.30.2',
  },
  {
    name: 'lucide',
    slug: 'lucide',
    badge: 'Latest',
    desc: 'Beautiful and consistent icon toolkit made by the community.',
    icon: '✧',
    color: 'dark',
    downloads: '531K',
    stars: '8.3k',
    version: 'v0.386.0',
  },
]

const categories = [
  { icon: '◎', name: 'Web', count: '8,923' },
  { icon: '✦', name: 'AI', count: '4,210' },
  { icon: '▻', name: 'CLI', count: '3,412' },
  { icon: '▤', name: 'Database', count: '2,984' },
  { icon: '⚒', name: 'DevTools', count: '3,812' },
  { icon: '◇', name: 'Security', count: '2,102' },
  { icon: '◫', name: 'UI', count: '4,623' },
  { icon: '▣', name: 'Mobile', count: '2,341' },
]

const orgs = [
  { icon: '▲', name: 'vercel', color: 'dark', packages: '124 packages', downloads: '12.8M downloads' },
  { icon: '⚡', name: 'supabase', color: 'green', packages: '89 packages', downloads: '8.4M downloads' },
  { icon: '◭', name: 'prisma', color: 'dark', packages: '54 packages', downloads: '6.4M downloads' },
  { icon: '⌁', name: 'sentry', color: 'red', packages: '67 packages', downloads: '5.6M downloads' },
  { icon: '◎', name: 'tauri-apps', color: 'gold', packages: '45 packages', downloads: '3.1M downloads' },
]

const statIcons = {
  "Total Packages": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  "Weekly Downloads": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  "Verified Organizations": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  "Package Updates": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

const rightSide = [
  { name: "Total Packages", value: "48,612", text: "Across all ecosystems", icon: "Total Packages" },
  { name: "Weekly Downloads", value: "12.8M", text: "By developers worldwide", icon: "Weekly Downloads" },
  { name: "Verified Organizations", value: "2,136", text: "Trusted teams and companies", icon: "Verified Organizations" },
  { name: "Package Updates", value: "2,984", text: "New versions this week", icon: "Package Updates" }
]

export default function Home() {
  return (
    <>
      <TopBar />

      <main>
        <section className="hero-explore container">
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">◈ Trusted by developers worldwide</div>
              <h1>
                Discover, install and publish <span>amazing</span> packages.
              </h1>
              <p>Yogi is a modern, secure and reliable package manager built for today's developers and their teams.</p>

              <label className="search-hero">
                <span style={{fontSize: 26}}>⌕</span>
                <input placeholder="Search packages..." />
              </label>

              <div className="hero-actions">
                <a className="btn primary" href="#trending">◉ Explore Packages</a>
                <a className="btn" href="#">⇧ Publish Package</a>
              </div>
            </div>

            <div className="hero-side">
              {rightSide.map((item) => (
                <div className="stat-card" key={item.name}>
                  <div className="top">
                    <span className="stat-icon">{statIcons[item.icon as keyof typeof statIcons]}</span>
                    <span>{item.name}</span>
                  </div>
                  <strong>{item.value}</strong>
                  <small>{item.text}</small>
                </div>
              ))}

              <div className="stat-card hero-side-wide">
                <div>
                  <div className="top">
                    <span className="stat-icon">♡</span>
                    <span>Built for developers, by developers.</span>
                  </div>
                </div>
                <div className="avatar-row">
                  <span className="mini-avatar"></span>
                  <span className="mini-avatar"></span>
                  <span className="mini-avatar"></span>
                  <span className="mini-avatar"></span>
                  <span className="mini-avatar"></span>
                  <span className="tag">+2.1k</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section container" id="trending">
          <div className="section-head">
            <div className="section-title">
              <span className="gradient-text">⌁</span>
              <h2>Trending Packages</h2>
              <small>Popular this week</small>
            </div>
            <a className="link-blue" href="/package">View all trending →</a>
          </div>
          <div className="card-grid">
            {packages.map((pkg) => (
              <a className="package-card" href={`/package/${pkg.slug}`} key={pkg.name}>
                <div className="pkg-top">
                  <span className={`pkg-icon ${pkg.color}`}>{pkg.icon}</span>
                  <div>
                    <div className="pkg-card-name">
                      {pkg.name} 
                      {/* <span className="badge">{pkg.badge}</span> */}
                    </div>
                  </div>
                </div>
                <p>{pkg.desc}</p>
                <div className="pkg-meta">
                  <span>⇩ {pkg.downloads}</span>
                  <span>☆ {pkg.stars}</span>
                  <span>{pkg.version}</span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="section container">
          <div className="explore-section-grid">
            <div>
              <div className="section-head">
                <div className="section-title">
                  <h2>Popular Categories</h2>
                  <small>Browse by category</small>
                </div>
                <a className="link-blue" href="#">View all →</a>
              </div>
              <div className="category-row" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
                {categories.map((cat) => (
                  <a className="category-card" href="#" key={cat.name}>
                    {cat.icon} {cat.name}
                    <span style={{ marginLeft: 'auto', color: 'var(--muted-2)' }}>{cat.count}</span>
                  </a>
                ))}
              </div>
            </div>

            <div>
              <div className="section-head">
                <div className="section-title">
                  <h2>Verified Organizations</h2>
                  <small>Trusted teams building the ecosystem</small>
                </div>
                <a className="link-blue" href="#">View all →</a>
              </div>
              <div className="org-grid">
                {orgs.map((org) => (
                  <a className="org-card" href="#" key={org.name}>
                    <div className={`org-logo ${org.color}`}>{org.icon}</div>
                    <strong>{org.name}</strong>
                    <p>
                      {org.packages}
                      <br />
                      {org.downloads}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section container">
          <div className="section-head">
            <div className="section-title">
              <h2>Why Yogi Registry?</h2>
              <small>Everything you need to build and ship with confidence.</small>
            </div>
          </div>
          <div className="feature-band">
            <div className="feature-item">
              <div className="stat-icon">◇</div>
              <h3>Secure by default</h3>
              <p>Every package is scanned for vulnerabilities and malicious code.</p>
            </div>
            <div className="feature-item">
              <div className="stat-icon">⚡</div>
              <h3>Fast & reliable</h3>
              <p>Global CDN, optimized installs and consistent uptime.</p>
            </div>
            <div className="feature-item">
              <div className="stat-icon">▤</div>
              <h3>Great documentation</h3>
              <p>Clear docs, examples and guides to help you move faster.</p>
            </div>
            <div className="feature-item">
              <div className="stat-icon">♙</div>
              <h3>Built for teams</h3>
              <p>Organization management, team access and audit logs.</p>
            </div>
            <div className="feature-item">
              <div className="stat-icon">◈</div>
              <h3>Open & extensible</h3>
              <p>Works with your favorite tools and CI/CD pipelines.</p>
            </div>
          </div>
        </section>

        <section className="section container">
          <div className="callout-card">
            <div>
              <h3>Publish your first package</h3>
              <p>Share your code with the world and start building your ecosystem.</p>
            </div>
            <a className="btn primary" href="#">Get Started Free</a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}