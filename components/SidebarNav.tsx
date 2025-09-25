import HomeIcon from "@/components/icons/SidebarNav/StoreIcon";
import HorizontalLogo from "@/components/icons/SidebarNav/HorizontalLogo";
import InventoryIcon from "@/components/icons/SidebarNav/InventoryIcon";
import SalesIcon from "@/components/icons/SidebarNav/SalesIcon";
import LogsIcon from "@/components/icons/SidebarNav/LogsIcon";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { useState } from "react";
import SettingsIcon from "./icons/SidebarNav/SettingsIcon";
import LogoutIcon from "./icons/SidebarNav/LogoutIcon";
import LogoIcon from "@/app/(main)/[branchId]/store/icons/LogoIcon";
import DiscountsIcon from "./icons/SidebarNav/DiscountsIcon";
import BranchesIcon from "./icons/SidebarNav/BranchesIcon";
import BranchSelector from "./BranchSelector";

export default function SidebarNav() {
    const { logout, isUserAdmin } = useAuth();
    const { currentBranch } = useBranch();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const router = useRouter();

    const pathname = usePathname();
    
    const navItems = [
        {
            href: "store",
            label: "Store",
            icon: HomeIcon,
        },
        {
            href: "inventory", 
            label: "Inventory",
            icon: InventoryIcon,
        },
        {
            href: "sales",
            label: "Sales",
            icon: SalesIcon,
        },
        {
            href: "discounts",
            label: "Discounts",
            icon: DiscountsIcon,
        },
        {
            href: "logs",
            label: "Logs",  
            icon: LogsIcon,
        },
        {
            href: "settings",
            label: "Settings",
            icon: SettingsIcon,
        },
    ];

    // Admin-only navigation items
    const adminNavItems = [
        {
            href: "/branches",
            label: "Branches",
            icon: BranchesIcon,
        },
    ];
    

    
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

    // Helper function to get the current branch-aware URL
    const getBranchAwareHref = (page: string) => {
        if (!currentBranch) return `/${page}`;
        return `/${currentBranch.id}/${page}`;
    };

    // Helper function to check if current route is active
    const isRouteActive = (page: string) => {
        if (!currentBranch) return false;
        return pathname === `/${currentBranch.id}/${page}`;
    };

    // Helper function to check if admin route is active
    const isAdminRouteActive = (page: string) => {
        return pathname === page;
    };
    
    return (
        // Sidebar container
        <div className="h-full w-[80px] lg:w-[271px] bg-[var(--primary)] border-r border-gray-200 duration-400">
            <div className="flex flex-col h-full">
         
                {/* Logo */}
                <div className="flex items-center border-b border-gray-200 bg-[var(--accent)] h-[90px] px-6">
                    <HorizontalLogo className="invisible w-0 lg:visible lg:w-auto opacity-0 lg:opacity-100 transition-all"/>
                    <LogoIcon className="visible w-auto lg:invisible lg:w-0 opacity-100 lg:opacity-0 transition-all" />
                </div>

                {/* Branch Selector - Only visible on large screens */}
                <div className="hidden lg:block border-b border-gray-200 p-3">
                    <BranchSelector 
                        showLabel={false}
                        redirectOnChange={true}
                        className="w-full"
                    />
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-[8px]">
                    <ul className="space-y-[8px]">
                    {navItems.map((item) => {
                        const IconComponent = item.icon;
                        const isActive = isRouteActive(item.href);
                        const href = getBranchAwareHref(item.href);
                        
                        return (
                            <li key={item.href}>
                                <Link 
                                    href={href}
                                    className={`flex h-10 items-center text-[14px] font-semibold ${
                                        isActive 
                                            ? 'bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary)] text-shadow-lg'
                                            : 'bg-[var(--primary)] hover:bg-[var(--accent)]/50 text-[var(--secondary)]'
                                    }`}
                                >
                                    <div className="w-full flex items-center justify-center lg:justify-start">
                                        <IconComponent className={`w-8 h-8 mx-3 gap-3 ${isActive ? "text-[var(--primary)] drop-shadow-lg" : "text-[var(--secondary)]"} transition-all duration-300`} />
                                        <span className="invisible w-0 lg:visible lg:w-auto opacity-0 lg:opacity-100 transition-all duration-300">{item.label}</span>
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                    
                    {/* Admin-only navigation items */}
                    {isUserAdmin() && adminNavItems.map((item) => {
                        const IconComponent = item.icon;
                        const isActive = isAdminRouteActive(item.href);
                        
                        return (
                            <li key={item.href}>
                                <Link 
                                    href={item.href}
                                    className={`flex h-10 items-center text-[14px] font-semibold ${
                                        isActive 
                                            ? 'bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary)] text-shadow-lg'
                                            : 'bg-[var(--primary)] hover:bg-[var(--accent)]/50 text-[var(--secondary)]'
                                    }`}
                                >
                                    <div className="w-full flex items-center justify-center lg:justify-start">
                                        <IconComponent className={`w-8 h-8 mx-3 gap-3 ${isActive ? "text-[var(--primary)] drop-shadow-lg" : "text-[var(--secondary)]"} transition-all duration-300`} />
                                        <span className="invisible w-0 lg:visible lg:w-auto opacity-0 lg:opacity-100 transition-all duration-300">{item.label}</span>
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                        <li>
                            <button
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className="flex w-full h-10 items-center text-[14px] text-[var(--error)] hover:text-[var(--primary)] font-semibold bg-[var(--primary)] hover:bg-[var(--error)] cursor-pointer transition-colors duration-400"
                            >
                                <div className="w-full flex items-center justify-center lg:justify-start transition-all duration-300">
                                    <span className="size-8 mx-3">
                                        <LogoutIcon className="gap-3 text-[var(--error)]" />
                                    </span>
                                    <span className="invisible w-0 lg:visible lg:w-auto opacity-0 lg:opacity-100 transition-all duration-300 ">
                                        {"Logout"}
                                    </span>
                                </div>
                            </button>
                        </li>
                    </ul>
                </nav>
                
            </div>
        </div>
    )
}