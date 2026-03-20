'use client';

import { useState } from 'react';
import TutorialModal, { type TutorialStep } from './TutorialModal';

interface HelpButtonProps {
  steps: TutorialStep[];
  /** "page" = moderate circle button for page headers; "inline" = small icon-only button */
  variant?: 'page' | 'inline';
  className?: string;
}

export default function HelpButton({ steps, variant = 'inline', className = '' }: HelpButtonProps) {
  const [open, setOpen] = useState(false);

  const questionIcon = (
    <svg className={variant === 'page' ? 'w-8 h-8' : 'w-7 h-7'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  if (variant === 'page') {
    return (
      <>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className={`w-8 h-8 rounded-full bg-secondary/10 hover:bg-secondary/20 text-secondary hover:text-secondary flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
          aria-label="Help"
        >
          {questionIcon}
        </button>
        <TutorialModal isOpen={open} steps={steps} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-secondary hover:text-secondary/70 hover:bg-secondary/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
        aria-label="Help"
      >
        {questionIcon}
      </button>
      <TutorialModal isOpen={open} steps={steps} onClose={() => setOpen(false)} />
    </>
  );
}
