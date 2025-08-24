'use client';

import LogsIcon from "@/components/icons/SidebarNav/LogsIcon";
import TopBar from "@/components/TopBar";

export default function LogsScreen() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        
        {/* Header Section - Fixed */}
        <TopBar title="Logs" icon={<LogsIcon />} />

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-24 h-24 bg-[var(--light-accent)] rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-12 h-12 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--secondary)] mb-2">Logs Page</h2>
              <p className="text-[var(--secondary)] opacity-70">This page is ready for system logs and activity tracking.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
