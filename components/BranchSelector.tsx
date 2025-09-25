"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { useRouter } from 'next/navigation';

interface BranchSelectorProps {
  className?: string;
  showLabel?: boolean;
  redirectOnChange?: boolean; // If true, navigate to new branch URL
}

export default function BranchSelector({ 
  className = '', 
  showLabel = true,
  redirectOnChange = false 
}: BranchSelectorProps) {
  const { user, isUserAdmin } = useAuth();
  const { currentBranch, availableBranches, loading, setCurrentBranchId } = useBranch();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Don't render if no user or no branches
  if (!user || loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && (
          <span className="text-sm text-[var(--secondary)]/70">Branch:</span>
        )}
        <div className="animate-pulse bg-gray-200 h-8 w-32 rounded"></div>
      </div>
    );
  }

  if (availableBranches.length === 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && (
          <span className="text-sm text-[var(--secondary)]/70">Branch:</span>
        )}
        <span className="text-sm text-[var(--error)]">No branches available</span>
      </div>
    );
  }

  // If user is not admin and has only one branch, show it without dropdown
  if (!isUserAdmin() && availableBranches.length === 1) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && (
          <span className="text-sm text-[var(--secondary)]/70">Branch:</span>
        )}
        <div className="bg-[var(--primary)] border border-gray-200 rounded-lg px-3 py-2">
          <span className="text-sm font-medium text-[var(--secondary)]">
            {currentBranch?.name || 'Unknown Branch'}
          </span>
        </div>
      </div>
    );
  }

  const handleBranchChange = (branchId: string) => {
    setCurrentBranchId(branchId);
    setIsOpen(false);

    if (redirectOnChange) {
      // Navigate to the new branch URL
      const currentPath = window.location.pathname;
      const pathParts = currentPath.split('/');
      
      // Replace the branchId part in the URL
      if (pathParts.length >= 2) {
        pathParts[1] = branchId; // Assuming format is /[branchId]/page
        const newPath = pathParts.join('/');
        router.push(newPath);
      }
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className="text-sm text-[var(--secondary)]/70">Branch:</span>
      )}
      
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-[var(--primary)] border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 hover:border-[var(--accent)] transition-colors min-w-[150px] justify-between"
        >
          <span className="text-sm font-medium text-[var(--secondary)] truncate">
            {currentBranch?.name || 'Select Branch'}
          </span>
          <svg 
            className={`w-4 h-4 text-[var(--secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown */}
            <div className="absolute top-full left-0 mt-1 w-full bg-[var(--primary)] border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
              {availableBranches.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => handleBranchChange(branch.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--accent)]/10 transition-colors ${
                    currentBranch?.id === branch.id 
                      ? 'bg-[var(--accent)]/20 text-[var(--secondary)] font-medium' 
                      : 'text-[var(--secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{branch.name}</div>
                      <div className="text-xs text-[var(--secondary)]/70">{branch.location}</div>
                    </div>
                    {!branch.isActive && (
                      <span className="text-xs bg-[var(--error)]/20 text-[var(--error)] px-2 py-1 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
