'use client'

import { useQuery } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/components/AuthProvider'
import { GET_USER, type GetUserData } from '@/lib/queries'

function formatCount(n: number): string {
  return n?.toLocaleString('en-US') ?? '0'
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const { data } = useQuery<GetUserData>(GET_USER, {
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
        <main className="profile-page"><p className="profile-loading">Loading...</p></main>
        <Footer />
      </>
    )
  }

  const profile = data?.user
  const totalDownloads = profile?.packages?.reduce((s, p) => s + (p.totalDownloads || 0), 0) ?? 0
  const pkgCount = profile?.packages?.length ?? 0
  const orgCount = profile?.organizations?.length ?? 0

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
            <div className="profile-role">
              <span className={`profile-role-badge ${user.role}`}>{user.role}</span>
            </div>
            <div className="profile-stats">
              <div className="profile-stat">
                <strong>{formatCount(totalDownloads)}</strong>
                <span>Downloads</span>
              </div>
              <div className="profile-stat">
                <strong>{pkgCount}</strong>
                <span>Packages</span>
              </div>
              <div className="profile-stat">
                <strong>{orgCount}</strong>
                <span>Orgs</span>
              </div>
            </div>
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-container">
            <div className="profile-info-grid">
              <div className="profile-info-card">
                <div className="profile-info-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Account
                </div>
                <div className="profile-info-body">
                  <div className="profile-info-row">
                    <span>Email</span>
                    <span>{user.email || 'Not provided'}</span>
                  </div>
                  <div className="profile-info-row">
                    <span>Role</span>
                    <span className="profile-role-badge">{user.role}</span>
                  </div>
                  <div className="profile-info-row">
                    <span>GitHub</span>
                    <a href={`https://github.com/${user.githubLogin}`} target="_blank" rel="noopener noreferrer">
                      @{user.githubLogin}
                    </a>
                  </div>
                </div>
              </div>

              <div className="profile-info-card">
                <div className="profile-info-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  Quick Links
                </div>
                <div className="profile-info-body">
                  <a href="/profile/packages" className="profile-info-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                    My Packages ({pkgCount})
                  </a>
                  <a href="/profile/organizations" className="profile-info-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    My Organizations ({orgCount})
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
