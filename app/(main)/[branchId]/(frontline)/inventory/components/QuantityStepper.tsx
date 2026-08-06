'use client';

import { useState } from 'react';

// A compact +/- stepper with a directly-editable quantity — replaces the browser's
// native number-input spinner (small, inconsistent across browsers, easy to mis-tap)
// with explicit buttons, while still letting the cashier type an exact count.
// Backspacing the field fully empties it (so it doesn't fight a stale digit); on
// blur/Enter an empty field commits as 0. Just focusing/selecting without editing
// leaves the value untouched — draft only represents an in-progress edit.
export default function QuantityStepper({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? String(value);

  const stepBtn =
    "w-6 h-6 rounded-md border border-secondary/20 bg-white text-secondary flex items-center justify-center hover:bg-secondary/5 hover:border-secondary/40 active:bg-secondary/10 transition-colors font-bold text-sm leading-none disabled:opacity-30 disabled:cursor-not-allowed";

  const commit = () => {
    if (draft === null) return; // no edit was made — nothing to commit
    const parsed = draft === '' ? 0 : parseInt(draft, 10);
    setDraft(null);
    if (!Number.isNaN(parsed) && parsed !== value) {
      onChange(parsed);
    }
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => { setDraft(null); onChange(Math.max(min, value - 1)); }}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className={stepBtn}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === '' || /^\d+$/.test(next)) setDraft(next);
        }}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Quantity"
        className="w-8 text-center text-xs font-bold text-secondary tabular-nums rounded-md border border-transparent bg-transparent py-0.5 hover:border-secondary/20 focus:outline-none focus:ring-1 focus:ring-accent focus:border-transparent focus:bg-white transition-colors"
      />
      <button
        type="button"
        onClick={() => { setDraft(null); onChange(value + 1); }}
        aria-label="Increase quantity"
        className={stepBtn}
      >
        +
      </button>
    </div>
  );
}
