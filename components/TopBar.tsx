'use client';

import MenuBurger from "@/components/icons/MenuBurger";
import UserIcon from "@/components/icons/UserIcon";
import CalendarIcon from "@/components/icons/CalendarIcon";
import ClockIcon from "@/components/icons/ClockIcon";
import { useDrawer } from "@/components/Drawer";

interface TopBarProps {
  title?: string;
}

export default function TopBar({ title }: TopBarProps) {
  const { toggle: toggleDrawer } = useDrawer();

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
            Wed, 29 May 2024
          </div>
          -
          <div className="h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] font-medium gap-3 items-center">
            <span className="w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm">
              <ClockIcon />
            </span>
            07:59 AM
          </div>
        </div>
      </div>

      {/* Page Title */}
      {title && (
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[var(--secondary)] text-2xl font-bold">
            {title}
          </h1>
        </div>
      )}
    </div>
  );
}
