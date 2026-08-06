// Catalog sync service.
// Bundles (like items) now live only on the commissary and reflect directly to
// every branch at read time — there's no publish/copy step anymore. This
// service just keeps the bundle "needs_attention" reactivation flow, in case
// a bundle's referenced component item is ever deleted out from under it.

import { supabase } from '@/lib/supabase';
import { logActivity } from '@/services/activityLogService';

// Re-check a bundle's components after edits. If all referenced inventory_item_ids
// resolve to existing rows at the same branch, clear needs_attention and reactivate.
// Otherwise leaves the flag intact.
export async function validateAndReactivateBundle(
  userId: string,
  bundleId: string
): Promise<{ ok: boolean; missing: string[]; error: any }> {
  const { data: bundle, error: bErr } = await supabase
    .from('bundles')
    .select('id, branch_id, name, status, needs_attention, bundle_components(inventory_item_id, quantity)')
    .eq('id', bundleId)
    .single();
  if (bErr || !bundle) return { ok: false, missing: [], error: bErr ?? new Error('Bundle not found') };

  const componentIds = ((bundle as any).bundle_components ?? []).map(
    (c: any) => c.inventory_item_id
  );
  if (componentIds.length === 0) {
    return { ok: false, missing: ['(no components)'], error: null };
  }

  const { data: existing, error: lookupErr } = await supabase
    .from('inventory_items')
    .select('id, name')
    .in('id', componentIds)
    .eq('branch_id', (bundle as any).branch_id);
  if (lookupErr) return { ok: false, missing: [], error: lookupErr };

  const foundIds = new Set((existing ?? []).map((r: any) => r.id));
  const missing = componentIds.filter((id: string) => !foundIds.has(id));
  if (missing.length > 0) {
    return { ok: false, missing, error: null };
  }

  const { error: updateErr } = await supabase
    .from('bundles')
    .update({ needs_attention: false, status: 'active' })
    .eq('id', bundleId);
  if (updateErr) return { ok: false, missing: [], error: updateErr };

  void logActivity({
    branchId: (bundle as any).branch_id,
    userId,
    action: 'bundle_status_changed',
    entityType: 'bundle',
    entityId: bundleId,
    details: { name: (bundle as any).name, reactivated: true, was_needs_attention: true },
  });

  return { ok: true, missing: [], error: null };
}

