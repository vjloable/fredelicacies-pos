'use client';

import { useState, useEffect } from 'react';
import TopBar from "@/components/TopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { 
  AppSettings, 
  loadSettingsFromLocal, 
  saveSettingsToLocal, 
  loadSettings,
  syncSettingsToFirebase 
} from '@/services/settingsService';
import SettingsIcon from '@/components/icons/SidebarNav/SettingsIcon';
import { useBluetoothPrinter } from '@/contexts/BluetoothContext';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>({ hideOutOfStock: false });
  const [savedSettings, setSavedSettings] = useState<AppSettings>({ hideOutOfStock: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error' | 'created'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  // Use Bluetooth context
  const {
    bluetoothDevice,
    bluetoothStatus,
    isConnecting,
    connectToBluetoothPrinter,
    disconnectPrinter,
    testPrint
  } = useBluetoothPrinter();

  // Check if there are unsaved changes
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  // Load settings on component mount
  useEffect(() => {
    const loadSettingsData = async () => {
      try {
        // Use cached settings (will auto-refresh if cache is older than 1 hour)
        const cachedSettings = await loadSettings();
        setSettings(cachedSettings);
        setSavedSettings(cachedSettings);
        console.log('✅ Settings loaded (cached or refreshed)');
      } catch (error) {
        // Fallback to localStorage
        console.log('Error loading settings:', error);
        const localSettings = loadSettingsFromLocal();
        setSettings(localSettings);
        setSavedSettings(localSettings);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettingsData();
  }, []);

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
        saveSettingsToLocal(settings);
        setSavedSettings(settings);
      }
      
      // Force refresh settings from Firebase to ensure sync
      const refreshedSettings = await loadSettings(true);
      setSettings(refreshedSettings);
      setSavedSettings(refreshedSettings);
      
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
      console.log('Error syncing settings:', error);
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

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        
        {/* Header Section - Fixed */}
        <TopBar title="Settings" icon={<SettingsIcon />} />

        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        )}

        {!isLoading && (
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="max-w-6xl mx-auto pt-8">
              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Left Column - Preferences */}
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-[var(--secondary)] mb-2">Preferences</h2>
                    <p className="text-[var(--secondary)] opacity-70">Customize your app experience and display settings.</p>
                  </div>

                  {/* Menu Display Setting */}
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

                  {/* Save/Sync Actions */}
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-[var(--secondary)] mb-4">Save & Sync</h3>
                    
                    {/* Action Buttons */}
                    <div className="space-y-3">
                      {/* Local Save/Cancel Row */}
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
                          Save Locally
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
                      
                      {/* Cloud Sync Button */}
                      <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className={`w-full px-4 py-2 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                          syncStatus === 'success' 
                            ? 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]'
                            : syncStatus === 'created'
                            ? 'bg-[var(--secondary)]/10 text-[var(--secondary)] border border-[var(--secondary)]'
                            : syncStatus === 'error'
                            ? 'bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]'
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
                            Synced to Cloud
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
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                            </svg>
                            Sync to Cloud
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Status Messages */}
                    {syncMessage && (
                      <div className={`mt-2 p-2 rounded-md text-xs text-center transition-all duration-200 ${
                        syncStatus === 'success' 
                          ? 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]'
                          : syncStatus === 'created'
                          ? 'bg-[var(--secondary)]/10 text-[var(--secondary)] border border-[var(--secondary)]'
                          : syncStatus === 'error'
                          ? 'bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]'
                          : 'bg-gray-50 text-gray-600 border border-gray-200'
                      }`}>
                        {syncMessage}
                      </div>
                    )}
                    
                    {hasChanges && (
                      <p className="text-xs text-[var(--secondary)] mt-2 text-center">
                        Sync will save and upload your current changes to cloud
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Column - Utilities */}
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-[var(--secondary)] mb-2">Utilities</h2>
                    <p className="text-[var(--secondary)] opacity-70">Hardware connections and system utilities.</p>
                  </div>

                  {/* Bluetooth Printer Section */}
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-[var(--secondary)] mb-4 flex items-center gap-2">
                      Bluetooth
                    </h3>
                    
                    <p className="text-sm text-[var(--secondary)] opacity-70 mb-4">
                      Connect to a thermal receipt printer. Once connected, receipts will automatically print when orders are confirmed.
                    </p>

                    {/* Bluetooth Status Display */}
                    {bluetoothStatus && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                        <p className="text-sm text-[var(--secondary)]">{bluetoothStatus}</p>
                      </div>
                    )}
                    
                    {/* Connection Status Indicator */}
                    <div className="mb-4">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        bluetoothDevice ? 'bg-green-100 text-green-800' : 
                        'bg-gray-100 text-gray-600'
                      }`}>
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          bluetoothDevice ? 'bg-green-400' : 
                          'bg-gray-400'
                        }`}></div>
                        {bluetoothDevice ? `Connected: ${bluetoothDevice.name || 'Unknown'}` : 
                         'Not Connected'}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="space-y-3">
                      {!bluetoothDevice ? (
                        <button
                          onClick={connectToBluetoothPrinter}
                          disabled={isConnecting}
                          className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                            isConnecting
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-[var(--accent)] hover:bg-[var(--secondary]/80 text-white hover:shadow-lg'
                          }`}
                        >
                          {isConnecting ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                              Connecting...
                            </div>
                          ) : (
                            'Connect Printer'
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={testPrint}
                            className="w-full py-2 px-4 rounded-lg font-medium bg-[var(--success)] hover:bg-[var(--success)]/50 text-[var(--secondary)] hover:shadow-lg transition-all"
                          >
                            Test Print
                          </button>
                          <button
                            onClick={disconnectPrinter}
                            className="w-full py-2 px-4 rounded-lg font-medium bg-[var(--error)] hover:bg-[var(--error)]/50 text-[var(--primary)] hover:shadow-lg transition-all"
                          >
                            Disconnect
                          </button>
                        </>
                      )}
                    </div>
                    
                    {/* Instructions */}
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-[var(--secondary)] mb-2 text-sm">How to use:</h4>
                      <ul className="text-xs text-[var(--secondary)] opacity-70 space-y-1">
                        <li>• Put your thermal printer in pairing mode</li>
                        <li>• Click {"Connect Printer"} and select your device</li>
                        <li>• Use {"Test Print"} to verify the connection</li>
                        <li>• Once connected, receipts will auto-print on order confirmation</li>
                        <li>• Connection persists until manually disconnected</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
