import { inventoryRepository } from '@/lib/repositories';
import type { InventoryItem, CreateInventoryItemData, UpdateInventoryItemData } from '@/types/domain';

// Create a new inventory item
export const createInventoryItem = async (
  branchId: string,
  item: CreateInventoryItemData
): Promise<{ id: string | null; error: any }> => {
  const { item: createdItem, error } = await inventoryRepository.create(branchId, item);
  return { id: createdItem?.id || null, error };
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
  return await inventoryRepository.update(id, updates);
};

// Delete an inventory item
export const deleteInventoryItem = async (id: string): Promise<{ error: any }> => {
  return await inventoryRepository.delete(id);
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
  
  const lowStockItems = items.filter(item => item.stock <= threshold);
  
  return { items: lowStockItems, error: null };
};