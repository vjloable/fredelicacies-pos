// Catalog sync service.
// Syncs items + categories + bundles from the main branch to a sub-branch.
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

// ─── Main-branch election ───────────────────────────────────────────────────
export async function electMainBranch(
  userId: string,
  branchId: string
): Promise<{ error: any }> {
  log.info('electMainBranch', { userId, branchId });

  // Clear is_main on every other branch first to satisfy the partial unique index.
  const { error: clearErr } = await supabase
    .from('branches')
    .update({ is_main: false })
    .neq('id', branchId);
  if (clearErr) return { error: clearErr };

  const { error } = await supabase
    .from('branches')
    .update({ is_main: true })
    .eq('id', branchId);

  if (!error) {
    void logActivity({
      branchId,
      userId,
      action: 'main_branch_elected',
      entityType: 'branch',
      entityId: branchId,
      details: {},
    });
  }
  return { error };
}

export async function getMainBranch(): Promise<{ branchId: string | null; error: any }> {
  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .eq('is_main', true)
    .maybeSingle();
  return { branchId: (data as any)?.id ?? null, error };
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
  itemIds: string[]; // source inventory item ids to sync
  includeBundles?: boolean; // default true
}

export async function syncCatalog(
  userId: string,
  sourceBranchId: string,
  destinationBranchId: string,
  options: SyncCatalogOptions
): Promise<{ report: SyncReport; error: any }> {
  const report: SyncReport = {
    items: { created: 0, skipped: 0 },
    categories: { created: 0, skipped: 0 },
    bundles: { created: 0, skipped: 0, needs_attention: 0 },
    warnings: [],
  };
  log.info('syncCatalog start', {
    userId,
    sourceBranchId,
    destinationBranchId,
    itemIds: options.itemIds.length,
  });

  if (sourceBranchId === destinationBranchId) {
    return { report, error: new Error('Source and destination must differ') };
  }
  if (options.itemIds.length === 0) {
    return { report, error: new Error('No items selected') };
  }

  // 1) Pull source items + their categories.
  const { data: srcItems, error: itemsErr } = await supabase
    .from('inventory_items')
    .select('id, name, description, price, cost, grab_price, category_id, status, barcode, img_url, inventory_item_categories(category_id)')
    .in('id', options.itemIds)
    .eq('branch_id', sourceBranchId);

  if (itemsErr) return { report, error: itemsErr };

  // 2) Resolve categories at dest (find or create).
  const allSrcCategoryIds = new Set<string>();
  for (const it of srcItems ?? []) {
    const r = it as any;
    if (r.category_id) allSrcCategoryIds.add(r.category_id);
    for (const link of r.inventory_item_categories ?? []) allSrcCategoryIds.add(link.category_id);
  }
  const { idMap: catIdMap, created: catsCreated, error: catErr } =
    await resolveOrCreateCategoriesAt(destinationBranchId, Array.from(allSrcCategoryIds));
  if (catErr) return { report, error: catErr };
  report.categories.created = catsCreated;
  report.categories.skipped = allSrcCategoryIds.size - catsCreated;

  // 3) Look up which items already exist at dest by name (case-insensitive).
  const itemNames = (srcItems || []).map((r: any) => r.name);
  const { data: existingDestItems } = await supabase
    .from('inventory_items')
    .select('id, name')
    .eq('branch_id', destinationBranchId)
    .in('name', itemNames);
  const destItemIdByLowerName = new Map<string, string>();
  for (const row of existingDestItems ?? []) {
    destItemIdByLowerName.set((row as any).name.toLowerCase(), (row as any).id);
  }

  // 4) Insert missing items + link their categories.
  const itemsToCreate = (srcItems || []).filter(
    (r: any) => !destItemIdByLowerName.has(r.name.toLowerCase())
  );
  let createdItemRows: any[] = [];
  if (itemsToCreate.length > 0) {
    const payload = itemsToCreate.map((r: any) => ({
      branch_id: destinationBranchId,
      name: r.name,
      description: r.description ?? null,
      price: r.price,
      cost: r.cost ?? null,
      grab_price: r.grab_price ?? null,
      category_id: r.category_id ? catIdMap.get(r.category_id) ?? null : null,
      status: r.status,
      barcode: r.barcode ?? null,
      img_url: r.img_url ?? null,
      stock: 0,
      synced_from_main_at: new Date().toISOString(),
    }));
    const { data: created, error: insErr } = await supabase
      .from('inventory_items')
      .insert(payload)
      .select('id, name');
    if (insErr) return { report, error: insErr };
    createdItemRows = created || [];
    report.items.created = createdItemRows.length;

    // Build dest item id map for the freshly created.
    for (const row of createdItemRows) {
      destItemIdByLowerName.set((row as any).name.toLowerCase(), (row as any).id);
    }

    // Insert category links for each created item.
    const links: Array<{ inventory_item_id: string; category_id: string }> = [];
    for (let i = 0; i < itemsToCreate.length; i++) {
      const src = itemsToCreate[i] as any;
      const dest = createdItemRows[i];
      if (!dest) continue;
      const linkedCatIds = new Set<string>();
      for (const link of src.inventory_item_categories ?? []) {
        const destCatId = catIdMap.get(link.category_id);
        if (destCatId) linkedCatIds.add(destCatId);
      }
      // Also include the primary category_id if present.
      if (src.category_id) {
        const destPrimary = catIdMap.get(src.category_id);
        if (destPrimary) linkedCatIds.add(destPrimary);
      }
      for (const cid of linkedCatIds) {
        links.push({ inventory_item_id: dest.id, category_id: cid });
      }
    }
    if (links.length > 0) {
      const { error: linkErr } = await supabase.from('inventory_item_categories').insert(links);
      if (linkErr) report.warnings.push(`Some category links failed: ${linkErr.message}`);
    }
  }
  report.items.skipped = (srcItems || []).length - report.items.created;

  // 5) Bundles (optional).
  if (options.includeBundles !== false) {
    // Build itemIdMap: source.inventory_item_id → dest.inventory_item_id, by name match (case-insensitive).
    const allSrcItemIdsForBundles = new Set(options.itemIds);
    const { data: srcBundles, error: bundlesErr } = await supabase
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
    if (bundlesErr) {
      report.warnings.push(`Bundle fetch failed: ${bundlesErr.message}`);
    } else {
      // Map of source inventory_item_id → name (used to compute name-based matching).
      const { data: srcItemNames } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('branch_id', sourceBranchId);
      const nameBySrcItemId = new Map<string, string>(
        (srcItemNames ?? []).map((r: any) => [r.id, r.name])
      );

      const allDestNames = Array.from(destItemIdByLowerName.keys());
      const destItemIdByName = destItemIdByLowerName; // alias for clarity

      // Look up which bundles already exist at dest by name.
      const { data: existingDestBundles } = await supabase
        .from('bundles')
        .select('id, name')
        .eq('branch_id', destinationBranchId)
        .in(
          'name',
          (srcBundles || []).map((b: any) => b.name)
        );
      const destBundleByLowerName = new Map<string, string>(
        (existingDestBundles ?? []).map((r: any) => [r.name.toLowerCase(), r.id])
      );

      for (const sb of srcBundles || []) {
        const srcBundle = sb as any;
        if (destBundleByLowerName.has(srcBundle.name.toLowerCase())) {
          report.bundles.skipped++;
          continue;
        }

        // Resolve component item ids at dest. Missing components mean the bundle is incomplete.
        const components: Array<{ destItemId: string; quantity: number }> = [];
        const missingNames: string[] = [];
        for (const comp of srcBundle.bundle_components ?? []) {
          const srcName = nameBySrcItemId.get(comp.inventory_item_id);
          if (!srcName) {
            missingNames.push('(unknown)');
            continue;
          }
          const destItemId = destItemIdByName.get(srcName.toLowerCase());
          if (destItemId) {
            components.push({ destItemId, quantity: comp.quantity });
          } else {
            missingNames.push(srcName);
          }
        }
        const additionalItems: Array<{ destItemId: string; quantity: number }> = [];
        for (const a of srcBundle.bundle_additional_items ?? []) {
          const srcName = nameBySrcItemId.get(a.inventory_item_id);
          if (!srcName) continue;
          const destItemId = destItemIdByName.get(srcName.toLowerCase());
          if (destItemId) additionalItems.push({ destItemId, quantity: a.quantity });
          else missingNames.push(srcName);
        }

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
            components.map(c => ({
              bundle_id: (createdBundle as any).id,
              inventory_item_id: c.destItemId,
              quantity: c.quantity,
            }))
          );
        }
        if (additionalItems.length > 0) {
          await supabase.from('bundle_additional_items').insert(
            additionalItems.map(a => ({
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

      // Suppress unused-var warning while still keeping the variable available
      // for future name-based reuse strategies.
      void allSrcItemIdsForBundles;
      void allDestNames;
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
