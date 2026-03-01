'use client';

import { useState, useEffect } from 'react';
import { branchService, Branch } from '@/services/branchService';
import ImageUpload from '@/components/ImageUpload';
import LoadingSpinner from '@/components/LoadingSpinner';

interface EditBranchModalProps {
  isOpen: boolean;
  branch: Branch | null;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function EditBranchModal({
  isOpen,
  branch,
  onClose,
  onSuccess,
  onError
}: EditBranchModalProps) {
  const [loading, setLoading] = useState(false);
  const [branchData, setBranchData] = useState({
    name: '',
    address: '',
    status: 'active' as 'active' | 'inactive',
    logo_url: ''
  });

  // Update form data when branch prop changes
  useEffect(() => {
    if (branch) {
      setBranchData({
        name: branch.name,
        address: branch.address || '',
        status: branch.status,
        logo_url: branch.logo_url || ''
      });
    }
  }, [branch]);

  if (!isOpen || !branch) return null;

  const validateForm = () => {
    if (!branchData.name.trim()) {
      onError('Branch name is required');
      return false;
    }
    if (!branchData.address.trim()) {
      onError('Branch location is required');
      return false;
    }
    return true;
  };

  const handleUpdateBranch = async () => {
    if (!validateForm() || !branch) return;

    setLoading(true);
    try {
      await branchService.updateBranch(branch.id, {
        name: branchData.name.trim(),
        address: branchData.address.trim(),
        status: branchData.status,
        logo_url: branchData.logo_url || ''
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating branch:', error);
      onError('Failed to update branch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof branchData, value: string | boolean) => {
    setBranchData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const hasChanges = branch && (
    branchData.name !== branch.name ||
    branchData.address !== (branch.address || '') ||
    branchData.status !== branch.status
    || branchData.logo_url !== (branch.logo_url || '')
  );

  return (
    <div 
      className="fixed inset-0 bg-primary/80 flex items-center justify-center z-50 p-4 sm:p-6"
      onClick={!loading ? onClose : undefined}
    >
      <div 
        className="bg-white rounded-2xl p-4 sm:p-6 lg:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          /* Loading Screen */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-light-accent rounded-xl mx-auto mb-4 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
            <h3 className="text-lg font-bold text-secondary mb-2">
              Updating Branch...
            </h3>
            <p className="text-secondary opacity-70">
              Please wait while we update your branch information
            </p>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-light-accent rounded-xl mx-auto mb-4 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-secondary mb-2">
                Edit Branch
              </h3>
              <p className="text-secondary opacity-70">
                Update branch information and settings
              </p>
            </div>

            {/* Edit Branch Form */}
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-xs font-medium text-secondary mb-2">
                  Branch Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={branchData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-3 h-10 sm:h-11 rounded-lg border-2 border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Enter branch name"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary mb-2">
                  Location <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={branchData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-3 h-10 sm:h-11 rounded-lg border-2 border-secondary/20 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Enter branch location"
                  maxLength={200}
                />
              </div>

              {/* Branch Status Toggle */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-2">
                  Branch Status
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleInputChange('status', branchData.status === 'active' ? 'inactive' : 'active')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      branchData.status === 'active' ? 'bg-accent' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        branchData.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className={`text-xs font-medium ${
                    branchData.status === 'active' ? 'text-success' : 'text-error'
                  }`}>
                    {branchData.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-secondary opacity-70 mt-1">
                  {branchData.status === 'active' 
                    ? 'Branch is currently operational and accessible to users'
                    : 'Branch is disabled and will not appear in user selections'
                  }
                </p>
              </div>
              <div>
                  <ImageUpload
                    currentImageUrl={branchData.logo_url}
                    onImageUpload={(imageUrl) => setBranchData({...branchData, logo_url: imageUrl})}
                    onImageRemove={() => setBranchData({...branchData, logo_url: ""})}
                    bucket="branch-logos"
                  />
                </div>

              {/* Changes indicator */}
              {hasChanges && (
                <div className="bg-error/5 border border-error/50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-error" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs text-error font-medium">Unsaved changes detected</span>
                  </div>
                </div>
              )}

              {/* Preview Section */}
              {/* <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-secondary opacity-70 mb-2">Preview:</div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-light-accent rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-secondary mb-1">
                      {branchData.name || 'Branch Name'}
                    </h4>
                    <p className="text-xs text-secondary opacity-70">
                      {branchData.address || 'Branch Location'}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className={`text-xs px-2 py-1 rounded ${
                      branchData.status === 'active' 
                        ? 'text-green-600 bg-green-50' 
                        : 'text-red-600 bg-red-50'
                    }`}>
                      {branchData.status === 'active' ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>
              </div> */}
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
                onClick={handleUpdateBranch}
                disabled={!branchData.name.trim() || !branchData.address.trim() || !hasChanges}
                className={`w-full sm:flex-1 py-2.5 sm:py-3 rounded-xl font-semibold transition-all text-xs sm:text-sm ${
                  branchData.name.trim() && branchData.address.trim() && hasChanges
                    ? 'bg-accent hover:bg-accent text-primary text-shadow-lg hover:scale-105 cursor-pointer'
                    : 'bg-secondary/20 text-secondary/40 hover:scale-100 active:scale-100 cursor-not-allowed'
                }`}
              >
                {hasChanges ? 'Update Branch' : 'No Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}