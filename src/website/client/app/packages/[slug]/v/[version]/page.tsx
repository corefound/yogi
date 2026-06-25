'use client'

import { useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import moment from 'moment'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { GET_VERSION_PROFILE, type GetVersionProfileData, GET_PACKAGES, type GetPackagesData, type Package } from '@/lib/queries'
import { FaGithub, FaGlobe } from 'react-icons/fa'

type ContentTab = 'readme' | 'versions' | 'dependencies' | 'metrics'



function timeAgo(date: string | null | undefined): string {
  if (!date) return ''
  return moment(Number(date)).fromNow()
}

function formatBytes(bytes: string | null | undefined): string {
  const n = Number(bytes)
  if (!n || !Number.isFinite(n)) return '0 bytes'
  if (n < 1024) return `${Math.round(n)} bytes`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function formatInstalls(n: string | null | undefined): string {
  const num = Number(n)
  if (!num) return '0'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return String(num)
}

function platformIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="2" x2="9" y2="4" />
      <line x1="15" y1="2" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="22" />
      <line x1="15" y1="20" x2="15" y2="22" />
      <line x1="2" y1="9" x2="4" y2="9" />
      <line x1="2" y1="15" x2="4" y2="15" />
      <line x1="20" y1="9" x2="22" y2="9" />
      <line x1="20" y1="15" x2="22" y2="15" />
    </svg>
  )
}

