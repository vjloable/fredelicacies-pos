"use client";

import { useState, useEffect, useMemo } from "react";
import DropdownField from "@/components/DropdownField";
import TopBar from "@/components/TopBar";
import MinusIcon from "./icons/MinusIcon";
import OrderCartIcon from "./icons/OrderCartIcon";
import type { InventoryItem, Category, Discount, BundleWithComponents, BundleComponent } from "@/types/domain";
import { subscribeToInventoryItems } from "@/services/inventoryService";
import { subscribeToCategories } from "@/services/categoryService";
import { subscribeToBundles, calculateBundleAvailability } from "@/services/bundleService";
import SearchIcon from "./icons/SearchIcon";
import { loadSettingsFromLocal } from "@/services/settingsService";
import { createOrder } from "@/services/orderService";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import EmptyOrderIllustration from "./illustrations/EmptyOrder";
import EmptyStoreIllustration from "./illustrations/EmptyStore";
import LogoIcon from "./icons/LogoIcon";
import SafeImage from "@/components/SafeImage";
import DiscountDropdown from "./components/DiscountDropdown";
import StoreIcon from "@/components/icons/SidebarNav/StoreIcon";
import { AnimatePresence, motion } from "motion/react";
import PlusIcon from "@/components/icons/PlusIcon";

import { formatCurrency } from "@/lib/currency_formatter";
import { formatReceiptWithLogo } from "@/lib/esc_formatter";
import { useBluetoothPrinter } from "@/contexts/BluetoothContext";

import { useTimeTracking, usePOSAccessControl } from "@/contexts/TimeTrackingContext";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import CustomBundlePickerModal, { type PickedItem } from "./CustomBundlePickerModal";

// Toast notification component
const SuccessToast = ({
	show,
	onClose,
	orderId,
}: {
	show: boolean;
	onClose: () => void;
	orderId: string;
}) => {
	useEffect(() => {
		if (show) {
			const timer = setTimeout(() => {
				onClose();
			}, 3000);

			return () => clearTimeout(timer);
		}
	}, [show, onClose]);

	if (!show) return null;

	return (
		<div className='fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300'>
			<div className='bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 min-w-75'>
				{/* Success Icon */}
				<div className='shrink-0'>
					<svg
						className='w-6 h-6'
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth='2'
							d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
						/>
					</svg>
				</div>

				{/* Message */}
				<div className='flex-1'>
					<div className='font-semibold'>Order Placed Successfully!</div>
					<div className='text-xs opacity-90'>Order ID: {orderId}</div>
				</div>

				{/* Close Button */}
				<button
					onClick={onClose}
					className='shrink-0 text-white hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'>
					<svg
						className='w-5 h-5'
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth='2'
							d='M6 18L18 6M6 6l12 12'
						/>
					</svg>
				</button>
			</div>
		</div>
	);
};

