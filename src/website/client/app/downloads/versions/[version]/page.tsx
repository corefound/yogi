'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { FaLinux } from 'react-icons/fa'
import { releases, detectOSArch, detectPlatform, osMeta, osIcon, formatDate, type Platform } from '@/lib/downloads-data'

function CopyCmd({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [cmd])

  return (
    <div className="dl-copy-cmd">
      <span className="dl-terminal-dot" />
      <span className="dl-terminal-dot" />
      <span className="dl-terminal-dot" />
      <code>$ {cmd}</code>
      <span className="dl-copy-btn" onClick={copy} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && copy()}>
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </span>
    </div>
  )
}

function LinuxInstallCmd({ version }: { version: string }) {
  const cmd = `curl -fsSL https://yogi.dev/install.sh | sh -s -- --version v${version}`
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [cmd])

  return (
    <div className="version-linux-cmd">
      <div className="version-linux-header">
        <FaLinux size={13} />
        <span>Linux install script</span>
      </div>
      <div className="dl-copy-cmd">
        <span className="dl-terminal-dot" />
        <span className="dl-terminal-dot" />
        <span className="dl-terminal-dot" />
        <code>$ {cmd}</code>
        <span className="dl-copy-btn" onClick={copy} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && copy()}>
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </span>
      </div>
      <p className="version-linux-note">
        Auto-detects your distro and architecture.
      </p>
    </div>
  )
}

