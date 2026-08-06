'use client';

import { useState, useEffect } from 'react';
import SafeImage from '@/components/SafeImage';
import type { BundleGroupWithVariants, BundleWithComponents, InventoryItem, Category } from '@/types/domain';
import { subscribeToBundles, duplicateBundle, updateBundle } from '@/services/bundleService';
import { subscribeToBundleGroups, deleteBundleGroup, duplicateBundleGroup, setBundleGroupStatus } from '@/services/bundleGroupService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { calculateBundleAvailability } from '@/services/bundleService';
import { validateAndReactivateBundle } from '@/services/catalogSyncService';
import { useAuth } from '@/contexts/AuthContext';
import { getCategoryColor } from '@/services/categoryService';
import { useBranch } from '@/contexts/BranchContext';
import { formatCurrency } from '@/lib/currency_formatter';
import { logActivity } from '@/services/activityLogService';
import PlusIcon from '@/components/icons/PlusIcon';
import EditIcon from '../../store/icons/EditIcon';
import DuplicateIcon from '../../store/icons/DuplicateIcon';
import LoadingSpinner from '@/components/LoadingSpinner';
import AddBundleModal from './AddBundleModal';
import EditBundleModal from './EditBundleModal';
import AssortedKakaninConfigModal from './AssortedKakaninConfigModal';
import FoodHouseConfigModal from './FoodHouseConfigModal';
import CategoryIcon from '@/components/CategoryIcon';

// Sentinel folder id for bundles that have no category.
const UNCAT = '__uncategorized__';

interface BundlesViewProps {
  categoryFilter: string | null;
  categories: Category[];
}

