'use client';

import { motion } from 'motion/react';

interface LiveIndicatorProps {
  /** true = synced/live (green), false = local/offline (red). */
  live: boolean;
  className?: string;
}

// A small router-style LED dot. Green when live (internet-synced), red when not,
// with a soft blink + glow. Red blinks faster to read as an alert.
export default function LiveIndicator({ live, className = '' }: LiveIndicatorProps) {
  const color = live ? 'var(--success)' : 'var(--error)';
  return (
    <motion.span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: color, color, boxShadow: '0 0 4px 1px currentColor' }}
      animate={{ opacity: [1, 0.25, 1], scale: [1, 0.9, 1] }}
      transition={{ duration: live ? 1.8 : 0.7, repeat: Infinity, ease: 'easeInOut' }}
      role="status"
      aria-label={live ? 'Live — internet time' : 'Offline — local time'}
      title={live ? 'Live (internet time)' : 'Offline (local time)'}
    />
  );
}
