'use client'

import { useEffect } from 'react'
import { useQuery } from '@apollo/client/react'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import {
	GET_METRICS,
	GET_TRENDING_PACKAGES,
	GET_ORGANIZATIONS,
	type Package,
	type Metric,
	type Organization,
	type GetTrendingPackagesData,
	type GetMetricsData,
	type GetOrganizationsData,
} from '@/lib/queries'

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

const statIcons: Record<string, React.ReactNode> = {
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

function formatCount(n: number): string {
	//   if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
	//   if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
	return n.toLocaleString("en-US")
}

function packageIcon(name: string) {
	return name.charAt(0).toUpperCase()
}

export default function Home() {
	const metricsQuery = useQuery<GetMetricsData>(GET_METRICS, { fetchPolicy: 'network-only' })
	const trendingQuery = useQuery<GetTrendingPackagesData>(GET_TRENDING_PACKAGES, { variables: { limit: 6 }, fetchPolicy: 'network-only' })
	const orgsQuery = useQuery<GetOrganizationsData>(GET_ORGANIZATIONS, { fetchPolicy: 'network-only' })

	useEffect(() => {
		if (metricsQuery.error) console.error('metrics error:', metricsQuery.error)
		if (trendingQuery.error) console.error('trending error:', trendingQuery.error)
		if (orgsQuery.error) console.error('orgs error:', orgsQuery.error)
	}, [metricsQuery.error, trendingQuery.error, orgsQuery.error])

	const metrics: Metric[] = metricsQuery.data?.metrics || []
	const packages: Package[] = trendingQuery.data?.trendingPackages || []
	const orgs: Organization[] = orgsQuery.data?.organizations || []

	const metricMap = new Map(metrics.map(m => [m.key, m.value]))
	const totalPackages = metricMap.get('total_packages') || 0
	const weeklyDownloads = metricMap.get('weekly_downloads') || 0
	const verifiedOrgs = metricMap.get('verified_organizations') || 0
	const packageUpdates = metricMap.get('package_updates') || 0

	const hasError = !!(metricsQuery.error || trendingQuery.error || orgsQuery.error)
	const loadingAll = metricsQuery.loading || trendingQuery.loading || orgsQuery.loading

	const stats = [
		{ name: "Total Packages", value: loadingAll || hasError ? (hasError ? '—' : '...') : totalPackages?.toLocaleString("en-US"), text: hasError ? 'Connection error' : 'Available in registry', icon: "Total Packages" },
		{ name: "Weekly Downloads", value: loadingAll || hasError ? (hasError ? '—' : '...') : weeklyDownloads?.toLocaleString("en-US"), text: hasError ? 'Connection error' : 'By developers worldwide', icon: "Weekly Downloads" },
		{ name: "Verified Organizations", value: loadingAll || hasError ? (hasError ? '—' : '...') : verifiedOrgs?.toLocaleString("en-US"), text: hasError ? 'Connection error' : 'Trusted teams and companies', icon: "Verified Organizations" },
		{ name: "Package Updates", value: loadingAll || hasError ? (hasError ? '—' : '...') : packageUpdates?.toLocaleString("en-US"), text: hasError ? 'Connection error' : 'New versions this week', icon: "Package Updates" },
	]

	return (
		<>
			<TopBar />

			<main className="Home">
				<section className="hero-explore container">
					<div className="hero-grid">
						<div className="hero-copy">
							<div className="eyebrow">◈ Trusted by developers worldwide</div>
							<h1>
								Discover, install and publish <span>amazing</span> packages.
							</h1>
							<p>Yogi is a modern, secure and reliable package manager built for today's developers and their teams.</p>

							<label className="search-hero">
								<span style={{ fontSize: 26 }}>⌕</span>
								<input placeholder="Search packages..." />
							</label>

							<div className="hero-actions">
								<a style={{ color: '#fff' }} className="btn primary" href="#trending">◉ Explore Packages</a>
								<a className="btn" href="#">⇧ Publish Package</a>
							</div>
						</div>

						<div className="hero-side">
							{stats.map((item) => (
								<div className="stat-card" key={item.name}>
									<div className="top">
										<span className="stat-icon">{statIcons[item.icon]}</span>
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
							<span style={{ fontSize: 26 }} className="gradient-text">⌁</span>
							<h2>Trending Packages</h2>
							<small>Popular this week</small>
						</div>
					</div>
					<div className="card-grid">
						{trendingQuery.loading && <p style={{ gridColumn: '1 / -1', color: 'var(--muted)' }}>Loading packages...</p>}
						{trendingQuery.error && <p style={{ gridColumn: '1 / -1', color: 'var(--danger)' }}>Failed to load packages. Is the API server running on port 3456?</p>}
						{!trendingQuery.loading && !trendingQuery.error && packages.length === 0 && <p style={{ gridColumn: '1 / -1', color: 'var(--muted)' }}>No packages found yet.</p>}
						{packages.map((pkg) => (
							<a className="package-card" href={`/package/${pkg.name}`} key={pkg.fullName}>
								<div className="pkg-top">
									<span className="pkg-icon">{packageIcon(pkg.name)}</span>
									<div>
										<div className="pkg-card-name">{pkg.fullName}</div>
									</div>
								</div>
								<p>{pkg.description || 'No description'}</p>
								<div className="pkg-meta">
									<span>⇩ {formatCount(pkg.weeklyDownloads || 0)}/wk</span>
									<span>v{pkg.versionsCount || '0'}</span>
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
								{orgsQuery.loading && <p style={{ color: 'var(--muted)' }}>Loading...</p>}
								{orgsQuery.error && <p style={{ color: 'var(--danger)' }}>Connection error.</p>}
								{!orgsQuery.loading && !orgsQuery.error && orgs.length === 0 && <p style={{ color: 'var(--muted)' }}>No organizations yet.</p>}
								{orgs.map((org) => {
									const pkgCount = org.packages?.length || 0
									const totalDl = org.packages?.reduce((sum, p) => sum + (p.totalDownloads || 0), 0) || 0
									return (
										<a className="org-card" href="#" key={org.name}>
											<div className="org-logo dark">{org.name.charAt(0).toUpperCase()}</div>
											<strong>{org.displayName || org.name}</strong>
											<p>
												{pkgCount} {pkgCount === 1 ? 'package' : 'packages'}
												<br />
												{formatCount(totalDl)} downloads
											</p>
										</a>
									)
								})}
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
