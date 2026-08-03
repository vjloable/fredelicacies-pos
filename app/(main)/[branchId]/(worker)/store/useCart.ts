// Cart state + mutations for the store screen.
//
// Owns the cart array and the low-level mutators that operate purely on it:
// adding a tapped product, adjusting line quantity against available stock,
// removing a line, and recording cashier-entered per-line pricing. Stock math
// (getAvailableInventoryStock / calculateBundleAvailability) is imported
// directly; the caller injects the live bundles/inventory and a callback for
// the one non-cart branch (custom bundles open a picker modal instead of adding).
//
// setCart is deliberately exposed so the component's bundle-confirm handlers
// (custom/wildcard/assorted/foodhouse/B1T1) and clearCart — which also reset
// discount/modal state — keep composing cart writes without duplicating logic.
import { useState } from "react";
import type { InventoryItem, BundleWithComponents, BundleComponent } from "@/types/domain";
import { getAvailableStock as getAvailableInventoryStock } from "@/services/inventoryService";
import { calculateBundleAvailability } from "@/services/bundleService";
import type { PricingState } from "./CartItemEditor";
import type { CartLine, DisplayItem } from "./checkoutTypes";

export type UseCartDeps = {
	bundles: BundleWithComponents[];
	inventoryItems: InventoryItem[];
	// Custom bundles can't be added directly — they open a picker modal.
	onRequestCustomBundle: (bundle: BundleWithComponents) => void;
};

export function useCart({ bundles, inventoryItems, onRequestCustomBundle }: UseCartDeps) {
	const [cart, setCart] = useState<CartLine[]>([]);

	// Available-to-sell for an inventory item minus what's already in the cart.
	const getAvailableStock = (itemId: string) => {
		const item = inventoryItems.find((inv) => inv.id === itemId);
		const cartItem = cart.find((cartItem) => cartItem.id === itemId);

		if (!item) return 0;

		const cartQuantity = cartItem ? cartItem.quantity : 0;
		return Math.max(0, getAvailableInventoryStock(item) - cartQuantity);
	};

	const addToCart = (item: DisplayItem) => {
		const isBundle = item.type === 'bundle';

		// Custom bundles: always open the picker modal, never add directly
		if (isBundle && item.is_custom) {
			const fullBundle = bundles.find(b => b.id === item.id);
			if (fullBundle) onRequestCustomBundle(fullBundle);
			return;
		}

		const availableStock = isBundle ? item.availability : getAvailableStock(item.id || "0");

		if (availableStock <= 0) return;

		const itemId = item.id || "0";
		const existingItem = cart.find((cartItem) => cartItem.id === itemId && (cartItem.type || 'item') === item.type);

		if (existingItem) {
			setCart(
				cart.map((cartItem) =>
					cartItem.id === itemId && (cartItem.type || 'item') === item.type
						? { ...cartItem, quantity: cartItem.quantity + 1 }
						: cartItem
				)
			);
		} else {
			if (isBundle) {
				// Merge additional_items into components so they get stock-deducted on order
				const fullBundle = bundles.find(b => b.id === itemId);
				const additionalAsComponents: BundleComponent[] = (fullBundle?.additional_items ?? []).map(ai => ({
					id: ai.id,
					bundle_id: ai.bundle_id,
					inventory_item_id: ai.inventory_item_id,
					quantity: ai.quantity,
					created_at: ai.created_at,
					inventory_item: ai.inventory_item,
				}));
				setCart([
					...cart,
					{
						id: itemId,
						name: item.name,
						price: item.price,
						grab_price: item.grab_price ?? null,
						quantity: 1,
						originalStock: availableStock,
						imgUrl: item.img_url ?? undefined,
						categoryId: 0,
						categoryIds: item.category_id ? [String(item.category_id)] : [],
						type: 'bundle',
						components: [...(item.components ?? []), ...additionalAsComponents],
					},
				]);
			} else {
				setCart([
					...cart,
					{
						id: itemId,
						name: item.name,
						// Regular items have no stored price — the cashier enters the selling
						// price on the cart line (and the Grab price in the confirmation modal).
						price: 0,
						isPriced: false,
						grab_price: null,
						cost: item.cost ?? undefined,
						quantity: 1,
						originalStock: getAvailableInventoryStock(item),
						imgUrl: item.img_url ?? undefined,
						categoryId: item.category_id ?? "",
						categoryIds: item.category_ids?.length ? item.category_ids : item.category_id ? [item.category_id] : [],
						type: 'item',
					},
				]);
			}
		}
	};

	// Cashier-entered pricing for regular cart lines. Carries the pricing mode:
	// per-piece stores the unit price; whole stores the absolute line total in wholePrice
	// (price is kept as a display-only per-piece figure and is never × quantity for whole lines).
	const updateCartItemPricing = (id: string, s: PricingState) =>
		setCart(prev => prev.map(i => (i.id === id
			? {
				...i,
				price: s.perPiece,
				priceMode: s.mode,
				wholePrice: s.mode === 'whole' ? s.wholePrice : null,
				isPriced: true,
			}
			: i)));
	// Grab pricing for cashier-priced lines, mirroring updateCartItemPricing. per-piece stores
	// the per-unit grab price; whole stores the absolute line total in grabWholePrice (grab_price
	// is kept as a display-only per-piece figure and is never × quantity for whole lines).
	const updateCartItemGrabPricing = (id: string, s: PricingState) =>
		setCart(prev => prev.map(i => (i.id === id
			? {
				...i,
				grab_price: s.perPiece > 0 ? s.perPiece : null,
				grabPriceMode: s.mode,
				grabWholePrice: s.mode === 'whole' ? s.wholePrice : null,
			}
			: i)));

	const updateQuantity = (id: string, delta: number, itemType: 'item' | 'bundle' = 'item') => {
		console.log(`Updating quantity for ${itemType} ${id} by ${delta}`);
		setCart(
			cart
				.map((item) => {
					if (item.id === id && (item.type || 'item') === itemType) {
						const newQuantity = Math.max(0, item.quantity + delta);
						// Food House dishes are made-to-order (untracked), so quantity is
						// never gated by stock — the chosen container deducts per order.
						// Check if we can increase quantity based on available stock
						if (delta > 0 && !item.isFoodHouse) {
							let maxAvailable = 0;
							if (itemType === 'bundle') {
								const bundle = bundles.find(b => b.id === id);
								maxAvailable = bundle ? calculateBundleAvailability(bundle, inventoryItems) : 0;
							} else {
								maxAvailable = getAvailableStock(id);
							}

							if (maxAvailable <= 0) {
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

	// Remove an entire line from the cart (used by lines without a +/− stepper,
	// e.g. custom/whole-priced bundles that can't be decremented to zero).
	const removeFromCart = (id: string) => {
		setCart(prev => prev.filter((item) => item.id !== id));
	};

	return {
		cart,
		setCart,
		getAvailableStock,
		addToCart,
		updateQuantity,
		removeFromCart,
		updateCartItemPricing,
		updateCartItemGrabPricing,
	};
}
