// lib/esc_formatter.ts
// Utility for formatting order receipts for ESC/POS printers

import { processLogoForESCPOS } from "./logo_processor";

export interface ReceiptOrderItem {
	name: string;
	qty: number;
	price: number;
	total: number;
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
	paymentMethod?: 'cash' | 'gcash' | 'grab';
	orderType?: string;
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
	}
	lines.push(t(divider()));

	// ── Totals ────────────────────────────────────────────────────────────────
	lines.push(t(totalRow("Subtotal:", formatAmount(order.subtotal))));

	if (order.grabUplift && order.grabUplift > 0) {
		lines.push(t(totalRow("Grab Adj.(+):", `+${formatAmount(order.grabUplift)}`)));
	}

	if (order.discount && order.discount > 0) {
		lines.push(t(totalRow("Discount:", `-${formatAmount(order.discount)}`)));
		if (order.appliedDiscountCode) {
			lines.push(t(center(`(${order.appliedDiscountCode})`) + "\n"));
		}
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

export interface DailySalesItem {
	name: string;
	qty: number;
	total: number;
}

export interface DailySalesData {
	date: string;         // human-readable label e.g. "Mar 15, 2026"
	items: DailySalesItem[];
	totalRevenue: number;
	totalOrders: number;
	storeName?: string;
	branchName?: string;
	paymentBreakdown?: { method: string; orders: number; total: number }[];
}

export async function formatDailySalesESC(data: DailySalesData): Promise<Uint8Array> {
	const enc = new TextEncoder();
	const t = (s: string) => enc.encode(s);
	const lines: (string | Uint8Array)[] = [];

	lines.push(INIT);

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

	// Column header
	lines.push(ALIGN_LEFT);
	lines.push(t(` ${padRight("QTY", 3)} ${padRight("ITEM", 19)} ${padLeft("AMOUNT", 7)}\n`));
	lines.push(t(divider()));

	// Items
	for (const item of data.items) {
		lines.push(t(itemLine(item.qty, item.name, item.total)));
	}
	lines.push(t(divider()));

	// ── Payment method breakdown ──────────────────────────────────────────────
	if (data.paymentBreakdown && data.paymentBreakdown.length > 0) {
		lines.push(t(`${padRight("Payment Type", 13)}${padLeft("ORDERS", 7)}${padLeft("AMOUNT", 12)}\n`));
		lines.push(t(divider()));
		for (const pm of data.paymentBreakdown) {
			lines.push(t(`${padRight(pm.method, 13)}${padLeft(pm.orders.toString(), 7)}${padLeft(formatAmount(pm.total), 12)}\n`));
		}
		lines.push(t(divider()));
	}

	// Totals
	lines.push(t(totalRow("Total Orders:", data.totalOrders.toString())));
	lines.push(t(divider("=")));
	lines.push(BOLD_ON);
	lines.push(t(totalRow("TOTAL REVENUE:", formatAmount(data.totalRevenue))));
	lines.push(BOLD_OFF);
	lines.push(t(divider("=")));

	lines.push(t("\n\n\n"));
	lines.push(CUT);

	return assembleBytes(lines);
}
