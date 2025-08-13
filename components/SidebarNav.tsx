import HomeIcon from "@/components/icons/SidebarNav/HomeIcon";
import HorizontalLogo from "@/components/icons/SidebarNav/HorizontalLogo";
import InventoryIcon from "@/components/icons/SidebarNav/InventoryIcon";
import SalesIcon from "@/components/icons/SidebarNav/SalesIcon";
import LogsIcon from "@/components/icons/SidebarNav/LogsIcon";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import SettingsIcon from "./icons/SidebarNav/SettingsIcon";

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
        <div className="h-full w-[271px] bg-[var(--primary)] border-r border-gray-200">
            <div className="flex flex-col h-full">
         
                {/* Logo */}
                <div className="flex items-center border-b border-gray-200 h-[90px] px-6">
                    <HorizontalLogo/>
                </div>

                {/* Navigation */}
                <nav className="flex-1">
                    <ul className="space-y-2">
                    {navItems.map((item) => {
                        const IconComponent = item.icon;
                        const isActive = pathname === item.href;
                        
                        return (
                            <li key={item.href}>
                                <Link 
                                    href={item.href}
                                    className={`flex h-10 items-center gap-3 text-[14px] text-[var(--secondary)] font-bold ${
                                        isActive 
                                            ? 'bg-gradient-to-r from-white to-[var(--light-accent)] border-r-6 border-[var(--accent)] hover:bg-gradient-to-r hover:from-white hover:to-[white] hover:border-r-3 transition-all duration-100 '
                                            : 'bg-[var(--primary)] hover:bg-[var(--light-accent)]/20 hover:border-r-6 border-[var(--accent)]'
                                    } transition-colors duration-400`}
                                >
                                    <IconComponent className="w-12 h-12 mx-3 gap-3" />
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}
                    </ul>
                </nav>
                <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="h-[55px] m-2 items-center justify-center text-[14px] text-[var(--primary)] font-semibold bg-[var(--accent)] hover:bg-[var(--light-accent)]/80 rounded disabled:opacity-50 disabled:cursor-not-allowed flex gap-2 duration-500 transition-colors"
                >
                    {isLoggingOut ? (
                        'LOGGING OUT...'
                    ) : (
                        'LOGOUT'
                    )}
                </button>
            </div>
        </div>
    )
}