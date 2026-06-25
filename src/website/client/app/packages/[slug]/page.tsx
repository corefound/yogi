'use client'

import { useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { useParams } from 'next/navigation'
import { GET_PACKAGE, GET_PACKAGES, type GetPackageData, type GetPackagesData, type Package } from '@/lib/queries'
import { Area, AreaChart, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FaGithub, FaGlobe } from 'react-icons/fa';

import Link from 'next/link';
import moment from 'moment';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';

type ContentTab = 'readme' | 'versions' | 'files' | 'metrics' | 'audits'

function formatInstalls(n: number | null | undefined): string {
	if (!n) return '0'
	if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
	if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
	return String(n)
}



function timeAgo(date: string | null | undefined): string {
	if (!date) return ''
	return moment(Number(date)).fromNow()
}

function platformIcon(): React.ReactNode {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="4" y="4" width="16" height="16" rx="2" />
			<rect x="9" y="9" width="6" height="6" />
			<line x1="9" y1="2" x2="9" y2="4" />
			<line x1="15" y1="2" x2="15" y2="4" />
			<line x1="9" y1="20" x2="9" y2="22" />
			<line x1="15" y1="20" x2="15" y2="22" />
			<line x1="2" y1="9" x2="4" y2="9" />
			<line x1="2" y1="15" x2="4" y2="15" />
			<line x1="20" y1="9" x2="22" y2="9" />
			<line x1="20" y1="15" x2="22" y2="15" />
		</svg>
	)
}

