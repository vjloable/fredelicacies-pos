"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
	LineChart,
	Line,
	BarChart,
	Bar,
	PieChart,
	Pie,
	Cell,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getOrdersByBranch, getOrdersPage, subscribeToOrderInserts } from "@/services/orderService";
import type { OrderWithItems, OrderItem, WastageItemSummary, WastageLog } from "@/types/domain";
import { formatCurrency } from "@/services/salesService";
import { getWastageSummary, getTopWastedItems, getWastageLogs } from "@/services/wastageService";
import { useBranch } from "@/contexts/BranchContext";
import SearchIcon from "../../(worker)/store/icons/SearchIcon";
import SalesIcon from "@/components/icons/SidebarNav/SalesIcon";
import LogoIcon from "../../(worker)/store/icons/LogoIcon";
import { DayPicker, WeekPicker, MonthPicker, YearPicker } from "./DatePickers";
import * as XLSX from "xlsx";
import { formatReceiptWithLogo, formatDailySalesESC } from "@/lib/esc_formatter";
import { useBluetoothPrinter } from "@/contexts/BluetoothContext";

interface TimeSeriesData {
	label: string;
	date: string;
	orders: number;
	revenue: number;
	profit: number;
}

type ViewMode = "day" | "week" | "month" | "year" | "all";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const getWeekOfMonth = (d: Date) => Math.min(4, Math.ceil(d.getDate() / 7));

const computeDateRange = (
	mode: ViewMode,
	day: string,
	week: { week: number; month: number; year: number },
	month: { month: number; year: number },
	year: number
): { startDate: Date; endDate: Date } => {
	switch (mode) {
		case "day": {
			const [y, m, d_] = day.split("-").map(Number);
			return { startDate: new Date(y, m - 1, d_, 0, 0, 0, 0), endDate: new Date(y, m - 1, d_, 23, 59, 59, 999) };
		}
		case "week": {
			const startDay = (week.week - 1) * 7 + 1;
			const lastDayOfMonth = new Date(week.year, week.month + 1, 0).getDate();
			const endDay = week.week === 4 ? lastDayOfMonth : Math.min(week.week * 7, lastDayOfMonth);
			return {
				startDate: new Date(week.year, week.month, startDay, 0, 0, 0, 0),
				endDate: new Date(week.year, week.month, endDay, 23, 59, 59, 999),
			};
		}
		case "month":
			return {
				startDate: new Date(month.year, month.month, 1, 0, 0, 0, 0),
				endDate: new Date(month.year, month.month + 1, 0, 23, 59, 59, 999),
			};
		case "year":
			return {
				startDate: new Date(year, 0, 1, 0, 0, 0, 0),
				endDate: new Date(year, 11, 31, 23, 59, 59, 999),
			};
		case "all":
			return { startDate: new Date(2020, 0, 1), endDate: new Date() };
	}
};

const computePriorDateRange = (
	mode: ViewMode,
	day: string,
	week: { week: number; month: number; year: number },
	month: { month: number; year: number },
	year: number
): { startStr: string; endStr: string } | null => {
	switch (mode) {
		case "day": {
			const [y, m, d_] = day.split("-").map(Number);
			const prev = new Date(y, m - 1, d_ - 1);
			const s = prev.toISOString().slice(0, 10);
			return { startStr: s, endStr: s };
		}
		case "week": {
			const { week: w, month: mo, year: ye } = week;
			if (w === 1) {
				const pm = mo === 0 ? 11 : mo - 1;
				const py = mo === 0 ? ye - 1 : ye;
				const lastDay = new Date(py, pm + 1, 0).getDate();
				return {
					startStr: new Date(py, pm, 22).toISOString().slice(0, 10),
					endStr: new Date(py, pm, lastDay).toISOString().slice(0, 10),
				};
			}
			const sd = (w - 2) * 7 + 1;
			const ed = (w - 1) * 7;
			return {
				startStr: new Date(ye, mo, sd).toISOString().slice(0, 10),
				endStr: new Date(ye, mo, ed).toISOString().slice(0, 10),
			};
		}
		case "month": {
			const { month: mo, year: ye } = month;
			const pm = mo === 0 ? 11 : mo - 1;
			const py = mo === 0 ? ye - 1 : ye;
			return {
				startStr: new Date(py, pm, 1).toISOString().slice(0, 10),
				endStr: new Date(py, pm + 1, 0).toISOString().slice(0, 10),
			};
		}
		case "year":
			return {
				startStr: new Date(year - 1, 0, 1).toISOString().slice(0, 10),
				endStr: new Date(year - 1, 11, 31).toISOString().slice(0, 10),
			};
		case "all":
			return null;
	}
};

const buildTimeSeriesData = (
	orders: OrderWithItems[],
	mode: ViewMode,
	startDate: Date,
	endDate: Date,
	selYear: number
): TimeSeriesData[] => {
	const data: TimeSeriesData[] = [];
	if (mode === "day") {
		for (let hour = 0; hour < 24; hour++) {
			const hourStart = new Date(startDate);
			hourStart.setHours(hour, 0, 0, 0);
			const hourEnd = new Date(startDate);
			hourEnd.setHours(hour, 59, 59, 999);
			const hourOrders = orders.filter(o => {
				if (!o.created_at) return false;
				const d = new Date(o.created_at);
				return d >= hourStart && d <= hourEnd;
			});
			data.push({
				label: `${hour.toString().padStart(2, "0")}:00`,
				date: hourStart.toISOString(),
				orders: hourOrders.length,
				revenue: hourOrders.reduce((s, o) => s + o.total, 0),
				profit: hourOrders.reduce((s, o) => s + calculateOrderProfit(o), 0),
			});
		}
	} else if (mode === "week" || mode === "month") {
		const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
		for (let i = 0; i < days; i++) {
			const dayStart = new Date(startDate);
			dayStart.setDate(startDate.getDate() + i);
			dayStart.setHours(0, 0, 0, 0);
			const dayEnd = new Date(dayStart);
			dayEnd.setHours(23, 59, 59, 999);
			const dayOrders = orders.filter(o => {
				if (!o.created_at) return false;
				const d = new Date(o.created_at);
				return d >= dayStart && d <= dayEnd;
			});
			data.push({
				label: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
				date: dayStart.toISOString(),
				orders: dayOrders.length,
				revenue: dayOrders.reduce((s, o) => s + o.total, 0),
				profit: dayOrders.reduce((s, o) => s + calculateOrderProfit(o), 0),
			});
		}
	} else if (mode === "year") {
		for (let m = 0; m < 12; m++) {
			const monthStart = new Date(selYear, m, 1, 0, 0, 0, 0);
			const monthEnd = new Date(selYear, m + 1, 0, 23, 59, 59, 999);
			const monthOrders = orders.filter(o => {
				if (!o.created_at) return false;
				const d = new Date(o.created_at);
				return d >= monthStart && d <= monthEnd;
			});
			data.push({
				label: MONTHS_SHORT[m],
				date: monthStart.toISOString(),
				orders: monthOrders.length,
				revenue: monthOrders.reduce((s, o) => s + o.total, 0),
				profit: monthOrders.reduce((s, o) => s + calculateOrderProfit(o), 0),
			});
		}
	} else {
		if (orders.length === 0) return [];
		const earliest = orders.reduce((min, o) => {
			const d = new Date(o.created_at);
			return d < min ? d : min;
		}, new Date());
		const now = new Date();
		let cur = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
		while (cur <= now) {
			const monthStart = new Date(cur);
			const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999);
			const monthOrders = orders.filter(o => {
				if (!o.created_at) return false;
				const d = new Date(o.created_at);
				return d >= monthStart && d <= monthEnd;
			});
			data.push({
				label: monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
				date: monthStart.toISOString(),
				orders: monthOrders.length,
				revenue: monthOrders.reduce((s, o) => s + o.total, 0),
				profit: monthOrders.reduce((s, o) => s + calculateOrderProfit(o), 0),
			});
			cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
		}
	}
	return data;
};

