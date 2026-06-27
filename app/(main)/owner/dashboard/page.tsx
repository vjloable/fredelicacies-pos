'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import TopBar from '@/components/TopBar';
import MobileTopBar from '@/components/MobileTopBar';
import LoadingSpinner from '@/components/LoadingSpinner';
import DashboardIcon from '@/components/icons/SidebarNav/DashboardIcon';
import { useAuth } from '@/contexts/AuthContext';
import { branchService, type Branch } from '@/services/branchService';
import { getOrdersByBranch, calculateSalesStats, getTopSellingItems } from '@/services/orderService';
import { getActiveShift, getShiftsByBranch } from '@/services/shiftService';
import { getLowStockItems } from '@/services/inventoryService';
import { formatCurrency } from '@/lib/currency_formatter';
import type { OrderWithItems } from '@/types/domain';
import type { Shift } from '@/types/domain/shift';
import type { InventoryItem } from '@/types/domain/inventory';

interface BranchData {
  branch: Branch;
  orders: OrderWithItems[];
  revenue: number;
  orderCount: number;
  avgOrder: number;
  activeShift: Shift | null;
  lowStockItems: InventoryItem[];
  lastShift: Shift | null;
  paymentBreakdown: Record<string, number>;
}

export default function DashboardPage() {
  const { user, isUserOwner } = useAuth();
  const router = useRouter();
  const [branchData, setBranchData] = useState<BranchData[]>([]);
  const [yesterdayRevenue, setYesterdayRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !isUserOwner()) {
      router.push('/login');
    }
  }, [user, isUserOwner, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { branches } = await branchService.getAllBranches();
      const activeBranches = branches.filter(b => b.status === 'active');
      if (cancelled || activeBranches.length === 0) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayStart);
      yesterdayEnd.setMilliseconds(-1);

      const results = await Promise.all(
        activeBranches.map(async (branch): Promise<BranchData> => {
          const [ordersRes, shiftRes, lowStockRes, closedShiftsRes] = await Promise.all([
            getOrdersByBranch(branch.id, todayStart, todayEnd),
            getActiveShift(branch.id),
            getLowStockItems(branch.id, 5),
            getShiftsByBranch(branch.id, { status: 'closed' }),
          ]);

          const orders = (ordersRes.orders || []).filter(o => o.status === 'completed');
          const stats = calculateSalesStats(orders);

          // Payment breakdown
          const paymentBreakdown: Record<string, number> = {};
          for (const o of orders) {
            const pm = o.payment_method;
            if (pm === 'split' && o.payment_details) {
              const d = o.payment_details;
              const m1 = d.split_method_1;
              const m2 = d.split_method_2;
              if (m1) paymentBreakdown[m1] = (paymentBreakdown[m1] || 0) + parseFloat(d.split_amount_1 || '0');
              if (m2) paymentBreakdown[m2] = (paymentBreakdown[m2] || 0) + parseFloat(d.split_amount_2 || '0');
            } else {
              paymentBreakdown[pm] = (paymentBreakdown[pm] || 0) + o.total;
            }
          }

          const closedShifts = closedShiftsRes.shifts || [];
          const lastShift = closedShifts.length > 0 ? closedShifts[0] : null;

          return {
            branch,
            orders,
            revenue: stats.totalRevenue,
            orderCount: stats.totalOrders,
            avgOrder: stats.averageOrderValue,
            activeShift: shiftRes.shift,
            lowStockItems: lowStockRes.items || [],
            lastShift,
            paymentBreakdown,
          };
        })
      );

      // Yesterday's total revenue for comparison
      const yesterdayResults = await Promise.all(
        activeBranches.map(async (branch) => {
          const { orders } = await getOrdersByBranch(branch.id, yesterdayStart, yesterdayEnd);
          return (orders || []).filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total, 0);
        })
      );

      if (!cancelled) {
        setBranchData(results.sort((a, b) => b.revenue - a.revenue));
        setYesterdayRevenue(yesterdayResults.reduce((a, b) => a + b, 0));
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Aggregates
  const totals = useMemo(() => {
    const revenue = branchData.reduce((s, d) => s + d.revenue, 0);
    const orders = branchData.reduce((s, d) => s + d.orderCount, 0);
    const activeBranches = branchData.filter(d => d.activeShift).length;
    const avgOrder = orders > 0 ? revenue / orders : 0;
    const revenueChange = yesterdayRevenue > 0 ? ((revenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
    return { revenue, orders, avgOrder, activeBranches, revenueChange };
  }, [branchData, yesterdayRevenue]);

  // Top selling items across all branches
  const topItems = useMemo(() => {
    const allOrders = branchData.flatMap(d => d.orders);
    return getTopSellingItems(allOrders, 10);
  }, [branchData]);

  // Chart data
  const chartData = useMemo(() =>
    branchData
      .filter(d => d.revenue > 0)
      .map((d, i) => ({ name: d.branch.name, revenue: d.revenue, fill: i === 0 ? '#DA834D' : '#4C2E24' })),
    [branchData]
  );

  // Alerts
  const alerts = useMemo(() => {
    const items: { type: 'warning' | 'error'; message: string }[] = [];

    for (const d of branchData) {
      if (!d.activeShift) {
        items.push({ type: 'warning', message: `${d.branch.name} has no open shift today` });
      }
      if (d.lowStockItems.length > 0) {
        items.push({ type: 'warning', message: `${d.branch.name} has ${d.lowStockItems.length} item${d.lowStockItems.length !== 1 ? 's' : ''} low on stock` });
      }
      if (d.lastShift?.over_short != null && d.lastShift.over_short < -100) {
        items.push({ type: 'error', message: `${d.branch.name} last shift was short ${formatCurrency(Math.abs(d.lastShift.over_short))}` });
      }
    }
    return items;
  }, [branchData]);

  const pmLabels: Record<string, string> = {
    cash: 'Cash', gcash: 'GCash', grab: 'Grab',
    debit_credit: 'Card', employee_charge: 'Emp',
  };

  if (loading) {
    return (
      <>
        <div className='hidden xl:block'><TopBar title='Dashboard' icon={<DashboardIcon />} showTimeTracking={false} /></div>
        <div className='xl:hidden'><MobileTopBar title='Dashboard' icon={<DashboardIcon />} showTimeTracking={false} /></div>
        <div className='flex flex-col items-center justify-center py-20 gap-4'>
          <LoadingSpinner size='lg' />
          <p className='text-sm text-secondary/60'>Loading dashboard...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className='hidden xl:block'><TopBar title='Dashboard' icon={<DashboardIcon />} showTimeTracking={false} /></div>
      <div className='xl:hidden'><MobileTopBar title='Dashboard' icon={<DashboardIcon />} showTimeTracking={false} /></div>

      <div className='px-4 xl:px-6 pb-8 space-y-6'>

        {/* Section 1: Summary Cards */}
        <div className='grid grid-cols-2 xl:grid-cols-4 gap-3'>
          <StatCard
            label="Today's Revenue"
            value={formatCurrency(totals.revenue)}
            change={totals.revenueChange}
            showChange={yesterdayRevenue > 0}
          />
          <StatCard label='Orders' value={totals.orders.toString()} />
          <StatCard label='Avg Order' value={formatCurrency(totals.avgOrder)} />
          <StatCard
            label='Active Branches'
            value={`${totals.activeBranches} / ${branchData.length}`}
            accent={totals.activeBranches === branchData.length}
          />
        </div>

        {/* Section 2: Revenue by Branch Chart */}
        {chartData.length > 0 && (
          <div className='bg-white rounded-2xl border border-gray-200 p-4'>
            <h2 className='text-sm font-bold text-secondary mb-3'>Revenue by Branch</h2>
            <div style={{ height: Math.max(120, chartData.length * 48) }}>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={chartData} layout='vertical' margin={{ left: 0, right: 16 }}>
                  <XAxis type='number' hide />
                  <YAxis type='category' dataKey='name' width={100} tick={{ fontSize: 11, fill: '#4C2E24' }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey='revenue' radius={[0, 6, 6, 0]} barSize={24} fill='#4C2E24' opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Section 3: Branch Cards */}
        <div>
          <h2 className='text-sm font-bold text-secondary mb-3'>Branches</h2>
          <div className='grid grid-cols-1 xl:grid-cols-2 gap-3'>
            {branchData.map((d) => (
              <button
                key={d.branch.id}
                onClick={() => router.push(`/${d.branch.id}/store`)}
                className='bg-white rounded-2xl border border-gray-200 p-4 text-left hover:border-accent hover:shadow-md transition-all group'
              >
                {/* Header */}
                <div className='flex items-center justify-between mb-3'>
                  <div className='flex items-center gap-2'>
                    <span className={`w-2.5 h-2.5 rounded-full ${d.activeShift ? 'bg-success animate-pulse' : 'bg-gray-300'}`} />
                    <span className='text-sm font-bold text-secondary'>{d.branch.name}</span>
                  </div>
                  <svg className='w-4 h-4 text-secondary/30 group-hover:text-accent transition-colors' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                  </svg>
                </div>

                {/* Stats Row */}
                <div className='flex items-baseline gap-4 mb-3'>
                  <div>
                    <p className='text-lg font-bold text-secondary'>{formatCurrency(d.revenue)}</p>
                    <p className='text-xs text-secondary/40'>revenue</p>
                  </div>
                  <div>
                    <p className='text-sm font-bold text-secondary'>{d.orderCount}</p>
                    <p className='text-xs text-secondary/40'>orders</p>
                  </div>
                </div>

                {/* Payment Breakdown */}
                {Object.keys(d.paymentBreakdown).length > 0 && (
                  <div className='flex flex-wrap gap-1.5 mb-3'>
                    {Object.entries(d.paymentBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([method, amount]) => (
                        <span key={method} className='px-2 py-0.5 bg-secondary/5 rounded-full text-xs text-secondary/60'>
                          {pmLabels[method] || method} {formatCurrency(amount)}
                        </span>
                      ))}
                  </div>
                )}

                {/* Bottom Indicators */}
                <div className='flex items-center gap-3 flex-wrap'>
                  {d.lowStockItems.length > 0 && (
                    <span className='text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium'>
                      {d.lowStockItems.length} low stock
                    </span>
                  )}
                  {d.lastShift?.over_short != null && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      d.lastShift.over_short >= 0
                        ? 'text-success bg-success/10'
                        : 'text-error bg-error/10'
                    }`}>
                      {d.lastShift.over_short >= 0 ? '+' : ''}{formatCurrency(d.lastShift.over_short)}
                    </span>
                  )}
                  {!d.activeShift && (
                    <span className='text-xs text-secondary/40 bg-gray-100 px-2 py-0.5 rounded-full'>
                      No shift
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Top Selling Items */}
        {topItems.length > 0 && (
          <div className='bg-white rounded-2xl border border-gray-200 p-4'>
            <h2 className='text-sm font-bold text-secondary mb-3'>Top Selling Items Today</h2>
            <div className='space-y-2'>
              {topItems.map((item, i) => (
                <div key={item.id} className='flex items-center gap-3'>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i < 3 ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-secondary/40'
                  }`}>
                    {i + 1}
                  </span>
                  <span className='text-xs text-secondary font-medium flex-1 truncate'>{item.name}</span>
                  <span className='text-xs text-secondary/50 shrink-0'>{item.quantity} sold</span>
                  <span className='text-xs font-bold text-secondary shrink-0'>{formatCurrency(item.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 5: Alerts */}
        {alerts.length > 0 && (
          <div className='bg-white rounded-2xl border border-gray-200 p-4'>
            <h2 className='text-sm font-bold text-secondary mb-3'>Needs Attention</h2>
            <div className='space-y-2'>
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 px-3 py-2 rounded-xl ${
                    alert.type === 'error' ? 'bg-error/5' : 'bg-amber-50'
                  }`}
                >
                  <svg className={`w-4 h-4 shrink-0 mt-0.5 ${alert.type === 'error' ? 'text-error' : 'text-amber-500'}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
                  </svg>
                  <p className={`text-xs ${alert.type === 'error' ? 'text-error' : 'text-amber-700'}`}>{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {branchData.length === 0 && (
          <div className='flex flex-col items-center justify-center py-12'>
            <p className='text-sm text-secondary/40'>No active branches found</p>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, change, showChange, accent }: {
  label: string;
  value: string;
  change?: number;
  showChange?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-4 ${accent ? 'ring-1 ring-success/30' : ''}`}>
      <p className='text-xs text-secondary/50 mb-1'>{label}</p>
      <p className='text-xl font-bold text-secondary'>{value}</p>
      {showChange && change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 ${change >= 0 ? 'text-success' : 'text-error'}`}>
          <svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d={change >= 0 ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
          <span className='text-xs font-semibold'>{Math.abs(change).toFixed(1)}% vs yesterday</span>
        </div>
      )}
    </div>
  );
}
