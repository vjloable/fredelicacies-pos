import { bundleGroupRepository, bundleRepository } from '@/lib/repositories';
import { createBundle, updateBundle, deleteBundle } from '@/services/bundleService';
import type { BundleGroupVariantInput, BundleGroupWithVariants, CreateBundleGroupData, UpdateBundleGroupData } from '@/types/domain';

// Create a bundle group and all its variants. Each variant is created as an
// ordinary fixed bundle (is_custom: false) tagged with bundle_group_id, so it
// gets the exact same components/availability/cart/order handling as any
// other fixed bundle — reuses createBundle verbatim.
export const createBundleGroup = async (
  branchId: string,
  data: CreateBundleGroupData
): Promise<{ id: string | null; error: any }> => {
  const { group, error } = await bundleGroupRepository.create(branchId, {
    name: data.name,
    description: data.description,
    img_url: data.img_url,
    category_id: data.category_id,
    category_ids: data.category_ids,
    status: data.status,
  });

  if (error || !group) {
    return { id: null, error };
  }

  for (const variant of data.variants) {
    const { error: variantError } = await createBundle(
      branchId,
      {
        name: `${data.name} — ${variant.variantLabel}`,
        price: variant.price,
        grab_price: variant.grab_price,
        is_custom: false,
        category_id: data.category_id,
        category_ids: data.category_ids,
        status: 'active',
        bundle_group_id: group.id,
        variant_label: variant.variantLabel,
      },
      variant.components
    );

    if (variantError) {
      // Roll back: delete the group, which cascades to any variants already created.
      await bundleGroupRepository.delete(group.id);
      return { id: null, error: variantError };
    }
  }

  await bundleGroupRepository.triggerRefresh(branchId);
  return { id: group.id, error: null };
};

// Update a group's shell fields and diff its variants against what's stored:
// existing variants (matched by id) are updated in place, variants without an
// id are created, and stored variants missing from the incoming list are deleted.
export const updateBundleGroup = async (
  branchId: string,
  groupId: string,
  currentVariantIds: string[],
  data: UpdateBundleGroupData
): Promise<{ error: any }> => {
  const { error: groupError } = await bundleGroupRepository.update(groupId, {
    name: data.name,
    description: data.description,
    img_url: data.img_url,
    category_id: data.category_id,
    category_ids: data.category_ids,
    status: data.status,
  });

  if (groupError) {
    return { error: groupError };
  }

  const incomingIds = new Set(data.variants.filter(v => v.id).map(v => v.id as string));

  for (const variant of data.variants) {
    if (variant.id) {
      const { error } = await updateBundle(
        variant.id,
        {
          name: `${data.name ?? ''} — ${variant.variantLabel}`.trim(),
          price: variant.price,
          grab_price: variant.grab_price,
          variant_label: variant.variantLabel,
          category_id: data.category_id,
          category_ids: data.category_ids,
        },
        variant.components
      );
      if (error) return { error };
    } else {
      const { error } = await createBundle(
        branchId,
        {
          name: `${data.name ?? ''} — ${variant.variantLabel}`.trim(),
          price: variant.price,
          grab_price: variant.grab_price,
          is_custom: false,
          category_id: data.category_id,
          category_ids: data.category_ids,
          status: 'active',
          bundle_group_id: groupId,
          variant_label: variant.variantLabel,
        },
        variant.components
      );
      if (error) return { error };
    }
  }

  for (const removedId of currentVariantIds.filter(id => !incomingIds.has(id))) {
    await deleteBundle(removedId);
  }

  await bundleGroupRepository.triggerRefresh(branchId);
  return { error: null };
};

// Duplicate a bundle group — copies its shell (name gets a "(Copy)" suffix,
// description, image, category) and every variant (label, pricing,
// components), as a brand-new group + brand-new variant bundles.
export const duplicateBundleGroup = async (
  branchId: string,
  source: BundleGroupWithVariants
): Promise<{ id: string | null; error: any }> => {
  const variants: BundleGroupVariantInput[] = source.variants.map(v => ({
    variantLabel: v.variant_label ?? '',
    price: v.price,
    grab_price: v.grab_price,
    components: (v.components ?? []).map(c => ({ inventoryItemId: c.inventory_item_id, quantity: c.quantity })),
  }));

  return createBundleGroup(branchId, {
    name: `${source.name} (Copy)`,
    description: source.description ?? undefined,
    img_url: source.img_url ?? undefined,
    category_id: source.category_id,
    category_ids: source.category_ids,
    status: 'active',
    variants,
  });
};

// Show/hide toggle — flips the group's status only, without touching its
// variants (unlike updateBundleGroup, which always diffs a full variant list).
export const setBundleGroupStatus = async (
  branchId: string,
  groupId: string,
  status: 'active' | 'inactive'
): Promise<{ error: any }> => {
  const { error } = await bundleGroupRepository.update(groupId, { status });
  if (!error) await bundleGroupRepository.triggerRefresh(branchId);
  return { error };
};

export const deleteBundleGroup = async (branchId: string, groupId: string): Promise<{ error: any }> => {
  const { error } = await bundleGroupRepository.delete(groupId);
  if (!error) {
    await bundleGroupRepository.triggerRefresh(branchId);
    await bundleRepository.triggerRefresh(branchId);
  }
  return { error };
};

export const getBundleGroups = async (branchId: string): Promise<{ groups: BundleGroupWithVariants[]; error: any }> => {
  return await bundleGroupRepository.getByBranchWithVariants(branchId);
};

export const subscribeToBundleGroups = (
  branchId: string,
  callback: (groups: BundleGroupWithVariants[]) => void
): (() => void) => {
  return bundleGroupRepository.subscribe(branchId, callback);
};
