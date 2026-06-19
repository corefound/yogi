export default function NotFound() {
  return (
    <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, marginBottom: 16 }}>404</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Page not found</p>
      <a className="btn primary" href="/">Go Home</a>
    </div>
  )
}