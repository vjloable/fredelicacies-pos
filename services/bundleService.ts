import { bundleRepository } from '@/lib/repositories';
import type { BundleWithComponents, CreateBundleData, UpdateBundleData } from '@/types/domain';
import type { InventoryItem } from '@/types/domain';

// Calculate bundle availability based on inventory stock
export const calculateBundleAvailability = (
  bundle: BundleWithComponents,
  inventory: InventoryItem[]
): number => {
  if (!bundle.components || bundle.components.length === 0) return 0;

  const stockById = new Map(inventory.map((item) => [item.id, item.stock]));

  const availabilityPerComponent = bundle.components.map((component) => {
    const stock = stockById.get(component.inventory_item_id) ?? 0;
    if (!component.quantity || component.quantity <= 0) return 0;
    return Math.floor(stock / component.quantity);
  });

  return Math.max(Math.min(...availabilityPerComponent), 0);
};

// Create bundle with components
export const createBundle = async (
  branchId: string,
  bundleData: CreateBundleData,
  components: Array<{ inventoryItemId: string; quantity: number }>
): Promise<{ id: string | null; error: any }> => {
  const { bundle, error } = await bundleRepository.create(branchId, bundleData);
  
  if (error || !bundle) {
    return { id: null, error };
  }

  // Add components
  const { error: componentsError } = await bundleRepository.addComponents(bundle.id, components);

  if (componentsError) {
    // Rollback: delete the bundle if components fail
    await bundleRepository.delete(bundle.id);
    return { id: null, error: componentsError };
  }

  await bundleRepository.triggerRefresh(branchId);
  return { id: bundle.id, error: null };
};

// Update bundle
export const updateBundle = async (
  id: string,
  updates: UpdateBundleData,
  components?: Array<{ inventoryItemId: string; quantity: number }>
): Promise<{ error: any }> => {
  const { error } = await bundleRepository.update(id, updates);
  
  if (error) {
    return { error };
  }

  // If components provided, update them
  if (components) {
    // Remove old components
    await bundleRepository.removeAllComponents(id);
    // Add new components
    const { error: componentsError } = await bundleRepository.addComponents(id, components);
    if (componentsError) {
      return { error: componentsError };
    }
  }

  await bundleRepository.triggerRefreshByBundleId(id);
  return { error: null };
};

// Delete bundle
export const deleteBundle = async (id: string): Promise<{ error: any }> => {
  const result = await bundleRepository.delete(id);
  if (!result.error) await bundleRepository.triggerRefreshByBundleId(id);
  return result;
};

// Get bundles with components
export const getBundles = async (branchId: string): Promise<{ bundles: BundleWithComponents[]; error: any }> => {
  return await bundleRepository.getByBranchWithComponents(branchId);
};

// Subscribe to bundles
export const subscribeToBundles = (
  branchId: string,
  callback: (bundles: BundleWithComponents[]) => void,
  onError?: (error: unknown) => void
): (() => void) => {
  return bundleRepository.subscribe(branchId, (bundles) => {
    callback(bundles);
  });
};
