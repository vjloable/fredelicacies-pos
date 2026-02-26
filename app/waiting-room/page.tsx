"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import LogoVerticalIcon from "@/components/icons/LogoVerticalIcon";
import VersionDisplay from "@/components/VersionDisplay";

export default function WaitingRoomPage() {
  const { user, logout, refreshUserData } = useAuth();
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const router = useRouter();

  // Check for access with realtime subscriptions
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // If user already has access, redirect them
    if (user.is_owner || user.roleAssignments.length > 0) {
      if (user.is_owner) {
        router.push('/owner/branches');
      } else {
        const branchId = user.roleAssignments[0]?.branchId;
        if (branchId) {
          router.push(`/${branchId}/store`);
        }
      }
      return;
    }

    // Subscribe to realtime changes in user_profiles and workers tables
    const channel = supabase
      .channel(`waiting-room-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`,
        },
        async () => {
          await refreshUserData();
          setLastChecked(new Date());
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workers',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          await refreshUserData();
          setLastChecked(new Date());
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.is_owner, user?.roleAssignments.length, user?.id, router, refreshUserData]);

  const handleManualRefresh = async () => {
    setIsCheckingAccess(true);
    try {
      await refreshUserData();
      setLastChecked(new Date());
    } catch (error: unknown) {
      console.error('Error refreshing user data:', error);
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error: unknown) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundImage: "url('/cover.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="w-full max-w-lg">
        {/* Waiting Room Card */}
        <div className="bg-white rounded-xl shadow-xl">
          {/* Logo/Header */}
          <div className="text-center">
            <div className="w-full h-full mx-auto mb-4 flex items-center justify-center bg-primary py-6 shadow-md rounded-t-xl">
              <div className="w-41.25 h-30">
                <LogoVerticalIcon />
              </div>
            </div>
          </div>

          <div className="p-8 text-center">
            {/* Waiting Icon with Animation */}
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-(--light-accent) rounded-full flex items-center justify-center relative">
                <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {/* Pulse animation */}
                <div className="absolute inset-0 rounded-full bg-accent animate-ping opacity-25"></div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-secondary mb-4">
              Welcome to Fredelicacies POS!
            </h1>

            {/* Status Message */}
            <div className="mb-6">
              <p className="text-secondary mb-3">
                Your account has been created successfully.
              </p>
              <div className="bg-(--light-accent) border border-accent rounded-lg p-4 text-left">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-accent mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-yellow-800 mb-1">
                      Waiting for Access Approval
                    </p>
                    <p className="text-xs text-yellow-700">
                      Please contact the owner or administrator to assign you to a branch. 
                      You will be able to access the system once your role has been configured.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg text-left">
              <h3 className="text-sm font-medium text-secondary mb-2">Account Details:</h3>
              <div className="space-y-1 text-xs text-gray-600">
                <p><span className="font-medium">Name:</span> {user?.name || 'N/A'}</p>
                <p><span className="font-medium">Email:</span> {user?.email || 'N/A'}</p>
                <p><span className="font-medium">Status:</span> Pending Access</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Refresh Button */}
              <button
                onClick={handleManualRefresh}
                disabled={isCheckingAccess}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                  isCheckingAccess
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-accent hover:bg-accent/90 text-white hover:shadow-lg"
                }`}
              >
                {isCheckingAccess ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Checking Access...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Check Access Status
                  </div>
                )}
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full py-2 px-4 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
              >
                Sign Out
              </button>
            </div>

            {/* Auto-refresh Notice */}
            <div className="mt-4">
              <p className="text-xs text-gray-500">
                This page automatically checks for updates every 30 seconds
              </p>
              {lastChecked && (
                <p className="text-xs text-gray-400 mt-1">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6">
              <p className="text-xs text-secondary opacity-50">
                Fredelicacies Point-of-Sales System <VersionDisplay variant="simple" />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}