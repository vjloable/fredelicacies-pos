'use client';

import { useEffect, useState } from 'react';
import { categoryRepository } from '@/lib/repositories/categoryRepository';
import { categoryEodPolicyRepository } from '@/lib/repositories/categoryEodPolicyRepository';
import type { Category, CategoryEodPolicy, EodPolicy } from '@/types/domain/category';

interface CategoryEodPoliciesPanelProps {
  branchId: string;
}

export default function CategoryEodPoliciesPanel({ branchId }: CategoryEodPoliciesPanelProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [policies, setPolicies] = useState<CategoryEodPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [catResult, polResult] = await Promise.all([
        categoryRepository.getByBranch(branchId),
        categoryEodPolicyRepository.getByBranch(branchId),
      ]);
      setCategories(catResult.categories);
      setPolicies(polResult.policies);
      setLoading(false);
    }
    load();
  }, [branchId]);

  const getPolicyForCategory = (categoryId: string): EodPolicy => {
    const policy = policies.find(p => p.category_id === categoryId);
    return policy?.eod_policy ?? 'carryover';
  };

  const handleToggle = async (categoryId: string) => {
    const current = getPolicyForCategory(categoryId);
    const next: EodPolicy = current === 'carryover' ? 'destock_only' : 'carryover';

    setSaving(categoryId);
    const { policy, error } = await categoryEodPolicyRepository.upsert(branchId, categoryId, next);

    if (!error && policy) {
      setPolicies(prev => {
        const filtered = prev.filter(p => p.category_id !== categoryId);
        return [...filtered, policy];
      });
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="text-xs text-secondary/50 text-center py-4">Loading categories...</div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-xs text-secondary/50 text-center py-4">No categories found for this branch.</div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-secondary">Category EOD Policies</p>
        <p className="text-2.5 text-secondary/40">Tap to toggle</p>
      </div>
      <div className="space-y-1.5">
        {categories.map(cat => {
          const policy = getPolicyForCategory(cat.id);
          const isSaving = saving === cat.id;
          const isCarryover = policy === 'carryover';

          return (
            <button
              key={cat.id}
              onClick={() => handleToggle(cat.id)}
              disabled={isSaving}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 hover:border-accent/40 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs font-medium text-secondary">{cat.name}</span>
              </div>
              <div className={`px-2 py-0.5 rounded-full text-2.5 font-bold ${
                isCarryover
                  ? 'bg-(--success)/10 text-(--success)'
                  : 'bg-(--error)/10 text-(--error)'
              }`}>
                {isSaving ? '...' : isCarryover ? 'Carryover' : 'Destock Only'}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-2.5 text-secondary/40 mt-2">
        <strong>Carryover:</strong> Items can be locked and carried over to the next day.{' '}
        <strong>Destock Only:</strong> Items can only be destocked (zeroed out as wastage).
      </p>
    </div>
  );
}
