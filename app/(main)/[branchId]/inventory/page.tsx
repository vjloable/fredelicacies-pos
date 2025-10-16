"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import EditItemModal from "./components/EditItemModal";
import AddItemModal from "./components/AddItemModal";
import AddCategoryModal from "./components/AddCategoryModal";
import { InventoryItem } from "@/services/inventoryService";
import { subscribeToInventoryItems } from "@/stores/dataStore";
import {
	Category,
	subscribeToCategories,
	getCategoryColor,
	deleteCategory,
} from "@/services/categoryService";
import { useBranch } from "@/contexts/BranchContext";
import EditIcon from "../store/icons/EditIcon";
import PlusIcon from "../../../../components/icons/PlusIcon";
import DeleteIcon from "../store/icons/DeleteIcon";
import { formatCurrency } from "@/lib/currency_formatter";
import EmptyInventory from "./illustrations/EmptyInventory";
import InventoryIcon from "@/components/icons/SidebarNav/InventoryIcon";
import ViewOnlyWrapper from "@/components/ViewOnlyWrapper";

interface Item extends InventoryItem {
	id: string; // Make id required for local state
}

export default function InventoryScreen() {
	const { currentBranch } = useBranch(); // Get current branch context
	const [categories, setCategories] = useState<Category[]>([]);
	const [items, setItems] = useState<Item[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isClient, setIsClient] = useState(false);

	const [showCategoryForm, setShowCategoryForm] = useState(false);
	const [showItemForm, setShowItemForm] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
		null
	);
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
		if (!isClient || !currentBranch) return;

		setLoading(true);
		setError(null);
		console.log("Setting up inventory subscription in inventory page...");

		const unsubscribe = subscribeToInventoryItems(
			currentBranch.id,
			(firestoreItems: InventoryItem[]) => {
				console.log(
					"Inventory items received in inventory page:",
					firestoreItems.length,
					"items"
				);

				// Convert Firestore items to local Item type
				const localItems: Item[] = firestoreItems.map(
					(item: InventoryItem) => ({
						...item,
						id: item.id!, // We know id exists from Firestore
					})
				);

				setItems(localItems);
				setLoading(false);
			}
		);

		// Add timeout fallback for inventory page
		const timeoutId = setTimeout(() => {
			console.warn(
				"⏰ Inventory subscription timeout in inventory page - stopping loading"
			);
			setLoading(false);
		}, 15000); // 15 second timeout for inventory page

		return () => {
			clearTimeout(timeoutId);
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [isClient, currentBranch]);

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

	const handleDeleteCategory = (category: Category) => {
		// Check if category has items
		const categoryItems = items.filter(
			(item) => item.categoryId === category.id
		);
		if (categoryItems.length > 0) {
			setError(
				`Cannot delete category "${category.name}" because it has ${
					categoryItems.length
				} item${
					categoryItems.length > 1 ? "s" : ""
				}. Please move or delete all items in this category first.`
			);
			return;
		}

		setCategoryToDelete(category);
		setShowDeleteConfirm(true);
	};

	const confirmDeleteCategory = async () => {
		if (!categoryToDelete?.id) return;

		try {
			await deleteCategory(categoryToDelete.id);
			setShowDeleteConfirm(false);
			setCategoryToDelete(null);
		} catch (error) {
			console.error("Error deleting category:", error);
			setError("Failed to delete category. Please try again.");
		}
	};

	const cancelDeleteCategory = () => {
		setShowDeleteConfirm(false);
		setCategoryToDelete(null);
	};

	return (
		<ViewOnlyWrapper branchId={currentBranch?.id} pageName='inventory'>
			<div className='flex h-full overflow-hidden'>
				{/* Main Content Area */}
				<div className='flex flex-col flex-1 h-full overflow-hidden'>
					{/* Header Section - Fixed */}
					{/* Mobile/Tablet TopBar - visible below xl: breakpoint (< 1280px) */}
					<div className='xl:hidden w-full'>
						<MobileTopBar title='Inventory' icon={<InventoryIcon />} />
					</div>
					{/* Desktop TopBar - visible at xl: breakpoint and above (≥ 1280px) */}
					<div className='hidden xl:block w-full'>
						<TopBar title='Inventory' icon={<InventoryIcon />} />
					</div>
					<span className='flex h-6'></span>

					{/* Show loading until client is ready */}
					{!isClient ? (
						<div className='flex items-center justify-center py-8'>
							<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]'></div>
							<span className='ml-3 text-[var(--secondary)]'>
								Initializing...
							</span>
						</div>
					) : (
						<>
							{/* Error Display */}
							{error && (
								<div className='mx-6 mb-4 p-2 bg-[var(--error)]/10 border border-[var(--error)]/40 rounded-lg'>
									<div className='flex items-center gap-3'>
										<svg
											className='w-5 h-5 text-[var(--error)]'
											fill='currentColor'
											viewBox='0 0 20 20'>
											<path
												fillRule='evenodd'
												d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
												clipRule='evenodd'
											/>
										</svg>
										<span className='text-[var(--error)] font-medium text-[12px]'>
											{error}
										</span>
										<button
											onClick={() => setError(null)}
											className='ml-auto text-[var(--error)] hover:text-[var(--error)]/20'>
											<DeleteIcon />
										</button>
									</div>
								</div>
							)}

							{/* Loading State */}
							{loading && (
								<div className='flex items-center justify-center py-8'>
									<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-dashed border-[var(--accent)]'></div>
									<span className='ml-3 text-[var(--secondary)]'>
										Loading inventory...
									</span>
								</div>
							)}

							{/* Main Content - Scrollable */}
							{!loading && (
								<div className='flex-1 px-6 overflow-y-auto pb-6'>
									{/* Categories Section */}
									<div className='mb-6'>
										<div className='flex items-center justify-between mb-3'>
											<h2 className='text-lg font-semibold text-[var(--secondary)]'>
												Categories
											</h2>
											<button
												onClick={() => setShowCategoryForm(true)}
												className='bg-[var(--accent)] text-[var(--secondary)] text-[12px] px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 transition-all font-semibold shadow-sm hover:scale-105 active:scale-95'>
												<div className='flex flex-row items-center gap-2 text-[var(--primary)] text-shadow-lg font-black text-[14px]'>
													<div className='w-4 h-4'>
														<PlusIcon className='drop-shadow-lg' />
													</div>
													<span className='mt-[2px]'>ADD CATEGORY</span>
												</div>
											</button>
										</div>

										{/* Categories List - Compact Horizontal Layout */}
										<div className='flex flex-wrap gap-2'>
											{categories.map((category) => (
												<div
													key={category.id}
													className='inline-flex items-center gap-2 bg-[var(--primary)] px-3 py-2 rounded-lg border border-gray-200 group hover:border-gray-300 transition-colors'>
													<div
														className=' w-3 h-3 rounded-full'
														style={{
															backgroundColor: category.color,
														}}
													/>
													<span className='text-sm font-medium text-[var(--secondary)]'>
														{category.name}
													</span>
													<button
														onClick={() => handleDeleteCategory(category)}
														className='w-0 opacity-0 group-hover:w-[18px] group-hover:opacity-100 bg-transparent text-transparent group-hover:text-[var(--error)] group-hover:bg-[var(--error)]/40 rounded-md border transition-all duration-200'
														title='Delete category'>
														<DeleteIcon className='w-4 h-4' />
													</button>
												</div>
											))}
										</div>
									</div>

									{/* Items Section */}
									<div>
										<div className='flex items-center justify-between mb-4'>
											<h2 className='text-xl font-semibold text-[var(--secondary)]'>
												Items
											</h2>
											<button
												onClick={() => setShowItemForm(true)}
												className='bg-[var(--accent)] text-[var(--secondary)] text-[12px] px-4 py-2 rounded-lg hover:bg-[var(--accent)]/90 shadow-sm transition-all font-semibold hover:scale-105 active:scale-95'>
												<div className='flex flex-row items-center gap-2 text-[var(--primary)] text-shadow-md font-black text-[14px]'>
													<div className='size-4'>
														<PlusIcon className='drop-shadow-lg' />
													</div>
													<span className='mt-[2px]'>ADD ITEM</span>
												</div>
											</button>
										</div>

										{/* Items List */}
										<div className='space-y-3'>
											{items.length === 0 ? (
												/* Empty State */
												<div className='text-center py-16 px-4'>
													<div className='w-[360px] mb-4 mx-auto opacity-50 flex items-center justify-center'>
														<EmptyInventory />
													</div>
													<h3 className='text-[18px] font-semibold text-[var(--secondary)] mb-3'>
														No Items in Inventory
													</h3>
													<p className='w-[300px] text-[12px] text-[var(--secondary)] opacity-70 mb-6 max-w-md mx-auto'>
														Start by adding your first item to begin managing
														your products and stock levels.
													</p>
													<button
														onClick={() => setShowItemForm(true)}
														className='text-[14px] inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-[8px] hover:bg-[var(--accent)]/90 transition-all font-black text-shadow-lg hover:scale-105 active:scale-95'>
														<PlusIcon className='w-4 h-4 drop-shadow-md' />
														<span className='mt-[2px]'>
															ADD YOUR FIRST ITEM
														</span>
													</button>

													{/* Quick Setup Guide */}
													<div className='mt-[60px] max-w-2xl mx-auto'>
														<div className='bg-[var(--secondary)]/5 border border-[var(--secondary)]/10 rounded-xl p-6'>
															<h4 className='text-lg font-semibold text-[var(--secondary)]/50 mb-4 flex items-center gap-2'>
																<svg
																	className='w-5 h-5 text-[var(--secondary)]/50'
																	fill='none'
																	stroke='currentColor'
																	viewBox='0 0 24 24'>
																	<path
																		strokeLinecap='round'
																		strokeLinejoin='round'
																		strokeWidth={2}
																		d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
																	/>
																</svg>
																Quick Setup Guide
															</h4>
															<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
																<div className='text-center'>
																	<div className='w-10 h-10 bg-[var(--secondary)]/10 rounded-lg mx-auto mb-3 flex items-center justify-center'>
																		<span className='text-[var(--secondary)] font-bold'>
																			1
																		</span>
																	</div>
																	<h5 className='text-[14px] font-medium text-[var(--secondary)]/80 mb-1'>
																		Create Categories
																	</h5>
																	<p className='text-[12px] text-[var(--secondary)] opacity-80'>
																		Organize your products by type
																	</p>
																</div>
																<div className='text-center'>
																	<div className='w-10 h-10 bg-[var(--secondary)]/10 rounded-lg mx-auto mb-3 flex items-center justify-center'>
																		<span className='text-[var(--secondary)] font-bold'>
																			2
																		</span>
																	</div>
																	<h5 className='text-[14px] font-medium text-[var(--secondary)]/80 mb-1'>
																		Add Items
																	</h5>
																	<p className='text-[12px] text-[var(--secondary)]] opacity-80'>
																		Set prices and stock levels
																	</p>
																</div>
																<div className='text-center'>
																	<div className='w-10 h-10 bg-[var(--secondary)]/10 rounded-lg mx-auto mb-3 flex items-center justify-center'>
																		<span className='text-[var(--secondary)] font-bold'>
																			3
																		</span>
																	</div>
																	<h5 className='text-[14px] font-medium text-[var(--secondary)]/80 mb-1'>
																		Manage Stock
																	</h5>
																	<p className='text-[12px] text-[var(--secondary)] opacity-80'>
																		Track and update inventory
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
														className='bg-[var(--primary)] p-2 rounded-lg border border-gray-200'>
														<div className='flex items-center justify-between w-full'>
															<div className='flex items-center gap-2 flex-1 min-w-0 flex-row'>
																<div
																	className='w-1 h-[56px] rounded-full'
																	style={{
																		backgroundColor: getCategoryColor(
																			categories,
																			item.categoryId
																		),
																	}}
																/>
																<div className='w-[120px] h-[120px] md:w-[56px] md:h-[56px] bg-gray-100 rounded-[3px] flex items-center justify-center flex-shrink-0 overflow-hidden relative'>
																	{item.imgUrl ? (
																		<Image
																			src={item.imgUrl}
																			alt={item.name}
																			width={48}
																			height={48}
																			className='w-full h-full object-cover'
																		/>
																	) : (
																		<svg
																			className='w-6 h-6 text-gray-400'
																			fill='currentColor'
																			viewBox='0 0 20 20'>
																			<path
																				fillRule='evenodd'
																				d='M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z'
																				clipRule='evenodd'
																			/>
																		</svg>
																	)}
																</div>
																<div className='flex flex-1 gap-4 h-[100px] md:h-12 flex-shrink truncate'>
																	<div className='flex flex-grow md:flex-grow-0 flex-col items-start justify-center w-auto xl:w-[400px] line-clamp-2'>
																		<h3 className='leading-tight font-semibold text-[var(--secondary)] text-[14px] text-wrap line-clamp-2 md:truncate text-left w-full'>
																			{item.name}
																		</h3>
																		<div className='flex items-center w-full'>
																			<div className='font-regular text-[var(--secondary)] w-[100px] text-[12px]'>
																				Price: {formatCurrency(item.price)}
																			</div>
																			{item.cost && item.cost > 0 && (
																				<div className='items-center justify-start gap-1 w-0 md:w-[180px] hidden md:flex'>
																					<div className='text-xs text-[var(--secondary)]'>
																						Cost: {formatCurrency(item.cost)}
																					</div>
																					<div className='text-[12px] text-green-600 bg-green-50 px-1 py-0.5 rounded'>
																						{(
																							((item.price - item.cost) /
																								item.price) *
																							100
																						).toFixed(0)}
																						%
																					</div>
																				</div>
																			)}
																		</div>
																		<div className='text-xs text-[var(--secondary)] flex md:hidden'>
																			Stock: {item.stock}
																		</div>
																		{/* Small Screen Edit Button */}
																		<div className='flex md:hidden justify-center mt-2'>
																			<button
																				onClick={() => openEditModal(item)}
																				className='w-full px-2 py-1 text-[12px] font-bold bg-[var(--accent)] shadow-none hover:shadow-md hover:bg-[var(--accent)]/80 rounded-[4px] transition-all hover:scale-105 active:scale-95'>
																				EDIT
																			</button>
																		</div>
																	</div>
																	<div className='flex-1 flex-grow flex-row items-left w-0 hidden xl:w-[300px] xl:flex'>
																		<div className='border-s-2 border-[var(--secondary)]/10 pl-4 h-12 text-left text-sm text-[var(--secondary)] opacity-70 items-center flex flex-1 truncate'>
																			{item.description ? (
																				item.description
																			) : (
																				<span className='text-gray-400'>
																					No item description
																				</span>
																			)}
																		</div>
																		<div className='flex-col items-center justify-center hidden xl:flex'>
																			{/* Low Stock Warning */}
																			{item.stock <= 5 && (
																				<div
																					className={`p-3 ${
																						item.stock !== 0
																							? "bg-[var(--accent)]/10"
																							: "bg-[var(--error)]/10"
																					} border ${
																						item.stock !== 0
																							? "border-[var(--accent)]"
																							: "border-[var(--error)]"
																					} rounded-lg`}>
																					<div className='flex items-center gap-3'>
																						<svg
																							className={`w-4 h-4 ${
																								item.stock !== 0
																									? "text-[var(--accent)]"
																									: "text-[var(--error)]"
																							}`}
																							fill='currentColor'
																							viewBox='0 0 20 20'>
																							<path
																								fillRule='evenodd'
																								d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
																								clipRule='evenodd'
																							/>
																						</svg>
																						<span
																							className={`text-[10px] ${
																								item.stock !== 0
																									? "text-[var(--secondary)]"
																									: "text-[var(--secondary)]"
																							} font-medium hidden w-0 2xl:inline 2xl:w-auto transition-all duration-400`}>
																							{item.stock !== 0
																								? `Only ${item.stock} stocks left`
																								: "No stocks left "}
																						</span>
																					</div>
																				</div>
																			)}
																		</div>
																	</div>
																</div>
															</div>

															{/* Stock Display and Controls */}
															<div className='items-center gap-6 flex-shrink-0 ml-4 hidden md:flex'>
																{/* Current Stock Display */}
																<div className='text-center'>
																	<div className='text-sm text-[var(--secondary)] opacity-70 mb-1'>
																		Stock
																	</div>
																	<div className='text-2xl font-bold text-[var(--secondary)]'>
																		{item.stock}
																	</div>
																</div>

																{/* Edit Button */}
																<div>
																	<button
																		onClick={() => openEditModal(item)}
																		className='px-4 py-4 bg-[var(--light-accent)] shadow-none hover:shadow-md hover:bg-[var(--accent)]/80 rounded-[4px] transition-all hover:scale-105 active:scale-95'>
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

							{/* Delete Confirmation Modal */}
							{showDeleteConfirm && categoryToDelete && (
								<div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
									<div className='bg-white rounded-lg max-w-md w-full p-6'>
										<div className='w-16 h-16 bg-[var(--error)]/20 rounded-xl mx-auto mb-4 flex items-center justify-center'>
											<svg
												className='w-8 h-8 text-[var(--error)]'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16'
												/>
											</svg>
										</div>
										<h3 className='text-xl text-center font-bold text-[var(--secondary)] mb-2'>
											Delete Category
										</h3>
										<p className='text-[var(--secondary)] opacity-70 mb-6'>
											Are you sure you want to delete the category{" "}
											<span
												className='px-2 text-[var(--primary)] rounded-full'
												style={{
													backgroundColor: `${categoryToDelete.color}`,
												}}>
												{categoryToDelete.name}
											</span>
											? This action cannot be undone.
										</p>
										<div className='flex gap-3'>
											<button
												onClick={cancelDeleteCategory}
												className='flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-[var(--secondary)] rounded-xl font-semibold transition-all hover:scale-105 active:scale-95'>
												Cancel
											</button>
											<button
												onClick={confirmDeleteCategory}
												className='flex-1 py-3 bg-[var(--error)] hover:bg-[var(--error)]/50 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95'>
												Delete
											</button>
										</div>
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</ViewOnlyWrapper>
	);
}
