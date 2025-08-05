'use client';

import TopBar from "@/components/TopBar";

export default function Inventory() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        
        {/* Header Section - Fixed */}
        <TopBar title="Inventory Management" />

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-24 h-24 bg-[var(--light-accent)] rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-12 h-12 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm8 8v2a1 1 0 01-1 1H6a1 1 0 01-1-1v-2h8z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--secondary)] mb-2">Inventory Page</h2>
              <p className="text-[var(--secondary)] opacity-70">This page is ready for inventory management features.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
