import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Link className="brand" href="/">
            <span className="logo" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none">
                <path d="M16 2.7 28 9.5v13L16 29.3 4 22.5v-13L16 2.7Z" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 8.4 22.8 12.2v7.6L16 23.6l-6.8-3.8v-7.6L16 8.4Z" stroke="currentColor" strokeWidth="1.8" opacity=".7" />
                <path d="M16 2.8v5.6M28 9.5l-5.2 2.7M4 9.5l5.2 2.7M16 23.6v5.5" stroke="currentColor" strokeWidth="1.8" opacity=".55" />
              </svg>
            </span>
            <span>Yogi Registry</span>
          </Link>
          <p>The modern package manager<br/>for developers and teams.</p>
          <div className="socials"><span>⌘</span><span>𝕏</span><span>◈</span></div>
        </div>
        <div>
          <h4>Product</h4>
          <Link href="/">Explore</Link>
          <Link href="/docs">Documentation</Link>
        </div>
        <div>
          <h4>Resources</h4>
          <Link href="/docs">Documentation</Link>
          <a href="#">API Reference</a>
          <a href="#">Changelog</a>
          <a href="#">Status</a>
        </div>
        <div>
          <h4>Community</h4>
          <a href="#">GitHub</a>
          <a href="#">Discussions</a>
          <a href="#">Blog</a>
          <a href="#">Contributing</a>
        </div>
        <div>
          <p>© 2026 Yogi Registry. All rights reserved.</p>
          <p><a href="#">Terms</a> <a href="#">Privacy</a> <a href="#">Security</a> <a href="#">Cookies</a></p>
          <p>◎ English</p>
        </div>
      </div>
    </footer>
  )
}