export default function VersionDetailPage() {
  const params = useParams()
  const versionParam = (params.version as string).replace(/^v/, '')
  const release = releases.find(r => r.version === versionParam)

  const [detected, setDetected] = useState<{
    os: string
    arch: string
    label: string
    size: string
    url: string
  } | null>(null)

  useEffect(() => {
    if (!release) return
    detectOSArch().then((result) => {
      const p = detectPlatform(result, release.platforms)
      setDetected(p || null)
    })
  }, [release])

  if (!release) {
    return (
      <>
        <TopBar />
        <main className="downloads-page">
          <section className="dl-hero" style={{ padding: '60px 24px 50px' }}>
            <div className="dl-hero-bg" />
            <div className="dl-hero-content">
              <h1>Version not found</h1>
              <p>v{versionParam} is not a valid release.</p>
              <Link className="link-blue" href="/downloads/versions">
                ← Browse all versions
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </>
    )
  }

  const otherVersions = releases.filter(r => r.version !== versionParam).slice(0, 3)

  return (
    <>
      <TopBar />
      <main className="downloads-page">
        <section className="dl-hero">
          <div className="dl-hero-bg" />
          <div className="dl-hero-content">
            <div className="dl-hero-badge">
              v{release.version}
              {release.latest && ' · Latest Release'}
              {release.prerelease && ' · Pre-release'}
            </div>
            <h1>Download <span className="dl-hero-highlight">Yogi v{release.version}</span></h1>
            <p>Released {formatDate(release.date)} — The modern package manager for TypeScript and JavaScript ecosystems.</p>

            {detected?.os === 'Linux' ? (
              <div className="dl-hero-term">
                <CopyCmd cmd={`curl -fsSL https://yogi.dev/install.sh | sh -s -- --version v${release.version}`} />
                <CopyCmd cmd={`wget -qO- https://yogi.dev/install.sh | sh -s -- --version v${release.version}`} />
              </div>
            ) : detected ? (
              <a className="dl-hero-cta" href={detected.url}>
                <span className="dl-hero-cta-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </span>
                <span className="dl-hero-cta-text">
                  Download v{release.version} for <strong>{detected.os} ({detected.label})</strong>
                </span>
                <span className="dl-hero-cta-size">{detected.size}</span>
              </a>
            ) : (
              <a className="dl-hero-cta" href="#">
                <span className="dl-hero-cta-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </span>
                <span className="dl-hero-cta-text">
                  Download v{release.version}
                </span>
              </a>
            )}

            <div className="dl-hero-alts">
              <span>Other versions:</span>
              {otherVersions.map((r) => (
                <Link key={r.version} className="dl-versions-link" href={`/downloads/versions/v${r.version}`}>
                  v{r.version}
                </Link>
              ))}
              <Link className="dl-versions-link" href="/downloads/versions">
                All versions →
              </Link>
            </div>

            <div className="dl-hero-stats">
              <div className="dl-hero-stat">
                <strong>{release.platforms.length}</strong>
                <span>Platforms</span>
              </div>
              <div className="dl-hero-stat">
                <strong>{releases.length}</strong>
                <span>Releases</span>
              </div>
              <div className="dl-hero-stat">
                <strong>100%</strong>
                <span>Open Source</span>
              </div>
            </div>
          </div>
        </section>

        <section className="dl-section">
          <div className="dl-container">
            <div className="dl-section-header">
              <h2>Platforms for v{release.version}</h2>
              <p>Choose your operating system and architecture.</p>
            </div>

            <div className="dl-platforms">
              {['macOS', 'Windows'].map((os) => {
                const items = release.platforms.filter(p => p.os === os)
                const meta = osMeta[os]
                const isCurrent = detected?.os === os
                return (
                  <div key={os} className={`dl-group${isCurrent ? ' dl-group-current' : ''}`}>
                    <div className="dl-group-header">
                      <div className="dl-group-icon" style={{ background: meta.color }}>
                        {meta.icon}
                      </div>
                      <div className="dl-group-info">
                        <h3>{os}</h3>
                        <span className="dl-group-desc">{meta.desc}</span>
                      </div>
                      {isCurrent && <span className="dl-group-tag">Detected</span>}
                    </div>
                    <div className="dl-card-grid">
                      {items.map((p) => {
                        const isMatch = detected?.arch === p.arch
                        return (
                          <a key={`${p.os}-${p.arch}-${p.label}`} className={`dl-card${isMatch ? ' dl-card-active' : ''}`} href={p.url}>
                            {isMatch && (
                              <span className="dl-card-recommend">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Recommended
                              </span>
                            )}
                            <div className="dl-card-arch-badge">{p.arch}</div>
                            <div className="dl-card-body">
                              <span className="dl-card-label">{p.label}</span>
                              <span className="dl-card-size">{p.size}</span>
                            </div>
                            <span className="dl-card-btn">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            </span>
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              <div className="dl-group">
                <div className="dl-group-header">
                  <div className="dl-group-icon" style={{ background: osMeta['Linux'].color }}>
                    <FaLinux />
                  </div>
                  <div className="dl-group-info">
                    <h3>Linux</h3>
                    <span className="dl-group-desc">Install via script for v{release.version}</span>
                  </div>
                </div>
                <div className="dl-linux-install">
                  <div className="dl-linux-install-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                    Install via script
                  </div>
                  <CopyCmd cmd={`curl -fsSL https://yogi.dev/install.sh | sh -s -- --version v${release.version}`} />
                  <CopyCmd cmd={`wget -qO- https://yogi.dev/install.sh | sh -s -- --version v${release.version}`} />
                  <p className="dl-linux-install-note">
                    Auto-detects your distro and architecture. No manual selection needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="dl-section dl-section-alt">
          <div className="dl-container">
            <div className="dl-section-header">
              <h2>All versions</h2>
              <p>Browse every release of Yogi.</p>
            </div>
            <div className="versions-list">
              {releases.map((r) => {
                const isCurrent = r.version === versionParam
                const nonLinux = r.platforms.filter((p) => p.os !== 'Linux')
                return (
                  <div key={r.version} className={`version-card${r.latest ? ' version-card-latest' : ''}${r.prerelease ? ' version-card-pre' : ''}${isCurrent ? ' version-card-current' : ''}`}>
                    <div className="version-card-header">
                      <div className="version-card-info">
                        <div className="version-card-title-row">
                          <h3>v{r.version}</h3>
                          {r.latest && <span className="latest-badge">Latest</span>}
                          {r.prerelease && <span className="version-pre-badge">Pre-release</span>}
                        </div>
                        <span className="version-card-date">Released {formatDate(r.date)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {!isCurrent && (
                          <Link className="link-blue" href={`/downloads/versions/v${r.version}`}>
                            Download v{r.version} →
                          </Link>
                        )}
                        {r.changelog && (
                          <a className="link-blue" href={r.changelog}>
                            Changelog →
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="version-card-platforms">
                      {nonLinux.map((p) => (
                        <a key={`${p.os}-${p.arch}-${p.label}`} className="dl-card" href={p.url}>
                          <div className="dl-card-arch-badge">{p.arch}</div>
                          <div className="dl-card-body">
                            <span className="dl-card-label">
                              <span style={{ marginRight: 4, verticalAlign: 'middle' }}>{osIcon[p.os]}</span>
                              {p.os} {p.label}
                            </span>
                            <span className="dl-card-size">{p.size}</span>
                          </div>
                          <span className="dl-card-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </span>
                        </a>
                      ))}
                    </div>
                    <LinuxInstallCmd version={r.version} />
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
