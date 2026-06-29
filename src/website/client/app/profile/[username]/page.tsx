'use client'

import { useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { GET_USER, type GetUserData, type ProfilePackage, type ProfileOrganization } from '@/lib/queries'

function formatCount(n: number): string {
	return n?.toLocaleString('en-US') ?? '0'
}

type UserTab = 'packages' | 'organizations'

function PackageCard({ pkg }: { pkg: ProfilePackage }) {
	return (
		<Link className="package-card" href={`/packages/${pkg.name}`}>
			<div className="pkg-top">
				{pkg.logo ? (
					<div className="small-package-logo">
						<img src={pkg.logo} alt="" style={{ objectFit: 'contain' }} />
					</div>
				) : (
					<div className="small-package-icon">
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
						</svg>
					</div>
				)}
				<div>
					<div className="pkg-card-name">{pkg.name}</div>
				</div>
			</div>
			<p>{pkg.description || 'No description'}</p>
			<div className="pkg-meta">
				<span>⇩ {formatCount(pkg.weeklyDownloads || 0)}/wk</span>
				<span>v{pkg.latestVersion || '0.0.0'}</span>
			</div>
		</Link>
	)
}

function OrgCard({ org }: { org: ProfileOrganization }) {
	return (
		<Link className="package-card" href={`/organizations/${org.name}`}>
			<div className="pkg-top">
				<div className="small-package-icon" style={{ background: 'linear-gradient(135deg, #1c6bd1, #59c8ff)' }}>
					{org.avatarUrl ? (
						<img src={org.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
					) : (
						<span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>
							{(org.displayName || org.name).charAt(0).toUpperCase()}
						</span>
					)}
				</div>
				<div>
					<div className="pkg-card-name">{org.displayName || org.name}</div>
				</div>
			</div>
			<p>{org.description || 'No description'}</p>
		</Link>
	)
}

export default function PublicProfilePage() {
	const params = useParams<{ username: string }>()
	const username = params?.username
	const [tab, setTab] = useState<UserTab>('packages')

	const { data, loading, error } = useQuery<GetUserData>(GET_USER, {
		variables: { name: username ?? '' },
		skip: !username,
		fetchPolicy: 'cache-and-network',
	})

	if (!username) {
		return (
			<>
				<TopBar />
				<main style={{ flex: 1, minHeight: '60vh' }}><p style={{ color: 'var(--muted)', padding: 40 }}>No user specified.</p></main>
				<Footer />
			</>
		)
	}

	const profile = data?.user

	if (!loading && error) {
		return (
			<>
				<TopBar />
				<main style={{ flex: 1, minHeight: '60vh' }}>
					<p style={{ color: 'var(--muted)', padding: 40 }}>User not found.</p>
				</main>
				<Footer />
			</>
		)
	}

	if (loading || !profile) {
		return (
			<>
				<TopBar />
				<main style={{ flex: 1, minHeight: '60vh' }}><p style={{ color: 'var(--muted)', padding: 40 }}>Loading...</p></main>
				<Footer />
			</>
		)
	}

	const packages = profile.packages ?? []
	const organizations = profile.organizations ?? []

	return (
		<div className="Organization">
			<TopBar />
			<main style={{ flex: 1, minHeight: '60vh' }}>
				<section className="section container">
					<div className="org-profile-header">
						<div className="org-profile-logo" style={{ background: 'none', overflow: 'hidden', padding: 0 }}>
							{profile.avatarUrl ? (
								<img src={profile.avatarUrl} alt={profile.githubLogin} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} />
							) : (
								<div className="small-package-logo">
									<span style={{ color: 'var(--muted)' }}>{profile.githubLogin.charAt(0).toUpperCase()}</span>
								</div>
							)}
						</div>
						<div className="org-profile-info">
							<h1>{profile.displayName || profile.githubLogin}</h1>
							<p>@{profile.githubLogin}</p>
							<div className="org-profile-meta">
								<span>{packages.length} package{packages.length !== 1 ? 's' : ''}</span>
								<span>{organizations.length} organization{organizations.length !== 1 ? 's' : ''}</span>
							</div>
						</div>
					</div>

					<div className="org-profile-tabs">
						<button
							className={`org-profile-tab ${tab === 'packages' ? 'active' : ''}`}
							onClick={() => setTab('packages')}
						>
							Packages
						</button>
						<button
							className={`org-profile-tab ${tab === 'organizations' ? 'active' : ''}`}
							onClick={() => setTab('organizations')}
						>
							Organizations
						</button>
					</div>

					{tab === 'packages' && (
						<>
							{loading && <p style={{ color: 'var(--muted)' }}>Loading packages...</p>}
							{!loading && packages.length === 0 && (
								<p style={{ color: 'var(--muted)' }}>No packages published yet.</p>
							)}
							{!loading && packages.length > 0 && (
								<div className="card-grid">
									{packages.map((pkg) => (
										<PackageCard key={pkg.id} pkg={pkg} />
									))}
								</div>
							)}
						</>
					)}

					{tab === 'organizations' && (
						<>
							{loading && <p style={{ color: 'var(--muted)' }}>Loading organizations...</p>}
							{!loading && organizations.length === 0 && (
								<p style={{ color: 'var(--muted)' }}>No organizations yet.</p>
							)}
							{!loading && organizations.length > 0 && (
								<div className="card-grid">
									{organizations.map((org) => (
										<OrgCard key={org.id} org={org} />
									))}
								</div>
							)}
						</>
					)}
				</section>
			</main>
			<Footer />
		</div>
	)
}
