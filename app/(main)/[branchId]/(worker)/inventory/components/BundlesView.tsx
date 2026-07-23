'use client';

import { useState, useEffect } from 'react';
import SafeImage from '@/components/SafeImage';
import type { BundleWithComponents, InventoryItem, Category } from '@/types/domain';
import { subscribeToBundles } from '@/services/bundleService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { calculateBundleAvailability } from '@/services/bundleService';
import { validateAndReactivateBundle } from '@/services/catalogSyncService';
import { useAuth } from '@/contexts/AuthContext';
import { getCategoryColor } from '@/services/categoryService';
import { useBranch } from '@/contexts/BranchContext';
import { formatCurrency } from '@/lib/currency_formatter';
import PlusIcon from '@/components/icons/PlusIcon';
import EditIcon from '../../store/icons/EditIcon';
import LoadingSpinner from '@/components/LoadingSpinner';
import AddBundleModal from './AddBundleModal';
import EditBundleModal from './EditBundleModal';

// Sentinel folder id for bundles that have no category.
const UNCAT = '__uncategorized__';

interface BundlesViewProps {
  categoryFilter: string | null;
  categories: Category[];
}

export default function BundlesView({ categoryFilter, categories }: BundlesViewProps) {
  const { currentBranch } = useBranch();
  const { user } = useAuth();
  const [bundles, setBundles] = useState<BundleWithComponents[]>([]);
  const [reactivating, setReactivating] = useState<string | null>(null);
  const [reactivationError, setReactivationError] = useState<string | null>(null);
  // Bundles get their own category selection; seed from the parent folder selection.
  const [selectedCat, setSelectedCat] = useState<string | null>(categoryFilter);
  useEffect(() => { setSelectedCat(categoryFilter); }, [categoryFilter]);
  const filteredBundles =
    selectedCat === null ? [] :
    selectedCat === UNCAT ? bundles.filter(b => !b.category_id) :
    bundles.filter(b => b.category_id === selectedCat);
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

  const needsFixBundles = bundles.filter(b => b.needs_attention);

  const handleMarkFixed = async (bundleId: string, bundleName: string) => {
    if (!user) return;
    setReactivating(bundleId);
    setReactivationError(null);
    const { ok, missing, error } = await validateAndReactivateBundle(user.id, bundleId);
    setReactivating(null);
    if (error) {
      setReactivationError(error.message ?? String(error));
      return;
    }
    if (!ok) {
      setReactivationError(
        `"${bundleName}" still has missing components: ${missing.join(', ')}. Edit the bundle to remove or replace them.`
      );
      return;
    }
    // Bundle list will refresh via realtime subscription.
  };

  // Folder data: categories that actually contain bundles, plus an uncategorized bucket.
  const catCounts = new Map<string, number>();
  let uncatCount = 0;
  bundles.forEach(b => { if (b.category_id) catCounts.set(b.category_id, (catCounts.get(b.category_id) || 0) + 1); else uncatCount++; });
  const folderCats = categories.filter(c => catCounts.has(c.id));
  const currentCatName = selectedCat === UNCAT ? 'Uncategorized'
    : selectedCat ? (categories.find(c => c.id === selectedCat)?.name ?? 'Category')
    : 'Bundles';
  const currentDot = selectedCat === UNCAT ? '#9CA3AF' : selectedCat ? getCategoryColor(categories, selectedCat) : '#9CA3AF';

  return (
    <>
      {/* Bundles needing fix (from catalog sync conflicts) */}
      {needsFixBundles.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-2 mb-2">
            <svg className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-900">
                {needsFixBundles.length} bundle{needsFixBundles.length === 1 ? '' : 's'} need{needsFixBundles.length === 1 ? 's' : ''} review
              </p>
              <p className="text-2.5 text-amber-800/80 mt-0.5">
                Components were missing in this branch's catalog at sync time. Edit each bundle to add or remove the missing components, then click <span className="font-semibold">Mark fixed</span>.
              </p>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            {needsFixBundles.map(b => (
              <div key={b.id} className="bg-white rounded-md border border-amber-200/60 px-3 py-2 flex items-center gap-2">
                <span className="text-xs font-medium text-secondary flex-1 min-w-0 truncate">{b.name}</span>
                <span className="text-2.5 text-amber-700">{b.components?.length ?? 0} components</span>
                <button
                  onClick={() => handleEditBundle(b)}
                  className="text-2.5 text-accent hover:underline">
                  Edit
                </button>
                <button
                  onClick={() => handleMarkFixed(b.id, b.name)}
                  disabled={reactivating === b.id}
                  className={`px-2 py-1 rounded-md text-2.5 font-semibold ${
                    reactivating === b.id
                      ? 'bg-gray-100 text-secondary/50 cursor-not-allowed'
                      : 'bg-amber-700 text-white hover:bg-amber-800'
                  }`}>
                  {reactivating === b.id ? 'Checking...' : 'Mark fixed'}
                </button>
              </div>
            ))}
          </div>
          {reactivationError && (
            <p className="mt-2 text-2.5 text-error">{reactivationError}</p>
          )}
        </div>
      )}

{/* Level 0: category folder grid */}
      {selectedCat === null ? (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2.5 font-bold uppercase tracking-wide text-secondary/45">Bundles</h2>
              <p className="text-2.5 text-secondary/40 mt-0.5">
                {bundles.length} {bundles.length === 1 ? 'bundle' : 'bundles'}
              </p>
            </div>
            <button
          onClick={() => setShowAddModal(true)}
          className="shrink-0 bg-accent text-secondary text-3 h-12 px-4 flex items-center justify-center rounded-lg hover:bg-accent/90 shadow-sm transition-all font-semibold hover:scale-105 active:scale-95"
        >
          <div className="flex flex-row items-center gap-2 text-primary text-shadow-md font-black text-3">
            <div className="size-4"><PlusIcon className="drop-shadow-lg" /></div>
            <span className="mt-0.5">ADD BUNDLE</span>
          </div>
        </button>
          </div>

          {bundles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-20 h-20 rounded-full border border-bundle/40 flex items-center justify-center text-bundle/80 mb-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-secondary mb-1">No Bundles Yet</h3>
              <p className="text-secondary/60 text-xs text-center max-w-xs">
                Combine multiple items into special offers or combo deals
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              {folderCats.map((cat) => (
                <button key={cat.id} onClick={() => setSelectedCat(cat.id ?? null)}
                className="group relative aspect-square rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <span className="w-5 sm:w-6 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-3 sm:text-3.5 font-semibold leading-tight line-clamp-3 text-secondary">{cat.name}</span>
                <span className="text-2.5 text-secondary/40 tabular-nums">{catCounts.get(cat.id!)}</span>
              </button>
              ))}
              {uncatCount > 0 && (
                <button onClick={() => setSelectedCat(UNCAT)}
                  className="group relative aspect-square rounded-xl border border-dashed border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <span className="w-5 sm:w-6 h-1.5 rounded-full shrink-0 bg-gray-300" />
                  <span className="text-3 sm:text-3.5 font-semibold leading-tight line-clamp-3 text-secondary/70">Uncategorized</span>
                  <span className="text-2.5 text-secondary/40 tabular-nums">{uncatCount}</span>
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Level 1: back + breadcrumb + list */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setSelectedCat(null)} aria-label="Back to bundle folders" title="Back to folders"
                className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-400 transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0">
                <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
                  <button onClick={() => setSelectedCat(null)} className="shrink-0 text-2.5 font-bold uppercase tracking-wide text-secondary/45 hover:text-secondary transition-colors">Bundles</button>
                  <svg className="w-3 h-3 shrink-0 text-secondary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: currentDot }} />
                  <span className="text-sm font-bold text-secondary truncate">{currentCatName}</span>
                </nav>
                <p className="text-2.5 text-secondary/40 mt-0.5">
                  {filteredBundles.length} {filteredBundles.length === 1 ? 'bundle' : 'bundles'}
                </p>
              </div>
            </div>
            <button
          onClick={() => setShowAddModal(true)}
          className="shrink-0 bg-accent text-secondary text-3 h-12 px-4 flex items-center justify-center rounded-lg hover:bg-accent/90 shadow-sm transition-all font-semibold hover:scale-105 active:scale-95"
        >
          <div className="flex flex-row items-center gap-2 text-primary text-shadow-md font-black text-3">
            <div className="size-4"><PlusIcon className="drop-shadow-lg" /></div>
            <span className="mt-0.5">ADD BUNDLE</span>
          </div>
        </button>
          </div>

          {filteredBundles.length === 0 ? (
            <div className="py-12 text-center text-xs text-secondary/50">No bundles in this category.</div>
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
        </>
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
