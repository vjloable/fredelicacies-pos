import {
	collection,
	query,
	orderBy,
	onSnapshot,
	Unsubscribe,
	Timestamp,
	where,
	doc,
	DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase-config";
import { InventoryItem } from "../services/inventoryService";
import { Category } from "../services/categoryService";
import { Order } from "../services/orderService";
import { Discount } from "../services/discountService";
import { Branch } from "../services/branchService";
import { Worker } from "../services/workerService";

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
	private categories: Category[] = []; // Categories are global
	private orders: { [branchId: string]: Order[] } = {};
	private discounts: { [branchId: string]: Discount[] } = {};
	private branches: Branch[] = []; // Branches are global (admin only)
	private workers: { [userId: string]: Worker } = {}; // Workers by userId (for individual worker status)

	// Listener states - now tracked by branch
	private inventoryUnsubscribes: { [branchId: string]: Unsubscribe } = {};
	private categoriesUnsubscribe: Unsubscribe | null = null;
	private ordersUnsubscribes: { [branchId: string]: Unsubscribe } = {};
	private discountsUnsubscribes: { [branchId: string]: Unsubscribe } = {};
	private branchesUnsubscribe: Unsubscribe | null = null;
	private workersUnsubscribes: { [userId: string]: Unsubscribe } = {};

	private activeInventoryListeners: Set<string> = new Set();
	private isCategoriesListenerActive = false;
	private activeOrdersListeners: Set<string> = new Set();
	private activeDiscountsListeners: Set<string> = new Set();
	private isBranchesListenerActive = false;
	private activeWorkerListeners: Set<string> = new Set();

	private constructor() {
		// Only initialize global listeners on client side
		if (typeof window !== "undefined") {
			this.initializeGlobalListeners();
		}
	}

	public static getInstance(): DataStore {
		if (!DataStore.instance) {
			DataStore.instance = new DataStore();
		}
		return DataStore.instance;
	}

	private initializeGlobalListeners() {
		// Only initialize if we're on the client side and have a valid db connection
		if (typeof window === "undefined" || !db) {
			return;
		}

		// Categories are global, so start the listener
		this.startCategoriesListener();
	}

	// Inventory Management (Branch-specific)
	private startInventoryListener(branchId: string) {
		if (this.activeInventoryListeners.has(branchId)) return;

		try {
			const q = query(
				collection(db, "inventory"),
				where("branchId", "==", branchId),
				orderBy("createdAt", "desc")
			);

			this.inventoryUnsubscribes[branchId] = onSnapshot(
				q,
				(querySnapshot) => {
					const items: InventoryItem[] = [];

					if (!querySnapshot.empty) {
						querySnapshot.forEach((doc) => {
							try {
								const data = doc.data();
								if (data) {
									const item: InventoryItem = {
										id: doc.id,
										name: data.name || "",
										price: data.price || 0,
										cost: data.cost || 0,
										stock: data.stock || 0,
										categoryId: data.categoryId || "",
										description: data.description || "",
										imgUrl: data.imgUrl || null,
										branchId: data.branchId || "",
										createdAt: data.createdAt || Timestamp.now(),
										updatedAt: data.updatedAt || Timestamp.now(),
									};
									items.push(item);
								}
							} catch (docError) {
								console.error(
									`Error processing inventory doc ${doc.id}:`,
									docError
								);
							}
						});
					}

					this.inventoryItems[branchId] = items;
					this.eventEmitter.emit(`inventoryChanged:${branchId}`, items);
					console.log(
						`📦 Inventory updated for branch ${branchId}: ${items.length} items`
					);
				},
				(error) => {
					console.error(
						`Error in inventory listener for branch ${branchId}:`,
						error
					);
					this.inventoryItems[branchId] = [];
					this.eventEmitter.emit(`inventoryChanged:${branchId}`, []);
					this.eventEmitter.emit(`inventoryError:${branchId}`, error);
				}
			);

			this.activeInventoryListeners.add(branchId);
		} catch (error) {
			console.error(
				`Error starting inventory listener for branch ${branchId}:`,
				error
			);
			this.inventoryItems[branchId] = [];
			this.eventEmitter.emit(`inventoryChanged:${branchId}`, []);
		}
	}

	// Categories (Global)
	private startCategoriesListener() {
		if (this.isCategoriesListenerActive) return;

		try {
			const q = query(collection(db, "categories"), orderBy("name", "asc"));

			this.categoriesUnsubscribe = onSnapshot(
				q,
				(querySnapshot) => {
					console.log(
						"🏷️ Categories snapshot received, empty:",
						querySnapshot.empty,
						"size:",
						querySnapshot.size
					);

					const categories: Category[] = [];

					if (!querySnapshot.empty) {
						querySnapshot.forEach((doc) => {
							try {
								const data = doc.data();
								if (data) {
									const category: Category = {
										id: doc.id,
										name: data.name || "",
										color: data.color || "#000000",
										createdAt: data.createdAt || Timestamp.now(),
									};
									categories.push(category);
								}
							} catch (docError) {
								console.error(
									`Error processing category doc ${doc.id}:`,
									docError
								);
							}
						});
					}

					this.categories = categories;
					this.eventEmitter.emit("categoriesChanged", categories);
					console.log(`🏷️ Categories updated: ${categories.length} categories`);
				},
				(error) => {
					console.error("Error in categories listener:", error);
					this.categories = [];
					this.eventEmitter.emit("categoriesChanged", []);
					this.eventEmitter.emit("categoriesError", error);
				}
			);

			this.isCategoriesListenerActive = true;
		} catch (error) {
			console.error("Error starting categories listener:", error);
			this.categories = [];
			this.eventEmitter.emit("categoriesChanged", []);
		}
	}

	// Branches (Global - Admin only)
	private startBranchesListener() {
		if (this.isBranchesListenerActive) return;

		try {
			const q = query(collection(db, "branches"), orderBy("name", "asc"));

			this.branchesUnsubscribe = onSnapshot(
				q,
				(querySnapshot) => {
					console.log(
						"🏢 Branches snapshot received, empty:",
						querySnapshot.empty,
						"size:",
						querySnapshot.size
					);

					const branches: Branch[] = [];

					if (!querySnapshot.empty) {
						querySnapshot.forEach((doc) => {
							try {
								const data = doc.data();
								if (data) {
									const branch: Branch = {
										id: doc.id,
										name: data.name || "",
										location: data.location || "",
										isActive: data.isActive ?? true,
										imgUrl: data.imgUrl || "",
										createdAt: data.createdAt || Timestamp.now(),
										updatedAt: data.updatedAt || Timestamp.now(),
									};
									branches.push(branch);
								}
							} catch (docError) {
								console.error(
									`Error processing branch doc ${doc.id}:`,
									docError
								);
							}
						});
					}

					this.branches = branches;
					this.eventEmitter.emit("branchesChanged", branches);
					console.log(`🏢 Branches updated: ${branches.length} branches`);
				},
				(error) => {
					console.error("Error in branches listener:", error);
					this.branches = [];
					this.eventEmitter.emit("branchesChanged", []);
					this.eventEmitter.emit("branchesError", error);
				}
			);

			this.isBranchesListenerActive = true;
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
			const q = query(
				collection(db, "orders"),
				where("branchId", "==", branchId),
				orderBy("timestamp", "desc")
			);

			this.ordersUnsubscribes[branchId] = onSnapshot(
				q,
				(querySnapshot) => {
					const orders: Order[] = [];

					if (!querySnapshot.empty) {
						querySnapshot.forEach((doc) => {
							try {
								const data = doc.data();
								if (data) {
									const order: Order = {
										id: doc.id,
										items: data.items || [],
										subtotal: data.subtotal || 0,
										discountAmount: data.discountAmount || 0,
										discountCode: data.discountCode || "",
										total: data.total || 0,
										totalProfit: data.totalProfit || 0,
										orderType: data.orderType || "DINE-IN",
										timestamp: data.timestamp || Timestamp.now(),
										createdAt: data.createdAt || Timestamp.now(),
										itemCount: data.itemCount || 0,
										uniqueItemCount: data.uniqueItemCount || 0,
										workerName: data.workerName || "",
										workerUid: data.workerUid || "",
										branchId: branchId, // Add branchId to the order object
									};
									orders.push(order);
								}
							} catch (docError) {
								console.error(
									`Error processing order doc ${doc.id}:`,
									docError
								);
							}
						});
					}

					this.orders[branchId] = orders;
					this.eventEmitter.emit(`ordersChanged:${branchId}`, orders);
					console.log(
						`📄 Orders updated for branch ${branchId}: ${orders.length} orders`
					);
				},
				(error) => {
					console.error(
						`Error in orders listener for branch ${branchId}:`,
						error
					);
					this.orders[branchId] = [];
					this.eventEmitter.emit(`ordersChanged:${branchId}`, []);
					this.eventEmitter.emit(`ordersError:${branchId}`, error);
				}
			);

			this.activeOrdersListeners.add(branchId);
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
			const q = query(
				collection(db, "discounts"),
				where("branchId", "==", branchId),
				orderBy("created_at", "desc")
			);

			this.discountsUnsubscribes[branchId] = onSnapshot(
				q,
				(querySnapshot) => {
					console.log(
						`🎯 Discounts snapshot received for branch ${branchId}, empty:`,
						querySnapshot.empty,
						"size:",
						querySnapshot.size
					);

					const discounts: Discount[] = [];

					if (!querySnapshot.empty) {
						querySnapshot.forEach((doc) => {
							try {
								const data = doc.data();
								if (data) {
									const discount: Discount = {
										id: doc.id,
										discount_code: data.discount_code || doc.id,
										type: data.type || "flat",
										value: data.value || 0,
										applies_to: data.applies_to || null,
										created_at: data.created_at || Timestamp.now(),
										modified_at: data.modified_at || Timestamp.now(),
										created_by: data.created_by || "",
										branchId: data.branchId || "",
										scope: data.scope,
									};
									discounts.push(discount);
								}
							} catch (docError) {
								console.error(
									`Error processing discount doc ${doc.id}:`,
									docError
								);
							}
						});
					}

					this.discounts[branchId] = discounts;
					this.eventEmitter.emit(`discountsChanged:${branchId}`, discounts);
					console.log(
						`🎯 Discounts updated for branch ${branchId}: ${discounts.length} discounts`
					);
				},
				(error) => {
					console.error(
						`Error in discounts listener for branch ${branchId}:`,
						error
					);
					this.discounts[branchId] = [];
					this.eventEmitter.emit(`discountsChanged:${branchId}`, []);
					this.eventEmitter.emit(`discountsError:${branchId}`, error);
				}
			);

			this.activeDiscountsListeners.add(branchId);
		} catch (error) {
			console.error(
				`Error starting discounts listener for branch ${branchId}:`,
				error
			);
			this.discounts[branchId] = [];
			this.eventEmitter.emit(`discountsChanged:${branchId}`, []);
		}
	}

	// Workers (User-specific)
	private startWorkerListener(userId: string) {
		if (this.activeWorkerListeners.has(userId)) return;

		try {
			const workerDocRef = doc(db, "users", userId);

			this.workersUnsubscribes[userId] = onSnapshot(
				workerDocRef,
				(docSnapshot: DocumentSnapshot) => {
					console.log(
						`👤 Worker snapshot received for user ${userId}, exists:`,
						docSnapshot.exists(),
						docSnapshot.data() ? "with data" : "no data"
					);

					if (docSnapshot.exists()) {
						try {
							const data = docSnapshot.data();
							if (data) {
								const worker: Worker = {
									id: docSnapshot.id,
									name: data.name || "",
									email: data.email || "",
									phoneNumber: data.phoneNumber,
									employeeId: data.employeeId,
									roleAssignments: data.roleAssignments || [],
									isOwner: data.isOwner || false,
									ownerAssignedBy: data.ownerAssignedBy,
									ownerAssignedAt: data.ownerAssignedAt
										? data.ownerAssignedAt.toDate()
										: undefined,
									currentStatus: data.isOwner
										? undefined
										: data.currentStatus || "clocked_out",
									currentBranchId: data.currentBranchId,
									lastTimeIn: data.lastTimeIn
										? data.lastTimeIn.toDate()
										: undefined,
									lastTimeOut: data.lastTimeOut
										? data.lastTimeOut.toDate()
										: undefined,
									profilePicture: data.profilePicture,
									createdAt: data.createdAt
										? data.createdAt.toDate()
										: new Date(),
									updatedAt: data.updatedAt
										? data.updatedAt.toDate()
										: new Date(),
									createdBy: data.createdBy || "",
									isActive: data.isActive !== false, // Default to true if not set
									lastLoginAt: data.lastLoginAt
										? data.lastLoginAt.toDate()
										: undefined,
									passwordResetRequired: data.passwordResetRequired || false,
									twoFactorEnabled: data.twoFactorEnabled || false,
								};

								this.workers[userId] = worker;
								this.eventEmitter.emit(`workerChanged:${userId}`, worker);
								console.log(
									`👤 Worker updated for user ${userId}:`,
									worker.name
								);
							}
						} catch (docError) {
							console.error(`Error processing worker doc ${userId}:`, docError);
							delete this.workers[userId];
							this.eventEmitter.emit(`workerChanged:${userId}`, null);
						}
					} else {
						// Worker document doesn't exist or was deleted
						delete this.workers[userId];
						this.eventEmitter.emit(`workerChanged:${userId}`, null);
						console.log(`👤 Worker removed for user ${userId}`);
					}
				},
				(error: any) => {
					console.error(`Error in worker listener for user ${userId}:`, error);
					delete this.workers[userId];
					this.eventEmitter.emit(`workerChanged:${userId}`, null);
					this.eventEmitter.emit(`workerError:${userId}`, error);
				}
			);

			this.activeWorkerListeners.add(userId);
		} catch (error) {
			console.error(
				`Error starting worker listener for user ${userId}:`,
				error
			);
			delete this.workers[userId];
			this.eventEmitter.emit(`workerChanged:${userId}`, null);
		}
	}

	// Public methods to subscribe to data changes (branch-specific)
	public subscribeToInventory(
		branchId: string,
		callback: (items: InventoryItem[]) => void
	): () => void {
		if (!branchId) {
			console.warn("No branchId provided for inventory subscription");
			callback([]);
			return () => {};
		}

		console.log(`🔗 New inventory subscription created for branch ${branchId}`);

		// Ensure listeners are started (client-side only)
		if (
			typeof window !== "undefined" &&
			!this.activeInventoryListeners.has(branchId)
		) {
			this.startInventoryListener(branchId);
		}

		// Always call with current data (even if empty array)
		callback(this.inventoryItems[branchId] || []);

		// Subscribe to future changes
		this.eventEmitter.on(`inventoryChanged:${branchId}`, callback);

		// Return unsubscribe function
		return () => {
			this.eventEmitter.off(`inventoryChanged:${branchId}`, callback);
		};
	}

	public subscribeToCategories(
		callback: (categories: Category[]) => void
	): () => void {
		console.log("🔗 New categories subscription created");

		// Ensure listeners are started (client-side only)
		if (typeof window !== "undefined" && !this.isCategoriesListenerActive) {
			this.startCategoriesListener();
		}

		// Always call with current data (even if empty array)
		callback(this.categories);

		// Subscribe to future changes
		this.eventEmitter.on("categoriesChanged", callback);

		// Return unsubscribe function
		return () => {
			this.eventEmitter.off("categoriesChanged", callback);
		};
	}

	public subscribeToBranches(
		callback: (branches: Branch[]) => void
	): () => void {
		console.log("🔗 New branches subscription created");

		// Ensure listeners are started (client-side only)
		if (typeof window !== "undefined" && !this.isBranchesListenerActive) {
			this.startBranchesListener();
		}

		// Always call with current data (even if empty array)
		callback(this.branches);

		// Subscribe to future changes
		this.eventEmitter.on("branchesChanged", callback);

		// Return unsubscribe function
		return () => {
			this.eventEmitter.off("branchesChanged", callback);
		};
	}

	public subscribeToOrders(
		branchId: string,
		callback: (orders: Order[]) => void
	): () => void {
		if (!branchId) {
			console.warn("No branchId provided for orders subscription");
			callback([]);
			return () => {};
		}

		console.log(`🔗 New orders subscription created for branch ${branchId}`);

		// Ensure listeners are started (client-side only)
		if (
			typeof window !== "undefined" &&
			!this.activeOrdersListeners.has(branchId)
		) {
			this.startOrdersListener(branchId);
		}

		// Always call with current data (even if empty array)
		callback(this.orders[branchId] || []);

		// Subscribe to future changes
		this.eventEmitter.on(`ordersChanged:${branchId}`, callback);

		// Return unsubscribe function
		return () => {
			this.eventEmitter.off(`ordersChanged:${branchId}`, callback);
		};
	}

	public subscribeToDiscounts(
		branchId: string,
		callback: (discounts: Discount[]) => void
	): () => void {
		if (!branchId) {
			console.warn("No branchId provided for discounts subscription");
			callback([]);
			return () => {};
		}

		console.log(`🔗 New discounts subscription created for branch ${branchId}`);

		// Ensure listeners are started (client-side only)
		if (
			typeof window !== "undefined" &&
			!this.activeDiscountsListeners.has(branchId)
		) {
			this.startDiscountsListener(branchId);
		}

		// Always call with current data (even if empty array)
		callback(this.discounts[branchId] || []);

		// Subscribe to future changes
		this.eventEmitter.on(`discountsChanged:${branchId}`, callback);

		// Return unsubscribe function
		return () => {
			this.eventEmitter.off(`discountsChanged:${branchId}`, callback);
		};
	}

	public subscribeToWorker(
		userId: string,
		callback: (worker: Worker | null) => void
	): () => void {
		if (!userId) {
			console.warn("No userId provided for worker subscription");
			callback(null);
			return () => {};
		}

		console.log(`🔗 New worker subscription created for user ${userId}`);

		// Ensure listeners are started (client-side only)
		if (
			typeof window !== "undefined" &&
			!this.activeWorkerListeners.has(userId)
		) {
			this.startWorkerListener(userId);
		}

		// Always call with current data (even if null)
		callback(this.workers[userId] || null);

		// Subscribe to future changes
		this.eventEmitter.on(`workerChanged:${userId}`, callback);

		// Return unsubscribe function
		return () => {
			this.eventEmitter.off(`workerChanged:${userId}`, callback);
		};
	}

	// Error subscriptions
	public subscribeToInventoryErrors(
		branchId: string,
		callback: (error: any) => void
	): () => void {
		this.eventEmitter.on(`inventoryError:${branchId}`, callback);
		return () => {
			this.eventEmitter.off(`inventoryError:${branchId}`, callback);
		};
	}

	public subscribeToCategoriesErrors(
		callback: (error: any) => void
	): () => void {
		this.eventEmitter.on("categoriesError", callback);
		return () => {
			this.eventEmitter.off("categoriesError", callback);
		};
	}

	public subscribeToBranchesErrors(callback: (error: any) => void): () => void {
		this.eventEmitter.on("branchesError", callback);
		return () => {
			this.eventEmitter.off("branchesError", callback);
		};
	}

	public subscribeToOrdersErrors(
		branchId: string,
		callback: (error: any) => void
	): () => void {
		this.eventEmitter.on(`ordersError:${branchId}`, callback);
		return () => {
			this.eventEmitter.off(`ordersError:${branchId}`, callback);
		};
	}

	public subscribeToDiscountsErrors(
		branchId: string,
		callback: (error: any) => void
	): () => void {
		this.eventEmitter.on(`discountsError:${branchId}`, callback);
		return () => {
			this.eventEmitter.off(`discountsError:${branchId}`, callback);
		};
	}

	public subscribeToWorkerErrors(
		userId: string,
		callback: (error: any) => void
	): () => void {
		this.eventEmitter.on(`workerError:${userId}`, callback);
		return () => {
			this.eventEmitter.off(`workerError:${userId}`, callback);
		};
	}

	// Get current data synchronously
	public getInventoryItems(branchId: string): InventoryItem[] {
		return [...(this.inventoryItems[branchId] || [])];
	}

	public getCategories(): Category[] {
		return [...this.categories];
	}

	public getBranches(): Branch[] {
		return [...this.branches];
	}

	public getOrders(branchId: string): Order[] {
		return [...(this.orders[branchId] || [])];
	}

	public getDiscounts(branchId: string): Discount[] {
		return [...(this.discounts[branchId] || [])];
	}

	public getWorker(userId: string): Worker | null {
		return this.workers[userId] || null;
	}

	// Cleanup method for specific branch
	public cleanupBranch(branchId: string) {
		console.log(`🧹 Cleaning up listeners for branch ${branchId}`);

		if (this.inventoryUnsubscribes[branchId]) {
			this.inventoryUnsubscribes[branchId]();
			delete this.inventoryUnsubscribes[branchId];
			this.activeInventoryListeners.delete(branchId);
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

		// Clean up data
		delete this.inventoryItems[branchId];
		delete this.orders[branchId];
		delete this.discounts[branchId];
	}

	// Cleanup method for specific worker
	public cleanupWorker(userId: string) {
		console.log(`🧹 Cleaning up worker listener for user ${userId}`);

		if (this.workersUnsubscribes[userId]) {
			this.workersUnsubscribes[userId]();
			delete this.workersUnsubscribes[userId];
			this.activeWorkerListeners.delete(userId);
		}

		// Clean up data
		delete this.workers[userId];
	}

	// Full cleanup method
	public cleanup() {
		console.log("🧹 Full dataStore cleanup");

		// Clean up all branch-specific listeners
		Object.keys(this.inventoryUnsubscribes).forEach((branchId) => {
			this.cleanupBranch(branchId);
		});

		// Clean up global listeners
		if (this.categoriesUnsubscribe) {
			this.categoriesUnsubscribe();
			this.categoriesUnsubscribe = null;
			this.isCategoriesListenerActive = false;
		}

		if (this.branchesUnsubscribe) {
			this.branchesUnsubscribe();
			this.branchesUnsubscribe = null;
			this.isBranchesListenerActive = false;
		}

		// Clean up all worker-specific listeners
		Object.keys(this.workersUnsubscribes).forEach((userId) => {
			this.cleanupWorker(userId);
		});
	}

	// Get listener status
	public getListenerStatus() {
		return {
			activeInventoryBranches: Array.from(this.activeInventoryListeners),
			categories: this.isCategoriesListenerActive,
			branches: this.isBranchesListenerActive,
			activeOrdersBranches: Array.from(this.activeOrdersListeners),
			activeDiscountsBranches: Array.from(this.activeDiscountsListeners),
			activeWorkerUsers: Array.from(this.activeWorkerListeners),
			categoriesCount: this.categories.length,
			branchesCount: this.branches.length,
			workersCount: Object.keys(this.workers).length,
			branchDataCounts: Object.keys(this.inventoryItems).reduce(
				(acc, branchId) => {
					acc[branchId] = {
						inventory: this.inventoryItems[branchId]?.length || 0,
						orders: this.orders[branchId]?.length || 0,
						discounts: this.discounts[branchId]?.length || 0,
					};
					return acc;
				},
				{} as { [branchId: string]: any }
			),
		};
	}
}

// Export singleton instance
export const dataStore = DataStore.getInstance();

// Export convenience functions that use the singleton
export const subscribeToInventoryItems = (
	branchId: string,
	callback: (items: InventoryItem[]) => void
) => {
	return dataStore.subscribeToInventory(branchId, callback);
};

export const subscribeToCategories = (
	callback: (categories: Category[]) => void
) => {
	return dataStore.subscribeToCategories(callback);
};

export const subscribeToBranches = (callback: (branches: Branch[]) => void) => {
	return dataStore.subscribeToBranches(callback);
};

export const subscribeToOrders = (
	branchId: string,
	callback: (orders: Order[]) => void
) => {
	return dataStore.subscribeToOrders(branchId, callback);
};

export const subscribeToDiscounts = (
	branchId: string,
	callback: (discounts: Discount[]) => void
) => {
	return dataStore.subscribeToDiscounts(branchId, callback);
};

export const getInventoryItems = (branchId: string) => {
	return dataStore.getInventoryItems(branchId);
};

export const getCategories = () => {
	return dataStore.getCategories();
};

export const getBranches = () => {
	return dataStore.getBranches();
};

export const getOrders = (branchId: string) => {
	return dataStore.getOrders(branchId);
};

export const getDiscounts = (branchId: string) => {
	return dataStore.getDiscounts(branchId);
};

export const subscribeToWorker = (
	userId: string,
	callback: (worker: Worker | null) => void
) => {
	return dataStore.subscribeToWorker(userId, callback);
};

export const getWorker = (userId: string) => {
	return dataStore.getWorker(userId);
};

// Export for debugging
export const getDataStoreStatus = () => {
	return dataStore.getListenerStatus();
};
