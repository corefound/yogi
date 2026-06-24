'use client'

import { useQuery } from '@apollo/client/react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { GET_CATEGORIES, type GetCategoriesData, type Category } from '@/lib/queries'

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

export default function CategoriesPage() {
	const { data, loading, error } = useQuery<GetCategoriesData>(GET_CATEGORIES, { fetchPolicy: 'cache-first' })

	const categories: Category[] = data?.categories || []

	return (
		<>
			<TopBar />
			<main className="Home">
				<section className="section container">
					<div className="section-head">
						<div className="section-title">
							<h1>Categories</h1>
							<small>Browse packages by category</small>
						</div>
					</div>

					{loading && <p style={{ color: 'var(--muted)' }}>Loading categories...</p>}
					{error && <p style={{ color: 'var(--danger)' }}>Failed to load categories.</p>}
					{!loading && !error && categories.length === 0 && <p style={{ color: 'var(--muted)' }}>No categories found.</p>}

					<div className="category-row" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
						{categories.map((cat) => (
							<Link className="category-card" href={`/categories/${cat.slug}`} key={cat.slug}>
								{categoryIcons[cat.name] || '•'} {cat.name}
								<span style={{ marginLeft: 'auto', color: 'var(--muted-2)' }}>{formatCount(cat.packageCount)}</span>
							</Link>
						))}
					</div>
				</section>
			</main>
			<Footer />
		</>
	)
}
