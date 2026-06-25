'use client'

import { useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import {
	GET_ORGANIZATION_DETAIL,
	type GetOrganizationDetailData,
	type Package,
} from '@/lib/queries'

function formatCount(n: number): string {
	return n.toLocaleString("en-US")
}

function packageIcon(name: string) {
	return name.charAt(0).toUpperCase()
}

type OrgTab = 'readme' | 'packages'

export default function OrganizationDetailPage() {
	const params = useParams()
	const name = params?.name as string
	const [activeTab, setActiveTab] = useState<OrgTab>('packages')

	const { data, loading, error } = useQuery<GetOrganizationDetailData>(GET_ORGANIZATION_DETAIL, {
		variables: { name },
		skip: !name,
	})

	const org = data?.organization
	const packages: Package[] = org?.packages || []

	return (
		<div className="Organization">
			<TopBar />
			<main style={{ flex: 1, minHeight: '60vh' }}>
				{!name && <p>Organization not specified.</p>}
				{name && loading && <p style={{ color: 'var(--muted)', padding: '40px' }}>Loading organization...</p>}
				{name && error && <p style={{ color: 'var(--danger)', padding: '40px' }}>Failed to load organization.</p>}
				{name && !loading && !error && !org && <p style={{ color: 'var(--muted)', padding: '40px' }}>Organization not found.</p>}

				{org && (
					<section className="section container">
						<div className="org-profile-header">
							<div className="org-profile-logo">
								{org.name.charAt(0).toUpperCase()}
							</div>
							<div className="org-profile-info">
								<h1>{org.displayName || org.name}</h1>
								{org.description && <p>{org.description}</p>}
								<div className="org-profile-meta">
									<span>{org.packages?.length || 0} package{(org.packages?.length || 0) !== 1 ? 's' : ''}</span>
								</div>
							</div>
						</div>

						<div className="org-profile-tabs">
							<button
								className={`org-profile-tab ${activeTab === 'readme' ? 'active' : ''}`}
								onClick={() => setActiveTab('readme')}
							>
								README
							</button>
							<button
								className={`org-profile-tab ${activeTab === 'packages' ? 'active' : ''}`}
								onClick={() => setActiveTab('packages')}
							>
								Packages
							</button>
						</div>

						{activeTab === 'readme' && (
							<article className="readme-card" style={{ padding: 24 }}>
								<h2>{org.displayName || org.name}</h2>
								<p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
									{org.description || 'No description provided.'}
								</p>
								<div className="feature-list">
									<div>{org.packages?.length || 0} packages published</div>
								</div>
							</article>
						)}

						{activeTab === 'packages' && (
							<>
								{packages.length === 0 && (
									<p style={{ color: 'var(--muted)' }}>No packages in this organization.</p>
								)}
								<div className="card-grid">
									{packages.map((pkg) => (
										<Link className="package-card" href={`/package/${pkg.name}`} key={pkg.fullName}>
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
										</Link>
									))}
								</div>
							</>
						)}
					</section>
				)}
			</main>
			<Footer />
		</div>
	)
}
