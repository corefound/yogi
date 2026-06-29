'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { FaLinux, FaArrowLeft } from 'react-icons/fa'
import { IoCloudDownloadSharp } from 'react-icons/io5'

import { releases, detectOSArch, detectPlatform, osIcon, formatDate } from '@/lib/downloads-data'

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

export default function VersionsPage() {
	const latestRelease = releases.find(r => r.latest) || releases[0]
	const [detected, setDetected] = useState<{
		os: string
		arch: string
		label: string
		size: string
		url: string
	} | null>(null)

	useEffect(() => {
		detectOSArch().then((result) => {
			const p = detectPlatform(result, latestRelease.platforms)
			setDetected(p || null)
		})
	}, [latestRelease])

	return (
		<>
			<TopBar />
			<main className="downloads-page">
				<section className="dl-hero" style={{ padding: '60px 24px 50px' }}>
					<div className="dl-hero-bg" />
					<div className="dl-hero-content">
						<div className="dl-hero-badge">v{latestRelease.version} · Latest Release</div>
						<h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>All <span className="dl-hero-highlight">Versions</span></h1>
						<p>Browse and download any version of Yogi.</p>

						{detected?.os === 'Linux' ? (
							<div className="dl-hero-term">
								<CopyCmd cmd={`curl -fsSL https://yogi.dev/install.sh | sh -s -- --version v${latestRelease.version}`} />
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
									Download v{latestRelease.version} for <strong>{detected.os} ({detected.label})</strong>
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
									Download v{latestRelease.version}
								</span>
							</a>
						)}
					</div>
				</section>

				<section className="dl-section">
					<div className="dl-container">
						<div className="versions-list">
							{releases.map((release) => {
								const nonLinux = release.platforms.filter((p) => p.os !== 'Linux')
								return (
									<div key={release.version} className={`version-card${release.latest ? ' version-card-latest' : ''}${release.prerelease ? ' version-card-pre' : ''}`}>
										<div className="version-card-header">
											<div className="version-card-info">
												<div className="version-card-title-row">
													<h3>v{release.version}</h3>
													{release.latest && <span className="latest-badge">Latest</span>}
													{release.prerelease && <span className="version-pre-badge">Pre-release</span>}
												</div>
												<span className="version-card-date">Released {formatDate(release.date)}</span>
											</div>
											<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
												<Link style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="link-blue" href={`/downloads/versions/v${release.version}`}>
													<span style={{ marginTop: 4 }}>
														<IoCloudDownloadSharp />
													</span>
													Download v{release.version}
												</Link>
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
										<LinuxInstallCmd version={release.version} />
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
