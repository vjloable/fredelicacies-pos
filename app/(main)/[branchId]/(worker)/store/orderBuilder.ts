// Pure order-item, receipt-item and payment-detail builders for checkout.
//
// These shape the cart into the payloads createOrder / the receipt printer expect.
// They are deliberately side-effect-free (no state, no I/O, no Date/user access) so
// the money-shaping logic can be unit-tested in isolation; the component keeps the
// createOrder call, printing, and the receipt-header assembly (which pulls in live
// user/branch/time context). Pricing is delegated to lib/pricing so per-piece vs.
// whole-line and Grab-vs-regular pricing stay in one place.
import {
	effectiveUnitPrice,
	isWholeLine,
	wholePriceOf,
	lineTotal,
} from "@/lib/pricing";
import type { CartLine, PaymentMethod, SplitMethod } from "./checkoutTypes";

// Cart → the line items passed to createOrder. Whole-priced lines carry the absolute
// line_total; regular lines leave it null and are priced per unit.
export function buildOrderLineItems(cart: CartLine[], paymentMethod: PaymentMethod) {
	return cart.map((item) => ({
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
	}));
}

// Cart → the printed receipt line items. B1T1 take-1 lines are tagged; whole-priced
// lines print the exact absolute total, never itemPrice × qty.
export function buildReceiptItems(cart: CartLine[], paymentMethod: PaymentMethod) {
	return cart.map((item) => ({
		name: item.isB1T1 ? `${item.name} [B1T1]` : item.name,
		qty: item.quantity,
		price: effectiveUnitPrice(item, paymentMethod),
		total: lineTotal(item, paymentMethod),
		isPriceOverride: item.isPriceOverride,
		originalPrice: item.originalPrice,
	}));
}

export type SplitDetailsInput = {
	splitMethod1: SplitMethod;
	splitAmount1Num: number;
	splitMethod2: SplitMethod;
	splitAmount2Num: number;
	splitTxn1: string;
	splitTxn2: string;
};

// Split-tender payment details. Amounts are rounded to 2dp; txn refs are included only
// when non-blank.
export function buildSplitPaymentDetails(input: SplitDetailsInput): Record<string, string> {
	const d: Record<string, string> = {
		split_method_1: input.splitMethod1,
		split_amount_1: input.splitAmount1Num.toFixed(2),
		split_method_2: input.splitMethod2,
		split_amount_2: input.splitAmount2Num.toFixed(2),
	};
	if (input.splitTxn1.trim()) d.split_txn_1 = input.splitTxn1.trim();
	if (input.splitTxn2.trim()) d.split_txn_2 = input.splitTxn2.trim();
	return d;
}

export type PaymentDetailsInput = {
	debitReferenceNo: string;
	debitTransactionNo: string;
	debitApprovalCode: string;
	employeeChargeName: string;
	split: SplitDetailsInput;
};

// Method-specific payment details for debit/employee/split; null for methods that carry
// none (cash/gcash/grab). Callers that want `undefined` (e.g. the receipt) coerce with `?? undefined`.
export function buildPaymentDetails(
	paymentMethod: PaymentMethod,
	input: PaymentDetailsInput
): Record<string, string> | null {
	if (paymentMethod === 'debit_credit') {
		return {
			reference_no: input.debitReferenceNo,
			transaction_no: input.debitTransactionNo,
			approval_code: input.debitApprovalCode,
		};
	}
	if (paymentMethod === 'employee_charge') {
		return { employee_name: input.employeeChargeName };
	}
	if (paymentMethod === 'split') {
		return buildSplitPaymentDetails(input.split);
	}
	return null;
}
