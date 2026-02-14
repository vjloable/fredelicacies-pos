// Supabase settings service - migrated from Firebase
// TODO: Implement Supabase version of settings management

export interface AppSettings {
  hideOutOfStock: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  hideOutOfStock: false,
};

const SETTINGS_KEY = 'app_settings';
const SETTINGS_TIMESTAMP_KEY = 'app_settings_timestamp';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

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
  // If not forcing refresh and cache is valid, use local settings
  if (!forceRefresh && isCacheValid()) {
    console.log('🔄 Using cached settings (less than 1 hour old)');
    return loadSettingsFromLocal();
  }

  // Cache is invalid or refresh forced, load from Supabase
  try {
    console.log('🔍 Loading settings from Supabase...');
    // TODO: Implement Supabase version
    // const { data, error } = await supabase
    //   .from('settings')
    //   .select('*')
    //   .eq('id', 'global')
    //   .single();
    
    // For now, use local storage
    const settings = loadSettingsFromLocal();
    console.log('✅ Settings loaded from localStorage:', settings);
    return settings;
  } catch (error) {
    console.error('❌ Error loading settings:', error);
    
    // Fallback to localStorage if Supabase fails
    console.log('⚠️ Falling back to cached localStorage settings');
    return loadSettingsFromLocal();
  }
};

// Load settings from Firebase (legacy function - kept for backward compatibility)
export const loadSettingsFromFirebase = async (): Promise<AppSettings> => {
  return loadSettings(true); // Force refresh when called directly
};

// Sync settings to Supabase (manual sync)
// TODO: Migrate to Supabase when ready
export const syncSettingsToFirebase = async (settings: AppSettings): Promise<{ isNew: boolean }> => {
  try {
    console.log('🔄 Syncing settings...');
    console.log('⚙️ Settings to sync:', settings);
    
    // TODO: Implement Supabase version
    // const { data, error } = await supabase
    //   .from('settings')
    //   .upsert({ id: 'global', ...settings })
    //   .select()
    //   .single();
    
    // For now, just save to localStorage
    saveSettingsToLocal(settings);
    console.log('💾 Settings cached locally with updated timestamp');
    
    return { isNew: false };
  } catch (error) {
    console.error('❌ Error syncing settings:', error);
    console.error('📊 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code || 'Unknown code',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    throw error;
  }
};
