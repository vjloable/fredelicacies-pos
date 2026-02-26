'use client';

import { useState, useEffect } from 'react';
import ImageUpload from '@/components/ImageUpload';
import { updateBundle, deleteBundle, calculateBundleAvailability } from '@/services/bundleService';
import type { BundleWithComponents, InventoryItem } from '@/types/domain';
import DropdownField from '@/components/DropdownField';
import { formatCurrency } from '@/lib/currency_formatter';
import Image from 'next/image';

interface EditBundleModalProps {
  isOpen: boolean;
  bundle: BundleWithComponents;
  inventory: InventoryItem[];
  onClose: () => void;
  onError: (error: string) => void;
}

interface SelectedComponent {
  inventoryItemId: string;
  quantity: number;
  item: InventoryItem;
}

export default function EditBundleModal({
  isOpen,
  bundle,
  inventory,
  onClose,
  onError
}: EditBundleModalProps) {
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>([]);

  // Initialize form with bundle data
  useEffect(() => {
    if (bundle) {
      setName(bundle.name);
      setDescription(bundle.description || '');
      setPriceInput(bundle.price.toString());
      setImgUrl(bundle.img_url || '');

      // Initialize components
      const components: SelectedComponent[] = [];
      bundle.components?.forEach(component => {
        const item = inventory.find(i => i.id === component.inventory_item_id);
        if (item && item.id) {
          components.push({
            inventoryItemId: item.id,
            quantity: component.quantity,
            item
          });
        }
      });
      setSelectedComponents(components);
      setShowDeleteConfirm(false);
    }
  }, [bundle, inventory]);

  if (!isOpen) return null;

  const availableItems = inventory.filter(
    item => !selectedComponents.find(comp => comp.inventoryItemId === item.id)
  );

  const currentAvailability = calculateBundleAvailability(
    {
      ...bundle,
      components: selectedComponents.map((c, idx) => ({
        id: bundle.components?.[idx]?.id || `temp-${idx}`,
        bundle_id: bundle.id,
        inventory_item_id: c.inventoryItemId,
        quantity: c.quantity,
        created_at: '',
        inventory_item: c.item
      }))
    },
    inventory
  );

  const handleSelectItem = (itemName: string) => {
    const item = inventory.find(i => i.name === itemName);
    if (!item || !item.id) return;

    setSelectedComponents([
      ...selectedComponents,
      {
        inventoryItemId: item.id,
        quantity: 1,
        item
      }
    ]);
  };

  const handleRemoveComponent = (inventoryItemId: string) => {
    setSelectedComponents(selectedComponents.filter(c => c.inventoryItemId !== inventoryItemId));
  };

  const handleUpdateQuantity = (inventoryItemId: string, quantity: number) => {
    setSelectedComponents(selectedComponents.map(c =>
      c.inventoryItemId === inventoryItemId
        ? { ...c, quantity: Math.max(1, quantity) }
        : c
    ));
  };

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      onError('Please enter a bundle name');
      return;
    }

    const finalPrice = parseFloat(priceInput);
    if (isNaN(finalPrice) || finalPrice <= 0) {
      onError('Please enter a valid price');
      return;
    }

    if (selectedComponents.length === 0) {
      onError('Please add at least one item to the bundle');
      return;
    }

    setLoading(true);
    try {
      const updates = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: finalPrice,
        img_url: imgUrl || undefined,
      };

      const components = selectedComponents.map(c => ({
        inventoryItemId: c.inventoryItemId,
        quantity: c.quantity
      }));

      const { error } = await updateBundle(bundle.id, updates, components);

      if (error) {
        onError('Failed to update bundle. Please try again.');
        return;
      }

      onClose();
    } catch (error) {
      console.error('Error updating bundle:', error);
      onError('Failed to update bundle. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { error } = await deleteBundle(bundle.id);

      if (error) {
        onError('Failed to delete bundle. Please try again.');
        return;
      }

      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error('Error deleting bundle:', error);
      onError('Failed to delete bundle. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-(--primary)/80 flex items-center justify-center z-50"
      onClick={!loading ? onClose : undefined}
    >
      <div
        className="bg-white rounded-xl p-5 max-w-3xl w-full mx-4 shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          /* Loading Screen */
          <div className="text-center py-8">
            <div className="w-10 h-10 bg-amber-100 rounded-xl mx-auto mb-3 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-dashed border-amber-500"></div>
            </div>
            <h3 className="text-base font-bold text-secondary mb-1">
              {showDeleteConfirm ? 'Deleting Bundle...' : 'Updating Bundle...'}
            </h3>
            <p className="text-sm text-secondary opacity-70">
              Please wait
            </p>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="text-center mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl mx-auto mb-3 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-secondary mb-1">
                Edit Bundle
              </h3>
              <p className="text-sm text-secondary opacity-70">
                Update bundle information and components
              </p>

              {/* Availability Indicator */}
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200">
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="text-xs font-medium text-amber-700">
                  Can make {currentAvailability} {currentAvailability === 1 ? 'bundle' : 'bundles'} with current stock
                </span>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Bundle Name and Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Bundle Name <span className="text-(--error)">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-3.5 h-9.5 rounded-lg border-2 border-(--secondary)/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Enter bundle name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Price <span className="text-(--error)">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                    <input
                      type="text"
                      value={priceInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
                          setPriceInput(value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-full pl-8 pr-3 py-2 text-3.5 h-9.5 rounded-lg border-2 border-(--secondary)/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="0.00"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-3.5 rounded-lg border-2 border-(--secondary)/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  placeholder="Enter bundle description"
                  rows={3}
                />
              </div>

              {/* Image Upload */}
              <ImageUpload
                currentImageUrl={imgUrl}
                onImageUpload={(imageUrl) => setImgUrl(imageUrl)}
                onImageRemove={() => setImgUrl('')}
                bucket="bundle-images"
                compact
              />

              {/* Component Selector */}
              <div className="border-t-2 border-(--secondary)/20 pt-4">
                <label className="block text-sm font-medium text-secondary mb-2">
                  Bundle Components <span className="text-(--error)">*</span>
                </label>

                {/* Item Selector Dropdown */}
                {availableItems.length > 0 && (
                  <div className="mb-4">
                    <DropdownField
                      options={availableItems.map(item => item.name)}
                      defaultValue="Select an item to add..."
                      dropdownPosition="bottom-left"
                      dropdownOffset={{ top: 2, left: 0 }}
                      onChange={(itemName) => {
                        handleSelectItem(itemName);
                      }}
                      height={38}
                      roundness={"lg"}
                      valueAlignment={'left'}
                      shadow={false}
                    />
                  </div>
                )}

                {/* Selected Components List */}
                {selectedComponents.length > 0 && (
                  <div className="space-y-2 max-h-50 overflow-y-auto">
                    {selectedComponents.map((component) => (
                      <div
                        key={component.inventoryItemId}
                        className="flex items-center gap-3 p-2 bg-amber-50 rounded-lg border border-amber-200"
                      >
                        {/* Item Image */}
                        <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                          {component.item.img_url ? (
                            <Image
                              src={component.item.img_url}
                              alt={component.item.name}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>

                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-secondary truncate">
                            {component.item.name}
                          </div>
                          <div className="text-xs text-(--secondary)/50">
                            Stock: {component.item.stock} • {formatCurrency(component.item.price)}
                          </div>
                        </div>

                        {/* Quantity Selector */}
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-(--secondary)/70">Qty:</label>
                          <input
                            type="number"
                            value={component.quantity}
                            onChange={(e) => handleUpdateQuantity(component.inventoryItemId, parseInt(e.target.value) || 1)}
                            min="1"
                            className="w-16 px-2 py-1 text-center text-sm border-2 border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => handleRemoveComponent(component.inventoryItemId)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 py-2 bg-(--error)/10 hover:bg-(--error)/40 text-(--error) rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                Delete
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-secondary rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  !name.trim() ||
                  !priceInput ||
                  isNaN(parseFloat(priceInput)) ||
                  parseFloat(priceInput) <= 0 ||
                  selectedComponents.length === 0
                }
                className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                  name.trim() &&
                  priceInput &&
                  !isNaN(parseFloat(priceInput)) &&
                  parseFloat(priceInput) > 0 &&
                  selectedComponents.length > 0
                    ? 'bg-amber-500 hover:bg-amber-600 text-white hover:scale-105 cursor-pointer'
                    : 'bg-(--secondary)/20 text-(--secondary)/40 hover:scale-100 cursor-not-allowed'
                }`}
              >
                Save Changes
              </button>
            </div>

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-(--error)/20 rounded-xl mx-auto mb-4 flex items-center justify-center">
                      <svg className="w-8 h-8 text-(--error)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-secondary mb-2">
                      Delete Bundle
                    </h3>
                    <p className="text-secondary opacity-70 mb-6">
                      Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-4 py-3 text-sm text-(--secondary)/80 bg-white border border-(--secondary)/20 rounded-lg hover:bg-gray-50 hover:shadow-md transition-colors font-black"
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex-1 py-3 bg-(--error) hover:bg-(--error)/50 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
