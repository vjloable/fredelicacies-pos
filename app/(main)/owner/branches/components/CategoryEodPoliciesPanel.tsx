'use client';

import { useEffect, useState } from 'react';
import { categoryRepository } from '@/lib/repositories/categoryRepository';
import { categoryEodPolicyRepository } from '@/lib/repositories/categoryEodPolicyRepository';
import type { Category, CategoryEodPolicy, EodPolicy } from '@/types/domain/category';

type EffectivePolicy = EodPolicy | 'auto';

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

  const getEffectivePolicy = (categoryId: string): EffectivePolicy => {
    const policy = policies.find(p => p.category_id === categoryId);
    return policy?.eod_policy ?? 'auto';
  };

  const handleCycle = async (categoryId: string) => {
    const current = getEffectivePolicy(categoryId);
    // Cycle: auto → carryover → destock_only → auto
    const next: EffectivePolicy =
      current === 'auto' ? 'carryover' :
      current === 'carryover' ? 'destock_only' :
      'auto';

    setSaving(categoryId);

    if (next === 'auto') {
      // Remove the policy row to revert to auto
      const { error } = await categoryEodPolicyRepository.delete(branchId, categoryId);
      if (!error) {
        setPolicies(prev => prev.filter(p => p.category_id !== categoryId));
      }
    } else {
      const { policy, error } = await categoryEodPolicyRepository.upsert(branchId, categoryId, next);
      if (!error && policy) {
        setPolicies(prev => {
          const filtered = prev.filter(p => p.category_id !== categoryId);
          return [...filtered, policy];
        });
      }
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

  const badgeStyle = (policy: EffectivePolicy) => {
    switch (policy) {
      case 'carryover':
        return 'bg-(--success)/10 text-(--success)';
      case 'destock_only':
        return 'bg-(--error)/10 text-(--error)';
      default:
        return 'bg-secondary/10 text-secondary/60';
    }
  };

  const badgeLabel = (policy: EffectivePolicy) => {
    switch (policy) {
      case 'carryover': return 'Carryover';
      case 'destock_only': return 'Destock Only';
      default: return 'Auto';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-secondary">Category EOD Policies</p>
        <p className="text-2.5 text-secondary/40">Tap to cycle</p>
      </div>
      <div className="space-y-1.5">
        {categories.map(cat => {
          const policy = getEffectivePolicy(cat.id);
          const isSaving = saving === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => handleCycle(cat.id)}
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
              <div className={`px-2 py-0.5 rounded-full text-2.5 font-bold ${badgeStyle(policy)}`}>
                {isSaving ? '...' : badgeLabel(policy)}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-2.5 text-secondary/40 mt-2">
        <strong>Auto:</strong> Stock carries over automatically, no audit needed.{' '}
        <strong>Carryover:</strong> Perishable — requires EOD lock/audit.{' '}
        <strong>Destock Only:</strong> Can only be destocked as wastage.
      </p>
    </div>
  );
}
