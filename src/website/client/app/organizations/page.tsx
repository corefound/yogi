'use client'

import { useQuery } from '@apollo/client/react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { GET_ORGANIZATIONS, type GetOrganizationsData, type Organization } from '@/lib/queries'

function formatCount(n: number): string {
	return n.toLocaleString("en-US")
}

export default function OrganizationsPage() {
	const { data, loading, error } = useQuery<GetOrganizationsData>(GET_ORGANIZATIONS, { fetchPolicy: 'cache-first' })

	const orgs: Organization[] = data?.organizations || []

	return (
		<div>
			<TopBar />
			<main style={{ flex: 1, minHeight: '60vh' }} className="Home">
				<section className="section container">
					<div className="section-head">
						<div className="section-title">
							<h1>Organizations</h1>
							<small>Trusted teams building the ecosystem</small>
						</div>
					</div>

					{loading && <p style={{ color: 'var(--muted)' }}>Loading organizations...</p>}
					{error && <p style={{ color: 'var(--danger)' }}>Failed to load organizations.</p>}
					{!loading && !error && orgs.length === 0 && <p style={{ color: 'var(--muted)' }}>No organizations found.</p>}

					<div className="category-row" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
						{orgs.map((org) => {
							const pkgCount = org.packages?.length || 0
							const totalDl = org.packages?.reduce((sum, p) => sum + (p.totalDownloads || 0), 0) || 0
							return (
								<Link className="category-card" href={`/organizations/${org.name}`} key={org.name}>
									<div className="org-logo" style={{ background: 'linear-gradient(135deg, #1c6bd1, #59c8ff)', width: 35, height: 35, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, flexShrink: 0 }}>
										<span style={{  }}>
											{org.name.charAt(0).toUpperCase()}
										</span>
									</div>

									<div>
										<strong style={{ color: 'var(--fg)', fontSize: 14 }}>{org.displayName || org.name}</strong>
										<small style={{ color: 'var(--muted-2)', display: 'block' }}>
											{pkgCount} {pkgCount === 1 ? 'package' : 'packages'} · {formatCount(totalDl)} downloads
										</small>
									</div>
								</Link>
							)
						})}
					</div>
				</section>
			</main>
			<Footer />
		</div>
	)
}
