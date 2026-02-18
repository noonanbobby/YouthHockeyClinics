'use client';

export default function RegistrationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#f0f4f8' }}>
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6 max-w-lg w-full">
        <h2 className="text-lg font-bold text-red-700 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 mb-4">
          {error.digest ? `Error reference: ${error.digest}` : 'An unexpected error occurred loading registrations.'}
        </p>
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
