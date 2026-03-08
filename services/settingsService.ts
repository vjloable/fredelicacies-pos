import { supabase } from '@/lib/supabase';

export interface AppSettings {
  hideOutOfStock: boolean;
  grabFeePercent: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  hideOutOfStock: false,
  grabFeePercent: 0,
};

const SETTINGS_KEY = 'app_settings';
const SETTINGS_TIMESTAMP_KEY = 'app_settings_timestamp';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Map DB row → AppSettings
const rowToSettings = (row: Record<string, unknown>): AppSettings => ({
  hideOutOfStock: Boolean(row.hide_out_of_stock ?? false),
  grabFeePercent: Number(row.grab_fee_percent ?? 0),
});

// Load settings from localStorage
export const loadSettingsFromLocal = (): AppSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading settings from localStorage:', error);
  }
  return DEFAULT_SETTINGS;
};

// Save settings to localStorage with timestamp
export const saveSettingsToLocal = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(SETTINGS_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
  }
};

// Check if cached settings are still valid (less than 1 hour old)
const isCacheValid = (): boolean => {
  try {
    const timestamp = localStorage.getItem(SETTINGS_TIMESTAMP_KEY);
    if (!timestamp) return false;
    const cacheAge = Date.now() - parseInt(timestamp);
    return cacheAge < CACHE_DURATION;
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
};

// Load settings with caching logic
export const loadSettings = async (forceRefresh: boolean = false): Promise<AppSettings> => {
  if (!forceRefresh && isCacheValid()) {
    return loadSettingsFromLocal();
  }

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'global')
      .single();

    if (error || !data) {
      throw error;
    }

    const settings = rowToSettings(data);
    saveSettingsToLocal(settings);
    return settings;
  } catch (error) {
    console.error('❌ Error loading settings from Supabase:', error);
    return loadSettingsFromLocal();
  }
};

// Load settings from backend (force refresh)
export const loadSettingsFromBackend = async (): Promise<AppSettings> => {
  return loadSettings(true);
};

// Sync settings to backend (manual sync)
export const syncSettingsToBackend = async (settings: AppSettings): Promise<{ isNew: boolean }> => {
  const { error } = await supabase
    .from('settings')
    .update({
      hide_out_of_stock: settings.hideOutOfStock,
      grab_fee_percent: settings.grabFeePercent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'global');

  if (error) {
    console.error('❌ Error syncing settings:', error);
    throw error;
  }

  saveSettingsToLocal(settings);
  return { isNew: false };
};
