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

export default function StoreScreen() {
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState<Array<{
        id: string;
        name: string;
        price: number;
        quantity: number;
        originalStock: number;
    }>>([]);

    // Set up real-time subscription to inventory items using singleton dataStore
    useEffect(() => {
        setLoading(true);
        
        const unsubscribe = subscribeToInventoryItems(
            (items) => {
                setInventoryItems(items);
                setLoading(false);
            }
        );

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
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
        
        return matchesCategory && matchesSearch;
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
                <span key={index} className="bg-yellow-200 font-semibold">
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
        
        if (existingItem) {
            // Update quantity if item already in cart and stock allows
            setCart(cart.map(cartItem => 
                cartItem.id === itemId 
                    ? { ...cartItem, quantity: cartItem.quantity + 1 }
                    : cartItem
            ));
        } else {
            // Add new item to cart
            setCart([...cart, {
                id: itemId,
                name: item.name,
                price: item.price,
                quantity: 1,
                originalStock: item.stock
            }]);
        }
    };

    const subtotal = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );
    const total = subtotal;

    const updateQuantity = (id: string, delta: number) => {
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
        if (cart.length === 0) return;
        
        // Here you would typically send the order to your backend
        console.log('Placing order:', cart);
        
        // For now, just clear the cart after placing order
        clearCart();
        
        // You could show a success message here
        alert('Order placed successfully!');
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
                            className={`w-full px-4 py-3 pr-12 shadow-sm bg-white rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent ${searchQuery ? 'animate-pulse transition-all' : ''}`}
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
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
                            <span className="ml-3 text-[var(--secondary)]">Loading menu...</span>
                        </div>
                    ) : filteredItems.length === 0 ? (
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
                                        ? "No items found in inventory. Add items from the inventory page to see them here."
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
                                
                                return (
                                    <div
                                        key={item.id || index}
                                        onClick={() => !isOutOfStock && addToCart(item)}
                                        className={`
                                            bg-[var(--primary)] rounded-lg p-4 h-65 lg:h-60 xl:h-75 cursor-pointer shadow-md
                                            hover:shadow-lg hover:border-[var(--accent)] hover:scale-105 transition-all
                                            ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'border-gray-200 hover:border-[var(--accent)]'}
                                        `}
                                    >
                                        {/* Item Image Placeholder */}
                                        <div className="w-full h-40 lg:h-35 xl:h-50 bg-gray-100 rounded-lg mb-3 relative overflow-hidden">
                                            {item.imgUrl ? (
                                                <Image 
                                                    src={item.imgUrl} 
                                                    alt={item.name}
                                                    fill
                                                    className="object-cover"
                                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
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
                                    {cart.length === 0 ? 'No items added' : `${cart.length} item${cart.length !== 1 ? 's' : ''} • Order #001`}
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
                                onChange={(value) => console.log("Selected:", value)}
                            />
                        </div>
                    </div>
                </div>
                
                {/* Cart Items - Scrollable middle section */}
                <div className="flex-1 overflow-y-auto px-3 pb-6">
                    {cart.length === 0 ? (
                        /* Empty Cart State */
                        <div className="flex flex-col items-center justify-center h-full py-12">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <OrderCartIcon/>
                            </div>
                            <h3 className="text-lg font-medium text-[var(--secondary)] mb-2">
                                Order tab is empty
                            </h3>
                            <p className="text-[var(--secondary)] opacity-70 text-center max-w-sm text-sm leading-relaxed">
                                Add items from the menu to start building your order. Click on any menu item to add it to your cart.
                            </p>
                        </div>
                    ) : (
                        /* Cart Items */
                        <div className="space-y-0">
                            {cart.map((item) => (
                                <div
                                    key={`cart-item-${item.id}`}
                                    className="flex flex-row items-center gap-3 w-full h-[124px] bg-white border-b border-dashed border-[#4C2E24]"
                                >
                                    {/* Item Image Placeholder - 102x100px */}
                                    <div className="flex-none w-[102px] h-[100px] bg-[#F7F7F7] rounded-md flex items-center justify-center">
                                        {/* You can add item image here later */}
                                        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                        </svg>
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
                            ))}
                        </div>
                    )}
                </div>
                {/* Order Summary */}
                <div className="flex-shrink mb-2 border-t-2 rounded-[12px] border-[var(--accent)]">
                    <div className="flex justify-between h-[39px] text-[var(--secondary)] text-[14px] font-medium px-3 py-[6px] items-end">
                        <span>Subtotal</span>
                        <span>₱{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between h-[33px] text-[var(--secondary)] text-[14px] font-medium px-3 py-[6px]">
                        <span>Tax</span>
                        <span>₱0.00</span>
                    </div>
                    <div className="flex justify-between h-[33px] text-[var(--secondary)] text-[14px] font-medium px-3 py-[6px]">
                        <span>Discount</span>
                        <span>₱0.00</span>
                    </div>

                    <div className="gap-2 p-3">
                        <div className="flex flex-row border border-[var(--accent)] rounded-[6px] bg-[var(--light-accent)]/40">
                          <input 
                            type="text" 
                            className="flex-grow py-2 px-4 text-[12px] border-none rounded-l-[6px] focus:outline-none" 
                            placeholder="Enter discount coupon code"
                            style={{ textTransform: 'uppercase' }}
                            onChange={(e) => {
                              e.target.value = e.target.value.toUpperCase();
                            }}
                          />
                          <button className="flex-shrink py-2 px-4 bg-[var(--accent)] font-bold text-sm text-white rounded-e-[6px] hover:bg-[var(--accent)]/50 transition-all">
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
                            disabled={cart.length === 0}
                            className={`w-full py-4 font-semibold text-lg transition-all h-16 ${
                                cart.length === 0 
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                    : 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 hover:shadow-lg hover:scale-[1.02]'
                            }`}
                        >
                            {cart.length === 0 ? 'ADD ITEMS TO ORDER' : 'PLACE ORDER'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
