'use client';

import { useEffect } from 'react';

export default function RegistrationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Registrations page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#f0f4f8' }}>
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6 max-w-lg w-full">
        <h2 className="text-lg font-bold text-red-700 mb-2">Something went wrong</h2>
        <pre className="text-xs text-red-600 bg-red-50 rounded-lg p-3 mb-4 overflow-auto max-h-48 whitespace-pre-wrap">
          {error.message}
          {error.stack && '\n\n' + error.stack}
        </pre>
        <button
          onClick={reset}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
