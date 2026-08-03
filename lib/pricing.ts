// Pure pricing math for the POS checkout.
//
// Extracted from the store checkout page so the money-path logic (line totals,
// subtotal, B1T1 savings, manual-discount clamping, discount resolution, and
// split-payment validation) lives in one pure, unit-tested module with no React
// or side effects. All functions here are deterministic and referentially
// transparent — given the same inputs they return the same outputs.

export type PaymentMethod = string;

// A "cashier-priced" line is a plain inventory item (not a bundle / custom bundle / B1T1).
// Regular items no longer carry a stored price — the cashier types the selling price into
// the cart line at the point of sale, and the Grab price into the order-confirmation modal.
export type CartLineLike = {
	type?: 'item' | 'bundle';
	isB1T1?: boolean;
	is_custom?: boolean;
	price: number;
	grab_price?: number | null;
};

// A line can be absolute whole-priced for either payment path. Non-Grab lines use
// priceMode/wholePrice; Grab lines use grabPriceMode/grabWholePrice. When whole-priced,
// the whole price is the exact line total (no × quantity).
export type WholeLike = CartLineLike & {
	priceMode?: 'per_piece' | 'whole';
	wholePrice?: number | null;
	grabPriceMode?: 'per_piece' | 'whole';
	grabWholePrice?: number | null;
};

export const isCashierPriced = (item: CartLineLike): boolean =>
	(item.type ?? 'item') !== 'bundle' && !item.isB1T1 && !item.is_custom;

export const effectiveUnitPrice = (item: CartLineLike, paymentMethod: PaymentMethod): number =>
	paymentMethod === 'grab' ? (item.grab_price ?? item.price) : item.price;

export const wholePriceOf = (item: WholeLike, paymentMethod: PaymentMethod): number | null =>
	paymentMethod === 'grab' ? (item.grabWholePrice ?? null) : (item.wholePrice ?? null);

export const isWholeLine = (item: WholeLike, paymentMethod: PaymentMethod): boolean => {
	const mode = paymentMethod === 'grab' ? item.grabPriceMode : item.priceMode;
	return mode === 'whole' && wholePriceOf(item, paymentMethod) != null;
};

export const lineTotal = (
	item: WholeLike & { quantity: number },
	paymentMethod: PaymentMethod
): number =>
	isWholeLine(item, paymentMethod)
		? (wholePriceOf(item, paymentMethod) as number)
		: effectiveUnitPrice(item, paymentMethod) * item.quantity;

export const computeSubtotal = (
	cart: Array<WholeLike & { quantity: number }>,
	paymentMethod: PaymentMethod
): number => cart.reduce((sum, item) => sum + lineTotal(item, paymentMethod), 0);

// B1T1 take-1 items sit in the cart at the promo price; the savings (regular − promo,
// per unit × qty) is recorded on the sale for reporting only, not subtracted again.
export type B1T1Line = { isB1T1?: boolean; regularPrice?: number | null; price: number; quantity: number };

export const computeB1T1Savings = (cart: B1T1Line[]): number =>
	cart
		.filter((i) => i.isB1T1)
		.reduce((s, i) => s + ((i.regularPrice ?? i.price) - i.price) * i.quantity, 0);

// Parse a cashier-entered manual discount (₱ amount) and clamp it so it can never
// exceed the subtotal. Non-finite / non-positive input yields 0.
export const clampManualDiscount = (raw: string, subtotal: number): number => {
	const n = parseFloat(raw);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Math.min(n, subtotal);
};

export type DiscountResolutionInput = {
	paymentMethod: PaymentMethod;
	grabManualDiscountAmount: number;
	manualDiscountAmount: number;
	appliedDiscountType?: string | null;
	discountAmount: number;
	b1t1SavingsAmount: number;
};

export type DiscountResolution = {
	// The amount actually subtracted from subtotal to reach the total.
	effectiveDiscountForTotal: number;
	// The amount shown on the summary/receipt and recorded on the sale.
	displayDiscount: number;
};

// Grab uses a cashier-entered manual discount; otherwise a non-grab manual discount
// takes precedence over a dropdown discount (they are mutually exclusive). A B1T1
// dropdown discount subtracts nothing from the total (take-1 items are already promo
// priced) but its savings are shown/recorded.
export const resolveDiscount = (input: DiscountResolutionInput): DiscountResolution => {
	const {
		paymentMethod,
		grabManualDiscountAmount,
		manualDiscountAmount,
		appliedDiscountType,
		discountAmount,
		b1t1SavingsAmount,
	} = input;

	if (paymentMethod === 'grab') {
		return {
			effectiveDiscountForTotal: grabManualDiscountAmount,
			displayDiscount: grabManualDiscountAmount,
		};
	}

	if (manualDiscountAmount > 0) {
		return {
			effectiveDiscountForTotal: manualDiscountAmount,
			displayDiscount: manualDiscountAmount,
		};
	}

	const isB1T1 = appliedDiscountType === 'b1t1';
	return {
		effectiveDiscountForTotal: isB1T1 ? 0 : discountAmount,
		displayDiscount: isB1T1 ? b1t1SavingsAmount : discountAmount,
	};
};

export const computeTotal = (subtotal: number, effectiveDiscountForTotal: number): number =>
	subtotal - effectiveDiscountForTotal;

export type SplitValidationInput = {
	paymentMethod: PaymentMethod;
	total: number;
	amount1: string;
	amount2: string;
	method1: string;
	method2: string;
};

export type SplitValidation = {
	amount1Num: number;
	amount2Num: number;
	sum: number;
	diff: number;
	valid: boolean;
};

// A split payment is valid when the two tenders differ, both are positive, and their
// sum matches the total (within half a centavo). Non-split payments are trivially valid.
export const validateSplit = (input: SplitValidationInput): SplitValidation => {
	const { paymentMethod, total, amount1, amount2, method1, method2 } = input;
	const amount1Num = parseFloat(amount1) || 0;
	const amount2Num = parseFloat(amount2) || 0;
	const sum = amount1Num + amount2Num;
	const diff = Math.round((total - sum) * 100) / 100;
	const valid =
		paymentMethod !== 'split' ||
		(method1 !== method2 && amount1Num > 0 && amount2Num > 0 && Math.abs(diff) < 0.005);
	return { amount1Num, amount2Num, sum, diff, valid };
};
