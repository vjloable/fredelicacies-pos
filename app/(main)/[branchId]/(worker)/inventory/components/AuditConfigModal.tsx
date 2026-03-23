'use client';

import { useState } from 'react';
import { branchRepository } from '@/lib/repositories/branchRepository';
import type { Category } from '@/types/domain';

interface AuditConfigModalProps {
  isOpen: boolean;
  branchId: string;
  categories: Category[];
  currentAuditCategoryId: string | null;
  onClose: () => void;
  onSaved: (categoryId: string | null) => void;
  onError: (msg: string) => void;
}

export default function AuditConfigModal({
  isOpen,
  branchId,
  categories,
  currentAuditCategoryId,
  onClose,
  onSaved,
  onError,
}: AuditConfigModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(currentAuditCategoryId);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const hasChanged = selectedId !== currentAuditCategoryId;
  const selectedCategory = categories.find(c => c.id === selectedId);

  const handleSave = async () => {
    if (!hasChanged) { onClose(); return; }
    setSaving(true);
    const { error } = await branchRepository.update(branchId, {
      audit_category_id: selectedId,
    });
    setSaving(false);
    if (error) { onError('Failed to save audit configuration.'); return; }
    onSaved(selectedId);
  };

  return (
    <div
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4"
      onClick={!saving ? onClose : undefined}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-secondary/10 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-secondary">Audit Configuration</h3>
              <p className="text-xs text-secondary/50">Select which category requires manual audit</p>
            </div>
          </div>
        </div>

        {/* Category Selection */}
        <div className="px-5 py-4 space-y-2">
          <p className="text-xs font-medium text-secondary mb-2">Audit Category</p>

          {/* None option */}
          <button
            onClick={() => setSelectedId(null)}
            disabled={saving}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors disabled:opacity-50 ${
              selectedId === null
                ? 'border-accent bg-accent/5'
                : 'border-gray-200 hover:border-accent/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0 bg-gray-200" />
              <span className="text-xs font-medium text-secondary/60">None</span>
            </div>
            {selectedId === null && (
              <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Category options */}
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {categories.filter(c => !c.is_hidden).map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedId(cat.id)}
                disabled={saving}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors disabled:opacity-50 ${
                  selectedId === cat.id
                    ? 'border-accent bg-accent/5'
                    : 'border-gray-200 hover:border-accent/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-xs font-medium text-secondary">{cat.name}</span>
                </div>
                {selectedId === cat.id && (
                  <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Current selection summary */}
          <div className="mt-3 bg-secondary/5 rounded-lg px-3 py-2">
            <p className="text-xs text-secondary/60">
              {selectedCategory ? (
                <>
                  Items in <strong className="text-secondary">{selectedCategory.name}</strong> will require manual stock audit before carry-over. All other categories carry over automatically.
                </>
              ) : (
                <>No category selected. All items will carry over without audit.</>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-secondary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanged}
            className="flex-1 py-2.5 bg-secondary hover:bg-secondary/80 text-primary rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
