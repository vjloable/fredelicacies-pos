'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { getLatestChangelog, type ChangelogFeature } from '@/lib/changelog';
import { VERSION_INFO } from '@/lib/version';
import {
  IllDashboard, IllCashMonitoring, IllAutoClockOut,
  IllSafeDrop, IllWriteOff, IllResetBranch, IllCleanerNav,
} from '@/components/ChangelogIllustrations';
import type { ReactNode } from 'react';

const illustrationMap: Record<string, ReactNode> = {
  'dashboard': <IllDashboard />,
  'cash-monitoring': <IllCashMonitoring />,
  'auto-clockout': <IllAutoClockOut />,
  'safe-drop': <IllSafeDrop />,
  'write-off': <IllWriteOff />,
  'reset-branch': <IllResetBranch />,
  'cleaner-nav': <IllCleanerNav />,
};

const STORAGE_KEY = 'whats-new-version';

interface WhatsNewModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function WhatsNewModal({ forceOpen, onClose }: WhatsNewModalProps) {
  const [visible, setVisible] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const entry = getLatestChangelog();
  const features = entry?.features ?? [];
  const isLast = cardIndex === features.length - 1;

  useEffect(() => {
    if (forceOpen) {
      setCardIndex(0);
      setVisible(true);
      return;
    }
    if (!entry) return;
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed !== VERSION_INFO.app) {
        setCardIndex(0);
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, [forceOpen, entry]);

  const dismiss = useCallback(() => {
    if (dontShowAgain) {
      try { localStorage.setItem(STORAGE_KEY, VERSION_INFO.app); } catch {}
    }
    setVisible(false);
    setCardIndex(0);
    onClose?.();
  }, [onClose, dontShowAgain]);

  const goNext = () => {
    if (isLast) { dismiss(); return; }
    setDirection(1);
    setCardIndex((i) => Math.min(i + 1, features.length - 1));
  };

  const goPrev = () => {
    setDirection(-1);
    setCardIndex((i) => Math.max(i - 1, 0));
  };

  // Swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (diff > 50 && cardIndex > 0) goPrev();
    else if (diff < -50 && !isLast) goNext();
    setTouchStart(null);
  };

  if (!visible || features.length === 0) return null;

  const feature = features[cardIndex];

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-6"
      onClick={dismiss}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-secondary">What&apos;s New</h2>
            <p className="text-xs text-secondary/40 mt-0.5">Version {VERSION_INFO.app} — {cardIndex + 1} of {features.length}</p>
          </div>
          <button
            onClick={dismiss}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-secondary/40 hover:text-secondary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Card content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={cardIndex}
              initial={{ x: direction >= 0 ? 100 : -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction >= 0 ? -100 : 100, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="h-full overflow-y-auto"
            >
              <FeatureCard feature={feature} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            {/* Dots */}
            <div className="flex gap-1.5">
              {features.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setDirection(i > cardIndex ? 1 : -1); setCardIndex(i); }}
                  className={`h-2 rounded-full transition-all ${
                    i === cardIndex ? 'bg-accent w-6' : 'bg-secondary/20 hover:bg-secondary/40 w-2'
                  }`}
                />
              ))}
            </div>

            {/* Nav */}
            <div className="flex gap-2">
              {cardIndex > 0 && (
                <button
                  onClick={goPrev}
                  className="px-4 py-2.5 text-sm font-semibold text-secondary bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                >
                  Back
                </button>
              )}
              <button
                onClick={goNext}
                className="px-5 py-2.5 text-sm font-semibold text-primary bg-accent hover:bg-accent/80 rounded-xl transition-all"
              >
                {isLast ? 'Got it' : 'Next'}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer justify-center">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="accent-accent w-3.5 h-3.5"
            />
            <span className="text-xs text-secondary/40">Don&apos;t show again until next update</span>
          </label>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FeatureCard({ feature }: { feature: ChangelogFeature }) {
  const illustration = feature.illustration ? illustrationMap[feature.illustration] : null;

  return (
    <div className="px-6 py-4">
      {/* Icon + Title */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.iconPath} />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-secondary">{feature.title}</h3>
          <p className="text-sm text-secondary/50">{feature.description}</p>
        </div>
      </div>

      {/* Illustration */}
      {illustration && (
        <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 bg-gray-50" style={{ height: 180 }}>
          {illustration}
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-secondary/40 uppercase tracking-wider">How it works</p>
        {feature.steps.map((step, i) => (
          <div key={i} className="flex gap-3 items-start">
            <span className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-accent">
              {i + 1}
            </span>
            <p className="text-sm text-secondary/70 leading-relaxed pt-0.5">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