export default function PackageSlugPage() {
	const params = useParams()
	const slug = params.slug as string

	const [contentTab, setContentTab] = useState<ContentTab>('readme')
	const [copied, setCopied] = useState(false)

	const { data, loading, error } = useQuery<GetPackageData>(GET_PACKAGE, {
		variables: { name: slug },
		skip: !slug,
	})

	const { data: recommendedData } = useQuery<GetPackagesData>(GET_PACKAGES, {
		variables: { limit: 4, offset: 0 },
		skip: !error,
	})

	const pkg = data?.package
	const recommended: Package[] = recommendedData?.packages || []
	const notFound = error && !loading

	if (!slug) {
		return (
			<>
				<TopBar />
				<main className="page-shell container" style={{ padding: '80px 0', textAlign: 'center' }}>
					<h1 style={{ fontSize: 48, marginBottom: 16 }}>404</h1>
					<p style={{ color: 'var(--muted)', marginBottom: 24 }}>Package not specified</p>
					<a className="btn primary" href="/">Go Home</a>
				</main>
				<Footer />
			</>
		)
	}

	if (loading) {
		return (
			<>
				<TopBar />
				<main className="page-shell container" style={{ padding: '80px 0', textAlign: 'center' }}>
					<p style={{ color: 'var(--muted)' }}>Loading package...</p>
				</main>
				<Footer />
			</>
		)
	}

	if (notFound || !pkg) {
		return (
			<>
				<TopBar />
				<main className="page-shell container" style={{ padding: '80px 0' }}>
					<div className="breadcrumb" style={{ marginBottom: 32 }}>
						Packages <span>›</span> {slug}
					</div>
					<div style={{ textAlign: 'center', marginBottom: 48 }}>
						<h1 style={{ fontSize: 48, marginBottom: 16 }}>Package Not Found</h1>
						<p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 18 }}>
							No package named <strong>{slug}</strong> exists in the registry.
						</p>
						<a className="btn primary" href="/">Browse Packages</a>
					</div>
					{recommended.length > 0 && (
						<section>
							<div className="section-head" style={{ marginBottom: 24 }}>
								<div className="section-title">
									<h2>Recommended Packages</h2>
									<small>You might be interested in</small>
								</div>
							</div>
							<div className="card-grid">
								{recommended.map((rec) => (
									<a className="package-card" href={`/package/${rec.name}`} key={rec.name}>
										<div className="pkg-top">
											<span className="pkg-icon">{rec.name.charAt(0).toUpperCase()}</span>
											<div>
												<div className="pkg-card-name">{rec.name}</div>
											</div>
										</div>
										<p>{rec.description || 'No description'}</p>
										<div className="pkg-meta">
											<span>⇩ {formatInstalls(rec.totalDownloads)}</span>
											<span>v{rec.versionsCount || '0'}</span>
										</div>
									</a>
								))}
							</div>
						</section>
					)}
				</main>
				<Footer />
			</>
		)
	}

	const latestVersion = pkg.versions?.[pkg.versions.length - 1]

	const formatBytes = (bytes: number, decimals = 2): string => {
		if (!Number.isFinite(bytes)) return "0 bytes";

		if (bytes === 0) return "0 bytes";

		const units = [
			"bytes",
			"KB",
			"MB",
			"GB",
			"TB",
			"PB",
			"EB",
			"ZB",
			"YB",
		];

		const base = 1024;
		const isNegative = bytes < 0;
		let size = Math.abs(bytes);

		const unitIndex = Math.min(
			Math.floor(Math.log(size) / Math.log(base)),
			units.length - 1
		);

		size = size / Math.pow(base, unitIndex);

		const formatted =
			unitIndex === 0
				? Math.round(size).toString()
				: Number(size.toFixed(decimals)).toString();

		const unit =
			unitIndex === 0
				? Number(formatted) === 1
					? "byte"
					: "bytes"
				: units[unitIndex];

		return `${isNegative ? "-" : ""}${formatted} ${unit}`;
	};

	const metrics = [
		{
			lavel: 'Weekly Downloads',
			value: pkg.weeklyDownloads?.toLocaleString("en-US") || '0',
			spark: "spark"
		},
		{
			lavel: 'Total Downloads',
			value: pkg.totalDownloads?.toLocaleString("en-US") || '0',
			spark: "spark"
		},
		{
			lavel: 'Current Version',
			value: latestVersion?.version ? "v" + latestVersion?.version : "N/A",
			spark: ""
		},
		{
			lavel: 'License',
			value: pkg.license || 'N/A',
			spark: ""
		},
		{
			lavel: 'Last Published',
			value: latestVersion?.publishedAt ? moment(Number(latestVersion.publishedAt)).fromNow() : 'N/A',
			spark: ""
		},
		{
			lavel: 'Package Size',
			value: latestVersion?.assetSizeBytes ? formatBytes((Number(latestVersion.assetSizeBytes) / 1024)) : 'N/A',
			spark: ""
		},
	]

	const truncateText = (text: string, maxLength = 38): string => {
		if (!text) return "";

		if (text.length <= maxLength) {
			return text;
		}

		return `${text.slice(0, maxLength)}...`;
	};


	return (
		<>
			<TopBar />

			<main className="page-shell container">
				<div className="breadcrumb">
					<Link href="/packages">Packages</Link> <span>›</span>
					{pkg.scope ? <><Link href="/packages">{pkg.scope}</Link> <span>›</span></> : null}
					<Link href={`/packages/${pkg.name}`}>{pkg.name}</Link>
				</div>

				<section className="package-hero">
					<div className="package-title-row">
						{pkg.logo ? (
							<div className="big-package-logo">
								<img src={pkg.logo} alt={`${pkg.name} logo`} style={{ objectFit: 'contain' }} />
							</div>
						) : (
							<div className="big-package-icon">
								<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
									<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
									<line x1="12" y1="22.08" x2="12" y2="12" />
								</svg>
							</div>
						)}
						<div>
							<h1>{pkg.name}</h1>
							<p>{pkg.description || 'No description available.'}</p>
							<div className="hero-meta">
								{latestVersion?.platforms && latestVersion.platforms.length > 0 && (
									<div className="tags" style={{ marginTop: 4 }}>
										{latestVersion.platforms.map((platform) => (
											<span className="tag" key={platform} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
												{platformIcon()} {platform}
											</span>
										))}
									</div>
								)}
							</div>
						</div>
					</div>
					<div className="actions-row"></div>
				</section>

				<section className="install-panel" style={{ position: 'relative' }}>
					<div className="code-line" id="install-command">
						<span className="prompt">$</span>&nbsp; yogi add {pkg.name}
						<button className="copy-btn" onClick={() => {
							navigator.clipboard.writeText(`yogi add ${pkg.name}`)
							setCopied(true)
							setTimeout(() => setCopied(false), 1500)
						}} style={copied ? { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' } : {}}>
							{copied ? '✓' : 'Copy'}
						</button>
					</div>
					{copied && <span style={{ position: 'absolute', right: 10, top: -32, fontSize: 12, fontWeight: 600, color: '#60a5fa', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.2)', animation: 'fadeIn 0.15s ease' }}>Copied!</span>}
				</section>

				<div className="package-layout">
					<section>
						<div className="content-tabs">
							<button className={`${contentTab === 'readme' ? 'active' : ''}`} onClick={() => setContentTab('readme')}>
								README
							</button>
							<button className={`${contentTab === 'versions' ? 'active' : ''}`} onClick={() => setContentTab('versions')}>
								Versions {pkg.versions?.length ? <span className="badge">{pkg.versions.length}</span> : null}
							</button>
							<button className={`${contentTab === 'files' ? 'active' : ''}`} onClick={() => setContentTab('files')}>
								Dependencies
							</button>
							<button className={`${contentTab === 'metrics' ? 'active' : ''}`} onClick={() => setContentTab('metrics')}>
								Metrics
							</button>
							<button className={`${contentTab === 'audits' ? 'active' : ''}`} onClick={() => setContentTab('audits')}>
								Audits {pkg.versions?.length ? <span className="warn">{pkg.versions.length}</span> : null}
							</button>
						</div>

						<div className="metrics">
							{metrics.map((metric) => (
								<div className="metric">
									<small>{metric.lavel}</small>
									<strong style={{ fontSize: 14 }}>{metric.value}</strong>
									{/* {metric.spark ? <TinyAreaChart /> : null} */}
								</div>
							))}
						</div>

						{contentTab === 'readme' && (
							<article className="readme-version-card">
								<h2>{pkg.name}</h2>
								<p style={{ color: 'var(--muted)' }}>
									{pkg.description || 'No description'}
								</p>
								<h3>Features</h3>
								<div className="feature-list">
									<div>Fast and reliable package management</div>
									<div>Works with Node.js, Deno, Bun, and modern browsers</div>
									<div>Promise-based API with async/await support</div>
									<div>TypeScript-first with smart inference</div>
									<div>Secure by default with vulnerability scanning</div>
								</div>
								{pkg.readmeText && (
									<div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
										{pkg.readmeText}
									</div>
								)}
							</article>
						)}

						{contentTab === 'versions' && (
							<article className="readme-version-card">
								<div className="p-20">
									<h2>Versions {pkg.versions?.length ? `(${pkg.versions.length})` : ''}</h2>
									<p style={{ color: 'var(--muted)' }}>
										All published versions of {pkg.name}
									</p>
								</div>
								{pkg.versions?.length ? (
									<div className="version-list">
										{[...pkg.versions].reverse().map((v) => {
											const size = v.assetSizeBytes ? formatBytes(Number(v.assetSizeBytes)) : null
											const installs = v.installCount ? formatInstalls(Number(v.installCount)) : null
											return (
												<Link
													href={`/packages/${pkg.name}/v/${v.version}`}
													key={v.id}
													className="version-row"
													style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
												>
													<div className="px-20" style={{ flex: 1, minWidth: 0 }}>
														<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
															<span className="version-number" style={{ fontWeight: 600, fontSize: 15 }}>v{v.version}</span>
															{v.version === latestVersion?.version && <span className="latest-badge">Latest</span>}
															{v.description && <span style={{ color: 'var(--muted)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.description}</span>}
														</div>
														<div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--muted)' }}>
															{v.publishedAt && <span>{timeAgo(v.publishedAt)}</span>}
															{size && <span>{size}</span>}
															{installs && <span>{installs} installs</span>}
														</div>
														{v.platforms && v.platforms.length > 0 && (
															<div className="tags" style={{ marginTop: 6, gap: 4 }}>
																{v.platforms.map((p) => (
																	<span className="tag" key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '2px 6px' }}>
																		{platformIcon()} {p}
																	</span>
																))}
															</div>
														)}
													</div>
													<span style={{ color: 'var(--muted)', fontSize: 18, paddingRight: 20 }}>›</span>
												</Link>
											)
										})}
									</div>
								) : (
									<p style={{ color: 'var(--muted)' }}>No versions published yet.</p>
								)}
							</article>
						)}

						{contentTab === 'audits' && (
							<article className="readme-card">
								<h2>Audit & Security</h2>
								<p style={{ color: 'var(--muted)' }}>
									Security analysis and vulnerability report for {pkg.name}
								</p>
								{pkg.security ? (
									<>
										<div className="audit-grid">
											<div className="audit-card">
												<small>Security Status</small>
												<span className={`audit-badge ${pkg.security.status}`}>
													{pkg.security.status === 'passed' ? '✓ Passed' : pkg.security.status === 'failed' ? '✗ Failed' : pkg.security.status === 'warning' ? '⚠ Warning' : '⟳ Pending'}
												</span>
											</div>
											<div className="audit-card">
												<small>Vulnerabilities</small>
												<strong className={pkg.security.vulnerabilitiesCount > 0 ? 'vuln-count-danger' : 'vuln-count-safe'}>{pkg.security.vulnerabilitiesCount}</strong>
											</div>
											<div className="audit-card">
												<small>Malware Scan</small>
												<span className={`audit-badge ${pkg.security.malwareScanStatus}`}>
													{pkg.security.malwareScanStatus === 'passed' ? '✓ Clean' : pkg.security.malwareScanStatus === 'failed' ? '✗ Infected' : '⟳ Scanning'}
												</span>
											</div>
											<div className="audit-card">
												<small>Last Scanned</small>
												<strong>{pkg.security.lastScannedAt ? timeAgo(pkg.security.lastScannedAt) : 'Never'}</strong>
											</div>
										</div>

										{pkg.security.vulnerabilities && pkg.security.vulnerabilities.length > 0 && (
											<>
												<div className="audit-chart">
													<h3>Vulnerability Severity</h3>
													<ResponsiveContainer width="100%" height={200}>
														<BarChart data={[
															{ severity: 'Critical', count: pkg.security.vulnerabilities.filter(v => v.severity === 'critical').length },
															{ severity: 'High', count: pkg.security.vulnerabilities.filter(v => v.severity === 'high').length },
															{ severity: 'Medium', count: pkg.security.vulnerabilities.filter(v => v.severity === 'medium').length },
															{ severity: 'Low', count: pkg.security.vulnerabilities.filter(v => v.severity === 'low').length },
															{ severity: 'Warning', count: pkg.security.vulnerabilities.filter(v => v.severity === 'warning').length },
														]} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
															<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
															<XAxis dataKey="severity" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
															<YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} allowDecimals={false} />
															<Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
															<Bar dataKey="count" radius={[4, 4, 0, 0]}>
																{pkg.security.vulnerabilities.filter(v => v.severity === 'critical').length > 0 && <Bar dataKey="count" fill="#ef4444" stackId="a" />}
															</Bar>
															<Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
														</BarChart>
													</ResponsiveContainer>
												</div>

												<div className="vuln-log">
													<h3 style={{ marginBottom: 16 }}>Vulnerability Log ({pkg.security.vulnerabilities.length} findings)</h3>
													{pkg.security.vulnerabilities.map((vuln) => (
														<div key={vuln.id} className={`vuln-entry vuln-${vuln.severity}`}>
															<div className="vuln-header">
																<div className="vuln-left">
																	<span className={`vuln-severity severity-${vuln.severity}`}>
																		{vuln.severity === 'critical' ? 'CRITICAL' : vuln.severity === 'high' ? 'HIGH' : vuln.severity === 'medium' ? 'MEDIUM' : vuln.severity === 'low' ? 'LOW' : 'WARNING'}
																	</span>
																	<span className="vuln-type">{vuln.type.replace('_', ' ').toUpperCase()}</span>
																	<span className={`vuln-status status-${vuln.status}`}>{vuln.status === 'open' ? 'OPEN' : vuln.status === 'fixed' ? 'FIXED' : vuln.status.toUpperCase()}</span>
																</div>
																<small className="vuln-date">{vuln.reportedAt}</small>
															</div>
															<strong className="vuln-title">{vuln.title}</strong>
															<p className="vuln-desc">{vuln.description}</p>
															<div className="vuln-meta">
																<span className="vuln-ref">{vuln.id}</span>
																<span className="vuln-pkg">{vuln.packageName}@{vuln.versionRange}</span>
																{vuln.fixedIn && <span className="vuln-fixed">Fixed in: {vuln.fixedIn}</span>}
															</div>
														</div>
													))}
												</div>
											</>
										)}

										{pkg.security.vulnerabilitiesCount === 0 && (
											<div className="vuln-clean">
												<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
													<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
												</svg>
												<div>
													<strong>No vulnerabilities found</strong>
													<p>This package passed all security scans with zero known vulnerabilities.</p>
												</div>
											</div>
										)}
									</>
								) : (
									<p style={{ color: 'var(--muted)' }}>No audit data available for this package.</p>
								)}
							</article>
						)}

						{contentTab === 'metrics' && (
							<article className="readme-card">
								<h2>Metrics & Analytics</h2>
								<p style={{ color: 'var(--muted)' }}>
									Download statistics and analytics for {pkg.name}
								</p>

								<div className="metrics-grid">
									<div className="metric-card">
										<small>Total Downloads</small>
										<strong>{pkg.totalDownloads?.toLocaleString() || '0'}</strong>
									</div>
									<div className="metric-card">
										<small>Weekly Downloads</small>
										<strong>{pkg.weeklyDownloads?.toLocaleString() || '0'}</strong>
									</div>
									<div className="metric-card">
										<small>Versions</small>
										<strong>{pkg.versionsCount || '0'}</strong>
									</div>
									<div className="metric-card">
										<small>Current Version</small>
										<strong>v{latestVersion?.version || 'N/A'}</strong>
									</div>
									<div className="metric-card">
										<small>License</small>
										<strong>{pkg.license || 'N/A'}</strong>
									</div>
									<div className="metric-card">
										<small>Last Published</small>
										<strong>{latestVersion?.publishedAt ? timeAgo(latestVersion.publishedAt) : 'N/A'}</strong>
									</div>
								</div>

								{pkg.downloadTrend && pkg.downloadTrend.length > 0 && (
									<div className="metrics-chart">
										<h3>Download Trend (30 days)</h3>
										<ResponsiveContainer width="100%" height={250}>
											<AreaChart data={pkg.downloadTrend} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
												<defs>
													<linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
														<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
														<stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
													</linearGradient>
												</defs>
												<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
												<XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={(v) => v.slice(5)} />
												<YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
												<Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }} />
												<Area type="monotone" dataKey="downloads" stroke="#3b82f6" fill="url(#downloadGradient)" strokeWidth={2} />
											</AreaChart>
										</ResponsiveContainer>
									</div>
								)}
							</article>
						)}
					</section>

					<aside>
						<div className="side-card">
							<h3>Package links</h3>
							{pkg.repoFullName ? (
								<a className="side-link" href={`https://github.com/${pkg.repoFullName}`} target="_blank" rel="noopener noreferrer">
									<FaGithub size={22} />

									<span>{truncateText(pkg.repositoryUrl?.replace(/https?:\/\//, '').replace(/http?:\/\//, '') || "", 30)} ›</span>
								</a>
							) : null}
							{pkg.homepageUrl ? (
								<a className="side-link" href={pkg.homepageUrl} target="_blank" rel="noopener noreferrer">
									<FaGlobe color="var(--text)" size={22} />
									<span style={{ color: 'var(--text)' }}>{truncateText(pkg.homepageUrl?.replace(/https?:\/\//, '').replace(/http?:\/\//, '') || "", 30)} ›</span>
								</a>
							) : null}
						</div>
						<div className="side-card">
							<h3>Keywords</h3>
							<div className="tags">
								<Link className="tag" href={`/categories/${pkg.name}`} style={{ textDecoration: 'none' }}>{pkg.name}</Link>
								{pkg.name.includes('-') ? pkg.name.split('-').map((part, i) => (
									<Link className="tag" href={`/categories/${part}`} key={i} style={{ textDecoration: 'none' }}>{part}</Link>
								)) : null}
								<Link className="tag" href="/categories/javascript" style={{ textDecoration: 'none' }}>javascript</Link>
								<Link className="tag" href="/categories/typescript" style={{ textDecoration: 'none' }}>typescript</Link>
								<Link className="tag" href="/categories/node" style={{ textDecoration: 'none' }}>node</Link>
								<Link className="tag" href="/categories/web" style={{ textDecoration: 'none' }}>web</Link>
							</div>
						</div>
						{pkg.owner ? (
							<div className="side-card">
								<h3>Maintainers</h3>
								<div className="maintainers">
									<span className="mini-avatar"></span>
									<span>{pkg.owner.githubLogin || pkg.owner.displayName || 'Unknown'}</span>
								</div>
							</div>
						) : null}
						{latestVersion ? (
							<div className="side-card">
								<h3>Publish activity</h3>
								<p style={{ color: 'var(--muted)', margin: 0 }}>
									{latestVersion.publishedAt ? timeAgo(latestVersion.publishedAt) : 'N/A'}
									<br />
									Version {latestVersion.version}
								</p>
								<a className="link-blue" href="#">
									View full history →
								</a>
							</div>
						) : null}
					</aside>
				</div>
			</main>

			<Footer />
		</>
	)
}