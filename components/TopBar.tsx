'use client';

import MenuBurger from "@/components/icons/MenuBurger";
import UserIcon from "@/components/icons/UserIcon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import ClockIcon from "@/components/icons/ClockIcon";
import RefreshIcon from "@/components/icons/RefreshIcon";
import { useDrawer } from "@/components/Drawer";
import { useDateTime } from "@/contexts/DateTimeContext";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface TopBarProps {
  title?: string;
}

export default function TopBar({ title }: TopBarProps) {
  const { toggle: toggleDrawer } = useDrawer();
  const { date, time, isInternetTime, isLoading, forceSync } = useDateTime();
  const { user, logout } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

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

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Extract user display name from email
  const userDisplayName = user?.email?.split('@')[0] || 'Worker';

  return (
    <div className="flex-shrink-0 p-6 pb-0">
      <div className="flex items-center justify-between h-14 mb-3 w-full">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 overflow-x-auto">
          <button
            onClick={toggleDrawer}
            className="h-14 w-14 min-w-14 bg-[var(--primary)] rounded-xl flex justify-center items-center hover:scale-110 hover:shadow-lg transition-all cursor-pointer flex-shrink-0"
          >
            <MenuBurger />
          </button>
          
          {/* User Info with Logout */}
          <div className="relative group">
            <div className="flex-shrink-0 min-w-[30px] h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] font-medium gap-3 items-center cursor-pointer hover:shadow-md transition-all">
              <span className="w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm">
                <UserIcon />
              </span>
              <span className="hidden sm:inline">{userDisplayName}</span>
            </div>
            
            {/* Logout Dropdown */}
            <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 min-w-[200px]">
              <div className="p-2">
                <div className="px-3 py-2 text-sm text-gray-700 border-b border-gray-100">
                  <div className="font-medium">{userDisplayName}</div>
                  <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoggingOut ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      Logging out...
                    </>
                  ) : (
                    'Logout'
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 min-w-[30px] h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] font-medium gap-3 items-center">
            <span className="w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm">
              <CalendarIcon />
            </span>
            <div className="flex flex-col items-start">
              {isLoading && !date ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <span className="text-sm sm:text-base">{date}</span>
                  {!isInternetTime && date && (
                    <span className="text-xs opacity-70">(Local)</span>
                  )}
                </>
              )}
            </div>
          </div>
          <span className="hidden sm:inline">-</span>
          <div className="flex-shrink-0 min-w-[8rem] h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] font-medium gap-3 items-center">
            <span className="w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm">
              <ClockIcon />
            </span>
            <div className="flex flex-col items-start">
              {isLoading && !time ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <span className="text-sm sm:text-base">{time}</span>
                  {!isInternetTime && time && (
                    <span className="text-xs opacity-70">(Local)</span>
                  )}
                </>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="ml-2 p-1 hover:bg-[var(--light-accent)] rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
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
