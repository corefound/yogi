'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@apollo/client/react'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/components/AuthProvider'
import { CREATE_ORGANIZATION, type Organization } from '@/lib/queries'

export default function NewOrganizationPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) { router.push('/') }
  }, [authLoading, user, router])

  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [memberInput, setMemberInput] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [error, setError] = useState('')

  const [createOrg, { loading }] = useMutation<{ createOrganization: Organization }>(CREATE_ORGANIZATION)

  if (authLoading || !user) { return null }
  const safeUser = user

  function addMember() {
    const login = memberInput.trim()
    if (login && !members.includes(login)) {
      setMembers([...members, login])
    }
    setMemberInput('')
  }

  function removeMember(login: string) {
    setMembers(members.filter((m) => m !== login))
  }

  function handleMemberKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addMember()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()
    if (!trimmedName) { setError('Organization name is required.'); return }

    try {
      const { data } = await createOrg({
        variables: {
          input: {
            name: trimmedName,
            displayName: displayName.trim() || null,
            description: description.trim() || null,
            members,
            ownerUserId: safeUser.id,
          },
        },
      })
      if (data?.createOrganization?.name) {
        router.push(`/organizations/${data.createOrganization.name}`)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create organization.')
    }
  }

  return (
    <>
      <TopBar />
      <main className="create-org-page">
        <div className="create-org-bg" />
        <div className="create-org-container">
          <header className="create-org-header">
            <div className="create-org-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h1>New Organization</h1>
            <p>Create a new organization to group and manage your packages.</p>
          </header>

          <form className="create-org-form" onSubmit={handleSubmit}>
            <div className="create-org-field">
              <label htmlFor="org-name">Organization name</label>
              <input
                id="org-name"
                type="text"
                placeholder="e.g. my-organization"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <span className="create-org-hint">Must be unique and can only contain lowercase letters, numbers, and hyphens.</span>
            </div>

            <div className="create-org-field">
              <label htmlFor="org-display">Display name</label>
              <input
                id="org-display"
                type="text"
                placeholder="e.g. My Organization"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className="create-org-field">
              <label htmlFor="org-desc">Description</label>
              <textarea
                id="org-desc"
                placeholder="Briefly describe what this organization is about…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="create-org-field">
              <label>Members</label>
              <div className="create-org-member-input">
                <input
                  type="text"
                  placeholder="Enter a GitHub username"
                  value={memberInput}
                  onChange={(e) => setMemberInput(e.target.value)}
                  onKeyDown={handleMemberKey}
                />
                <button type="button" className="create-org-add-btn" onClick={addMember}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add
                </button>
              </div>
              {members.length > 0 && (
                <div className="create-org-member-list">
                  {members.map((m) => (
                    <span key={m} className="create-org-member-tag">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {m}
                      <button type="button" className="create-org-member-remove" onClick={() => removeMember(m)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <span className="create-org-hint">Add GitHub usernames to invite members to this organization.</span>
            </div>

            {error && <p className="create-org-error">{error}</p>}

            <div className="create-org-actions">
              <button type="button" className="create-org-cancel" onClick={() => router.back()}>
                Cancel
              </button>
              <button type="submit" className="create-org-submit" disabled={loading}>
                {loading ? 'Creating…' : 'Create Organization'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  )
}
