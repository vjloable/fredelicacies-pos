'use client';

import { useState } from 'react';
import PlusIcon from '@/components/icons/PlusIcon';
import { branchService } from '@/services/branchService';
import type { BranchType } from '@/types/domain';
import ImageUpload from '@/components/ImageUpload';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';

// Owners can create these kinds.
const BRANCH_TYPE_OPTIONS: { value: BranchType; label: string; hint: string }[] = [
  { value: 'branch', label: 'Branch', hint: 'Regular store with sales' },
  { value: 'commissary', label: 'Commissary', hint: 'Production hub, no store' },
  { value: 'event', label: 'Event', hint: 'Pop-up / bazaar store' },
];

interface AddBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function AddBranchModal({
  isOpen,
  onClose,
  onSuccess,
  onError
}: AddBranchModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [branchType, setBranchType] = useState<BranchType>('branch');
  const [branchData, setBranchData] = useState({
    name: '',
    address: '',
    logo_url: '',
    branch_code: '',
  });

  if (!isOpen) return null;

  // Commissary has no store/sales, so it needs no order-number branch code.
  const codeRequired = branchType !== 'commissary';

  const validateForm = () => {
    if (!branchData.name.trim()) {
      onError('Branch name is required');
      return false;
    }
    if (!branchData.address.trim()) {
      onError('Branch location is required');
      return false;
    }
    if (codeRequired) {
      if (!branchData.branch_code.trim()) {
        onError('Branch code is required');
        return false;
      }
      if (!/^[A-Z]{3}$/.test(branchData.branch_code)) {
        onError('Branch code must be exactly 3 uppercase letters');
        return false;
      }
    }
    return true;
  };

  const handleCreateBranch = async () => {
    if (!validateForm()) return;
    if (!user) {
      onError('User not authenticated');
      return;
    }

    setLoading(true);
    try {
      await branchService.createBranch(user.uid, {
        name: branchData.name.trim(),
        address: branchData.address.trim(),
        logo_url: branchData.logo_url,
        branch_code: branchData.branch_code ? branchData.branch_code.toUpperCase() : undefined,
        type: branchType,
      });

      // Reset form
      setBranchType('branch');
      setBranchData({
        name: '',
        address: '',
        logo_url: '',
        branch_code: '',
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating branch:', error);
      onError('Failed to create branch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof branchData, value: string) => {
    setBranchData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div 
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4 sm:p-6"
      onClick={!loading ? onClose : undefined}
    >
      <div 
        className="bg-white rounded-2xl p-4 sm:p-6 lg:p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          /* Loading Screen */
          <div className="text-center py-12">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl border border-accent/30 flex items-center justify-center text-accent">
              <LoadingSpinner size="lg" />
            </div>
            <h3 className="text-lg font-bold text-secondary mb-2">
              Creating Branch...
            </h3>
            <p className="text-secondary opacity-70">
              Please wait while we create your new branch
            </p>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl border border-accent/30 flex items-center justify-center text-accent">
                <PlusIcon className='size-6 text-accent'/>
              </div>
              <h3 className="text-lg font-bold text-secondary mb-2">
                Add New Branch
              </h3>
              <p className="text-secondary opacity-70">
                Create a new branch location for your business
              </p>
            </div>

            {/* Add Branch Form */}
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-xs font-medium text-secondary mb-2">
                  Type <span className="text-error">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {BRANCH_TYPE_OPTIONS.map((opt) => {
                    const selected = branchType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBranchType(opt.value)}
                        className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border-2 transition-all ${
                          selected
                            ? 'border-accent bg-accent/5'
                            : 'border-secondary/15 bg-white hover:border-secondary/30'
                        }`}
                      >
                        <span className={`text-3 font-bold ${selected ? 'text-accent' : 'text-secondary'}`}>{opt.label}</span>
                        <span className="text-2.5 text-secondary/50 text-center leading-tight">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary mb-2">
                  Branch Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={branchData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 text-3 h-9.5 rounded-lg border border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Enter branch name"
                  maxLength={100}
                />
              </div>

              {codeRequired && (
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">
                    Branch Code <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={branchData.branch_code}
                    onChange={(e) => handleInputChange('branch_code', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
                    className="w-full px-3 py-2 text-3 h-9.5 rounded-lg border border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent font-mono tracking-widest uppercase"
                    placeholder="e.g. MNL"
                    maxLength={3}
                  />
                  <p className="mt-1 text-2.5 text-secondary/40">
                    3 letters used in order numbers: <span className="font-mono">{branchData.branch_code || 'XXX'}-2025-000001</span>
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-secondary mb-2">
                  Location <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={branchData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full px-3 py-2 text-3 h-9.5 rounded-lg border border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Enter branch location"
                  maxLength={200}
                />
                
                
              </div>
              <div>
                  <ImageUpload
                    currentImageUrl={branchData.logo_url}
                    onImageUpload={(imageUrl) => setBranchData({...branchData, logo_url: imageUrl})}
                    onImageRemove={() => setBranchData({...branchData, logo_url: ""})}
                    bucket="branch-logos"
                  />
                </div>

              {/* Preview Section */}
              {/* {(branchData.name.trim() || branchData.address.trim()) && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-secondary opacity-70 mb-2">Preview:</div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-light-accent rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-secondary mb-1">
                        {branchData.name.trim() || 'Branch Name'}
                      </h4>
                      <p className="text-xs text-secondary opacity-70">
                        {branchData.address.trim() || 'Branch Location'}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        Active
                      </div>
                    </div>
                  </div>
                </div>
              )} */}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8">
              <button
                onClick={onClose}
                className="w-full sm:flex-1 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-secondary rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBranch}
                disabled={!branchData.name.trim() || !branchData.address.trim() || (codeRequired && branchData.branch_code.length !== 3)}
                className={`w-full sm:flex-1 py-2.5 sm:py-3 rounded-xl font-semibold transition-all text-xs sm:text-sm ${
                  branchData.name.trim() && branchData.address.trim() && (!codeRequired || branchData.branch_code.length === 3)
                    ? 'bg-accent hover:bg-accent text-primary text-shadow-lg hover:scale-105 cursor-pointer'
                    : 'bg-secondary/20 text-secondary/40 hover:scale-100 active:scale-100 cursor-not-allowed'
                }`}
              >
                Create {branchType === 'commissary' ? 'Commissary' : branchType === 'event' ? 'Event' : 'Branch'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}