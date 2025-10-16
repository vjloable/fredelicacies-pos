"use client";

import { useState, useEffect, useCallback } from "react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { subscribeToOrders } from "@/stores/dataStore";
import { Order } from "@/services/orderService";
import { formatCurrency } from "@/services/salesService";
import { useBranch } from "@/contexts/BranchContext";
import SearchIcon from "../store/icons/SearchIcon";
import SalesIcon from "@/components/icons/SidebarNav/SalesIcon";
import ViewOnlyWrapper from "@/components/ViewOnlyWrapper";

interface TimeSeriesData {
	label: string;
	date: string;
	orders: number;
	revenue: number;
	profit: number;
}

type ViewPeriod = "day" | "week" | "month";

export default function SalesScreen() {
	const { currentBranch } = useBranch(); // Get current branch context
	const [viewPeriod, setViewPeriod] = useState<ViewPeriod>("day");
	const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
	const [allOrders, setAllOrders] = useState<Order[]>([]);
	const [loading, setLoading] = useState(true);
	const [currentPeriodStats, setCurrentPeriodStats] = useState({
		totalRevenue: 0,
		totalOrders: 0,
		totalProfit: 0,
		profitMargin: 0,
	});

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
			(orders: Order[]) => {
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
		(period: ViewPeriod): Order[] => {
			const { startDate, endDate } = getDateRange(period);

			return allOrders.filter((order) => {
				if (!order.createdAt) return false;
				const orderDate = order.createdAt.toDate();
				return orderDate >= startDate && orderDate <= endDate;
			});
		},
		[allOrders]
	);

	// Generate time series data based on period
	const generateTimeSeriesData = useCallback(
		(orders: Order[], period: ViewPeriod): TimeSeriesData[] => {
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
						if (!order.createdAt) return false;
						const orderDate = order.createdAt.toDate();
						return orderDate >= hourStart && orderDate <= hourEnd;
					});

					const revenue = hourOrders.reduce(
						(sum, order) => sum + order.total,
						0
					);
					const profit = hourOrders.reduce(
						(sum, order) => sum + (order.totalProfit || 0),
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
						if (!order.createdAt) return false;
						const orderDate = order.createdAt.toDate();
						return orderDate >= dayStart && orderDate <= dayEnd;
					});

					const revenue = dayOrders.reduce(
						(sum, order) => sum + order.total,
						0
					);
					const profit = dayOrders.reduce(
						(sum, order) => sum + (order.totalProfit || 0),
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
			(sum, order) => sum + (order.totalProfit || 0),
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

	// Custom tooltip formatter
	const formatTooltipValue = (value: number, name: string) => {
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
			(order.orderType &&
				order.orderType.toLowerCase().includes(searchTerm.toLowerCase())) ||
			(order.items &&
				order.items.some(
					(item) =>
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
		<ViewOnlyWrapper branchId={currentBranch?.id} pageName='sales'>
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

					{/* Main Content */}
					<div className='flex-1 overflow-y-auto pt-4'>
						<div className='space-y-6'>
							{/* Orders Table */}
							<div className='bg-[var(--primary)] rounded-xl shadow-md mx-6'>
								<div className='p-6 border-b border-gray-200'>
									<div className='flex-1 flex-col items-center gap-4'>
										<h3 className='text-lg font-semibold text-[var(--secondary)]'>
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
													className={`w-full text-[12px] px-4 py-3 pr-12 border-2 border-[var(--secondary)]/20 bg-white rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent ${
														searchTerm ? "animate-pulse transition-all" : ""
													}`}
												/>
												<div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
													{searchTerm ? (
														<div className='size-[30px] border-[var(--accent)] border-y-2 rounded-full flex items-center justify-center animate-spin'></div>
													) : (
														<div className='size-[30px] bg-[var(--light-accent)] rounded-full flex items-center justify-center'>
															<SearchIcon className='mr-[2px] mb-[2px]' />
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
												<th className='px-6 py-3 text-left text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider'>
													Order ID
												</th>
												<th className='px-6 py-3 text-left text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider'>
													Date & Time
												</th>
												<th className='px-6 py-3 text-left text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider'>
													Items
												</th>
												<th className='px-6 py-3 text-left text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider'>
													Type
												</th>
												<th className='px-6 py-3 text-left text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider'>
													Total
												</th>
												<th className='px-6 py-3 text-left text-xs font-medium text-[var(--secondary)]/60 uppercase tracking-wider'>
													Profit
												</th>
											</tr>
										</thead>
										<tbody className='bg-[var(--primary)] divide-y divide-gray-200'>
											{currentOrders.map((order) => (
												<tr key={order.id} className='hover:bg-gray-50'>
													<td className='px-6 py-1 whitespace-nowrap text-sm font-medium text-[var(--secondary)]'>
														<div className='px-2 py-1 bg-[var(--secondary)]/10 max-w-[120px] text-center font-regular rounded-[12px]'>
															#{order.id ? order.id.slice(-8) : "N/A"}
														</div>
													</td>
													<td className='px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary)]'>
														{order.createdAt
															? order.createdAt
																	.toDate()
																	.toLocaleDateString("en-US", {
																		month: "short",
																		day: "numeric",
																		hour: "2-digit",
																		minute: "2-digit",
																	})
															: "N/A"}
													</td>
													<td className='px-6 py-1 text-sm text-[var(--secondary)]'>
														<div className='max-w-xs'>
															<div className='truncate flex-wrap space-y-1'>
																{order.items && order.items.length > 0 ? (
																	order.items.length > 3 ? (
																		// ? `${order.items.slice(0, 3).map(item => `${item.name || 'Unknown'} x${item.quantity || 0}`).join(', ')} `
																		<>
																			{" "}
																			{order.items.slice(0, 2).map((item) => {
																				return (
																					<div
																						className='flex-row items-center inline-flex text-[12px] mr-1 gap-1 border-1 border-[var(--secondary)]/20 p-1 px-2 rounded-full'
																						key={item.id}>
																						{`${item.name || "Unknown"}`}
																						<div className='size-5 bg-[var(--secondary)]/20 rounded-full text-center text-[10px] p-1'>
																							{`${item.quantity || 0}`}
																						</div>
																					</div>
																				);
																			})}
																			<div className='flex items-center justify-center h-[25px] w-15 bg-[var(--accent)]/50 rounded-full text-center text-[10px] p-1'>{`+${
																				order.items.length - 2
																			} more`}</div>
																		</>
																	) : (
																		order.items.map((item) => {
																			return (
																				<div
																					className='flex-row items-center inline-flex text-[12px] mr-1 gap-1 border-1 border-[var(--secondary)]/20 p-1 px-2 rounded-full'
																					key={item.id}>
																					{`${item.name || "Unknown"}`}
																					<div className='size-5 bg-[var(--secondary)]/20 rounded-full text-center text-[10px] p-1'>
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
															<p className='text-xs text-[var(--secondary)]/50 mt-1'>
																= {order.itemCount || 0} items total
															</p>
														</div>
													</td>
													<td className='px-6 py-1 whitespace-nowrap'>
														<div
															className={`p-2 text-xs text-center w-[100px] font-semibold rounded-full ${
																(order.orderType || "DINE-IN") === "DINE-IN"
																	? "bg-blue-100 text-blue-800"
																	: (order.orderType || "DINE-IN") ===
																	  "TAKE OUT"
																	? "bg-green-100 text-green-800"
																	: "bg-orange-100 text-orange-800"
															}`}>
															{order.orderType || "DINE-IN"}
														</div>
													</td>
													<td className='px-6 py-1 whitespace-nowrap text-sm font-medium text-gray-900'>
														{formatCurrency(order.total || 0)}
														{order.discountAmount > 0 && (
															<div className='text-xs text-red-500'>
																-{formatCurrency(order.discountAmount)}
															</div>
														)}
													</td>
													<td className='px-6 py-1 whitespace-nowrap text-sm text-green-600 font-medium'>
														{formatCurrency(order.totalProfit || 0)}
													</td>
												</tr>
											))}
										</tbody>
									</table>

									{currentOrders.length === 0 && (
										<div className='text-center py-12'>
											<div className='w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center'>
												<svg
													className='w-8 h-8 text-gray-400'
													fill='currentColor'
													viewBox='0 0 20 20'>
													<path
														fillRule='evenodd'
														d='M10 2a8 8 0 100 16 8 8 0 000-16zM8 7a1 1 0 012 0v4a1 1 0 11-2 0V7zm2 8a1 1 0 100-2 1 1 0 000 2z'
														clipRule='evenodd'
													/>
												</svg>
											</div>
											<p className='text-gray-500'>
												{searchTerm
													? "No orders found matching your search"
													: "No orders yet"}
											</p>
										</div>
									)}
								</div>

								{/* Pagination */}
								{totalPages > 1 && (
									<div className='px-6 py-4 border-t border-gray-200'>
										<div className='flex items-center justify-between'>
											<div className='text-sm text-[var(--secondary)]/50'>
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
													className='px-3 py-1 text-sm bg-[var(--secondary)]/5 border border-[var(--secondary)]/50 rounded-md hover:bg-[var(--secondary)]/10 disabled:opacity-30 disabled:cursor-not-allowed'>
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
																	className='px-2 text-[var(--secondary)]/40'>
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
															className={`px-3 py-1 text-sm border font-semibold rounded-md ${
																isCurrentPage
																	? "bg-[var(--accent)] text-[var(--primary)] border-[var(--accent)]"
																	: "bg-[var(--secondary)]/5 border-[var(--secondary)]/50 text-[var(--secondary)]"
															}`}>
															{pageNumber}
														</button>
													);
												})}

												<button
													onClick={() => paginate(currentPage + 1)}
													disabled={currentPage === totalPages}
													className='px-3 py-1 text-sm border bg-[var(--secondary)]/5 border-[var(--secondary)]/50 rounded-md hover:bg-[var(--secondary)]/10 disabled:opacity-30  disabled:cursor-not-allowed'>
													Next
												</button>
											</div>
										</div>
									</div>
								)}
							</div>

							{/* Controls Section */}
							<div className='px-12 py-4 bg-[var(--primary)] shadow-md'>
								<div className='flex items-center justify-between'>
									<div className='flex items-center gap-2'>
										<span className='text-sm font-medium text-[var(--secondary)]/50'>
											Time Period:
										</span>
										<div className='flex bg-[var(--primary)] rounded-lg p-1 space-x-2'>
											{(["day", "week", "month"] as ViewPeriod[]).map(
												(period) => (
													<button
														key={period}
														onClick={() => setViewPeriod(period)}
														className={`px-4 py-2 text-sm rounded-md transition-colors border-1 border-transparent ${
															viewPeriod === period
																? "bg-[var(--accent)] text-[var(--primary)] text-shadow-md font-bold"
																: "font-medium hover:border-1 hover:border-[var(--accent)] text-[var(--secondary)]/50 hover:text-[var(--secondary)] hover:bg-text-[var(--secondary)]/80"
														}`}>
														{period === "day"
															? "Last 24 Hours"
															: period === "week"
															? "Last 7 Days"
															: "Last 30 Days"}
													</button>
												)
											)}
										</div>
									</div>
									<div className='text-right'>
										<p className='text-xs text-gray-400'>Live Data</p>
										<span className='flex items-center justify-end'>
											<div className='bg-[var(--success)]/20 size-3 border-2 border-[var(--success)] border-dashed rounded-full shadow-sm animate-spin' />
											<p className='ml-2 text-sm text-[var(--success)] drop-shadow-md'>
												Real-time ({allOrders.length} orders)
											</p>
										</span>
									</div>
								</div>
							</div>

							{/* Summary Stats */}
							<div className='grid grid-cols-1 md:grid-cols-3 gap-4 mx-6'>
								<div className='bg-[var(--primary)] p-6 rounded-xl shadow-md'>
									<div className='flex items-center justify-between'>
										<div>
											<p className='text-sm font-medium text-gray-400'>
												{viewPeriod === "day"
													? "Today"
													: viewPeriod === "week"
													? "7 Days"
													: "30 Days"}{" "}
												Revenue
											</p>
											<p className='text-2xl font-bold text-[var(--secondary)]'>
												{formatCurrency(currentPeriodStats.totalRevenue)}
											</p>
										</div>
										<div className='w-12 h-12 bg-[var(--light-accent)] rounded-lg flex items-center justify-center'>
											<svg
												className='w-6 h-6 text-[var(--accent)]'
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
									<p className='text-xs text-gray-500 mt-2'>
										Profit: {formatCurrency(currentPeriodStats.totalProfit)} (
										{currentPeriodStats.profitMargin.toFixed(1)}%)
									</p>
								</div>

								<div className='bg-[var(--primary)] p-6 rounded-xl shadow-md'>
									<div className='flex items-center justify-between'>
										<div>
											<p className='text-sm font-medium text-gray-400'>
												Total Orders
											</p>
											<p className='text-2xl font-bold text-[var(--secondary)]'>
												{currentPeriodStats.totalOrders}
											</p>
										</div>
										<div className='w-12 h-12 bg-[var(--light-accent)] rounded-lg flex items-center justify-center'>
											<svg
												className='w-6 h-6 text-[var(--accent)]'
												fill='currentColor'
												viewBox='0 0 20 20'>
												<path d='M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z' />
											</svg>
										</div>
									</div>
									<p className='text-xs text-gray-500 mt-2'>
										Avg:{" "}
										{formatCurrency(
											currentPeriodStats.totalOrders > 0
												? currentPeriodStats.totalRevenue /
														currentPeriodStats.totalOrders
												: 0
										)}
									</p>
								</div>

								<div className='bg-[var(--primary)] p-6 rounded-xl shadow-md'>
									<div className='flex items-center justify-between'>
										<div>
											<p className='text-sm font-medium text-gray-400'>
												Peak {viewPeriod === "day" ? "Hour" : "Day"}
											</p>
											<p className='text-2xl font-bold text-[var(--secondary)]'>
												{timeSeriesData.length > 0
													? timeSeriesData.reduce(
															(peak, current) =>
																current.orders > peak.orders ? current : peak,
															timeSeriesData[0]
													  ).label
													: "--"}
											</p>
										</div>
										<div className='w-12 h-12 bg-[var(--light-accent)] rounded-lg flex items-center justify-center'>
											<svg
												className='w-6 h-6 text-[var(--accent)]'
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
									<p className='text-xs text-gray-500 mt-2'>
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

								{/* <div className="bg-[var(--primary)] p-6 rounded-xl shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Growth</p>
                    <p className="text-2xl font-bold text-[var(--secondary)]">
                      {timeSeriesData.length >= 2 
                        ? `${((timeSeriesData[timeSeriesData.length - 1].revenue - timeSeriesData[timeSeriesData.length - 2].revenue) / Math.max(timeSeriesData[timeSeriesData.length - 2].revenue, 1) * 100).toFixed(1)}%`
                        : '0%'
                      }
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-[var(--light-accent)] rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  vs previous {viewPeriod === 'day' ? 'hour' : 'day'}
                </p>
              </div> */}
							</div>

							{/* Main Chart */}
							<div className='bg-[var(--primary)] p-6 rounded-xl shadow-md mx-6'>
								<div className='flex items-center justify-between mb-6'>
									<div>
										<h3 className='text-lg font-semibold text-[var(--secondary)]'>
											{viewPeriod === "day"
												? "Today's Activity"
												: viewPeriod === "week"
												? "Last 7 Days"
												: "Last 30 Days"}
										</h3>
										<p className='text-sm text-gray-400'>
											{viewPeriod === "day"
												? "Hourly breakdown"
												: "Daily performance trends"}
										</p>
									</div>
									<div className='flex items-center space-x-4'>
										<div className='flex items-center space-x-2'>
											<div className='w-3 h-3 bg-[var(--secondary)] rounded-full'></div>
											<span className='text-xs text-gray-400'>Orders</span>
										</div>
										<div className='flex items-center space-x-2'>
											<div className='w-3 h-3 bg-[var(--accent)] rounded-full'></div>
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
													border: "1px solid var(--accent)/20",
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

							<div className='h-[100px]' />
						</div>
					</div>
				</div>
			</div>
		</ViewOnlyWrapper>
	);
}
