'use client';

import { useState, useEffect } from 'react';
import SafeImage from '@/components/SafeImage';
import type { BundleWithComponents, InventoryItem, Category } from '@/types/domain';
import { subscribeToBundles } from '@/services/bundleService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { calculateBundleAvailability } from '@/services/bundleService';
import { getCategoryColor } from '@/services/categoryService';
import { useBranch } from '@/contexts/BranchContext';
import { formatCurrency } from '@/lib/currency_formatter';
import PlusIcon from '@/components/icons/PlusIcon';
import EditIcon from '../../store/icons/EditIcon';
import LoadingSpinner from '@/components/LoadingSpinner';
import AddBundleModal from './AddBundleModal';
import EditBundleModal from './EditBundleModal';

interface BundlesViewProps {
  categoryFilter: string | null;
  categories: Category[];
}

export default function BundlesView({ categoryFilter, categories }: BundlesViewProps) {
  const { currentBranch } = useBranch();
  const [bundles, setBundles] = useState<BundleWithComponents[]>([]);
  const filteredBundles = categoryFilter
    ? bundles.filter(b => b.category_id === categoryFilter)
    : bundles;
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [bundleAvailability, setBundleAvailability] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<BundleWithComponents | null>(null);
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedBundles(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Subscribe to bundles
  useEffect(() => {
    if (!currentBranch) return;

    setLoading(true);
    const unsubscribe = subscribeToBundles(
      currentBranch.id,
      (bundlesData) => {
        setBundles(bundlesData);
        setLoading(false);
      },
      (err) => {
        console.error('Error subscribing to bundles:', err);
        setError('Failed to load bundles');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentBranch]);

  // Subscribe to inventory
  useEffect(() => {
    if (!currentBranch) return;

    const unsubscribe = subscribeToInventoryItems(
      currentBranch.id,
      (inventoryData) => {
        setInventory(inventoryData);
      }
    );

    return () => unsubscribe();
  }, [currentBranch]);

  // Calculate availability for each bundle
  useEffect(() => {
    const availability = new Map<string, number>();
    bundles.forEach(bundle => {
      availability.set(bundle.id, calculateBundleAvailability(bundle, inventory));
    });
    setBundleAvailability(availability);
  }, [bundles, inventory]);

  const handleEditBundle = (bundle: BundleWithComponents) => {
    setEditingBundle(bundle);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingBundle(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-100">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xs font-bold text-secondary uppercase tracking-wide">
          Bundles
          <span className="ml-2 text-xs font-normal text-secondary/50 normal-case tracking-normal">
            {filteredBundles.length} {filteredBundles.length === 1 ? 'bundle' : 'bundles'}
          </span>
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-accent text-secondary text-3 px-4 py-2 rounded-lg hover:bg-accent/90 shadow-sm transition-all font-semibold hover:scale-105 active:scale-95"
        >
          <div className="flex flex-row items-center gap-2 text-primary text-shadow-md font-black text-3">
            <div className="size-4">
              <PlusIcon className="drop-shadow-lg" />
            </div>
            <span className="mt-0.5">ADD BUNDLE</span>
          </div>
        </button>
      </div>

      {/* Bundles List */}
      {filteredBundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-20 h-20 bg-bundle/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-bundle/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-secondary mb-1">No Bundles Yet</h3>
          <p className="text-secondary/60 text-xs text-center max-w-xs mb-4">
            Combine multiple items into special offers or combo deals
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-accent text-secondary text-3 px-4 py-2 rounded-lg hover:bg-accent/90 shadow-sm transition-all font-semibold hover:scale-105 active:scale-95"
          >
            <div className="flex flex-row items-center gap-2 text-primary text-shadow-md font-black text-3">
              <div className="size-4">
                <PlusIcon className="drop-shadow-lg" />
              </div>
              <span className="mt-0.5">ADD BUNDLE</span>
            </div>
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredBundles.map((bundle) => {
            const availability = bundleAvailability.get(bundle.id) || 0;
            const isExpanded = expandedBundles.has(bundle.id);
            return (
              <div key={bundle.id} className="bg-primary rounded-lg border border-gray-100 overflow-hidden transition-colors">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  {/* Category dot */}
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(categories, bundle.category_id || '') }} />

                  {/* Bundle Image */}
                  <div className="w-8 h-8 rounded bg-gray-100 shrink-0 overflow-hidden relative flex items-center justify-center">
                    {bundle.img_url ? (
                      <SafeImage src={bundle.img_url} alt={bundle.name} />
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* Name + Custom badge */}
                  <span className="text-xs font-semibold text-secondary truncate flex-1 min-w-0">{bundle.name}</span>
                  {bundle.is_custom && (
                    <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-bundle/20 text-bundle rounded">Custom</span>
                  )}

                  {/* Price */}
                  <span className="text-xs text-secondary/60 shrink-0 tabular-nums">{formatCurrency(bundle.price)}</span>

                  {/* Availability */}
                  <span className={`text-xs font-bold shrink-0 w-8 text-center tabular-nums ${
                    bundle.is_custom ? 'text-bundle' : availability === 0 ? 'text-error' : availability <= 5 ? 'text-accent' : 'text-secondary/50'
                  }`}>
                    {bundle.is_custom ? '∞' : availability}
                  </span>

                  {/* Edit button */}
                  <button onClick={() => handleEditBundle(bundle)} className="shrink-0 p-1.5 hover:bg-light-accent rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1">
                    <EditIcon className="w-4 h-4" />
                  </button>

                  {/* Expand button */}
                  <button onClick={() => toggleExpand(bundle.id)} className="shrink-0 p-1.5 hover:bg-gray-100 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1">
                    <svg className={`w-3 h-3 text-secondary/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-2 pt-2 border-t border-gray-100 ml-11 flex flex-wrap gap-x-4 gap-y-1">
                    {bundle.description ? (
                      <p className="text-xs text-secondary/60 w-full">{bundle.description}</p>
                    ) : (
                      <p className="text-xs text-secondary/30 italic w-full">No description</p>
                    )}
                    {bundle.is_custom ? (
                      <span className="text-xs text-secondary/60">Up to {bundle.max_pieces} pieces</span>
                    ) : (
                      <span className="text-xs text-secondary/60">
                        {bundle.components?.length || 0} {bundle.components?.length === 1 ? 'item' : 'items'}
                      </span>
                    )}
                    {!bundle.is_custom && availability <= 5 && (
                      <span className={`text-xs font-medium ${availability === 0 ? 'text-error' : 'text-accent'}`}>
                        {availability === 0 ? 'Out of stock' : `Only ${availability} left`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AddBundleModal
        isOpen={showAddModal}
        inventory={inventory}
        categories={categories}
        onClose={() => setShowAddModal(false)}
        onError={(err) => setError(err)}
      />

      {editingBundle && (
        <EditBundleModal
          isOpen={showEditModal}
          bundle={editingBundle}
          inventory={inventory}
          categories={categories}
          onClose={handleCloseEditModal}
          onError={(err) => setError(err)}
        />
      )}
    </>
  );
}
