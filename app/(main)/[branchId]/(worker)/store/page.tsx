"use client";

import { useState, useEffect, useMemo } from "react";
import DropdownField from "@/components/DropdownField";
import TopBar from "@/components/TopBar";
import OrderCartIcon from "./icons/OrderCartIcon";
import type { InventoryItem, Category, Discount, BundleWithComponents, BundleComponent } from "@/types/domain";
import { subscribeToInventoryItems, getAvailableStock as getAvailableInventoryStock } from "@/services/inventoryService";
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
import { isDiscountEligible, calculateEligibleSubtotal, calculateDiscountAmount } from "@/services/discountService";
import {
	isCashierPriced,
	effectiveUnitPrice,
	wholePriceOf,
	isWholeLine,
	lineTotal,
} from "@/lib/pricing";
import { useCheckoutTotals } from "./useCheckoutTotals";
import { useCart } from "./useCart";
import type { DisplayItem } from "./checkoutTypes";
import StoreIcon from "@/components/icons/SidebarNav/StoreIcon";
import CategoryIcon from "@/components/CategoryIcon";
import { AnimatePresence, motion } from "motion/react";

import { formatCurrency } from "@/lib/currency_formatter";
import { formatReceiptWithLogo } from "@/lib/esc_formatter";
import { useBluetoothPrinter } from "@/contexts/BluetoothContext";

import { useTimeTracking, usePOSAccessControl } from "@/contexts/TimeTrackingContext";
import { useShift } from "@/contexts/ShiftContext";
import SafeDropModal from "@/components/shift/SafeDropModal";
import WriteOffModal from "@/components/shift/WriteOffModal";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import CustomBundlePickerModal, { type PickedItem } from "./CustomBundlePickerModal";
import B1T1PickerModal, { type B1T1PickedItem } from "./B1T1PickerModal";
import WildcardBundleModal, { type WildcardBundleResult } from "./WildcardBundleModal";

import AssortedKakaninModal, { type AssortedKakaninResult } from "./AssortedKakaninModal";

import FoodHouseModal, { type FoodHouseResult } from "./FoodHouseModal";
import CartItemEditor from "./CartItemEditor";
import CartLine from "./CartLine";
import HelpButton from "@/components/HelpButton";
import { storeSteps } from "@/components/TutorialSteps";

// Stable reference avoids DropdownField re-running its calcPosition effect each render.
const SPLIT_DROPDOWN_OFFSET = { top: 2, left: 0 };

