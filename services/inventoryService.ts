import { inventoryRepository } from '@/lib/repositories';
import type { InventoryItem, CreateInventoryItemData, UpdateInventoryItemData } from '@/types/domain';

// Create a new inventory item
export const createInventoryItem = async (
  branchId: string,
  item: CreateInventoryItemData
): Promise<{ id: string | null; error: any }> => {
  const { item: createdItem, error } = await inventoryRepository.create(branchId, item);
  if (!error) await inventoryRepository.triggerRefresh(branchId);
  return { id: createdItem?.id || null, error };
};

// Duplicate an existing item as a new menu entry — copies menu fields (name gets a
// "(Copy)" suffix), starts stock at 0, and drops the code/barcode so the unique
// constraint on code doesn't collide.
export const duplicateInventoryItem = async (
  branchId: string,
  source: InventoryItem
): Promise<{ id: string | null; error: any }> => {
  const duplicateData: CreateInventoryItemData = {
    name: `${source.name} (Copy)`,
    category_id: source.category_id ?? undefined,
    category_ids: source.category_ids,
    description: source.description ?? undefined,
    stock: 0,
    img_url: source.img_url ?? undefined,
    status: source.status,
    kind: source.kind,
    is_custom: source.is_custom,
    unit_type: source.unit_type,
    unit: source.unit,
    measurement: source.measurement,
    is_source_piece: source.is_source_piece,
  };
  return createInventoryItem(branchId, duplicateData);
};

// Get all inventory items for a branch
export const getInventoryItems = async (branchId: string): Promise<{ items: InventoryItem[]; error: any }> => {
  return await inventoryRepository.getByBranch(branchId);
};

// Get inventory item by ID
export const getInventoryItemById = async (id: string): Promise<{ item: InventoryItem | null; error: any }> => {
  return await inventoryRepository.getById(id);
};

// Get items by category
export const getItemsByCategory = async (
  branchId: string,
  categoryId: string
): Promise<{ items: InventoryItem[]; error: any }> => {
  return await inventoryRepository.getByCategory(branchId, categoryId);
};

// Real-time listener for inventory items
export const subscribeToInventoryItems = (
  branchId: string,
  callback: (items: InventoryItem[]) => void
): (() => void) => {
  return inventoryRepository.subscribe(branchId, callback);
};

// Update an inventory item
export const updateInventoryItem = async (
  id: string,
  updates: UpdateInventoryItemData
): Promise<{ item: InventoryItem | null; error: any }> => {
  const result = await inventoryRepository.update(id, updates);
  if (!result.error) await inventoryRepository.triggerRefreshByItemId(id);
  return result;
};

// Delete an inventory item
export const deleteInventoryItem = async (id: string): Promise<{ error: any }> => {
  const result = await inventoryRepository.delete(id);
  if (!result.error) await inventoryRepository.triggerRefreshByItemId(id);
  return result;
};

// Helper function to check if inventory is empty
export const isInventoryEmpty = async (branchId: string): Promise<boolean> => {
  const { items, error } = await getInventoryItems(branchId);
  if (error) return true; // Assume empty on error
  return items.length === 0;
};

// Bulk operations
export const bulkUpdateStock = async (
  updates: Array<{ id: string; stock: number }>
): Promise<{ error: any }> => {
  return await inventoryRepository.bulkUpdateStock(updates);
};

// Search and filter functions
export const searchInventoryItems = async (
  branchId: string,
  searchTerm: string
): Promise<{ items: InventoryItem[]; error: any }> => {
  const { items, error } = await getInventoryItems(branchId);
  
  if (error || !items) {
    return { items: [], error };
  }
  
  const filteredItems = items.filter(
    item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  return { items: filteredItems, error: null };
};

// Search items by category
export const searchItemsByCategory = async (
  branchId: string,
  categoryId: string
): Promise<{ items: InventoryItem[]; error: any }> => {
  return await inventoryRepository.getByCategory(branchId, categoryId);
};

// Stock management helpers
export const getLowStockItems = async (
  branchId: string,
  threshold: number = 5
): Promise<{ items: InventoryItem[]; error: any }> => {
  const { items, error } = await getInventoryItems(branchId);

  if (error || !items) {
    return { items: [], error };
  }

  const lowStockItems = items.filter(item => getAvailableStock(item) <= threshold);

  return { items: lowStockItems, error: null };
};

// Available-to-sell stock = current stock minus reserved (transfers in flight)
// minus uncarried (flagged at EOD as carryover/destock pending).
export const getAvailableStock = (
  item: Pick<InventoryItem, 'stock' | 'reserved_stock' | 'uncarried_stock'>
): number => {
  return Math.max(0, item.stock - (item.reserved_stock ?? 0) - (item.uncarried_stock ?? 0));
};