import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase-config';

export interface AppSettings {
  hideOutOfStock: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  hideOutOfStock: false,
};

const SETTINGS_KEY = 'app_settings';

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

// Save settings to localStorage
export const saveSettingsToLocal = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
  }
};

// Load settings from Firebase (one-time on app start)
export const loadSettingsFromFirebase = async (): Promise<AppSettings> => {
  try {
    console.log('🔍 Loading settings from Firebase...');
    const settingsRef = doc(db, 'settings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      console.log('📄 Found existing settings in Firebase');
      const firebaseSettings = settingsSnap.data() as AppSettings;
      // Merge with defaults to ensure all fields exist
      const mergedSettings = { ...DEFAULT_SETTINGS, ...firebaseSettings };
      // Save to localStorage for future use
      saveSettingsToLocal(mergedSettings);
      console.log('✅ Settings loaded and saved to localStorage:', mergedSettings);
      return mergedSettings;
    } else {
      console.log('📄 No settings found in Firebase, will create default');
      // Create default settings in Firebase
      const defaultSettings = DEFAULT_SETTINGS;
      await setDoc(settingsRef, defaultSettings);
      saveSettingsToLocal(defaultSettings);
      console.log('✅ Created default settings in Firebase and localStorage');
      return defaultSettings;
    }
  } catch (error) {
    console.error('❌ Error loading settings from Firebase:', error);
  }
  
  // Fallback to localStorage if Firebase fails
  console.log('⚠️ Falling back to localStorage');
  return loadSettingsFromLocal();
};

// Sync settings to Firebase (manual sync)
export const syncSettingsToFirebase = async (settings: AppSettings): Promise<{ isNew: boolean }> => {
  try {
    console.log('🔄 Starting global settings sync to Firebase...');
    console.log('⚙️ Settings to sync:', settings);
    
    const settingsRef = doc(db, 'settings', 'global');
    console.log('📄 Using global settings document');

    const settingsSnap = await getDoc(settingsRef);
    const isNew = !settingsSnap.exists();
    console.log('🆕 Is new document:', isNew);
    
    await setDoc(settingsRef, settings, { merge: true });
    console.log('✅ Global settings synced to Firebase successfully');
    
    // Also save to localStorage to keep them in sync
    saveSettingsToLocal(settings);
    console.log('💾 Settings also saved to localStorage');
    
    return { isNew };
  } catch (error) {
    console.error('❌ Error syncing settings to Firebase:', error);
    console.error('📊 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code || 'Unknown code',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    throw error;
  }
};
