import HomeIcon from "@/components/icons/SidebarNav/StoreIcon";
import HorizontalLogo from "@/components/icons/SidebarNav/HorizontalLogo";
import InventoryIcon from "@/components/icons/SidebarNav/InventoryIcon";
import SalesIcon from "@/components/icons/SidebarNav/SalesIcon";
import LogsIcon from "@/components/icons/SidebarNav/LogsIcon";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import SettingsIcon from "./icons/SidebarNav/SettingsIcon";
import LogoutIcon from "./icons/SidebarNav/LogoutIcon";
import LogoIcon from "@/app/(main)/store/icons/LogoIcon";

export default function SidebarNav() {
    const { logout } = useAuth();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const router = useRouter();

    const pathname = usePathname();
    
    const navItems = [
        {
            href: "/store",
            label: "Store",
            icon: HomeIcon,
        },
        {
            href: "/inventory", 
            label: "Inventory",
            icon: InventoryIcon,
        },
        {
            href: "/sales",
            label: "Sales",
            icon: SalesIcon,
        },
        {
            href: "/logs",
            label: "Logs",
            icon: LogsIcon,
        },
        {
            href: "/settings",
            label: "Settings",
            icon: SettingsIcon,
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
    
    return (
        // Sidebar container
        <div className="h-full w-[80px] xl:w-[271px] bg-[var(--primary)] border-r border-gray-200 duration-400">
            <div className="flex flex-col h-full">
         
                {/* Logo */}
                <div className="flex items-center border-b border-gray-200 bg-[var(--accent)] h-[90px] px-6">
                    <HorizontalLogo className="invisible w-0 xl:visible xl:w-auto opacity-0 xl:opacity-100 transition-all duration-400"/>
                    <LogoIcon className="visible w-auto xl:invisible xl:w-0 opacity-100 xl:opacity-0 transition-all duration-400" />
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-[8px]">
                    <ul className="space-y-[8px]">
                    {navItems.map((item) => {
                        const IconComponent = item.icon;
                        const isActive = pathname === item.href;
                        
                        return (
                            <li key={item.href}>
                                <Link 
                                    href={item.href}
                                    className={`flex h-10 items-center text-[14px] text-[var(--secondary)] font-regular  ${
                                        isActive 
                                            ? 'bg-[#FDEA83] from-white to-[var(--light-accent)] hover:bg-[#FDEA83] transition-all duration-100 '
                                            : 'bg-[var(--primary)] hover:bg-[var(--light-accent)]'
                                    } transition-colors duration-400`}
                                >
                                    <div className="w-full flex items-center justify-center xl:justify-start transition-all duration-1000">
                                        <IconComponent className="w-8 h-8 mx-3 gap-3" />
                                        <span className="invisible w-0 xl:visible xl:w-auto opacity-0 xl:opacity-100 transition-all duration-400">{item.label}</span>
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                    </ul>
                </nav>
                <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="h-[55px] m-2 items-center justify-center text-[14px] font-bold text-[var(--primary)] bg-[var(--accent)] hover:bg-[var(--light-accent)]/80 rounded disabled:opacity-50 disabled:cursor-not-allowed flex gap-0 xl:gap-2 duration-500 transition-colors"
                >
                    <LogoutIcon className="" />
                    <span className="invisible w-0 xl:visible xl:w-auto opacity-0 xl:opacity-100 transition-all duration-400">
                        {isLoggingOut ? (
                            'Logging out...'
                        ) : (
                            'Logout'
                        )}
                    </span>
                </button>
            </div>
        </div>
    )
}