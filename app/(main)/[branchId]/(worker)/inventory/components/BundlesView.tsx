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
        <h2 className="text-sm font-bold text-secondary uppercase tracking-wide">
          Bundles
          <span className="ml-2 text-xs font-normal text-secondary/50 normal-case tracking-normal">
            {bundles.length} {bundles.length === 1 ? 'bundle' : 'bundles'}
          </span>
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Add Bundle
        </button>
      </div>

      {/* Bundles List */}
      {bundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-secondary mb-1">No Bundles Yet</h3>
          <p className="text-secondary/60 text-sm text-center max-w-xs mb-4">
            Combine multiple items into special offers or combo deals
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Create First Bundle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {bundles.map((bundle) => {
            const availability = bundleAvailability.get(bundle.id) || 0;
            const availabilityColor = availability > 10
              ? 'bg-green-100 text-green-700'
              : availability > 0
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-600';

            return (
              <div
                key={bundle.id}
                className="bg-primary p-2 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-2">
                  {/* Amber left bar */}
                  <div className="w-1 h-14 rounded-full bg-amber-400 shrink-0" />

                  {/* Bundle Image */}
                  <div className="w-14 h-14 bg-amber-50 rounded-0.75 shrink-0 overflow-hidden flex items-center justify-center">
                    {bundle.img_url ? (
                      <Image
                        src={bundle.img_url}
                        alt={bundle.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg className="w-6 h-6 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    )}
                  </div>

                  {/* Bundle Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-3.5 font-semibold text-secondary truncate">
                      {bundle.name}
                    </div>
                    <div className="text-3 text-secondary/60">
                      {formatCurrency(bundle.price)} · {bundle.components?.length || 0} {bundle.components?.length === 1 ? 'item' : 'items'}
                    </div>
                  </div>

                  {/* Availability Badge (desktop) */}
                  <span className={`hidden md:inline text-xs px-2 py-1 rounded-full font-medium ${availabilityColor}`}>
                    {availability > 0 ? `${availability} avail.` : 'Out of stock'}
                  </span>

                  {/* Edit Button (desktop) */}
                  <button
                    onClick={() => handleEditBundle(bundle)}
                    className="hidden md:flex items-center justify-center w-9 h-9 bg-amber-50 hover:bg-amber-100 rounded-lg transition-all hover:scale-105 active:scale-95 ml-1"
                  >
                    <EditIcon className="w-4 h-4 text-amber-600" />
                  </button>
                </div>

                {/* Edit Button (mobile) */}
                <button
                  onClick={() => handleEditBundle(bundle)}
                  className="md:hidden w-full mt-1.5 py-1 text-3 font-bold bg-amber-500 text-white rounded-lg transition-all active:scale-95"
                >
                  Edit
                </button>
              </div>
            );
          })}
        </div>
      )}

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
