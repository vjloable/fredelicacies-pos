// DataStore - Refactored for Supabase
// Singleton data store with real-time subscriptions
import { subscribeToCategories } from "@/services/categoryService";
import { subscribeToInventoryItems } from "@/services/inventoryService";
import { subscribeToOrders } from "@/services/orderService";
import { subscribeToDiscounts } from "@/services/discountService";
import { branchService } from "@/services/branchService";
import { subscribeToBundles } from "@/services/bundleService";
import { workerService } from "@/services/workerService";
import type { Category } from "@/types/domain";
import type { InventoryItem } from "@/types/domain";
import type { Order } from "@/types/domain";
import type { Discount } from "@/types/domain";
import type { Branch } from "@/types/domain";
import type { BundleWithComponents } from "@/types/domain";
import type { Worker } from "@/services/workerService";

// Event emitter for state changes
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, callback: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((cb) => cb !== callback);
  }

  emit(event: string, data: any) {
    if (!this.events[event]) return;
    this.events[event].forEach((callback) => callback(data));
  }
}

// Singleton DataStore class with branch support
class DataStore {
  private static instance: DataStore;
  private eventEmitter = new EventEmitter();

  // Data state - now organized by branch
  private inventoryItems: { [branchId: string]: InventoryItem[] } = {};
  private categories: { [branchId: string]: Category[] } = {};
  private orders: { [branchId: string]: Order[] } = {};
  private discounts: { [branchId: string]: Discount[] } = {};
  private bundles: { [branchId: string]: BundleWithComponents[] } = {};
  private branches: Branch[] = []; // Branches are global (admin only)
  private workers: { [userId: string]: Worker } = {}; // Workers by userId

  // Unsubscribe functions - now tracked by branch
  private inventoryUnsubscribes: { [branchId: string]: () => void } = {};
  private categoriesUnsubscribes: { [branchId: string]: () => void } = {};
  private ordersUnsubscribes: { [branchId: string]: () => void } = {};
  private discountsUnsubscribes: { [branchId: string]: () => void } = {};
  private bundlesUnsubscribes: { [branchId: string]: () => void } = {};
  private branchesUnsubscribe: (() => void) | null = null;
  private workersUnsubscribes: { [userId: string]: () => void } = {};

  private activeInventoryListeners: Set<string> = new Set();
  private activeCategoriesListeners: Set<string> = new Set();
  private activeOrdersListeners: Set<string> = new Set();
  private activeDiscountsListeners: Set<string> = new Set();
  private activeBundlesListeners: Set<string> = new Set();
  private isBranchesListenerActive = false;
  private activeWorkerListeners: Set<string> = new Set();

  private constructor() {
    // Initialize on client side only
    if (typeof window !== "undefined") {
      console.log("📦 DataStore initialized for Supabase");
    }
  }

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  // Inventory Management (Branch-specific)
  private startInventoryListener(branchId: string) {
    if (this.activeInventoryListeners.has(branchId)) return;

    try {
      const unsubscribe = subscribeToInventoryItems(
        branchId,
        (items: InventoryItem[]) => {
          this.inventoryItems[branchId] = items;
          this.eventEmitter.emit(`inventoryChanged:${branchId}`, items);
          console.log(
            `📦 Inventory updated for branch ${branchId}: ${items.length} items`
          );
        }
      );

      this.inventoryUnsubscribes[branchId] = unsubscribe;
      this.activeInventoryListeners.add(branchId);
      console.log(`✅ Inventory listener started for branch ${branchId}`);
    } catch (error) {
      console.error(
        `Error starting inventory listener for branch ${branchId}:`,
        error
      );
      this.inventoryItems[branchId] = [];
      this.eventEmitter.emit(`inventoryChanged:${branchId}`, []);
    }
  }

  // Categories (Branch-specific)
  private startCategoriesListener(branchId: string) {
    if (this.activeCategoriesListeners.has(branchId)) return;

    try {
      const unsubscribe = subscribeToCategories(
        branchId,
        (categories: Category[]) => {
          this.categories[branchId] = categories;
          this.eventEmitter.emit(`categoriesChanged:${branchId}`, categories);
          console.log(
            `🏷️ Categories updated for branch ${branchId}: ${categories.length} categories`
          );
        }
      );

      this.categoriesUnsubscribes[branchId] = unsubscribe;
      this.activeCategoriesListeners.add(branchId);
      console.log(`✅ Categories listener started for branch ${branchId}`);
    } catch (error) {
      console.error(
        `Error starting categories listener for branch ${branchId}:`,
        error
      );
      this.categories[branchId] = [];
      this.eventEmitter.emit(`categoriesChanged:${branchId}`, []);
    }
  }

