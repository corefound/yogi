'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@apollo/client/react'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/components/AuthProvider'
import { CREATE_PACKAGE, type Package } from '@/lib/queries'

const COMMON_LICENSES = [
  'MIT',
  'Apache-2.0',
  'GPL-3.0-only',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'Unlicense',
  'MPL-2.0',
]

export default function NewPackagePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) { router.push('/') }
  }, [authLoading, user, router])

  const [name, setName] = useState('')
  const [scope, setScope] = useState('')
  const [description, setDescription] = useState('')
  const [license, setLicense] = useState('MIT')
  const [repositoryUrl, setRepositoryUrl] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [error, setError] = useState('')

  const [createPkg, { loading }] = useMutation<{ createPackage: Package }>(CREATE_PACKAGE)

  if (authLoading || !user) { return null }
  const safeUser = user

  function buildFullName(): string {
    const trimmedName = name.trim()
    const trimmedScope = scope.trim()
    if (trimmedScope) {
      return `@${trimmedScope.replace(/^@/, '')}/${trimmedName}`
    }
    return trimmedName
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()
    if (!trimmedName) { setError('Package name is required.'); return }
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(trimmedName)) {
      setError('Package name must start with a lowercase letter or number and can only contain a-z, 0-9, ., _, -.')
      return
    }

    const fullName = buildFullName()

    try {
      const { data } = await createPkg({
        variables: {
          input: {
            name: trimmedName,
            fullName,
            scope: scope.trim() || null,
            description: description.trim() || null,
            license: license || null,
            repositoryUrl: repositoryUrl.trim() || null,
            visibility,
            ownerUserId: safeUser.id,
          },
        },
      })
      if (data?.createPackage?.name) {
        router.push(`/packages/${data.createPackage.name}`)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create package.')
    }
  }

  const previewName = buildFullName()

  return (
    <>
      <TopBar />
      <main className="create-org-page">
        <div className="create-org-bg" />
        <div className="create-org-container">
          <header className="create-org-header">
            <div className="create-org-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <h1>New Package</h1>
            <p>Create a new package to share with the Yogi ecosystem.</p>
          </header>

          <form className="create-org-form" onSubmit={handleSubmit}>
            <div className="create-org-field">
              <label htmlFor="pkg-scope">Scope</label>
              <input
                id="pkg-scope"
                type="text"
                placeholder="e.g. my-org (optional)"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              />
              <span className="create-org-hint">Scoped packages are published as @scope/name.</span>
            </div>

            <div className="create-org-field">
              <label htmlFor="pkg-name">Package name</label>
              <input
                id="pkg-name"
                type="text"
                placeholder="e.g. my-package"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              {previewName && (
                <span className="create-org-hint">
                  Full name: <strong>{previewName}</strong>
                </span>
              )}
            </div>

            <div className="create-org-field">
              <label htmlFor="pkg-desc">Description</label>
              <textarea
                id="pkg-desc"
                placeholder="Briefly describe what your package does…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="create-org-field">
              <label htmlFor="pkg-license">License</label>
              <div className="create-org-license-group">
                <select
                  id="pkg-license"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="create-org-license-select"
                >
                  <option value="">— None —</option>
                  {COMMON_LICENSES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                  <option value="other">Other (specify below)</option>
                </select>
                {license === 'other' && (
                  <input
                    type="text"
                    placeholder="Enter custom license"
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                    className="create-org-license-custom"
                  />
                )}
              </div>
            </div>

            <div className="create-org-field">
              <label htmlFor="pkg-repo">Repository URL</label>
              <input
                id="pkg-repo"
                type="url"
                placeholder="https://github.com/user/repo"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
              />
            </div>

            <div className="create-org-field">
              <label>Visibility</label>
              <div className="create-org-visibility">
                <label className="create-org-radio">
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={visibility === 'public'}
                    onChange={() => setVisibility('public')}
                  />
                  <div className="create-org-radio-body">
                    <strong>Public</strong>
                    <span>Anyone can see and install this package.</span>
                  </div>
                </label>
                <label className="create-org-radio">
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={visibility === 'private'}
                    onChange={() => setVisibility('private')}
                  />
                  <div className="create-org-radio-body">
                    <strong>Private</strong>
                    <span>Only you and invited members can see this package.</span>
                  </div>
                </label>
              </div>
            </div>

            {error && <p className="create-org-error">{error}</p>}

            <div className="create-org-actions">
              <button type="button" className="create-org-cancel" onClick={() => router.back()}>
                Cancel
              </button>
              <button type="submit" className="create-org-submit" disabled={loading}>
                {loading ? 'Creating…' : 'Create Package'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  )
}
