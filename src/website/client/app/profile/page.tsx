'use client'

import { useQuery } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/components/AuthProvider'
import { GET_USER, type GetUserData, type ProfilePackage } from '@/lib/queries'
import { IoCloudDownloadSharp } from 'react-icons/io5'

function formatCount(n: number): string {
  return n?.toLocaleString('en-US') ?? '0'
}

function PackageCard({ pkg }: { pkg: ProfilePackage }) {
  return (
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
        <span>v{pkg.latestVersion || '0.0.0'}</span>
      </div>
    </a>
  )
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const { data, loading: queryLoading, error } = useQuery<GetUserData>(GET_USER, {
    variables: { name: user?.githubLogin ?? '' },
    skip: !user?.githubLogin,
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
    }
  }, [authLoading, user, router])

  if (authLoading || !user) {
    return (
      <>
        <TopBar />
        <main className="profile-page">
          <p className="profile-loading">Loading...</p>
        </main>
        <Footer />
      </>
    )
  }

  const profile = data?.user
  const packages = profile?.packages ?? []

  return (
    <>
      <TopBar />
      <main className="profile-page">
        <section className="profile-hero">
          <div className="profile-hero-bg" />
          <div className="profile-hero-content">
            {user.avatarUrl ? (
              <img className="profile-avatar" src={user.avatarUrl} alt={user.githubLogin} referrerPolicy="no-referrer" />
            ) : (
              <span className="profile-avatar profile-avatar-fallback">
                {user.githubLogin.charAt(0).toUpperCase()}
              </span>
            )}
            <h1>{profile?.displayName || user.githubLogin}</h1>
            <p className="profile-login">@{user.githubLogin}</p>
            {user.email && <p className="profile-email">{user.email}</p>}
            <div className="profile-role">
              <span className={`profile-role-badge ${user.role}`}>{user.role}</span>
            </div>
            <div className="profile-stats">
              <div className="profile-stat">
                <strong>{packages.length}</strong>
                <span>Packages</span>
              </div>
            </div>
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-container">
            <div className="section-head">
              <div className="section-title">
                <h2>My Packages</h2>
                {packages.length > 0 && <small>{packages.length} total</small>}
              </div>
            </div>
            {queryLoading && <p className="profile-loading">Loading packages...</p>}
            {error && <p className="profile-error">Failed to load packages.</p>}
            {!queryLoading && !error && packages.length === 0 && (
              <p className="profile-empty">No packages published yet.</p>
            )}
            {!queryLoading && !error && packages.length > 0 && (
              <div className="card-grid">
                {packages.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
