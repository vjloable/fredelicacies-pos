// Catalog sync service.
// Syncs items + categories + bundles from the commissary (catalog source) to a sub-branch.
// See plan: /Users/vincejaphethloable/.claude/plans/help-plan-out-the-eager-nest.md
//
// Bundle conflict rule: if a bundle's components aren't all present at dest after item
// sync, the bundle is created status='inactive', needs_attention=true and surfaces in
// the "Bundles needing fix" UI until the manager resolves it.

import { supabase } from '@/lib/supabase';
import { log } from '@/lib/logging';
import { logActivity } from '@/services/activityLogService';

export interface SyncReport {
  items: { created: number; skipped: number };
  categories: { created: number; skipped: number };
  bundles: { created: number; skipped: number; needs_attention: number };
  warnings: string[];
}

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

// ─── Catalog sync ───────────────────────────────────────────────────────────
async function resolveOrCreateCategoriesAt(
  destBranchId: string,
  sourceCategoryIds: string[]
): Promise<{ idMap: Map<string, string>; created: number; error: any }> {
  if (sourceCategoryIds.length === 0) {
    return { idMap: new Map(), created: 0, error: null };
  }

  const { data: sourceCats, error: srcErr } = await supabase
    .from('categories')
    .select('id, name, color')
    .in('id', sourceCategoryIds);
  if (srcErr) return { idMap: new Map(), created: 0, error: srcErr };

  const names = (sourceCats || []).map((c: any) => c.name);
  if (names.length === 0) return { idMap: new Map(), created: 0, error: null };

  const { data: existing, error: lookupErr } = await supabase
    .from('categories')
    .select('id, name')
    .eq('branch_id', destBranchId)
    .in('name', names);
  if (lookupErr) return { idMap: new Map(), created: 0, error: lookupErr };

  const destIdByLowerName = new Map<string, string>();
  for (const row of existing ?? []) {
    destIdByLowerName.set((row as any).name.toLowerCase(), (row as any).id);
  }

  // Source category rows whose name doesn't exist at dest yet.
  const missing = (sourceCats || []).filter((c: any) => !destIdByLowerName.has(c.name.toLowerCase()));
  let createdCount = 0;
  if (missing.length > 0) {
    const { data: created, error: insErr } = await supabase
      .from('categories')
      .insert(
        missing.map((c: any) => ({
          branch_id: destBranchId,
          name: c.name,
          color: c.color ?? '#3B82F6',
        }))
      )
      .select('id, name');
    if (insErr) return { idMap: new Map(), created: 0, error: insErr };
    createdCount = (created || []).length;
    for (const row of created ?? []) {
      destIdByLowerName.set((row as any).name.toLowerCase(), (row as any).id);
    }
  }

  // Map source.id → dest.id keyed by name (case-insensitive).
  const idMap = new Map<string, string>();
  for (const c of sourceCats || []) {
    const destId = destIdByLowerName.get((c as any).name.toLowerCase());
    if (destId) idMap.set((c as any).id, destId);
  }
  return { idMap, created: createdCount, error: null };
}

interface SyncCatalogOptions {
  // Source bundle ids to publish. Omit/undefined to publish every active
  // source bundle.
  bundleIds?: string[];
}

