'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { FaApple, FaLinux, FaWindows } from 'react-icons/fa';

type Platform = { id: string; os: string; arch: string; label: string; size: string; url: string }

const platforms: Platform[] = [
    { id: 'macos-arm64', os: 'macOS', arch: 'arm64', label: 'Apple Silicon', size: '18.2 MB', url: '#' },
    { id: 'macos-x64', os: 'macOS', arch: 'x64', label: 'Intel', size: '19.1 MB', url: '#' },
    { id: 'windows-x64', os: 'Windows', arch: 'x64', label: '64-bit', size: '16.8 MB', url: '#' },
    { id: 'windows-arm64', os: 'Windows', arch: 'arm64', label: 'ARM', size: '17.2 MB', url: '#' },
    { id: 'linux-x64-gnu', os: 'Linux', arch: 'x64', label: 'glibc', size: '15.4 MB', url: '#' },
    { id: 'linux-x64-musl', os: 'Linux', arch: 'x64', label: 'musl', size: '14.9 MB', url: '#' },
    { id: 'linux-arm64', os: 'Linux', arch: 'arm64', label: 'ARM64', size: '14.2 MB', url: '#' },
]

type ArchResult = { os: 'macOS' | 'Windows' | 'Linux'; arch: 'arm64' | 'x64' }

async function detectPlatform(): Promise<Platform> {
    const result = await detectOSArch()
    const lookup: Record<string, string> = {
        'macOS-arm64': 'macos-arm64',
        'macOS-x64': 'macos-x64',
        'Windows-arm64': 'windows-arm64',
        'Windows-x64': 'windows-x64',
        'Linux-arm64': 'linux-arm64',
        'Linux-x64': 'linux-x64-gnu',
    }
    const id = lookup[`${result.os}-${result.arch}`]
    return platforms.find(p => p.id === id) ?? platforms[0]
}

async function detectOSArch(): Promise<ArchResult> {
    const ua = navigator.userAgent

    const os: ArchResult['os'] =
        /Mac/i.test(ua) ? 'macOS' :
            /Win/i.test(ua) ? 'Windows' :
                /Linux/i.test(ua) && !/Mac/i.test(ua) ? 'Linux' :
                    'macOS'

    let arch: ArchResult['arch'] | undefined

    if (!arch && (navigator as any).userAgentData?.getHighEntropyValues) {
        try {
            const values = await (navigator as any).userAgentData.getHighEntropyValues(['architecture'])
            const a = values.architecture?.toLowerCase() ?? ''
            if (a.includes('arm')) arch = 'arm64'
            else if (a) arch = 'x64'
        } catch { /* fall through */ }
    }

    if (!arch) {
        if (/ARM64|aarch64|armv8|ARM\b/i.test(ua)) arch = 'arm64'
        else if (/x86_64|Win64|WOW64/i.test(ua)) arch = 'x64'
    }

    if (!arch && navigator.platform) {
        const p = navigator.platform.toLowerCase()
        if (p.includes('arm') || p.includes('aarch')) arch = 'arm64'
    }

    if (!arch) arch = os === 'macOS' ? 'arm64' : 'x64'

    return { os, arch }
}

const osMeta: Record<string, { icon: React.ReactNode; color: string; desc: string }> = {
    macOS: { icon: <FaApple />, color: 'var(--dl-macos)', desc: 'Native macOS binaries' },
    Windows: { icon: <FaWindows />, color: 'var(--dl-windows)', desc: 'Windows x64 and ARM' },
    Linux: { icon: <FaLinux />, color: 'var(--dl-linux)', desc: 'Install via script — auto-detects your distro' },
}

/* ── Copyable terminal command ─────────────────────── */

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

export default function DownloadsPage() {
    const [detected, setDetected] = useState<Platform | null>(null)

    useEffect(() => {
        detectPlatform().then(setDetected)
    }, [])

    return (
        <>
            <TopBar />
            <main className="downloads-page">
                <section className="dl-hero">
                    <div className="dl-hero-bg" />
                    <div className="dl-hero-content">
                        <div className="dl-hero-badge">v2.3.1 · Latest Release</div>
                        <h1>Download <span className="dl-hero-highlight">Yogi</span></h1>
                        <p>The modern package manager for TypeScript and JavaScript ecosystems.</p>

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
                            <span>Other platforms:</span>
                            {platforms.filter(p => p.os !== 'Linux' && (!detected || p.id !== detected.id)).slice(0, 4).map(p => (
                                <a key={p.id} href={p.url}>{p.os} ({p.arch})</a>
                            ))}
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