export default function StoreScreen() {
	const { user } = useAuth(); // Get current authenticated user
	const { currentBranch } = useBranch(); // Get current branch context
	const { printReceipt } = useBluetoothPrinter(); // Get Bluetooth printer function
	const timeTracking = useTimeTracking({ autoRefresh: true }); // Get time tracking state
	const { canAccessPOS } = usePOSAccessControl(currentBranch?.id); // Get POS access control
	const [selectedCategory, setSelectedCategory] = useState("All");
	const [selectedCategories, setSelectedCategories] = useState<string[]>([]); // For multiple category filtering
	const [searchQuery, setSearchQuery] = useState("");
	const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [bundles, setBundles] = useState<BundleWithComponents[]>([]);
	const [bundleAvailability, setBundleAvailability] = useState<Map<string, number>>(new Map());
	const [loading, setLoading] = useState(true);
	const [hideOutOfStock, setHideOutOfStock] = useState(false);
	const [orderType, setOrderType] = useState<
		"DINE-IN" | "TAKE OUT" | "DELIVERY"
	>("TAKE OUT");
	const [discountCode, setDiscountCode] = useState("");
	const [discountAmount, setDiscountAmount] = useState(0);
	const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
	const [isPlacingOrder, setIsPlacingOrder] = useState(false);
	const [isClient, setIsClient] = useState(false);
	const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
	const [showSuccessToast, setShowSuccessToast] = useState(false);
	const [showOrderMenu, setShowOrderMenu] = useState<boolean>(false);
	const [successOrderId, setSuccessOrderId] = useState<string>("");
	const [customBundleTarget, setCustomBundleTarget] = useState<BundleWithComponents | null>(null);
	const [cart, setCart] = useState<
		Array<{
			id: string;
			bundleId?: string;
			name: string;
			price: number;
			cost?: number;
			quantity: number;
			originalStock: number;
			imgUrl?: string | null;
			categoryId: number | string;
			type?: 'item' | 'bundle';
			is_custom?: boolean;
			components?: BundleComponent[];
		}>
	>([]);
	const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());
	const toggleBundle = (id: string) => setExpandedBundles(prev => {
		const next = new Set(prev);
		next.has(id) ? next.delete(id) : next.add(id);
		return next;
	});

	// Ensure we're on the client before running data subscriptions
	useEffect(() => {
		setIsClient(true);
	}, []);

	// Set up real-time subscription to inventory items using singleton dataStore
	useEffect(() => {
		if (!isClient || !currentBranch) return;

		setLoading(true);

		const unsubscribe = subscribeToInventoryItems(currentBranch.id, (items: InventoryItem[]) => {
			setInventoryItems(items);
			setLoading(false);
		});

		// Add a timeout fallback to prevent infinite loading
		const timeoutId = setTimeout(() => {
			setLoading(false);
		}, 10000); // 10 second timeout

		return () => {
			clearTimeout(timeoutId);
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [isClient, currentBranch]);

	// Subscribe to bundles
	useEffect(() => {
		if (!isClient || !currentBranch) return;

		const unsubscribe = subscribeToBundles(currentBranch.id, (bundlesData) => {
			setBundles(bundlesData);
		});

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [isClient, currentBranch]);

	// Calculate bundle availability
	useEffect(() => {
		const availability = new Map<string, number>();
		bundles.filter(b => b.status === 'active').forEach(bundle => {
			availability.set(bundle.id, calculateBundleAvailability(bundle, inventoryItems));
		});
		setBundleAvailability(availability);
	}, [bundles, inventoryItems]);

	// Set up real-time subscription to categories using singleton dataStore
	useEffect(() => {
		if (!isClient || !currentBranch) return;

		const unsubscribe = subscribeToCategories(currentBranch.id, (categoriesData: Category[]) => {
			setCategories(categoriesData);
		});

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [isClient, currentBranch]);

	// Load settings
	useEffect(() => {
		const settings = loadSettingsFromLocal();
		setHideOutOfStock(settings.hideOutOfStock);
	}, []);

	// Helper function to get category name from real categories data
	const getCategoryName = (categoryId: number | string | null) => {
		if (categoryId === null) return "Unknown";
		const category = categories.find((cat) => cat.id === String(categoryId));
		return category ? category.name : "Unknown";
	};

	const getCategoryColor = (categoryId: number | string | null) => {
		if (categoryId === null) return "transparent";
		const category = categories.find((cat) => cat.id === String(categoryId));
		return category ? category.color.trim() : "transparent";
	};

	// Get display categories including "All" button plus real categories
	const displayCategories = [
		{ id: "all", name: "All", isSpecial: true },
		...categories.map((cat) => ({ ...cat, isSpecial: false })),
	];

	// Function to handle category toggle
	const toggleCategory = (categoryName: string) => {
		if (categoryName === "All") {
			setSelectedCategory("All");
			setSelectedCategories([]);
			// Clear search when clicking "All" for better UX
			if (searchQuery) setSearchQuery("");
		} else {
			setSelectedCategory(""); // Clear "All" selection
			setSelectedCategories((prev) => {
				if (prev.includes(categoryName)) {
					return prev.filter((cat) => cat !== categoryName);
				} else {
					return [...prev, categoryName];
				}
			});
		}
	};

	// Check if a category is selected
	const isCategorySelected = (categoryName: string) => {
		if (categoryName === "All") {
			return selectedCategory === "All" && selectedCategories.length === 0;
		}
		return selectedCategories.includes(categoryName);
	};

	// Filter items based on selected categories and search query
	const filteredItems = inventoryItems.filter((item) => {
		// First apply search filter
		const matchesSearch =
			searchQuery === "" ||
			item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			getCategoryName(item.category_id)
				.toLowerCase()
				.includes(searchQuery.toLowerCase());

		// Then apply category filter (only after search logic)
		const matchesCategory =
			selectedCategories.length === 0 ||
			selectedCategory === "All" ||
			selectedCategories.includes(getCategoryName(item.category_id));

		// Filter out out-of-stock items if hideOutOfStock is enabled
		const hasStock = hideOutOfStock ? item.stock > 0 : true;

		return matchesSearch && matchesCategory && hasStock;
	});

	// Combine inventory items and bundles for display
	type DisplayItem = (InventoryItem & { type: 'item'; availability: number }) | {
		id: string;
		name: string;
		price: number;
		img_url: string | null | undefined;
		type: 'bundle';
		availability: number;
		components?: BundleComponent[];
		category_id?: string | number;
		description?: string | null;
		is_custom?: boolean;
		max_pieces?: number | null;
	};

	const displayItems: DisplayItem[] = useMemo(() => {
		const items: DisplayItem[] = filteredItems.map(item => ({
			...item,
			type: 'item' as const,
			availability: item.stock
		}));

		const bundleItems = bundles
			.filter(b => b.status === 'active')
			.map(bundle => ({
				id: bundle.id,
				name: bundle.name,
				price: bundle.price,
				img_url: bundle.img_url,
				description: bundle.description,
				type: 'bundle' as const,
				availability: bundleAvailability.get(bundle.id) || 0,
				components: bundle.components,
				is_custom: bundle.is_custom,
				max_pieces: bundle.max_pieces,
			}))
			.filter(bundle => {
				// Apply search filter
				const matchesSearch =
					searchQuery === "" ||
					bundle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					bundle.description?.toLowerCase().includes(searchQuery.toLowerCase());

				// Filter out unavailable bundles if hideOutOfStock is enabled
				const hasAvailability = hideOutOfStock ? bundle.availability > 0 : true;

				return matchesSearch && hasAvailability;
			});

		return [...items, ...bundleItems];
	}, [filteredItems, bundles, bundleAvailability, searchQuery, hideOutOfStock]);

	// Group displayItems by category for sectioned rendering
	const groupedItems = useMemo(() => {
		const categoryMap = new Map<string, DisplayItem[]>();
		displayItems.forEach(item => {
			const key = item.type === 'bundle'
				? '__bundles__'
				: (item.category_id ? String(item.category_id) : '__uncategorized__');
			if (!categoryMap.has(key)) categoryMap.set(key, []);
			categoryMap.get(key)!.push(item);
		});
		const groups: { id: string; name: string; color: string; items: DisplayItem[] }[] = [];
		categories.forEach(cat => {
			const items = categoryMap.get(String(cat.id)) || [];
			if (items.length > 0) groups.push({ id: String(cat.id), name: cat.name, color: cat.color?.trim() || '#9CA3AF', items });
		});
		const uncategorized = categoryMap.get('__uncategorized__') || [];
		if (uncategorized.length > 0) groups.push({ id: '__uncategorized__', name: 'Uncategorized', color: '#9CA3AF', items: uncategorized });
		const bundleItems = categoryMap.get('__bundles__') || [];
		if (bundleItems.length > 0) groups.push({ id: '__bundles__', name: 'Bundles', color: '#F59E0B', items: bundleItems });
		return groups;
	}, [displayItems, categories]);

	// Determine if we're showing search results
	const isSearching = searchQuery.trim() !== "";

	// Helper function to highlight search terms
	const highlightSearchTerm = (text: string, searchTerm: string) => {
		if (!searchTerm || !text) return text;

		const regex = new RegExp(
			`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
			"gi"
		);
		const parts = text.split(regex);

		return parts.map((part, index) =>
			regex.test(part) ? (
				<span key={index} className='bg-light-accent font-semibold'>
					{part}
				</span>
			) : (
				part
			)
		);
	};

	// Function to calculate available stock (original stock minus cart quantity)
	const getAvailableStock = (itemId: string) => {
		const item = inventoryItems.find((inv) => inv.id === itemId);
		const cartItem = cart.find((cartItem) => cartItem.id === itemId);

		if (!item) return 0;

		const originalStock = item.stock;
		const reservedQuantity = cartItem ? cartItem.quantity : 0;

		return Math.max(0, originalStock - reservedQuantity);
	};

	const addToCart = (item: DisplayItem) => {
		const isBundle = item.type === 'bundle';

		// Custom bundles: always open the picker modal, never add directly
		if (isBundle && item.is_custom) {
			const fullBundle = bundles.find(b => b.id === item.id);
			if (fullBundle) setCustomBundleTarget(fullBundle);
			return;
		}

		const availableStock = isBundle ? item.availability : getAvailableStock(item.id || "0");

		if (availableStock <= 0) return;

		const itemId = item.id || "0";
		const existingItem = cart.find((cartItem) => cartItem.id === itemId && (cartItem.type || 'item') === item.type);

		if (existingItem) {
			const currentInCart = existingItem.quantity;
			if (currentInCart >= availableStock) return; // Can't add more

			setCart(
				cart.map((cartItem) =>
					cartItem.id === itemId && (cartItem.type || 'item') === item.type
						? { ...cartItem, quantity: cartItem.quantity + 1 }
						: cartItem
				)
			);
		} else {
			if (isBundle) {
				setCart([
					...cart,
					{
						id: itemId,
						name: item.name,
						price: item.price,
						quantity: 1,
						originalStock: availableStock,
						imgUrl: item.img_url ?? undefined,
						categoryId: 0,
						type: 'bundle',
						components: item.components,
					},
				]);
			} else {
				setCart([
					...cart,
					{
						id: itemId,
						name: item.name,
						price: item.price,
						cost: item.cost ?? undefined,
						quantity: 1,
						originalStock: item.stock,
						imgUrl: item.img_url ?? undefined,
						categoryId: item.category_id ?? "",
						type: 'item',
					},
				]);
			}
		}
	};

	const handleCustomBundleConfirm = (bundle: BundleWithComponents, selections: PickedItem[]) => {
		const cost = selections.reduce((s, p) => s + p.cost, 0);
		const components: BundleComponent[] = selections.map(p => ({
			id: '',
			bundle_id: bundle.id,
			inventory_item_id: p.inventoryItemId,
			quantity: p.quantity,
			created_at: '',
			inventory_item: p.item,
		}));
		setCart(prev => [...prev, {
			id: `${bundle.id}_custom_${Date.now()}`,
			bundleId: bundle.id,
			name: bundle.name,
			price: bundle.price,
			cost,
			quantity: 1,
			originalStock: 999,
			imgUrl: bundle.img_url ?? undefined,
			categoryId: 0,
			type: 'bundle',
			is_custom: true,
			components,
		}]);
		setCustomBundleTarget(null);
	};

	const subtotal = cart.reduce(
		(sum, item) => sum + item.price * item.quantity,
		0
	);
	const total = subtotal - discountAmount;

	// Get unique category IDs from cart items
	const getCartCategoryIds = (): string[] => {
		const categoryIds = cart.map((item) => String(item.categoryId));
		return [...new Set(categoryIds)]; // Remove duplicates
	};

	// Handle discount application
	const handleDiscountApplied = (discount: Discount | null, amount: number) => {
		setAppliedDiscount(discount);
		setDiscountAmount(amount);
		if (discount) {
			console.log(
				"Discount applied:",
				discount.name,
				"Amount:",
				amount
			);
		} else {
			console.log("Discount cleared");
		}
	};

	const updateQuantity = (id: string, delta: number, itemType: 'item' | 'bundle' = 'item') => {
		console.log(`Updating quantity for ${itemType} ${id} by ${delta}`);
		setCart(
			cart
				.map((item) => {
					if (item.id === id && (item.type || 'item') === itemType) {
						const newQuantity = Math.max(0, item.quantity + delta);
						// Check if we can increase quantity based on available stock
						if (delta > 0) {
							let maxAvailable = 0;
							if (itemType === 'bundle') {
								const bundle = bundles.find(b => b.id === id);
								maxAvailable = bundle ? calculateBundleAvailability(bundle, inventoryItems) : 0;
							} else {
								maxAvailable = getAvailableStock(id);
							}

							if (maxAvailable <= 0 || item.quantity >= maxAvailable) {
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
		setDiscountCode("");
		setDiscountAmount(0);
		setAppliedDiscount(null);
	};

	// Function to handle closing the success toast
	const handleCloseToast = () => {
		setShowSuccessToast(false);
		setSuccessOrderId("");
	};

	// Function to handle placing order
	const handlePlaceOrder = () => {
		if (cart.length === 0 || !user) return;
		setShowOrderConfirmation(true);
	};

	// Function to confirm and actually place the order
	const confirmPlaceOrder = async () => {
		if (cart.length === 0 || isPlacingOrder || !user || !currentBranch) return;
		setIsPlacingOrder(true);
		try {
			// Create order using the new service signature
			const { id: orderId, error: orderError } = await createOrder(
				currentBranch.id,
				user.id,
				cart.map((item) => ({
					id: item.id,
					bundleId: item.bundleId,
					name: item.name,
					price: item.price,
					cost: item.cost || 0,
					quantity: item.quantity,
					imgUrl: item.imgUrl || "",
					categoryId: item.categoryId || "",
					originalStock: item.originalStock,
					type: item.type,
					components: item.components,
				})),
				subtotal,
				total,
				appliedDiscount?.id,
				discountAmount
			);

			if (orderError) {
				throw new Error(orderError);
			}

			if (!orderId) {
				throw new Error("Order ID not returned");
			}

			// Prepare receipt data for printing
			const receiptData = {
				orderId,
				date: new Date(),
				items: cart.map((item) => ({
					name: item.name,
					qty: item.quantity,
					price: item.price,
					total: item.price * item.quantity,
				})),
				subtotal,
				discount: discountAmount,
				appliedDiscountCode: appliedDiscount?.name || "",
				total,
				payment: total, // You may want to prompt for payment amount if needed
				change: 0, // You may want to calculate change if payment > total
				cashier:
					timeTracking.worker?.name ||
					user.email ||
					"Unknown Worker",
				cashierEmployeeId: timeTracking.worker?.employeeId || user.uid,
				storeName: "FOODMOOD POS",
				branchName: currentBranch.name,
			};

			// Print receipt via Bluetooth printer using context
			try {
				const receiptBytes = await formatReceiptWithLogo(receiptData);
				const printSuccess = await printReceipt(receiptBytes);

				if (printSuccess) {
					console.log("Receipt printed successfully with logo!");
				} else {
					console.log(
						"Receipt printing failed - check printer connection in Settings"
					);
				}
			} catch (printErr) {
				console.error("Failed to print receipt:", printErr);
			}

			// Show success toast
			setSuccessOrderId(orderId || "");
			setShowSuccessToast(true);

			// Clear the cart after successful order
			clearCart();
			setDiscountCode("");
			setDiscountAmount(0);
			setAppliedDiscount(null);
			setShowOrderConfirmation(false);
		} catch (error) {
			console.error("Error placing order:", error);
			alert("Failed to place order. Please try again.");
		} finally {
			setIsPlacingOrder(false);
		}
	};

	return (
		<div className='flex h-full overflow-hidden'>
			{/* Menu Area - This should expand to fill available space */}
			<div className='flex flex-col flex-1 h-full overflow-hidden'>

				{/* Header Section - Fixed */}
				<div className='flex items-center justify-between'>
					{/* Mobile/Tablet TopBar - visible below xl: breakpoint (< 1280px) */}
					<div className='xl:hidden w-full'>
						<MobileTopBar
							title='Store'
							icon={<StoreIcon />}
							showTimeTracking={true}
							onOrderClick={() => {
								setShowOrderMenu(!showOrderMenu);
							}}
						/>
					</div>
					{/* Desktop TopBar - visible at xl: breakpoint and above (≥ 1280px) */}
					<div className='hidden xl:block w-full'>
						<TopBar
							title='Store'
							icon={<StoreIcon />}
							showTimeTracking={true}
						/>
					</div>
				</div>{" "}

				{/* Search Section - Fixed */}
				<div className={`px-4 py-2 ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}>
					<div className='relative'>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Search items, categories, or descriptions...'
							className={`w-full text-3 px-4 py-3 pr-12 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
								searchQuery ? "animate-pulse transition-all" : ""
							}`}
						/>
						<div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
							{searchQuery ? (
								<LoadingSpinner size="lg" />
							) : (
								<div className='size-7.5 bg-light-accent rounded-full flex items-center justify-center'>
									<SearchIcon className='mr-0.5 mb-0.5 text-accent' />
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Results Header - Fixed */}
				<div className={`flex items-center justify-between px-4 py-1 ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}>
					<div className='flex flex-col'>
						<h2 className='text-secondary font-bold'>
							{isSearching ? "Search Results" : ""}
						</h2>
						{isSearching && (
							<p className='text-xs text-secondary opacity-60'>
								Searching for `{searchQuery}`
							</p>
						)}
					</div>
				</div>

				{/* Category Selector - Fixed */}
				<div className={`px-4 py-1.5 flex gap-1.5 overflow-x-auto flex-wrap ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}>
					{displayCategories.map((category) => (
						<button
							key={category.id}
							onClick={() => toggleCategory(category.name)}
							className={`px-3 py-1 rounded-lg font-medium text-3 whitespace-nowrap transition-all ${
								isCategorySelected(category.name)
									? !category.isSpecial
										? "bg-secondary/20 text-secondary shadow-none"
										: "bg-accent text-primary shadow-none"
									: "bg-white text-secondary hover:bg-gray-200"
							}`}>
							<div className="flex items-center">
								{!category.isSpecial && <span className="w-2 h-2 rounded-full shrink-0 mr-1.5" style={{backgroundColor: getCategoryColor(category.id)}}/>}
								{category.name}
								{!category.isSpecial && (
									<span className='ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-secondary/10 text-secondary/50 text-[9px] font-medium'>
										{inventoryItems.filter((item) => getCategoryName(item.category_id) === category.name).length}
									</span>
								)}
							</div>
						</button>
					))}
				</div>

				{/* Menu Items - Scrollable */}
				<div className={`flex-1 overflow-y-auto px-4 py-4 ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}>
					{loading ? (
						<div className='flex flex-col items-center justify-center py-8 gap-4'>
							<LoadingSpinner size="lg"/>
							<span className='ml-3 text-secondary'>
								Loading menu...
							</span>
						</div>
					) : inventoryItems.length === 0 ? (
						// Empty Inventory Collection State
						<div className='flex flex-col items-center justify-center py-12'>
							<div className='w-90 mb-4 pr-12.5 mx-auto opacity-50 flex items-center justify-center'>
								<EmptyStoreIllustration />
							</div>
							<h3 className='text-lg font-semibold text-secondary mb-3'>
								The store front is empty
							</h3>
							<p className='text-secondary opacity-70 text-center max-w-md mb-4 leading-relaxed'>
								The inventory is empty. You need to add items to your
								inventory before they can appear in the store.
							</p>
							<div className='flex flex-col sm:flex-row gap-3 mb-25'>
								<button
									onClick={() => (window.location.href = "/inventory")}
									className='px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-all font-medium'>
									Go to Inventory
								</button>
							</div>
						</div>
					) : displayItems.length === 0 ? (
						// Filtered Results Empty State
						<div className='flex flex-col items-center justify-center py-12'>
							<div className='w-16 h-16 bg-light-accent rounded-full flex items-center justify-center mb-4'>
								{isSearching ? (
									<svg
										className='w-8 h-8 text-accent'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
										/>
									</svg>
								) : (
									<svg
										className='w-8 h-8 text-accent'
										fill='currentColor'
										viewBox='0 0 20 20'>
										<path
											fillRule='evenodd'
											d='M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z'
											clipRule='evenodd'
										/>
									</svg>
								)}
							</div>
							<h3 className='text-md font-medium text-secondary mb-2'>
								{isSearching ? "No Results Found" : "No Items Available"}
							</h3>
							<p className='text-secondary text-xs opacity-70 text-center max-w-sm'>
								{isSearching
									? `No items match "${searchQuery}". Try searching with different keywords or check the spelling.`
									: selectedCategory === "All"
									? "No items available with current filters."
									: `No items found in the "${selectedCategory}" category.`}
							</p>
							{isSearching && (
								<button
									onClick={() => setSearchQuery("")}
									className='mt-4 px-4 py-2 bg-accent font-bold text-xs text-primary rounded-lg hover:bg-accent/90 transition-all'>
									Clear Search
								</button>
							)}
						</div>
					) : (
					<div className='space-y-4'>
						{groupedItems.map(group => (
							<div key={group.id}>
								<div className='flex items-center gap-2 mb-2'>
									<span className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: group.color }} />
									<span className='text-2.5 font-bold text-secondary/60 uppercase tracking-widest'>{group.name}</span>
									<span className='inline-flex items-center justify-center w-4 h-4 rounded-full bg-secondary/10 text-secondary/40 text-[9px] font-medium'>{group.items.length}</span>
								</div>
								<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2'>
									{group.items.map((item, index) => {
										const isBundle = item.type === 'bundle';
										const availableStock = isBundle ? item.availability : getAvailableStock(item.id || "0");
										const isOutOfStock = availableStock <= 0;
										const cartItem = cart.find(
											(cartItem) => cartItem.id === item.id && (cartItem.type || 'item') === item.type
										);
										const inCartQuantity = cartItem ? cartItem.quantity : 0;
										const stockColor = availableStock > 10
											? 'bg-green-50 text-green-600'
											: availableStock > 5
											? 'bg-bundle/10 text-bundle'
											: 'bg-orange-50 text-orange-600';

										return (
											<div
												key={item.id || index}
												onClick={() => !isOutOfStock && addToCart(item)}
												className={`group bg-primary rounded-xl border-2 overflow-hidden transition-all duration-200
													${isOutOfStock
														? 'opacity-50 cursor-not-allowed border-gray-100'
														: 'cursor-pointer border-gray-200 hover:border-accent hover:shadow-md active:scale-95'
													}`}>

												{/* Image */}
												<div className='relative w-full h-24 bg-gray-50 overflow-hidden group-hover:bg-accent/10 transition-all duration-200'>
													{item.img_url ? (
														<SafeImage src={item.img_url} alt={item.name} className='' />
													) : (
														<div className='w-full h-full flex items-center justify-center'>
															<LogoIcon className='w-8 h-10 opacity-20' />
														</div>
													)}

													{/* Cart quantity bubble */}
													{inCartQuantity > 0 && (
														<div className='absolute top-1.5 right-1.5 bg-accent text-primary text-2.5 min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold select-none'>
															{inCartQuantity}
														</div>
													)}

													{/* Out of stock overlay */}
													{isOutOfStock && (
														<div className='absolute inset-0 bg-black/40 flex items-center justify-center'>
															<span className='text-white text-2.5 font-bold select-none tracking-wide uppercase'>
																{isBundle ? 'Unavailable' : 'Out of Stock'}
															</span>
														</div>
													)}
												</div>

												{/* Info */}
												<div className='px-1.5 py-1'>
													<p className='font-semibold text-secondary text-xs leading-snug line-clamp-2'>
														{isSearching ? highlightSearchTerm(item.name, searchQuery) : item.name}
													</p>
													{!isBundle && item.category_id && (
														<div className='flex items-center gap-1 mt-0.5'>
															<span className='w-1.5 h-1.5 rounded-full shrink-0' style={{ backgroundColor: getCategoryColor(item.category_id) }} />
															<span className='text-xs text-secondary/30 truncate select-none'>{getCategoryName(item.category_id)}</span>
														</div>
													)}
													<div className='flex items-center justify-between gap-1 mt-1'>
														<span className='text-accent font-bold text-xs'>
															{formatCurrency(item.price)}
														</span>
														{isBundle && item.is_custom ? (
															<span className='text-xs font-medium px-1.5 py-0.5 rounded select-none bg-bundle/10 text-bundle'>
																Mix & Match
															</span>
														) : !isOutOfStock && (
															<span className={`text-xs font-medium px-1.5 py-0.5 rounded select-none ${stockColor}`}>
																{availableStock} left
															</span>
														)}
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						))}
					</div>
					)}
				</div>
			</div>

			{/* Mobile Order Menu Overlay - visible below xl: breakpoint (< 1280px) */}
			<AnimatePresence>
				{showOrderMenu && (
					<div className='fixed inset-0 z-50 xl:hidden'>
						{/* Backdrop */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							className='absolute inset-0 bg-black/50'
							onClick={() => setShowOrderMenu(false)}
						/>

						{/* Order Panel */}
						<motion.div
							initial={{ x: "100%" }}
							animate={{ x: 0 }}
							exit={{ x: "100%" }}
							transition={{ type: "spring", damping: 50, stiffness: 300 }}
							className='absolute top-0 right-0 bottom-0 w-full bg-primary flex flex-col border-l border-gray-200'>
							{/* Header with Close Button */}
							<div className='shrink-0 flex items-center justify-between p-4 border-b-2 border-accent'>
								<h2 className='text-lg font-bold text-secondary'>
									Current Order
								</h2>
								<button
									onClick={() => setShowOrderMenu(false)}
									className='w-10 h-10 flex items-center justify-center bg-light-accent rounded-full hover:bg-accent transition-all'>
									<svg
										className='w-6 h-6 text-secondary'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M6 18L18 6M6 6l12 12'
										/>
									</svg>
								</button>
							</div>

							{/* Order Type Dropdown */}
							<div className='shrink-0 h-12 p-2 border-b border-gray-100'>
								<div className='flex h-10.5 items-center justify-between bg-background rounded-3xl gap-3'>
									<DropdownField
										options={["DINE-IN", "TAKE OUT", "DELIVERY"]}
										defaultValue='TAKE OUT'
										dropdownPosition='bottom-right'
										dropdownOffset={{ top: 2, right: 0 }}
										onChange={(value) =>
											setOrderType(
												value as "DINE-IN" | "TAKE OUT" | "DELIVERY"
											)
										}
										roundness={"full"}
										height={42}
										valueAlignment={"left"}
										padding=''
										shadow={false}
									/>
								</div>
							</div>

							{/* Cart Items - Scrollable */}
							<div className='flex-1 overflow-y-auto px-3 py-3'>
								{cart.length === 0 ? (
									<div className='flex flex-col items-center justify-center h-full py-6'>
										<div className='w-24 h-20 flex items-center justify-center mb-3 opacity-40'>
											<EmptyOrderIllustration />
										</div>
										<h3 className='text-sm font-medium text-secondary mb-1 select-none'>
											Order List is Empty
										</h3>
										<p className='text-secondary w-75 opacity-70 text-center max-w-sm text-xs leading-relaxed select-none'>
											Add items from the menu to start building your order.
											Click on any menu item to add it to your cart.
										</p>
									</div>
								) : (
									<div className='space-y-0'>
										<AnimatePresence mode='popLayout'>
											{cart.map((item, index) => (
												<motion.div
													key={item.id}
													initial={{ opacity: 0, x: 100, scale: 0.9 }}
													animate={{ opacity: 1, x: 0, scale: 1 }}
													exit={{
														opacity: 0,
														x: -100,
														scale: 0.8,
														height: 0,
													}}
													transition={{
														duration: 0.3,
														type: "spring",
														stiffness: 300,
														damping: 25,
														delay: index * 0.05,
													}}
													layout
													layoutId={`mobile-cart-item-${item.id}`}
													className='flex flex-col w-full bg-white py-1.5'>
													<div className='flex flex-row items-start gap-3 w-full'>
														<div className='flex-none w-14 h-14 bg-gray-100 rounded-md relative overflow-hidden'>
															{item.imgUrl ? (
																<SafeImage
																	src={item.imgUrl}
																	alt={item.name}
																/>
															) : null}
															{!item.imgUrl && (
																<div className='w-full h-full flex items-center justify-center'>
																	<LogoIcon className='w-10 h-10' />
																</div>
															)}
														</div>

														<div className='flex flex-col items-start gap-1 w-full grow'>
															<div className='flex flex-col items-start gap-1 w-full grow'>
																<div className='flex flex-row items-center justify-between gap-2 w-full'>
																	<span className="font-normal text-sm leading-5.25 text-secondary font-poppins truncate">
																		{item.name}
																	</span>
																	{item.is_custom && (
																		<span className='shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-bundle/20 text-bundle rounded'>Custom</span>
																	)}
																</div>
																<div className='flex flex-row items-center justify-between w-full'>
																	<span className='space-x-2 flex items-center'>
																		<span className="font-normal text-xs leading-5.25 text-secondary font-poppins">
																			{formatCurrency(item.price)}
																		</span>
																		{!item.is_custom && (
																		<span className="font-bold text-xs text-shadow-lg leading-5.25 text-primary font-poppins bg-accent/80 px-2 py-1 rounded-full min-w-6 text-center">
																			×{item.quantity}
																		</span>
																		)}
																	</span>
																	<span className='space-x-2 flex items-center'>
																		<span className="font-normal text-xs leading-5.25 text-secondary font-poppins">
																			=
																		</span>
																		<span className="font-bold text-xs leading-5.25 text-secondary font-poppins">
																			{formatCurrency(
																				item.price * item.quantity
																			)}
																		</span>
																	</span>
																</div>

																{/* Bundle Component Details */}
																{item.type === 'bundle' && item.components && (
																	<div className='mt-1'>
																		<button
																			onClick={(e) => { e.stopPropagation(); toggleBundle(item.id); }}
																			className='flex items-center gap-1 text-xs text-bundle font-medium hover:text-bundle transition-colors'>
																				<span>{item.components.length} item{item.components.length !== 1 ? 's' : ''}</span>
																				<svg className={`w-3 h-3 transition-transform ${expandedBundles.has(item.id) ? 'rotate-180' : ''}`} viewBox='0 0 12 12' fill='none' stroke='currentColor' strokeWidth='1.5'><path d='M2 4l4 4 4-4'/></svg>
																		</button>
																		{expandedBundles.has(item.id) && (
																			<div className='flex flex-wrap gap-1 mt-1'>
																				{item.components.map((comp) => (
																					<span key={comp.id || comp.inventory_item_id} className='inline-flex items-center gap-0.5 bg-bundle/10 border border-bundle/40 text-bundle text-xs font-medium px-1 py-0.5 rounded'>
																						<span>{comp.inventory_item?.name || 'Item'}</span>
																						<span className='shrink-0 opacity-60'>×{comp.quantity}</span>
																					</span>
																				))}
																			</div>
																		)}
																	</div>
																)}
															</div>

															{!item.is_custom && (
															<div className='flex flex-row justify-end items-end gap-3 w-full h-8.75'>
																<div className='flex flex-row justify-between items-center px-1.5 w-30 h-8.75 bg-light-accent rounded-3xl'>
																	<button
																		onClick={() =>
																			updateQuantity(item.id, -1, item.type || 'item')
																		}
																		className='flex flex-col justify-center items-center p-1.5 gap-5 w-5.75 h-5.75 bg-white rounded-3xl hover:scale-110 hover:bg-accent transition-all'>
																		<MinusIcon />
																	</button>

																	<span className="font-bold text-sm leading-5.25 text-secondary font-poppins">
																		{item.quantity}
																	</span>

																	<button
																		onClick={() => updateQuantity(item.id, 1, item.type || 'item')}
																		className='flex flex-col justify-center items-center p-1.5 gap-5 w-5.75 h-5.75 bg-white rounded-3xl hover:scale-110 hover:bg-accent transition-all'>
																		<PlusIcon />
																	</button>
																</div>
															</div>
															)}
														</div>
													</div>
													<AnimatePresence>
														<motion.div
															key={`mobile-divider-${index}`}
															initial={{ opacity: 0 }}
															animate={{
																opacity: index === cart.length - 1 ? 0 : 1,
															}}
															transition={{
																duration: 0.3,
																type: "spring",
																stiffness: 300,
																damping: 25,
																delay: index * 0.05,
															}}
															className='flex h-px border border-b border-dashed border-secondary/20 w-full'
														/>
													</AnimatePresence>
												</motion.div>
											))}
										</AnimatePresence>
									</div>
								)}
							</div>

							{/* Order Summary */}
							<div className='shrink-0 border-t-2 border-accent pb-4'>
								<div className='flex justify-between h-9.75 text-secondary text-3 font-medium px-3 py-1.5 items-end'>
									<span>Subtotal</span>
									<span>{formatCurrency(subtotal)}</span>
								</div>
								<div className='flex justify-between h-8.25 text-secondary text-3 font-medium px-3 py-1.5'>
									<span>Discount</span>
									<span>-{formatCurrency(discountAmount)}</span>
								</div>

								<div className='gap-2 p-2'>
									<DiscountDropdown
										value={discountCode}
										onChange={setDiscountCode}
										onDiscountApplied={handleDiscountApplied}
										subtotal={subtotal}
									/>
								</div>

								<div className='border-t border-dashed border-accent'>
									<div className='flex justify-between font-semibold text-sm p-2.5 items-center'>
										<span>Total</span>
										<span>{formatCurrency(total)}</span>
									</div>

									<div className='px-3 pb-3 flex gap-2'>
										{cart.length > 0 && (
											<button
												onClick={clearCart}
												className='flex-1 py-3 font-black text-3 text-error bg-white border-2 border-error rounded-lg hover:bg-error hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'>
												CLEAR CART
											</button>
										)}
										<button
											onClick={handlePlaceOrder}
											disabled={cart.length === 0 || isPlacingOrder || !user}
											className={`flex-1 py-3 font-black text-3 rounded-lg transition-all ${
												cart.length === 0 || isPlacingOrder || !user
													? "bg-gray-300 text-primary cursor-not-allowed"
													: "bg-accent text-primary hover:bg-accent/80 hover:shadow-lg cursor-pointer text-shadow-lg"
											}`}>
											<span>
												{!user
													? "LOGIN TO ORDER"
													: isPlacingOrder
													? "PLACING..."
													: cart.length === 0
													? "ADD ITEMS"
													: "PLACE ORDER"}
											</span>
										</button>
									</div>
								</div>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>

			{/* Right Side Panel - Order Summary - Desktop only (≥ 1280px) */}
			<div className='hidden xl:flex flex-col h-screen bg-primary border-l border-gray-200 overflow-hidden w-90 shrink-0'>
				{/* Header Section - Fixed at top (154px total) */}
				<div className='shrink-0'>
					<div className='w-full h-22.5 bg-primary border-b border-secondary/20 border-dashed'>
						{/* Order Header */}
						<div className='flex items-center gap-2 p-2'>
							<div className='bg-light-accent w-10 h-10 rounded-full items-center justify-center flex relative'>
								<OrderCartIcon className="w-6 h-6"/>
								{cart.length > 0 && (
									<div className='absolute -top-1 -right-1 bg-accent text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center px-1'>
										{cart.reduce((sum, item) => sum + item.quantity, 0)}
									</div>
								)}
							</div>
							<div className='flex flex-1 flex-col items-center'>
								<span className='text-secondary font-medium text-3.5 self-start'>
									{cart.length === 0 ? "New Order" : "Current Order"}
								</span>
								<span className='text-secondary font-light text-3 self-start'>
									{cart.length === 0
										? "No items added"
										: `${cart.length} item${cart.length !== 1 ? "s" : ""}`}
								</span>
							</div>
							{cart.length > 0 && (
								<button
									onClick={clearCart}
									className='text-error border border-error hover:text-white text-xs font-medium hover:bg-error/50 px-2 py-1 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'
									title='Clear all items'>
									Clear
								</button>
							)}
							<div className='hidden bg-light-accent w-16 h-16 rounded-full'></div>
						</div>
					</div>

					<div className='h-12 p-2 border-b-2 border-accent'>
						<div className='flex h-10.5 items-center justify-between bg-background rounded-3xl gap-3'>
							<DropdownField
								options={["DINE-IN", "TAKE OUT", "DELIVERY"]}
								defaultValue='TAKE OUT'
								dropdownPosition='bottom-right'
								dropdownOffset={{ top: 2, right: 0 }}
								onChange={(value) =>
									setOrderType(value as "DINE-IN" | "TAKE OUT" | "DELIVERY")
								}
								roundness={"full"}
								height={42}
								valueAlignment={"left"}
								padding=''
								shadow={false}
							/>
						</div>
					</div>
				</div>

				{/* Cart Items - Scrollable middle section */}
				<div className='flex-1 overflow-y-auto px-3 py-3'>
					{cart.length === 0 ? (
						<div className='flex flex-col items-center justify-center h-full py-6'>
							<div className='w-24 h-20 flex items-center justify-center mb-3 opacity-40'>
								<EmptyOrderIllustration />
							</div>
							<h3 className='text-sm font-medium text-secondary mb-1 select-none'>
								Order List is Empty
							</h3>
							<p className='text-secondary w-75 opacity-70 text-center max-w-sm text-xs leading-relaxed select-none'>
								Add items from the menu to start building your order. Click on
								any menu item to add it to your cart.
							</p>
						</div>
					) : (
						/* Cart Items */
						<div className='space-y-0'>
							<AnimatePresence mode='popLayout'>
								{cart.map((item, index) => (
									<motion.div
										key={item.id}
										initial={{ opacity: 0, x: 100, scale: 0.9 }}
										animate={{ opacity: 1, x: 0, scale: 1 }}
										exit={{
											opacity: 0,
											x: -100,
											scale: 0.8,
											height: 0,
										}}
										transition={{
											duration: 0.3,
											type: "spring",
											stiffness: 300,
											damping: 25,
											delay: index * 0.05,
										}}
										layout
										layoutId={`cart-item-${item.id}`}
										className='flex flex-col w-full bg-white py-1.5'>
										<div className='flex flex-row items-start gap-3 w-full'>
											<div className='flex-none w-14 h-14 bg-gray-100 rounded-md relative overflow-hidden'>
												{item.imgUrl ? (
													<SafeImage src={item.imgUrl} alt={item.name} />
												) : null}
												{!item.imgUrl && (
													<div className='w-full h-full flex items-center justify-center'>
														<LogoIcon className='w-10 h-10 opacity-25' />
													</div>
												)}
											</div>

											<div className='flex flex-col items-start gap-1 w-full grow'>
												{/* Item Info Section */}
												<div className='flex flex-col items-start gap-1 w-full grow'>
													{/* Title and Quantity Row */}
													<div className='flex flex-row items-center justify-between gap-2 w-full'>
														<span className="font-normal text-sm leading-5.25 text-secondary font-poppins truncate">
															{item.name}
														</span>
														{item.is_custom && (
															<span className='shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-bundle/20 text-bundle rounded'>Custom</span>
														)}
													</div>
													{/* Price and Subtotal Row */}
													<div className='flex flex-row items-center justify-between w-full'>
														<span className='space-x-2 flex items-center'>
															<span className="font-normal text-xs text-secondary font-poppins">
																{formatCurrency(item.price)}
															</span>
															{!item.is_custom && (
																<span className="font-bold text-xs text-primary font-poppins bg-accent/80 px-2 py-1 rounded-full min-w-6 text-center">
																	×{item.quantity}
																</span>
															)}
														</span>
														<span className='space-x-2 flex items-center'>
															<span className="font-normal text-xs leading-5.25 text-secondary font-poppins">
																=
															</span>
															<span className="font-bold text-xs leading-5.25 text-secondary font-poppins">
																{formatCurrency(item.price * item.quantity)}
															</span>
														</span>
													</div>

													{/* Bundle Component Details */}
													{item.type === 'bundle' && item.components && (
														<div className='mt-1'>
															<button
																onClick={(e) => { e.stopPropagation(); toggleBundle(item.id); }}
																className='flex items-center gap-1 text-xs text-bundle font-medium hover:text-bundle transition-colors'>
																	<span>{item.components.length} item{item.components.length !== 1 ? 's' : ''}</span>
																	<svg className={`w-3 h-3 transition-transform ${expandedBundles.has(item.id) ? 'rotate-180' : ''}`} viewBox='0 0 12 12' fill='none' stroke='currentColor' strokeWidth='1.5'><path d='M2 4l4 4 4-4'/></svg>
															</button>
															{expandedBundles.has(item.id) && (
																<div className='flex flex-wrap gap-1 mt-1'>
																	{item.components.map((comp) => (
																		<span key={comp.id || comp.inventory_item_id} className='inline-flex items-center gap-0.5 bg-bundle/10 border border-bundle/40 text-bundle text-xs font-medium px-1 py-0.5 rounded'>
																			<span>{comp.inventory_item?.name || 'Item'}</span>
																			<span className='shrink-0 opacity-60'>×{comp.quantity}</span>
																		</span>
																	))}
																</div>
															)}
														</div>
													)}
												</div>

												{/* Controls Section */}
												{!item.is_custom && (
												<div className='flex flex-row justify-end items-end gap-3 w-full h-8.75'>
													{/* Quantity Controls */}
													<div className='flex flex-row justify-between items-center px-1.5 w-30 h-8.75 bg-light-accent rounded-3xl'>
														<button
															onClick={() => updateQuantity(item.id, -1, item.type || 'item')}
															className='flex flex-col justify-center items-center p-1.5 gap-5 w-5.75 h-5.75 bg-white rounded-3xl hover:scale-110 hover:bg-accent transition-all'>
															<MinusIcon />
														</button>

														<span className="font-bold text-sm leading-5.25 text-secondary font-poppins">
															{item.quantity}
														</span>

														<button
															onClick={() => updateQuantity(item.id, 1, item.type || 'item')}
															className='flex flex-col justify-center items-center p-1.5 gap-5 w-5.75 h-5.75 bg-white rounded-3xl hover:scale-110 hover:bg-accent transition-all'>
															<PlusIcon />
														</button>
													</div>
												</div>
												)}
											</div>
										</div>
										<AnimatePresence>
											<motion.div
												key={`divider-${index}`}
												initial={{ opacity: 0 }}
												animate={{
													opacity: index === cart.length - 1 ? 0 : 1,
												}}
												transition={{
													duration: 0.3,
													type: "spring",
													stiffness: 300,
													damping: 25,
													delay: index * 0.05,
												}}
												className='flex h-px border border-b border-dashed border-secondary/20 w-full'
											/>
										</AnimatePresence>
									</motion.div>
								))}
							</AnimatePresence>
						</div>
					)}
				</div>

				{/* Order Summary */}
				<div className='shrink border-t-2 border-accent'>
					<div className='flex justify-between h-9.75 text-secondary text-3 font-medium px-3 py-1.5 items-end'>
						<span>Subtotal</span>
						<span>{formatCurrency(subtotal)}</span>
					</div>
					<div className='flex justify-between h-8.25 text-secondary text-3 font-medium px-3 py-1.5'>
						<span>Discount</span>
						<span>-{formatCurrency(discountAmount)}</span>
					</div>

					<div className='gap-2 p-2'>
						<DiscountDropdown
							value={discountCode}
							onChange={setDiscountCode}
							onDiscountApplied={handleDiscountApplied}
							subtotal={subtotal}
						/>
					</div>

					<div className='border-t border-dashed border-accent'>
						<div className='flex justify-between font-semibold text-sm p-2.5 items-center'>
							<span>Total</span>
							<span>{formatCurrency(total)}</span>
						</div>

						{/* Place Order Button */}
						<button
							onClick={handlePlaceOrder}
							disabled={cart.length === 0 || isPlacingOrder || !user}
							className={`w-full py-3 font-black text-3.5 transition-all ${
								cart.length === 0 || isPlacingOrder || !user
									? "bg-gray-300 text-primary cursor-not-allowed"
									: "bg-accent text-primary hover:bg-accent/80 hover:shadow-lg cursor-pointer text-shadow-lg"
							}`}>
							<span>
								{!user
									? "PLEASE LOGIN TO ORDER"
									: isPlacingOrder
									? "PLACING ORDER..."
									: cart.length === 0
									? "ADD ITEMS TO ORDER"
									: "PLACE ORDER"}
							</span>
						</button>
					</div>
				</div>
			</div>

			{/* Order Confirmation Modal */}
			{showOrderConfirmation && (
				<div className='fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4'>
					<div className='bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col'>
						{/* Modal Header */}
						<div className='p-4 border-b border-gray-200'>
							<div className='flex items-center justify-between'>
								<h2 className='text-lg font-semibold text-secondary'>
									Confirm Order
								</h2>
								<button
									onClick={() => setShowOrderConfirmation(false)}
									className='text-gray-400 hover:text-secondary text-xl'>
									×
								</button>
							</div>
							<p className='text-xs text-secondary/80 mt-1'>
								Please review your order before confirming
							</p>
						</div>

						{/* Order Details */}
						<div className='flex-1 overflow-y-auto p-4'>
							{/* Order Type */}
							<div className='mb-3 flex justify-between text-3'>
								<span className='text-secondary font-medium'>
									Order Type:
								</span>
								<span className='font-medium'>{orderType}</span>
							</div>

							{/* Items List */}
							<div className='mb-3'>
								<h3 className='text-3 font-medium text-secondary mb-2'>
									Items ({cart.length})
								</h3>
								<div className='space-y-2'>
									{cart.map((item) => (
										<div
											key={item.id}
											className='flex items-center gap-2 p-2 bg-gray-50 rounded-lg'>
											{/* Item Image */}
											<div className='w-10 h-10 bg-gray-200 rounded-lg shrink-0 overflow-hidden relative'>
												{item.imgUrl ? (
													<SafeImage
														src={item.imgUrl}
														alt={item.name}
														className='w-full h-full object-cover'
													/>
												) : (
													<div className='w-full h-full flex items-center justify-center'>
														<LogoIcon className='w-6 h-7 opacity-20' />
													</div>
												)}
											</div>

											{/* Item Details */}
											<div className='flex-1 min-w-0'>
												<h4 className='font-medium text-secondary truncate'>
													{item.name}
												</h4>
												<p className='text-xs text-secondary'>
													{formatCurrency(item.price)}
												</p>
											</div>

											{/* Quantity and Total */}
											<div className='text-right'>
												<div className='text-xs font-medium text-secondary/50'>
													Qty: {item.quantity}
												</div>
												<div className='text-xs font-regular text-secondary'>
													{formatCurrency(item.price * item.quantity)}
												</div>
											</div>
										</div>
									))}
								</div>
							</div>

							{/* Order Summary */}
							<div className='border-t border-gray-200 pt-4'>
								<div className='space-y-2'>
									<div className='flex justify-between text-xs'>
										<span className='text-secondary'>Subtotal:</span>
										<span className='font-medium'>
											{formatCurrency(subtotal)}
										</span>
									</div>
									{discountAmount > 0 && (
										<div className='flex justify-between text-xs'>
											<span className='text-secondary'>
												Discount
												{appliedDiscount && (
													<span className='font-medium ml-1'>
														({appliedDiscount.name} -{" "}
														{appliedDiscount.type === "percentage"
															? `${appliedDiscount.value}% off`
															: `₱${appliedDiscount.value} off`}
														)
													</span>
												)}
												:
											</span>
											<span className='font-medium text-green-600'>
												-{formatCurrency(discountAmount)}
											</span>
										</div>
									)}
									<div className='flex justify-between text-base font-semibold border-t border-gray-200 pt-2'>
										<span>Total:</span>
										<span className='text-secondary'>
											{formatCurrency(total)}
										</span>
									</div>
								</div>
							</div>
						</div>

						{/* Modal Footer */}
						<div className='p-4 border-t border-gray-200 bg-gray-50'>
							<div className='flex gap-3'>
								<button
									onClick={() => setShowOrderConfirmation(false)}
									className='flex-1 px-4 py-3 text-xs text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 hover:shadow-md transition-colors font-black'>
									CANCEL
								</button>
								<button
									onClick={confirmPlaceOrder}
									disabled={isPlacingOrder}
									className={`flex-1 px-4 py-3 rounded-lg text-xs font-black transition-all ${
										isPlacingOrder
											? "bg-gray-100 text-secondary/50 cursor-not-allowed"
											: "bg-accent text-primary hover:bg-accent/90 cursor-pointer hover:shadow-md"
									}`}>
									{isPlacingOrder ? "PROCESSING..." : "CONFIRM"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Custom Bundle Picker Modal */}
			{customBundleTarget && (
				<CustomBundlePickerModal
					bundle={customBundleTarget}
					inventory={inventoryItems}
					onConfirm={(selections) => handleCustomBundleConfirm(customBundleTarget, selections)}
					onClose={() => setCustomBundleTarget(null)}
				/>
			)}

			{/* Success Toast Notification */}
			<SuccessToast
				show={showSuccessToast}
				onClose={handleCloseToast}
				orderId={successOrderId}
			/>

			<button
				onClick={() => setShowOrderMenu(!showOrderMenu)}
				className='flex xl:hidden justify-between items-center fixed bottom-6 left-0 right-0 mx-6 z-40 px-6 py-3 bg-accent text-primary rounded-full shadow-lg hover:shadow-xl hover:scale-101 transition-all font-medium text-xs gap-3'>
				<div className='flex-1 flex justify-between items-center text-primary'>
					<span className='text-xs'>
						{cart.length === 0
							? "No Items Selected"
							: `${cart.length} item${cart.length !== 1 ? "s" : ""}`}
					</span>
					<span className='text-xs text-primary font-semibold'>
						{formatCurrency(subtotal)}
					</span>
				</div>
				<div className='rounded-full h-8 w-8 bg-primary p-2 flex items-center justify-center'>
					<div className='scale-75'>
						<OrderCartIcon className="text-secondary" />
					</div>
				</div>
			</button>
		</div>
	);
}
