'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ backgroundColor: '#f0f4f8', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #fecaca', padding: '24px', maxWidth: '32rem', width: '100%' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#b91c1c', marginBottom: '8px' }}>
              Something went wrong
            </h2>
            <pre style={{ fontSize: '12px', color: '#dc2626', background: '#fef2f2', borderRadius: '8px', padding: '12px', marginBottom: '16px', overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap' }}>
              {error.message}
              {error.stack && '\n\n' + error.stack}
            </pre>
            <button
              onClick={reset}
              style={{ padding: '8px 16px', background: '#0f172a', color: 'white', borderRadius: '8px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
