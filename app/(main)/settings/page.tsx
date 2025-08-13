'use client';

import TopBar from "@/components/TopBar";

export default function SettingsScreen() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        
        {/* Header Section - Fixed */}
        <TopBar title="Settings" />
        
        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-24 h-24 bg-[var(--light-accent)] rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-12 h-12 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--secondary)] mb-2">Settings Page</h2>
              <p className="text-[var(--secondary)] opacity-70">This page is ready for settings features.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
