'use client';

import MenuBurger from "@/components/icons/MenuBurger";
import UserIcon from "@/components/icons/UserIcon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import ClockIcon from "@/components/icons/ClockIcon";
import RefreshIcon from "@/components/icons/RefreshIcon";
import { useDrawer } from "@/components/Drawer";
import { useDateTime } from "@/contexts/DateTimeContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useState } from "react";

interface TopBarProps {
  title?: string;
}

export default function TopBar({ title }: TopBarProps) {
  const { toggle: toggleDrawer } = useDrawer();
  const { date, time, isInternetTime, isLoading, forceSync } = useDateTime();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await forceSync();
    } catch (error) {
      console.error('Failed to refresh time:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex-shrink-0 p-6 pb-0">
      <div className="flex items-center justify-between h-14 mb-3 w-full">
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={toggleDrawer}
            className="h-14 w-14 bg-[var(--primary)] rounded-xl flex justify-center items-center shadow-md hover:scale-110 hover:shadow-lg transition-all cursor-pointer"
          >
            <MenuBurger />
          </button>
          <div className="flex-0 h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] font-medium gap-3 items-center">
            <span className="w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm">
              <UserIcon />
            </span>
            Worker
          </div>
          <div className="h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] font-medium gap-3 items-center">
            <span className="w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm">
              <CalendarIcon />
            </span>
            <div className="flex flex-col items-start">
              {isLoading && !date ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <span>{date}</span>
                  {!isInternetTime && date && (
                    <span className="text-xs opacity-70">(Local)</span>
                  )}
                </>
              )}
            </div>
          </div>
          -
          <div className="h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] font-medium gap-3 items-center">
            <span className="w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm">
              <ClockIcon />
            </span>
            <div className="flex flex-col items-start">
              {isLoading && !time ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <span>{time}</span>
                  {!isInternetTime && time && (
                    <span className="text-xs opacity-70">(Local)</span>
                  )}
                </>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="ml-2 p-1 hover:bg-[var(--light-accent)] rounded-full transition-colors disabled:opacity-50"
              title={`${isInternetTime ? 'Internet time' : 'Local time'} - Click to sync`}
            >
              <RefreshIcon 
                className="w-4 h-4 text-[var(--secondary)]" 
                isSpinning={isRefreshing} 
              />
            </button>
          </div>
        </div>
      </div>

      {/* Page Title */}
      {title && (
        <div className="flex items-center justify-between mb-6 mt-12">
          <h1 className="text-[var(--secondary)] text-2xl font-bold">
            {title}
          </h1>
        </div>
      )}
    </div>
  );
}
