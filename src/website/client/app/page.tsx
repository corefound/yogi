'use client'

import { useEffect } from 'react'
import { useQuery } from '@apollo/client/react'
import TopBar from '@/components/TopBar'
import SearchAutocomplete from '@/components/SearchAutocomplete'
import Footer from '@/components/Footer'
import {
	GET_METRICS,
	GET_TRENDING_PACKAGES,
	GET_POPULAR_ORGANIZATIONS,
	GET_CATEGORIES_LIST,
	GET_MAINTAINERS,
	type Package,
	type Metric,
	type Organization,
	type User,
	type GetTrendingPackagesData,
	type GetMetricsData,
	type GetPopularOrganizationsData,
	type GetMaintainersData,
	type GetCategoriesListData,
	type Category,
} from '@/lib/queries'
import { IoCloudDownloadSharp } from "react-icons/io5";

const categoryIcons: Record<string, string> = {
	'Web': '◎',
	'AI': '✦',
	'CLI': '▻',
	'Database': '▤',
	'DevTools': '⚒',
	'Security': '◇',
	'UI': '◫',
	'Mobile': '▣',
}

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
	const metricsQuery = useQuery<GetMetricsData>(GET_METRICS, { fetchPolicy: 'cache-first' })
	const trendingQuery = useQuery<GetTrendingPackagesData>(GET_TRENDING_PACKAGES, { variables: { limit: 4 }, fetchPolicy: 'cache-first' })
	const orgsQuery = useQuery<GetPopularOrganizationsData>(GET_POPULAR_ORGANIZATIONS, { variables: { limit: 3 }, fetchPolicy: 'cache-first' })
	const categoriesQuery = useQuery<GetCategoriesListData>(GET_CATEGORIES_LIST, { variables: { limit: 4 }, fetchPolicy: 'cache-first' })
	const maintainersQuery = useQuery<GetMaintainersData>(GET_MAINTAINERS, { fetchPolicy: 'cache-first' })

	useEffect(() => {
		console.log({ maintainersQuery })
	}, [])

	useEffect(() => {
		if (metricsQuery.error) console.error('metrics error:', metricsQuery.error)
		if (trendingQuery.error) console.error('trending error:', trendingQuery.error)
		if (orgsQuery.error) console.error('orgs error:', orgsQuery.error)
		if (categoriesQuery.error) console.error('categories error:', categoriesQuery.error)
	}, [metricsQuery.error, trendingQuery.error, orgsQuery.error, categoriesQuery.error])

	const metrics: Metric[] = metricsQuery.data?.metrics || []
	const packages: Package[] = trendingQuery.data?.trendingPackages || []
	const orgs: Organization[] = orgsQuery.data?.popularOrganizations || []
	const maintainers: User[] = maintainersQuery.data?.gayMaintainers || []
	const categoriesData = categoriesQuery.data?.categoriesList
	const categories: Category[] = categoriesData?.categories || []
	const remainingCount = categoriesData?.remainingPackageCount || 0

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

							<SearchAutocomplete variant="hero" />

							<div className="hero-actions">
								<a style={{ color: '#fff' }} className="btn primary" href="#trending">◉ Explore Packages</a>
								<a className="btn" href="#">⇧ Publish Package</a>
							</div>
						</div>

						<div style={{ marginTop: 50 }} className="hero-side">
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

							<a href="/maintainers" className="stat-card hero-side-wide hover">
								<div>
									<div className="top">
										<span className="stat-icon">♡</span>
										<span>Built for developers, by developers.</span>
									</div>
								</div>
								{maintainersQuery.loading ? (
									<div className="avatar-row">
										{[...Array(5)].map((_, i) => (
											<span key={i} className="mini-avatar" style={{ opacity: 0.4 }} />
										))}
									</div>
								) : maintainers.length > 0 ? (
									<div className="avatar-row">
										{maintainers.slice(0, 4).map((user) => (
											user.avatarUrl ? (
												<img key={user.id} className="mini-avatar" src={user.avatarUrl} alt={user.displayName || user.githubLogin} title={user.displayName || user.githubLogin} />
											) : (
												<span key={user.id} className="mini-avatar" title={user.displayName || user.githubLogin}>
													{(user.displayName || user.githubLogin).charAt(0).toUpperCase()}
												</span>
											)
										))}
										{maintainers.length > 5 && (
											<span className="tag">+{maintainers.length - 4}</span>
										)}
									</div>
								) : null}
							</a>
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
							<a className="package-card" href={`/packages/${pkg.name}`} key={pkg.fullName}>
								<div className="pkg-top">
									{pkg.logo ? (
										<div className="small-package-logo">
											<img src={pkg.logo} alt={`${pkg.name} logo`} style={{ objectFit: 'contain' }} />
										</div>
									) : (
										<div className="small-package-icon">
											<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
												<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
												<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
												<line x1="12" y1="22.08" x2="12" y2="12" />
											</svg>
										</div>
									)}
									<div>
										<div className="pkg-card-name">{pkg.name}</div>
									</div>
								</div>
								<p>{pkg.description || 'No description'}</p>
								<div className="pkg-meta">
									<span className="pkg-meta-item">
										<IoCloudDownloadSharp color="var(--muted)" />
										{formatCount(pkg.weeklyDownloads || 0)}
									</span>
									<span>v{pkg.versionsCount || '0'}</span>
								</div>
							</a>
						))}
					</div>
				</section>

				<section className="section container">
					<div className="explore-section-grid">
						{categories.length > 0 ? <div>
							<div className="section-head">
								<div className="section-title">
									<h2>Popular Categories</h2>
									<a className="link-blue" href="/categories">View all →</a>
								</div>
							</div>
							{categoriesQuery.loading && <p style={{ color: 'var(--muted)' }}>Loading categories...</p>}
							{categoriesQuery.error && <p style={{ color: 'var(--danger)' }}>Failed to load categories.</p>}
							{!categoriesQuery.loading && !categoriesQuery.error && categories.length === 0 && <p style={{ color: 'var(--muted)' }}>No categories found yet.</p>}
							{!categoriesQuery.loading && !categoriesQuery.error && categories.length > 0 && (
								<div className="category-row" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
									{categories.map((cat) => (
										<a className="category-card hover" href={`/categories/${cat.slug}`} key={cat.slug}>
											{categoryIcons[cat.name] || '•'} {cat.name}
											<span style={{ marginLeft: 'auto', color: 'var(--muted-2)' }}>{cat.packageCount.toLocaleString('en-US')}</span>
										</a>
									))}
									{/* {remainingCount > 0 && (
										<a href={`/categories`} className="category-card" key="more">
											<span style={{ fontSize: "15px" }}>All Categories</span>
											<span style={{ marginLeft: 'auto', color: 'var(--muted-2)' }}>{remainingCount.toLocaleString('en-US')}</span>
										</a>
									)} */}
								</div>
							)}
						</div> : null}

						{orgs.length > 0 ? <div>
							<div className="section-head">
								<div className="section-title">
									<h2>Popular Organizations</h2>
									<a className="link-blue" href="/organizations">View all →</a>
								</div>
							</div>
							<div className="org-grid">
								{orgsQuery.loading && <p style={{ color: 'var(--muted)' }}>Loading...</p>}
								{orgsQuery.error && <p style={{ color: 'var(--danger)' }}>Connection error.</p>}
								{!orgsQuery.loading && !orgsQuery.error && orgs.length === 0 && <p style={{ color: 'var(--muted)' }}>No organizations yet.</p>}
								{orgs.map((org) => {
									const pkgCount = org.packages?.length || 0
									const totalDl = org.packages?.reduce((sum, p) => sum + (p.totalDownloads || 0), 0) || 0
									return (
										<a className="org-card" href={`/organizations/${org.name}`} key={org.name}>
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
						</div> : null}
					</div>
				</section>

				<section className="section container">
					<div className="section-head">
						<div className="section-title">
							<h2>Why Yogi?</h2>
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
