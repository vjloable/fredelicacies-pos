'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import TopBar from '@/components/TopBar';
import MobileTopBar from '@/components/MobileTopBar';
import PageLoader from "@/components/PageLoader";
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
      // Commissaries are production hubs, not points of sale — they have no
      // revenue of their own, so they're excluded here. Only branch/event stay.
      const activeBranches = branches.filter(b => b.status === 'active' && b.type !== 'commissary');
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

  // Chart data — capped so the chart stays readable as the branch count grows;
  // the remaining branches are still listed (and searchable-by-eye) in the cards below.
  const CHART_LIMIT = 8;
  const chartData = useMemo(() =>
    branchData
      .filter(d => d.revenue > 0)
      .slice(0, CHART_LIMIT)
      .map((d, i) => ({ name: d.branch.name, revenue: d.revenue, fill: i === 0 ? '#DA834D' : '#4C2E24' })),
    [branchData]
  );
  const chartOverflow = Math.max(0, branchData.filter(d => d.revenue > 0).length - CHART_LIMIT);

  const branchTypeLabels: Record<string, string> = {
    event: 'Event',
    branch: '',
    commissary: 'Commissary',
  };

  if (loading) {
    return (
      <>
        <div className='hidden xl:block'><TopBar title='Dashboard' icon={<DashboardIcon />} showTimeTracking={false} /></div>
        <div className='xl:hidden'><MobileTopBar title='Dashboard' icon={<DashboardIcon />} showTimeTracking={false} /></div>
        <div className='flex flex-col items-center justify-center py-20 gap-4'>
          <PageLoader text="Loading dashboard…" />
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
          <StatCard label='Orders Today' value={totals.orders.toLocaleString()} />
          <StatCard label='Average Order' value={formatCurrency(totals.avgOrder)} />
          <StatCard
            label='Branches With a Shift Open'
            value={`${totals.activeBranches} / ${branchData.length}`}
            accent={branchData.length > 0 && totals.activeBranches === branchData.length}
          />
        </div>

        {/* Section 2: Revenue by Branch Chart */}
        {chartData.length > 0 && (
          <div className='bg-white rounded-2xl border border-gray-200 p-4'>
            <div className='flex items-center justify-between mb-3'>
              <h2 className='text-sm font-semibold text-secondary'>Revenue by Branch</h2>
              {chartOverflow > 0 && (
                <span className='text-2.5 text-secondary/40'>Top {CHART_LIMIT} shown · {chartOverflow} more below</span>
              )}
            </div>
            <div style={{ height: Math.max(120, chartData.length * 48) }}>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={chartData} layout='vertical' margin={{ left: 0, right: 16 }}>
                  <XAxis type='number' hide />
                  <YAxis type='category' dataKey='name' width={100} tick={{ fontSize: 11, fill: '#4C2E24' }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ borderRadius: 2, fontSize: 12, border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey='revenue' radius={[0, 6, 6, 0]} barSize={24} fill='#4C2E24' opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Section 3: Branch Cards */}
        {branchData.length > 0 && (
          <div>
            <div className='flex items-center justify-between mb-3'>
              <h2 className='text-sm font-semibold text-secondary'>Branches</h2>
              <span className='text-2.5 text-secondary/40'>{branchData.length} active today</span>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'>
              {branchData.map((d) => {
                const revenueShare = totals.revenue > 0 ? (d.revenue / totals.revenue) * 100 : 0;
                const typeLabel = branchTypeLabels[d.branch.type ?? 'branch'];
                return (
                  <button
                    key={d.branch.id}
                    onClick={() => router.push(`/${d.branch.id}/store`)}
                    className='bg-white rounded-2xl border border-gray-200 p-4 text-left hover:border-accent hover:shadow-sm transition-all group'
                  >
                    {/* Header */}
                    <div className='flex items-center justify-between gap-2'>
                      <div className='flex items-center gap-2 min-w-0'>
                        <span className={`size-2 shrink-0 rounded-full ${d.activeShift ? 'bg-success animate-pulse' : 'bg-gray-300'}`} />
                        <span className='text-sm font-semibold text-secondary truncate'>{d.branch.name}</span>
                        {typeLabel && (
                          <span className='shrink-0 px-1.5 py-0.5 rounded-full text-2.5 font-medium bg-accent/10 text-accent'>
                            {typeLabel}
                          </span>
                        )}
                      </div>
                      <div className='flex items-center gap-1.5 shrink-0'>
                        <span className={`text-2.5 font-semibold px-2 py-0.5 rounded-full ${
                          d.activeShift ? 'text-success bg-success/10' : 'text-secondary/40 bg-gray-100'
                        }`}>
                          {d.activeShift ? 'Open' : 'No Shift'}
                        </span>
                        <svg className='size-4 shrink-0 text-secondary/30 group-hover:text-accent transition-colors' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                        </svg>
                      </div>
                    </div>

                    {/* Revenue */}
                    <div className='flex items-center gap-2 mt-3'>
                      <p className='text-2xl font-bold text-secondary tabular-nums'>{formatCurrency(d.revenue)}</p>
                      {revenueShare > 0 && (
                        <span className='text-2.5 font-semibold text-secondary/40'>{revenueShare.toFixed(0)}% of total</span>
                      )}
                    </div>

                    {/* Orders / Avg */}
                    <div className='grid grid-cols-2 divide-x divide-gray-100 border-y border-gray-100 mt-3 py-2.5'>
                      <div className='px-0.5'>
                        <p className='text-2.5 font-semibold text-secondary/40 uppercase tracking-wide'>Orders</p>
                        <p className='text-sm font-semibold text-secondary tabular-nums mt-0.5'>{d.orderCount}</p>
                      </div>
                      <div className='pl-3'>
                        <p className='text-2.5 font-semibold text-secondary/40 uppercase tracking-wide'>Avg Order</p>
                        <p className='text-sm font-semibold text-secondary tabular-nums mt-0.5'>{formatCurrency(d.avgOrder)}</p>
                      </div>
                    </div>

                    {/* Alerts — only shown when there's something worth flagging */}
                    {(d.lowStockItems.length > 0 || d.lastShift?.over_short != null) && (
                      <div className='flex items-center gap-1.5 flex-wrap mt-3'>
                        {d.lowStockItems.length > 0 && (
                          <span className='text-2.5 font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full'>
                            {d.lowStockItems.length} Low Stock
                          </span>
                        )}
                        {d.lastShift?.over_short != null && (
                          <span className={`text-2.5 font-semibold px-2 py-0.5 rounded-full ${
                            d.lastShift.over_short >= 0
                              ? 'text-success bg-success/10'
                              : 'text-error bg-error/10'
                          }`}>
                            {d.lastShift.over_short >= 0 ? '+' : ''}{formatCurrency(d.lastShift.over_short)} Last Shift
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 4: Top Selling Items */}
        {topItems.length > 0 && (
          <div className='bg-white rounded-2xl border border-gray-200 p-4'>
            <h2 className='text-sm font-semibold text-secondary mb-3'>Top Selling Items Today</h2>
            <div className='space-y-2'>
              {topItems.map((item, i) => (
                <div key={item.id} className='flex items-center gap-3'>
                  <span className={`size-6 rounded-full flex items-center justify-center text-2.5 font-bold shrink-0 ${
                    i < 3 ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-secondary/40'
                  }`}>
                    {i + 1}
                  </span>
                  <span className='text-3 text-secondary font-medium flex-1 truncate'>{item.name}</span>
                  <span className='text-2.5 text-secondary/50 shrink-0'>{item.quantity} Sold</span>
                  <span className='text-3 font-semibold text-secondary tabular-nums shrink-0'>{formatCurrency(item.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {branchData.length === 0 && (
          <div className='flex flex-col items-center justify-center py-12 gap-1'>
            <p className='text-sm font-medium text-secondary/50'>No active branches yet</p>
            <p className='text-2.5 text-secondary/30'>Branches with sales today will show up here</p>
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
      <p className='text-2.5 font-semibold text-secondary/50 uppercase tracking-wide mb-1.5'>{label}</p>
      <p className='text-xl font-bold text-secondary tabular-nums'>{value}</p>
      {showChange && change !== undefined && (
        <div className={`flex items-center gap-1 mt-1.5 ${change >= 0 ? 'text-success' : 'text-error'}`}>
          <svg className='size-3 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d={change >= 0 ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
          <span className='text-2.5 font-semibold'>{Math.abs(change).toFixed(1)}% vs Yesterday</span>
        </div>
      )}
    </div>
  );
}
