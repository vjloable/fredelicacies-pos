// Derived checkout totals for the store screen.
//
// Pure consumer of lib/pricing — takes the raw checkout state (cart, payment
// method, discount inputs, split inputs) and returns every derived money figure
// the UI and order/receipt builders need. No side effects, no local state:
// everything here is a memoized function of its inputs, so the semantics are
// byte-for-byte identical to the inline block it replaced in StoreScreen.
import { useMemo } from "react";
import {
	computeSubtotal,
	computeB1T1Savings,
	clampManualDiscount,
	resolveDiscount,
	computeTotal,
	validateSplit,
	isCashierPriced,
} from "@/lib/pricing";
import type { Discount } from "@/types/domain";
import type { CartLine, PaymentMethod } from "./checkoutTypes";

export type UseCheckoutTotalsInput = {
	cart: CartLine[];
	paymentMethod: PaymentMethod;
	grabManualDiscount: string;
	manualDiscount: string;
	appliedDiscount: Discount | null;
	discountAmount: number;
	splitAmount1: string;
	splitAmount2: string;
	splitMethod1: string;
	splitMethod2: string;
};

export type CheckoutTotals = {
	subtotal: number;
	b1t1SavingsAmount: number;
	grabManualDiscountAmount: number;
	manualDiscountAmount: number;
	effectiveDiscountForTotal: number;
	displayDiscount: number;
	total: number;
	unpricedItemCount: number;
	splitAmount1Num: number;
	splitAmount2Num: number;
	splitSum: number;
	splitDiff: number;
	splitValid: boolean;
};

export function useCheckoutTotals(input: UseCheckoutTotalsInput): CheckoutTotals {
	const {
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
	} = input;

	const subtotal = computeSubtotal(cart, paymentMethod);
	// For B1T1: take-1 items are in cart at the promo price; discount_amount is savings for reporting only.
	const b1t1SavingsAmount = useMemo(() => computeB1T1Savings(cart), [cart]);
	// Grab uses a cashier-entered manual discount instead of the DiscountDropdown.
	const grabManualDiscountAmount = useMemo(
		() => (paymentMethod === 'grab' ? clampManualDiscount(grabManualDiscount, subtotal) : 0),
		[paymentMethod, grabManualDiscount, subtotal]
	);
	// Non-grab manual discount: cashier types a ₱ amount that subtracts straight from the total.
	// Exclusive with the DiscountDropdown — applying one clears the other.
	const manualDiscountAmount = useMemo(
		() => (paymentMethod === 'grab' ? 0 : clampManualDiscount(manualDiscount, subtotal)),
		[paymentMethod, manualDiscount, subtotal]
	);
	// effectiveDiscountForTotal subtracts from the total; displayDiscount is shown on the
	// summary/receipt and recorded on the sale. Manual takes precedence over a dropdown
	// discount (mutually exclusive); a B1T1 dropdown subtracts nothing but shows its savings.
	const { effectiveDiscountForTotal, displayDiscount } = resolveDiscount({
		paymentMethod,
		grabManualDiscountAmount,
		manualDiscountAmount,
		appliedDiscountType: appliedDiscount?.type,
		discountAmount,
		b1t1SavingsAmount,
	});
	const total = computeTotal(subtotal, effectiveDiscountForTotal);

	// Regular items require a cashier-entered selling price before the order can be placed.
	const unpricedItemCount = cart.filter(i => isCashierPriced(i) && i.isPriced === false).length;

	const {
		amount1Num: splitAmount1Num,
		amount2Num: splitAmount2Num,
		sum: splitSum,
		diff: splitDiff,
		valid: splitValid,
	} = validateSplit({
		paymentMethod,
		total,
		amount1: splitAmount1,
		amount2: splitAmount2,
		method1: splitMethod1,
		method2: splitMethod2,
	});

	return {
		subtotal,
		b1t1SavingsAmount,
		grabManualDiscountAmount,
		manualDiscountAmount,
		effectiveDiscountForTotal,
		displayDiscount,
		total,
		unpricedItemCount,
		splitAmount1Num,
		splitAmount2Num,
		splitSum,
		splitDiff,
		splitValid,
	};
}