const calculateOrderProfit = (order: OrderWithItems): number => {
	return order.items.reduce((sum, item) => {
		return sum + (item.price - (item.cost || 0)) * item.quantity;
	}, 0);
};

export default function SalesScreen() {
	const { currentBranch } = useBranch();
	const { printReceipt } = useBluetoothPrinter();
	const [isPrinting, setIsPrinting] = useState(false);

	// ── Date selection state ──────────────────────────────────────────────────
	const [viewMode, setViewMode] = useState<ViewMode>("day");
	const [selDay, setSelDay] = useState(() => new Date().toISOString().slice(0, 10));
	const [selWeek, setSelWeek] = useState(() => {
		const n = new Date();
		return { week: getWeekOfMonth(n), month: n.getMonth(), year: n.getFullYear() };
	});
	const [selMonth, setSelMonth] = useState(() => {
		const n = new Date();
		return { month: n.getMonth(), year: n.getFullYear() };
	});
	const [selYear, setSelYear] = useState(() => new Date().getFullYear());

	// ── Data state ────────────────────────────────────────────────────────────
	const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
	const [analyticsOrders, setAnalyticsOrders] = useState<OrderWithItems[]>([]);
	const [analyticsLoading, setAnalyticsLoading] = useState(true);
	const [tableOrders, setTableOrders] = useState<OrderWithItems[]>([]);
	const [totalTableCount, setTotalTableCount] = useState(0);
	const [tableLoading, setTableLoading] = useState(true);
	const [tablePage, setTablePage] = useState(1);
	const PAGE_SIZE = 10;
	const [currentPeriodStats, setCurrentPeriodStats] = useState({
		totalRevenue: 0,
		totalOrders: 0,
		totalProfit: 0,
		profitMargin: 0,
	});

	const paymentBreakdown = useMemo(() => {
		const map = { cash: { orders: 0, total: 0 }, gcash: { orders: 0, total: 0 }, grab: { orders: 0, total: 0 } };
		analyticsOrders.forEach(o => {
			const method = ((o.payment_method as string) || 'cash').toLowerCase() as keyof typeof map;
			if (map[method]) { map[method].orders++; map[method].total += o.total; }
		});
		return [
			{ name: 'Cash', ...map.cash, color: 'var(--accent)' },
			{ name: 'GCash', ...map.gcash, color: '#007CFF' },
			{ name: 'Grab', ...map.grab, color: '#02B150' },
		];
	}, [analyticsOrders]);
	const [wastageBarData, setWastageBarData] = useState<{ label: string; wastage: number }[]>([]);
	const [topWastedItems, setTopWastedItems] = useState<WastageItemSummary[]>([]);
	const [wastageLogs, setWastageLogs] = useState<WastageLog[]>([]);
	const [totalWastageCost, setTotalWastageCost] = useState(0);
	const [prevWastageCost, setPrevWastageCost] = useState<number | null>(null);
	const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
	const [searchTerm, setSearchTerm] = useState("");

	const handleReprint = async (order: OrderWithItems) => {
		if (isPrinting) return;
		setIsPrinting(true);
		try {
			const receiptData = {
				orderId: order.order_number || order.id,
				date: new Date(order.created_at),
				items: order.items.map((item) => ({
					name: item.name,
					qty: item.quantity,
					price: item.price,
					total: item.price * item.quantity,
				})),
				subtotal: order.subtotal,
				discount: order.discount_amount,
				total: order.total,
				payment: order.total,
				change: 0,
				storeName: "FREDELECACIES",
				branchName: currentBranch?.name,
				paymentMethod: order.payment_method,
			};
			const bytes = await formatReceiptWithLogo(receiptData);
			await printReceipt(bytes);
		} catch (e) {
			console.error("Reprint failed:", e);
		} finally {
			setIsPrinting(false);
		}
	};

	const handlePrintDailySales = async () => {
		if (isPrinting) return;
		setIsPrinting(true);
		try {
			// Aggregate items across all orders in the current period
			const itemMap = new Map<string, { qty: number; total: number }>();
			for (const order of analyticsOrders) {
				for (const item of order.items) {
					const existing = itemMap.get(item.name);
					if (existing) {
						existing.qty += item.quantity;
						existing.total += item.price * item.quantity;
					} else {
						itemMap.set(item.name, { qty: item.quantity, total: item.price * item.quantity });
					}
				}
			}
			const items = Array.from(itemMap.entries())
				.map(([name, { qty, total }]) => ({ name, qty, total }))
				.sort((a, b) => b.total - a.total);

			const pmMap = new Map<string, { orders: number; total: number }>();
			for (const order of analyticsOrders) {
				const raw = ((order.payment_method as string) || 'cash').toLowerCase();
				const m = raw === 'gcash' ? 'GCash' : raw === 'grab' ? 'Grab' : 'Cash';
				const entry = pmMap.get(m);
				if (entry) { entry.orders++; entry.total += order.total; }
				else { pmMap.set(m, { orders: 1, total: order.total }); }
			}
			const paymentBreakdown = Array.from(pmMap.entries())
				.map(([method, { orders, total }]) => ({ method, orders, total }))
				.sort((a, b) => b.total - a.total);

			const bytes = await formatDailySalesESC({
				date: periodLabel.replace(/_/g, " "),
				items,
				totalRevenue: currentPeriodStats.totalRevenue,
				totalOrders: currentPeriodStats.totalOrders,
				storeName: "FREDELECACIES",
				branchName: currentBranch?.name,
				paymentBreakdown,
			});
			await printReceipt(bytes);
		} catch (e) {
			console.error("Daily sales print failed:", e);
		} finally {
			setIsPrinting(false);
		}
	};

	// ── Analytics fetch ───────────────────────────────────────────────────────

	const fetchAnalytics = useCallback(async () => {
		if (!currentBranch) return;
		const { startDate, endDate } = computeDateRange(viewMode, selDay, selWeek, selMonth, selYear);
		const { orders } =
			viewMode === "all"
				? await getOrdersByBranch(currentBranch.id)
				: await getOrdersByBranch(currentBranch.id, startDate, endDate);
		setAnalyticsOrders(orders);
		setTimeSeriesData(buildTimeSeriesData(orders, viewMode, startDate, endDate, selYear));
		const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
		const totalOrders = orders.length;
		const totalProfit = orders.reduce((s, o) => s + calculateOrderProfit(o), 0);
		const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
		setCurrentPeriodStats({ totalRevenue, totalOrders, totalProfit, profitMargin });
		setAnalyticsLoading(false);
	}, [currentBranch, viewMode, selDay, selWeek, selMonth, selYear]);

	useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

	// ── Table fetch ───────────────────────────────────────────────────────────

	const fetchTablePage = useCallback(async () => {
		if (!currentBranch) return;
		setTableLoading(true);
		const { orders, totalCount } = await getOrdersPage(
			currentBranch.id, tablePage, PAGE_SIZE, searchTerm || undefined
		);
		setTableOrders(orders);
		setTotalTableCount(totalCount);
		setTableLoading(false);
	}, [currentBranch, tablePage, searchTerm]);

	useEffect(() => { fetchTablePage(); }, [fetchTablePage]);

	// ── Realtime ──────────────────────────────────────────────────────────────

	useEffect(() => {
		if (!currentBranch) return;
		const unsub = subscribeToOrderInserts(currentBranch.id, () => {
			fetchAnalytics();
			fetchTablePage();
		});
		return unsub;
	}, [currentBranch, fetchAnalytics, fetchTablePage]);

	// ── Wastage fetch ─────────────────────────────────────────────────────────

	useEffect(() => {
		if (!currentBranch) return;
		const { startDate, endDate } = computeDateRange(viewMode, selDay, selWeek, selMonth, selYear);
		const startStr = startDate.toISOString().slice(0, 10);
		const endStr = endDate.toISOString().slice(0, 10);

		getWastageSummary(currentBranch.id, startStr, endStr).then(({ data }) => {
			setTotalWastageCost(data.reduce((sum, d) => sum + d.total_cost, 0));
			if (viewMode === "day") {
				setWastageBarData([{ label: "Today", wastage: data.reduce((sum, d) => sum + d.total_cost, 0) }]);
			} else if (viewMode === "week" || viewMode === "month") {
				const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
				const barData: { label: string; wastage: number }[] = [];
				for (let i = 0; i < days; i++) {
					const d = new Date(startDate);
					d.setDate(d.getDate() + i);
					const dateStr = d.toISOString().slice(0, 10);
					barData.push({
						label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
						wastage: data.find((w) => w.date === dateStr)?.total_cost ?? 0,
					});
				}
				setWastageBarData(barData);
			} else if (viewMode === "year") {
				setWastageBarData(
					MONTHS_SHORT.map((label, m) => ({
						label,
						wastage: data
							.filter((w) => { const d = new Date(w.date); return d.getMonth() === m && d.getFullYear() === selYear; })
							.reduce((s, w) => s + w.total_cost, 0),
					}))
				);
			} else {
				const byMonth = new Map<string, number>();
				data.forEach((w) => {
					const d = new Date(w.date);
					const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
					byMonth.set(key, (byMonth.get(key) ?? 0) + w.total_cost);
				});
				setWastageBarData(
					Array.from(byMonth.entries())
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([key, wastage]) => {
							const [y, m] = key.split("-").map(Number);
							return { label: new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }), wastage };
						})
				);
			}
		});

		getTopWastedItems(currentBranch.id, startStr, endStr).then(({ data }) => {
			setTopWastedItems(data);
		});

		getWastageLogs(currentBranch.id, startStr, endStr).then(({ data }) => {
			setWastageLogs(data);
		});

		const prior = computePriorDateRange(viewMode, selDay, selWeek, selMonth, selYear);
		if (prior) {
			getWastageSummary(currentBranch.id, prior.startStr, prior.endStr).then(({ data }) => {
				setPrevWastageCost(data.reduce((sum, d) => sum + d.total_cost, 0));
			});
		} else {
			setPrevWastageCost(null);
		}
	}, [currentBranch, viewMode, selDay, selWeek, selMonth, selYear]);

	// ── Derived ───────────────────────────────────────────────────────────────

	const formatTooltipValue = (value: number | undefined, name: string | undefined) => {
		if (value === undefined || name === undefined) return [0, ""];
		if (name === "revenue" || name === "profit") {
			return [formatCurrency(value), name === "revenue" ? "Revenue" : "Profit"];
		}
		return [value, name === "orders" ? "Orders" : name];
	};

	const totalPages = Math.ceil(totalTableCount / PAGE_SIZE);

	const peakEntry =
		timeSeriesData.length > 0
			? timeSeriesData.reduce((peak, cur) => (cur.orders > peak.orders ? cur : peak), timeSeriesData[0])
			: null;

	const periodLabel =
		viewMode === "day" ? selDay
		: viewMode === "week" ? `${MONTHS_SHORT[selWeek.month]}_${selWeek.year}_W${selWeek.week}`
		: viewMode === "month" ? `${MONTHS_SHORT[selMonth.month]}_${selMonth.year}`
		: viewMode === "year" ? `${selYear}`
		: "All_Time";

	const generateXLSX = () => {
		const wb = XLSX.utils.book_new();
		const avgOrderValue = currentPeriodStats.totalOrders > 0
			? currentPeriodStats.totalRevenue / currentPeriodStats.totalOrders
			: 0;
		const totalPieces = analyticsOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

		// Payment method breakdown
		const pmMap = { cash: { orders: 0, pieces: 0, revenue: 0 }, gcash: { orders: 0, pieces: 0, revenue: 0 }, grab: { orders: 0, pieces: 0, revenue: 0 } };
		analyticsOrders.forEach(o => {
			const m = ((o.payment_method as string) || 'cash').toLowerCase() as keyof typeof pmMap;
			if (pmMap[m]) {
				pmMap[m].orders++;
				pmMap[m].pieces += o.items.reduce((s, i) => s + i.quantity, 0);
				pmMap[m].revenue += o.total;
			}
		});

		// ── Sheet 1: Summary ───────────────────────────────────────────────
		// Report metadata + all aggregated stats in one place. No raw rows.
		const summaryData = [
			["SALES REPORT"],
			["Branch", currentBranch?.name ?? ""],
			["Period", periodLabel.replace(/_/g, " ")],
			["Generated", new Date().toLocaleString()],
			[],
			["Metric", "Value"],
			["Total Revenue (₱)", currentPeriodStats.totalRevenue],
			["Total Profit (₱)", currentPeriodStats.totalProfit],
			["Profit Margin (%)", parseFloat(currentPeriodStats.profitMargin.toFixed(2))],
			["Total Orders", currentPeriodStats.totalOrders],
			["Total Pieces Sold", totalPieces],
			["Avg Order Value (₱)", parseFloat(avgOrderValue.toFixed(2))],
			["Total Wastage Cost (₱)", totalWastageCost],
			["Peak Period", peakEntry ? peakEntry.label : "—"],
			["Peak Orders", peakEntry ? peakEntry.orders : 0],
			[],
			["PAYMENT METHOD BREAKDOWN"],
			["Method", "Orders", "Pieces", "Revenue (₱)"],
			["Cash", pmMap.cash.orders, pmMap.cash.pieces, parseFloat(pmMap.cash.revenue.toFixed(2))],
			["GCash", pmMap.gcash.orders, pmMap.gcash.pieces, parseFloat(pmMap.gcash.revenue.toFixed(2))],
			["Grab", pmMap.grab.orders, pmMap.grab.pieces, parseFloat(pmMap.grab.revenue.toFixed(2))],
		];
		const wsSum = XLSX.utils.aoa_to_sheet(summaryData);
		wsSum["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 16 }];
		XLSX.utils.book_append_sheet(wb, wsSum, "Summary");

		// ── Sheet 2: Orders ────────────────────────────────────────────────
		// One row per order. Items are summarised in a single column to avoid
		// repeating the same order-level data across multiple rows (that's
		// what the Line Items sheet is for).
		const orderRows = analyticsOrders.map(order => {
			const dt = new Date(order.created_at);
			return {
				"Order #": order.order_number,
				"Date": dt.toLocaleDateString(),
				"Time": dt.toLocaleTimeString(),
				"Items (summary)": order.items.map(i => `${i.name} ×${i.quantity}`).join(", "),
				"Pieces": order.items.reduce((s, i) => s + i.quantity, 0),
				"Subtotal (₱)": order.subtotal ?? order.total,
				"Discount (₱)": order.discount_amount ?? 0,
				"Total (₱)": order.total,
				"Payment": order.payment_method ?? "cash",
			};
		});
		const wsOrders = XLSX.utils.json_to_sheet(orderRows);
		wsOrders["!cols"] = [
			{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 40 },
			{ wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
		];
		XLSX.utils.book_append_sheet(wb, wsOrders, "Orders");

		// ── Sheet 3: Line Items ────────────────────────────────────────────
		// One row per order-item. Links back to Orders sheet via Order #.
		// Keeps item-level profitability without duplicating order-level totals.
		const itemRows: object[] = [];
		for (const order of analyticsOrders) {
			const dt = new Date(order.created_at);
			for (const item of order.items) {
				itemRows.push({
					"Order #": order.order_number,
					"Date": dt.toLocaleDateString(),
					"Item Name": item.name,
					"Type": item.is_bundle ? "Bundle" : "Item",
					"Qty": item.quantity,
					"Unit Price (₱)": item.price,
					"Unit Cost (₱)": item.cost ?? 0,
					"Line Revenue (₱)": parseFloat((item.price * item.quantity).toFixed(2)),
					"Line Profit (₱)": parseFloat(((item.price - (item.cost ?? 0)) * item.quantity).toFixed(2)),
				});
			}
		}
		const wsItems = XLSX.utils.json_to_sheet(itemRows);
		wsItems["!cols"] = [
			{ wch: 20 }, { wch: 12 }, { wch: 28 }, { wch: 8 }, { wch: 6 },
			{ wch: 15 }, { wch: 14 }, { wch: 16 }, { wch: 15 },
		];
		XLSX.utils.book_append_sheet(wb, wsItems, "Line Items");

		// ── Sheet 4: Payment Methods ──────────────────────────────────────
		const pmRows = (["cash", "gcash", "grab"] as const).map(m => ({
			"Payment Method": m === "gcash" ? "GCash" : m.charAt(0).toUpperCase() + m.slice(1),
			"Orders": pmMap[m].orders,
			"Pieces": pmMap[m].pieces,
			"Revenue (₱)": parseFloat(pmMap[m].revenue.toFixed(2)),
			"% of Orders": currentPeriodStats.totalOrders > 0 ? parseFloat((pmMap[m].orders / currentPeriodStats.totalOrders * 100).toFixed(1)) : 0,
			"% of Revenue": currentPeriodStats.totalRevenue > 0 ? parseFloat((pmMap[m].revenue / currentPeriodStats.totalRevenue * 100).toFixed(1)) : 0,
		}));
		const wsPm = XLSX.utils.json_to_sheet(pmRows);
		wsPm["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
		XLSX.utils.book_append_sheet(wb, wsPm, "Payment Methods");

		// ── Sheet 5: Wastage ───────────────────────────────────────────────
		// Top wasted items + period breakdown in one sheet, separated by a
		// blank row. No duplication with Summary (totals already there).
		const wastageData: (string | number)[][] = [
			["TOP WASTED ITEMS"],
			["Item Name", "Total Cost (₱)"],
			...topWastedItems.map(w => [w.item_name, w.total_cost]),
		];
		if (wastageBarData.length > 1) {
			wastageData.push([]);
			wastageData.push(["WASTAGE BY PERIOD"]);
			wastageData.push(["Period", "Wastage Cost (₱)"]);
			for (const b of wastageBarData) {
				wastageData.push([b.label, b.wastage]);
			}
		}
		const wsWastage = XLSX.utils.aoa_to_sheet(wastageData);
		wsWastage["!cols"] = [{ wch: 30 }, { wch: 18 }];
		XLSX.utils.book_append_sheet(wb, wsWastage, "Wastage");

		XLSX.writeFile(wb, `sales_${periodLabel}_${(currentBranch?.name ?? "branch").replace(/\s+/g, "_")}.xlsx`);
	};

	if (analyticsLoading && tableLoading) {
		return (
			<div className='flex h-full overflow-hidden'>
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					<div className='xl:hidden w-full'>
						<MobileTopBar title='Sales' icon={<SalesIcon />} />
					</div>
					<div className='hidden xl:block w-full'>
						<TopBar title='Sales' icon={<SalesIcon />} />
					</div>
					<div className='flex-1 flex items-center justify-center'>
						<LoadingSpinner />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='flex h-full overflow-hidden'>
			<div className='flex flex-col flex-1 h-full overflow-hidden'>
				<div className='xl:hidden w-full'>
					<MobileTopBar title='Sales' icon={<SalesIcon />} />
				</div>
				<div className='hidden xl:block w-full'>
					<TopBar title='Sales' icon={<SalesIcon />} />
				</div>

				{/* Toolbar: branch + date picker row */}
				<div className='px-6 py-3 shrink-0 flex flex-col gap-2 border-b border-gray-100'>
					<span className='flex items-center gap-2 text-xs text-secondary/50'>
						<span className='w-1.5 h-1.5 bg-accent rounded-full' />
						{currentBranch?.name || "Loading..."}
					</span>
					{/* Date selector row */}
					<div className='flex items-center justify-between gap-2 flex-wrap'>
						<div className='flex items-center gap-2 flex-wrap'>
							<div className='flex items-center gap-1 bg-accent/10 rounded-lg p-1 border border-accent/20'>
								{(["day", "week", "month", "year", "all"] as ViewMode[]).map((mode) => (
									<button
										key={mode}
										onClick={() => setViewMode(mode)}
										className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
											viewMode === mode
												? "bg-accent text-primary font-bold shadow-sm"
												: "text-secondary/50 hover:text-secondary"
										}`}>
										{mode === "day" ? "Day" : mode === "week" ? "Week" : mode === "month" ? "Month" : mode === "year" ? "Year" : "All"}
									</button>
								))}
							</div>
							{viewMode === "day" && (
								<DayPicker value={selDay} onChange={setSelDay} />
							)}
							{viewMode === "week" && (
								<WeekPicker value={selWeek} onChange={setSelWeek} />
							)}
							{viewMode === "month" && (
								<MonthPicker value={selMonth} onChange={setSelMonth} />
							)}
							{viewMode === "year" && (
								<YearPicker value={selYear} onChange={setSelYear} />
							)}
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<button
								onClick={handlePrintDailySales}
								disabled={isPrinting}
								className='bg-accent text-primary px-4 py-2 rounded-lg hover:bg-accent/90 shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:pointer-events-none'>
								<div className='flex flex-row items-center gap-2 text-primary text-shadow-md font-black text-3'>
									<svg className='w-4 h-4 shrink-0 drop-shadow-lg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
										<polyline points='6 9 6 2 18 2 18 9' />
										<path d='M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2' />
										<rect x='6' y='14' width='12' height='8' />
									</svg>
									<span className='mt-0.5'>{isPrinting ? 'PRINTING...' : 'PRINT'}</span>
								</div>
							</button>
							<button
								onClick={generateXLSX}
								className='bg-accent text-primary px-4 py-2 rounded-lg hover:bg-accent/90 shadow-sm transition-all hover:scale-105 active:scale-95 shrink-0'>
								<div className='flex flex-row items-center gap-2 text-primary text-shadow-md font-black text-3'>
									<svg className='w-4 h-4 shrink-0 drop-shadow-lg' viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
										<path d='M8 2v8M5 7l3 3 3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1' />
									</svg>
									<span className='mt-0.5'>EXPORT</span>
								</div>
							</button>
						</div>
					</div>
				</div>

				{/* Bento layout */}
				<div className='flex-1 overflow-y-auto px-6 pb-6 space-y-3'>
					{/* Stat cards row */}
					<div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
						<div className='bg-primary rounded-xl p-4 shadow-sm'>
							<p className='text-2.5 font-medium text-secondary/40 uppercase tracking-wide'>Revenue</p>
							<p className='text-lg font-semibold text-secondary mt-1'>
								<span className='text-sm font-normal mr-0.5'>₱</span>
								{formatCurrency(currentPeriodStats.totalRevenue).slice(1)}
							</p>
							<p className='text-2.5 text-secondary/40 mt-1'>
								Margin {currentPeriodStats.profitMargin.toFixed(1)}%
							</p>
						</div>

						<div className='bg-primary rounded-xl p-4 shadow-sm'>
							<p className='text-2.5 font-medium text-secondary/40 uppercase tracking-wide'>Orders</p>
							<p className='text-lg font-bold text-secondary mt-1'>{currentPeriodStats.totalOrders}</p>
							<p className='text-2.5 text-secondary/40 mt-1'>
								Avg{" "}
								{formatCurrency(
									currentPeriodStats.totalOrders > 0
										? currentPeriodStats.totalRevenue / currentPeriodStats.totalOrders
										: 0
								)}
							</p>
						</div>

						<div className='bg-primary rounded-xl p-4 shadow-sm'>
							<p className='text-2.5 font-medium text-secondary/40 uppercase tracking-wide'>Profit</p>
							<p className='text-lg font-semibold text-secondary mt-1'>
								<span className='text-sm font-normal mr-0.5'>₱</span>
								{formatCurrency(currentPeriodStats.totalProfit).slice(1)}
							</p>
							<p className='text-2.5 text-secondary/40 mt-1'>
								Wastage {formatCurrency(totalWastageCost)}
							</p>
						</div>

						<div className='bg-primary rounded-xl p-4 shadow-sm'>
							<p className='text-2.5 font-medium text-secondary/40 uppercase tracking-wide'>
								Peak {viewMode === "day" ? "Hour" : "Day"}
							</p>
							<p className='text-lg font-bold text-secondary mt-1 truncate'>
								{peakEntry ? peakEntry.label : "--"}
							</p>
							<p className='text-2.5 text-secondary/40 mt-1'>
								{peakEntry ? `${peakEntry.orders} orders` : "0 orders"}
							</p>
						</div>
					</div>

					{/* Payment Methods card */}
				<div className='bg-primary rounded-xl p-4 shadow-sm'>
					<p className='text-2.5 font-medium text-secondary/40 uppercase tracking-wide mb-3'>Payment Methods</p>
					<div className='flex items-center gap-6'>
						<div className='shrink-0'>
							{(() => {
								const pieData = paymentBreakdown.filter(p => p.orders > 0).length > 0
									? paymentBreakdown.filter(p => p.orders > 0)
									: [{ name: 'None', total: 1, orders: 0, color: '#e5e7eb' }];
								return (
									<PieChart width={120} height={120}>
										<Pie
											data={pieData}
											dataKey="total"
											cx={60}
											cy={60}
											innerRadius={30}
											outerRadius={50}
											paddingAngle={2}
											strokeWidth={0}
										>
											{pieData.map((entry, i) => (
												<Cell key={i} fill={entry.color} />
											))}
										</Pie>
										<Tooltip
											formatter={(value: number | string | undefined, name: string | undefined) => [formatCurrency(Number(value ?? 0)), name ?? '']}
											contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid var(--accent)' }}
										/>
									</PieChart>
								);
							})()}
						</div>
						<div className='flex-1 space-y-2.5 min-w-0'>
							{paymentBreakdown.map(p => (
								<div key={p.name} className='flex items-center gap-2'>
									<span className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: p.color }} />
									<span className='text-xs text-secondary/60 w-10 shrink-0'>{p.name}</span>
									<div className='flex-1 h-1.5 rounded-full bg-secondary/10 overflow-hidden'>
										<div className='h-full rounded-full transition-all' style={{ width: `${currentPeriodStats.totalOrders > 0 ? (p.orders / currentPeriodStats.totalOrders * 100) : 0}%`, backgroundColor: p.color }} />
									</div>
									<span className='text-xs font-semibold text-secondary tabular-nums w-5 text-right shrink-0'>{p.orders}</span>
									<span className='text-xs text-secondary/50 tabular-nums w-20 text-right shrink-0'>{formatCurrency(p.total)}</span>
								</div>
							))}
							<div className='pt-1 border-t border-secondary/10 flex items-center gap-2'>
								<span className='text-xs text-secondary/40 w-12 shrink-0'>Total</span>
								<div className='flex-1' />
								<span className='text-xs font-bold text-secondary tabular-nums w-5 text-right shrink-0'>{currentPeriodStats.totalOrders}</span>
								<span className='text-xs font-semibold text-secondary tabular-nums w-20 text-right shrink-0'>{formatCurrency(currentPeriodStats.totalRevenue)}</span>
							</div>
						</div>
					</div>
				</div>

				{/* Main bento: analytics left, orders right */}
					<div className='grid grid-cols-1 xl:grid-cols-5 gap-3 items-stretch'>
						{/* Left col: charts */}
						<div className='xl:col-span-3 flex flex-col gap-3'>
							{/* Revenue / orders line chart */}
							<div className='bg-primary rounded-xl p-4 shadow-sm'>
								<div className='flex items-center justify-between mb-3'>
									<p className='text-xs font-semibold text-secondary'>
										{viewMode === "day"
											? selDay
											: viewMode === "week"
											? `${MONTHS_SHORT[selWeek.month]} ${selWeek.year} – W${selWeek.week}`
											: viewMode === "month"
											? `${MONTHS_SHORT[selMonth.month]} ${selMonth.year}`
											: viewMode === "year"
											? `${selYear}`
											: "All Time"}
									</p>
									<div className='flex items-center gap-3'>
										<span className='flex items-center gap-1 text-2.5 text-secondary/40'>
											<span className='w-2 h-2 rounded-full bg-secondary inline-block' />
											Orders
										</span>
										<span className='flex items-center gap-1 text-2.5 text-secondary/40'>
											<span className='w-2 h-2 rounded-full bg-accent inline-block' />
											Revenue
										</span>
									</div>
								</div>
								<div className='relative w-full aspect-video'>
								<div className='absolute inset-0'>
									<ResponsiveContainer width='100%' height='100%'>
										<LineChart data={timeSeriesData}>
											<CartesianGrid strokeDasharray='1 1' stroke='#374151' opacity={0.2} />
											<XAxis
												dataKey='label'
												stroke='#9CA3AF'
												fontSize={9}
												tickLine={false}
												axisLine={false}
												interval='preserveStartEnd'
											/>
											<YAxis
												stroke='#9CA3AF'
												fontSize={9}
												tickLine={false}
												axisLine={false}
												width={30}
											/>
											<Tooltip
												formatter={formatTooltipValue}
												contentStyle={{
													backgroundColor: "#fff",
													border: "1px solid #e5e7eb",
													borderRadius: "8px",
													fontSize: "11px",
												}}
											/>
											<Line
												type='linear'
												dataKey='orders'
												stroke='var(--secondary)'
												strokeWidth={2}
												name='orders'
												dot={false}
												activeDot={{ r: 4 }}
											/>
											<Line
												type='linear'
												dataKey='revenue'
												stroke='var(--accent)'
												strokeWidth={2}
												name='revenue'
												dot={false}
												activeDot={{ r: 4 }}
											/>
										</LineChart>
									</ResponsiveContainer>
								</div>
								</div>
							</div>

							{/* Wastage panel */}
							<div className='bg-primary rounded-xl p-4 shadow-sm'>
								<div className='flex items-center justify-between mb-3'>
									<p className='text-xs font-semibold text-secondary'>Wastage</p>
									{prevWastageCost !== null && prevWastageCost > 0 && (() => {
										const pct = ((totalWastageCost - prevWastageCost) / prevWastageCost) * 100;
										return (
											<span
												className={`text-2.5 font-medium ${
													pct > 0 ? "text-red-400" : "text-success"
												}`}>
												{pct > 0 ? `↑ ${pct.toFixed(0)}%` : `↓ ${Math.abs(pct).toFixed(0)}%`} vs prev
											</span>
										);
									})()}
								</div>

								{viewMode !== "day" ? (
									<div className='h-44'>
										<ResponsiveContainer width='100%' height='100%'>
											<BarChart
												data={wastageBarData}
												barSize={viewMode === "week" ? 14 : viewMode === "month" ? 6 : viewMode === "year" ? 10 : 4}>
												<CartesianGrid
													strokeDasharray='1 1'
													stroke='#374151'
													opacity={0.2}
													vertical={false}
												/>
												<XAxis
													dataKey='label'
													stroke='#9CA3AF'
													fontSize={9}
													tickLine={false}
													axisLine={false}
													interval='preserveStartEnd'
												/>
												<YAxis
													stroke='#9CA3AF'
													fontSize={9}
													tickLine={false}
													axisLine={false}
													width={30}
													tickFormatter={(v) => `₱${v}`}
												/>
												<Tooltip
													formatter={(value: number | undefined) => [
														formatCurrency(value ?? 0),
														"Wastage",
													]}
													contentStyle={{
														backgroundColor: "#fff",
														border: "1px solid #fee2e2",
														borderRadius: "8px",
														fontSize: "11px",
													}}
												/>
												<Bar dataKey='wastage' fill='#f87171' radius={[3, 3, 0, 0]} />
											</BarChart>
										</ResponsiveContainer>
									</div>
								) : (
									<div className='flex items-center justify-between py-1'>
										<p className='text-2.5 text-secondary/40'>Total wastage cost</p>
										<p className='text-sm font-semibold text-red-400'>
											{formatCurrency(totalWastageCost)}
										</p>
									</div>
								)}

							{(topWastedItems.length > 0 || wastageLogs.length > 0) && (
								<div className='mt-3 border-t border-secondary/10 pt-3'>
									{topWastedItems.length > 0 && (
										<div className='space-y-2.5 mb-3'>
											{topWastedItems.slice(0, 3).map((item, idx) => (
												<div key={item.item_name} className='flex items-center gap-2'>
													<span className='text-2.5 font-bold text-secondary/20 w-3 shrink-0'>
														{idx + 1}
													</span>
													<div className='flex-1 min-w-0'>
														<p className='text-2.5 text-secondary truncate'>{item.item_name}</p>
														<div className='mt-0.5 h-1 bg-red-100 rounded-full overflow-hidden'>
															<div
																className='h-full bg-red-400 rounded-full'
																style={{
																	width: `${Math.min(100, (item.total_cost / topWastedItems[0].total_cost) * 100)}%`,
																}}
															/>
														</div>
													</div>
													<p className='text-2.5 font-semibold text-red-400 shrink-0'>
														{formatCurrency(item.total_cost)}
													</p>
												</div>
											))}
										</div>
									)}
									{wastageLogs.length > 0 && (
										<div className={topWastedItems.length > 0 ? 'border-t border-secondary/10 pt-2.5' : ''}>
											<div className='grid grid-cols-2 gap-x-3 gap-y-1 max-h-28 overflow-y-auto'>
												<span className='text-2.5 font-semibold text-secondary/30 uppercase tracking-wide'>Item</span>
												<span className='text-2.5 font-semibold text-secondary/30 uppercase tracking-wide text-right'>Date · Pcs</span>
												{wastageLogs.map((log) => (
													<React.Fragment key={log.id}>
														<span className='text-2.5 text-secondary truncate'>{log.item_name}</span>
														<span className='text-2.5 text-secondary/50 text-right'>{new Date(log.wastage_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {log.quantity_wasted} pcs</span>
													</React.Fragment>
												))}
											</div>
										</div>
									)}
								</div>
							)}
							</div>
						</div>

						{/* Right col: orders list */}
						<div className='xl:col-span-2 bg-primary rounded-xl shadow-sm flex flex-col h-full'>
							{/* Header + search */}
							<div className='p-4 border-b border-gray-100'>
								<div className='flex items-center justify-between mb-3'>
									<p className='text-xs font-semibold text-secondary'>Recent Orders</p>
									<span className='flex items-center gap-1.5 text-2.5 text-secondary/40'>
										<LoadingSpinner className='w-2! h-2! border-success bg-success/20' />
										{totalTableCount} total
									</span>
								</div>
								<div className='relative'>
									<input
										type='text'
										value={searchTerm}
										onChange={(e) => {
											setSearchTerm(e.target.value);
											setTablePage(1);
										}}
										placeholder='Search by order #...'
										className='w-full text-3 px-3 py-2 pr-8 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring focus:ring-accent focus:border-transparent'
									/>
									<div className='absolute right-2 top-1/2 -translate-y-1/2'>
										<SearchIcon className='text-secondary/30' />
									</div>
								</div>
							</div>

							{/* Compact table */}
							<div className='overflow-x-auto'>
								<table className='w-full'>
									<thead className='bg-gray-50'>
										<tr>
											<th className='px-4 py-2 text-left text-2.5 font-medium text-secondary/40 uppercase tracking-wider'>
												Order
											</th>
											<th className='px-4 py-2 text-left text-2.5 font-medium text-secondary/40 uppercase tracking-wider'>
												Time
											</th>
											<th className='px-4 py-2 text-left text-2.5 font-medium text-secondary/40 uppercase tracking-wider'>
												Items
											</th>
											<th className='px-4 py-2 text-right text-2.5 font-medium text-secondary/40 uppercase tracking-wider'>
												Total
											</th>
										</tr>
									</thead>
									<tbody className='divide-y divide-gray-50'>
										{tableLoading ? (
											<tr>
												<td colSpan={4} className='text-center py-10'>
													<LoadingSpinner />
												</td>
											</tr>
										) : tableOrders.map((order) => (
											<tr
												key={order.id}
												className='hover:bg-accent/5 cursor-pointer transition-colors'
												onClick={() => setSelectedOrder(order)}>
												<td className='px-4 py-2.5'>
													<span className='text-2.5 font-mono font-semibold text-secondary/60 bg-secondary/5 px-2 py-0.5 rounded-md'>
														#{order.id ? order.id.slice(-6) : "N/A"}
													</span>
												</td>
												<td className='px-4 py-2.5 text-2.5 text-secondary/50 whitespace-nowrap'>
													{order.created_at
														? new Date(order.created_at).toLocaleTimeString("en-US", {
																hour: "2-digit",
																minute: "2-digit",
														  })
														: "N/A"}
												</td>
												<td className='px-4 py-2.5'>
													<div className='flex items-center gap-1 flex-wrap'>
														{order.items && order.items.length > 0 ? (
															<>
																{order.items.slice(0, 2).map((item: OrderItem) => (
																	<span
																		key={item.id}
																		className='text-2.5 text-secondary bg-secondary/5 px-1.5 py-0.5 rounded-md whitespace-nowrap'>
																		{item.name} ×{item.quantity}
																	</span>
																))}
																{order.items.length > 2 && (
																	<span className='text-2.5 text-accent bg-accent/10 px-1.5 py-0.5 rounded-md'>
																		+{order.items.length - 2}
																	</span>
																)}
															</>
														) : (
															<span className='text-2.5 text-secondary/30'>—</span>
														)}
													</div>
												</td>
												<td className='px-4 py-2.5 text-right'>
													<p className='text-xs font-semibold text-secondary'>
														{formatCurrency(order.total || 0)}
													</p>
													{order.discount_amount > 0 && (
														<p className='text-2.5 text-red-400'>
															-{formatCurrency(order.discount_amount)}
														</p>
													)}
												</td>
											</tr>
										))}
										{!tableLoading && tableOrders.length === 0 && (
											<tr>
												<td colSpan={4} className='text-center py-10 text-xs text-secondary/30'>
													{searchTerm ? "No orders match your search" : "No orders yet"}
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>

							{/* Pagination */}
							{totalPages > 1 && (
								<div className='px-4 py-3 border-t border-gray-100 flex items-center justify-between'>
									<p className='text-2.5 text-secondary/40'>
										{(tablePage - 1) * PAGE_SIZE + 1}–{Math.min(tablePage * PAGE_SIZE, totalTableCount)} of{" "}
										{totalTableCount}
									</p>
									<div className='flex items-center gap-1'>
										<button
											onClick={() => setTablePage((p: number) => Math.max(1, p - 1))}
											disabled={tablePage === 1}
											className='px-2 py-1 text-2.5 bg-secondary/5 border border-secondary/10 rounded disabled:opacity-30'>
											‹
										</button>
										{[...Array(Math.min(totalPages, 5))].map((_, i) => {
											const page = i + 1;
											return (
												<button
													key={page}
													onClick={() => setTablePage(page)}
													className={`px-2 py-1 text-2.5 border rounded ${
														tablePage === page
															? "bg-accent text-primary border-accent font-bold"
															: "bg-secondary/5 border-secondary/10 text-secondary/60"
													}`}>
													{page}
												</button>
											);
										})}
										<button
											onClick={() => setTablePage((p: number) => Math.min(totalPages, p + 1))}
											disabled={tablePage === totalPages}
											className='px-2 py-1 text-2.5 bg-secondary/5 border border-secondary/10 rounded disabled:opacity-30'>
											›
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Order Receipt Modal */}
			{selectedOrder && (
				<div
					className='fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4'
					onClick={() => setSelectedOrder(null)}>
					<div
						className='bg-white rounded-2xl w-full max-w-xs max-h-[90vh] overflow-y-auto shadow-2xl'
						onClick={(e) => e.stopPropagation()}>
						{/* Branded header */}
						<div className='bg-white rounded-t-2xl pt-5 pb-0 text-center'>
							<div className='relative px-6'>
								<button
									onClick={() => setSelectedOrder(null)}
									className='absolute top-0 right-4 text-secondary/30 hover:text-secondary transition-colors text-xl leading-none'>
									×
								</button>
								<LogoIcon className='w-12 h-12 mx-auto' />
								<p className='text-secondary font-sans font-bold text-xs tracking-widest uppercase mt-2'>
									Fredelecacies
								</p>
								<p className='text-secondary/50 font-sans text-xs mt-1 mb-4'>{currentBranch?.name}</p>
							</div>
							<svg
								viewBox='0 0 320 16'
								xmlns='http://www.w3.org/2000/svg'
								className='w-full block'>
								<path
									d='M0,16 Q8,2 16,16 Q24,2 32,16 Q40,2 48,16 Q56,2 64,16 Q72,2 80,16 Q88,2 96,16 Q104,2 112,16 Q120,2 128,16 Q136,2 144,16 Q152,2 160,16 Q168,2 176,16 Q184,2 192,16 Q200,2 208,16 Q216,2 224,16 Q232,2 240,16 Q248,2 256,16 Q264,2 272,16 Q280,2 288,16 Q296,2 304,16 Q312,2 320,16'
									fill='none'
									stroke='#e5e7eb'
									strokeWidth='1'
								/>
							</svg>
						</div>

						{/* Receipt body */}
						<div className='px-5 pt-4 pb-5 font-mono text-secondary'>
							<div className='flex items-start justify-between gap-2'>
								<div>
									<p className='font-bold text-sm'>
										#
										{selectedOrder.order_number
											? selectedOrder.order_number.replace("ORD-", "")
											: selectedOrder.id.slice(-8).toUpperCase()}
									</p>
									<p className='text-secondary/40 text-xs mt-0.5 font-sans'>
										{new Date(selectedOrder.created_at).toLocaleDateString("en-US", {
											month: "short",
											day: "numeric",
											year: "numeric",
										})}
										{" · "}
										{new Date(selectedOrder.created_at).toLocaleTimeString("en-US", {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</p>
								</div>
								<span
									className={`shrink-0 mt-0.5 px-2.5 py-1 rounded-full text-xs font-sans font-semibold ${
										selectedOrder.payment_method === "gcash"
											? "bg-blue-100 text-blue-700"
											: selectedOrder.payment_method === "grab"
											? "bg-green-100 text-green-700"
											: "bg-secondary/10 text-secondary"
									}`}>
									{selectedOrder.payment_method === "gcash"
										? "GCash"
										: selectedOrder.payment_method === "grab"
										? "Grab"
										: "Cash"}
								</span>
							</div>

							<div className='border-t border-dashed border-secondary/20 my-4' />

							<div className='space-y-2.5 text-xs'>
								{selectedOrder.items.map((item: OrderItem) => (
									<div key={item.id}>
										<div className='flex justify-between gap-2'>
											<span className='flex-1'>
												{item.name}
												<span className='text-secondary/40 ml-1'>×{item.quantity}</span>
											</span>
											<span className='shrink-0 tabular-nums'>
												{formatCurrency(item.price * item.quantity)}
											</span>
										</div>
										{item.is_bundle &&
											Array.isArray(item.bundle_components) &&
											item.bundle_components.length > 0 && (
												<div className='ml-3 mt-1 space-y-1'>
													{item.bundle_components.map((comp: any, idx: number) => (
														<div key={idx} className='flex items-center gap-1 text-secondary/40'>
															<span>↳</span>
															<span>
																{comp.inventory_item?.name || comp.name || "Item"}
																{comp.quantity > 1 && (
																	<span className='ml-1 opacity-60'>×{comp.quantity}</span>
																)}
															</span>
														</div>
													))}
												</div>
											)}
									</div>
								))}
							</div>

							<div className='border-t border-dashed border-secondary/20 my-4' />

							<div className='space-y-2 text-xs'>
								<div className='flex justify-between'>
									<span className='text-secondary/50'>Subtotal</span>
									<span className='tabular-nums'>{formatCurrency(selectedOrder.subtotal)}</span>
								</div>
								{selectedOrder.discount_amount > 0 && (
									<div className='flex justify-between'>
										<span className='text-secondary/50'>Discount</span>
										<span className='tabular-nums text-green-600'>
											−{formatCurrency(selectedOrder.discount_amount)}
										</span>
									</div>
								)}
								{(() => {
									const grabFee =
										selectedOrder.total -
										(selectedOrder.subtotal - selectedOrder.discount_amount);
									return selectedOrder.payment_method === "grab" && grabFee > 0.005 ? (
										<div className='flex justify-between'>
											<span className='text-secondary/50'>Grab Fee</span>
											<span className='tabular-nums text-amber-600'>
												+{formatCurrency(grabFee)}
											</span>
										</div>
									) : null;
								})()}
							</div>

							<div className='border-t-2 border-secondary/20 mt-4 pt-3 flex justify-between items-baseline'>
								<span className='text-sm font-bold'>TOTAL</span>
								<span className='text-base font-bold tabular-nums'>
									{formatCurrency(selectedOrder.total)}
								</span>
							</div>

							<div className='border-t border-dashed border-secondary/20 my-4' />

							<div className='flex justify-between text-xs font-sans'>
								<span className='text-secondary/40 uppercase tracking-wide text-2.5'>Profit</span>
								<span className='text-success font-semibold tabular-nums'>
									{formatCurrency(calculateOrderProfit(selectedOrder))}
								</span>
							</div>

							{(selectedOrder.note || selectedOrder.transaction_number) && (
								<div className='mt-3 pt-3 border-t border-dashed border-secondary/20 space-y-1'>
									<span className='text-secondary/40 uppercase tracking-wide text-2.5 font-sans'>
										{selectedOrder.payment_method === 'gcash' ? 'Transaction #' : 'Note'}
									</span>
									<p className='text-xs text-secondary/70 wrap-break-word'>
										{selectedOrder.transaction_number || selectedOrder.note}
									</p>
								</div>
							)}

							<div className='flex gap-2 mt-5'>
								<button
									onClick={() => handleReprint(selectedOrder)}
									disabled={isPrinting}
									className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
										isPrinting
											? 'bg-gray-100 text-secondary/30 cursor-not-allowed'
											: 'bg-accent/10 text-accent hover:bg-accent/20'
									}`}>
									<svg className='w-3.5 h-3.5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z' />
									</svg>
									{isPrinting ? 'Printing...' : 'Reprint'}
								</button>
								<button
									onClick={() => setSelectedOrder(null)}
									className='flex-1 py-2.5 text-xs font-semibold text-secondary/50 border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-secondary transition-colors'>
									Close
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