  // Branches (Global - Admin only)
  private startBranchesListener() {
    if (this.isBranchesListenerActive) return;

    try {
      const unsubscribe = branchService.subscribeToBranches((branches: Branch[]) => {
        this.branches = branches;
        this.eventEmitter.emit("branchesChanged", branches);
        console.log(`🏢 Branches updated: ${branches.length} branches`);
      });

      this.branchesUnsubscribe = unsubscribe;
      this.isBranchesListenerActive = true;
      console.log("✅ Branches listener started");
    } catch (error) {
      console.error("Error starting branches listener:", error);
      this.branches = [];
      this.eventEmitter.emit("branchesChanged", []);
    }
  }

  // Orders (Branch-specific)
  private startOrdersListener(branchId: string) {
    if (this.activeOrdersListeners.has(branchId)) return;

    try {
      const unsubscribe = subscribeToOrders(branchId, (orders: Order[]) => {
        this.orders[branchId] = orders;
        this.eventEmitter.emit(`ordersChanged:${branchId}`, orders);
        console.log(
          `🧾 Orders updated for branch ${branchId}: ${orders.length} orders`
        );
      });

      this.ordersUnsubscribes[branchId] = unsubscribe;
      this.activeOrdersListeners.add(branchId);
      console.log(`✅ Orders listener started for branch ${branchId}`);
    } catch (error) {
      console.error(
        `Error starting orders listener for branch ${branchId}:`,
        error
      );
      this.orders[branchId] = [];
      this.eventEmitter.emit(`ordersChanged:${branchId}`, []);
    }
  }

  // Discounts (Branch-specific)
  private startDiscountsListener(branchId: string) {
    if (this.activeDiscountsListeners.has(branchId)) return;

    try {
      const unsubscribe = subscribeToDiscounts(
        branchId,
        (discounts: Discount[]) => {
          this.discounts[branchId] = discounts;
          this.eventEmitter.emit(`discountsChanged:${branchId}`, discounts);
          console.log(
            `💰 Discounts updated for branch ${branchId}: ${discounts.length} discounts`
          );
        }
      );

      this.discountsUnsubscribes[branchId] = unsubscribe;
      this.activeDiscountsListeners.add(branchId);
      console.log(`✅ Discounts listener started for branch ${branchId}`);
    } catch (error) {
      console.error(
        `Error starting discounts listener for branch ${branchId}:`,
        error
      );
      this.discounts[branchId] = [];
      this.eventEmitter.emit(`discountsChanged:${branchId}`, []);
    }
  }

  // Bundles (Branch-specific)
  private startBundlesListener(branchId: string) {
    if (this.activeBundlesListeners.has(branchId)) return;

    try {
      const unsubscribe = subscribeToBundles(
        branchId,
        (bundles: BundleWithComponents[]) => {
          this.bundles[branchId] = bundles;
          this.eventEmitter.emit(`bundlesChanged:${branchId}`, bundles);
          console.log(
            `📦 Bundles updated for branch ${branchId}: ${bundles.length} bundles`
          );
        }
      );

      this.bundlesUnsubscribes[branchId] = unsubscribe;
      this.activeBundlesListeners.add(branchId);
      console.log(`✅ Bundles listener started for branch ${branchId}`);
    } catch (error) {
      console.error(
        `Error starting bundles listener for branch ${branchId}:`,
        error
      );
      this.bundles[branchId] = [];
      this.eventEmitter.emit(`bundlesChanged:${branchId}`, []);
    }
  }

  // Workers (Individual - by userId)
  private startWorkerListener(userId: string) {
    if (this.activeWorkerListeners.has(userId)) return;

    try {
      // For now, we'll poll periodically since workerService doesn't have realtime yet
      // In the future, we can add realtime subscriptions to user_profiles table
      const pollInterval = setInterval(async () => {
        const worker = await workerService.getWorker(userId);
        if (worker) {
          this.workers[userId] = worker;
          this.eventEmitter.emit(`workerChanged:${userId}`, worker);
        }
      }, 5000); // Poll every 5 seconds

      this.workersUnsubscribes[userId] = () => {
        clearInterval(pollInterval);
      };
      this.activeWorkerListeners.add(userId);
      console.log(`✅ Worker listener started for user ${userId}`);
    } catch (error) {
      console.error(`Error starting worker listener for user ${userId}:`, error);
    }
  }

