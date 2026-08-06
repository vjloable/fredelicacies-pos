'use client';

import SafeImage from '@/components/SafeImage';
import LogoIcon from './icons/LogoIcon';
import type { BundleWithComponents } from '@/types/domain';
import type { DisplayItem } from './checkoutTypes';

interface BundleGroupPickerModalProps {
  group: Extract<DisplayItem, { type: 'bundle_group' }>;
  bundleAvailability: Map<string, number>;
  onConfirm: (variant: BundleWithComponents) => void;
  onClose: () => void;
}

// A simple single-choice picker for a "single-type bundle" group — tap a
// size/prefix to add it to the cart as an ordinary fixed bundle line. Unlike
// CustomBundlePickerModal, there's no piece-building here: each variant is
// already fully composed.
export default function BundleGroupPickerModal({
  group,
  bundleAvailability,
  onConfirm,
  onClose,
}: BundleGroupPickerModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-secondary/10 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
            {group.img_url ? (
              <SafeImage src={group.img_url} alt={group.name} />
            ) : (
              <LogoIcon className="w-6 h-6 text-secondary/30" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-secondary truncate">{group.name}</h3>
            <p className="text-xs text-secondary/60">Choose a size</p>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="shrink-0 p-1.5 text-secondary/50 hover:bg-secondary/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {group.variants.map(variant => {
            const availability = bundleAvailability.get(variant.id) ?? 0;
            const disabled = availability <= 0;
            return (
              <button
                key={variant.id}
                type="button"
                disabled={disabled}
                onClick={() => onConfirm(variant)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                  disabled
                    ? 'border-secondary/10 bg-secondary/5 opacity-50 cursor-not-allowed'
                    : 'border-secondary/20 hover:border-bundle hover:bg-bundle/5 active:bg-bundle/10'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-secondary truncate">{variant.variant_label || variant.name}</p>
                  <p className="text-xs text-secondary/50 mt-0.5">
                    {variant.price != null ? `₱${variant.price.toFixed(2)}` : 'Unpriced'}
                    {variant.grab_price != null ? ` · Grab ₱${variant.grab_price.toFixed(2)}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-bold tabular-nums ${disabled ? 'text-error' : 'text-secondary/50'}`}>
                  {disabled ? 'Out of stock' : `${availability} left`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
