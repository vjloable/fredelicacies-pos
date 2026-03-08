import { supabase } from '@/lib/supabase';
import type { CreateWastageData, WastageDailySummary, WastageItemSummary } from '@/types/domain';

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function recordWastage(
  branchId: string,
  userId: string | null,
  items: CreateWastageData[]
): Promise<{ error: any }> {
  if (items.length === 0) return { error: null };

  const today = new Date().toISOString().slice(0, 10);

  const rows = items
    .filter((item) => item.quantity_wasted > 0)
    .map((item) => ({
      branch_id: branchId,
      item_id: item.item_id ?? null,
      item_name: item.item_name,
      quantity_wasted: item.quantity_wasted,
      cost_per_unit: item.cost_per_unit,
      recorded_by: userId ?? null,
      wastage_date: item.wastage_date ?? today,
    }));

  if (rows.length === 0) return { error: null };

  const { error } = await supabase.from('wastage_logs').insert(rows);
  return { error };
}

// ---------------------------------------------------------------------------
// Read — daily aggregated totals (for bar chart)
// ---------------------------------------------------------------------------

export async function getWastageSummary(
  branchId: string,
  startDate: string, // 'YYYY-MM-DD'
  endDate: string    // 'YYYY-MM-DD'
): Promise<{ data: WastageDailySummary[]; error: any }> {
  const { data, error } = await supabase
    .from('wastage_logs')
    .select('wastage_date, quantity_wasted, total_cost')
    .eq('branch_id', branchId)
    .gte('wastage_date', startDate)
    .lte('wastage_date', endDate)
    .order('wastage_date', { ascending: true });

  if (error) return { data: [], error };

  // Aggregate client-side by date
  const byDate = new Map<string, WastageDailySummary>();
  for (const row of data ?? []) {
    const existing = byDate.get(row.wastage_date);
    if (existing) {
      existing.total_cost += row.total_cost ?? 0;
      existing.total_quantity += row.quantity_wasted ?? 0;
    } else {
      byDate.set(row.wastage_date, {
        date: row.wastage_date,
        total_cost: row.total_cost ?? 0,
        total_quantity: row.quantity_wasted ?? 0,
      });
    }
  }

  return { data: Array.from(byDate.values()), error: null };
}

// ---------------------------------------------------------------------------
// Read — top wasted items ranked by total cost (for ranked list)
// ---------------------------------------------------------------------------

export async function getTopWastedItems(
  branchId: string,
  startDate: string, // 'YYYY-MM-DD'
  endDate: string,   // 'YYYY-MM-DD'
  limit = 5
): Promise<{ data: WastageItemSummary[]; error: any }> {
  const { data, error } = await supabase
    .from('wastage_logs')
    .select('item_id, item_name, quantity_wasted, total_cost')
    .eq('branch_id', branchId)
    .gte('wastage_date', startDate)
    .lte('wastage_date', endDate);

  if (error) return { data: [], error };

  // Aggregate by item_name client-side
  const byItem = new Map<string, WastageItemSummary>();
  for (const row of data ?? []) {
    const key = row.item_name;
    const existing = byItem.get(key);
    if (existing) {
      existing.total_cost += row.total_cost ?? 0;
      existing.total_quantity += row.quantity_wasted ?? 0;
    } else {
      byItem.set(key, {
        item_id: row.item_id,
        item_name: row.item_name,
        total_cost: row.total_cost ?? 0,
        total_quantity: row.quantity_wasted ?? 0,
      });
    }
  }

  return {
    data: Array.from(byItem.values())
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, limit),
    error: null,
  };
}
