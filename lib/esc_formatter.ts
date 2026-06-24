// lib/esc_formatter.ts
// Utility for formatting order receipts for ESC/POS printers

import { processLogoForESCPOS } from "./logo_processor";

export interface ReceiptOrderItem {
	name: string;
	qty: number;
	price: number;
	total: number;
	isPriceOverride?: boolean;
	originalPrice?: number;
}

export interface ReceiptOrderData {
	orderId: string;
	date: Date;
	items: ReceiptOrderItem[];
	subtotal: number;
	discount?: number;
	grabUplift?: number;
	total: number;
	payment: number;
	change: number;
	cashier?: string;
	cashierEmployeeId?: string;
	storeName?: string;
	branchName?: string;
	appliedDiscountCode?: string;
	isB1T1Promo?: boolean;
	discountType?: 'percentage' | 'fixed' | 'b1t1' | 'sc_pwd' | string;
	paymentMethod?: 'cash' | 'gcash' | 'grab' | 'debit_credit' | 'employee_charge' | 'split';
	orderType?: string;
	transactionNumber?: string;
	paymentDetails?: Record<string, string> | null;
}

// ─── Layout constants ────────────────────────────────────────────────────────
const W = 32; // 58mm thermal printer = 32 chars per line

function padRight(str: string, len: number): string {
	if (str.length >= len) return str.slice(0, len);
	return str + " ".repeat(len - str.length);
}
function padLeft(str: string, len: number): string {
	if (str.length >= len) return str.slice(0, len);
	return " ".repeat(len - str.length) + str;
}
function center(str: string): string {
	if (str.length >= W) return str.slice(0, W);
	const totalPad = W - str.length;
	const left = Math.floor(totalPad / 2);
	return " ".repeat(left) + str + " ".repeat(totalPad - left);
}
function divider(char = "-"): string {
	return char.repeat(W) + "\n";
}
function formatAmount(n: number): string {
	return n.toFixed(2);
}
function formatPayment(method?: string): string {
	if (!method) return "Cash";
	if (method === "gcash") return "GCash";
	if (method === "grab") return "GrabFood";
	if (method === "debit_credit") return "Debit/Credit";
	if (method === "employee_charge") return "Employee Charge";
	if (method === "split") return "Split";
	return "Cash";
}

function shortPaymentLabel(method?: string): string {
	if (!method) return "Cash";
	if (method === "gcash") return "GCash";
	if (method === "grab") return "Grab";
	if (method === "debit_credit") return "Debit/Credit";
	if (method === "employee_charge") return "Emp Charge";
	return "Cash";
}
function formatDate(date: Date): string {
	return date.toLocaleString("en-PH", {
		month: "2-digit",
		day: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	});
}

// ─── Item line ────────────────────────────────────────────────────────────────
// Format: " QTY NAME                TOTAL"
//           3   1  19               1  8   = 32
function itemLine(qty: number, name: string, total: number): string {
	const q = padLeft(qty.toString(), 3);
	const n = padRight(name, 19);
	const a = padLeft(formatAmount(total), 8);
	return `${q} ${n} ${a}\n`;
}

// ─── Total row ────────────────────────────────────────────────────────────────
// Format: "          Label:        0.00"
//          22-char label           10-char amount  = 32
function totalRow(label: string, amount: string): string {
	return padLeft(label, 22) + padLeft(amount, 10) + "\n";
}

// ─── ESC/POS helpers ─────────────────────────────────────────────────────────
function esc(...bytes: number[]): Uint8Array {
	return new Uint8Array(bytes);
}
const INIT        = esc(0x1b, 0x40);
const ALIGN_LEFT  = esc(0x1b, 0x61, 0x00);
const ALIGN_CTR   = esc(0x1b, 0x61, 0x01);
const BOLD_ON     = esc(0x1b, 0x45, 0x01);
const BOLD_OFF    = esc(0x1b, 0x45, 0x00);
const SIZE_NORMAL = esc(0x1d, 0x21, 0x00);
const SIZE_TALL   = esc(0x1d, 0x21, 0x01); // 2× height
const CUT         = esc(0x1d, 0x56, 0x00);
const FONT_A      = esc(0x1b, 0x4d, 0x00); // Font A — normal default

