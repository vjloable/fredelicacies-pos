'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import TopBar from "@/components/TopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getOrdersByDateRange, Order } from '@/services/orderService';
import { formatCurrency } from '@/services/salesService';

interface TimeSeriesData {
  label: string;
  date: string;
  orders: number;
  revenue: number;
  profit: number;
}

type ViewPeriod = 'day' | 'week' | 'month';

export default function SalesScreen() {
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('day');
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPeriodStats, setCurrentPeriodStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProfit: 0,
    profitMargin: 0,
  });

  // Get date ranges based on view period
  const getDateRange = (period: ViewPeriod) => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    let startDate = new Date();
    
    switch (period) {
      case 'day':
        // Last 24 hours by hour
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        // Last 7 days
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        // Last 30 days
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        break;
    }
    
    return { startDate, endDate };
  };

  // Generate time series data based on period
  const generateTimeSeriesData = (orders: Order[], period: ViewPeriod): TimeSeriesData[] => {
    const { startDate, endDate } = getDateRange(period);
    const data: TimeSeriesData[] = [];

    if (period === 'day') {
      // Hourly data for today
      for (let hour = 0; hour < 24; hour++) {
        const hourStart = new Date(startDate);
        hourStart.setHours(hour, 0, 0, 0);
        const hourEnd = new Date(startDate);
        hourEnd.setHours(hour, 59, 59, 999);
        
        const hourOrders = orders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= hourStart && orderDate <= hourEnd;
        });

        const revenue = hourOrders.reduce((sum, order) => sum + order.total, 0);
        const profit = hourOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);

        data.push({
          label: `${hour.toString().padStart(2, '0')}:00`,
          date: hourStart.toISOString(),
          orders: hourOrders.length,
          revenue,
          profit,
        });
      }
    } else {
      // Daily data for week/month
      const days = period === 'week' ? 7 : 30;
      
      for (let i = 0; i < days; i++) {
        const dayStart = new Date(startDate);
        dayStart.setDate(startDate.getDate() + i);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayOrders = orders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= dayStart && orderDate <= dayEnd;
        });

        const revenue = dayOrders.reduce((sum, order) => sum + order.total, 0);
        const profit = dayOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);

        data.push({
          label: period === 'week' 
            ? dayStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            : dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          date: dayStart.toISOString(),
          orders: dayOrders.length,
          revenue,
          profit,
        });
      }
    }

    return data;
  };

  // Load data based on selected period
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange(viewPeriod);
        const orders = await getOrdersByDateRange(startDate, endDate);
        
        const seriesData = generateTimeSeriesData(orders, viewPeriod);
        setTimeSeriesData(seriesData);

        // Calculate current period totals
        const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = orders.length;
        const totalProfit = orders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
        const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        setCurrentPeriodStats({
          totalRevenue,
          totalOrders,
          totalProfit,
          profitMargin,
        });
      } catch (error) {
        console.error('Error loading sales data:', error);
        setTimeSeriesData([]);
        setCurrentPeriodStats({ totalRevenue: 0, totalOrders: 0, totalProfit: 0, profitMargin: 0 });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [viewPeriod]);

  // Custom tooltip formatter
  const formatTooltipValue = (value: number, name: string) => {
    if (name === 'revenue' || name === 'profit') {
      return [formatCurrency(value), name === 'revenue' ? 'Revenue' : 'Profit'];
    }
    return [value, name === 'orders' ? 'Orders' : name];
  };

  if (loading) {
    return (
      <div className="flex h-full overflow-hidden">
        <div className="flex flex-col flex-1 h-full overflow-hidden">
          <TopBar title="Sales" />
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <TopBar title="Sales" />
        
        {/* Controls Section */}
        <div className="px-6 py-4 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-400">Time Period:</span>
              <div className="flex bg-white rounded-lg p-1">
                {(['day', 'week', 'month'] as ViewPeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => setViewPeriod(period)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewPeriod === period
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    {period === 'day' ? 'Today (24h)' : period === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-xs text-gray-400">Live Data</p>
              <p className="text-sm text-green-400">● Real-time</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">
                      {viewPeriod === 'day' ? 'Today' : viewPeriod === 'week' ? '7 Days' : '30 Days'} Revenue
                    </p>
                    <p className="text-2xl font-bold text-[var(--accent)]">
                      {formatCurrency(currentPeriodStats.totalRevenue)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-[var(--light-accent)] rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Profit: {formatCurrency(currentPeriodStats.totalProfit)} ({currentPeriodStats.profitMargin.toFixed(1)}%)
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Total Orders</p>
                    <p className="text-2xl font-bold text-[var(--accent)]">{currentPeriodStats.totalOrders}</p>
                  </div>
                  <div className="w-12 h-12 bg-[var(--light-accent)] rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Avg: {formatCurrency(currentPeriodStats.totalOrders > 0 ? currentPeriodStats.totalRevenue / currentPeriodStats.totalOrders : 0)}
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Peak {viewPeriod === 'day' ? 'Hour' : 'Day'}</p>
                    <p className="text-2xl font-bold text-[var(--accent)]">
                      {timeSeriesData.length > 0 
                        ? timeSeriesData.reduce((peak, current) => 
                            current.orders > peak.orders ? current : peak, timeSeriesData[0]
                          ).label
                        : '--'
                      }
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-[var(--light-accent)] rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {timeSeriesData.length > 0 
                    ? `${timeSeriesData.reduce((peak, current) => 
                        current.orders > peak.orders ? current : peak, timeSeriesData[0]
                      ).orders} orders`
                    : '0 orders'
                  }
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Growth</p>
                    <p className="text-2xl font-bold text-[var(--accent)]">
                      {timeSeriesData.length >= 2 
                        ? `${((timeSeriesData[timeSeriesData.length - 1].revenue - timeSeriesData[timeSeriesData.length - 2].revenue) / Math.max(timeSeriesData[timeSeriesData.length - 2].revenue, 1) * 100).toFixed(1)}%`
                        : '0%'
                      }
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-[var(--light-accent)] rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  vs previous {viewPeriod === 'day' ? 'hour' : 'day'}
                </p>
              </div>
            </div>

            {/* Main Chart */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--accent)]">
                    {viewPeriod === 'day' ? 'Today\'s Activity' : 
                     viewPeriod === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {viewPeriod === 'day' ? 'Hourly breakdown' : 'Daily performance trends'}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-[var(--secondary)] rounded-full"></div>
                    <span className="text-xs text-gray-400">Orders</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-[var(--accent)] rounded-full"></div>
                    <span className="text-xs text-gray-400">Revenue</span>
                  </div>
                </div>
              </div>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="1 1" stroke="#374151" opacity={0.3} />
                    <XAxis 
                      label={{ value: 'Time', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
                      dataKey="label" 
                      stroke="#9CA3AF"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      label={{ value: 'Revenue', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                      stroke="#9CA3AF"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      formatter={formatTooltipValue}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--accent)/20',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
                      }}
                      labelStyle={{ color: 'bg-gray-50' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="orders" 
                      stroke="var(--secondary)" 
                      strokeWidth={3}
                      name="orders"
                      dot={{ fill: 'var(--secondary)', strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, fill: 'orange', strokeWidth: 0 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="var(--accent)" 
                      strokeWidth={3}
                      name="revenue"
                      dot={{ fill: 'var(--accent)', strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, fill: 'orange', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