export default function VersionDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const versionStr = params.version as string

  const [contentTab, setContentTab] = useState<ContentTab>('readme')
  const [copied, setCopied] = useState(false)

  const { data, loading, error } = useQuery<GetVersionProfileData>(GET_VERSION_PROFILE, {
    variables: { name: slug, version: versionStr },
    skip: !slug || !versionStr,
  })

  const { data: recommendedData } = useQuery<GetPackagesData>(GET_PACKAGES, {
    variables: { limit: 4, offset: 0 },
    skip: !error,
  })

  const profile = data?.versionProfile

  console.log({ profile })
  const recommended: Package[] = recommendedData?.packages || []
  const notFound = error && !loading

  if (!slug || !versionStr) {
    return (
      <>
        <TopBar />
        <main className="page-shell container" style={{ padding: '80px 0', textAlign: 'center' }}>
          <h1 style={{ fontSize: 48, marginBottom: 16 }}>404</h1>
          <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Version not specified</p>
          <a className="btn primary" href="/">Go Home</a>
        </main>
        <Footer />
      </>
    )
  }

  if (loading) {
    return (
      <>
        <TopBar />
        <main className="page-shell container" style={{ padding: '80px 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)' }}>Loading version...</p>
        </main>
        <Footer />
      </>
    )
  }

  if (notFound || !profile) {
    return (
      <>
        <TopBar />
        <main className="page-shell container" style={{ padding: '80px 0' }}>
          <div className="breadcrumb" style={{ marginBottom: 32 }}>
            Packages <span>›</span> {slug} <span>›</span> v{versionStr}
          </div>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h1 style={{ fontSize: 48, marginBottom: 16 }}>Version Not Found</h1>
            <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 18 }}>
              Version <strong>v{versionStr}</strong> of <strong>{slug}</strong> does not exist.
            </p>
            <Link className="btn primary" href={`/packages/${slug}`}>View Package</Link>
          </div>
          {recommended.length > 0 && (
            <section>
              <div className="section-head" style={{ marginBottom: 24 }}>
                <div className="section-title">
                  <h2>Recommended Packages</h2>
                  <small>You might be interested in</small>
                </div>
              </div>
              <div className="card-grid">
                {recommended.map((rec) => (
                  <a className="package-card" href={`/packages/${rec.name}`} key={rec.name}>
                    <div className="pkg-top">
                      <span className="pkg-icon">{rec.name.charAt(0).toUpperCase()}</span>
                      <div>
                        <div className="pkg-card-name">{rec.name}</div>
                      </div>
                    </div>
                    <p>{rec.description || 'No description'}</p>
                    <div className="pkg-meta">
                      <span>⇩ {formatInstalls(rec.totalDownloads?.toString())}</span>
                      <span>v{rec.versionsCount || '0'}</span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}
        </main>
        <Footer />
      </>
    )
  }

  const metrics = [
    { label: 'Weekly Downloads', value: profile.weeklyDownloads?.toLocaleString("en-US") || '0' },
    { label: 'Total Downloads', value: profile.totalDownloads?.toLocaleString("en-US") || '0' },
    { label: 'Version', value: `v${profile.version}` },
    { label: 'License', value: profile.license || 'N/A' },
    { label: 'Published', value: profile.publishedAt ? timeAgo(profile.publishedAt) : 'N/A' },
    { label: 'Package Size', value: profile.assetSizeBytes ? formatBytes(profile.assetSizeBytes) : 'N/A' },
  ]

  const truncateText = (text: string, maxLength = 38): string => {
    if (!text) return ""
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength)}...`
  }

  const depCount = profile.dependencies?.length || 0

  return (
    <>
      <TopBar />

      <main className="page-shell container">
        <div className="breadcrumb">
          <Link href="/packages">Packages</Link> <span>›</span>
          {profile.scope ? <><Link href="/packages">{profile.scope}</Link> <span>›</span></> : null}
          <Link href={`/packages/${slug}`}>{slug}</Link> <span>›</span>
          v{profile.version}
        </div>

        <section className="package-hero">
          <div className="package-title-row">
            <div className="big-package-icon">
              {profile.logo ? (
                <img src={profile.logo} alt={`${slug} logo`} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }} />
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              )}
            </div>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {slug}
                <span style={{ fontSize: 20, fontWeight: 400, color: 'var(--muted)' }}>v{profile.version}</span>
                {profile.isLatestVersion && <span className="latest-badge">Latest</span>}
              </h1>
              <p>{profile.versionDescription || profile.description || 'No description available.'}</p>
              <div className="hero-meta">
                {profile.platforms && profile.platforms.length > 0 && (
                  <div className="tags" style={{ marginTop: 4 }}>
                    {profile.platforms.map((platform) => (
                      <span className="tag" key={platform} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {platformIcon()} {platform}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="install-panel" style={{ position: 'relative' }}>
          <div className="code-line">
            <span className="prompt">$</span>&nbsp;yogi add {profile.name}@{profile.version}
            <button className="copy-btn" onClick={() => {
              navigator.clipboard.writeText(`yogi add ${profile.name}@${profile.version}`)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }} style={copied ? { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' } : {}}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {/* {copied && <span style={{ position: 'absolute', right: 10, top: -12, fontSize: 12, fontWeight: 600, color: '#60a5fa', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.2)', animation: 'fadeIn 0.15s ease' }}>Copied!</span>} */}
        </section>

        <div className="package-layout">
          <section>
            <div className="content-tabs">
              <button className={`${contentTab === 'readme' ? 'active' : ''}`} onClick={() => setContentTab('readme')}>
                README
              </button>
              <button className={`${contentTab === 'versions' ? 'active' : ''}`} onClick={() => setContentTab('versions')}>
                Versions {profile.versions?.length ? <span className="badge">{profile.versions.length}</span> : null}
              </button>
              <button className={`${contentTab === 'dependencies' ? 'active' : ''}`} onClick={() => setContentTab('dependencies')}>
                Dependencies {depCount > 0 ? <span className="badge">{depCount}</span> : null}
              </button>
              <button className={`${contentTab === 'metrics' ? 'active' : ''}`} onClick={() => setContentTab('metrics')}>
                Metrics
              </button>
            </div>

            <div className="metrics">
              {metrics.map((metric, i) => (
                <div className="metric" key={i}>
                  <small>{metric.label}</small>
                  <strong style={{ fontSize: 14 }}>{metric.value}</strong>
                </div>
              ))}
            </div>

            {contentTab === 'readme' && (
              <article className="readme-card">
                <h2>{slug} v{profile.version}</h2>
                <p style={{ color: 'var(--muted)' }}>
                  {profile.versionDescription || profile.description || 'No description'}
                </p>
                {profile.platforms && profile.platforms.length > 0 && (
                  <>
                    <h3>Supported Platforms</h3>
                    <div className="tags" style={{ gap: 6, marginBottom: 16 }}>
                      {profile.platforms.map((platform) => (
                        <span className="tag" key={platform} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 13 }}>
                          {platformIcon()} {platform}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {profile.versionReadmeText && (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    {profile.versionReadmeText}
                  </div>
                )}
              </article>
            )}

            {contentTab === 'versions' && (
              <article className="readme-version-card">
                <div className="p-20">
                  <h2>Versions {profile.versions?.length ? `(${profile.versions.length})` : ''}</h2>
                  <p style={{ color: 'var(--muted)' }}>
                    All published versions of {slug}
                  </p>
                </div>
                {profile.versions?.length ? (
                  <div className="version-list">
                    {profile.versions.map((v) => {
                      const size = v.assetSizeBytes ? formatBytes(v.assetSizeBytes) : null
                      const installs = v.installCount ? formatInstalls(v.installCount) : null
                      return (
                        <Link
                          href={`/packages/${slug}/v/${v.version}`}
                          key={v.id}
                          className="version-row px-20"
                          style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span className="version-number" style={{ fontWeight: 600, fontSize: 15 }}>v{v.version}</span>
                              {v.version === profile.version && <span className="latest-badge">Current</span>}
                              {v.description && <span style={{ color: 'var(--muted)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.description}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--muted)' }}>
                              {v.publishedAt && <span>{timeAgo(v.publishedAt)}</span>}
                              {size && <span>{size}</span>}
                              {installs && <span>{installs} installs</span>}
                            </div>
                            {v.platforms && v.platforms.length > 0 && (
                              <div className="tags" style={{ marginTop: 6, gap: 4 }}>
                                {v.platforms.map((p) => (
                                  <span className="tag" key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '2px 6px' }}>
                                    {platformIcon()} {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span style={{ color: 'var(--muted)', fontSize: 18 }}>›</span>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ color: 'var(--muted)' }}>No versions published yet.</p>
                )}
              </article>
            )}

            {contentTab === 'dependencies' && (
              <article className="readme-card">
                <h2>Dependencies {depCount > 0 ? `(${depCount})` : ''}</h2>
                <p style={{ color: 'var(--muted)' }}>
                  Packages that {slug} v{profile.version} depends on
                </p>
                {depCount > 0 ? (
                  <div className="feature-list" style={{ display: 'flex', flexDirection: 'column' }}>
                    {profile.dependencies!.map((dep, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, background: 'var(--surface)', marginBottom: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                            {dep.dependencyName.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <Link href={`/packages/${dep.dependencyName}`} style={{ fontWeight: 600, fontSize: 14, textDecoration: 'none', color: 'inherit' }}>
                              {dep.dependencyName}
                            </Link>
                            {dep.dependencyType && (
                              <span className="tag" style={{ marginLeft: 8, fontSize: 11, padding: '1px 6px' }}>{dep.dependencyType}</span>
                            )}
                          </div>
                        </div>
                        <span style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'monospace' }}>{dep.versionRange}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--muted)' }}>No dependencies.</p>
                )}
              </article>
            )}

            {contentTab === 'metrics' && (
              <article className="readme-card">
                <h2>Metrics</h2>
                <p style={{ color: 'var(--muted)' }}>
                  Usage statistics for {slug} v{profile.version}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                  <div className="side-card" style={{ margin: 0 }}>
                    <h3>Installs</h3>
                    <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{formatInstalls(profile.installCount)}</p>
                    <small style={{ color: 'var(--muted)' }}>Total installs of this version</small>
                  </div>
                  <div className="side-card" style={{ margin: 0 }}>
                    <h3>Asset Size</h3>
                    <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{formatBytes(profile.assetSizeBytes)}</p>
                    <small style={{ color: 'var(--muted)' }}>{profile.minifiedSizeBytes ? `${formatBytes(profile.minifiedSizeBytes)} minified` : 'Full package'}</small>
                  </div>
                </div>
              </article>
            )}
          </section>

          <aside>
            <div className="side-card">
              <h3>Package links</h3>
              {profile.repositoryUrl ? (
                <a className="side-link" href={profile.repositoryUrl} target="_blank" rel="noopener noreferrer">
                  <FaGithub size={22} />
                  <span>{truncateText(profile.repositoryUrl.replace(/https?:\/\//, ''), 30)} ›</span>
                </a>
              ) : null}
              {profile.homepageUrl ? (
                <a className="side-link" href={profile.homepageUrl} target="_blank" rel="noopener noreferrer">
                  <FaGlobe color="var(--text)" size={22} />
                  <span style={{ color: 'var(--text)' }}>{truncateText(profile.homepageUrl.replace(/https?:\/\//, ''), 30)} ›</span>
                </a>
              ) : null}
            </div>
            <div className="side-card">
              <h3>Keywords</h3>
              <div className="tags">
                <Link className="tag" href={`/categories/${slug}`} style={{ textDecoration: 'none' }}>{slug}</Link>
                {slug.includes('-') ? slug.split('-').map((part, i) => (
                  <Link className="tag" href={`/categories/${part}`} key={i} style={{ textDecoration: 'none' }}>{part}</Link>
                )) : null}
                {profile.keywords?.slice(0, 4).map((kw) => (
                  <Link className="tag" href={`/categories/${kw}`} key={kw} style={{ textDecoration: 'none' }}>{kw}</Link>
                ))}
              </div>
            </div>
            {profile.owner ? (
              <div className="side-card">
                <h3>Maintainers</h3>
                <div className="maintainers">
                  <span className="mini-avatar"></span>
                  <span>{profile.owner.githubLogin || profile.owner.displayName || 'Unknown'}</span>
                </div>
              </div>
            ) : null}
            <div className="side-card">
              <h3>Publish activity</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                {profile.publishedAt ? timeAgo(profile.publishedAt) : 'N/A'}
                <br />
                Version {profile.version}
              </p>
              <Link className="link-blue" href={`/packages/${slug}`}>
                View package →
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </>
  )
}
