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
			<div className='bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-75'>
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
					<div className='text-sm opacity-90'>Order ID: {orderId}</div>
				</div>

				{/* Close Button */}
				<button
					onClick={onClose}
					className='shrink-0 text-white hover:text-gray-200 transition-colors'>
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
	const [isCustomBundleModalOpen, setIsCustomBundleModalOpen] = useState(false);
	const [cart, setCart] = useState<
		Array<{
			id: string;
			name: string;
			price: number;
			cost?: number;
			quantity: number;
			originalStock: number;
			imgUrl?: string | null;
			categoryId: number | string;
			type?: 'item' | 'bundle';
			components?: BundleComponent[];
		}>
	>([]);

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
				components: bundle.components
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
				<span key={index} className='bg-(--light-accent) font-semibold'>
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
				<div className={`px-6 py-4 ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}>
					<div className='relative'>
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Search items, categories, or descriptions...'
							className={`w-full text-3 px-4 py-3 pr-12 shadow-md bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
								searchQuery ? "animate-pulse transition-all" : ""
							}`}
						/>
						<div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
							{searchQuery ? (
								<div className='size-7.5 border-accent border-2 border-dashed rounded-full flex items-center justify-center animate-spin'></div>
							) : (
								<div className='size-7.5 bg-(--light-accent) rounded-full flex items-center justify-center'>
									<SearchIcon className='mr-0.5 mb-0.5 text-accent' />
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Results Header - Fixed */}
				<div className={`flex items-center justify-between px-6 py-2 ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}>
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
				<div className={`px-6 py-2 flex gap-2 overflow-x-auto flex-wrap ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}>
					{displayCategories.map((category) => (
						<button
							key={category.id}
							onClick={() => toggleCategory(category.name)}
							className={`px-4 py-2 rounded-lg font-medium text-3 whitespace-nowrap transition-all ${
								isCategorySelected(category.name)
									? `${
											!category.isSpecial
												? "bg-(--secondary)/20"
												: "bg-accent"
										} text-secondary shadow-none`
									: "bg-white text-secondary hover:bg-gray-200 shadow-md"
							}`}>
							<div>
								{!category.isSpecial && <span className="h-1 w-1 px-2 rounded-full mr-2" style={{backgroundColor: getCategoryColor(category.id)}}/>}
								{category.name}
								{!category.isSpecial && (
									<span className='ml-2 text-xs px-2 py-1 h-1 w-1 rounded-full bg-(--secondary)/10 text-(--secondary)/50'>
										{
											inventoryItems.filter(
												(item) =>
													getCategoryName(item.category_id) === category.name
											).length
										}
									</span>
								)}
							</div>
						</button>
					))}
				</div>

				{/* Menu Items - Scrollable */}
				<div className={`flex-1 overflow-y-auto px-6 py-6 ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}>
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
							<div className='w-90 mb-6 pr-12.5 mx-auto opacity-50 flex items-center justify-center'>
								<EmptyStoreIllustration />
							</div>
							<h3 className='text-xl font-semibold text-secondary mb-3'>
								The store front is empty
							</h3>
							<p className='text-secondary opacity-70 text-center max-w-md mb-6 leading-relaxed'>
								The inventory is empty. You need to add items to your
								inventory before they can appear in the store.
							</p>
							<div className='flex flex-col sm:flex-row gap-3 mb-25'>
								<button
									onClick={() => (window.location.href = "/inventory")}
									className='px-6 py-3 bg-accent text-white rounded-lg hover:bg-(--accent)/90 transition-all font-medium shadow-md'>
									Go to Inventory
								</button>
							</div>
						</div>
					) : displayItems.length === 0 ? (
						// Filtered Results Empty State
						<div className='flex flex-col items-center justify-center py-12'>
							<div className='w-16 h-16 bg-(--light-accent) rounded-full flex items-center justify-center mb-4'>
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
									className='mt-4 px-4 py-2 bg-accent font-bold text-sm text-primary rounded-lg hover:bg-(--accent)/90 transition-all'>
									Clear Search
								</button>
							)}
						</div>
					) : (
						<div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 justify-center gap-6'>
							{displayItems.map((item, index) => {
								const isBundle = item.type === 'bundle';
								const availableStock = isBundle ? item.availability : getAvailableStock(item.id || "0");
								const isOutOfStock = availableStock <= 0;
								const cartItem = cart.find(
									(cartItem) => cartItem.id === item.id && (cartItem.type || 'item') === item.type
								);
								const inCartQuantity = cartItem ? cartItem.quantity : 0;

								return (
									<div
										key={item.id || index}
										onClick={() => !isOutOfStock && addToCart(item)}
										className={`
										group bg-primary rounded-lg cursor-pointer shadow-md min-w-50
										hover:shadow-none hover:bg-(--accent)/10 border-primary border-2 hover:border-accent transition-all duration-300
										${
											isOutOfStock
												? "opacity-50 cursor-not-allowed"
												: "border-gray-200 hover:border-accent"
										}
									`}>
										{/* Item Image Placeholder */}
										<div className='w-full h-36 bg-[#F7F7F7] rounded-t-lg mb-2 relative overflow-hidden group-hover:bg-(--accent)/40 transition-all duration-300'>
											{item.img_url ? (
												<SafeImage
													src={item.img_url}
													alt={item.name}
													className=''
												/>
											) : (
												<div className='w-full h-full flex items-center justify-center'>
													<LogoIcon className='w-12 h-16 opacity-25' />
												</div>
											)}

											{/* Bundle Badge */}
											{isBundle && (
												<div className='absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-medium select-none'>
													Bundle
												</div>
											)}

											{/* Stock indicator badges */}
											{isOutOfStock && (
												<div className='absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg'>
													<span className='text-white text-xs sm:text-sm font-semibold select-none'>
														{isBundle ? 'UNAVAILABLE' : 'OUT OF STOCK'}
													</span>
												</div>
											)}
											{!isOutOfStock && !isBundle && availableStock <= 5 && (
												<div className='absolute top-2 right-2 bg-(--accent)/50 text-(--secondary)/50 text-xs px-2 py-1 rounded select-none'>
													Low Stock
												</div>
											)}
											{inCartQuantity > 0 && (
												<div className='absolute top-2 left-2 bg-(--accent)/50 text-(--secondary)/50 text-xs px-2 py-1 rounded flex items-center gap-1'>
													<svg
														className='w-3 h-3'
														fill='currentColor'
														viewBox='0 0 20 20'>
														<path d='M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z' />
													</svg>
													{inCartQuantity}
												</div>
											)}
											{!isBundle && (
												<div className='absolute bottom-2 left-2 rounded select-none'>
													<span
														className={`text-2.25 sm:text-2.5 text-primary bg-white px-2 py-1 rounded-full truncate max-w-[60%]`}
														style={{
															backgroundColor: getCategoryColor(item.category_id),
														}}>
														{isSearching
															? highlightSearchTerm(
																	getCategoryName(item.category_id),
																	searchQuery
															)
															: getCategoryName(item.category_id)}
													</span>
												</div>
											)}
											{isBundle && (
												<div className='absolute bottom-2 left-2 rounded select-none'>
													<span className='text-2.25 sm:text-2.5 text-white bg-amber-500 px-2 py-1 rounded-full'>
														Available: {availableStock}
													</span>
												</div>
											)}
										</div>

										{/* Item Details */}
										<div className='flex items-center justify-between mb-1 gap-2 pb-2 px-2'>
											<h3 className='font-semibold text-secondary truncate text-xs sm:text-sm'>
												{isSearching
													? highlightSearchTerm(item.name, searchQuery)
													: item.name}
											</h3>

											<span className='font-regular text-secondary text-xs sm:text-sm whitespace-nowrap'>
												{formatCurrency(item.price)}
											</span>
										</div>
									</div>
								);
							})}
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
							className='absolute top-0 right-0 bottom-0 w-full bg-primary flex flex-col shadow-2xl'>
							{/* Header with Close Button */}
							<div className='shrink-0 flex items-center justify-between p-4 border-b-2 border-accent'>
								<h2 className='text-xl font-bold text-secondary'>
									Current Order
								</h2>
								<button
									onClick={() => setShowOrderMenu(false)}
									className='w-10 h-10 flex items-center justify-center bg-(--light-accent) rounded-full hover:bg-accent transition-all'>
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
							<div className='shrink-0 h-16 p-3 border-b-2 border-accent'>
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
							<div className='flex-1 overflow-y-auto px-3 p-6'>
								{cart.length === 0 ? (
									<div className='flex flex-col items-center justify-center h-full py-12'>
										<div className='w-37.5 h-30 flex items-center justify-center mb-4 opacity-40'>
											<EmptyOrderIllustration />
										</div>
										<h3 className='text-lg font-medium text-secondary mb-2 select-none'>
											Order List is Empty
										</h3>
										<p className='text-secondary w-75 opacity-70 text-center max-w-sm text-sm leading-relaxed select-none'>
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
													className='flex flex-col items-center justify-around w-full h-32 bg-white overflow-hidden'>
													<div className='flex flex-row items-center gap-3 w-full h-25'>
														<div className='flex-none w-25.5 h-25 bg-[#F7F7F7] rounded-md relative overflow-hidden'>
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

														<div className='flex flex-col items-start gap-3 w-full h-25 grow'>
															<div className='flex flex-col items-start gap-2 w-full h-13.25 grow'>
																<div className='flex flex-row items-center justify-between gap-2 w-full h-5.25'>
																	<span className="font-normal text-base leading-5.25 text-[#4C2E24] font-['Poppins'] truncate">
																		{item.name}
																	</span>
																</div>
																<div className='flex flex-row items-center justify-between w-full h-5.25'>
																	<span className='space-x-2 flex items-center'>
																		<span className="font-normal text-sm leading-5.25 text-secondary font-['Poppins']">
																			{formatCurrency(item.price)}
																		</span>
																		<span className="font-bold text-sm text-shadow-lg leading-5.25 text-primary font-['Poppins'] bg-(--accent)/80 px-2 py-1 rounded-full min-w-6 text-center">
																			×{item.quantity}
																		</span>
																	</span>
																	<span className='space-x-2 flex items-center'>
																		<span className="font-normal text-sm leading-5.25 text-secondary font-['Poppins']">
																			=
																		</span>
																		<span className="font-bold text-sm leading-5.25 text-secondary font-['Poppins']">
																			{formatCurrency(
																				item.price * item.quantity
																			)}
																		</span>
																	</span>
																</div>

																{/* Bundle Component Details */}
																{item.type === 'bundle' && item.components && (
																	<div className='mt-1 p-2 bg-amber-50 rounded-lg border border-amber-200'>
																		<div className='text-xs font-medium text-amber-800 mb-1'>Bundle includes:</div>
																		<div className='space-y-0.5'>
																			{item.components.map((comp) => (
																				<div key={comp.id} className='flex justify-between text-xs text-gray-600'>
																					<span className='truncate flex-1'>
																						{comp.inventory_item?.name || 'Item'}
																					</span>
																					<span className='text-amber-600 font-medium ml-2'>
																						×{comp.quantity}
																					</span>
																				</div>
																			))}
																		</div>
																	</div>
																)}
															</div>

															<div className='flex flex-row justify-end items-end gap-3 w-full h-8.75'>
																<div className='flex flex-row justify-between items-center px-1.5 w-30 h-8.75 bg-(--light-accent) rounded-3xl'>
																	<button
																		onClick={() =>
																			updateQuantity(item.id, -1, item.type || 'item')
																		}
																		className='flex flex-col justify-center items-center p-1.5 gap-5 w-5.75 h-5.75 bg-white rounded-3xl hover:scale-110 hover:bg-accent transition-all'>
																		<MinusIcon />
																	</button>

																	<span className="font-bold text-base leading-5.25 text-secondary font-['Poppins']">
																		{item.quantity}
																	</span>

																	<button
																		onClick={() => updateQuantity(item.id, 1, item.type || 'item')}
																		className='flex flex-col justify-center items-center p-1.5 gap-5 w-5.75 h-5.75 bg-white rounded-3xl hover:scale-110 hover:bg-accent transition-all'>
																		<PlusIcon />
																	</button>
																</div>
															</div>
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
															className='flex h-px border border-b border-dashed border-(--secondary)/20 w-full'
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
								<div className='flex justify-between h-9.75 text-secondary text-3.5 font-medium px-3 py-1.5 items-end'>
									<span>Subtotal</span>
									<span>{formatCurrency(subtotal)}</span>
								</div>
								<div className='flex justify-between h-8.25 text-secondary text-3.5 font-medium px-3 py-1.5'>
									<span>Discount</span>
									<span>-{formatCurrency(discountAmount)}</span>
								</div>

								<div className='gap-2 p-3'>
									<DiscountDropdown
										value={discountCode}
										onChange={setDiscountCode}
										onDiscountApplied={handleDiscountApplied}
										subtotal={subtotal}
									/>
								</div>

								<div className='border-t border-dashed border-accent'>
									<div className='flex justify-between font-semibold text-lg h-15.5 p-3 items-center'>
										<span>Total</span>
										<span>{formatCurrency(total)}</span>
									</div>

									<div className='px-3 pb-3 flex gap-2'>
										{cart.length > 0 && (
											<button
												onClick={clearCart}
												className='flex-1 py-4 font-black text-3.5 text-(--error) bg-white border-2 border-(--error) rounded-lg hover:bg-(--error) hover:text-white transition-all'>
												CLEAR CART
											</button>
										)}
										<button
											onClick={handlePlaceOrder}
											disabled={cart.length === 0 || isPlacingOrder || !user}
											className={`flex-1 py-4 font-black text-3.5 rounded-lg transition-all ${
												cart.length === 0 || isPlacingOrder || !user
													? "bg-gray-300 text-primary cursor-not-allowed"
													: "bg-accent text-primary hover:bg-(--accent)/80 hover:shadow-lg cursor-pointer text-shadow-lg"
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
			<div className='hidden xl:flex flex-col h-screen shadow-lg bg-primary overflow-hidden w-90 shrink-0'>
				{/* Header Section - Fixed at top (154px total) */}
				<div className='shrink-0'>
					<div className='w-full h-22.5 bg-primary border-b border-(--secondary)/20 border-dashed'>
						{/* Order Header */}
						<div className='flex items-center gap-3 p-3'>
							<div className='bg-(--light-accent) w-16 h-16 rounded-full items-center justify-center flex relative'>
								<OrderCartIcon className="w-6 h-6"/>
								{cart.length > 0 && (
									<div className='absolute -top-1 -right-1 bg-accent text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center px-1'>
										{cart.reduce((sum, item) => sum + item.quantity, 0)}
									</div>
								)}
							</div>
							<div className='flex flex-1 flex-col items-center'>
								<span className='text-secondary font-medium text-4 self-start'>
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
									className='text-(--error) border border-(--error) hover:text-white text-xs font-medium hover:bg-(--error)/50 px-2 py-1 rounded transition-all'
									title='Clear all items'>
									Clear
								</button>
							)}
							<div className='hidden bg-(--light-accent) w-16 h-16 rounded-full'></div>
						</div>
					</div>

					<div className='h-16 p-3 border-b-2 border-accent'>
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
				<div className='flex-1 overflow-y-auto px-3 p-6'>
					{cart.length === 0 ? (
						<div className='flex flex-col items-center justify-center h-full py-12'>
							<div className='w-37.5 h-30 flex items-center justify-center mb-4 opacity-40'>
								<EmptyOrderIllustration />
							</div>
							<h3 className='text-lg font-medium text-secondary mb-2 select-none'>
								Order List is Empty
							</h3>
							<p className='text-secondary w-75 opacity-70 text-center max-w-sm text-sm leading-relaxed select-none'>
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
										className='flex flex-col items-center justify-around w-full h-32 bg-white overflow-hidden'>
										<div className='flex flex-row items-center gap-3 w-full h-25'>
											<div className='flex-none w-25.5 h-25 bg-[#F7F7F7] rounded-md relative overflow-hidden'>
												{item.imgUrl ? (
													<SafeImage src={item.imgUrl} alt={item.name} />
												) : null}
												{!item.imgUrl && (
													<div className='w-full h-full flex items-center justify-center'>
														<LogoIcon className='w-10 h-10 opacity-25' />
													</div>
												)}
											</div>

											<div className='flex flex-col items-start gap-3 w-69.5 h-25 grow'>
												{/* Item Info Section */}
												<div className='flex flex-col items-start gap-2 w-full h-13.25 grow'>
													{/* Title and Quantity Row */}
													<div className='flex flex-row items-center justify-between gap-2 w-full h-5.25'>
														<span className="font-normal text-base leading-5.25 text-[#4C2E24] font-['Poppins'] truncate">
															{item.name}
														</span>
													</div>
													{/* Price and Subtotal Row */}
													<div className='flex flex-row items-center justify-between w-full h-5.25'>
														<span className='space-x-2 flex items-center'>
															<span className="font-normal text-sm leading-5.25 text-secondary font-['Poppins']">
																{formatCurrency(item.price)}
															</span>
															<span className="font-bold text-sm text-shadow-lg leading-5.25 text-primary font-['Poppins'] bg-(--accent)/80 px-2 py-1 rounded-full min-w-6 text-center">
																×{item.quantity}
															</span>
														</span>
														<span className='space-x-2 flex items-center'>
															<span className="font-normal text-sm leading-5.25 text-secondary font-['Poppins']">
																=
															</span>
															<span className="font-bold text-sm leading-5.25 text-secondary font-['Poppins']">
																{formatCurrency(item.price * item.quantity)}
															</span>
														</span>
													</div>

													{/* Bundle Component Details */}
													{item.type === 'bundle' && item.components && (
														<div className='mt-1 p-2 bg-amber-50 rounded-lg border border-amber-200'>
															<div className='text-xs font-medium text-amber-800 mb-1'>Bundle includes:</div>
															<div className='space-y-0.5'>
																{item.components.map((comp) => (
																	<div key={comp.id} className='flex justify-between text-xs text-gray-600'>
																		<span className='truncate flex-1'>
																			{comp.inventory_item?.name || 'Item'}
																		</span>
																		<span className='text-amber-600 font-medium ml-2'>
																			×{comp.quantity}
																		</span>
																	</div>
																))}
															</div>
														</div>
													)}
												</div>

												{/* Controls Section */}
												<div className='flex flex-row justify-end items-end gap-3 w-full h-8.75'>
													{/* Quantity Controls */}
													<div className='flex flex-row justify-between items-center px-1.5 w-30 h-8.75 bg-(--light-accent) rounded-3xl'>
														<button
															onClick={() => updateQuantity(item.id, -1, item.type || 'item')}
															className='flex flex-col justify-center items-center p-1.5 gap-5 w-5.75 h-5.75 bg-white rounded-3xl hover:scale-110 hover:bg-accent transition-all'>
															<MinusIcon />
														</button>

														<span className="font-bold text-base leading-5.25 text-secondary font-['Poppins']">
															{item.quantity}
														</span>

														<button
															onClick={() => updateQuantity(item.id, 1, item.type || 'item')}
															className='flex flex-col justify-center items-center p-1.5 gap-5 w-5.75 h-5.75 bg-white rounded-3xl hover:scale-110 hover:bg-accent transition-all'>
															<PlusIcon />
														</button>
													</div>
												</div>
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
												className='flex h-px border border-b border-dashed border-(--secondary)/20 w-full'
											/>
										</AnimatePresence>
									</motion.div>
								))}
							</AnimatePresence>
						</div>
					)}
				</div>

				{/* Order Summary */}
				<div className='shrink mb-10 border-t-2 border-accent'>
					<div className='flex justify-between h-9.75 text-secondary text-3.5 font-medium px-3 py-1.5 items-end'>
						<span>Subtotal</span>
						<span>{formatCurrency(subtotal)}</span>
					</div>
					<div className='flex justify-between h-8.25 text-secondary text-3.5 font-medium px-3 py-1.5'>
						<span>Discount</span>
						<span>-{formatCurrency(discountAmount)}</span>
					</div>

					<div className='gap-2 p-3'>
						<DiscountDropdown
							value={discountCode}
							onChange={setDiscountCode}
							onDiscountApplied={handleDiscountApplied}
							subtotal={subtotal}
						/>
					</div>

					<div className='border-t border-dashed border-accent h-31'>
						<div className='flex justify-between font-semibold text-lg h-15.5 p-3 items-center'>
							<span>Total</span>
							<span>{formatCurrency(total)}</span>
						</div>

						{/* Place Order Button */}
						<button
							onClick={handlePlaceOrder}
							disabled={cart.length === 0 || isPlacingOrder || !user}
							className={`w-full py-4 font-black text-4.5 transition-all ${
								cart.length === 0 || isPlacingOrder || !user
									? "bg-gray-300 text-primary cursor-not-allowed"
									: "bg-accent text-primary hover:bg-(--accent)/80 hover:text-shadow-none hover:shadow-lg cursor-pointer text-shadow-lg"
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
						<div className='p-6 border-b border-gray-200'>
							<div className='flex items-center justify-between'>
								<h2 className='text-xl font-semibold text-secondary'>
									Confirm Order
								</h2>
								<button
									onClick={() => setShowOrderConfirmation(false)}
									className='text-gray-400 hover:text-secondary text-2xl'>
									×
								</button>
							</div>
							<p className='text-sm text-(--secondary)/80 mt-1'>
								Please review your order before confirming
							</p>
						</div>

						{/* Order Details */}
						<div className='flex-1 overflow-y-auto p-6'>
							{/* Order Type */}
							<div className='mb-4 flex justify-between text-3'>
								<span className='text-secondary font-medium'>
									Order Type:
								</span>
								<span className='font-medium'>{orderType}</span>
							</div>

							{/* Items List */}
							<div className='mb-4'>
								<h3 className='text-3 font-medium text-secondary mb-3'>
									Items ({cart.length})
								</h3>
								<div className='space-y-3'>
									{cart.map((item) => (
										<div
											key={item.id}
											className='flex items-center gap-3 p-3 bg-gray-50 rounded-lg'>
											{/* Item Image */}
											<div className='w-12 h-12 bg-gray-200 rounded-lg shrink-0 overflow-hidden relative'>
												{item.imgUrl ? (
													<SafeImage
														src={item.imgUrl}
														alt={item.name}
														className='w-full h-full object-cover'
													/>
												) : (
													<div className='w-full h-full flex items-center justify-center'>
														<svg
															className='w-6 h-6 text-gray-400'
															fill='currentColor'
															viewBox='0 0 20 20'>
															<path
																fillRule='evenodd'
																d='M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z'
																clipRule='evenodd'
															/>
														</svg>
													</div>
												)}
											</div>

											{/* Item Details */}
											<div className='flex-1 min-w-0'>
												<h4 className='font-medium text-secondary truncate'>
													{item.name}
												</h4>
												<p className='text-sm text-secondary'>
													{formatCurrency(item.price)}
												</p>
											</div>

											{/* Quantity and Total */}
											<div className='text-right'>
												<div className='text-sm font-medium text-(--secondary)/50'>
													Qty: {item.quantity}
												</div>
												<div className='text-sm font-regular text-secondary'>
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
									<div className='flex justify-between text-sm'>
										<span className='text-secondary'>Subtotal:</span>
										<span className='font-medium'>
											{formatCurrency(subtotal)}
										</span>
									</div>
									{discountAmount > 0 && (
										<div className='flex justify-between text-sm'>
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
									<div className='flex justify-between text-lg font-semibold border-t border-gray-200 pt-2'>
										<span>Total:</span>
										<span className='text-secondary'>
											{formatCurrency(total)}
										</span>
									</div>
								</div>
							</div>
						</div>

						{/* Modal Footer */}
						<div className='p-6 border-t border-gray-200 bg-gray-50'>
							<div className='flex gap-3'>
								<button
									onClick={() => setShowOrderConfirmation(false)}
									className='flex-1 px-4 py-3 text-sm text-(--secondary)/80 bg-white border border-(--secondary)/20 rounded-lg hover:bg-gray-50 hover:shadow-md transition-colors font-black'>
									CANCEL
								</button>
								<button
									onClick={confirmPlaceOrder}
									disabled={isPlacingOrder}
									className={`flex-1 px-4 py-3 rounded-lg text-sm font-black transition-all ${
										isPlacingOrder
											? "bg-(--secondary)/50 text-primary cursor-not-allowed"
											: "bg-accent text-shadow-md text-primary hover:bg-(--accent)/90 cursor-pointer hover:shadow-md"
									}`}>
									{isPlacingOrder ? "PROCESSING..." : "CONFIRM"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Success Toast Notification */}
			<SuccessToast
				show={showSuccessToast}
				onClose={handleCloseToast}
				orderId={successOrderId}
			/>

			<button
				onClick={() => setShowOrderMenu(!showOrderMenu)}
				className='flex xl:hidden justify-between items-center fixed bottom-6 left-0 right-0 mx-6 z-40 px-6 py-3 bg-accent text-primary rounded-full shadow-lg hover:shadow-xl hover:scale-101 transition-all font-medium text-sm gap-3'>
				<div className='flex-1 flex justify-between items-center text-primary'>
					<span className='text-sm'>
						{cart.length === 0
							? "No Items Selected"
							: `${cart.length} item${cart.length !== 1 ? "s" : ""}`}
					</span>
					<span className='text-sm text-primary font-semibold'>
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
