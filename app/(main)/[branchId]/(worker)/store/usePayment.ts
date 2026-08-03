// Payment, split-tender and discount state for the store screen.
//
// Owns the payment method, the two split-tender legs (method / amount / txn ref),
// and the discount inputs (dropdown Discount + amount + code, plus the two mutually
// exclusive manual-discount fields for Grab and non-Grab). It also carries the two
// cross-cutting sync effects that reconcile discount state against the cart:
//
//   A. auto-clear an applied Discount when the cart changes and it's no longer eligible
//   B. on payment-method change: Grab drops the dropdown discount for its manual flow,
//      switching away from Grab resets the manual amount, and any surviving discount is
//      recomputed against the (possibly grab-priced) cart.
//
// Both effects reach into the cart, so `cart` and `setCart` are injected from useCart.
// The split-amount initialization effect is deliberately NOT here: it depends on the
// derived `total` from useCheckoutTotals (computed downstream from this hook's own
// paymentMethod/discount outputs), so it stays in the component and drives the split
// setters this hook exposes. Behavior is byte-for-byte identical to the inline block.
import { useState, useEffect } from "react";
import type { Discount } from "@/types/domain";
import {
	isDiscountEligible,
	calculateEligibleSubtotal,
	calculateDiscountAmount,
} from "@/services/discountService";
import type { CartLine, PaymentMethod, SplitMethod } from "./checkoutTypes";

export type UsePaymentDeps = {
	cart: CartLine[];
	setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
};

// Collapse a cart into the shape the discount services expect. Whole-priced lines
// collapse to a single unit at the absolute total so the discount math sees the exact
// line amount (no per-piece rounding drift).
const toDiscountCart = (cart: CartLine[]) =>
	cart.map(i => ({
		price: i.priceMode === 'whole' && i.wholePrice != null ? i.wholePrice : i.price,
		quantity: i.priceMode === 'whole' && i.wholePrice != null ? 1 : i.quantity,
		categoryIds: i.categoryIds ?? (i.categoryId && i.categoryId !== 0 ? [String(i.categoryId)] : []),
	}));

export function usePayment({ cart, setCart }: UsePaymentDeps) {
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
	const [splitMethod1, setSplitMethod1] = useState<SplitMethod>('cash');
	const [splitMethod2, setSplitMethod2] = useState<SplitMethod>('gcash');
	const [splitAmount1, setSplitAmount1] = useState("");
	const [splitAmount2, setSplitAmount2] = useState("");
	const [splitTxn1, setSplitTxn1] = useState("");
	const [splitTxn2, setSplitTxn2] = useState("");
	const [discountCode, setDiscountCode] = useState("");
	const [discountAmount, setDiscountAmount] = useState(0);
	const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
	const [grabManualDiscount, setGrabManualDiscount] = useState("");
	// Cashier-entered manual discount (₱ off) for non-Grab payments. Exclusive with the DiscountDropdown.
	const [manualDiscount, setManualDiscount] = useState("");

	// Auto-clear applied discount when cart changes and discount is no longer eligible
	useEffect(() => {
		if (!appliedDiscount) return;
		if (!isDiscountEligible(appliedDiscount, toDiscountCart(cart))) {
			setAppliedDiscount(null);
			setDiscountAmount(0);
			setDiscountCode("");
			// Remove B1T1 take-1 items if discount cleared
			setCart(prev => prev.filter(i => !i.isB1T1));
		}
	}, [cart, appliedDiscount]); // eslint-disable-line react-hooks/exhaustive-deps

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
		const cartItemsForDiscount = toDiscountCart(cart);
		const sub = calculateEligibleSubtotal(appliedDiscount, cartItemsForDiscount);
		setDiscountAmount(calculateDiscountAmount(appliedDiscount, sub, cartItemsForDiscount));
	}, [paymentMethod]); // eslint-disable-line react-hooks/exhaustive-deps

	// Handle discount application (from the DiscountDropdown).
	const handleDiscountApplied = (discount: Discount | null, amount: number) => {
		setAppliedDiscount(discount);
		setDiscountAmount(amount);
		// Exclusive with the manual discount: picking a dropdown discount clears any typed manual amount.
		if (discount) setManualDiscount("");
		if (discount) {
			console.log("Discount applied:", discount.name, "Amount:", amount);
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

	return {
		paymentMethod, setPaymentMethod,
		splitMethod1, setSplitMethod1,
		splitMethod2, setSplitMethod2,
		splitAmount1, setSplitAmount1,
		splitAmount2, setSplitAmount2,
		splitTxn1, setSplitTxn1,
		splitTxn2, setSplitTxn2,
		discountCode, setDiscountCode,
		discountAmount, setDiscountAmount,
		appliedDiscount, setAppliedDiscount,
		grabManualDiscount, setGrabManualDiscount,
		manualDiscount, setManualDiscount,
		handleDiscountApplied,
		handleManualDiscountChange,
	};
}
