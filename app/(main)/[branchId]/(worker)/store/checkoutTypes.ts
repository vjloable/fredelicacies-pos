// Shared checkout types for the store screen.
//
// Extracted from the StoreScreen god-component so the cart line shape and the
// payment-method unions can be reused by the checkout hooks (useCheckoutTotals,
// useCart) without duplicating the inline type literals.
import type { BundleComponent } from "@/types/domain";

export type PaymentMethod =
	| 'cash'
	| 'gcash'
	| 'grab'
	| 'debit_credit'
	| 'employee_charge'
	| 'split';

export type SplitMethod = 'cash' | 'gcash' | 'debit_credit';

export type CartLine = {
	id: string;
	bundleId?: string | null;
	name: string;
	price: number;
	grab_price?: number | null;
	cost?: number;
	quantity: number;
	originalStock: number;
	imgUrl?: string | null;
	categoryId: number | string;
	categoryIds?: string[];
	type?: 'item' | 'bundle';
	is_custom?: boolean;
	isFoodHouse?: boolean;
	components?: BundleComponent[];
	isB1T1?: boolean;
	regularPrice?: number;
	isPriceOverride?: boolean;
	isPriced?: boolean;
	originalPrice?: number;
	// Absolute whole-line pricing. When priceMode='whole', wholePrice is the
	// authoritative line total and price is a display-only per-piece figure.
	priceMode?: 'per_piece' | 'whole';
	wholePrice?: number | null;
	// Grab equivalents: grab_price is the display-only per-piece figure when
	// grabPriceMode='whole', where grabWholePrice is the authoritative line total.
	grabPriceMode?: 'per_piece' | 'whole';
	grabWholePrice?: number | null;
};
