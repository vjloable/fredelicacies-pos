import HomeIcon from "@/components/icons/HomeIcon";
import HorizontalLogo from "@/components/icons/HorizontalLogo";
import InventoryIcon from "@/components/icons/InventoryIcon";
import OrderHistoryIcon from "@/components/icons/OrderHistory";
import LogsIcon from "@/components/icons/LogsIcon";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarNavProps {
    isOpen: boolean;
    toggleDrawer: () => void;
}

export default function SidebarNav({ isOpen, toggleDrawer }: SidebarNavProps) {
    const pathname = usePathname();
    
    const navItems = [
        {
            href: "/home",
            label: "Home",
            icon: HomeIcon,
        },
        {
            href: "/inventory", 
            label: "Inventory",
            icon: InventoryIcon,
        },
        {
            href: "/order-history",
            label: "Order History", 
            icon: OrderHistoryIcon,
        },
        {
            href: "/logs",
            label: "Logs",
            icon: LogsIcon,
        },
    ];
    
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
                                    className={`flex h-12 items-center gap-3 text-[var(--secondary)] font-bold ${
                                        isActive 
                                            ? 'bg-gradient-to-r from-white to-[var(--light-accent)] border-r-6 border-[var(--accent)] hover:bg-gradient-to-r hover:from-white hover:to-[white] hover:border-r-3 transition-all duration-100 '
                                            : 'bg-[var(--primary)] hover:bg-[var(--light-accent)]/20 hover:border-r-6 border-[var(--accent)]'
                                    } transition-colors duration-200`}
                                >
                                    <IconComponent className="w-12 h-12 mx-3 gap-3" />
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}
                    </ul>
                </nav>

            </div>
        </div>
    )
}