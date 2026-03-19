'use client';

import { useState } from 'react';

export interface TutorialStep {
  title: string;
  description: string;
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
}

interface TutorialModalProps {
  isOpen: boolean;
  steps: TutorialStep[];
  onClose: () => void;
}

export default function TutorialModal({ isOpen, steps, onClose }: TutorialModalProps) {
  const [current, setCurrent] = useState(0);

  if (!isOpen) return null;

  const step = steps[current];
  const isFirst = current === 0;
  const isLast = current === steps.length - 1;

  const handleClose = () => {
    setCurrent(0);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {step.icon && (
              <div className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center shrink-0 text-accent">
                {step.icon}
              </div>
            )}
            <div>
              <p className="text-2.5 font-medium text-secondary/40 uppercase tracking-wide">
                Step {current + 1} of {steps.length}
              </p>
              <h3 className="text-sm font-bold text-secondary">{step.title}</h3>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-secondary/30 hover:text-secondary/60 transition-colors shrink-0 mt-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Illustration */}
        {step.illustration && (
          <div className="bg-gray-50 border-b border-gray-100 flex items-center justify-center overflow-hidden" style={{ height: '168px' }}>
            {step.illustration}
          </div>
        )}

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-xs text-secondary/70 leading-relaxed">{step.description}</p>
        </div>

        {/* Step dots */}
        {steps.length > 1 && (
          <div className="flex justify-center gap-1.5 pb-1">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`rounded-full transition-all ${
                  i === current
                    ? 'w-4 h-1.5 bg-accent'
                    : 'w-1.5 h-1.5 bg-secondary/20 hover:bg-secondary/40'
                }`}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          {!isFirst && (
            <button
              onClick={() => setCurrent(c => c - 1)}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-secondary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
            >
              ← Back
            </button>
          )}
          {isFirst && (
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-secondary/60 rounded-xl text-xs font-semibold transition-all"
            >
              Skip
            </button>
          )}
          <button
            onClick={() => isLast ? handleClose() : setCurrent(c => c + 1)}
            className="flex-1 py-2.5 bg-accent hover:bg-accent/80 text-primary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95"
          >
            {isLast ? 'Got it' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
