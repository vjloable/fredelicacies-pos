"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import TopBar from "@/components/TopBar";
import EditItemModal from "./components/EditItemModal";
import AddItemModal from "./components/AddItemModal";
import AddCategoryModal from "./components/AddCategoryModal";
import {
	InventoryItem,
} from "@/services/inventoryService";
import { subscribeToInventoryItems } from "@/stores/dataStore";
import {
	Category,
	subscribeToCategories,
	getCategoryName,
	getCategoryColor,
} from "@/services/categoryService";
import EditIcon from "../store/icons/EditIcon";
import PlusIcon from "../store/icons/PlusIcon";

interface Item extends InventoryItem {
	id: string; // Make id required for local state
}

export default function InventoryScreen() {
	const [categories, setCategories] = useState<Category[]>([]);
	const [items, setItems] = useState<Item[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isClient, setIsClient] = useState(false);

	const [showCategoryForm, setShowCategoryForm] = useState(false);
	const [showItemForm, setShowItemForm] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [editingItem, setEditingItem] = useState<Item | null>(null);
	const [newItem, setNewItem] = useState({
		name: "",
		price: "",
		categoryId: "",
		stock: "",
		description: "",
		imgUrl: "",
	});

	// Ensure we're on the client before running Firebase code
	useEffect(() => {
		setIsClient(true);
	}, []);

	// Set up real-time subscription to categories
	useEffect(() => {
		if (!isClient) return;
		
		const unsubscribe = subscribeToCategories((firestoreCategories) => {
			setCategories(firestoreCategories);
			// Set default category if none selected
			if (firestoreCategories.length > 0 && !newItem.categoryId) {
				setNewItem((prev) => ({
					...prev,
					categoryId: firestoreCategories[0].id!,
				}));
			}
		});

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [isClient, newItem.categoryId]);

	// Set up real-time subscription to inventory items
	useEffect(() => {
		if (!isClient) return;
		
		setLoading(true);
		setError(null);
		console.log('🚀 Setting up inventory subscription in inventory page...');

		const unsubscribe = subscribeToInventoryItems((firestoreItems) => {
			console.log('📦 Inventory items received in inventory page:', firestoreItems.length, 'items');
			
			// Convert Firestore items to local Item type
			const localItems: Item[] = firestoreItems.map((item) => ({
				...item,
				id: item.id!, // We know id exists from Firestore
			}));

			setItems(localItems);
			setLoading(false);
		});

		// Add timeout fallback for inventory page
		const timeoutId = setTimeout(() => {
			console.warn('⏰ Inventory subscription timeout in inventory page - stopping loading');
			setLoading(false);
		}, 15000); // 15 second timeout for inventory page

		return () => {
			clearTimeout(timeoutId);
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [isClient]);

	const openEditModal = (item: Item) => {
		setEditingItem({ ...item });
		setShowEditModal(true);
	};

	const closeEditModal = () => {
		setShowEditModal(false);
		setEditingItem(null);
	};

	const handleError = (errorMessage: string) => {
		setError(errorMessage);
	};

	return (
		<div className="flex h-full overflow-hidden">
			{/* Main Content Area */}
			<div className="flex flex-col flex-1 h-full overflow-hidden">
				{/* Header Section - Fixed */}
				<TopBar title="Inventory" />
				<span className="flex h-6"></span>

				{/* Show loading until client is ready */}
				{!isClient ? (
					<div className="flex items-center justify-center py-8">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
						<span className="ml-3 text-[var(--secondary)]">
							Initializing...
						</span>
					</div>
				) : (
					<>
						{/* Error Display */}
						{error && (
							<div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
								<div className="flex items-center gap-3">
									<svg
										className="w-5 h-5 text-red-600"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<path
											fillRule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
											clipRule="evenodd"
										/>
									</svg>
									<span className="text-red-700 font-medium">
										{error}
									</span>
									<button
										onClick={() => setError(null)}
										className="ml-auto text-red-600 hover:text-red-800"
									>
										×
									</button>
								</div>
							</div>
						)}

				{/* Loading State */}
				{loading && (
					<div className="flex items-center justify-center py-8">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
						<span className="ml-3 text-[var(--secondary)]">
							Loading inventory...
						</span>
					</div>
				)}

				{/* Main Content - Scrollable */}
				{!loading && (
					<div className="flex-1 px-6 overflow-y-auto pb-6">
						{/* Categories Section */}
						<div className="mb-6">
							<div className="flex items-center justify-between mb-3">
								<h2 className="text-lg font-semibold text-[var(--secondary)]">
									Categories
								</h2>
								<button
									onClick={() =>
										setShowCategoryForm(true)
									}
									className="bg-[var(--accent)] text-white text-[12px] px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 transition-all font-semibold hover:scale-105 active:scale-95"
								>
									<div className="flex flex-row items-center gap-2">
										<div className="w-3 h-3">
											<PlusIcon color="white"/>
										</div>
										Add Category
									</div>
								</button>
							</div>

							{/* Categories List - Compact Horizontal Layout */}
							<div className="flex flex-wrap gap-2">
								{categories.map((category) => (
									<div
										key={category.id}
										className="inline-flex items-center gap-2 bg-[var(--primary)] px-3 py-2 rounded-lg border border-gray-200"
									>
										<div
											className="w-3 h-3 rounded-full"
											style={{
												backgroundColor: category.color,
											}}
										></div>
										<span className="text-sm font-medium text-[var(--secondary)]">
											{category.name}
										</span>
										<span className="text-xs text-[var(--secondary)] opacity-50 bg-gray-100 px-2 py-0.5 rounded-full">
											{
												items.filter(
													(item) =>
														item.categoryId ===
														category.id
												).length
											}
										</span>
									</div>
								))}
							</div>
						</div>

						{/* Items Section */}
						<div>
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-xl font-semibold text-[var(--secondary)]">
									Items
								</h2>
								<button
									onClick={() =>
										setShowItemForm(true)
									}
									className="bg-[var(--accent)] text-white text-[12px] px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 transition-all font-semibold hover:scale-105 active:scale-95"
								>
									<div className="flex flex-row items-center gap-2">
										<div className="w-3 h-3">
											<PlusIcon color="white"/>
										</div>
										Add Item
									</div>
								</button>
							</div>

							{/* Items List */}
							<div className="space-y-3">
								{items.length === 0 ? (
									/* Empty State */
									<div className="text-center py-16 px-4">
										<div className="w-24 h-24 bg-gray-100 rounded-2xl mx-auto mb-6 flex items-center justify-center">
											<svg
												className="w-12 h-12 text-gray-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={1.5}
													d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5.6L12 4l3 1.6M19 8.8L16 7.2M5 8.8L8 7.2"
												/>
											</svg>
										</div>
										<h3 className="text-xl font-semibold text-[var(--secondary)] mb-3">
											No Items in Inventory
										</h3>
										<p className="text-[var(--secondary)] opacity-70 mb-6 max-w-md mx-auto">
											Your inventory is empty. Start by
											adding your first item to begin
											managing your products and stock
											levels.
										</p>
										<button
											onClick={() =>
												setShowItemForm(true)
											}
											className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-xl hover:bg-[var(--accent)]/90 transition-all font-semibold hover:scale-105 active:scale-95"
										>
											<svg
												className="w-5 h-5"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M12 4v16m8-8H4"
												/>
											</svg>
											Add Your First Item
										</button>

										{/* Quick Setup Guide */}
										<div className="mt-12 max-w-2xl mx-auto">
											<div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
												<h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
													<svg
														className="w-5 h-5 text-blue-600"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
														/>
													</svg>
													Quick Setup Guide
												</h4>
												<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
													<div className="text-center">
														<div className="w-10 h-10 bg-blue-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
															<span className="text-blue-600 font-bold">
																1
															</span>
														</div>
														<h5 className="font-medium text-blue-900 mb-1">
															Create Categories
														</h5>
														<p className="text-sm text-blue-700 opacity-80">
															Organize your
															products by type
														</p>
													</div>
													<div className="text-center">
														<div className="w-10 h-10 bg-blue-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
															<span className="text-blue-600 font-bold">
																2
															</span>
														</div>
														<h5 className="font-medium text-blue-900 mb-1">
															Add Items
														</h5>
														<p className="text-sm text-blue-700 opacity-80">
															Set prices and stock
															levels
														</p>
													</div>
													<div className="text-center">
														<div className="w-10 h-10 bg-blue-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
															<span className="text-blue-600 font-bold">
																3
															</span>
														</div>
														<h5 className="font-medium text-blue-900 mb-1">
															Manage Stock
														</h5>
														<p className="text-sm text-blue-700 opacity-80">
															Track and update
															inventory
														</p>
													</div>
												</div>
											</div>
										</div>
									</div>
								) : (
									/* Items List */
									items.map((item) => (
										<div
											key={item.id}
											className="bg-[var(--primary)] p-4 rounded-lg border border-gray-200"
										>
											<div className="flex items-center justify-between w-full">
												<div className="flex items-center gap-4 flex-1 min-w-0">
													<div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative">
														{item.imgUrl ? (
															<Image
																src={item.imgUrl}
																alt={item.name}
																width={48}
																height={48}
																className="w-full h-full object-cover"
															/>
														) : (
															<svg
																className="w-6 h-6 text-gray-400"
																fill="currentColor"
																viewBox="0 0 20 20"
															>
																<path
																	fillRule="evenodd"
																	d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
																	clipRule="evenodd"
																/>
															</svg>
														)}
													</div>
													<div className="flex flex-1 gap-4 h-12 flex-shrink">
														<div className="flex flex-shrink flex-col items-center justify-between">
															<h3 className="font-semibold text-[var(--secondary)] text-[18px] truncate text-left w-full">
																{item.name}
															</h3>
															<div className="flex items-center gap-2 w-full">
																<div className="font-semibold text-[var(--accent)] text-[12px]">
																	₱{item.price.toFixed(2)}
																</div>
																{item.cost && item.cost > 0 && (
																	<>
																		<span className="text-xs text-gray-400">|</span>
																		<div className="text-xs text-gray-600">
																			Cost: ₱{item.cost.toFixed(2)}
																		</div>
																		<div className="text-xs text-green-600 bg-green-50 px-1 py-0.5 rounded">
																			{(((item.price - item.cost) / item.price) * 100).toFixed(0)}%
																		</div>
																	</>
																)}
															</div>
														</div>
														<div className="flex flex-1 flex-grow flex-row items-left">
															<div className="border-s-1 border-[var(--secondary)]/50 pl-4 h-12 text-center text-sm text-[var(--secondary)] opacity-70 items-center flex flex-1">
																{
																	item.description ? (
																		item.description
																	) : (
																		<span className="text-gray-400">No item description</span>
																	)
																}
															</div>
															<div className="flex flex-col items-center justify-center">
																{/* Low Stock Warning */}
																{item.stock <= 5 && (
																	<div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
																		<div className="flex items-center gap-3">
																			<svg
																				className="w-5 h-5 text-yellow-600"
																				fill="currentColor"
																				viewBox="0 0 20 20"
																			>
																				<path
																					fillRule="evenodd"
																					d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
																					clipRule="evenodd"
																				/>
																			</svg>
																			<span className="text-sm text-yellow-700 font-medium">
																				Low stock warning!
																				Only {item.stock}{" "}
																				left.
																			</span>
																		</div>
																	</div>
																)}
															</div>
														</div>
														<div className="flex flex-col items-center justify-center">
															<div className="flex items-center gap-2 px-4">
																<div
																	className="w-3 h-3 rounded-full"
																	style={{
																		backgroundColor:
																			getCategoryColor(
																				categories,
																				item.categoryId
																			),
																	}}
																></div>
																<span className="text-sm text-[var(--secondary)] opacity-70">
																	{getCategoryName(
																		categories,
																		item.categoryId
																	)}
																</span>
															</div>
														</div>
													</div>
												</div>

												{/* Stock Display and Controls */}
												<div className="flex items-center gap-6 flex-shrink-0 ml-4">
													{/* Current Stock Display */}
													<div className="text-center">
														<div className="text-sm text-[var(--secondary)] opacity-70 mb-1">
															Stock
														</div>
														<div className="text-2xl font-bold text-[var(--secondary)]">
															{item.stock}
														</div>
													</div>

													{/* Edit Button */}
													<div>
														<button
															onClick={() =>
																openEditModal(
																	item
																)
															}
															className="px-4 py-4 bg-[var(--light-accent)] shadow-none hover:shadow-md hover:bg-[var(--accent)]/80 rounded-[4px] transition-all hover:scale-105 active:scale-95"
														>
															<EditIcon />
														</button>
													</div>
												</div>
											</div>
										</div>
									))
								)}
							</div>
						</div>
					</div>
				)}

				{/* Modal Components */}
				<EditItemModal
					isOpen={showEditModal}
					editingItem={editingItem}
					categories={categories}
					items={items}
					onClose={closeEditModal}
					onError={handleError}
				/>
				
				<AddItemModal
					isOpen={showItemForm}
					categories={categories}
					onClose={() => setShowItemForm(false)}
					onError={handleError}
				/>
				
				<AddCategoryModal
					isOpen={showCategoryForm}
					onClose={() => setShowCategoryForm(false)}
					onError={handleError}
				/>
					</>
				)}
			</div>
		</div>
	);
}
