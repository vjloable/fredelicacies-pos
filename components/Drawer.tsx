'use client';

import { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import SidebarNav from './SidebarNav';

interface DrawerContextType {
  isOpen: boolean;
  toggle: () => void;
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export const useDrawer = () => {
  const context = useContext(DrawerContext);
  if (context === undefined) {
    throw new Error('useDrawer must be used within a Drawer component');
  }
  return context;
};

interface DrawerProps {
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  children?: React.ReactNode;
}

export default function Drawer({ isOpen: externalIsOpen, onToggle, children }: DrawerProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  // Use external state if provided, otherwise use internal state
  const isDrawerOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  
  const toggleDrawer = useCallback(() => {
    const newState = !isDrawerOpen;
    if (onToggle) {
      onToggle(newState);
    } else {
      setInternalIsOpen(newState);
    }
  }, [isDrawerOpen, onToggle]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isDrawerOpen) {
        toggleDrawer();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isDrawerOpen, toggleDrawer]);

  const contextValue = useMemo(() => ({
    isOpen: isDrawerOpen,
    toggle: toggleDrawer,
  }), [isDrawerOpen, toggleDrawer]);

  return (
    <DrawerContext.Provider value={contextValue}>
      <div className="flex h-full w-full">
        {/* Left Sidebar/Drawer - Takes up space in layout */}
        <div className={`
          ${isDrawerOpen ? 'w-[271px]' : 'w-0'} 
          transition-all duration-300 ease-in-out overflow-hidden
        `}>
          <SidebarNav isOpen={isDrawerOpen} toggleDrawer={toggleDrawer} />
        </div>

        {/* Main Content - Adjusts based on sidebar width */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Content Area */}
          {children}
        </div>
      </div>
    </DrawerContext.Provider>
  );
}
