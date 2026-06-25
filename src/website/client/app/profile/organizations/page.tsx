'use client'

import { useQuery } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/components/AuthProvider'
import { GET_USER, type GetUserData } from '@/lib/queries'

export default function ProfileOrganizationsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const { data, loading, error } = useQuery<GetUserData>(GET_USER, {
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

  const organizations = data?.user?.organizations ?? []

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
            <h1>My Organizations</h1>
            <p className="profile-login">@{user.githubLogin}</p>
            <div className="profile-stats">
              <div className="profile-stat">
                <strong>{organizations.length}</strong>
                <span>Total</span>
              </div>
            </div>
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-container">
            {loading && <p className="profile-loading">Loading organizations...</p>}
            {error && <p className="profile-error">Failed to load organizations.</p>}
            {!loading && !error && organizations.length === 0 && (
              <p className="profile-empty">No organizations yet.</p>
            )}
            {!loading && !error && organizations.length > 0 && (
              <div className="profile-org-grid">
                {organizations.map((org) => (
                  <a className="profile-org-card" href={`/organizations/${org.name}`} key={org.name}>
                    <div className="profile-org-logo">{org.name.charAt(0).toUpperCase()}</div>
                    <div className="profile-org-body">
                      <strong>{org.displayName || org.name}</strong>
                      <p>{org.description || 'No description'}</p>
                    </div>
                  </a>
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
