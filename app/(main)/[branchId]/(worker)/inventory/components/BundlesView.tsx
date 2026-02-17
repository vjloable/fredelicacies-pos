'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { BundleWithComponents, InventoryItem } from '@/types/domain';
import { subscribeToBundles } from '@/services/bundleService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { calculateBundleAvailability } from '@/services/bundleService';
import { useBranch } from '@/contexts/BranchContext';
import { formatCurrency } from '@/lib/currency_formatter';
import PlusIcon from '@/components/icons/PlusIcon';
import EditIcon from '../../store/icons/EditIcon';
import DeleteIcon from '../../store/icons/DeleteIcon';
import LoadingSpinner from '@/components/LoadingSpinner';
import AddBundleModal from './AddBundleModal';
import EditBundleModal from './EditBundleModal';

export default function BundlesView() {
  const { currentBranch } = useBranch();
  const [bundles, setBundles] = useState<BundleWithComponents[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [bundleAvailability, setBundleAvailability] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<BundleWithComponents | null>(null);

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
      <div className="flex items-center justify-center h-[400px]">
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

  if (bundles.length === 0) {
    return (
      <>
        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-32 h-32 bg-amber-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-16 h-16 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-[var(--secondary)] mb-2">No Bundles Yet</h3>
          <p className="text-[var(--secondary)]/70 mb-6 text-center max-w-md">
            Create bundles to combine multiple items into special offers or combo deals
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Create First Bundle
          </button>
        </div>

        {/* Add Bundle Modal */}
        <AddBundleModal
          isOpen={showAddModal}
          inventory={inventory}
          onClose={() => setShowAddModal(false)}
          onError={(err) => setError(err)}
        />
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--secondary)]">Bundles</h2>
          <p className="text-sm text-[var(--secondary)]/70 mt-1">
            {bundles.length} {bundles.length === 1 ? 'bundle' : 'bundles'} available
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Add Bundle
        </button>
      </div>

      {/* Bundles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {bundles.map((bundle) => {
          const availability = bundleAvailability.get(bundle.id) || 0;
          const isActive = bundle.status === 'active';

          return (
            <div
              key={bundle.id}
              className="bg-white rounded-xl border-2 border-[var(--secondary)]/20 overflow-hidden hover:shadow-lg transition-all group"
            >
              {/* Bundle Image */}
              <div className="relative h-48 bg-gradient-to-br from-amber-100 to-amber-50">
                {bundle.img_url ? (
                  <Image
                    src={bundle.img_url}
                    alt={bundle.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-16 h-16 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}

                {/* Bundle Badge */}
                <div className="absolute top-2 left-2">
                  <span className="bg-amber-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                    Bundle
                  </span>
                </div>

                {/* Status Badge */}
                {!isActive && (
                  <div className="absolute top-2 right-2">
                    <span className="bg-gray-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                      Inactive
                    </span>
                  </div>
                )}

                {/* Availability Badge */}
                <div className="absolute bottom-2 right-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    availability > 10
                      ? 'bg-green-500 text-white'
                      : availability > 0
                      ? 'bg-yellow-500 text-white'
                      : 'bg-red-500 text-white'
                  }`}>
                    {availability > 0 ? `${availability} available` : 'Out of stock'}
                  </span>
                </div>
              </div>

              {/* Bundle Info */}
              <div className="p-4">
                <h3 className="font-bold text-[var(--secondary)] text-lg mb-1 truncate">
                  {bundle.name}
                </h3>

                {bundle.description && (
                  <p className="text-sm text-[var(--secondary)]/70 mb-3 line-clamp-2">
                    {bundle.description}
                  </p>
                )}

                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-amber-600">
                    {formatCurrency(bundle.price)}
                  </span>
                  <span className="text-xs text-[var(--secondary)]/50">
                    {bundle.components?.length || 0} items
                  </span>
                </div>

                {/* Component List */}
                {bundle.components && bundle.components.length > 0 && (
                  <div className="mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-xs font-medium text-amber-800 mb-1">Includes:</div>
                    <div className="space-y-1">
                      {bundle.components.slice(0, 3).map((component) => (
                        <div key={component.id} className="flex justify-between text-xs text-gray-600">
                          <span className="truncate flex-1">
                            {component.inventory_item?.name || 'Unknown Item'}
                          </span>
                          <span className="text-amber-600 font-medium ml-2">
                            ×{component.quantity}
                          </span>
                        </div>
                      ))}
                      {bundle.components.length > 3 && (
                        <div className="text-xs text-amber-600 font-medium">
                          +{bundle.components.length - 3} more items
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditBundle(bundle)}
                    className="flex-1 py-2 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[var(--accent)] rounded-lg font-medium transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <EditIcon className="w-4 h-4" />
                    Edit
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <AddBundleModal
        isOpen={showAddModal}
        inventory={inventory}
        onClose={() => setShowAddModal(false)}
        onError={(err) => setError(err)}
      />

      {editingBundle && (
        <EditBundleModal
          isOpen={showEditModal}
          bundle={editingBundle}
          inventory={inventory}
          onClose={handleCloseEditModal}
          onError={(err) => setError(err)}
        />
      )}
    </>
  );
}