  // Public methods to start/stop listeners
  public startBranchListeners(branchId: string) {
    console.log(`🚀 Starting listeners for branch ${branchId}`);
    this.startInventoryListener(branchId);
    this.startCategoriesListener(branchId);
    this.startOrdersListener(branchId);
    this.startDiscountsListener(branchId);
    this.startBundlesListener(branchId);
  }

  public stopBranchListeners(branchId: string) {
    console.log(`🛑 Stopping listeners for branch ${branchId}`);

    if (this.inventoryUnsubscribes[branchId]) {
      this.inventoryUnsubscribes[branchId]();
      delete this.inventoryUnsubscribes[branchId];
      this.activeInventoryListeners.delete(branchId);
    }

    if (this.categoriesUnsubscribes[branchId]) {
      this.categoriesUnsubscribes[branchId]();
      delete this.categoriesUnsubscribes[branchId];
      this.activeCategoriesListeners.delete(branchId);
    }

    if (this.ordersUnsubscribes[branchId]) {
      this.ordersUnsubscribes[branchId]();
      delete this.ordersUnsubscribes[branchId];
      this.activeOrdersListeners.delete(branchId);
    }

    if (this.discountsUnsubscribes[branchId]) {
      this.discountsUnsubscribes[branchId]();
      delete this.discountsUnsubscribes[branchId];
      this.activeDiscountsListeners.delete(branchId);
    }

    if (this.bundlesUnsubscribes[branchId]) {
      this.bundlesUnsubscribes[branchId]();
      delete this.bundlesUnsubscribes[branchId];
      this.activeBundlesListeners.delete(branchId);
    }
  }

  public startGlobalListeners() {
    console.log("🌍 Starting global listeners");
    this.startBranchesListener();
  }

  public stopGlobalListeners() {
    console.log("🛑 Stopping global listeners");

    if (this.branchesUnsubscribe) {
      this.branchesUnsubscribe();
      this.branchesUnsubscribe = null;
      this.isBranchesListenerActive = false;
    }
  }

  public startWorkerListeners(userId: string) {
    this.startWorkerListener(userId);
  }

  public stopWorkerListeners(userId: string) {
    if (this.workersUnsubscribes[userId]) {
      this.workersUnsubscribes[userId]();
      delete this.workersUnsubscribes[userId];
      this.activeWorkerListeners.delete(userId);
    }
  }

  // Getters for data
  public getInventoryItems(branchId: string): InventoryItem[] {
    return this.inventoryItems[branchId] || [];
  }

  public getCategories(branchId: string): Category[] {
    return this.categories[branchId] || [];
  }

  public getOrders(branchId: string): Order[] {
    return this.orders[branchId] || [];
  }

  public getDiscounts(branchId: string): Discount[] {
    return this.discounts[branchId] || [];
  }

  public getBundles(branchId: string): BundleWithComponents[] {
    return this.bundles[branchId] || [];
  }

  public getBranches(): Branch[] {
    return this.branches;
  }

  public getWorker(userId: string): Worker | null {
    return this.workers[userId] || null;
  }

  // Event subscription helpers
  public subscribe(event: string, callback: Function) {
    this.eventEmitter.on(event, callback);
  }

  public unsubscribe(event: string, callback: Function) {
    this.eventEmitter.off(event, callback);
  }

  // Cleanup all listeners
  public cleanup() {
    console.log("🧹 Cleaning up all DataStore listeners");

    // Stop all branch listeners
    Object.keys(this.inventoryUnsubscribes).forEach((branchId) => {
      this.stopBranchListeners(branchId);
    });

    // Stop global listeners
    this.stopGlobalListeners();

    // Stop all worker listeners
    Object.keys(this.workersUnsubscribes).forEach((userId) => {
      this.stopWorkerListeners(userId);
    });
  }
}

// Export singleton instance
export const dataStore = DataStore.getInstance();
export default dataStore;
