"use client";

import { useState, useEffect, useCallback } from "react";
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
import { subscribeToOrders } from "@/services/orderService";
import type { OrderWithItems, OrderItem, WastageItemSummary, InventoryItem } from "@/types/domain";
import { formatCurrency } from "@/services/salesService";
import { getWastageSummary, getTopWastedItems } from "@/services/wastageService";
import { getInventoryItems } from "@/services/inventoryService";
import { useBranch } from "@/contexts/BranchContext";
import SearchIcon from "../../(worker)/store/icons/SearchIcon";
import SalesIcon from "@/components/icons/SidebarNav/SalesIcon";
import LogoIcon from "../../(worker)/store/icons/LogoIcon";

interface TimeSeriesData {
	label: string;
	date: string;
	orders: number;
	revenue: number;
	profit: number;
}

type ViewPeriod = "day" | "week" | "month";

// Helper function to calculate profit from an order
const calculateOrderProfit = (order: OrderWithItems): number => {
	return order.items.reduce((sum, item) => {
		const itemProfit = ((item.price - (item.cost || 0)) * item.quantity);
		return sum + itemProfit;
	}, 0);
};

export default function SalesScreen() {
	const { currentBranch } = useBranch(); // Get current branch context
	const [viewPeriod, setViewPeriod] = useState<ViewPeriod>("day");
	const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
	const [allOrders, setAllOrders] = useState<OrderWithItems[]>([]);
	const [loading, setLoading] = useState(true);
	const [currentPeriodStats, setCurrentPeriodStats] = useState({
		totalRevenue: 0,
		totalOrders: 0,
		totalProfit: 0,
		profitMargin: 0,
	});

	// Wastage analytics state
	const [wastageBarData, setWastageBarData] = useState<{ label: string; wastage: number }[]>([]);
	const [topWastedItems, setTopWastedItems] = useState<WastageItemSummary[]>([]);
	const [totalWastageCost, setTotalWastageCost] = useState(0);
	const [prevWastageCost, setPrevWastageCost] = useState<number | null>(null);
	const [carryOverItems, setCarryOverItems] = useState<InventoryItem[]>([]);

	// View mode toggle (recent orders vs analytics/graphs)
	const [viewMode, setViewMode] = useState<"orders" | "analytics">("orders");

	// Selected order for receipt modal
	const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);

	// Pagination state for orders table
	const [currentPage, setCurrentPage] = useState(1);
	const [ordersPerPage] = useState(10);
	const [searchTerm, setSearchTerm] = useState("");

	// Subscribe to orders using singleton listener
	useEffect(() => {
		if (!currentBranch) return;

		console.log("🔗 Setting up orders subscription for sales screen");

		const unsubscribe = subscribeToOrders(
			currentBranch.id,
			(orders: OrderWithItems[]) => {
				console.log(
					"📄 Received orders update in sales screen:",
					orders.length
				);
				setAllOrders(orders);
				setLoading(false);
			}
		);

		return () => {
			console.log("🔌 Cleaning up orders subscription in sales screen");
			unsubscribe();
		};
	}, [currentBranch]);

	// Get date ranges based on view period
	const getDateRange = (period: ViewPeriod) => {
		const now = new Date();
		const endDate = new Date(now);
		endDate.setHours(23, 59, 59, 999);

		let startDate = new Date();

		switch (period) {
			case "day":
				// Last 24 hours by hour
				startDate = new Date(now);
				startDate.setHours(0, 0, 0, 0);
				break;
			case "week":
				// Last 7 days
				startDate = new Date(now);
				startDate.setDate(now.getDate() - 6);
				startDate.setHours(0, 0, 0, 0);
				break;
			case "month":
				// Last 30 days
				startDate = new Date(now);
				startDate.setDate(now.getDate() - 29);
				startDate.setHours(0, 0, 0, 0);
				break;
		}

		return { startDate, endDate };
	};

	// Filter orders by date range
	const getFilteredOrders = useCallback(
		(period: ViewPeriod): OrderWithItems[] => {
			const { startDate, endDate } = getDateRange(period);

			return allOrders.filter((order) => {
				if (!order.created_at) return false;
				const orderDate = new Date(order.created_at);
				return orderDate >= startDate && orderDate <= endDate;
			});
		},
		[allOrders]
	);

	// Generate time series data based on period
	const generateTimeSeriesData = useCallback(
		(orders: OrderWithItems[], period: ViewPeriod): TimeSeriesData[] => {
			const { startDate } = getDateRange(period);
			const data: TimeSeriesData[] = [];

			if (period === "day") {
				// Hourly data for today
				for (let hour = 0; hour < 24; hour++) {
					const hourStart = new Date(startDate);
					hourStart.setHours(hour, 0, 0, 0);
					const hourEnd = new Date(startDate);
					hourEnd.setHours(hour, 59, 59, 999);

					const hourOrders = orders.filter((order) => {
						if (!order.created_at) return false;
						const orderDate = new Date(order.created_at);
						return orderDate >= hourStart && orderDate <= hourEnd;
					});

					const revenue = hourOrders.reduce(
						(sum, order) => sum + order.total,
						0
					);
					const profit = hourOrders.reduce(
						(sum, order) => sum + (calculateOrderProfit(order)),
						0
					);

					data.push({
						label: `${hour.toString().padStart(2, "0")}:00`,
						date: hourStart.toISOString(),
						orders: hourOrders.length,
						revenue,
						profit,
					});
				}
			} else {
				// Daily data for week/month
				const days = period === "week" ? 7 : 30;

				for (let i = 0; i < days; i++) {
					const dayStart = new Date(startDate);
					dayStart.setDate(startDate.getDate() + i);
					dayStart.setHours(0, 0, 0, 0);

					const dayEnd = new Date(dayStart);
					dayEnd.setHours(23, 59, 59, 999);

					const dayOrders = orders.filter((order) => {
						if (!order.created_at) return false;
						const orderDate = new Date(order.created_at);
						return orderDate >= dayStart && orderDate <= dayEnd;
					});

					const revenue = dayOrders.reduce(
						(sum, order) => sum + order.total,
						0
					);
					const profit = dayOrders.reduce(
						(sum, order) => sum + (calculateOrderProfit(order)),
						0
					);

					data.push({
						label:
							period === "week"
								? dayStart.toLocaleDateString("en-US", {
										weekday: "short",
										month: "short",
										day: "numeric",
								  })
								: dayStart.toLocaleDateString("en-US", {
										month: "short",
										day: "numeric",
								  }),
						date: dayStart.toISOString(),
						orders: dayOrders.length,
						revenue,
						profit,
					});
				}
			}

			return data;
		},
		[]
	);

	// Update chart data when viewPeriod or orders change
	useEffect(() => {
		if (allOrders.length === 0) {
			setTimeSeriesData([]);
			setCurrentPeriodStats({
				totalRevenue: 0,
				totalOrders: 0,
				totalProfit: 0,
				profitMargin: 0,
			});
			return;
		}

		const filteredOrders = getFilteredOrders(viewPeriod);
		const seriesData = generateTimeSeriesData(filteredOrders, viewPeriod);
		setTimeSeriesData(seriesData);

		// Calculate current period totals
		const totalRevenue = filteredOrders.reduce(
			(sum, order) => sum + order.total,
			0
		);
		const totalOrders = filteredOrders.length;
		const totalProfit = filteredOrders.reduce(
			(sum, order) => sum + (calculateOrderProfit(order)),
			0
		);
		const profitMargin =
			totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

		setCurrentPeriodStats({
			totalRevenue,
			totalOrders,
			totalProfit,
			profitMargin,
		});
	}, [allOrders, viewPeriod, getFilteredOrders, generateTimeSeriesData]);

	// Returns the date range for the period immediately prior to the current one
	const getPriorDateRange = (period: ViewPeriod): { startStr: string; endStr: string } => {
		const now = new Date();
		const days = period === "day" ? 1 : period === "week" ? 7 : 30;
		const priorEnd = new Date(now);
		priorEnd.setDate(now.getDate() - days);
		const priorStart = new Date(priorEnd);
		priorStart.setDate(priorEnd.getDate() - days + 1);
		return {
			startStr: priorStart.toISOString().slice(0, 10),
			endStr: priorEnd.toISOString().slice(0, 10),
		};
	};

	// Fetch wastage data when analytics view is active
	useEffect(() => {
		if (!currentBranch || viewMode !== "analytics") return;

		const { startDate } = getDateRange(viewPeriod);
		const endDate = new Date();
		endDate.setHours(23, 59, 59, 999);
		const startStr = startDate.toISOString().slice(0, 10);
		const endStr = endDate.toISOString().slice(0, 10);

		getWastageSummary(currentBranch.id, startStr, endStr).then(({ data }) => {
			setTotalWastageCost(data.reduce((sum, d) => sum + d.total_cost, 0));

			if (viewPeriod === "day") {
				// Day view: single bar for today
				setWastageBarData([{
					label: "Today",
					wastage: data.reduce((sum, d) => sum + d.total_cost, 0),
				}]);
			} else {
				// Week/month: daily bars
				const days = viewPeriod === "week" ? 7 : 30;
				const barData: { label: string; wastage: number }[] = [];
				for (let i = 0; i < days; i++) {
					const d = new Date(startDate);
					d.setDate(d.getDate() + i);
					const dateStr = d.toISOString().slice(0, 10);
					const label = viewPeriod === "week"
						? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
						: d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
					barData.push({ label, wastage: data.find(w => w.date === dateStr)?.total_cost ?? 0 });
				}
				setWastageBarData(barData);
			}
		});

		getTopWastedItems(currentBranch.id, startStr, endStr).then(({ data }) => {
			setTopWastedItems(data);
		});

		// Prior period wastage for comparison
		const { startStr: prevStart, endStr: prevEnd } = getPriorDateRange(viewPeriod);
		getWastageSummary(currentBranch.id, prevStart, prevEnd).then(({ data }) => {
			setPrevWastageCost(data.reduce((sum, d) => sum + d.total_cost, 0));
		});

		// Current carry-over stock (items with stock > 0)
		getInventoryItems(currentBranch.id).then(({ items }) => {
			setCarryOverItems(items.filter(item => item.stock > 0 && item.status === "active"));
		});
	}, [currentBranch, viewPeriod, viewMode]);

	// Custom tooltip formatter
	const formatTooltipValue = (value: number | undefined, name: string | undefined) => {
		if (value === undefined || name === undefined) return [0, ''];
		if (name === "revenue" || name === "profit") {
			return [formatCurrency(value), name === "revenue" ? "Revenue" : "Profit"];
		}
		return [value, name === "orders" ? "Orders" : name];
	};

	// Filter orders for table
	const filteredOrdersForTable = allOrders.filter((order) => {
		if (!searchTerm) return true;
		return (
			(order.id && order.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
			"DINE-IN".toLowerCase().includes(searchTerm.toLowerCase()) ||
			(order.items &&
				order.items.some(
					(item: OrderItem) =>
						item.name &&
						item.name.toLowerCase().includes(searchTerm.toLowerCase())
				))
		);
	});

	// Calculate pagination
	const indexOfLastOrder = currentPage * ordersPerPage;
	const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
	const currentOrders = filteredOrdersForTable.slice(
		indexOfFirstOrder,
		indexOfLastOrder
	);
	const totalPages = Math.ceil(filteredOrdersForTable.length / ordersPerPage);

	const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

	if (loading) {
		return (
			<div className='flex h-full overflow-hidden'>
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					{/* Mobile/Tablet TopBar - visible below xl: breakpoint (< 1280px) */}
					<div className='xl:hidden w-full'>
						<MobileTopBar title='Sales' icon={<SalesIcon />} />
					</div>
					{/* Desktop TopBar - visible at xl: breakpoint and above (≥ 1280px) */}
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
				{/* Mobile/Tablet TopBar - visible below xl: breakpoint (< 1280px) */}
				<div className='xl:hidden w-full'>
					<MobileTopBar title='Sales' icon={<SalesIcon />} />
				</div>
				{/* Desktop TopBar - visible at xl: breakpoint and above (≥ 1280px) */}
				<div className='hidden xl:block w-full'>
					<TopBar title='Sales' icon={<SalesIcon />} />
				</div>

				{/* Control Bar */}
				<div className='px-6 py-4'>
					<div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
						<div className='flex items-center gap-4 text-xs text-secondary/70'>
							<span className='flex items-center gap-2'>
								<span className='w-2 h-2 bg-accent rounded-full'></span>
								{currentBranch?.name || "Loading..."}
							</span>
						</div>

						<div className='flex flex-col sm:flex-row sm:items-center gap-4'>
							{/* View Toggle */}
							<div className='flex bg-accent/20 rounded-lg p-1 border-accent/30 border w-full sm:w-auto'>
								<button
									onClick={() => setViewMode("orders")}
									className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-xs font-medium transition-colors ${
										viewMode === "orders"
											? "bg-white text-secondary shadow-sm"
											: "text-secondary/60 hover:text-secondary"
									}`}>
									Recent Orders
								</button>
								<button
									onClick={() => setViewMode("analytics")}
									className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-xs font-medium transition-colors ${
										viewMode === "analytics"
											? "bg-white text-secondary shadow-sm"
											: "text-secondary/60 hover:text-secondary"
									}`}>
									Analytics
								</button>
							</div>
						</div>
					</div>
				</div>

				{/* Main Content */}
				<div className='flex-1 overflow-y-auto'>
					<div className='space-y-6'>
						{viewMode === "orders" ? (
							/* Recent Orders View */
							<>
								{/* Orders Table */}
								<div className='bg-primary rounded-xl shadow-md mx-6'>
									<div className='p-6 border-b border-gray-200'>
										<div className='flex-1 flex-col items-center gap-4'>
											<h3 className='text-base font-semibold text-secondary'>
												Recent Orders
											</h3>
											<div className='flex-1 items-center space-x-4 mt-4'>
												<div className='relative'>
													<input
														type='text'
														value={searchTerm}
														onChange={(e) => {
															setSearchTerm(e.target.value);
															setCurrentPage(1); // Reset to first page when searching
														}}
														placeholder='Search orders...'
														className={`w-full text-3 px-4 py-3 pr-12 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
															searchTerm ? "animate-pulse transition-all" : ""
														}`}
													/>
													<div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
														{searchTerm ? (
															<LoadingSpinner size="lg" />
														) : (
															<div className='size-7.5 bg-light-accent rounded-full flex items-center justify-center'>
																<SearchIcon className='mr-0.5 mb-0.5 text-accent' />
															</div>
														)}
													</div>
												</div>
											</div>
										</div>
									</div>

							<div className='overflow-x-auto rounded-lg'>
								<table className='w-full'>
									<thead className='bg-gray-50'>
										<tr>
											<th className='px-6 py-3 text-left text-xs font-medium text-secondary/60 uppercase tracking-wider'>
												Order ID
											</th>
											<th className='px-6 py-3 text-left text-xs font-medium text-secondary/60 uppercase tracking-wider'>
												Date & Time
											</th>
											<th className='px-6 py-3 text-left text-xs font-medium text-secondary/60 uppercase tracking-wider'>
												Items
											</th>
											<th className='px-6 py-3 text-left text-xs font-medium text-secondary/60 uppercase tracking-wider'>
												Type
											</th>
											<th className='px-6 py-3 text-left text-xs font-medium text-secondary/60 uppercase tracking-wider'>
												Total
											</th>
											<th className='px-6 py-3 text-left text-xs font-medium text-secondary/60 uppercase tracking-wider'>
												Profit
											</th>
										</tr>
									</thead>
									<tbody className='bg-primary divide-y divide-gray-200'>
										{currentOrders.map((order) => (
											<tr
												key={order.id}
												className='hover:bg-accent/5 cursor-pointer transition-colors'
												onClick={() => setSelectedOrder(order)}>
												<td className='px-6 py-1 whitespace-nowrap text-xs font-medium text-secondary'>
													<div className='px-2 py-1 bg-secondary/10 max-w-30 text-center font-regular rounded-xl'>
														#{order.id ? order.id.slice(-8) : "N/A"}
													</div>
												</td>
												<td className='px-6 py-4 whitespace-nowrap text-xs text-secondary'>
													{order.created_at
														? new Date(order.created_at)
																.toLocaleDateString("en-US", {
																	month: "short",
																	day: "numeric",
																	hour: "2-digit",
																	minute: "2-digit",
																})
														: "N/A"}
												</td>
												<td className='px-6 py-1 text-xs text-secondary'>
													<div className='max-w-xs'>
														<div className='truncate flex-wrap space-y-1'>
															{order.items && order.items.length > 0 ? (
																order.items.length > 3 ? (
																	// ? `${order.items.slice(0, 3).map(item => `${item.name || 'Unknown'} x${item.quantity || 0}`).join(', ')} `
																	<>
																		{" "}
																		{order.items.slice(0, 2).map((item: OrderItem) => {
																			return (
																				<div
																					className='flex-row items-center inline-flex text-3 mr-1 gap-1 border border-secondary/20 p-1 px-2 rounded-full'
																					key={item.id}>
																					{`${item.name || "Unknown"}`}
																					<div className='min-w-5 h-5 px-1 bg-secondary/20 rounded-full flex items-center justify-center text-2.5 shrink-0'>
																						{`${item.quantity || 0}`}
																					</div>
																				</div>
																			);
																		})}
																		<div className='flex items-center justify-center h-6.25 w-15 bg-accent/50 rounded-full text-2.5'>{`+${
																			order.items.length - 2
																		} more`}</div>
																	</>
																) : (
																	order.items.map((item: OrderItem) => {
																		return (
																			<div
																				className='flex-row items-center inline-flex text-3 mr-1 gap-1 border border-secondary/20 p-1 px-2 rounded-full'
																				key={item.id}>
																				{`${item.name || "Unknown"}`}
																				<div className='min-w-5 h-5 px-1 bg-secondary/20 rounded-full flex items-center justify-center text-2.5 shrink-0'>
																					{`${item.quantity || 0}`}
																				</div>
																			</div>
																		);
																	})
																)
															) : (
																"No items"
															)}
														</div>
														<p className='text-xs text-secondary/50 mt-1'>
															= {order.items.reduce((sum: number, item: OrderItem) => sum + item.quantity, 0) || 0} items total
														</p>
													</div>
												</td>
												<td className='px-6 py-1 whitespace-nowrap'>
													<div
														className="p-2 text-xs text-center w-25 font-semibold rounded-full bg-blue-100 text-blue-800">
														DINE-IN
													</div>
												</td>
												<td className='px-6 py-1 whitespace-nowrap text-xs font-medium text-gray-900'>
													{formatCurrency(order.total || 0)}
													{order.discount_amount > 0 && (
														<div className='text-xs text-red-500'>
															-{formatCurrency(order.discount_amount)}
														</div>
													)}
												</td>
												<td className='px-6 py-1 whitespace-nowrap text-xs text-green-600 font-medium'>
													{formatCurrency(calculateOrderProfit(order))}
												</td>
											</tr>
										))}
									</tbody>
								</table>

								{currentOrders.length === 0 && (
									<div className='text-center py-12'>
										<div className='w-16 h-16 mx-auto mb-4 bg-light-accent text-accent rounded-full flex items-center justify-center'>
											<svg width="27" height="25" viewBox="0 0 27 25" fill="none">
												<path d="M20.0458 4.43883V4.82573L23.9231 2.58713C23.8343 2.28661 23.6997 2.00575 23.5273 1.75262C22.9874 0.959672 22.0773 0.438915 21.0458 0.438831H5.65318C3.99633 0.438831 2.65318 1.78198 2.65318 3.43883V13.8043V14.8673L6.65318 12.5579V4.43883H10.6661V4.98809C10.6661 5.54038 11.1138 5.98809 11.6661 5.98809H15.0329C15.5852 5.98809 16.0329 5.54038 16.0329 4.98809V4.43883H20.0458Z" fill="currentColor"/>
												<path d="M13.6701 8.5067H8.06559V9.54685H11.8685L13.6701 8.5067Z" fill="currentColor"/>
												<path d="M20.0458 20.85H6.65318V15.5951L2.65318 17.9045V18.867V21.85C2.65338 23.5066 3.99645 24.85 5.65318 24.85H21.0458C22.7024 24.8498 24.0456 23.5066 24.0458 21.85V6.51602V5.55347L20.0458 7.86287V20.85Z" fill="currentColor"/>
												<path d="M18.6334 15.7937H8.06559V16.8338H18.6334V15.7937Z" fill="currentColor"/>
												<path d="M18.6334 12.1502H12.6199L10.8183 13.1903H18.6334V12.1502Z" fill="currentColor"/>
												<path d="M18.6334 9.54685V8.67832L17.129 9.54685H18.6334Z" fill="currentColor"/>
												<path d="M2.65318 18.867V17.9045L0 19.4363V20.3988L2.65318 18.867Z" fill="currentColor"/>
												<path d="M2.65318 14.8673V13.8043L0 15.3361V16.3992L2.65318 14.8673Z" fill="currentColor"/>
												<path d="M23.5273 1.75262C23.6997 2.00575 23.8343 2.28661 23.9231 2.58713L26.5629 1.06303V0L23.5273 1.75262Z" fill="currentColor"/>
												<path d="M24.0458 5.55347V6.51602L26.5629 5.06272V4.10017L24.0458 5.55347Z" fill="currentColor"/>
											</svg>
										</div>
										<p className='text-secondary'>
											{searchTerm
												? "No orders found matching your search"
												: "No orders yet"}
										</p>
									</div>
								)}
							</div>

							{/* Pagination */}
							{totalPages > 1 && (
								<div className='px-6 py-4 border-t border-secondary/20'>
									<div className='flex items-center justify-between'>
										<div className='text-xs text-secondary/50'>
											Showing {indexOfFirstOrder + 1}-
											{Math.min(
												indexOfLastOrder,
												filteredOrdersForTable.length
											)}{" "}
											of {filteredOrdersForTable.length} orders
										</div>
										<div className='flex items-center space-x-2'>
											<button
												onClick={() => paginate(currentPage - 1)}
												disabled={currentPage === 1}
												className='px-3 py-1 text-xs bg-secondary/5 border border-secondary/50 rounded-md hover:bg-secondary/10 disabled:opacity-30 disabled:cursor-not-allowed'>
												Previous
											</button>

											{/* Page numbers */}
											{[...Array(totalPages)].map((_, index) => {
												const pageNumber = index + 1;
												const isCurrentPage = pageNumber === currentPage;
												const showPage =
													pageNumber === 1 ||
													pageNumber === totalPages ||
													(pageNumber >= currentPage - 1 &&
														pageNumber <= currentPage + 1);

												if (!showPage) {
													if (
														pageNumber === currentPage - 2 ||
														pageNumber === currentPage + 2
													) {
														return (
															<span
																key={pageNumber}
																className='px-2 text-secondary/40'>
																...
															</span>
														);
													}
													return null;
												}

												return (
													<button
														key={pageNumber}
														onClick={() => paginate(pageNumber)}
														className={`px-3 py-1 text-xs border font-semibold rounded-md ${
															isCurrentPage
																? "bg-accent text-primary border-accent"
																: "bg-secondary/5 border-secondary/50 text-secondary"
														}`}>
														{pageNumber}
													</button>
												);
											})}

											<button
												onClick={() => paginate(currentPage + 1)}
												disabled={currentPage === totalPages}
												className='px-3 py-1 text-xs border bg-secondary/5 border-secondary/50 rounded-md hover:bg-secondary/10 disabled:opacity-30  disabled:cursor-not-allowed'>
												Next
											</button>
										</div>
									</div>
								</div>
							)}
						    </div>
					    </>
            ) : (
              /* Analytics View */
              <>
                {/* Controls Section */}
                <div className='px-4 lg:px-12 py-4 bg-primary shadow-md mx-6 rounded-xl'>
                  <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
                    <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
                      <span className='text-xs font-medium text-secondary/50'>
                        Time Period:
                      </span>
                      <div className='flex bg-primary rounded-lg p-1 space-x-2'>
                        {(["day", "week", "month"] as ViewPeriod[]).map(
                          (period) => (
                            <button
                              key={period}
                              onClick={() => setViewPeriod(period)}
                              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-xs rounded-md transition-colors border border-transparent ${
                                viewPeriod === period
                                  ? "bg-accent text-primary text-shadow-md font-bold"
                                  : "font-medium hover:border hover:border-accent text-secondary/50 hover:text-secondary hover:bg-text-secondary/80"
                              }`}>
                              {period === "day"
                                ? "24 Hours"
                                : period === "week"
                                ? "7 Days"
                                : "30 Days"}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                    <div className='text-left lg:text-right'>
                      <p className='text-xs text-gray-400'>Live Data</p>
                      <span className='flex items-center lg:justify-end'>
                        <LoadingSpinner className="w-3! h-3! border-success bg-success/20 shadow-sm" />
                        <p className='ml-2 text-xs text-success drop-shadow-md'>
                          Real-time ({allOrders.length} orders)
                        </p>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mx-6'>
                  <div className='bg-primary p-6 rounded-xl shadow-md'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='text-xs font-medium text-secondary/40'>
                          {viewPeriod === "day"
                            ? "Today"
                            : viewPeriod === "week"
                            ? "7 Days"
                            : "30 Days"}{" "}
                          Revenue
                        </p>
                        <p className='text-xl text-secondary'>
                          <span className='font-regular text-lg mr-1'>₱</span>
                          <span className='font-semibold'>{formatCurrency(currentPeriodStats.totalRevenue).slice(1)}</span>
                        </p>
                      </div>
                      <div className='w-12 h-12 bg-light-accent rounded-lg flex items-center justify-center'>
                        <svg
                          className='w-6 h-6 text-accent'
                          fill='currentColor'
                          viewBox='0 0 20 20'>
                          <path
                            fillRule='evenodd'
                            d='M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z'
                            clipRule='evenodd'
                          />
                        </svg>
                      </div>
                    </div>
                    <p className='text-xs text-secondary/50 mt-2'>
                      Profit: {formatCurrency(currentPeriodStats.totalProfit)} (
                      {currentPeriodStats.profitMargin.toFixed(1)}%)
                    </p>
                  </div>

                  <div className='bg-primary p-6 rounded-xl shadow-md'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='text-xs font-medium text-secondary/40'>
                          Total Orders
                        </p>
                        <p className='text-xl font-bold text-secondary'>
                          {currentPeriodStats.totalOrders}
                        </p>
                      </div>
                      <div className='w-12 h-12 bg-light-accent rounded-lg flex items-center justify-center'>
                        <svg
                          className='w-6 h-6 text-accent'
                          fill='currentColor'
                          viewBox='0 0 20 20'>
                          <path d='M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z' />
                        </svg>
                      </div>
                    </div>
                    <p className='text-xs text-secondary/50 mt-2'>
                      Avg:{" "}
                      {formatCurrency(
                        currentPeriodStats.totalOrders > 0
                          ? currentPeriodStats.totalRevenue /
                              currentPeriodStats.totalOrders
                          : 0
                      )}
                    </p>
                  </div>

                  {/* Wastage Cost stat card */}
                  <div className='bg-primary p-6 rounded-xl shadow-md'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='text-xs font-medium text-secondary/40'>
                          Wastage Cost
                        </p>
                        <p className='text-xl text-secondary'>
                          <span className='font-regular text-lg mr-1'>₱</span>
                          <span className='font-semibold'>{formatCurrency(totalWastageCost).slice(1)}</span>
                        </p>
                      </div>
                      <div className='w-12 h-12 bg-light-accent rounded-lg flex items-center justify-center'>
                        <svg className='w-6 h-6 text-accent' fill='currentColor' viewBox='0 0 20 20'>
                          <path fillRule='evenodd' d='M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z' clipRule='evenodd' />
                        </svg>
                      </div>
                    </div>
                    <p className='text-xs text-secondary/50 mt-2'>
                      {prevWastageCost === null ? (
                        "Stock destocked this period"
                      ) : prevWastageCost === 0 && totalWastageCost === 0 ? (
                        "No wastage recorded"
                      ) : prevWastageCost === 0 ? (
                        `vs ${viewPeriod === "day" ? "yesterday" : viewPeriod === "week" ? "last 7d" : "last 30d"}: no prior data`
                      ) : (() => {
                        const pct = ((totalWastageCost - prevWastageCost) / prevWastageCost) * 100;
                        const label = viewPeriod === "day" ? "vs yesterday" : viewPeriod === "week" ? "vs last 7d" : "vs last 30d";
                        return pct > 0
                          ? `↑ ${pct.toFixed(0)}% ${label}`
                          : pct < 0
                          ? `↓ ${Math.abs(pct).toFixed(0)}% ${label}`
                          : `No change ${label}`;
                      })()}
                    </p>
                  </div>

                  <div className='bg-primary p-6 rounded-xl shadow-md'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='text-xs font-medium text-secondary/40'>
                          Peak {viewPeriod === "day" ? "Hour" : "Day"}
                        </p>
                        <p className='text-xl font-bold text-secondary'>
                          {timeSeriesData.length > 0
                            ? timeSeriesData.reduce(
                                (peak, current) =>
                                  current.orders > peak.orders ? current : peak,
                                timeSeriesData[0]
                              ).label
                            : "--"}
                        </p>
                      </div>
                      <div className='w-12 h-12 bg-light-accent rounded-lg flex items-center justify-center'>
                        <svg
                          className='w-6 h-6 text-accent'
                          fill='currentColor'
                          viewBox='0 0 20 20'>
                          <path
                            fillRule='evenodd'
                            d='M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z'
                            clipRule='evenodd'
                          />
                        </svg>
                      </div>
                    </div>
                    <p className='text-xs text-secondary/50 mt-2'>
                      {timeSeriesData.length > 0
                        ? `${
                            timeSeriesData.reduce(
                              (peak, current) =>
                                current.orders > peak.orders ? current : peak,
                              timeSeriesData[0]
                            ).orders
                          } orders`
                        : "0 orders"}
                    </p>
                  </div>
                </div>

                {/* Main Chart */}
                <div className='bg-primary p-6 rounded-xl shadow-md mx-6'>
                  <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6'>
                    <div>
                      <h3 className='text-base font-semibold text-secondary'>
                        {viewPeriod === "day"
                          ? "Today's Activity"
                          : viewPeriod === "week"
                          ? "Last 7 Days"
                          : "Last 30 Days"}
                      </h3>
                      <p className='text-xs text-gray-400'>
                        {viewPeriod === "day"
                          ? "Hourly breakdown"
                          : "Daily performance trends"}
                      </p>
                    </div>
                    <div className='flex items-center space-x-4 flex-wrap gap-2'>
                      <div className='flex items-center space-x-2'>
                        <div className='w-3 h-3 bg-secondary rounded-full'></div>
                        <span className='text-xs text-gray-400'>Orders</span>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <div className='w-3 h-3 bg-accent rounded-full'></div>
                        <span className='text-xs text-gray-400'>Revenue</span>
                      </div>
                    </div>
                  </div>
                  <div className='h-96'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <LineChart data={timeSeriesData}>
                        <CartesianGrid
                          strokeDasharray='1 1'
                          stroke='#374151'
                          opacity={0.3}
                        />
                        <XAxis
                          label={{
                            value: "Time",
                            position: "insideBottom",
                            offset: -5,
                            fill: "#9CA3AF",
                          }}
                          dataKey='label'
                          stroke='#9CA3AF'
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          label={{
                            value: "Revenue",
                            angle: -90,
                            position: "insideLeft",
                            fill: "#9CA3AF",
                          }}
                          stroke='#9CA3AF'
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          formatter={formatTooltipValue}
                          contentStyle={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid varaccent/20",
                            borderRadius: "8px",
                            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
                          }}
                          labelStyle={{ color: "bg-gray-50" }}
                        />
                        <Line
                          type='monotone'
                          dataKey='orders'
                          stroke='var(--secondary)'
                          strokeWidth={3}
                          name='orders'
                          dot={{ fill: "var(--secondary)", strokeWidth: 0, r: 4 }}
                          activeDot={{ r: 6, fill: "orange", strokeWidth: 0 }}
                        />
                        <Line
                          type='monotone'
                          dataKey='revenue'
                          stroke='var(--accent)'
                          strokeWidth={3}
                          name='revenue'
                          dot={{ fill: "var(--accent)", strokeWidth: 0, r: 4 }}
                          activeDot={{ r: 6, fill: "orange", strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Wastage Bar Chart — only for week/month, day has no meaningful hourly breakdown */}
                {viewPeriod !== "day" && (
                  <div className='bg-primary p-6 rounded-xl shadow-md mx-6'>
                    <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6'>
                      <div>
                        <h3 className='text-base font-semibold text-secondary'>
                          Daily Wastage Cost
                        </h3>
                        <p className='text-xs text-gray-400'>Stock destocked per day</p>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <div className='w-3 h-3 bg-red-400 rounded-full'></div>
                        <span className='text-xs text-gray-400'>Wastage</span>
                      </div>
                    </div>
                    <div className='h-48'>
                      <ResponsiveContainer width='100%' height='100%'>
                        <BarChart data={wastageBarData} barSize={viewPeriod === "week" ? 20 : 10}>
                          <CartesianGrid strokeDasharray='1 1' stroke='#374151' opacity={0.3} vertical={false} />
                          <XAxis
                            dataKey='label'
                            stroke='#9CA3AF'
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke='#9CA3AF'
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `₱${v}`}
                          />
                          <Tooltip
                            formatter={(value: number | undefined) => [formatCurrency(value ?? 0), "Wastage"]}
                            contentStyle={{
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #fee2e2",
                              borderRadius: "8px",
                              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                            }}
                          />
                          <Bar dataKey='wastage' fill='#f87171' radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Top Wasted Items */}
                {topWastedItems.length > 0 && (
                  <div className='bg-primary p-6 rounded-xl shadow-md mx-6'>
                    <div className='mb-4'>
                      <h3 className='text-base font-semibold text-secondary'>Top Wasted Items</h3>
                      <p className='text-xs text-gray-400'>Ranked by total wastage cost for this period</p>
                    </div>
                    <div className='space-y-3'>
                      {topWastedItems.map((item, idx) => (
                        <div key={item.item_name} className='flex items-center gap-3'>
                          <span className='text-xs font-bold text-secondary/30 w-4 shrink-0'>{idx + 1}</span>
                          <div className='flex-1 min-w-0'>
                            <p className='text-xs font-medium text-secondary truncate'>{item.item_name}</p>
                            <div className='mt-1 h-1.5 bg-red-100 rounded-full overflow-hidden'>
                              <div
                                className='h-full bg-red-400 rounded-full'
                                style={{ width: `${Math.min(100, (item.total_cost / topWastedItems[0].total_cost) * 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className='text-right shrink-0'>
                            <p className='text-xs font-semibold text-red-500'>{formatCurrency(item.total_cost)}</p>
                            <p className='text-2.5 text-secondary/40'>{item.total_quantity} units</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Carry-Over Stock */}
                {carryOverItems.length > 0 && (
                  <div className='bg-primary p-6 rounded-xl shadow-md mx-6'>
                    <div className='flex items-start justify-between mb-4'>
                      <div>
                        <h3 className='text-base font-semibold text-secondary'>Carry-Over Stock</h3>
                        <p className='text-xs text-gray-400'>Items currently in stock — carried from prior day</p>
                      </div>
                      <div className='text-right shrink-0'>
                        <p className='text-xs font-semibold text-secondary'>
                          {carryOverItems.reduce((s, i) => s + i.stock, 0)} units
                        </p>
                        <p className='text-2.5 text-secondary/40'>
                          {carryOverItems.length} item{carryOverItems.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className='space-y-3'>
                      {(() => {
                        const sorted = carryOverItems.slice().sort((a, b) => b.stock * b.price - a.stock * a.price).slice(0, 8);
                        const maxValue = sorted.length > 0 ? sorted[0].stock * sorted[0].price : 0;
                        return (
                          <>
                            {sorted.map((item) => {
                              const pct = maxValue > 0 ? (item.stock * item.price / maxValue) * 100 : 0;
                              return (
                                <div key={item.id} className='flex items-center gap-3'>
                                  <div className='flex-1 min-w-0'>
                                    <p className='text-xs font-medium text-secondary truncate'>{item.name}</p>
                                    <div className='mt-1 h-1.5 bg-accent/10 rounded-full overflow-hidden'>
                                      <div
                                        className='h-full bg-accent/40 rounded-full'
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div className='text-right shrink-0'>
                                    <p className='text-xs font-semibold text-secondary'>{formatCurrency(item.stock * item.price)}</p>
                                    <p className='text-2.5 text-secondary/40'>{item.stock} units</p>
                                  </div>
                                </div>
                              );
                            })}
                            {carryOverItems.length > 8 && (
                              <p className='text-2.5 text-secondary/30 text-center pt-1'>
                                +{carryOverItems.length - 8} more items
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}

				<div className='h-25' />
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

					{/* Branded header — padded content separate from full-bleed SVG */}
					<div className='bg-white rounded-t-2xl pt-5 pb-0 text-center'>
						{/* Padded content area */}
						<div className='relative px-6'>
							{/* Close button */}
							<button
								onClick={() => setSelectedOrder(null)}
								className='absolute top-0 right-4 text-secondary/30 hover:text-secondary transition-colors text-xl leading-none'>
								×
							</button>

							{/* Logo mark */}
							<LogoIcon className='w-12 h-12 mx-auto' />

							{/* Brand name */}
							<p className='text-secondary font-sans font-bold text-xs tracking-widest uppercase mt-2'>
								Fredelecacies
							</p>

							{/* Branch name */}
							<p className='text-secondary/50 font-sans text-xs mt-1 mb-4'>
								{currentBranch?.name}
							</p>
						</div>

						{/* Scalloped arch divider — full bleed, unaffected by padding */}
						<svg viewBox="0 0 320 16" xmlns="http://www.w3.org/2000/svg" className='w-full block'>
							<path d="M0,16 Q8,2 16,16 Q24,2 32,16 Q40,2 48,16 Q56,2 64,16 Q72,2 80,16 Q88,2 96,16 Q104,2 112,16 Q120,2 128,16 Q136,2 144,16 Q152,2 160,16 Q168,2 176,16 Q184,2 192,16 Q200,2 208,16 Q216,2 224,16 Q232,2 240,16 Q248,2 256,16 Q264,2 272,16 Q280,2 288,16 Q296,2 304,16 Q312,2 320,16" fill="none" stroke="#e5e7eb" strokeWidth="1" />
						</svg>
					</div>

					{/* Receipt body */}
					<div className='px-5 pt-4 pb-5 font-mono text-secondary'>

						{/* Order ID + date row */}
						<div className='flex items-start justify-between gap-2'>
							<div>
								<p className='font-bold text-sm'>
									#{selectedOrder.order_number
										? selectedOrder.order_number.replace('ORD-', '')
										: selectedOrder.id.slice(-8).toUpperCase()}
								</p>
								<p className='text-secondary/40 text-xs mt-0.5 font-sans'>
									{new Date(selectedOrder.created_at).toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
										year: 'numeric',
									})}
									{' · '}
									{new Date(selectedOrder.created_at).toLocaleTimeString('en-US', {
										hour: '2-digit',
										minute: '2-digit',
									})}
								</p>
							</div>

							{/* Payment method badge */}
							<span className={`shrink-0 mt-0.5 px-2.5 py-1 rounded-full text-xs font-sans font-semibold ${
								selectedOrder.payment_method === 'gcash'
									? 'bg-blue-100 text-blue-700'
									: selectedOrder.payment_method === 'grab'
									? 'bg-green-100 text-green-700'
									: 'bg-secondary/10 text-secondary'
							}`}>
								{selectedOrder.payment_method === 'gcash'
									? 'GCash'
									: selectedOrder.payment_method === 'grab'
									? 'Grab'
									: 'Cash'}
							</span>
						</div>

						{/* Dotted divider */}
						<div className='border-t border-dashed border-secondary/20 my-4' />

						{/* Items */}
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
									{item.is_bundle && Array.isArray(item.bundle_components) && item.bundle_components.length > 0 && (
										<div className='ml-3 mt-1 space-y-1'>
											{item.bundle_components.map((comp: any, idx: number) => (
												<div key={idx} className='flex items-center gap-1 text-secondary/40'>
													<span>↳</span>
													<span>
														{comp.inventory_item?.name || comp.name || 'Item'}
														{comp.quantity > 1 && <span className='ml-1 opacity-60'>×{comp.quantity}</span>}
													</span>
												</div>
											))}
										</div>
									)}
								</div>
							))}
						</div>

						{/* Dotted divider */}
						<div className='border-t border-dashed border-secondary/20 my-4' />

						{/* Summary */}
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
								const grabFee = selectedOrder.total - (selectedOrder.subtotal - selectedOrder.discount_amount);
								return selectedOrder.payment_method === 'grab' && grabFee > 0.005 ? (
									<div className='flex justify-between'>
										<span className='text-secondary/50'>Grab Fee</span>
										<span className='tabular-nums text-amber-600'>
											+{formatCurrency(grabFee)}
										</span>
									</div>
								) : null;
							})()}
						</div>

						{/* Total — solid divider + larger */}
						<div className='border-t-2 border-secondary/20 mt-4 pt-3 flex justify-between items-baseline'>
							<span className='text-sm font-bold'>TOTAL</span>
							<span className='text-base font-bold tabular-nums'>{formatCurrency(selectedOrder.total)}</span>
						</div>

						{/* Dotted divider */}
						<div className='border-t border-dashed border-secondary/20 my-4' />

						{/* Profit */}
						<div className='flex justify-between text-xs font-sans'>
							<span className='text-secondary/40 uppercase tracking-wide text-2.5'>Profit</span>
							<span className='text-success font-semibold tabular-nums'>
								{formatCurrency(calculateOrderProfit(selectedOrder))}
							</span>
						</div>

						{/* Close button */}
						<button
							onClick={() => setSelectedOrder(null)}
							className='w-full mt-5 py-2.5 text-xs font-semibold text-secondary/50 border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-secondary transition-colors'>
							Close
						</button>

					</div>
				</div>
			</div>
		)}
		</div>
	);
}
