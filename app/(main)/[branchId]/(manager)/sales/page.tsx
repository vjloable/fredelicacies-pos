"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
	LineChart,
	Line,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getOrdersByBranch, getOrdersPage, subscribeToOrderInserts, voidOrder } from "@/services/orderService";
import { useAuth } from "@/contexts/AuthContext";
import type { OrderWithItems, OrderItem, WastageItemSummary, WastageLog } from "@/types/domain";
import type { EodItemLock, EodSession } from "@/types/domain/eod";
import { formatCurrency } from "@/services/salesService";
import { getWastageSummary, getTopWastedItems, getWastageLogs } from "@/services/wastageService";
import { getEodLocks } from "@/services/eodService";
import HelpButton from "@/components/HelpButton";
import { salesSteps } from "@/components/TutorialSteps";
import { useBranch } from "@/contexts/BranchContext";
import SearchIcon from "../../(worker)/store/icons/SearchIcon";
import SalesIcon from "@/components/icons/SidebarNav/SalesIcon";
import LogoIcon from "../../(worker)/store/icons/LogoIcon";
import { DayPicker, WeekPicker, MonthPicker, YearPicker } from "./DatePickers";
import { Workbook } from "exceljs";
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
	const { user, isManager, isUserOwner } = useAuth();
	const [isPrinting, setIsPrinting] = useState(false);

	// ── Void order state ──────────────────────────────────────────────────────
	const [showVoidConfirm, setShowVoidConfirm] = useState(false);
	const [voidReason, setVoidReason] = useState('');
	const [isVoiding, setIsVoiding] = useState(false);

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
	const [pageSize, setPageSize] = useState(10);
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
	// EOD audit state
	const [eodLocks, setEodLocks] = useState<EodItemLock[]>([]);
	const [eodSession, setEodSession] = useState<EodSession | null>(null);
	const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	// Orders table filters
	const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'gcash' | 'grab'>('all');
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'voided'>('all');
	// Actions dropdown
	const [showActionsMenu, setShowActionsMenu] = useState(false);
	const actionsMenuRef = useRef<HTMLDivElement>(null);
	// Prior period stats for trend deltas
	const [priorPeriodStats, setPriorPeriodStats] = useState<{ totalRevenue: number; totalOrders: number; totalProfit: number } | null>(null);

	// Close actions menu on outside click
	useEffect(() => {
		if (!showActionsMenu) return;
		const handler = (e: MouseEvent) => {
			if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
				setShowActionsMenu(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [showActionsMenu]);

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
			type GroupEntry = { orders: { orderId: string; items: { name: string; qty: number; total: number }[]; total: number }[]; gross: number };
			const groupMap = new Map<string, GroupEntry>();
			const sorted = [...analyticsOrders].sort(
				(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
			);
			for (const order of sorted.filter(o => o.status !== 'voided')) {
				const raw = ((order.payment_method as string) || 'cash').toLowerCase();
				const method = raw === 'gcash' ? 'GCash' : raw === 'grab' ? 'Grab' : 'Cash';
				if (!groupMap.has(method)) groupMap.set(method, { orders: [], gross: 0 });
				const group = groupMap.get(method)!;
				group.gross += order.total;
				const shortId = order.order_number
					? order.order_number.replace('ORD-', '')
					: order.id.slice(-8).toUpperCase();
				group.orders.push({
					orderId: shortId,
					items: order.items.map((item: OrderItem) => ({
						name: item.name,
						qty: item.quantity,
						total: item.price * item.quantity,
					})),
					total: order.total,
				});
			}
			const groups = (['Cash', 'GCash', 'Grab'] as const)
				.filter(m => groupMap.has(m))
				.map(method => {
					const { orders, gross } = groupMap.get(method)!;
					const net = method === 'Grab' ? gross * 0.73 : undefined;
					return { method, orders, gross, net };
				});
			const netRevenue = groups.reduce((sum, g) => sum + (g.net ?? g.gross), 0);
			const bytes = await formatDailySalesESC({
				date: periodLabel.replace(/_/g, " "),
				groups,
				totalOrders: currentPeriodStats.totalOrders,
				netRevenue,
				storeName: "FREDELECACIES",
				branchName: currentBranch?.name,
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

		// Fetch prior period for trend deltas
		const prior = computePriorDateRange(viewMode, selDay, selWeek, selMonth, selYear);
		if (prior) {
			const { orders: priorOrders } = await getOrdersByBranch(
				currentBranch.id,
				new Date(`${prior.startStr}T00:00:00`),
				new Date(`${prior.endStr}T23:59:59`)
			);
			setPriorPeriodStats({
				totalRevenue: priorOrders.reduce((s, o) => s + o.total, 0),
				totalOrders: priorOrders.length,
				totalProfit: priorOrders.reduce((s, o) => s + calculateOrderProfit(o), 0),
			});
		} else {
			setPriorPeriodStats(null);
		}

		setAnalyticsLoading(false);
	}, [currentBranch, viewMode, selDay, selWeek, selMonth, selYear]);

	useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

	// ── Table fetch ───────────────────────────────────────────────────────────

	const fetchTablePage = useCallback(async () => {
		if (!currentBranch) return;
		setTableLoading(true);
		const { startDate, endDate } = computeDateRange(viewMode, selDay, selWeek, selMonth, selYear);
		const { orders, totalCount } = await getOrdersPage(
			currentBranch.id, tablePage, pageSize, {
				search: searchTerm || undefined,
				startDate: viewMode !== 'all' ? startDate.toISOString().slice(0, 10) : undefined,
				endDate: viewMode !== 'all' ? endDate.toISOString().slice(0, 10) : undefined,
				paymentMethod: paymentFilter !== 'all' ? paymentFilter : undefined,
				status: statusFilter !== 'all' ? statusFilter : undefined,
			}
		);
		setTableOrders(orders);
		setTotalTableCount(totalCount);
		setTableLoading(false);
	}, [currentBranch, tablePage, pageSize, searchTerm, paymentFilter, statusFilter, viewMode, selDay, selWeek, selMonth, selYear]);

	useEffect(() => { fetchTablePage(); }, [fetchTablePage]);

	// Reset table to page 1 when period changes
	useEffect(() => { setTablePage(1); }, [viewMode, selDay, selWeek, selMonth, selYear]);

	// ── Void order ────────────────────────────────────────────────────────────
	const canVoid = isManager() || isUserOwner();

	const handleVoidOrder = async () => {
		if (!selectedOrder || !user || !currentBranch) return;
		setIsVoiding(true);
		const { error } = await voidOrder(
			selectedOrder.id,
			user.uid,
			currentBranch.id,
			voidReason,
			selectedOrder.order_number,
		);
		setIsVoiding(false);
		if (!error) {
			setShowVoidConfirm(false);
			setVoidReason('');
			setSelectedOrder(null);
			fetchTablePage();
		}
	};

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

	// ── EOD fetch (day view only) ─────────────────────────────────────────────

	useEffect(() => {
		if (!currentBranch) return;
		const date = viewMode === 'day' ? selDay : null;
		if (!date) { setEodLocks([]); setEodSession(null); return; }
		getEodLocks(currentBranch.id, date).then(({ locks, session }) => {
			setEodLocks(locks);
			setEodSession(session);
		});
	}, [currentBranch, viewMode, selDay]);

	// ── Derived ───────────────────────────────────────────────────────────────

	const formatTooltipValue = (value: number | undefined, name: string | undefined) => {
		if (value === undefined || name === undefined) return [0, ""];
		if (name === "revenue" || name === "profit") {
			return [formatCurrency(value), name === "revenue" ? "Revenue" : "Profit"];
		}
		return [value, name === "orders" ? "Orders" : name];
	};

	const totalPages = Math.ceil(totalTableCount / pageSize);

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

	const generateXLSX = async () => {
		const workbook = new Workbook();
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
		const sheet1 = workbook.addWorksheet("Summary");
		sheet1.columns = [{ width: 28 }, { width: 14 }];
		sheet1.addRow(["SALES REPORT"]);
		sheet1.addRow(["Branch", currentBranch?.name ?? ""]);
		sheet1.addRow(["Period", periodLabel.replace(/_/g, " ")]);
		sheet1.addRow(["Generated", new Date().toLocaleString()]);
		sheet1.addRow([]);
		sheet1.addRow(["Metric", "Value"]);
		sheet1.addRow(["Total Revenue (₱)", currentPeriodStats.totalRevenue]);
		sheet1.addRow(["Total Profit (₱)", currentPeriodStats.totalProfit]);
		sheet1.addRow(["Profit Margin (%)", parseFloat(currentPeriodStats.profitMargin.toFixed(2))]);
		sheet1.addRow(["Total Orders", currentPeriodStats.totalOrders]);
		sheet1.addRow(["Total Pieces Sold", totalPieces]);
		sheet1.addRow(["Avg Order Value (₱)", parseFloat(avgOrderValue.toFixed(2))]);
		sheet1.addRow(["Total Wastage Cost (₱)", totalWastageCost]);
		sheet1.addRow(["Peak Period", peakEntry ? peakEntry.label : "—"]);
		sheet1.addRow(["Peak Orders", peakEntry ? peakEntry.orders : 0]);
		sheet1.addRow([]);
		sheet1.addRow(["PAYMENT METHOD BREAKDOWN"]);
		sheet1.addRow(["Method", "Orders", "Pieces", "Revenue (₱)"]);
		sheet1.addRow(["Cash", pmMap.cash.orders, pmMap.cash.pieces, parseFloat(pmMap.cash.revenue.toFixed(2))]);
		sheet1.addRow(["GCash", pmMap.gcash.orders, pmMap.gcash.pieces, parseFloat(pmMap.gcash.revenue.toFixed(2))]);
		sheet1.addRow(["Grab", pmMap.grab.orders, pmMap.grab.pieces, parseFloat(pmMap.grab.revenue.toFixed(2))]);

		// ── Sheet 2: Orders ────────────────────────────────────────────────
		const sheet2 = workbook.addWorksheet("Orders");
		sheet2.columns = [
			{ width: 20 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 40 },
			{ width: 8 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 10 }, { width: 12 },
		];
		sheet2.addRow(["Order #", "Status", "Date", "Time", "Items (summary)", "Pieces", "Subtotal (₱)", "Discount (₱)", "Total (₱)", "Payment", "Void Reason"]);
		analyticsOrders.forEach(order => {
			const dt = new Date(order.created_at);
			const isVoided = order.status === 'voided';
			sheet2.addRow([
				order.order_number,
				isVoided ? "VOIDED" : "Completed",
				dt.toLocaleDateString(),
				dt.toLocaleTimeString(),
				order.items.map(i => `${i.name} ×${i.quantity}`).join(", "),
				isVoided ? 0 : order.items.reduce((s, i) => s + i.quantity, 0),
				isVoided ? 0 : (order.subtotal ?? order.total),
				isVoided ? 0 : (order.discount_amount ?? 0),
				isVoided ? 0 : order.total,
				order.payment_method ?? "cash",
				order.void_reason ?? "",
			]);
		});

		// ── Sheet 3: Line Items ────────────────────────────────────────────
		const sheet3 = workbook.addWorksheet("Line Items");
		sheet3.columns = [
			{ width: 20 }, { width: 12 }, { width: 28 }, { width: 8 }, { width: 6 },
			{ width: 15 }, { width: 14 }, { width: 16 }, { width: 15 },
		];
		sheet3.addRow(["Order #", "Date", "Item Name", "Type", "Qty", "Unit Price (₱)", "Unit Cost (₱)", "Line Revenue (₱)", "Line Profit (₱)"]);
		for (const order of analyticsOrders.filter(o => o.status !== 'voided')) {
			const dt = new Date(order.created_at);
			for (const item of order.items) {
				sheet3.addRow([
					order.order_number,
					dt.toLocaleDateString(),
					item.name,
					item.is_bundle ? "Bundle" : "Item",
					item.quantity,
					item.price,
					item.cost ?? 0,
					parseFloat((item.price * item.quantity).toFixed(2)),
					parseFloat(((item.price - (item.cost ?? 0)) * item.quantity).toFixed(2)),
				]);
			}
		}

		// ── Sheet 4: Payment Methods ──────────────────────────────────────
		const sheet4 = workbook.addWorksheet("Payment Methods");
		sheet4.columns = [{ width: 18 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }];
		sheet4.addRow(["Payment Method", "Orders", "Pieces", "Revenue (₱)", "% of Orders", "% of Revenue"]);
		(["cash", "gcash", "grab"] as const).forEach(m => {
			sheet4.addRow([
				m === "gcash" ? "GCash" : m.charAt(0).toUpperCase() + m.slice(1),
				pmMap[m].orders,
				pmMap[m].pieces,
				parseFloat(pmMap[m].revenue.toFixed(2)),
				currentPeriodStats.totalOrders > 0 ? parseFloat((pmMap[m].orders / currentPeriodStats.totalOrders * 100).toFixed(1)) : 0,
				currentPeriodStats.totalRevenue > 0 ? parseFloat((pmMap[m].revenue / currentPeriodStats.totalRevenue * 100).toFixed(1)) : 0,
			]);
		});

		// ── Sheet 5: Wastage ───────────────────────────────────────────────
		const sheet5 = workbook.addWorksheet("Wastage");
		sheet5.columns = [{ width: 30 }, { width: 18 }];
		sheet5.addRow(["TOP WASTED ITEMS"]);
		sheet5.addRow(["Item Name", "Total Cost (₱)"]);
		topWastedItems.forEach(w => sheet5.addRow([w.item_name, w.total_cost]));
		if (wastageBarData.length > 1) {
			sheet5.addRow([]);
			sheet5.addRow(["WASTAGE BY PERIOD"]);
			sheet5.addRow(["Period", "Wastage Cost (₱)"]);
			wastageBarData.forEach(b => sheet5.addRow([b.label, b.wastage]));
		}

		// Write file
		const filename = `sales_${periodLabel}_${(currentBranch?.name ?? "branch").replace(/\s+/g, "_")}.xlsx`;
		await workbook.xlsx.writeFile(filename);
	};

	if (analyticsLoading && tableLoading) {
		return (
			<div className='flex h-full overflow-hidden'>
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					<div className='xl:hidden w-full'>
						<MobileTopBar title='Sales' icon={<SalesIcon />} rightAction={<HelpButton variant='page' steps={salesSteps} />} />
					</div>
					<div className='hidden xl:block w-full'>
						<TopBar title='Sales' icon={<SalesIcon />} rightAction={<HelpButton variant='page' steps={salesSteps} />} />
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
					<MobileTopBar title='Sales' icon={<SalesIcon />} rightAction={<HelpButton variant='page' steps={salesSteps} />} />
				</div>
				<div className='hidden xl:block w-full'>
					<TopBar title='Sales' icon={<SalesIcon />} rightAction={<HelpButton variant='page' steps={salesSteps} />} />
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
						<div ref={actionsMenuRef} className="relative shrink-0">
							<button
								onClick={() => setShowActionsMenu(v => !v)}
								className='w-8 h-8 rounded-full bg-secondary/10 hover:bg-secondary/20 text-secondary flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
								aria-label="Actions"
							>
								<svg className='w-4 h-4' viewBox='0 0 20 20' fill='currentColor'>
									<circle cx='4' cy='10' r='1.5' />
									<circle cx='10' cy='10' r='1.5' />
									<circle cx='16' cy='10' r='1.5' />
								</svg>
							</button>
							{showActionsMenu && (
								<div className='absolute right-0 top-10 z-20 bg-primary rounded-xl shadow-lg border border-secondary/10 py-1 min-w-44'>
									<button
										onClick={() => { setShowActionsMenu(false); handlePrintDailySales(); }}
										disabled={isPrinting}
										className='w-full flex items-center gap-3 px-4 py-2.5 text-xs text-secondary hover:bg-secondary/5 disabled:opacity-40 disabled:pointer-events-none transition-colors'
									>
										<svg className='w-3.5 h-3.5 shrink-0' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
											<polyline points='6 9 6 2 18 2 18 9' />
											<path d='M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2' />
											<rect x='6' y='14' width='12' height='8' />
										</svg>
										{isPrinting ? 'Printing...' : 'Print Report'}
									</button>
									<button
										onClick={async () => { setShowActionsMenu(false); await generateXLSX(); }}
										className='w-full flex items-center gap-3 px-4 py-2.5 text-xs text-secondary hover:bg-secondary/5 transition-colors'
									>
										<svg className='w-3.5 h-3.5 shrink-0' viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
											<path d='M8 2v8M5 7l3 3 3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1' />
										</svg>
										Export Excel
									</button>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Bento layout */}
				<div className='flex-1 overflow-y-auto px-6 pb-6 space-y-3'>
					{/* Stat cards + payment methods row */}
					<div className='grid grid-cols-2 lg:grid-cols-5 gap-3'>
						{/* Revenue */}
						<div className='bg-primary rounded-xl p-4 shadow-sm'>
							<div className='flex items-center justify-between'>
								<p className='text-2.5 font-medium text-secondary/40 uppercase tracking-wide'>Revenue</p>
								{priorPeriodStats && priorPeriodStats.totalRevenue > 0 && (() => {
									const pct = ((currentPeriodStats.totalRevenue - priorPeriodStats.totalRevenue) / priorPeriodStats.totalRevenue) * 100;
									return <span className={`text-2.5 font-medium ${pct >= 0 ? 'text-success' : 'text-error'}`}>₱{Math.abs(pct).toFixed(0)}%</span>;
								})()}
							</div>
							<p className='text-lg font-semibold text-secondary mt-1'>
								<span className='text-sm font-normal mr-0.5'>₱</span>
								{formatCurrency(currentPeriodStats.totalRevenue).slice(1)}
							</p>
							<p className='text-2.5 text-secondary/40 mt-1'>Margin {currentPeriodStats.profitMargin.toFixed(1)}%</p>
						</div>

						{/* Orders */}
						<div className='bg-primary rounded-xl p-4 shadow-sm'>
							<div className='flex items-center justify-between'>
								<p className='text-2.5 font-medium text-secondary/40 uppercase tracking-wide'>Orders</p>
								{priorPeriodStats && priorPeriodStats.totalOrders > 0 && (() => {
									const pct = ((currentPeriodStats.totalOrders - priorPeriodStats.totalOrders) / priorPeriodStats.totalOrders) * 100;
									return <span className={`text-2.5 font-medium ${pct >= 0 ? 'text-success' : 'text-error'}`}>{pct >= 0 ? '\u2191' : '\u2193'} {Math.abs(pct).toFixed(0)}%</span>;
								})()}
							</div>
							<p className='text-lg font-bold text-secondary mt-1'>{currentPeriodStats.totalOrders}</p>
							<p className='text-2.5 text-secondary/40 mt-1'>Avg {formatCurrency(currentPeriodStats.totalOrders > 0 ? currentPeriodStats.totalRevenue / currentPeriodStats.totalOrders : 0)}</p>
						</div>

						{/* Profit */}
						<div className='bg-primary rounded-xl p-4 shadow-sm'>
							<div className='flex items-center justify-between'>
								<p className='text-2.5 font-medium text-secondary/40 uppercase tracking-wide'>Profit</p>
								{priorPeriodStats && priorPeriodStats.totalProfit > 0 && (() => {
									const pct = ((currentPeriodStats.totalProfit - priorPeriodStats.totalProfit) / priorPeriodStats.totalProfit) * 100;
									return <span className={`text-2.5 font-medium ${pct >= 0 ? 'text-success' : 'text-error'}`}>₱{Math.abs(pct).toFixed(0)}%</span>;
								})()}
							</div>
							<p className='text-lg font-semibold text-secondary mt-1'>
								<span className='text-sm font-normal mr-0.5'>₱</span>
								{formatCurrency(currentPeriodStats.totalProfit).slice(1)}
							</p>
							<p className='text-2.5 text-secondary/40 mt-1'>Wastage {formatCurrency(totalWastageCost)}</p>
						</div>

						{/* Peak */}
						<div className='bg-primary rounded-xl p-4 shadow-sm'>
							<p className='text-2.5 font-medium text-secondary/40 uppercase tracking-wide'>Peak {viewMode === "day" ? "Hour" : "Day"}</p>
							<p className='text-lg font-bold text-secondary mt-1 truncate'>{peakEntry ? peakEntry.label : "--"}</p>
							<p className='text-2.5 text-secondary/40 mt-1'>{peakEntry ? `${peakEntry.orders} orders` : "0 orders"}</p>
						</div>

						{/* Payment methods — inline compact */}
						<div className='col-span-2 lg:col-span-1 bg-primary rounded-xl p-4 shadow-sm'>
							<p className='text-2.5 font-medium text-secondary/40 uppercase tracking-wide mb-3'>Payments</p>
							<div className='space-y-2'>
								{paymentBreakdown.map(p => (
									<div key={p.name} className='flex items-center gap-2'>
										<span className='w-1.5 h-1.5 rounded-full shrink-0' style={{ backgroundColor: p.color }} />
										<span className='text-2.5 text-secondary/60 w-14 shrink-0'>{p.name}</span>
										<div className='flex-1 h-1 rounded-full bg-secondary/10 overflow-hidden'>
											<div className='h-full rounded-full transition-all' style={{ width: `${currentPeriodStats.totalOrders > 0 ? (p.orders / currentPeriodStats.totalOrders * 100) : 0}%`, backgroundColor: p.color }} />
										</div>
										<span className='text-2.5 font-semibold text-secondary tabular-nums w-4 text-right shrink-0'>{p.orders}</span>
									</div>
								))}
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
									yAxisId='revenue'
									orientation='left'
									stroke='#9CA3AF'
									fontSize={9}
									tickLine={false}
									axisLine={false}
									width={36}
									tickFormatter={(v) => `\u20b1${v}`}
								/>
								<YAxis
									yAxisId='orders'
									orientation='right'
									stroke='#9CA3AF'
									fontSize={9}
									tickLine={false}
									axisLine={false}
									width={24}
									allowDecimals={false}
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
									yAxisId='orders'
									type='linear'
									dataKey='orders'
									stroke='var(--secondary)'
									strokeWidth={2}
									name='orders'
									dot={false}
									activeDot={{ r: 4 }}
								/>
								<Line
									yAxisId='revenue'
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

							{/* Wastage + Carry-Over row */}
							<div className='flex gap-3 items-start'>

							{/* Wastage panel */}
							<div className='flex-1 min-w-0 bg-primary rounded-xl p-4 shadow-sm'>
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

							{/* Carry-Over Stock panel — day view only */}
							{viewMode === 'day' && (
								<div className='flex-1 min-w-0 bg-primary rounded-xl p-4 shadow-sm'>
									<div className='flex items-center justify-between mb-3'>
										<p className='text-xs font-semibold text-secondary'>Carry-Over Stock</p>
										{eodSession?.status === 'submitted' ? (
											<span className='text-2.5 px-2 py-0.5 bg-success/10 text-success rounded-full font-medium'>Submitted</span>
										) : (
											<span className='text-2.5 px-2 py-0.5 bg-secondary/10 text-secondary/60 rounded-full font-medium'>Draft</span>
										)}
									</div>
									{eodLocks.length === 0 && !eodSession ? (
										<p className='text-2.5 text-secondary/30 py-2 text-center'>No items locked yet \u2014 lock items from Inventory</p>
									) : (
										<div className='flex items-center justify-between py-1'>
											<p className='text-2.5 text-secondary/40'>Items carrying over</p>
											<p className='text-sm font-semibold text-secondary'>{eodLocks.length}</p>
										</div>
									)}
									{eodLocks.length > 0 && (
										<div className='mt-3 border-t border-secondary/10 pt-3 space-y-2.5'>
											{(() => {
												const maxStock = Math.max(...eodLocks.map(l => l.locked_stock), 1);
												return eodLocks.map(lock => (
													<div key={lock.id} className='flex items-center gap-2'>
														<div className='flex-1 min-w-0'>
															<div className='flex items-baseline justify-between mb-0.5'>
																<p className='text-2.5 text-secondary truncate'>{lock.item_name}</p>
																{lock.discrepancy !== 0 && (
																	<span className={`text-2.5 font-semibold shrink-0 ml-1 ${lock.discrepancy > 0 ? 'text-accent' : 'text-error'}`}>
																		{lock.discrepancy > 0 ? '+' : ''}{lock.discrepancy}
																	</span>
																)}
															</div>
															<div className='h-1 bg-secondary/10 rounded-full overflow-hidden'>
																<div
																	className='h-full rounded-full'
																	style={{
																		width: `${Math.min(100, (lock.locked_stock / maxStock) * 100)}%`,
																		backgroundColor: lock.discrepancy === 0 ? 'var(--success)' : 'var(--error)',
																	}}
																/>
															</div>
														</div>
														<p className='text-2.5 font-semibold text-secondary/60 shrink-0 w-5 text-right'>{lock.locked_stock}</p>
													</div>
												));
											})()}
										</div>
									)}
								</div>
							)}

							</div>

							{/* Right col: orders list */}
						<div className='xl:col-span-2 bg-primary rounded-xl shadow-sm flex flex-col overflow-hidden' style={{ maxHeight: 'calc(100vh - 220px)' }}>
							{/* Header + search */}
							<div className='p-4 border-b border-gray-100'>
								<div className='flex items-center justify-between mb-3'>
									<p className='text-xs font-semibold text-secondary'>
										{viewMode === 'all' ? 'All Orders' : `Orders \u00b7 ${periodLabel.replace(/_/g, ' ')}`}
									</p>
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
								{/* Filters */}
								<div className='flex items-center gap-1.5 mt-2 flex-wrap'>
									{(['all', 'cash', 'gcash', 'grab'] as const).map(m => (
										<button
											key={m}
											onClick={() => { setPaymentFilter(m); setTablePage(1); }}
											className={`px-2 py-0.5 rounded-md text-2.5 font-medium transition-colors ${
												paymentFilter === m ? 'bg-accent text-primary' : 'bg-secondary/5 text-secondary/50 hover:text-secondary'
											}`}
										>
											{m === 'all' ? 'All' : m === 'gcash' ? 'GCash' : m === 'grab' ? 'Grab' : 'Cash'}
										</button>
									))}
									<span className='text-secondary/20 mx-0.5'>|</span>
									{(['all', 'active', 'voided'] as const).map(s => (
										<button
											key={s}
											onClick={() => { setStatusFilter(s); setTablePage(1); }}
											className={`px-2 py-0.5 rounded-md text-2.5 font-medium transition-colors ${
												statusFilter === s ? 'bg-secondary text-primary' : 'bg-secondary/5 text-secondary/50 hover:text-secondary'
											}`}
										>
											{s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Voided'}
										</button>
									))}
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
												<td colSpan={4} className='py-5'>
													<div className='flex justify-center'>
														<LoadingSpinner />
													</div>
												</td>
											</tr>
										) : tableOrders.map((order) => (
											<tr
												key={order.id}
												className={`cursor-pointer transition-colors ${order.status === 'voided' ? 'opacity-40 hover:opacity-60' : 'hover:bg-accent/5'}`}
												onClick={() => setSelectedOrder(order)}>
												<td className='px-4 py-2.5'>
													<span className='text-[10px] font-mono font-semibold text-secondary/60 bg-secondary/5 px-2 py-0.5 rounded-md'>
														#{order.order_number ? order.order_number.split('-').pop() : order.id.slice(-6)}
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
													{order.status === 'voided' ? (
														<span className='text-2.5 font-semibold text-error bg-error/10 px-2 py-0.5 rounded-md'>VOID</span>
													) : (
														<>
															<p className='text-xs font-semibold text-secondary'>
																{formatCurrency(order.total || 0)}
															</p>
															{order.discount_amount > 0 && (
																<p className='text-2.5 text-red-400'>
																	-{formatCurrency(order.discount_amount)}
																</p>
															)}
														</>
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
									<div className='flex items-center gap-2'>
										<p className='text-2.5 text-secondary/40'>
											{(tablePage - 1) * pageSize + 1}–{Math.min(tablePage * pageSize, totalTableCount)} of{" "}
											{totalTableCount}
										</p>
										<div className='flex items-center gap-0.5'>
											{([10, 25, 50] as const).map(n => (
												<button
													key={n}
													onClick={() => { setPageSize(n); setTablePage(1); }}
													className={`px-1.5 py-0.5 text-2.5 rounded transition-colors ${
														pageSize === n ? 'bg-accent/10 text-accent font-bold' : 'text-secondary/40 hover:text-secondary'
													}`}
												>
													{n}
												</button>
											))}
										</div>
									</div>
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

							{/* Void badge if already voided */}
						{selectedOrder.status === 'voided' && (
							<div className='mt-4 p-3 bg-error/10 border border-error/20 rounded-xl text-center'>
								<p className='text-xs font-semibold text-error'>VOIDED</p>
								{selectedOrder.void_reason && (
									<p className='text-2.5 text-(--error)/70 mt-0.5'>{selectedOrder.void_reason}</p>
								)}
							</div>
						)}

						<div className='flex gap-2 mt-5'>
							{selectedOrder.status !== 'voided' && (
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
							)}
							{canVoid && selectedOrder.status !== 'voided' && (
								<button
									onClick={() => setShowVoidConfirm(true)}
									className='flex-1 py-2.5 text-xs font-semibold rounded-xl bg-error/10 text-error hover:bg-error/20 transition-colors'>
									Void
								</button>
							)}
							<button
								onClick={() => setSelectedOrder(null)}
								className='flex-1 py-2.5 text-xs font-semibold text-secondary/50 border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-secondary transition-colors'>
								Close
							</button>
						</div>

						{/* Void confirmation */}
						{showVoidConfirm && (
							<div className='mt-4 p-4 bg-error/5 border border-error/20 rounded-xl space-y-3'>
								<p className='text-xs font-semibold text-error'>Confirm Void</p>
								<p className='text-2.5 text-secondary/60'>This will mark the order as voided. The action is logged and cannot be undone.</p>
								<input
									type='text'
									value={voidReason}
									onChange={(e) => setVoidReason(e.target.value)}
									placeholder='Reason (optional)'
									className='w-full px-3 py-2 text-xs border border-error/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-(--error)/40 bg-white'
								/>
								<div className='flex gap-2'>
									<button
										onClick={() => { setShowVoidConfirm(false); setVoidReason(''); }}
										disabled={isVoiding}
										className='flex-1 py-2 text-xs font-medium text-secondary border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50'>
										Cancel
									</button>
									<button
										onClick={handleVoidOrder}
										disabled={isVoiding}
										className='flex-1 py-2 text-xs font-semibold bg-error text-white rounded-lg hover:bg-(--error)/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5'>
										{isVoiding ? <><LoadingSpinner size='sm' />Voiding...</> : 'Confirm Void'}
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		)}
	</div>
	);
}
