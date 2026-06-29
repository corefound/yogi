'use client'

import { useQuery } from '@apollo/client/react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import {
	GET_CATEGORY,
	GET_PACKAGES_BY_CATEGORY,
	type GetCategoryData,
	type GetPackagesByCategoryData,
	type Package,
} from '@/lib/queries'

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

function formatCount(n: number): string {
	return n.toLocaleString("en-US")
}

function packageIcon(name: string) {
	return name.charAt(0).toUpperCase()
}

export default function CategoryDetailPage() {
	const params = useParams()
	const slug = params?.slug as string

	const categoryQuery = useQuery<GetCategoryData>(GET_CATEGORY, {
		variables: { slug },
		skip: !slug,
	})

	const packagesQuery = useQuery<GetPackagesByCategoryData>(GET_PACKAGES_BY_CATEGORY, {
		variables: { slug },
		skip: !slug,
	})

	const category = categoryQuery.data?.category
	const packages: Package[] = packagesQuery.data?.packagesByCategory || []
	const loading = categoryQuery.loading || packagesQuery.loading
	const error = categoryQuery.error || packagesQuery.error

	return (
		<>
			<TopBar />
			<main className="Home">
				<section className="section container">
					<div className="section-head">
						<div className="section-title">
							{!slug && <p>Category not specified.</p>}
							{slug && loading && <p style={{ color: 'var(--muted)' }}>Loading category...</p>}
							{slug && error && <p style={{ color: 'var(--danger)' }}>Failed to load category.</p>}
							{slug && !loading && !error && !category && <p style={{ color: 'var(--muted)' }}>Category not found.</p>}

							{category && (
								<>
									<h1>
										<span style={{ marginRight: 8 }}>{categoryIcons[category.name] || '•'}</span>
										{category.name}
									</h1>
									<small>{formatCount(category.packageCount)} package{category.packageCount !== 1 ? 's' : ''}</small>
								</>
							)}
						</div>
						<Link className="link-blue" href="/categories">← All Categories</Link>
					</div>

					{!loading && !error && packages.length === 0 && category && (
						<p style={{ color: 'var(--muted)' }}>No packages in this category.</p>
					)}

					<div className="card-grid">
						{packages.map((pkg) => (
							<Link className="package-card" href={`/packages/${pkg.name}`} key={pkg.fullName}>
								<div className="pkg-top">
									<span className="pkg-icon">{packageIcon(pkg.name)}</span>
									<div>
										<div className="pkg-card-name">{pkg.fullName}</div>
										{pkg.owner && (
											<small style={{ color: 'var(--muted-2)' }}>
												by {pkg.owner.displayName || pkg.owner.githubLogin}
											</small>
										)}
									</div>
								</div>
								<p>{pkg.description || 'No description'}</p>
								<div className="pkg-meta">
									<span>⇩ {formatCount(pkg.weeklyDownloads || 0)}/wk</span>
									<span>v{pkg.versionsCount || '0'}</span>
								</div>
							</Link>
						))}
					</div>
				</section>
			</main>
			<Footer />
		</>
	)
}
