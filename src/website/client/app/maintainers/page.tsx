'use client'

import { useQuery } from '@apollo/client/react'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { GET_MAINTAINERS, type GetMaintainersData, type User } from '@/lib/queries'

export default function MaintainersPage() {
	const { data, loading, error } = useQuery<GetMaintainersData>(GET_MAINTAINERS, { fetchPolicy: 'cache-first' })

	const maintainers: User[] = data?.gayMaintainers || []

	return (
		<div className="Maintainers">
			<TopBar />
			<main className="">
				<section className="section container">
					<div className="section-head">
						<div className="section-title">
							<h1>Maintainers</h1>
							<small>People building and maintaining the ecosystem</small>
						</div>
					</div>

					{loading && <p style={{ color: 'var(--muted)' }}>Loading maintainers...</p>}
					{error && <p style={{ color: 'var(--danger)' }}>Failed to load maintainers.</p>}
					{!loading && !error && maintainers.length === 0 && <p style={{ color: 'var(--muted)' }}>No maintainers found.</p>}

					<div className="category-row" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
						{maintainers.map((user) => (
							<a
								className="category-card"
								key={user.id}
								href={`https://github.com/${user.githubLogin}`}
								target="_blank"
								rel="noopener noreferrer"
							>
								{user.avatarUrl ? (
									<img
										src={user.avatarUrl}
										alt={user.displayName || user.githubLogin}
										style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
									/>
								) : (
									<span className="mini-avatar" style={{ width: 36, height: 36, flexShrink: 0 }}>
										{(user.displayName || user.githubLogin).charAt(0).toUpperCase()}
									</span>
								)}
								<div style={{ minWidth: 0 }}>
									<strong style={{ color: 'var(--fg)', fontSize: 14 }}>{user.displayName || user.githubLogin}</strong>
									<small style={{ color: 'var(--muted-2)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										@{user.githubLogin}
									</small>
								</div>
								<svg style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--muted-2)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
									<polyline points="15 3 21 3 21 9" />
									<line x1="10" y1="14" x2="21" y2="3" />
								</svg>
							</a>
						))}
					</div>
				</section>
			</main>
			<div className="Footer">
				<Footer />
			</div>
		</div>
	)
}
