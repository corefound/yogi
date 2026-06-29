'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { platforms, releases, detectOSArch, detectPlatform, osMeta, type Platform } from '@/lib/downloads-data'
import CopyCmd from '@/components/CopyCmd';

/* ── Copyable terminal command ─────────────────────── */


export default function DownloadsPage() {
    const [detected, setDetected] = useState<Platform | null>(null)

    useEffect(() => {
        detectOSArch().then((result) => {
            const p = detectPlatform(result)
            setDetected(p as Platform)
        })
    }, [])

    const previousVersions = releases.filter(r => !r.latest).slice(0, 2)

    return (
        <>
            <TopBar />
            <main className="downloads-page">
                <section className="dl-hero">
                    <div className="dl-hero-bg" />
                    <div className="dl-hero-content">
                        <div className="dl-hero-badge">v{releases.find(r => r.latest)?.version} · Latest Release</div>
                        <h1>Download <span className="dl-hero-highlight">Yogi</span></h1>
                        <p>A modern Ahead-of-Time compiled programming language for building fast, native applications.</p>

                        {detected?.os === 'Linux' ? (
                            <div className="dl-hero-term">
                                <CopyCmd cmd="curl -fsSL https://yogi.dev/install.sh | sh" />
                                <CopyCmd cmd="wget -qO- https://yogi.dev/install.sh | sh" />
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
                                    Download for <strong>{detected.os} ({detected.label})</strong>
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
                                    Download Yogi
                                </span>
                            </a>
                        )}

                        <div className="dl-hero-alts">
                            <span>Previous versions:</span>
                            {previousVersions.map((r) => (
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
                                <strong>48M+</strong>
                                <span>Downloads</span>
                            </div>
                            <div className="dl-hero-stat">
                                <strong>14</strong>
                                <span>Platforms</span>
                            </div>
                            <div className="dl-hero-stat">
                                <strong>100%</strong>
                                <span>Open Source</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Rest of the page unchanged */}
                <section className="dl-section">
                    <div className="dl-container">
                        <div className="dl-section-header">
                            <h2>All platforms</h2>
                            <p>Browse every available binary for your operating system.</p>
                        </div>

                        <div className="dl-platforms">
                            {['macOS', 'Windows', 'Linux'].map((os) => {
                                const items = platforms.filter((p) => p.os === os)
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
                                        {os === 'Linux' ? (
                                            <div className="dl-linux-install">
                                                <div className="dl-linux-install-header">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="16 18 22 12 16 6" />
                                                        <polyline points="8 6 2 12 8 18" />
                                                    </svg>
                                                    Install via script
                                                </div>
                                                <CopyCmd cmd="curl -fsSL https://yogi.dev/install.sh | sh" />
                                                <CopyCmd cmd="wget -qO- https://yogi.dev/install.sh | sh" />
                                                <p className="dl-linux-install-note">
                                                    Auto-detects your distro and architecture. No manual selection needed.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="dl-card-grid">
                                                {items.map((p) => {
                                                    const isMatch = detected?.id === p.id
                                                    return (
                                                        <a key={p.id} className={`dl-card${isMatch ? ' dl-card-active' : ''}`} href={p.url}>
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
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </section>

                <section className="dl-section dl-section-alt">
                    <div className="dl-container">
                        <div className="dl-section-header">
                            <h2>Additional assets</h2>
                            <p>Source archives and verification files.</p>
                        </div>
                        <div className="dl-other-grid">
                            {[
                                { label: 'Source code (tar.gz)', size: '12.1 MB', url: '#', icon: '📦' },
                                { label: 'Source code (zip)', size: '13.4 MB', url: '#', icon: '📦' },
                                { label: 'Checksums (SHA256)', size: '1.2 KB', url: '#', icon: '🔐' },
                                { label: 'GPG Signature', size: '0.5 KB', url: '#', icon: '🔑' },
                            ].map((item) => (
                                <a key={item.label} className="dl-other-card" href={item.url}>
                                    <span className="dl-other-icon">{item.icon}</span>
                                    <div className="dl-other-body">
                                        <span className="dl-other-label">{item.label}</span>
                                        <span className="dl-other-size">{item.size}</span>
                                    </div>
                                    <svg className="dl-other-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                        <polyline points="12 5 19 12 12 19" />
                                    </svg>
                                </a>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="dl-section">
                    <div className="dl-container">
                        <div className="dl-section-header">
                            <h2>Verify your download</h2>
                            <p>Ensure the integrity and authenticity of your download.</p>
                        </div>
                        <div className="dl-verify-grid">
                            <div className="dl-verify-step">
                                <div className="dl-verify-num">01</div>
                                <div className="dl-verify-content">
                                    <h4>Download checksums</h4>
                                    <p>Get the SHA256 checksums file for your platform.</p>
                                    <CopyCmd cmd="curl -O https://yogi.dev/checksums.txt" />
                                </div>
                            </div>
                            <div className="dl-verify-step">
                                <div className="dl-verify-num">02</div>
                                <div className="dl-verify-content">
                                    <h4>Verify checksum</h4>
                                    <p>Compare the SHA256 hash of your download.</p>
                                    <CopyCmd cmd="shasum -a 256 -c checksums.txt" />
                                </div>
                            </div>
                            <div className="dl-verify-step">
                                <div className="dl-verify-num">03</div>
                                <div className="dl-verify-content">
                                    <h4>Verify signature</h4>
                                    <p>Import the GPG key and verify the binary.</p>
                                    <CopyCmd cmd="curl https://yogi.dev/gpg.asc | gpg --import" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="dl-section dl-section-install">
                    <div className="dl-container">
                        <div className="dl-install-box">
                            <div className="dl-install-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="16 18 22 12 16 6" />
                                    <polyline points="8 6 2 12 8 18" />
                                </svg>
                            </div>
                            <div className="dl-install-body">
                                <h3>Quick install via script</h3>
                                <p>Run this in your terminal — we&apos;ll detect your platform automatically.</p>
                            </div>
                            <div className="dl-install-cmd">
                                <code>curl -fsSL https://yogi.dev/install.sh | sh</code>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
