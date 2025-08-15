"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import DropdownField from "@/components/DropdownField";
import TopBar from "@/components/TopBar";
import MinusIcon from "./icons/MinusIcon";
import OrderCartIcon from "./icons/OrderCartIcon";
import { InventoryItem } from "@/services/inventoryService";
import { subscribeToInventoryItems } from "@/stores/dataStore";
import SearchIcon from "./icons/SearchIcon";
import { loadSettingsFromLocal } from "@/services/settingsService";
import { createOrder } from "@/services/orderService";
import { useAuth } from "@/contexts/AuthContext";
import EmptyOrderIllustration from "./illustrations/EmptyOrder";
import EmptyStoreIllustration from "./illustrations/EmptyStore";

// Image component with proper error handling
const SafeImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
    const [hasError, setHasError] = useState(false);
    
    if (hasError || !src) {
        return null;
    }
    
    return (
        <Image
            src={src}
            alt={alt}
            fill
            className={`object-cover ${className || ''}`}
            sizes="102px"
            unoptimized
            onError={() => {
                console.error('Image failed to load:', src);
                setHasError(true);
            }}
        />
    );
};

export default function StoreScreen() {
    const { user } = useAuth(); // Get current authenticated user
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [hideOutOfStock, setHideOutOfStock] = useState(false);
    const [orderType, setOrderType] = useState<'DINE-IN' | 'TAKE OUT' | 'DELIVERY'>('TAKE OUT');
    const [discountCode, setDiscountCode] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
    const [cart, setCart] = useState<Array<{
        id: string;
        name: string;
        price: number;
        cost?: number;
        quantity: number;
        originalStock: number;
        imgUrl?: string | null;
        categoryId: number | string;
    }>>([]);

    // Ensure we're on the client before running Firebase code
    useEffect(() => {
        setIsClient(true);
    }, []);

    // Set up real-time subscription to inventory items using singleton dataStore
    useEffect(() => {
        if (!isClient) return;
        
        setLoading(true);
        console.log('🚀 Setting up inventory subscription...');
        
        const unsubscribe = subscribeToInventoryItems(
            (items) => {
                console.log('📦 Inventory items received:', items.length, 'items');
                setInventoryItems(items);
                setLoading(false);
            }
        );

        // Add a timeout fallback to prevent infinite loading
        const timeoutId = setTimeout(() => {
            console.warn('⏰ Inventory subscription timeout - stopping loading');
            setLoading(false);
        }, 10000); // 10 second timeout

        return () => {
            clearTimeout(timeoutId);
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [isClient]);

    // Load settings
    useEffect(() => {
        const settings = loadSettingsFromLocal();
        setHideOutOfStock(settings.hideOutOfStock);
    }, []);

    // Helper function to get category name (you might want to fetch categories from Firebase too)
    const getCategoryName = (categoryId: number | string) => {
        const categoryMap: { [key: number]: string } = {
            1: "Beverages",
            2: "Main Course",
            3: "Desserts",
            4: "Appetizers",
            5: "Side Dishes"
        };
        const numericId = typeof categoryId === 'string' ? parseInt(categoryId) : categoryId;
        return categoryMap[numericId] || "Unknown";
    };

    // Get unique categories from inventory items
    const categories = [
        "All",
        ...Array.from(new Set(inventoryItems.map(item => getCategoryName(item.categoryId))))
            .filter(name => name !== "Unknown")
    ];

    // Filter items based on selected category and search query
    const filteredItems = inventoryItems.filter(item => {
        const matchesCategory = selectedCategory === "All" || getCategoryName(item.categoryId) === selectedCategory;
        const matchesSearch = searchQuery === "" || 
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            getCategoryName(item.categoryId).toLowerCase().includes(searchQuery.toLowerCase());
        
        // Filter out out-of-stock items if hideOutOfStock is enabled
        const hasStock = hideOutOfStock ? item.stock > 0 : true;
        
        return matchesCategory && matchesSearch && hasStock;
    });

    // Determine if we're showing search results
    const isSearching = searchQuery.trim() !== "";

    // Helper function to highlight search terms
    const highlightSearchTerm = (text: string, searchTerm: string) => {
        if (!searchTerm || !text) return text;
        
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);
        
        return parts.map((part, index) => 
            regex.test(part) ? (
                <span key={index} className="bg-[var(--light-accent)] font-semibold">
                    {part}
                </span>
            ) : part
        );
    };

    // Function to calculate available stock (original stock minus cart quantity)
    const getAvailableStock = (itemId: string) => {
        const item = inventoryItems.find(inv => inv.id === itemId);
        const cartItem = cart.find(cartItem => cartItem.id === itemId);
        
        if (!item) return 0;
        
        const originalStock = item.stock;
        const reservedQuantity = cartItem ? cartItem.quantity : 0;
        
        return Math.max(0, originalStock - reservedQuantity);
    };

    // Function to add item to cart
    const addToCart = (item: InventoryItem) => {
        const availableStock = getAvailableStock(item.id || '0');
        
        if (availableStock <= 0) return; // Don't add if no available stock
        
        const itemId = item.id || '0';
        const existingItem = cart.find(cartItem => cartItem.id === itemId);

        console.log(`Adding item ${item} to cart`);
        
        if (existingItem) {
            // Update quantity if item already in cart and stock allows
            setCart(cart.map(cartItem => 
                cartItem.id === itemId 
                    ? { ...cartItem, quantity: cartItem.quantity + 1 }
                    : cartItem
            ));
        } else {
            // Add new item to cart
            console.log(`Adding item ${item} to cart`);
            setCart([...cart, {
                id: itemId,
                name: item.name,
                price: item.price,
                cost: item.cost,
                quantity: 1,
                originalStock: item.stock,
                imgUrl: item.imgUrl,
                categoryId: item.categoryId
            }]);
        }
    };

    const subtotal = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );
    const total = subtotal - discountAmount;

    const updateQuantity = (id: string, delta: number) => {
        console.log(`Updating quantity for item ${id} by ${delta}`);
        setCart(
            cart
                .map((item) => {
                    if (item.id === id) {
                        const newQuantity = Math.max(0, item.quantity + delta);
                        // Check if we can increase quantity based on available stock
                        if (delta > 0) {
                            const availableStock = getAvailableStock(id);
                            if (availableStock <= 0) {
                                return item; // Don't increase if no available stock
                            }
                        }
                        return { ...item, quantity: newQuantity };
                    }
                    return item;
                })
                .filter((item) => item.quantity > 0)
        );
    };

    // Function to clear the cart
    const clearCart = () => {
        setCart([]);
    };

    // Function to handle placing order
    const handlePlaceOrder = () => {
        if (cart.length === 0 || !user) return;
        setShowOrderConfirmation(true);
    };

    // Function to confirm and actually place the order
    const confirmPlaceOrder = async () => {
        if (cart.length === 0 || isPlacingOrder || !user) return;
        
        setIsPlacingOrder(true);
        try {
            // Create order using the new service signature
            const orderId = await createOrder(
                cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    cost: item.cost || 0,
                    quantity: item.quantity,
                    imgUrl: item.imgUrl || '',
                    categoryId: item.categoryId || '',
                    originalStock: item.originalStock
                })),
                total,
                subtotal,
                user.displayName || user.email || 'Unknown Worker',
                user.uid,
                orderType,
                discountAmount,
                discountCode
            );
            
            console.log('Order created successfully:', orderId);
            
            // Clear the cart after successful order
            clearCart();
            setDiscountCode('');
            setDiscountAmount(0);
            setShowOrderConfirmation(false);
            
        } catch (error) {
            console.error('Error placing order:', error);
            alert('Failed to place order. Please try again.');
        } finally {
            setIsPlacingOrder(false);
        }
    };

    return (
        <div className="flex h-full overflow-hidden">
            {/* Menu Area - This should expand to fill available space */}
            <div className="flex flex-col flex-1 h-full overflow-hidden">
                {/* Header Section - Fixed */}
                <TopBar title="Store" />

                {/* Search Section - Fixed */}
                <div className="px-6 py-4">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search items, categories, or descriptions..."
                            className={`w-full text-[12px] px-4 py-3 pr-12 shadow-sm bg-white rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent ${searchQuery ? 'animate-pulse transition-all' : ''}`}
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            {searchQuery ? (
                                <div className="size-[30px] border-[var(--accent)] border-y-2 rounded-full flex items-center justify-center animate-spin">

                                </div>
                            ) : (
                                <div className="size-[30px] bg-[var(--light-accent)] rounded-full flex items-center justify-center">
                                    <SearchIcon className="mr-[2px] mb-[2px]"/>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Results Header - Fixed */}
                <div className="flex items-center justify-between px-6 py-2">
                    <div className="flex flex-col">
                        <h2 className="text-[var(--secondary)] font-bold">
                            {isSearching ? "Search Results" : ""}
                        </h2>
                        {isSearching && (
                            <p className="text-xs text-[var(--secondary)] opacity-60">
                                Searching for `{searchQuery}`
                            </p>
                        )}
                    </div>
                </div>

                {/* Category Selector - Fixed */}
                <div className="px-6 py-2">
                    <div className="flex gap-2 overflow-x-auto">
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => {
                                    setSelectedCategory(category);
                                    // Clear search when switching categories for better UX
                                    if (searchQuery) setSearchQuery("");
                                }}
                                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                                    selectedCategory === category
                                        ? 'bg-[var(--accent)] text-white'
                                        : 'bg-gray-100 text-[var(--secondary)] hover:bg-gray-200'
                                }`}
                            >
                                {category}
                                {category !== "All" && (
                                    <span className="ml-2 text-xs opacity-70">
                                        ({inventoryItems.filter(item => getCategoryName(item.categoryId) === category).length})
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* Menu Items - Scrollable */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
                            <span className="ml-3 text-[var(--secondary)]">Loading menu...</span>
                        </div>
                    ) : inventoryItems.length === 0 ? (
                        // Empty Inventory Collection State
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-[360px] mb-4 pr-10 mx-auto opacity-50 flex items-center justify-center">
                                <EmptyStoreIllustration />
                            </div>
                            <h3 className="text-xl font-semibold text-[var(--secondary)] mb-3">
                                The Store Front is Empty
                            </h3>
                            <p className="text-[var(--secondary)] opacity-70 text-center max-w-md mb-6 leading-relaxed">
                                The inventory is empty. You need to add items to your inventory before they can appear in the store.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => window.location.href = '/inventory'}
                                    className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)]/90 transition-all font-medium"
                                >
                                    Go to Inventory
                                </button>
                            </div>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        // Filtered Results Empty State
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                                {isSearching ? (
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                ) : (
                                    <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <h3 className="text-lg font-medium text-[var(--secondary)] mb-2">
                                {isSearching ? "No Results Found" : "No Items Available"}
                            </h3>
                            <p className="text-[var(--secondary)] opacity-70 text-center max-w-md">
                                {isSearching 
                                    ? `No items match "${searchQuery}". Try searching with different keywords or check the spelling.`
                                    : selectedCategory === "All" 
                                        ? "No items available with current filters."
                                        : `No items found in the "${selectedCategory}" category.`
                                }
                            </p>
                            {isSearching && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="mt-4 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)]/90 transition-all"
                                >
                                    Clear Search
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4 py-2">
                            {filteredItems.map((item, index) => {
                                const availableStock = getAvailableStock(item.id || '0');
                                const isOutOfStock = availableStock <= 0;
                                const cartItem = cart.find(cartItem => cartItem.id === item.id);
                                const inCartQuantity = cartItem ? cartItem.quantity : 0;
                                
                                console.log(item.id, 'Available stock:', availableStock, 'In cart:', inCartQuantity, '1');
                                return (
                                    <div
                                        key={item.id || index}
                                        onClick={() => !isOutOfStock && addToCart(item)}
                                        className={`
                                            max-w-[515px] bg-[var(--primary)] rounded-lg p-4 h-65 lg:h-60 xl:h-75 cursor-pointer shadow-md
                                            hover:shadow-lg hover:border-[var(--accent)] hover:scale-105 transition-all
                                            ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'border-gray-200 hover:border-[var(--accent)]'}
                                        `}
                                    >
                                        {/* Item Image Placeholder */}
                                        <div className="w-full h-40 lg:h-35 xl:h-50 bg-gray-100 rounded-lg mb-3 relative overflow-hidden">
                                            {item.imgUrl ? (
                                                <SafeImage 
                                                    src={item.imgUrl} 
                                                    alt={item.name}
                                                    className=""
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                            
                                            {/* Stock indicator badges */}
                                            {isOutOfStock && (
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                    <span className="text-white font-semibold select-none">OUT OF STOCK</span>
                                                </div>
                                            )}
                                            {!isOutOfStock && availableStock <= 5 && (
                                                <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded select-none">
                                                    Low Stock
                                                </div>
                                            )}
                                            {inCartQuantity > 0 && (
                                                <div className="absolute top-2 left-2 bg-[var(--accent)] text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                                                    </svg>
                                                    {inCartQuantity}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Item Details */}
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-medium text-[var(--secondary)] truncate">
                                                {isSearching ? highlightSearchTerm(item.name, searchQuery) : item.name}
                                            </h3>

                                            <span className="font-semibold text-[var(--secondary)]">
                                                ₱{item.price.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 rounded">
                                                {isSearching ? highlightSearchTerm(getCategoryName(item.categoryId), searchQuery) : getCategoryName(item.categoryId)}
                                            </span>

                                            {/* Enhanced stock info */}
                                            <div className="text-right">
                                                {isOutOfStock ? (
                                                    <div className="text-xs text-red-500 font-medium">
                                                        All in cart
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-[var(--secondary)] opacity-70">
                                                        <div className="font-medium">
                                                            {availableStock} available
                                                        </div>
                                                        {inCartQuantity > 0 && (
                                                            <div className="text-[var(--accent)] font-medium">
                                                                {inCartQuantity} in cart
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Side Panel - Order Summary */}
            <div className="flex flex-col h-full shadow-lg bg-[var(--primary)] overflow-hidden w-[416px] flex-shrink-0">
                {/* Header Section - Fixed at top (154px total) */}
                <div className="flex-shrink-0">
                    <div className="w-full h-[90px] bg-[var(--primary)] border-l border-gray-200 shadow-lg">
                        {/* Order Header */}
                        <div className="flex items-center gap-3 p-3">
                            <div className="bg-[var(--light-accent)] w-16 h-16 rounded-full items-center justify-center flex relative">
                                <OrderCartIcon/>
                                {cart.length > 0 && (
                                    <div className="absolute -top-1 -right-1 bg-[var(--accent)] text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                                        {cart.reduce((sum, item) => sum + item.quantity, 0)}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-1 flex-col items-center">
                                <span className="text-[var(--secondary)] font-medium text-[16px] self-start">
                                    {cart.length === 0 ? 'New Order' : 'Current Order'}
                                </span>
                                <span className="text-[var(--secondary)] font-light text-[12px] self-start">
                                    {cart.length === 0 ? 'No items added' : `${cart.length} item${cart.length !== 1 ? 's' : ''}`}
                                </span>
                            </div>
                            {cart.length > 0 && (
                                <button 
                                    onClick={clearCart}
                                    className="text-red-500 hover:text-red-700 text-xs font-medium hover:bg-red-50 px-2 py-1 rounded transition-all"
                                    title="Clear all items"
                                >
                                    Clear
                                </button>
                            )}
                            <div className="hidden bg-[var(--light-accent)] w-16 h-16 rounded-full"></div>
                        </div>
                    </div>

                    <div className="h-16 p-3 border-b border-[var(--secondary)]/20">
                        <div className="flex h-[42px] items-center justify-between bg-[var(--background)] rounded-[24px] gap-3">
                            <DropdownField
                                options={["DINE-IN", "TAKE OUT", "DELIVERY"]}
                                defaultValue="TAKE OUT"
                                dropdownPosition="bottom-right"
                                dropdownOffset={{ top: 2, right: 0 }}
                                onChange={(value) => setOrderType(value as 'DINE-IN' | 'TAKE OUT' | 'DELIVERY')}
                            />
                        </div>
                    </div>
                </div>
                
                {/* Cart Items - Scrollable middle section */}
                <div className="flex-1 overflow-y-auto px-3 pb-6">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-12">
                            <div className="w-[150px] h-[120px] flex items-center justify-center mb-4 opacity-50">
                                <EmptyOrderIllustration />
                            </div>
                            <h3 className="text-lg font-medium text-[var(--secondary)] mb-2 select-none">
                                Order List is Empty
                            </h3>
                            <p className="text-[var(--secondary)] w-[300px] opacity-70 text-center max-w-sm text-sm leading-relaxed select-none">
                                Add items from the menu to start building your order. Click on any menu item to add it to your cart.
                            </p>
                        </div>
                    ) : (
                        /* Cart Items */
                        <div className="space-y-0">
                            {cart.map((item) => {
                                // Debug logging
                                console.log('Cart item:', item.name, 'imgUrl:', item.imgUrl);
                                return (
                                <div
                                    key={`cart-item-${item.id}`}
                                    className="flex flex-row items-center gap-3 w-full h-[124px] bg-white border-b border-dashed border-[#4C2E24]"
                                >
                                    {/* Item Image Placeholder - 102x100px */}
                                    <div className="flex-none w-[102px] h-[100px] bg-[#F7F7F7] rounded-md relative overflow-hidden">
                                        {item.imgUrl ? (
                                            <SafeImage 
                                                src={item.imgUrl} 
                                                alt={item.name}
                                            />
                                        ) : null}
                                        {!item.imgUrl && (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Item Details - 278px width */}
                                    <div className="flex flex-col items-start gap-3 w-[278px] h-[100px] flex-grow">
                                        {/* Item Info Section */}
                                        <div className="flex flex-col items-start gap-2 w-full h-[53px] flex-grow">
                                            {/* Title and Quantity Row */}
                                            <div className="flex flex-row items-center justify-between gap-2 w-full h-[21px]">
                                                <span className="font-normal text-base leading-[21px] text-[#4C2E24] font-['Poppins'] truncate">
                                                    {item.name}
                                                </span>
                                            </div>
                                            {/* Price and Subtotal Row */}
                                            <div className="flex flex-row items-center justify-between w-full h-[21px]">
                                                <span className="space-x-2 flex items-center">
                                                    <span className="font-normal text-sm leading-[21px] text-[#DA834D] font-['Poppins']">
                                                        ₱{item.price.toFixed(2)} each
                                                    </span>
                                                    <span className="font-bold text-sm leading-[21px] text-[#DA834D] font-['Poppins'] bg-[#FFDEC9] px-2 py-1 rounded-full min-w-[24px] text-center">
                                                        ×{item.quantity}
                                                    </span>
                                                </span>
                                                <span className="space-x-2 flex items-center">
                                                    <span className="font-normal text-sm leading-[21px] text-[#DA834D] font-['Poppins']">
                                                        =
                                                    </span>
                                                    <span className="font-bold text-sm leading-[21px] text-[#DA834D] font-['Poppins']">
                                                        ₱{(item.price * item.quantity).toFixed(2)}
                                                    </span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Controls Section */}
                                        <div className="flex flex-row justify-end items-end gap-3 w-full h-[35px]">

                                            {/* Quantity Controls */}
                                            <div className="flex flex-row justify-between items-center px-[6px] w-[120px] h-[35px] bg-[#FFDEC9] rounded-[24px]">
                                                <button
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                    className="flex flex-col justify-center items-center p-[6px] gap-5 w-[23px] h-[23px] bg-white rounded-[24px] hover:scale-110 hover:bg-[var(--accent)] transition-all"
                                                >
                                                    <MinusIcon/>
                                                </button>

                                                <span className="font-bold text-base leading-[21px] text-[#4C2E24] font-['Poppins']">
                                                    {item.quantity}
                                                </span>

                                                <button
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                    className="flex flex-col justify-center items-center p-[6px] gap-5 w-[23px] h-[23px] bg-white rounded-[24px] hover:scale-110 hover:bg-[var(--accent)] transition-all"
                                                >
                                                    <svg
                                                        width="13.41"
                                                        height="13.41"
                                                        viewBox="0 0 14 14"
                                                        fill="none"
                                                    >
                                                        <path
                                                            d="M7 1V13M1 7H13"
                                                            stroke="#4C2E24"
                                                            strokeWidth="3"
                                                        />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                {/* Order Summary */}
                <div className="flex-shrink mb-3 border-t-2 rounded-[12px] border-[var(--accent)]">
                    <div className="flex justify-between h-[39px] text-[var(--secondary)] text-[14px] font-medium px-3 py-[6px] items-end">
                        <span>Subtotal</span>
                        <span>₱{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between h-[33px] text-[var(--secondary)] text-[14px] font-medium px-3 py-[6px]">
                        <span>Discount</span>
                        <span>-₱{discountAmount.toFixed(2)}</span>
                    </div>

                    <div className="gap-2 p-3">
                        <div className="flex flex-row border border-[var(--accent)] rounded-[6px] bg-[var(--light-accent)]/40">
                          <input 
                            type="text" 
                            value={discountCode}
                            onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                            className="flex-grow py-2 px-4 text-[12px] border-none rounded-l-[6px] focus:outline-none" 
                            placeholder="Enter discount coupon code"
                          />
                          <button 
                            onClick={() => {
                              // Simple discount logic - you can make this more sophisticated
                              if (discountCode === 'SAVE10') {
                                setDiscountAmount(subtotal * 0.1); // 10% discount
                              } else if (discountCode === 'SAVE20') {
                                setDiscountAmount(subtotal * 0.2); // 20% discount
                              } else if (discountCode === 'FLAT50') {
                                setDiscountAmount(50); // ₱50 flat discount
                              } else {
                                setDiscountAmount(0);
                                if (discountCode) {
                                  alert('Invalid discount code');
                                }
                              }
                            }}
                            className="flex-shrink py-2 px-4 bg-[var(--accent)] font-bold text-sm text-white rounded-e-[6px] hover:bg-[var(--accent)]/50 transition-all"
                          >
                            APPLY
                          </button>
                        </div>
                    </div>

                    <div className="border-t-1 border-dashed border-[var(--accent)] h-[124px]">
                        <div className="flex justify-between font-semibold text-lg h-[62px] p-3 items-center">
                            <span>Total</span>
                            <span>₱{total.toFixed(2)}</span>
                        </div>

                        {/* Place Order Button */}
                        <button 
                            onClick={handlePlaceOrder}
                            disabled={cart.length === 0 || isPlacingOrder || !user}
                            className={`w-full py-4 font-semibold text-lg transition-all h-16 ${
                                cart.length === 0 || isPlacingOrder || !user
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                    : 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 hover:shadow-lg hover:scale-[1.02]'
                            }`}
                        >
                            {!user ? 'PLEASE LOGIN TO ORDER' : isPlacingOrder ? 'PLACING ORDER...' : cart.length === 0 ? 'ADD ITEMS TO ORDER' : 'PLACE ORDER'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Order Confirmation Modal */}
            {showOrderConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold text-gray-900">
                                    Confirm Order
                                </h2>
                                <button
                                    onClick={() => setShowOrderConfirmation(false)}
                                    className="text-gray-400 hover:text-gray-600 text-2xl"
                                >
                                    ×
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                                Please review your order before confirming
                            </p>
                        </div>

                        {/* Order Details */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Order Type */}
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-700">Order Type:</span>
                                    <span className="text-sm font-semibold text-[var(--accent)]">{orderType}</span>
                                </div>
                            </div>

                            {/* Items List */}
                            <div className="mb-4">
                                <h3 className="text-lg font-medium text-gray-900 mb-3">Items ({cart.length})</h3>
                                <div className="space-y-3">
                                    {cart.map((item) => (
                                        <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            {/* Item Image */}
                                            <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden relative">
                                                {item.imgUrl ? (
                                                    <SafeImage
                                                        src={item.imgUrl}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Item Details */}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
                                                <p className="text-sm text-gray-600">₱{item.price.toFixed(2)} each</p>
                                            </div>

                                            {/* Quantity and Total */}
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-gray-900">
                                                    Qty: {item.quantity}
                                                </div>
                                                <div className="text-sm font-semibold text-[var(--accent)]">
                                                    ₱{(item.price * item.quantity).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Order Summary */}
                            <div className="border-t border-gray-200 pt-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Subtotal:</span>
                                        <span className="font-medium">₱{subtotal.toFixed(2)}</span>
                                    </div>
                                    {discountAmount > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Discount {discountCode && `(${discountCode})`}:</span>
                                            <span className="font-medium text-green-600">-₱{discountAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-semibold border-t border-gray-200 pt-2">
                                        <span>Total:</span>
                                        <span className="text-[var(--accent)]">₱{total.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-gray-200 bg-gray-50">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowOrderConfirmation(false)}
                                    className="flex-1 px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmPlaceOrder}
                                    disabled={isPlacingOrder}
                                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                                        isPlacingOrder
                                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                            : 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 hover:shadow-lg'
                                    }`}
                                >
                                    {isPlacingOrder ? 'Processing...' : 'Confirm Order'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