// Pure pricing helpers live in lib/pricing.ts (unit-tested, no React/side effects).
// Re-export the line-level primitives under their original names so call sites below
// (isCashierPriced, lineTotal, …) stay unchanged.

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
				<button aria-label="Close"
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
	const shiftCtx = useShift();
	const [showSafeDropModal, setShowSafeDropModal] = useState(false);
	const [showWriteOffModal, setShowWriteOffModal] = useState(false);
	const [selectedCategory] = useState("All");
	const [selectedCategories] = useState<string[]>([]); // For multiple category filtering
	const [activeStoreCategory, setActiveStoreCategory] = useState<string | null>(null); // folder-directory: null = folder grid
	const [searchQuery, setSearchQuery] = useState("");
	const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [bundles, setBundles] = useState<BundleWithComponents[]>([]);
	const [bundleAvailability, setBundleAvailability] = useState<Map<string, number>>(new Map());
	const [loading, setLoading] = useState(true);
	const [hideOutOfStock, setHideOutOfStock] = useState(false);
	const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | 'grab' | 'debit_credit' | 'employee_charge' | 'split'>('cash');
	type SplitMethod = 'cash' | 'gcash' | 'debit_credit';
	const [splitMethod1, setSplitMethod1] = useState<SplitMethod>('cash');
	const [splitMethod2, setSplitMethod2] = useState<SplitMethod>('gcash');
	const [splitAmount1, setSplitAmount1] = useState("");
	const [splitAmount2, setSplitAmount2] = useState("");
	const [splitTxn1, setSplitTxn1] = useState("");
	const [splitTxn2, setSplitTxn2] = useState("");
	const [orderType, setOrderType] = useState<
		"DINE-IN" | "TAKE OUT" | "DELIVERY"
	>("TAKE OUT");
	const [discountCode, setDiscountCode] = useState("");
	const [discountAmount, setDiscountAmount] = useState(0);
	const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
	const [isPlacingOrder, setIsPlacingOrder] = useState(false);
	const [isClient, setIsClient] = useState(false);
	const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
	const [tenderedAmount, setTenderedAmount] = useState("");
	const [orderNote, setOrderNote] = useState("");
	const [gcashTransactionNumber, setGcashTransactionNumber] = useState("");
	const [debitReferenceNo, setDebitReferenceNo] = useState("");
	const [debitTransactionNo, setDebitTransactionNo] = useState("");
	const [debitApprovalCode, setDebitApprovalCode] = useState("");
	const [grabManualDiscount, setGrabManualDiscount] = useState("");
	// Cashier-entered manual discount (₱ off) for non-Grab payments. Exclusive with the DiscountDropdown.
	const [manualDiscount, setManualDiscount] = useState("");
	const [employeeChargeName, setEmployeeChargeName] = useState("");
	const [showSuccessToast, setShowSuccessToast] = useState(false);
	const [showOrderMenu, setShowOrderMenu] = useState<boolean>(false);
	const [successOrderId, setSuccessOrderId] = useState<string>("");
	const [customBundleTarget, setCustomBundleTarget] = useState<BundleWithComponents | null>(null);
	const [showWildcardModal, setShowWildcardModal] = useState(false);
	const [showAssortedModal, setShowAssortedModal] = useState(false);
	const [showFoodHouseModal, setShowFoodHouseModal] = useState(false);
	const [editingCartId, setEditingCartId] = useState<string | null>(null);
	const [editingGrabCartId, setEditingGrabCartId] = useState<string | null>(null);
	const {
		cart,
		setCart,
		getAvailableStock,
		addToCart,
		updateQuantity,
		removeFromCart,
		updateCartItemPricing,
		updateCartItemGrabPricing,
	} = useCart({ bundles, inventoryItems, onRequestCustomBundle: setCustomBundleTarget });
	const [b1t1PickerTarget, setB1T1PickerTarget] = useState<{ id: string; name: string; quantity: number } | null>(null);
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

	// Set up real-time subscription to inventory items
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

	// Set up real-time subscription to categories
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

	// Filter items based on selected categories and search query
	const filteredItems = inventoryItems.filter((item) => {
		// All category IDs this item belongs to (multi-category aware)
		const itemCategoryIds: string[] = item.category_ids?.length
			? item.category_ids
			: item.category_id ? [item.category_id] : [];

		// Hide items if all their categories are hidden (or they have no visible category)
		const isVisible = itemCategoryIds.length === 0
			? !categories.find(c => c.id === String(item.category_id))?.is_hidden
			: itemCategoryIds.some(catId => !categories.find(c => c.id === catId)?.is_hidden);

		// First apply search filter
		const matchesSearch =
			searchQuery === "" ||
			item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			itemCategoryIds.some(catId =>
				getCategoryName(catId).toLowerCase().includes(searchQuery.toLowerCase())
			);

		// Then apply category filter — item matches if any of its categories is selected
		const matchesCategory =
			selectedCategories.length === 0 ||
			selectedCategory === "All" ||
			itemCategoryIds.some(catId => selectedCategories.includes(getCategoryName(catId)));

		// Filter out out-of-stock items if hideOutOfStock is enabled
		const usableStock = getAvailableInventoryStock(item);
		const hasStock = hideOutOfStock ? usableStock > 0 : true;

		return isVisible && matchesSearch && matchesCategory && hasStock;
	});

	// Combine inventory items and bundles for display

	const displayItems: DisplayItem[] = useMemo(() => {
		const items: DisplayItem[] = filteredItems.map(item => ({
			...item,
			type: 'item' as const,
			availability: getAvailableInventoryStock(item)
		}));

		const bundleItems = bundles
			.filter(b => b.status === 'active')
			.map(bundle => ({
				id: bundle.id,
				name: bundle.name,
				price: bundle.price,
				grab_price: bundle.grab_price ?? null,
				img_url: bundle.img_url,
				description: bundle.description,
				type: 'bundle' as const,
				availability: bundleAvailability.get(bundle.id) || 0,
				components: bundle.components,
				is_custom: bundle.is_custom,
				max_pieces: bundle.max_pieces,
				category_id: bundle.category_id,
				category_ids: bundle.category_ids,
			}))
			.filter(bundle => {
				// All category IDs this bundle belongs to
				const bundleCategoryIds: string[] = bundle.category_ids?.length
					? bundle.category_ids
					: bundle.category_id ? [bundle.category_id] : [];

				// Hide bundles from categories marked as hidden
				const isVisible = bundleCategoryIds.length === 0
					? true
					: bundleCategoryIds.some(catId => !categories.find(c => c.id === catId)?.is_hidden);

				// Apply search filter
				const matchesSearch =
					searchQuery === "" ||
					bundle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					bundle.description?.toLowerCase().includes(searchQuery.toLowerCase());

				// Apply category filter — bundle matches if any of its categories is selected
				const matchesCategory =
					selectedCategories.length === 0 ||
					selectedCategory === "All" ||
					bundleCategoryIds.some(catId => selectedCategories.includes(getCategoryName(catId)));

				// Filter out unavailable bundles if hideOutOfStock is enabled
				const hasAvailability = hideOutOfStock ? bundle.availability > 0 : true;

				return isVisible && matchesSearch && matchesCategory && hasAvailability;
			});

		return [...items, ...bundleItems];
	}, [filteredItems, bundles, bundleAvailability, searchQuery, hideOutOfStock, selectedCategories, selectedCategory, categories, getCategoryName]);

	// Group displayItems by category for sectioned rendering
	const groupedItems = useMemo(() => {
		const categoryMap = new Map<string, DisplayItem[]>();
		displayItems.forEach(item => {
			const key = item.category_id ? String(item.category_id) : '__uncategorized__';
			if (!categoryMap.has(key)) categoryMap.set(key, []);
			categoryMap.get(key)!.push(item);
		});
		const groups: { id: string; name: string; color: string; icon?: string | null; items: DisplayItem[] }[] = [];
		categories.forEach(cat => {
			const items = categoryMap.get(String(cat.id)) || [];
			if (items.length > 0) groups.push({ id: String(cat.id), name: cat.name, color: cat.color?.trim() || '#9CA3AF', icon: cat.icon, items });
		});
		const uncategorized = categoryMap.get('__uncategorized__') || [];
		if (uncategorized.length > 0) groups.push({ id: '__uncategorized__', name: 'Uncategorized', color: '#9CA3AF', icon: null, items: uncategorized });
		return groups;
	}, [displayItems, categories]);

	// Determine if we're showing search results
	const isSearching = searchQuery.trim() !== "";

	// Folder-directory navigation for the store menu.
	const showFolders = !isSearching && activeStoreCategory === null;
	const activeGroup = activeStoreCategory ? groupedItems.find(g => g.id === activeStoreCategory) : null;
	const visibleGroups = isSearching ? groupedItems : (activeStoreCategory ? groupedItems.filter(g => g.id === activeStoreCategory) : []);

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


	const handleCustomBundleConfirm = (bundle: BundleWithComponents, selections: PickedItem[], overridePrice?: number) => {
		const cost = selections.reduce((s, p) => s + p.cost, 0);
		const pickedComponents: BundleComponent[] = selections.map(p => ({
			id: '',
			bundle_id: bundle.id,
			inventory_item_id: p.inventoryItemId,
			quantity: p.quantity,
			created_at: '',
			inventory_item: p.item,
		}));
		// Merge additional_items so they get stock-deducted on order
		const additionalAsComponents: BundleComponent[] = (bundle.additional_items ?? []).map(ai => ({
			id: ai.id,
			bundle_id: bundle.id,
			inventory_item_id: ai.inventory_item_id,
			quantity: ai.quantity,
			created_at: ai.created_at,
			inventory_item: ai.inventory_item,
		}));
		const components = [...pickedComponents, ...additionalAsComponents];
		const finalPrice = overridePrice !== undefined ? overridePrice : bundle.price;
		setCart(prev => [...prev, {
			id: `${bundle.id}_custom_${Date.now()}`,
			bundleId: bundle.id,
			name: bundle.name,
			price: finalPrice,
			grab_price: overridePrice !== undefined ? overridePrice : (bundle.grab_price ?? null),
			cost,
			quantity: 1,
			originalStock: 999,
			imgUrl: bundle.img_url ?? undefined,
			categoryId: 0,
			categoryIds: bundle.category_id ? [bundle.category_id] : [],
			type: 'bundle',
			is_custom: true,
			isPriceOverride: overridePrice !== undefined,
			originalPrice: overridePrice !== undefined ? bundle.price : undefined,
			components,
		}]);
		setCustomBundleTarget(null);
	};

	const handleWildcardConfirm = (result: WildcardBundleResult) => {
		const cost = result.selections.reduce((s, p) => s + p.cost, 0);
		const components: BundleComponent[] = result.selections.map(p => ({
			id: '',
			bundle_id: '',
			inventory_item_id: p.inventoryItemId,
			quantity: p.quantity,
			created_at: '',
			inventory_item: p.item,
		}));
		setCart(prev => [...prev, {
			id: `wildcard_${Date.now()}_${Math.random().toString(36).slice(2)}`,
			bundleId: null,
			name: `Wildcard Bilao ${result.sizeLabel} (${result.maxPieces} pcs)`,
			price: result.sellingPrice,
			grab_price: result.grabPrice,
			cost,
			quantity: 1,
			originalStock: 999,
			imgUrl: undefined,
			categoryId: 0,
			categoryIds: [],
			type: 'bundle',
			is_custom: true,
			components,
		}]);
		setShowWildcardModal(false);
	};

	const handleAssortedConfirm = (result: AssortedKakaninResult) => {
		// Kakanin cost + the container's own cost (container decrements stock too).
		const cost =
			result.selections.reduce((s, p) => s + p.cost, 0) + (result.container.cost ?? 0);
		// Container is a component (qty 1) so its stock deducts alongside the kakanin.
		const components: BundleComponent[] = [
			{
				id: '',
				bundle_id: '',
				inventory_item_id: result.container.id,
				quantity: 1,
				created_at: '',
				inventory_item: result.container,
			},
			...result.selections.map(p => ({
				id: '',
				bundle_id: '',
				inventory_item_id: p.inventoryItemId,
				quantity: p.quantity,
				created_at: '',
				inventory_item: p.item,
			})),
		];
		setCart(prev => [...prev, {
			id: `assorted_${Date.now()}_${Math.random().toString(36).slice(2)}`,
			bundleId: null,
			name: `Assorted Kakanin — ${result.container.name}`,
			price: result.sellingPrice,
			grab_price: result.grabPrice,
			cost,
			quantity: 1,
			originalStock: 999,
			imgUrl: result.container.img_url ?? undefined,
			categoryId: 0,
			categoryIds: [],
			type: 'bundle',
			is_custom: true,
			// Whole-priced: the cashier's price is the exact line total, never × quantity.
			priceMode: 'whole',
			wholePrice: result.sellingPrice,
			components,
		}]);
		setShowAssortedModal(false);
	};

	const handleFoodHouseConfirm = (result: FoodHouseResult) => {
		// Made-to-order dish: the dish itself is never stocked, so it is NOT a
		// component (no stock draw-down). Only the chosen container deducts.
		const components: BundleComponent[] = result.container
			? [{
				id: '',
				bundle_id: '',
				inventory_item_id: result.container.id,
				quantity: 1,
				created_at: '',
				inventory_item: result.container,
			}]
			: [];
		const cost = result.container?.cost ?? 0; // per-order cost; scales with quantity
		const name = result.container
			? `${result.dish.name} — ${result.container.name}`
			: `${result.dish.name} (Solo)`;
		setCart(prev => [...prev, {
			id: `foodhouse_${Date.now()}_${Math.random().toString(36).slice(2)}`,
			bundleId: null,
			name,
			// Per-order (not whole): the typed price is the unit price, so the line
			// total is price × quantity and the container deducts per order.
			price: result.sellingPrice,
			grab_price: result.grabPrice,
			cost,
			quantity: Math.max(1, result.quantity),
			originalStock: 999,
			imgUrl: result.dish.img_url ?? undefined,
			categoryId: 0,
			categoryIds: [],
			type: 'bundle',
			is_custom: true,
			isFoodHouse: true,
			components,
		}]);
		setShowFoodHouseModal(false);
	};

	const handleB1T1Confirm = (selections: B1T1PickedItem[], b1t1Price: number) => {
		const newItems = selections.map(s => ({
			id: `b1t1_${s.inventoryItemId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
			name: s.itemName,
			price: b1t1Price,
			grab_price: b1t1Price,
			cost: s.item.cost ?? undefined,
			quantity: s.quantity,
			originalStock: getAvailableInventoryStock(s.item),
			imgUrl: s.itemImgUrl ?? undefined,
			categoryId: s.item.category_id ?? "",
			categoryIds: s.item.category_ids?.length ? s.item.category_ids : s.item.category_id ? [s.item.category_id] : [],
			type: 'item' as const,
			isB1T1: true,
			regularPrice: s.regularPrice,
		}));
		setCart(prev => [...prev, ...newItems]);
		setB1T1PickerTarget(null);
	};

	// All derived money figures (subtotal, discounts, total, split validation) come
	// from the pure useCheckoutTotals hook wrapping lib/pricing — see checkoutTypes.ts.
	const {
		subtotal,
		manualDiscountAmount,
		displayDiscount,
		total,
		unpricedItemCount,
		splitAmount1Num,
		splitAmount2Num,
		splitSum,
		splitDiff,
		splitValid,
	} = useCheckoutTotals({
		cart,
		paymentMethod,
		grabManualDiscount,
		manualDiscount,
		appliedDiscount,
		discountAmount,
		splitAmount1,
		splitAmount2,
		splitMethod1,
		splitMethod2,
	});


	// Auto-clear applied discount when cart changes and discount is no longer eligible
	useEffect(() => {
		if (!appliedDiscount) return;
		const cartItemsForDiscount = cart.map(i => ({
			// Whole-priced lines: collapse to a single unit at the absolute total so the
			// discount math sees the exact line amount (no per-piece rounding drift).
			price: i.priceMode === 'whole' && i.wholePrice != null ? i.wholePrice : i.price,
			quantity: i.priceMode === 'whole' && i.wholePrice != null ? 1 : i.quantity,
			categoryIds: i.categoryIds ?? (i.categoryId && i.categoryId !== 0 ? [String(i.categoryId)] : []),
		}));
		if (!isDiscountEligible(appliedDiscount, cartItemsForDiscount)) {
			setAppliedDiscount(null);
			setDiscountAmount(0);
			setDiscountCode("");
			// Remove B1T1 take-1 items if discount cleared
			setCart(prev => prev.filter(i => !i.isB1T1));
		}
	}, [cart, appliedDiscount]);

	// Recalculate discount amount when payment method changes (e.g. Grab uses grab_price).
	// Grab has its own flow: clear any applied Discount object + B1T1 items and let the
	// cashier type the manual discount amount instead.
	useEffect(() => {
		if (paymentMethod === 'grab') {
			setAppliedDiscount(null);
			setDiscountAmount(0);
			setDiscountCode("");
			setCart(prev => prev.filter(i => !i.isB1T1));
			return;
		}
		// Switching away from Grab — reset the manual discount input.
		setGrabManualDiscount("");
		if (!appliedDiscount || appliedDiscount.type === 'b1t1') return;
		const cartItemsForDiscount = cart.map(i => ({
			// Whole-priced lines: collapse to a single unit at the absolute total so the
			// discount math sees the exact line amount (no per-piece rounding drift).
			price: i.priceMode === 'whole' && i.wholePrice != null ? i.wholePrice : i.price,
			quantity: i.priceMode === 'whole' && i.wholePrice != null ? 1 : i.quantity,
			categoryIds: i.categoryIds ?? (i.categoryId && i.categoryId !== 0 ? [String(i.categoryId)] : []),
		}));
		const sub = calculateEligibleSubtotal(appliedDiscount, cartItemsForDiscount);
		setDiscountAmount(calculateDiscountAmount(appliedDiscount, sub, cartItemsForDiscount));
	}, [paymentMethod]);

	// Initialize split amounts when entering split mode; clear when leaving.
	useEffect(() => {
		if (paymentMethod === 'split') {
			const half = Math.round((total / 2) * 100) / 100;
			setSplitAmount1(half ? half.toFixed(2) : "");
			setSplitAmount2(half ? (total - half).toFixed(2) : "");
		} else {
			setSplitAmount1("");
			setSplitAmount2("");
			setSplitTxn1("");
			setSplitTxn2("");
		}
	}, [paymentMethod]); // eslint-disable-line react-hooks/exhaustive-deps

	// Handle discount application
	const handleDiscountApplied = (discount: Discount | null, amount: number) => {
		setAppliedDiscount(discount);
		setDiscountAmount(amount);
		// Exclusive with the manual discount: picking a dropdown discount clears any typed manual amount.
		if (discount) setManualDiscount("");
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

	// Manual discount input handler. Only accepts a numeric ₱ amount, and applying it
	// clears any dropdown discount / B1T1 items so the two never stack.
	const handleManualDiscountChange = (v: string) => {
		if (!/^\d*\.?\d*$/.test(v)) return;
		setManualDiscount(v);
		if (parseFloat(v) > 0 && (appliedDiscount || discountAmount > 0)) {
			setAppliedDiscount(null);
			setDiscountAmount(0);
			setDiscountCode("");
			setCart(prev => prev.filter(i => !i.isB1T1));
		}
	};

	// Function to clear the cart
	const clearCart = () => {
		setCart([]);
		setDiscountCode("");
		setDiscountAmount(0);
		setAppliedDiscount(null);
		setManualDiscount("");
		setB1T1PickerTarget(null);
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

	const buildSplitPaymentDetails = (): Record<string, string> => {
		const d: Record<string, string> = {
			split_method_1: splitMethod1,
			split_amount_1: splitAmount1Num.toFixed(2),
			split_method_2: splitMethod2,
			split_amount_2: splitAmount2Num.toFixed(2),
		};
		if (splitTxn1.trim()) d.split_txn_1 = splitTxn1.trim();
		if (splitTxn2.trim()) d.split_txn_2 = splitTxn2.trim();
		return d;
	};

	// Function to confirm and actually place the order
	const confirmPlaceOrder = async () => {
		if (cart.length === 0 || isPlacingOrder || !user || !currentBranch) return;
		if (paymentMethod === 'split' && !splitValid) return;
		setIsPlacingOrder(true);
		try {
			// Create order using the new service signature
			const orderDiscountAmount = displayDiscount;
			const { id: orderId, orderNumber: orderNum, error: orderError } = await createOrder(
				currentBranch.id,
				user.id,
				cart.map((item) => ({
					id: item.id,
					bundleId: item.bundleId,
					name: item.name,
					price: effectiveUnitPrice(item, paymentMethod),
					cost: item.cost || 0,
					quantity: item.quantity,
					line_total: isWholeLine(item, paymentMethod) ? (wholePriceOf(item, paymentMethod) as number) : null,
					is_whole_priced: isWholeLine(item, paymentMethod),
					imgUrl: item.imgUrl || "",
					categoryId: item.categoryId || "",
					originalStock: item.originalStock,
					type: item.type,
					components: item.components,
					isPriceOverride: item.isPriceOverride,
					originalPrice: item.originalPrice,
				})),
				subtotal,
				total,
				paymentMethod === 'grab' ? undefined : appliedDiscount?.id,
				orderDiscountAmount,
				paymentMethod,
				paymentMethod === 'cash' ? orderNote : undefined,
				paymentMethod === 'gcash' || paymentMethod === 'grab' ? gcashTransactionNumber : undefined,
				paymentMethod === 'debit_credit'
					? { reference_no: debitReferenceNo, transaction_no: debitTransactionNo, approval_code: debitApprovalCode }
					: paymentMethod === 'employee_charge'
					? { employee_name: employeeChargeName }
					: paymentMethod === 'split'
					? buildSplitPaymentDetails()
					: null
			);

			if (orderError) {
				throw new Error(orderError);
			}

			if (!orderId) {
				throw new Error("Order ID not returned");
			}

			// Prepare receipt data for printing
			const receiptData = {
				orderId: orderNum || orderId,
				date: new Date(),
				items: cart.map((item) => {
					const itemPrice = effectiveUnitPrice(item, paymentMethod);
					return {
						name: item.isB1T1 ? `${item.name} [B1T1]` : item.name,
						qty: item.quantity,
						price: itemPrice,
						// Whole-priced lines print the exact absolute total, never itemPrice × qty.
						total: lineTotal(item, paymentMethod),
						isPriceOverride: item.isPriceOverride,
						originalPrice: item.originalPrice,
					};
				}),
				subtotal,
				discount: displayDiscount,
				appliedDiscountCode: paymentMethod === 'grab'
					? ""
					: (manualDiscountAmount > 0 ? "Manual Discount" : (appliedDiscount?.name || "")),
				isB1T1Promo: paymentMethod === 'grab' ? false : (manualDiscountAmount === 0 && appliedDiscount?.type === 'b1t1'),
				discountType: paymentMethod === 'grab'
					? undefined
					: (manualDiscountAmount > 0 ? 'fixed' : appliedDiscount?.type),
				grabUplift: 0,
				total,
				payment: paymentMethod === 'cash' ? (parseFloat(tenderedAmount) || total) : total,
				change: paymentMethod === 'cash' ? Math.max(0, (parseFloat(tenderedAmount) || total) - total) : 0,
				cashier:
					user?.display_name?.trim() ||
					user?.name?.trim().split(' ')[0] ||
					timeTracking.worker?.name ||
					user?.email ||
					"Unknown Worker",
				cashierEmployeeId: timeTracking.worker?.employeeId || user.uid,
				storeName: "FREDELECACIES",
				branchName: currentBranch.name,
				paymentMethod,
				orderType,
				transactionNumber: (paymentMethod === 'gcash' || paymentMethod === 'grab') ? gcashTransactionNumber : undefined,
				paymentDetails: (paymentMethod === 'debit_credit'
					? { reference_no: debitReferenceNo, transaction_no: debitTransactionNo, approval_code: debitApprovalCode }
					: paymentMethod === 'employee_charge'
					? { employee_name: employeeChargeName }
					: paymentMethod === 'split'
					? buildSplitPaymentDetails()
					: undefined) as Record<string, string> | undefined,
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
			setB1T1PickerTarget(null);
			setPaymentMethod('cash');
			setTenderedAmount("");
			setOrderNote("");
			setGcashTransactionNumber("");
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
			<div className='flex flex-col flex-1 min-w-0 h-full overflow-hidden'>

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
							rightAction={<HelpButton variant='page' steps={storeSteps} />}
						/>
					</div>
					{/* Desktop TopBar - visible at xl: breakpoint and above (≥ 1280px) */}
					<div className='hidden xl:block w-full'>
						<TopBar
							title='Store'
							icon={<StoreIcon />}
							showTimeTracking={true}
							rightAction={<HelpButton variant='page' steps={storeSteps} />}
						/>
					</div>
				</div>{" "}

				{/* Search Section - Fixed */}
				<div className={`px-4 py-2 ${!canAccessPOS && !timeTracking.loading ? "blur-[1px] pointer-events-none" : ""}`}>
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
				<div className={`flex items-center justify-between px-4 py-1 ${!canAccessPOS && !timeTracking.loading ? "blur-[1px] pointer-events-none" : ""}`}>
					<div className='flex flex-col'>
						<h2 className='text-secondary font-bold'>
							{isSearching ? "Search Results" : ""}
						</h2>
						{isSearching && (
							<p className='text-xs text-secondary opacity-60'>
								Searching for "{searchQuery}"
							</p>
						)}
					</div>
				</div>

				{/* Category selection now uses the folder grid below */}

				{/* Menu Items - Scrollable */}
				<div className={`flex-1 overflow-y-auto px-4 py-4 ${!canAccessPOS && !timeTracking.loading ? "blur-[1px] pointer-events-none" : ""}`}>
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
							<div className='w-14 h-14 rounded-full border border-accent/30 flex items-center justify-center text-accent mb-4'>
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
						{showFolders && (
        <>
        {/* Build-your-own quick actions */}
						<div className='grid grid-cols-1 sm:grid-cols-3 gap-2'>
							{/* Wildcard Bilao quick-action */}
							<button
								type='button'
								onClick={() => setShowWildcardModal(true)}
								className='group relative rounded-xl border border-bundle/30 bg-bundle/5 hover:border-bundle hover:bg-bundle/10 hover:shadow-md active:scale-[0.98] transition-all duration-200 flex flex-row items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bundle'>
								<div className='w-11 h-11 shrink-0 rounded-full bg-bundle/10 group-hover:bg-bundle/15 flex items-center justify-center text-bundle transition-colors duration-200'>
									<svg className='w-6 h-6 group-hover:rotate-3 transition-transform duration-300' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round'>
										<circle cx='10.5' cy='10.5' r='8' strokeWidth={1.5} />
										<circle cx='10.5' cy='6.4' r='1.5' fill='currentColor' stroke='none' />
										<circle cx='6.9' cy='12.6' r='1.5' fill='currentColor' stroke='none' />
										<circle cx='14.1' cy='12.6' r='1.5' fill='currentColor' stroke='none' />
										<circle cx='18' cy='18' r='4.3' fill='currentColor' stroke='var(--primary)' strokeWidth={1.5} />
										<path d='M18 16.1v3.8M16.1 18h3.8' stroke='var(--primary)' strokeWidth={1.6} />
									</svg>
								</div>
								<span className='text-sm font-bold text-bundle leading-tight'>Wildcard Bilao</span>
							</button>

							{/* Assorted Kakanin quick-action */}
							<button
								type='button'
								onClick={() => setShowAssortedModal(true)}
								className='group relative rounded-xl border border-bundle/30 bg-bundle/5 hover:border-bundle hover:bg-bundle/10 hover:shadow-md active:scale-[0.98] transition-all duration-200 flex flex-row items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bundle'>
								<div className='w-11 h-11 shrink-0 rounded-full bg-bundle/10 group-hover:bg-bundle/15 flex items-center justify-center text-bundle transition-colors duration-200'>
									<svg className='w-6 h-6 group-hover:rotate-3 transition-transform duration-300' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={1.5} strokeLinecap='round' strokeLinejoin='round'>
										<ellipse cx='12' cy='14' rx='9' ry='6' />
										<ellipse cx='12' cy='12' rx='9' ry='6' />
										<circle cx='9' cy='11.5' r='1.2' fill='currentColor' stroke='none' />
										<circle cx='13' cy='10.5' r='1.2' fill='currentColor' stroke='none' />
										<circle cx='15.5' cy='13' r='1.2' fill='currentColor' stroke='none' />
										<circle cx='10' cy='13.5' r='1.2' fill='currentColor' stroke='none' />
									</svg>
								</div>
								<span className='text-sm font-bold text-bundle leading-tight'>Assorted Kakanin</span>
							</button>

								{/* Food House quick-action */}
								<button
									type='button'
									onClick={() => setShowFoodHouseModal(true)}
									className='group relative rounded-xl border border-bundle/30 bg-bundle/5 hover:border-bundle hover:bg-bundle/10 hover:shadow-md active:scale-[0.98] transition-all duration-200 flex flex-row items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bundle'>
									<div className='w-11 h-11 shrink-0 rounded-full bg-bundle/10 group-hover:bg-bundle/15 flex items-center justify-center text-bundle transition-colors duration-200'>
										<svg className='w-6 h-6 group-hover:rotate-3 transition-transform duration-300' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={1.6} strokeLinecap='round' strokeLinejoin='round'>
											<path d='M4 3v7a3 3 0 003 3v8M7 3v5M10 3v5M17 3c-1.5 1.5-2 4-2 7s.5 4 2 4v7' />
										</svg>
									</div>
									<span className='text-sm font-bold text-bundle leading-tight'>Food House</span>
								</button>
						</div>

						{/* Category folders */}
        <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2'>
          {groupedItems.map(group => (
            <button key={group.id} onClick={() => setActiveStoreCategory(group.id)}
              className='group relative aspect-square rounded-xl border-2 border-gray-200 bg-primary hover:border-accent hover:shadow-md active:scale-95 transition-all duration-200 flex flex-col items-center justify-center gap-2 p-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'>
              {group.icon ? (
                <span className='shrink-0' style={{ color: group.color }}><CategoryIcon icon={group.icon} className='w-11 h-11 sm:w-12 sm:h-12' /></span>
              ) : (
                <span className='w-6 h-1.5 rounded-full shrink-0' style={{ backgroundColor: group.color }} />
              )}
              <span className='text-3.5 font-semibold text-secondary leading-tight line-clamp-3'>{group.name}</span>
              <span className='text-2.5 text-secondary/40 tabular-nums'>{group.items.length} {group.items.length === 1 ? 'item' : 'items'}</span>
            </button>
          ))}
        </div>
        </>
        )}
        {activeStoreCategory && !isSearching && (
          <div className='flex items-center gap-3'>
            <button onClick={() => setActiveStoreCategory(null)} aria-label='Back to categories' title='Back to categories'
              className='h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-400 transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'>
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' /></svg>
            </button>
            <nav aria-label='Breadcrumb' className='flex items-center gap-1.5 min-w-0'>
              <button onClick={() => setActiveStoreCategory(null)} className='shrink-0 text-2.5 font-bold uppercase tracking-wide text-secondary/45 hover:text-secondary transition-colors'>Menu</button>
              <svg className='w-3 h-3 shrink-0 text-secondary/30' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' /></svg>
              <span className='w-1.5 h-1.5 rounded-full shrink-0' style={{ backgroundColor: activeGroup?.color ?? '#9CA3AF' }} />
              <span className='text-sm font-bold text-secondary truncate'>{activeGroup?.name ?? 'Category'}</span>
            </nav>
          </div>
        )}

        {visibleGroups.map(group => (
							<div key={group.id}>
								{isSearching && (
<div className='flex items-center gap-2 mb-2'>
									<span className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: group.color }} />
									<span className='text-2.5 font-bold text-secondary/60 uppercase tracking-widest'>{group.name}</span>
									<span className='inline-flex items-center justify-center w-4 h-4 rounded-full bg-secondary/10 text-secondary/40 text-[9px] font-medium'>{group.items.length}</span>
								</div>
)}
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
														<div className='absolute top-1.5 right-1.5 bg-accent text-primary text-xs min-w-5 h-5 px-2 rounded-full flex items-center justify-center font-bold select-none'>
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
														{isBundle ? (
															<span className='text-accent font-bold text-xs'>
																{formatCurrency(item.price)}
															</span>
														) : (
															<span />
														)}
														{isBundle && item.is_custom ? (
															<span className='text-xs font-medium px-1.5 py-0.5 rounded select-none bg-bundle/10 text-bundle'>
																Mix & Match
															</span>
														) : !isOutOfStock && (
															<span className={`text-xs font-medium px-1.5 py-0.5 rounded select-none ${availableStock < 10 ? "bg-error/10 text-error" :stockColor}`}>
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
								<button aria-label="Close"
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
							<div className='shrink-0 p-2 border-b border-gray-100'>
								<div className='flex items-center justify-between bg-background rounded-3xl gap-3'>
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

							{/* Shift Actions (Mobile) */}
							{shiftCtx.hasActiveShift && !shiftCtx.isExempt && (
								<div className='flex gap-2 px-3 py-2 border-b border-gray-100'>
									<button
										onClick={() => { setShowOrderMenu(false); setShowSafeDropModal(true); }}
										className='flex-1 py-2 text-xs font-bold rounded-lg bg-accent/10 text-accent border border-accent/30 hover:bg-accent hover:text-primary transition-all'
									>
										Safe Drop
									</button>
									<button
										onClick={() => { setShowOrderMenu(false); setShowWriteOffModal(true); }}
										className='flex-1 py-2 text-xs font-bold rounded-lg bg-error/10 text-error border border-error/30 hover:bg-error hover:text-primary transition-all'
									>
										Write Off
									</button>
								</div>
							)}

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
													<CartLine
											item={item}
											openable={isCashierPriced(item)}
											expanded={expandedBundles.has(item.id)}
											showB1T1={appliedDiscount?.type === 'b1t1' && !item.isB1T1 && !item.is_custom}
											onOpen={() => setEditingCartId(item.id)}
											onDec={() => updateQuantity(item.id, -1, item.type || 'item')}
											onInc={() => updateQuantity(item.id, 1, item.type || 'item')}
											onRemove={() => removeFromCart(item.id)}
											onToggleExpand={() => toggleBundle(item.id)}
											onMarkB1T1={() => setB1T1PickerTarget({ id: item.id, name: item.name, quantity: item.quantity })}
										/>
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
							<div className='shrink-0 border-t-2 border-accent pb-[max(1rem,env(safe-area-inset-bottom))]'>
								<div className='flex justify-between h-9.75 text-secondary text-3 font-medium px-3 py-1.5 items-end'>
									<span>Subtotal</span>
									<span>{formatCurrency(subtotal)}</span>
								</div>
								<div className='flex justify-between h-8.25 text-secondary text-3 font-medium px-3 py-1.5'>
									<span>{appliedDiscount?.type === 'b1t1' ? 'B1T1 Savings' : 'Discount'}</span>
									<span>-{formatCurrency(displayDiscount)}</span>
								</div>

								{paymentMethod !== 'grab' && (
									<div className='gap-2 p-2'>
										<DiscountDropdown
											value={discountCode}
											onChange={setDiscountCode}
											onDiscountApplied={handleDiscountApplied}
											cartItems={cart.map(i => ({ price: i.price, quantity: i.quantity, categoryIds: i.categoryIds ?? (i.categoryId && i.categoryId !== 0 ? [String(i.categoryId)] : []) }))}
										/>
									</div>
								)}

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
			<div className='hidden xl:flex flex-col h-full bg-primary border-l border-gray-200 overflow-hidden w-110 shrink-0'>
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

					<div className='p-2 border-b border-accent'>
						<div className='flex items-center justify-between bg-background rounded-3xl gap-3'>
							<DropdownField
								options={["DINE-IN", "TAKE OUT", "DELIVERY"]}
								defaultValue='TAKE OUT'
								dropdownPosition='bottom-right'
								dropdownOffset={{ top: 2, right: 0 }}
								onChange={(value) =>
									setOrderType(value as "DINE-IN" | "TAKE OUT" | "DELIVERY")
								}
								roundness={"full"}
								valueAlignment={"left"}
                height={32}
								padding=''
								shadow={false}
							/>
						</div>
					</div>

					{/* Shift Actions */}
					{shiftCtx.hasActiveShift && !shiftCtx.isExempt && (
						<div className='flex gap-2 p-2 border-b border-gray-100'>
							<button
								onClick={() => setShowSafeDropModal(true)}
								className='flex-1 py-2 text-xs font-bold rounded-lg bg-accent/10 text-accent border border-accent/30 hover:bg-accent hover:text-primary transition-all'
							>
								Safe Drop
							</button>
							<button
								onClick={() => setShowWriteOffModal(true)}
								className='flex-1 py-2 text-xs font-bold rounded-lg bg-error/10 text-error border border-error/30 hover:bg-error hover:text-primary transition-all'
							>
								Write Off
							</button>
						</div>
					)}
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
										<CartLine
											item={item}
											openable={isCashierPriced(item)}
											expanded={expandedBundles.has(item.id)}
											showB1T1={appliedDiscount?.type === 'b1t1' && !item.isB1T1 && !item.is_custom}
											onOpen={() => setEditingCartId(item.id)}
											onDec={() => updateQuantity(item.id, -1, item.type || 'item')}
											onInc={() => updateQuantity(item.id, 1, item.type || 'item')}
											onRemove={() => removeFromCart(item.id)}
											onToggleExpand={() => toggleBundle(item.id)}
											onMarkB1T1={() => setB1T1PickerTarget({ id: item.id, name: item.name, quantity: item.quantity })}
										/>
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
				<div className='shrink-0 border-t-2 border-accent'>
					<div className='flex justify-between h-9.75 text-secondary text-3 font-medium px-3 py-1.5 items-end'>
						<span>Subtotal</span>
						<span>{formatCurrency(subtotal)}</span>
					</div>
					<div className='flex justify-between h-8.25 text-secondary text-3 font-medium px-3 py-1.5'>
						<span>{appliedDiscount?.type === 'b1t1' ? 'B1T1 Savings' : 'Discount'}</span>
						<span>-{formatCurrency(displayDiscount)}</span>
					</div>

					{paymentMethod !== 'grab' && (
						<div className='gap-2 p-2'>
							<DiscountDropdown
								value={discountCode}
								onChange={setDiscountCode}
								onDiscountApplied={handleDiscountApplied}
								cartItems={cart.map(i => ({ price: i.price, quantity: i.quantity, categoryIds: i.categoryIds ?? (i.categoryId && i.categoryId !== 0 ? [String(i.categoryId)] : []) }))}
							/>
						</div>
					)}

					<div className='border-t border-dashed border-accent mb-4'>
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
					<div className='bg-white rounded-lg max-w-md w-full max-h-[80dvh] overflow-hidden flex flex-col'>
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

							{/* Payment Method */}
							<div className='mb-4'>
								<span className='text-xs font-medium text-secondary block mb-2'>
									Payment Method:
								</span>
								<div className='flex flex-wrap gap-2'>
									{(['cash', 'gcash', 'grab', 'debit_credit', 'employee_charge', 'split'] as const).map((method) => {
										const grabDisabled = method === 'grab' && cart.length === 0;
										const label = method === 'cash' ? 'Cash' : method === 'gcash' ? 'GCash' : method === 'grab' ? 'Grab' : method === 'debit_credit' ? 'Debit/Credit' : method === 'employee_charge' ? 'Employee Charge' : 'Split';
										return (
										<button
											key={method}
											onClick={() => !grabDisabled && setPaymentMethod(method)}
											disabled={grabDisabled}
											className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
												grabDisabled
													? 'bg-gray-100 text-secondary/30 border-gray-200 cursor-not-allowed'
													: paymentMethod === method
													? 'bg-accent text-primary border-accent'
													: 'bg-white text-secondary border-gray-200 hover:border-secondary/40'
											}`}>
											{label}
										</button>
										);
									})}
								</div>
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
												<div className='flex items-center gap-1.5 flex-wrap'>
													{paymentMethod === 'grab' && isCashierPriced(item) ? (
														<button
															type='button'
															onClick={() => setEditingGrabCartId(item.id)}
															className='inline-flex items-center gap-1 rounded-md px-1 -mx-1 py-0.5 hover:bg-[#02B150]/10 transition-colors'
														>
															<span className='text-[9px] font-semibold text-[#02B150]'>Grab</span>
															{item.grab_price ? (
																<>
																	<span className='text-xs text-secondary'>
																		{formatCurrency(isWholeLine(item, 'grab') ? (item.grabWholePrice as number) : item.grab_price)}
																	</span>
																	{isWholeLine(item, 'grab') && (
																		<span className='text-[9px] font-semibold px-1 py-0.5 rounded bg-[#02B150]/10 text-[#02B150]'>Whole</span>
																	)}
																</>
															) : (
																<span className='text-xs text-[#02B150] font-medium'>Set price</span>
															)}
															<svg className='w-3 h-3 text-[#02B150]/60' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth={2}><path strokeLinecap='round' strokeLinejoin='round' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' /></svg>
														</button>
													) : (
														<>
															<p className='text-xs text-secondary'>
																{formatCurrency(paymentMethod === 'grab' && item.grab_price ? item.grab_price : item.price)}
															</p>
															{paymentMethod === 'grab' && item.grab_price && item.grab_price !== item.price && (
																<span className='text-[9px] font-semibold px-1 py-0.5 rounded bg-[#02B150]/10 text-[#02B150]'>
																	+{formatCurrency(item.grab_price - item.price)}
																</span>
															)}
														</>
													)}
												</div>
												{appliedDiscount?.category_filter_mode && (appliedDiscount.category_filter_ids?.length ?? 0) > 0 && (() => {
													const catIds = item.categoryIds ?? [];
													const ids = appliedDiscount.category_filter_ids!;
													const matches = catIds.some(id => ids.includes(id));
													const discounted = appliedDiscount.category_filter_mode === 'include' ? matches : !matches;
													return discounted
														? <span className='inline-block mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-success/10 text-success'>Discounted</span>
														: <span className='inline-block mt-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-secondary/5 text-secondary/40'>No discount</span>;
												})()}
											</div>

											{/* Quantity and Total */}
											<div className='text-right'>
												<div className='text-xs font-medium text-secondary/50'>
													Qty: {item.quantity}
												</div>
												<div className='text-xs font-regular text-secondary'>
													{formatCurrency(lineTotal(item, paymentMethod))}
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
									{paymentMethod === 'grab' && (() => {
										const grabUplift = cart.reduce((sum, i) => {
											const grabTotal = lineTotal(i, 'grab');
											const regularTotal = i.price * i.quantity;
											return sum + (grabTotal > regularTotal ? grabTotal - regularTotal : 0);
										}, 0);
										return grabUplift > 0 ? (
											<div className='flex justify-between text-xs'>
												<span className='text-[#02B150]'>Grab price adjustment:</span>
												<span className='font-medium text-[#02B150]'>+{formatCurrency(grabUplift)}</span>
											</div>
										) : null;
									})()}
									{displayDiscount > 0 && (
										<div className='flex justify-between text-xs'>
											<span className='text-secondary'>
												{paymentMethod === 'grab'
													? 'Grab Discount'
													: appliedDiscount?.type === 'b1t1' ? 'Buy 1 Take 1 Savings' : 'Discount'}
												{paymentMethod !== 'grab' && appliedDiscount && appliedDiscount.type !== 'b1t1' && (
													<span className='font-medium ml-1'>
														({appliedDiscount.name} -{" "}
														{appliedDiscount.type === "percentage"
															? `${appliedDiscount.value}% off`
															: `₱${appliedDiscount.value} off`}
														)
													</span>
												)}
												{paymentMethod !== 'grab' && manualDiscountAmount > 0 && (
													<span className='font-medium ml-1'>(Manual)</span>
												)}
												:
											</span>
											<span className='font-medium text-green-600'>
												-{formatCurrency(displayDiscount)}
											</span>
										</div>
									)}
									{paymentMethod !== 'grab' && (
										<div className='flex justify-between items-center text-xs'>
											<span className='text-secondary/70'>Manual Discount: <span className='text-secondary/40'>(optional)</span></span>
											<div className='relative w-32'>
												<span className='absolute left-3 top-1/2 -translate-y-1/2 text-3 text-secondary/50 pointer-events-none'>₱</span>
												<input
													type='text'
													inputMode='decimal'
													value={manualDiscount}
													onChange={e => handleManualDiscountChange(e.target.value)}
													onFocus={e => e.target.select()}
													placeholder='0.00'
													className='w-full text-right border border-secondary/20 rounded-lg h-9.5 pl-7 pr-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
												/>
											</div>
										</div>
									)}
									{paymentMethod === 'grab' && (
										<div className='flex justify-between items-center text-xs'>
											<span className='text-secondary/70'>Grab Discount: <span className='text-secondary/40'>(optional)</span></span>
											<div className='relative w-32'>
												<span className='absolute left-3 top-1/2 -translate-y-1/2 text-3 text-secondary/50 pointer-events-none'>₱</span>
												<input
													type='text'
													inputMode='decimal'
													value={grabManualDiscount}
													onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setGrabManualDiscount(v); }}
													placeholder='0.00'
													className='w-full text-right border border-secondary/20 rounded-lg h-9.5 pl-7 pr-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
												/>
											</div>
										</div>
									)}
									<div className='flex justify-between text-base font-semibold border-t border-gray-200 pt-2'>
										<span>Total:</span>
										<span className='text-secondary'>
											{formatCurrency(total)}
										</span>
									</div>
									{paymentMethod === 'cash' && (
										<>
											<div className='flex justify-between items-center text-sm border-t border-gray-200 pt-2'>
												<span className='text-secondary/70'>Tendered: <span className='text-secondary/40'>(optional)</span></span>
												<div className='relative w-32'>
													<span className='absolute left-3 top-1/2 -translate-y-1/2 text-3 text-secondary/50 pointer-events-none'>₱</span>
													<input
														type='text'
														inputMode='decimal'
														value={tenderedAmount}
														onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setTenderedAmount(v); }}
														placeholder={String(total)}
														className='w-full text-right border border-secondary/20 rounded-lg h-9.5 pl-7 pr-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
													/>
												</div>
											</div>
											{parseFloat(tenderedAmount) >= total && (
												<div className='flex justify-between text-sm font-semibold text-accent'>
													<span>Change:</span>
													<span>{formatCurrency(parseFloat(tenderedAmount) - total)}</span>
												</div>
											)}
										</>
									)}
								</div>
							</div>
							{/* Note / Transaction # / Payment Details */}
							<div className='mt-3 pt-3 border-t border-gray-200 space-y-2'>
								{paymentMethod === 'gcash' || paymentMethod === 'grab' ? (
									<>
										<label className='text-xs text-secondary/70'>Transaction # <span className='text-secondary/40'>(optional)</span></label>
										<input
											type='text'
											value={gcashTransactionNumber}
											onChange={e => setGcashTransactionNumber(e.target.value)}
											placeholder='e.g. 123456789'
											className='w-full border border-secondary/20 rounded-lg h-9.5 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
										/>
									</>
								) : paymentMethod === 'debit_credit' ? (
									<>
										<p className='text-xs font-medium text-secondary/70'>Card Details <span className='text-secondary/40'>(optional)</span></p>
										<input
											type='text'
											value={debitReferenceNo}
											onChange={e => setDebitReferenceNo(e.target.value)}
											placeholder='Reference No.'
											className='w-full border border-secondary/20 rounded-lg h-9.5 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
										/>
										<input
											type='text'
											value={debitTransactionNo}
											onChange={e => setDebitTransactionNo(e.target.value)}
											placeholder='Transaction No.'
											className='w-full border border-secondary/20 rounded-lg h-9.5 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
										/>
										<input
											type='text'
											value={debitApprovalCode}
											onChange={e => setDebitApprovalCode(e.target.value)}
											placeholder='Approval Code'
											className='w-full border border-secondary/20 rounded-lg h-9.5 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
										/>
									</>
								) : paymentMethod === 'employee_charge' ? (
									<>
										<label className='text-xs text-secondary/70'>Employee Name <span className='text-secondary/40'>(optional)</span></label>
										<input
											type='text'
											value={employeeChargeName}
											onChange={e => setEmployeeChargeName(e.target.value)}
											placeholder='Employee name'
											className='w-full border border-secondary/20 rounded-lg h-9.5 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
										/>
									</>
								) : paymentMethod === 'split' ? (
									<>
										<p className='text-xs font-medium text-secondary/70'>Split Payment</p>
										{(['1', '2'] as const).map(slot => {
											const method = slot === '1' ? splitMethod1 : splitMethod2;
											const setMethod = slot === '1' ? setSplitMethod1 : setSplitMethod2;
											const amount = slot === '1' ? splitAmount1 : splitAmount2;
											const txn = slot === '1' ? splitTxn1 : splitTxn2;
											const setTxn = slot === '1' ? setSplitTxn1 : setSplitTxn2;
											const otherMethod = slot === '1' ? splitMethod2 : splitMethod1;
											const onAmountChange = (v: string) => {
												if (!/^\d*\.?\d*$/.test(v)) return;
												if (slot === '1') {
													setSplitAmount1(v);
													const n = parseFloat(v);
													if (Number.isFinite(n)) {
														const rem = Math.round((total - n) * 100) / 100;
														setSplitAmount2(rem >= 0 ? rem.toFixed(2) : "");
													}
												} else {
													setSplitAmount2(v);
													const n = parseFloat(v);
													if (Number.isFinite(n)) {
														const rem = Math.round((total - n) * 100) / 100;
														setSplitAmount1(rem >= 0 ? rem.toFixed(2) : "");
													}
												}
											};
											const labelOf = (k: SplitMethod) =>
												k === 'cash' ? 'Cash' : k === 'gcash' ? 'GCash' : 'Debit/Credit';
											const keyOf = (l: string): SplitMethod =>
												l === 'GCash' ? 'gcash' : l === 'Debit/Credit' ? 'debit_credit' : 'cash';
											const options = (['cash', 'gcash', 'debit_credit'] as const)
												.filter(k => k !== otherMethod)
												.map(labelOf);
											return (
												<div key={slot} className='bg-gray-50 border border-secondary/10 rounded-lg p-2.5 space-y-2'>
													<div className='flex items-center gap-2'>
														<span className='text-2.5 font-semibold text-secondary/60 w-3 shrink-0'>{slot}.</span>
														<div className='flex-1 min-w-0'>
															<DropdownField
																key={`split-${slot}-${otherMethod}`}
																options={options}
																defaultValue={labelOf(method)}
																onChange={l => setMethod(keyOf(l))}
																heightClassName='h-9.5'
																fontSize='12px'
																padding='12px'
																valueAlignment='left'
																roundness='8'
																shadow={false}
																borderClassName='border border-secondary/20 box-border'
																dropdownOffset={SPLIT_DROPDOWN_OFFSET}
															/>
														</div>
														<div className='relative w-28 shrink-0'>
															<span className='absolute left-2.5 top-1/2 -translate-y-1/2 text-3 text-secondary/50 pointer-events-none'>₱</span>
															<input
																type='text'
																inputMode='decimal'
																value={amount}
																onChange={e => onAmountChange(e.target.value)}
																placeholder='0.00'
																className='w-full text-right border border-secondary/20 rounded-lg h-9.5 pl-6 pr-2 text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
															/>
														</div>
													</div>
													{(method === 'gcash' || method === 'debit_credit') && (
														<input
															type='text'
															value={txn}
															onChange={e => setTxn(e.target.value)}
															placeholder={method === 'gcash' ? 'GCash Transaction # (optional)' : 'Card Reference # (optional)'}
															className='w-full border border-secondary/20 rounded-lg h-9.5 px-3 text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
														/>
													)}
												</div>
											);
										})}
										<div className={`flex justify-between items-center text-2.5 mt-1 px-1 ${splitValid ? 'text-success' : 'text-error'}`}>
											<span className='font-medium'>
												{splitValid ? 'Amounts match total' : `Off by ${formatCurrency(Math.abs(splitDiff))}`}
											</span>
											<span className='font-medium tabular-nums'>
												{formatCurrency(splitSum)} / {formatCurrency(total)}
											</span>
										</div>
									</>
								) : (
									<>
										<label className='text-xs text-secondary/70'>Note <span className='text-secondary/40'>(optional)</span></label>
										<textarea
											value={orderNote}
											onChange={e => setOrderNote(e.target.value)}
											placeholder='Add a note...'
											rows={2}
											className='w-full border border-secondary/20 rounded-lg px-3 py-2 text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none'
										/>
									</>
								)}
							</div>
						</div>

						{/* Modal Footer */}
						<div className='p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-200 bg-gray-50'>
							{unpricedItemCount > 0 && (
								<p className='mb-3 text-xs font-medium text-error text-center'>
									Enter a selling price for {unpricedItemCount} item{unpricedItemCount !== 1 ? 's' : ''} before placing the order.
								</p>
							)}
							<div className='flex gap-3'>
								<button
									onClick={() => setShowOrderConfirmation(false)}
									className='flex-1 px-4 py-3 text-xs text-secondary/80 bg-white border border-secondary/20 rounded-lg hover:bg-gray-50 hover:shadow-md transition-colors font-black'>
									CANCEL
								</button>
								<button
									onClick={confirmPlaceOrder}
									disabled={isPlacingOrder || !splitValid || unpricedItemCount > 0}
									className={`flex-1 px-4 py-3 rounded-lg text-xs font-black transition-all ${
										isPlacingOrder || !splitValid || unpricedItemCount > 0
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

			{editingCartId && (() => {
					const it = cart.find(i => i.id === editingCartId);
					if (!it) return null;
					return (
						<CartItemEditor
							name={it.name}
							price={it.price}
							wholePrice={it.wholePrice ?? null}
							priceMode={it.priceMode ?? 'per_piece'}
							quantity={it.quantity}
							onPricingChange={(s) => updateCartItemPricing(it.id, s)}
							onQuantityChange={(d) => updateQuantity(it.id, d, it.type || 'item')}
							onClose={() => setEditingCartId(null)}
						/>
					);
				})()}

				{editingGrabCartId && (() => {
						const it = cart.find(i => i.id === editingGrabCartId);
						if (!it) return null;
						return (
							<CartItemEditor
								name={`${it.name} — Grab`}
								price={it.grab_price ?? it.price}
								wholePrice={it.grabWholePrice ?? null}
								priceMode={it.grabPriceMode ?? 'per_piece'}
								quantity={it.quantity}
								onPricingChange={(s) => updateCartItemGrabPricing(it.id, s)}
								onQuantityChange={(d) => updateQuantity(it.id, d, it.type || 'item')}
								onClose={() => setEditingGrabCartId(null)}
							/>
						);
					})()}

				{/* Wildcard Bundle Modal */}
			{showWildcardModal && (
				<WildcardBundleModal
					inventory={inventoryItems}
					categories={categories}
					onConfirm={handleWildcardConfirm}
					onClose={() => setShowWildcardModal(false)}
				/>
			)}

			{/* Assorted Kakanin Modal */}
			{showAssortedModal && (
				<AssortedKakaninModal
					inventory={inventoryItems}
					onConfirm={handleAssortedConfirm}
					onClose={() => setShowAssortedModal(false)}
				/>
			)}

			{/* Food House Modal */}
			{showFoodHouseModal && (
				<FoodHouseModal
					inventory={inventoryItems}
					onConfirm={handleFoodHouseConfirm}
					onClose={() => setShowFoodHouseModal(false)}
				/>
			)}

			{/* Custom Bundle Picker Modal */}
			{customBundleTarget && (
				<CustomBundlePickerModal
					bundle={customBundleTarget}
					inventory={inventoryItems}
					onConfirm={(selections, overridePrice) => handleCustomBundleConfirm(customBundleTarget, selections, overridePrice)}
					onClose={() => setCustomBundleTarget(null)}
				/>
			)}

			{/* B1T1 Picker Modal */}
			{b1t1PickerTarget && (
				<B1T1PickerModal
					buyItemName={b1t1PickerTarget.name}
					maxUnits={b1t1PickerTarget.quantity}
					inventory={inventoryItems}
					onConfirm={handleB1T1Confirm}
					onClose={() => setB1T1PickerTarget(null)}
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

			{/* Safe Drop Modal */}
			<SafeDropModal
				isOpen={showSafeDropModal}
				onClose={() => setShowSafeDropModal(false)}
			/>

			{/* Write Off Modal */}
			<WriteOffModal
				isOpen={showWriteOffModal}
				onClose={() => setShowWriteOffModal(false)}
				inventoryItems={inventoryItems}
			/>
		</div>
	);
}
