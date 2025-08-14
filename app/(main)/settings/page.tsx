'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import TopBar from "@/components/TopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { 
  AppSettings, 
  loadSettingsFromLocal, 
  saveSettingsToLocal, 
  loadSettingsFromFirebase, 
  syncSettingsToFirebase 
} from '@/services/settingsService';

export default function SettingsScreen() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>({ hideOutOfStock: false });
  const [savedSettings, setSavedSettings] = useState<AppSettings>({ hideOutOfStock: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error' | 'created'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  // Check if there are unsaved changes
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Always try to load from Firebase first (global settings)
        const firebaseSettings = await loadSettingsFromFirebase();
        setSettings(firebaseSettings);
        setSavedSettings(firebaseSettings);
        console.log('✅ Global settings loaded successfully');
      } catch (error) {
        // Fallback to localStorage
        const localSettings = loadSettingsFromLocal();
        setSettings(localSettings);
        setSavedSettings(localSettings);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []); // Removed user dependency since we're using global settings

  const handleHideOutOfStockToggle = () => {
    setSettings(prev => ({ ...prev, hideOutOfStock: !prev.hideOutOfStock }));
  };

  const handleSave = () => {
    saveSettingsToLocal(settings);
    setSavedSettings(settings);
  };

  const handleCancel = () => {
    setSettings(savedSettings);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('');
    
    try {
      // Use current settings (which may include unsaved changes)
      const settingsToSync = hasChanges ? settings : savedSettings;
      
      const result = await syncSettingsToFirebase(settingsToSync);
      
      // If we synced unsaved changes, update savedSettings to match
      if (hasChanges) {
        console.log('💾 Saving to local storage...');
        saveSettingsToLocal(settings);
        setSavedSettings(settings);
      }
      
      if (result.isNew) {
        setSyncStatus('created');
        setSyncMessage('Settings created in cloud successfully!');
      } else {
        setSyncStatus('success');
        setSyncMessage('Settings synced to cloud successfully!');
      }
      
      // Clear status after 3 seconds
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 3000);
      
    } catch (error) {
      setSyncStatus('error');
      setSyncMessage('Failed to sync settings to cloud. Please try again.');
      
      // Clear error status after 5 seconds
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage('');
      }, 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full overflow-hidden">
        <div className="flex flex-col flex-1 h-full overflow-hidden">
          <TopBar title="Settings" />
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        
        {/* Header Section - Fixed */}
        <TopBar title="Settings" />
        
        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="max-w-md mx-auto pt-8">
            <div className="space-y-6">
              
              {/* Hide Out of Stock Setting */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-[var(--secondary)] mb-4">Menu Display</h3>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label htmlFor="hide-out-of-stock" className="block text-sm font-medium text-[var(--secondary)]">
                      Hide Out-of-Stock Items
                    </label>
                    <p className="text-xs text-gray-500 mt-1">Hide items with zero stock from the store menu</p>
                  </div>
                  <div className="flex items-center">
                    <button
                      type="button"
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
                        settings.hideOutOfStock ? 'bg-[var(--accent)]' : 'bg-gray-200'
                      }`}
                      onClick={handleHideOutOfStockToggle}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.hideOutOfStock ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges}
                    className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                      hasChanges
                        ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Save to Device
                  </button>
                  {hasChanges && (
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                
                {/* Global Settings Sync - Always Available */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={handleSync}
                      disabled={isSyncing}
                      className={`w-full px-4 py-2 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                        syncStatus === 'success' 
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : syncStatus === 'created'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : syncStatus === 'error'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : isSyncing
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                          : 'bg-white text-[var(--secondary)] border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isSyncing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                          Syncing...
                        </>
                      ) : syncStatus === 'success' ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Synced Successfully
                        </>
                      ) : syncStatus === 'created' ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Created in Cloud
                        </>
                      ) : syncStatus === 'error' ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Sync Failed
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                          Sync to Cloud
                        </>
                      )}
                    </button>
                    
                    {/* Status Messages */}
                    {syncMessage && (
                      <div className={`mt-2 p-2 rounded-md text-xs text-center transition-all duration-200 ${
                        syncStatus === 'success' 
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : syncStatus === 'created'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : syncStatus === 'error'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-gray-50 text-gray-600 border border-gray-200'
                      }`}>
                        {syncMessage}
                      </div>
                    )}
                    
                    {hasChanges && (
                      <p className="text-xs text-blue-600 mt-2 text-center">
                        Sync will save and upload your current changes to cloud
                      </p>
                    )}
                  </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
