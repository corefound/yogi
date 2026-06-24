'use client'

import { useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import moment from 'moment'
import TopBar from '@/components/TopBar'
import Footer from '@/components/Footer'
import { GET_PACKAGE, GET_PACKAGES, type GetPackageData, type GetPackagesData, type Package } from '@/lib/queries'
import { Area, AreaChart } from 'recharts';
import { RechartsDevtools } from '@recharts/devtools';
import { FaGithub, FaGlobe } from 'react-icons/fa';

type ContentTab = 'readme' | 'versions' | 'files' | 'metrics'

function formatInstalls(n: number | null | undefined): string {
  if (!n) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

// #region Sample data
const data = [
  {
    name: 'Page A',
    uv: 4000,
    pv: 2400,
    amt: 2400,
  },
  {
    name: 'Page B',
    uv: 3000,
    pv: 1398,
    amt: 2210,
  },
  {
    name: 'Page C',
    uv: 2000,
    pv: 9800,
    amt: 2290,
  },
  {
    name: 'Page D',
    uv: 2780,
    pv: 3908,
    amt: 2000,
  },
  {
    name: 'Page E',
    uv: 1890,
    pv: 4800,
    amt: 2181,
  },
  {
    name: 'Page F',
    uv: 2390,
    pv: 3800,
    amt: 2500,
  },
  {
    name: 'Page G',
    uv: 3490,
    pv: 4300,
    amt: 2100,
  },
];

// #endregion
const TinyAreaChart = () => {
  return (
    <AreaChart
      style={{ width: '100%', maxWidth: '300px', maxHeight: '100px', aspectRatio: 1.618 }}
      responsive
      data={data}
      margin={{
        top: 5,
        right: 0,
        left: 0,
        bottom: 5,
      }}
    >
      <Area type="monotone" dataKey="uv" stroke="#8884d8" fill="#8884d8" />
      <RechartsDevtools />
    </AreaChart>
  );
};

function timeAgo(date: string | null | undefined): string {
  if (!date) return ''
  return moment(Number(date)).fromNow()
}

export default function PackageSlugPage() {
  const params = useParams()
  const slug = params.slug as string

  const [contentTab, setContentTab] = useState<ContentTab>('readme')

  const { data, loading, error } = useQuery<GetPackageData>(GET_PACKAGE, {
    variables: { name: slug },
    skip: !slug,
  })

  const { data: recommendedData } = useQuery<GetPackagesData>(GET_PACKAGES, {
    variables: { limit: 4, offset: 0 },
    skip: !error,
  })

  const pkg = data?.package
  const recommended: Package[] = recommendedData?.packages || []
  const notFound = error && !loading

  if (!slug) {
    return (
      <>
        <TopBar />
        <main className="page-shell container" style={{ padding: '80px 0', textAlign: 'center' }}>
          <h1 style={{ fontSize: 48, marginBottom: 16 }}>404</h1>
          <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Package not specified</p>
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
          <p style={{ color: 'var(--muted)' }}>Loading package...</p>
        </main>
        <Footer />
      </>
    )
  }

  if (notFound || !pkg) {
    return (
      <>
        <TopBar />
        <main className="page-shell container" style={{ padding: '80px 0' }}>
          <div className="breadcrumb" style={{ marginBottom: 32 }}>
            Packages <span>›</span> {slug}
          </div>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h1 style={{ fontSize: 48, marginBottom: 16 }}>Package Not Found</h1>
            <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 18 }}>
              No package named <strong>{slug}</strong> exists in the registry.
            </p>
            <a className="btn primary" href="/">Browse Packages</a>
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
                  <a className="package-card" href={`/package/${rec.name}`} key={rec.name}>
                    <div className="pkg-top">
                      <span className="pkg-icon">{rec.name.charAt(0).toUpperCase()}</span>
                      <div>
                        <div className="pkg-card-name">{rec.name}</div>
                      </div>
                    </div>
                    <p>{rec.description || 'No description'}</p>
                    <div className="pkg-meta">
                      <span>⇩ {formatInstalls(rec.totalDownloads)}</span>
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

  const latestVersion = pkg.versions?.[pkg.versions.length - 1]
  const versionStr = latestVersion?.version ? `v${latestVersion.version}` : ''
  const latestVersionBadge = pkg.versions?.length
    ? [...pkg.versions].reverse().find(v => v.version)
    : null

  const formatBytes = (bytes: number, decimals = 2): string => {
    if (!Number.isFinite(bytes)) return "0 bytes";

    if (bytes === 0) return "0 bytes";

    const units = [
      "bytes",
      "KB",
      "MB",
      "GB",
      "TB",
      "PB",
      "EB",
      "ZB",
      "YB",
    ];

    const base = 1024;
    const isNegative = bytes < 0;
    let size = Math.abs(bytes);

    const unitIndex = Math.min(
      Math.floor(Math.log(size) / Math.log(base)),
      units.length - 1
    );

    size = size / Math.pow(base, unitIndex);

    const formatted =
      unitIndex === 0
        ? Math.round(size).toString()
        : Number(size.toFixed(decimals)).toString();

    const unit =
      unitIndex === 0
        ? Number(formatted) === 1
          ? "byte"
          : "bytes"
        : units[unitIndex];

    return `${isNegative ? "-" : ""}${formatted} ${unit}`;
  };

  const metrics = [
    {
      lavel: 'Weekly Downloads',
      value: pkg.weeklyDownloads?.toLocaleString("en-US") || '0',
      spark: "spark"
    },
    {
      lavel: 'Total Downloads',
      value: pkg.totalDownloads?.toLocaleString("en-US") || '0',
      spark: "spark"
    },
    {
      lavel: 'Current Version',
      value: latestVersion?.version ? "v" + latestVersion?.version : "N/A",
      spark: ""
    },
    {
      lavel: 'License',
      value: pkg.license || 'N/A',
      spark: ""
    },
    {
      lavel: 'Last Published',
      value: latestVersion?.publishedAt ? moment(Number(latestVersion.publishedAt)).fromNow() : 'N/A',
      spark: ""
    },
    {
      lavel: 'Package Size',
      value: latestVersion?.assetSizeBytes ? formatBytes((Number(latestVersion.assetSizeBytes) / 1024)) : 'N/A',
      spark: ""
    },
  ]

  const truncateText = (text: string, maxLength = 38): string => {
    if (!text) return "";

    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength)}...`;
  };


  return (
    <>
      <TopBar />

      <main className="page-shell container">
        <div className="breadcrumb">
          Packages <span>›</span> {pkg.owner?.githubLogin || '?'} <span>›</span> {pkg.name}
        </div>

        <section className="package-hero">
          <div className="package-title-row">
            <div className="big-package-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div>
              <h1>{pkg.name}</h1>
              <p>{pkg.description || 'No description available.'}</p>
              <div className="hero-meta">
                {/* {pkg.owner && <span>{pkg.owner.githubLogin || pkg.owner.displayName}</span>}
                <span className="badge">Maintainer</span> */}
                {/* <span>{formatInstalls(pkg.weeklyDownloads || 0)} weekly downloads</span> */}
              </div>
            </div>
          </div>
          <div className="actions-row"></div>
        </section>

        <section className="install-panel">
          <div className="code-line" id="install-command">
            <span className="prompt">$</span>&nbsp; yogi add {pkg.name}
            <button className="copy-btn" onClick={() => navigator.clipboard.writeText(`yogi add ${pkg.name}`)}>Copy</button>
          </div>
        </section>

        <div className="package-layout">
          <section>
            <div className="content-tabs">
              <button className={`${contentTab === 'readme' ? 'active' : ''}`} onClick={() => setContentTab('readme')}>
                README
              </button>
              <button className={`${contentTab === 'versions' ? 'active' : ''}`} onClick={() => setContentTab('versions')}>
                Versions {pkg.versions?.length ? <span className="badge">{pkg.versions.length}</span> : null}
              </button>
              <button className={`${contentTab === 'files' ? 'active' : ''}`} onClick={() => setContentTab('files')}>
                Files
              </button>
              <button className={`${contentTab === 'metrics' ? 'active' : ''}`} onClick={() => setContentTab('metrics')}>
                Metrics
              </button>
            </div>

            <div className="metrics">
              {metrics.map((metric) => (
                <div className="metric">
                  <small>{metric.lavel}</small>
                  <strong style={{ fontSize: 14 }}>{metric.value}</strong>
                  {/* {metric.spark ? <TinyAreaChart /> : null} */}
                </div>
              ))}
            </div>

            {contentTab === 'readme' && (
              <article className="readme-card">
                <h2>{pkg.name}</h2>
                <p style={{ color: 'var(--muted)' }}>
                  {pkg.description || 'No description'}
                </p>
                <h3>Features</h3>
                <div className="feature-list">
                  <div>Fast and reliable package management</div>
                  <div>Works with Node.js, Deno, Bun, and modern browsers</div>
                  <div>Promise-based API with async/await support</div>
                  <div>TypeScript-first with smart inference</div>
                  <div>Secure by default with vulnerability scanning</div>
                </div>
                {pkg.readmeText && (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    {pkg.readmeText}
                  </div>
                )}
              </article>
            )}

            {contentTab === 'versions' && (
              <article className="readme-card">
                <h2>Versions {pkg.versions?.length ? `(${pkg.versions.length})` : ''}</h2>
                <p style={{ color: 'var(--muted)' }}>
                  All published versions of {pkg.name}
                </p>
                {pkg.versions?.length ? (
                  <div className="feature-list">
                    {[...pkg.versions].reverse().map((v) => (
                      <Link href={`/package/${pkg.name}/v${v.version}`} key={v.id} style={{ display: 'block', textDecoration: 'none', color: 'inherit', padding: '8px 0' }}>
                        <strong>v{v.version}</strong>
                        {v.publishedAt ? (
                          <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
                            — {v === latestVersion ? 'Latest (' : ''}{timeAgo(v.publishedAt)}{v === latestVersion ? ')' : ''}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--muted)' }}>No versions published yet.</p>
                )}
              </article>
            )}
          </section>

          <aside>
            <div className="side-card">
              <h3>Package links</h3>
              {pkg.repoFullName ? (
                <a className="side-link" href={`https://github.com/${pkg.repoFullName}`} target="_blank" rel="noopener noreferrer">
                  <FaGithub size={22} />

                  <span>{truncateText(pkg.repositoryUrl?.replace(/https?:\/\//, '').replace(/http?:\/\//, '') || "", 30)} ›</span>
                </a>
              ) : null}
              {pkg.homepageUrl ? (
                <a className="side-link" href={pkg.homepageUrl} target="_blank" rel="noopener noreferrer">
                  <FaGlobe color="var(--text)" size={22} />
                  <span style={{ color: 'var(--text)' }}>{truncateText(pkg.homepageUrl?.replace(/https?:\/\//, '').replace(/http?:\/\//, '') || "", 30)} ›</span>
                </a>
              ) : null}
            </div>
            <div className="side-card">
              <h3>Keywords</h3>
              <div className="tags">
                <span className="tag">{pkg.name}</span>
                {pkg.name.includes('-') ? pkg.name.split('-').map((part, i) => (
                  <span className="tag" key={i}>{part}</span>
                )) : null}
                <span className="tag">javascript</span>
                <span className="tag">typescript</span>
                <span className="tag">node</span>
                <span className="tag">web</span>
              </div>
            </div>
            {pkg.owner ? (
              <div className="side-card">
                <h3>Maintainers</h3>
                <div className="maintainers">
                  <span className="mini-avatar"></span>
                  <span>{pkg.owner.githubLogin || pkg.owner.displayName || 'Unknown'}</span>
                </div>
              </div>
            ) : null}
            {latestVersion ? (
              <div className="side-card">
                <h3>Publish activity</h3>
                <p style={{ color: 'var(--muted)', margin: 0 }}>
                  {latestVersion.publishedAt ? timeAgo(latestVersion.publishedAt) : 'N/A'}
                  <br />
                  Version {latestVersion.version}
                </p>
                <a className="link-blue" href="#">
                  View full history →
                </a>
              </div>
            ) : null}
          </aside>
        </div>
      </main>

      <Footer />
    </>
  )
}