// ─── Build a single receipt copy ─────────────────────────────────────────────
async function buildCopy(
	order: ReceiptOrderData,
	copyType: "customer" | "establishment",
	logoBitmap: Uint8Array | null
): Promise<(string | Uint8Array)[]> {
	const enc = new TextEncoder();
	const t = (s: string) => enc.encode(s);
	const lines: (string | Uint8Array)[] = [];

	lines.push(INIT);
	lines.push(FONT_A);

	// ── Logo (customer copy only) ────────────────────────────────────────────
	if (copyType === "customer" && logoBitmap && logoBitmap.length > 0) {
		lines.push(ALIGN_CTR);
		lines.push(logoBitmap);
		lines.push(t("\n"));
	}

	// ── Store name & branch ───────────────────────────────────────────────────
	lines.push(ALIGN_CTR);
	if (order.storeName) {
		lines.push(BOLD_ON, SIZE_TALL);
		lines.push(t(center(order.storeName) + "\n"));
		lines.push(SIZE_NORMAL, BOLD_OFF);
	}
	if (order.branchName) {
		lines.push(t(center(order.branchName) + "\n"));
	}

	// ── Copy label ────────────────────────────────────────────────────────────
	lines.push(t(divider("=")));
	lines.push(BOLD_ON);
	const label = copyType === "customer" ? "-- CUSTOMER COPY --" : "-- CASHIER COPY --";
	lines.push(t(center(label) + "\n"));
	lines.push(BOLD_OFF);
	lines.push(t(divider("=")));

	// ── Order meta ────────────────────────────────────────────────────────────
	lines.push(ALIGN_LEFT);
	const shortId = order.orderId.length > 18 ? order.orderId.slice(-18) : order.orderId;
	lines.push(t(`Order: ${shortId}\n`));
	lines.push(t(`Date:  ${formatDate(order.date)}\n`));
	if (order.orderType) {
		lines.push(t(`Type:  ${order.orderType}\n`));
	}
	lines.push(t(`Pay:   ${formatPayment(order.paymentMethod)}\n`));
	if (order.transactionNumber) {
		lines.push(t(`Txn#:  ${order.transactionNumber}\n`));
	}
	if (order.paymentMethod === 'debit_credit' && order.paymentDetails) {
		if (order.paymentDetails.reference_no) lines.push(t(`Ref#:  ${order.paymentDetails.reference_no}\n`));
		if (order.paymentDetails.transaction_no) lines.push(t(`Txn#:  ${order.paymentDetails.transaction_no}\n`));
		if (order.paymentDetails.approval_code) lines.push(t(`Appr:  ${order.paymentDetails.approval_code}\n`));
	}
	if (order.paymentMethod === 'employee_charge' && order.paymentDetails?.employee_name) {
		lines.push(t(`Emp:   ${order.paymentDetails.employee_name}\n`));
	}
	if (order.paymentMethod === 'split' && order.paymentDetails) {
		const d = order.paymentDetails;
		const m1 = shortPaymentLabel(d.split_method_1);
		const a1 = parseFloat(d.split_amount_1 || '0');
		const m2 = shortPaymentLabel(d.split_method_2);
		const a2 = parseFloat(d.split_amount_2 || '0');
		lines.push(t(`  1) ${m1}: ${formatAmount(a1)}\n`));
		if (d.split_txn_1) lines.push(t(`     Txn#: ${d.split_txn_1}\n`));
		lines.push(t(`  2) ${m2}: ${formatAmount(a2)}\n`));
		if (d.split_txn_2) lines.push(t(`     Txn#: ${d.split_txn_2}\n`));
	}
	if (order.cashier) {
		const byLine = copyType === "establishment" && order.cashierEmployeeId
			? `By:    ${order.cashier} (${order.cashierEmployeeId})\n`
			: `By:    ${order.cashier}\n`;
		// Wrap long cashier line
		lines.push(t(byLine.length > W + 1 ? byLine.slice(0, W) + "\n" : byLine));
	}
	lines.push(t(divider()));

	// ── Items ─────────────────────────────────────────────────────────────────
	lines.push(t(` ${padRight("QTY", 3)} ${padRight("ITEM", 19)} ${padLeft("AMOUNT", 7)}\n`));
	lines.push(t(divider()));

	for (const item of order.items) {
		lines.push(t(itemLine(item.qty, item.name, item.total)));
		if (item.isPriceOverride) {
			// Compact note: "  *Price adj. (orig: 0.00)"
			const orig = item.originalPrice !== undefined ? ` orig:${formatAmount(item.originalPrice)}` : '';
			lines.push(t(`  *Price adjusted${orig}\n`));
		}
	}
	lines.push(t(divider()));

	// ── Totals ────────────────────────────────────────────────────────────────
	const hasDiscount = order.discount && order.discount > 0;
	if (hasDiscount) {
		lines.push(t(totalRow("Subtotal:", formatAmount(order.subtotal))));
		// Build a compact discount label
		let discLabel: string;
		if (order.paymentMethod === 'grab') {
			discLabel = "Grab Disc:";
		} else if (order.discountType === 'b1t1' || order.isB1T1Promo) {
			discLabel = "B1T1 Savings:";
		} else if (order.discountType === 'sc_pwd') {
			discLabel = "SC/PWD Disc:";
		} else if (order.appliedDiscountCode) {
			// Truncate code so the whole label fits within 22 chars: "Disc(CODE):" max
			const maxCode = 22 - "Disc():".length;
			const code = order.appliedDiscountCode.slice(0, maxCode);
			discLabel = `Disc(${code}):`;
		} else {
			discLabel = "Discount:";
		}
		lines.push(t(totalRow(discLabel, `-${formatAmount(order.discount!)}`)));
	}
	lines.push(t(divider("=")));
	lines.push(BOLD_ON);
	lines.push(t(totalRow("TOTAL:", formatAmount(order.total))));
	lines.push(BOLD_OFF);
	lines.push(t(divider("=")));

	// ── Footer ────────────────────────────────────────────────────────────────
	if (copyType === "customer") {
		lines.push(ALIGN_CTR);
		const storeName = order.storeName || "our store";
		lines.push(t(`  Thank you for dining with\n`));
		lines.push(BOLD_ON);
		lines.push(t(center(storeName) + "\n"));
		lines.push(BOLD_OFF);
		lines.push(t(`  Please come back soon :)\n`));
		lines.push(t(divider("=")));
	}

	lines.push(t("\n\n\n"));
	lines.push(CUT);

	return lines;
}