export default function BundlesView({ categoryFilter, categories }: BundlesViewProps) {
  const { currentBranch } = useBranch();
  // Bundles now live only on the commissary and reflect directly to every
  // branch — only the commissary can author them.
  const canManageBundles = currentBranch?.type === 'commissary';
  const { user } = useAuth();
  const [bundles, setBundles] = useState<BundleWithComponents[]>([]);
  const [groups, setGroups] = useState<BundleGroupWithVariants[]>([]);
  // Individual variants render only via their parent group's tile, not as their own row.
  const ungroupedBundles = bundles.filter(b => !b.bundle_group_id);
  const [reactivating, setReactivating] = useState<string | null>(null);
  const [reactivationError, setReactivationError] = useState<string | null>(null);
  // Bundles get their own category selection; seed from the parent folder selection.
  const [selectedCat, setSelectedCat] = useState<string | null>(categoryFilter);
  useEffect(() => { setSelectedCat(categoryFilter); }, [categoryFilter]);
  const filteredBundles =
    selectedCat === null ? [] :
    selectedCat === UNCAT ? ungroupedBundles.filter(b => !b.category_id) :
    ungroupedBundles.filter(b => b.category_id === selectedCat);
  const filteredGroups =
    selectedCat === null ? [] :
    selectedCat === UNCAT ? groups.filter(g => !g.category_id) :
    groups.filter(g => g.category_id === selectedCat);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [bundleAvailability, setBundleAvailability] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssortedConfig, setShowAssortedConfig] = useState(false);
  const [showFoodHouseConfig, setShowFoodHouseConfig] = useState(false);
  const [editingBundle, setEditingBundle] = useState<BundleWithComponents | null>(null);
  const [editingGroup, setEditingGroup] = useState<BundleGroupWithVariants | null>(null);
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleExpandGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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

  // Subscribe to bundle groups
  useEffect(() => {
    if (!currentBranch) return;
    const unsubscribe = subscribeToBundleGroups(currentBranch.id, setGroups);
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
    setEditingGroup(null);
    setShowEditModal(true);
  };

  const handleEditGroup = (group: BundleGroupWithVariants) => {
    if (group.variants.length === 0) return;
    setEditingGroup(group);
    setEditingBundle(group.variants[0]);
    setShowEditModal(true);
  };

  const handleDeleteGroup = async (group: BundleGroupWithVariants) => {
    if (!currentBranch) return;
    const { error: delError } = await deleteBundleGroup(currentBranch.id, group.id);
    if (delError) {
      setError('Failed to delete bundle group. Please try again.');
      return;
    }
    void logActivity({ branchId: currentBranch.id, userId: user?.id ?? null, action: 'bundle_group_deleted', entityType: 'bundle_group', entityId: group.id, details: { name: group.name } });
  };

  const handleDuplicateGroup = async (group: BundleGroupWithVariants) => {
    if (!currentBranch) return;
    const { id, error: dupError } = await duplicateBundleGroup(currentBranch.id, group);
    if (dupError) {
      setError('Failed to duplicate bundle group. Please try again.');
      return;
    }
    void logActivity({ branchId: currentBranch.id, userId: user?.id ?? null, action: 'bundle_group_created', entityType: 'bundle_group', entityId: id ?? undefined, details: { name: `${group.name} (Copy)`, duplicated_from: group.name } });
  };

  const handleDuplicateBundle = async (bundle: BundleWithComponents) => {
    if (!currentBranch) return;
    const { id, error: dupError } = await duplicateBundle(currentBranch.id, bundle);
    if (dupError) {
      setError('Failed to duplicate bundle. Please try again.');
      return;
    }
    void logActivity({ branchId: currentBranch.id, userId: user?.id ?? null, action: 'bundle_created', entityType: 'bundle', entityId: id ?? undefined, details: { name: `${bundle.name} (Copy)`, duplicated_from: bundle.name } });
  };

  // Show/hide toggles — flip status only, hiding instantly from every branch's
  // Store without deleting or touching composition.
  const handleToggleBundleVisibility = async (bundle: BundleWithComponents) => {
    if (!currentBranch) return;
    const nextStatus = bundle.status === 'active' ? 'inactive' : 'active';
    const { error: toggleError } = await updateBundle(bundle.id, { status: nextStatus });
    if (toggleError) {
      setError('Failed to update bundle visibility. Please try again.');
      return;
    }
    void logActivity({ branchId: currentBranch.id, userId: user?.id ?? null, action: 'bundle_status_changed', entityType: 'bundle', entityId: bundle.id, details: { name: bundle.name, status: nextStatus } });
  };

  const handleToggleGroupVisibility = async (group: BundleGroupWithVariants) => {
    if (!currentBranch) return;
    const nextStatus = group.status === 'active' ? 'inactive' : 'active';
    const { error: toggleError } = await setBundleGroupStatus(currentBranch.id, group.id, nextStatus);
    if (toggleError) {
      setError('Failed to update bundle group visibility. Please try again.');
      return;
    }
    void logActivity({ branchId: currentBranch.id, userId: user?.id ?? null, action: 'bundle_group_status_changed', entityType: 'bundle_group', entityId: group.id, details: { name: group.name, status: nextStatus } });
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingBundle(null);
    setEditingGroup(null);
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

  // Folder data: categories that actually contain bundles or groups, plus an uncategorized bucket.
  const catCounts = new Map<string, number>();
  let uncatCount = 0;
  ungroupedBundles.forEach(b => { if (b.category_id) catCounts.set(b.category_id, (catCounts.get(b.category_id) || 0) + 1); else uncatCount++; });
  groups.forEach(g => { if (g.category_id) catCounts.set(g.category_id, (catCounts.get(g.category_id) || 0) + 1); else uncatCount++; });
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
                {ungroupedBundles.length + groups.length} {ungroupedBundles.length + groups.length === 1 ? 'bundle' : 'bundles'}
              </p>
            </div>
            {canManageBundles && (
          <button
            onClick={() => setShowAddModal(true)}
            className="shrink-0 bg-accent text-secondary text-3 h-12 px-4 flex items-center justify-center rounded-lg hover:bg-accent/90 active:bg-light-accent transition-all font-semibold hover:shadow-sm"
          >
            <div className="flex flex-row items-center gap-2 text-primary text-shadow-md font-black text-3">
              <div className="size-4"><PlusIcon className="drop-shadow-lg" /></div>
              <span className="mt-0.5">ADD BUNDLE</span>
            </div>
          </button>
        )}
          </div>

          {/* Assorted Kakanin — permanent, undeletable special config */}
          <button
            onClick={() => setShowAssortedConfig(true)}
            className="w-full mb-4 flex items-center gap-3 rounded-xl border border-dashed border-bundle/40 hover:border-bundle hover:shadow-sm active:bg-bundle/10 transition-all p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bundle"
          >
            <div className="w-10 h-10 rounded-lg bg-bundle/10 shrink-0 flex items-center justify-center text-bundle">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="13" rx="9" ry="6" />
                <ellipse cx="12" cy="11.5" rx="9" ry="6" />
                <circle cx="9" cy="11" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="13" cy="10" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="15.5" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-secondary flex items-center gap-1.5">
                Assorted Kakanin
                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-bundle/15 text-bundle rounded">Special</span>
              </p>
              <p className="text-2.5 text-secondary/50 mt-0.5">Configure containers &amp; kakanin cashiers can pick from</p>
            </div>
            <svg className="w-4 h-4 text-secondary/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Food House — permanent, undeletable special config */}
          <button
            onClick={() => setShowFoodHouseConfig(true)}
            className="w-full mb-4 flex items-center gap-3 rounded-xl border border-dashed border-bundle/40 hover:border-bundle hover:shadow-sm active:bg-bundle/10 transition-all p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bundle"
          >
            <div className="w-10 h-10 rounded-lg bg-bundle/10 shrink-0 flex items-center justify-center text-bundle">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 3v7a3 3 0 003 3v8M7 3v5M10 3v5M17 3c-1.5 1.5-2 4-2 7s.5 4 2 4v7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-secondary flex items-center gap-1.5">
                Food House
                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-bundle/15 text-bundle rounded">Special</span>
              </p>
              <p className="text-2.5 text-secondary/50 mt-0.5">Configure made-to-order dishes &amp; container sizes</p>
            </div>
            <svg className="w-4 h-4 text-secondary/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {ungroupedBundles.length === 0 && groups.length === 0 ? (
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
                {cat.icon ? (
                  <span className="shrink-0" style={{ color: cat.color }}><CategoryIcon icon={cat.icon} className="w-10 h-10 sm:w-12 sm:h-12" /></span>
                ) : (
                  <span className="w-5 sm:w-6 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                )}
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
                className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-400 active:bg-gray-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
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
                  {filteredBundles.length + filteredGroups.length} {filteredBundles.length + filteredGroups.length === 1 ? 'bundle' : 'bundles'}
                </p>
              </div>
            </div>
            {canManageBundles && (
          <button
            onClick={() => setShowAddModal(true)}
            className="shrink-0 bg-accent text-secondary text-3 h-12 px-4 flex items-center justify-center rounded-lg hover:bg-accent/90 active:bg-light-accent transition-all font-semibold hover:shadow-sm"
          >
            <div className="flex flex-row items-center gap-2 text-primary text-shadow-md font-black text-3">
              <div className="size-4"><PlusIcon className="drop-shadow-lg" /></div>
              <span className="mt-0.5">ADD BUNDLE</span>
            </div>
          </button>
        )}
          </div>

          {filteredBundles.length === 0 && filteredGroups.length === 0 ? (
            <div className="py-12 text-center text-xs text-secondary/50">No bundles in this category.</div>
          ) : (
            <div className="space-y-1">
          {filteredGroups.map((group) => {
            const isGroupExpanded = expandedGroups.has(group.id);
            return (
              <div key={group.id} className={`bg-primary rounded-lg border border-bundle/30 overflow-hidden transition-colors ${group.status === 'inactive' ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(categories, group.category_id || '') }} />
                  <div className="w-8 h-8 rounded bg-gray-100 shrink-0 overflow-hidden relative flex items-center justify-center">
                    {group.img_url ? (
                      <SafeImage src={group.img_url} alt={group.name} />
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-secondary truncate flex-1 min-w-0">{group.name}</span>
                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-bundle/20 text-bundle rounded">
                    {group.variants.length} {group.variants.length === 1 ? 'variant' : 'variants'}
                  </span>
                  {canManageBundles && (
                    <>
                      <button onClick={() => handleEditGroup(group)} className="shrink-0 p-1.5 hover:bg-light-accent rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1">
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDuplicateGroup(group)} title="Duplicate group" className="shrink-0 p-1.5 hover:bg-light-accent rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1">
                        <DuplicateIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleGroupVisibility(group)}
                        title={group.status === 'inactive' ? 'Hidden — tap to show' : 'Visible — tap to hide'}
                        className={`shrink-0 p-1.5 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${group.status === 'inactive' ? 'text-error hover:bg-error/10' : 'text-secondary/40 hover:bg-gray-100 hover:text-secondary'}`}
                      >
                        {group.status === 'inactive' ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                      <button onClick={() => handleDeleteGroup(group)} title="Delete group" className="shrink-0 p-1.5 text-error hover:bg-error/10 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  )}
                  <button onClick={() => toggleExpandGroup(group.id)} className="shrink-0 p-1.5 hover:bg-gray-100 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1">
                    <svg className={`w-3 h-3 text-secondary/50 transition-transform ${isGroupExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {isGroupExpanded && (
                  <div className="px-3 pb-2 pt-2 border-t border-gray-100 ml-11 space-y-1.5">
                    {group.variants.map(variant => {
                      const variantAvailability = bundleAvailability.get(variant.id) || 0;
                      return (
                        <div key={variant.id} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 min-w-0 truncate text-secondary/80">{variant.variant_label || variant.name}</span>
                          <span className="text-secondary/50 tabular-nums shrink-0">{variant.price != null ? formatCurrency(variant.price) : 'Unpriced'}</span>
                          <span className={`font-bold shrink-0 w-8 text-center tabular-nums ${variantAvailability === 0 ? 'text-error' : variantAvailability <= 5 ? 'text-accent' : 'text-secondary/50'}`}>
                            {variantAvailability}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {filteredBundles.map((bundle) => {
            const availability = bundleAvailability.get(bundle.id) || 0;
            const isExpanded = expandedBundles.has(bundle.id);
            return (
              <div key={bundle.id} className={`bg-primary rounded-lg border border-gray-100 overflow-hidden transition-colors ${bundle.status === 'inactive' ? 'opacity-50' : ''}`}>
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
                  <span className="text-xs text-secondary/60 shrink-0 tabular-nums">{bundle.price != null ? formatCurrency(bundle.price) : 'Unpriced'}</span>

                  {/* Availability */}
                  <span className={`text-xs font-bold shrink-0 w-8 text-center tabular-nums ${
                    bundle.is_custom ? 'text-bundle' : availability === 0 ? 'text-error' : availability <= 5 ? 'text-accent' : 'text-secondary/50'
                  }`}>
                    {bundle.is_custom ? '∞' : availability}
                  </span>

                  {canManageBundles && (
                    <>
                      {/* Edit button */}
                      <button onClick={() => handleEditBundle(bundle)} className="shrink-0 p-1.5 hover:bg-light-accent rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1">
                        <EditIcon className="w-4 h-4" />
                      </button>

                      {/* Duplicate button */}
                      <button onClick={() => handleDuplicateBundle(bundle)} title="Duplicate bundle" className="shrink-0 p-1.5 hover:bg-light-accent rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1">
                        <DuplicateIcon className="w-3.5 h-3.5" />
                      </button>

                      {/* Show/hide toggle */}
                      <button
                        onClick={() => handleToggleBundleVisibility(bundle)}
                        title={bundle.status === 'inactive' ? 'Hidden — tap to show' : 'Visible — tap to hide'}
                        className={`shrink-0 p-1.5 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${bundle.status === 'inactive' ? 'text-error hover:bg-error/10' : 'text-secondary/40 hover:bg-gray-100 hover:text-secondary'}`}
                      >
                        {bundle.status === 'inactive' ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </>
                  )}

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

      <AssortedKakaninConfigModal
        isOpen={showAssortedConfig}
        inventory={inventory}
        categories={categories}
        onClose={() => setShowAssortedConfig(false)}
        onError={(err) => setError(err)}
      />

      <FoodHouseConfigModal
        isOpen={showFoodHouseConfig}
        inventory={inventory}
        categories={categories}
        onClose={() => setShowFoodHouseConfig(false)}
        onError={(err) => setError(err)}
      />

      {editingBundle && (
        <EditBundleModal
          isOpen={showEditModal}
          bundle={editingBundle}
          bundleGroup={editingGroup ?? undefined}
          inventory={inventory}
          categories={categories}
          onClose={handleCloseEditModal}
          onError={(err) => setError(err)}
        />
      )}
    </>
  );
}
