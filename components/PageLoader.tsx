'use client';

import LoadingSpinner from '@/components/LoadingSpinner';

interface PageLoaderProps {
  /** Context-specific text, e.g. "Loading menu…", "Loading inventory…". */
  text?: string;
  className?: string;
}

// Universal first-load screen. Shown only when there is no cached data to render
// (see branchCache). Cached pages skip this and update silently in the background.
export default function PageLoader({ text = 'Loading…', className = '' }: PageLoaderProps) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-4 py-16 ${className}`}
      role="status"
      aria-live="polite"
    >
      <LoadingSpinner size="lg" />
      <span className="text-sm font-medium text-secondary/70">{text}</span>
    </div>
  );
}