export async function syncCatalog(
  userId: string,
  sourceBranchId: string,
  destinationBranchId: string,
  options: SyncCatalogOptions = {}
): Promise<{ report: SyncReport; error: any }> {
  // Items are no longer synced per-branch: the commissary is the sole item
  // source (branch_item_stock auto-carries every commissary item to every
  // branch — see migration 0022). Only bundles remain genuinely per-branch,
  // since there's no bundle_item_stock equivalent, so publishing bundle
  // *definitions* from the commissary to branches is still needed. Bundle
  // components reference the shared (commissary) item id directly now — no
  // per-branch id translation required.
  const report: SyncReport = {
    items: { created: 0, skipped: 0 },
    categories: { created: 0, skipped: 0 },
    bundles: { created: 0, skipped: 0, needs_attention: 0 },
    warnings: [],
  };
  log.info('syncCatalog start', { userId, sourceBranchId, destinationBranchId });

  if (sourceBranchId === destinationBranchId) {
    return { report, error: new Error('Source and destination must differ') };
  }

  let bundlesQuery = supabase
    .from('bundles')
    .select(
      `
        id, name, description, price, grab_price, img_url, is_predefined, is_custom,
        max_pieces, status, category_id,
        bundle_components(inventory_item_id, quantity),
        bundle_categories(category_id),
        bundle_additional_items(inventory_item_id, quantity)
      `
    )
    .eq('branch_id', sourceBranchId);
  if (options.bundleIds) bundlesQuery = bundlesQuery.in('id', options.bundleIds);
  const { data: srcBundles, error: bundlesErr } = await bundlesQuery;
  if (bundlesErr) return { report, error: bundlesErr };

  // Resolve categories used by the selected bundles at dest (find or create).
  const allSrcCategoryIds = new Set<string>();
  for (const sb of srcBundles ?? []) {
    const b = sb as any;
    if (b.category_id) allSrcCategoryIds.add(b.category_id);
    for (const link of b.bundle_categories ?? []) allSrcCategoryIds.add(link.category_id);
  }
  const { idMap: catIdMap, created: catsCreated, error: catErr } =
    await resolveOrCreateCategoriesAt(destinationBranchId, Array.from(allSrcCategoryIds));
  if (catErr) return { report, error: catErr };
  report.categories.created = catsCreated;
  report.categories.skipped = allSrcCategoryIds.size - catsCreated;

  // Verify every referenced component item id still exists (they're shared
  // commissary ids now, so a missing one means the source item was deleted).
  const allComponentItemIds = new Set<string>();
  for (const sb of srcBundles ?? []) {
    const b = sb as any;
    for (const c of b.bundle_components ?? []) allComponentItemIds.add(c.inventory_item_id);
    for (const a of b.bundle_additional_items ?? []) allComponentItemIds.add(a.inventory_item_id);
  }
  const { data: existingItems } = allComponentItemIds.size
    ? await supabase.from('inventory_items').select('id').in('id', Array.from(allComponentItemIds))
    : { data: [] as any[] };
  const existingItemIds = new Set((existingItems ?? []).map((r: any) => r.id));

  // Look up which bundles already exist at dest by name.
  const { data: existingDestBundles } = await supabase
    .from('bundles')
    .select('id, name')
    .eq('branch_id', destinationBranchId)
    .in('name', (srcBundles || []).map((b: any) => b.name));
  const destBundleByLowerName = new Map<string, string>(
    (existingDestBundles ?? []).map((r: any) => [r.name.toLowerCase(), r.id])
  );

  for (const sb of srcBundles || []) {
    const srcBundle = sb as any;
    const existingDestBundleId = destBundleByLowerName.get(srcBundle.name.toLowerCase());
    if (existingDestBundleId) {
      report.bundles.skipped++;
      // Backfill the commissary link on the pre-existing dest bundle (NULLs only).
      const { error: bLinkErr } = await supabase
        .from('bundles')
        .update({ commissary_bundle_id: srcBundle.id })
        .eq('id', existingDestBundleId)
        .is('commissary_bundle_id', null);
      if (bLinkErr) report.warnings.push(`Bundle link backfill failed for "${srcBundle.name}": ${bLinkErr.message}`);
      continue;
    }

    const missingNames: string[] = [];
    const components = (srcBundle.bundle_components ?? [])
      .filter((c: any) => {
        const ok = existingItemIds.has(c.inventory_item_id);
        if (!ok) missingNames.push(c.inventory_item_id);
        return ok;
      })
      .map((c: any) => ({ destItemId: c.inventory_item_id, quantity: c.quantity }));
    const additionalItems = (srcBundle.bundle_additional_items ?? [])
      .filter((a: any) => {
        const ok = existingItemIds.has(a.inventory_item_id);
        if (!ok) missingNames.push(a.inventory_item_id);
        return ok;
      })
      .map((a: any) => ({ destItemId: a.inventory_item_id, quantity: a.quantity }));

    const incomplete = missingNames.length > 0;
    const { data: createdBundle, error: bInsErr } = await supabase
      .from('bundles')
      .insert({
        branch_id: destinationBranchId,
        name: srcBundle.name,
        description: srcBundle.description ?? null,
        price: srcBundle.price,
        grab_price: srcBundle.grab_price ?? null,
        img_url: srcBundle.img_url ?? null,
        is_predefined: srcBundle.is_predefined ?? false,
        is_custom: srcBundle.is_custom ?? false,
        max_pieces: srcBundle.max_pieces ?? null,
        category_id: srcBundle.category_id ? catIdMap.get(srcBundle.category_id) ?? null : null,
        status: incomplete ? 'inactive' : srcBundle.status,
        needs_attention: incomplete,
        // Durable link back to the commissary source bundle (centralized menu).
        commissary_bundle_id: srcBundle.id,
      })
      .select('id, name')
      .single();

    if (bInsErr || !createdBundle) {
      report.warnings.push(`Bundle "${srcBundle.name}" failed: ${bInsErr?.message ?? 'unknown'}`);
      continue;
    }
    report.bundles.created++;
    if (incomplete) report.bundles.needs_attention++;

    if (components.length > 0) {
      await supabase.from('bundle_components').insert(
        components.map((c: any) => ({
          bundle_id: (createdBundle as any).id,
          inventory_item_id: c.destItemId,
          quantity: c.quantity,
        }))
      );
    }
    if (additionalItems.length > 0) {
      await supabase.from('bundle_additional_items').insert(
        additionalItems.map((a: any) => ({
          bundle_id: (createdBundle as any).id,
          inventory_item_id: a.destItemId,
          quantity: a.quantity,
        }))
      );
    }
    // Bundle category links (best-effort).
    const bundleCatLinks: Array<{ bundle_id: string; category_id: string }> = [];
    for (const link of srcBundle.bundle_categories ?? []) {
      const destCatId = catIdMap.get(link.category_id);
      if (destCatId) bundleCatLinks.push({ bundle_id: (createdBundle as any).id, category_id: destCatId });
    }
    if (bundleCatLinks.length > 0) {
      await supabase.from('bundle_categories').insert(bundleCatLinks);
    }

    if (incomplete) {
      void logActivity({
        branchId: destinationBranchId,
        userId,
        action: 'bundle_marked_inactive',
        entityType: 'bundle',
        entityId: (createdBundle as any).id,
        details: {
          bundle_name: srcBundle.name,
          missing_components: missingNames,
          source_branch_id: sourceBranchId,
        },
      });
    }
  }

  void logActivity({
    branchId: destinationBranchId,
    userId,
    action: 'catalog_synced',
    entityType: 'branch',
    entityId: destinationBranchId,
    details: {
      source_branch_id: sourceBranchId,
      items_created: report.items.created,
      categories_created: report.categories.created,
      bundles_created: report.bundles.created,
      bundles_needs_attention: report.bundles.needs_attention,
    },
  });

  log.info('syncCatalog done', { userId, report });
  return { report, error: null };
}