// ─── Concatenate lines → Uint8Array ──────────────────────────────────────────
function assembleBytes(lines: (string | Uint8Array)[]): Uint8Array {
	const enc = new TextEncoder();
	const parts: Uint8Array[] = lines.map((l) =>
		l instanceof Uint8Array ? l : enc.encode(l)
	);
	const total = parts.reduce((s, p) => s + p.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const p of parts) {
		out.set(p, offset);
		offset += p.length;
	}
	return out;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function formatReceiptESC(
	order: ReceiptOrderData,
	logoUrl?: string,
	copies: ("customer" | "establishment")[] = ["customer", "establishment"]
): Promise<Uint8Array> {
	let logoBitmap: Uint8Array | null = null;
	if (logoUrl) {
		try {
			const bitmap = await processLogoForESCPOS(logoUrl, 384, true);
			if (bitmap.length > 0) logoBitmap = bitmap;
		} catch (e) {
			console.error("Failed to process logo:", e);
		}
	}

	const allLines: (string | Uint8Array)[] = [];
	for (const copy of copies) {
		const copyLines = await buildCopy(order, copy, logoBitmap);
		allLines.push(...copyLines);
	}

	return assembleBytes(allLines);
}

/** Prints both customer + establishment copies with FoodMood logo */
export async function formatReceiptWithLogo(
	order: ReceiptOrderData
): Promise<Uint8Array> {
	return formatReceiptESC(order, "/escpos_image.png", ["customer", "establishment"]);
}

/** Single copy for a specific use case */
export async function formatReceiptWithCustomLogo(
	order: ReceiptOrderData,
	logoUrl: string,
	copies?: ("customer" | "establishment")[]
): Promise<Uint8Array> {
	return formatReceiptESC(order, logoUrl, copies);
}

// ─── Daily sales summary ──────────────────────────────────────────────────────

export interface DailySalesOrderItem {
	name: string;
	qty: number;
	total: number;
}

export interface DailySalesOrder {
	orderId: string;
	items: DailySalesOrderItem[];
	total: number;
	transactionNumber?: string;
}

export interface DailySalesGroup {
	method: 'Cash' | 'GCash' | 'Grab' | 'Debit/Credit' | 'Split';
	orders: DailySalesOrder[];
	gross: number;
	net?: number; // Grab only: gross * 0.73
}

export interface DailySalesData {
	date: string;
	groups: DailySalesGroup[];
	totalOrders: number;
	netRevenue: number; // Cash + GCash + Grab*0.73
	storeName?: string;
	branchName?: string;
	cashier?: string;
}

// Item line for sales summary — wraps name to next line instead of truncating
function salesItemLine(name: string, qty: number, total: number): string {
	const amtStr = formatAmount(total);
	const label = `  ${name} x${qty}`;
	if (label.length + 1 + amtStr.length <= W) {
		return label + padLeft(amtStr, W - label.length) + "\n";
	}
	// Name too long — put it on its own line, amount right-aligned below
	return label + "\n" + padLeft(amtStr, W) + "\n";
}

export async function formatDailySalesESC(data: DailySalesData): Promise<Uint8Array> {
	const enc = new TextEncoder();
	const t = (s: string) => enc.encode(s);
	const lines: (string | Uint8Array)[] = [];

	lines.push(INIT);
	lines.push(FONT_A);

	// Header
	lines.push(ALIGN_CTR);
	if (data.storeName) {
		lines.push(BOLD_ON, SIZE_TALL);
		lines.push(t(center(data.storeName) + "\n"));
		lines.push(SIZE_NORMAL, BOLD_OFF);
	}
	if (data.branchName) {
		lines.push(t(center(data.branchName) + "\n"));
	}
	lines.push(t(divider("=")));
	lines.push(BOLD_ON);
	lines.push(t(center("SALES SUMMARY") + "\n"));
	lines.push(BOLD_OFF);
	lines.push(t(center(data.date) + "\n"));
	lines.push(t(divider("=")));

	// Payment groups — one order per block, listed chronologically
	lines.push(ALIGN_LEFT);
	for (const group of data.groups) {
		lines.push(t(divider("=")));
		lines.push(BOLD_ON);
		lines.push(t(center(group.method) + "\n"));
		lines.push(BOLD_OFF);

		for (const order of group.orders) {
			lines.push(t(divider()));
			lines.push(BOLD_ON);
			lines.push(t(`#${order.orderId}\n`));
			lines.push(BOLD_OFF);
			if (order.transactionNumber) {
				lines.push(t(`Txn#: ${order.transactionNumber}\n`));
			}
			for (const item of order.items) {
				lines.push(t(salesItemLine(item.name, item.qty, item.total)));
			}
			lines.push(t(totalRow("Order Total:", formatAmount(order.total))));
		}

		lines.push(t(divider("=")));
		lines.push(t(totalRow("Group Total:", formatAmount(group.gross))));
		if (group.method === 'Grab' && group.net !== undefined) {
			const grabFees = group.gross - group.net;
			lines.push(t(totalRow("Grab Fees:", `-${formatAmount(grabFees)}`)));
			lines.push(t(totalRow("Net Grab:", formatAmount(group.net))));
		}
	}

	// Grand totals
	lines.push(t(divider("=")));
	lines.push(t(totalRow("Total Orders:", data.totalOrders.toString())));
	lines.push(t(divider("=")));
	lines.push(BOLD_ON);
	lines.push(t(totalRow("TOTAL REVENUE:", formatAmount(data.netRevenue))));
	lines.push(BOLD_OFF);
	lines.push(t(divider("=")));

	if (data.cashier) {
		lines.push(t(`Printed by: ${data.cashier}\n`));
	}

	lines.push(t("\n\n\n"));
	lines.push(CUT);

	return assembleBytes(lines);
}

// ─── Shift Report ──────────────────────────────────────────────────────────

export interface ShiftReportPrintData {
	shiftDetails: {
		cashierName: string;
		beginningCash: number;
		openedAt: string;
		closedAt: string;
	};
	salesSummary: {
		totalCash: number;
		totalGCash: number;
		totalGrab: number;
		totalDebitCredit: number;
		totalEmployeeCharge: number;
		totalSales: number;
	};
	adjustments: {
		voidCount: number;
		voidTotal: number;
		refundCount: number;
		refundTotal: number;
		employeeDiscountCount: number;
		employeeDiscountTotal: number;
		scPwdDiscountCount: number;
		scPwdDiscountTotal: number;
		freeCount: number;
		freeTotal: number;
		nearExpiryCount: number;
		nearExpiryTotal: number;
	};
	cashMonitoring: {
		beginningCash: number;
		cashSales: number;
		cashRefunds: number;
		safeDrops: number;
		payout: number;
		expectedCash: number;
		actualCash: number;
		overShort: number;
	};
	others: {
		safeDropTotal: number;
		safeDropCount: number;
		payoutTotal: number;
		transactionCount: number;
		remarks: string | null;
	};
	storeName: string;
	branchName: string;
}

export async function formatShiftReportESC(data: ShiftReportPrintData): Promise<Uint8Array> {
	const enc = new TextEncoder();
	const t = (s: string) => enc.encode(s);
	const lines: (string | Uint8Array)[] = [];

	lines.push(INIT, FONT_A);

	// Header
	lines.push(ALIGN_CTR);
	lines.push(BOLD_ON, SIZE_TALL);
	lines.push(t(center(data.storeName) + "\n"));
	lines.push(SIZE_NORMAL, BOLD_OFF);
	lines.push(t(center(data.branchName) + "\n"));
	lines.push(t(divider("=")));
	lines.push(BOLD_ON);
	lines.push(t(center("SHIFT REPORT") + "\n"));
	lines.push(BOLD_OFF);
	lines.push(t(divider("=")));

	// Shift Details
	lines.push(ALIGN_LEFT);
	lines.push(BOLD_ON);
	lines.push(t("-- SHIFT DETAILS --\n"));
	lines.push(BOLD_OFF);
	lines.push(t(`Cashier: ${data.shiftDetails.cashierName}\n`));
	lines.push(t(totalRow("Change Fund:", formatAmount(data.shiftDetails.beginningCash))));
	lines.push(t(`Opened: ${formatDate(new Date(data.shiftDetails.openedAt))}\n`));
	lines.push(t(`Closed: ${formatDate(new Date(data.shiftDetails.closedAt))}\n`));
	lines.push(t(divider()));

	// Sales Summary
	lines.push(BOLD_ON);
	lines.push(t("-- SALES SUMMARY --\n"));
	lines.push(BOLD_OFF);
	const ss = data.salesSummary;
	lines.push(t(totalRow("Total Cash:", formatAmount(ss.totalCash))));
	lines.push(t(totalRow("Total GCash:", formatAmount(ss.totalGCash))));
	lines.push(t(totalRow("Total Grab:", formatAmount(ss.totalGrab))));
	lines.push(t(totalRow("Total Debit/Credit:", formatAmount(ss.totalDebitCredit))));
	if (ss.totalEmployeeCharge > 0) {
		lines.push(t(totalRow("Employee Charge:", formatAmount(ss.totalEmployeeCharge))));
	}
	lines.push(t(divider()));
	lines.push(BOLD_ON);
	lines.push(t(totalRow("TOTAL SALES:", formatAmount(ss.totalSales))));
	lines.push(BOLD_OFF);
	lines.push(t(divider()));

	// Adjustments
	lines.push(BOLD_ON);
	lines.push(t("-- ADJUSTMENTS --\n"));
	lines.push(BOLD_OFF);
	const adj = data.adjustments;
	lines.push(t(totalRow(`Void(${adj.voidCount}):`, formatAmount(adj.voidTotal))));
	lines.push(t(totalRow(`Refunds(${adj.refundCount}):`, formatAmount(adj.refundTotal))));
	lines.push(t(totalRow(`Emp Disc(${adj.employeeDiscountCount}):`, formatAmount(adj.employeeDiscountTotal))));
	lines.push(t(totalRow(`SC/PWD(${adj.scPwdDiscountCount}):`, formatAmount(adj.scPwdDiscountTotal))));
	lines.push(t(totalRow(`Free(${adj.freeCount}):`, formatAmount(adj.freeTotal))));
	lines.push(t(totalRow(`Near Exp(${adj.nearExpiryCount}):`, formatAmount(adj.nearExpiryTotal))));
	lines.push(t(divider()));

	// Cash Monitoring
	lines.push(BOLD_ON);
	lines.push(t("-- CASH MONITORING --\n"));
	lines.push(BOLD_OFF);
	const cm = data.cashMonitoring;
	lines.push(t(totalRow("Beginning Cash:", formatAmount(cm.beginningCash))));
	lines.push(t(totalRow("(+) Cash Sales:", formatAmount(cm.cashSales))));
	lines.push(t(totalRow("(-) Cash Refunds:", formatAmount(cm.cashRefunds))));
	lines.push(t(totalRow("(-) Safe Drops:", formatAmount(cm.safeDrops))));
	lines.push(t(totalRow("(-) Payout:", formatAmount(cm.payout))));
	lines.push(t(divider()));
	lines.push(BOLD_ON);
	lines.push(t(totalRow("= Expected Cash:", formatAmount(cm.expectedCash))));
	lines.push(t(totalRow("Actual Cash:", formatAmount(cm.actualCash))));
	const osSign = cm.overShort >= 0 ? "+" : "";
	lines.push(t(totalRow("Over/Short:", `${osSign}${formatAmount(cm.overShort)}`)));
	lines.push(BOLD_OFF);
	lines.push(t(divider()));

	// Others
	lines.push(BOLD_ON);
	lines.push(t("-- OTHERS --\n"));
	lines.push(BOLD_OFF);
	const oth = data.others;
	lines.push(t(totalRow(`Safe Drop(${oth.safeDropCount}):`, formatAmount(oth.safeDropTotal))));
	lines.push(t(totalRow("Payout/Expenses:", formatAmount(oth.payoutTotal))));
	lines.push(t(totalRow("Transactions:", oth.transactionCount.toString())));
	if (oth.remarks) {
		lines.push(t(`Remarks: ${oth.remarks}\n`));
	}
	lines.push(t(divider("=")));

	lines.push(t("\n\n\n"));
	lines.push(CUT);

	return assembleBytes(lines);
}
