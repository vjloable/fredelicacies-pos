'use client';

import { useState, useEffect, useMemo } from 'react';
import { MultiSelectField, itemsInCategory } from './multiSelectField';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { Category, InventoryItem } from '@/types/domain';
import { useBranch } from '@/contexts/BranchContext';
import {
  getAssortedKakaninConfig,
  saveAssortedKakaninConfig,
} from '@/services/assortedKakaninService';

// Category names the two pickers draw from (matched case-insensitively).
export const CONTAINER_CATEGORY_NAME = 'CONTAINERS';
export const KAKANIN_CATEGORY_NAME = 'KAKANIN';


interface Props {
  isOpen: boolean;
  inventory: InventoryItem[];
  categories: Category[];
  onClose: () => void;
  onError: (msg: string) => void;
}


export default function AssortedKakaninConfigModal({
  isOpen,
  inventory,
  categories,
  onClose,
  onError,
}: Props) {
  const { currentBranch } = useBranch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [containerSel, setContainerSel] = useState<Set<string>>(new Set());
  const [kakaninSel, setKakaninSel] = useState<Set<string>>(new Set());

  const containerItems = useMemo(
    () => itemsInCategory(inventory, categories, CONTAINER_CATEGORY_NAME),
    [inventory, categories]
  );
  const kakaninItems = useMemo(
    () => itemsInCategory(inventory, categories, KAKANIN_CATEGORY_NAME),
    [inventory, categories]
  );

  useEffect(() => {
    if (!isOpen || !currentBranch) return;
    let active = true;
    setLoading(true);
    getAssortedKakaninConfig(currentBranch.id).then(({ config, error }) => {
      if (!active) return;
      if (error) onError('Failed to load Assorted Kakanin config');
      setContainerSel(new Set(config.container_item_ids));
      setKakaninSel(new Set(config.kakanin_item_ids));
      setLoading(false);
    });
    return () => { active = false; };
  }, [isOpen, currentBranch, onError]);

  if (!isOpen) return null;

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  const handleSave = async () => {
    if (!currentBranch) return;
    setSaving(true);
    const { error } = await saveAssortedKakaninConfig(
      currentBranch.id,
      [...containerSel],
      [...kakaninSel]
    );
    setSaving(false);
    if (error) {
      onError('Failed to save Assorted Kakanin config');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-secondary/10 flex items-center gap-3">
          <div className="relative w-12 h-12 bg-bundle/10 rounded-lg shrink-0 overflow-hidden flex items-center justify-center">
            <svg className="w-7 h-7 text-bundle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="13" rx="9" ry="6" />
              <ellipse cx="12" cy="11.5" rx="9" ry="6" />
              <circle cx="9" cy="11" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="13" cy="10" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-secondary truncate">Configure Assorted Kakanin</h3>
            <p className="text-xs text-secondary/50">Pick which containers and kakanin cashiers can choose from</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/10 transition-colors">
            <svg className="w-4 h-4 text-secondary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>
          ) : (
            <>
              <MultiSelectField
                label="Containers"
                emptyHint={`No items found in a "${CONTAINER_CATEGORY_NAME}" category. Create that category and add items to it first.`}
                items={containerItems}
                selected={containerSel}
                onToggle={id => toggle(containerSel, setContainerSel, id)}
              />
              <MultiSelectField
                label="Kakanin"
                emptyHint={`No items found in a "${KAKANIN_CATEGORY_NAME}" category. Create that category and add items to it first.`}
                items={kakaninItems}
                selected={kakaninSel}
                onToggle={id => toggle(kakaninSel, setKakaninSel, id)}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-secondary/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-secondary rounded-lg text-sm font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              loading || saving
                ? 'bg-secondary/20 text-secondary/40 cursor-not-allowed'
                : 'bg-accent hover:bg-accent/90 text-white'
            }`}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
