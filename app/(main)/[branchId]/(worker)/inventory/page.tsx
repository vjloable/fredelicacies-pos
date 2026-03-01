"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import EditItemModal from "./components/EditItemModal";
import AddItemModal from "./components/AddItemModal";
import AddCategoryModal from "./components/AddCategoryModal";
import BundlesView from "./components/BundlesView";
import type { InventoryItem, Category } from "@/types/domain";
import { subscribeToInventoryItems } from "@/services/inventoryService";
import {
	subscribeToCategories,
	getCategoryColor,
	deleteCategory,
} from "@/services/categoryService";
import { useBranch } from "@/contexts/BranchContext";
import EditIcon from "../store/icons/EditIcon";
import PlusIcon from "../../../../../components/icons/PlusIcon";
import DeleteIcon from "../store/icons/DeleteIcon";
import { formatCurrency } from "@/lib/currency_formatter";
import EmptyInventory from "./illustrations/EmptyInventory";
import InventoryIcon from "@/components/icons/SidebarNav/InventoryIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import { usePOSAccessControl } from "@/contexts/TimeTrackingContext";

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
	const { canAccessPOS } = usePOSAccessControl(currentBranch?.id); // Get POS access control
	const [activeTab, setActiveTab] = useState<'items' | 'bundles'>('items');
	const [showCategoryForm, setShowCategoryForm] = useState(false);
	const [showItemForm, setShowItemForm] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
		null
	);
	const [editingItem, setEditingItem] = useState<Item | null>(null);
	const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
	const [newItem, setNewItem] = useState({
		name: "",
		price: "",
		categoryId: "",
		stock: "",
		description: "",
		imgUrl: "",
	});

	// Ensure we're on the client before running data subscriptions
	useEffect(() => {
		setIsClient(true);
	}, []);

	// Set up real-time subscription to categories
	useEffect(() => {
		if (!isClient || !currentBranch) return;

		const unsubscribe = subscribeToCategories(currentBranch.id, (categories: Category[]) => {
			setCategories(categories);
			// Set default category if none selected
			if (categories.length > 0 && !newItem.categoryId) {
				setNewItem((prev) => ({
					...prev,
					categoryId: categories[0].id!,
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
			(items: InventoryItem[]) => {
				console.log(
					"Inventory items received in inventory page:",
					items.length,
					"items"
				);

				// Ensure all items have IDs
				const localItems: InventoryItem[] = items.map(
					(item: InventoryItem) => ({
						...item,
						id: item.id!,
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

	const openEditModal = (item: InventoryItem) => {
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
			(item) => item.category_id === category.id
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

	const toggleExpandItem = (id: string) => {
		setExpandedItems(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});
	};

	return (
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
						<LoadingSpinner size="md"/>
						<span className='ml-3 text-secondary'>
							Initializing...
						</span>
					</div>
				) : (
					<>
						{/* Error Display */}
						{error && (
							<div className='mx-6 mb-4 p-2 bg-error/10 border border-error/40 rounded-lg'>
								<div className='flex items-center gap-3'>
									<svg
										className='w-5 h-5 text-error'
										fill='currentColor'
										viewBox='0 0 20 20'>
										<path
											fillRule='evenodd'
											d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
											clipRule='evenodd'
										/>
									</svg>
									<span className='text-error font-medium text-3'>
										{error}
									</span>
									<button
										onClick={() => setError(null)}
										className='ml-auto text-error hover:text-error/20'>
										<DeleteIcon />
									</button>
								</div>
							</div>
						)}

						{/* Loading State */}
						{loading && (
							<div className='flex items-center justify-center py-8'>
								<LoadingSpinner size="md"/>
								<span className='ml-3 text-secondary'>
									Loading inventory...
								</span>
							</div>
						)}

						{/* Main Content - Scrollable */}
						{!loading && (
							<div className='flex-1 px-6 overflow-y-auto pb-6'>
								{/* Tab Navigation */}
								<div className='flex gap-2 mb-4'>
									<button
										onClick={() => setActiveTab('items')}
										className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
											activeTab === 'items'
												? 'bg-accent text-primary text-shadow-lg'
												: 'bg-gray-200 text-secondary hover:bg-gray-300'
										}`}
									>
										Pieces
									</button>
									<button
										onClick={() => setActiveTab('bundles')}
										className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
											activeTab === 'bundles'
												? 'bg-amber-500 text-white'
												: 'bg-gray-200 text-secondary hover:bg-gray-300'
										}`}
									>
										Bundles
									</button>
								</div>

								{/* Items View */}
								{activeTab === 'items' && (
									<>
										{/* Categories Section */}
										<div className='mb-4'>
									<div className='flex items-center justify-between mb-3'>
										<h2 className='text-base font-semibold text-secondary'>
											Categories
										</h2>
										<button
											onClick={() => setShowCategoryForm(true)}
											className={`bg-accent text-secondary text-3 px-4 py-2 rounded-lg 
														hover:bg-accent/90 transition-all font-semibold shadow-sm hover:scale-105 active:scale-95
														${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`
													}>
											<div className='flex flex-row items-center gap-2 text-primary text-shadow-lg font-black text-3'>
												<div className='w-4 h-4'>
													<PlusIcon className='drop-shadow-lg' />
												</div>
												<span className='mt-0.5'>ADD CATEGORY</span>
											</div>
										</button>
									</div>

									{/* Categories List - Compact Horizontal Layout */}
									<div className={`flex flex-wrap gap-2 ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}>
										{categories.map((category) => (
											<div
												key={category.id}
												className='inline-flex items-center gap-2 bg-primary px-3 py-2 rounded-lg border border-gray-200 group hover:border-gray-300 transition-colors'>
												<div
													className=' w-3 h-3 rounded-full'
													style={{
														backgroundColor: category.color,
													}}
												/>
												<span className='text-xs font-medium text-secondary'>
													{category.name}
												</span>
												<button
													onClick={() => handleDeleteCategory(category)}
													className='w-0 opacity-0 group-hover:w-4.5 group-hover:opacity-100 bg-transparent text-transparent group-hover:text-error group-hover:bg-error/40 rounded-md border transition-all duration-200'
													title='Delete category'>
													<DeleteIcon className='w-4 h-4' />
												</button>
											</div>
										))}
									</div>
								</div>

								{/* Items Section */}
								<div>
									<div className='flex items-center justify-between mb-3'>
										<h2 className='text-lg font-semibold text-secondary'>
											Items
										</h2>
										<button
											onClick={() => setShowItemForm(true)}
											className={`bg-accent text-secondary text-3 px-4 py-2 
														rounded-lg hover:bg-accent/90 shadow-sm transition-all 
														font-semibold hover:scale-105 active:scale-95
														${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`
													}>
											<div className='flex flex-row items-center gap-2 text-primary text-shadow-md font-black text-3'>
												<div className='size-4'>
													<PlusIcon className='drop-shadow-lg' />
												</div>
												<span className='mt-0.5'>ADD ITEM</span>
											</div>
										</button>
									</div>

									{/* Items List */}
									<div className={`space-y-1 ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}>
										{items.length === 0 ? (
											/* Empty State */
											<div className='text-center py-16 px-4'>
												<div className='w-90 mb-4 mx-auto opacity-50 flex items-center justify-center'>
													<EmptyInventory />
												</div>
												<h3 className='text-4 font-semibold text-secondary mb-3'>
													No Items in Inventory
												</h3>
												<p className='w-75 text-3 text-secondary opacity-70 mb-6 max-w-md mx-auto'>
													Start by adding your first item to begin managing
													your products and stock levels.
												</p>
												<button
													onClick={() => setShowItemForm(true)}
													className='text-3 inline-flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent/90 transition-all font-black text-shadow-lg hover:scale-105 active:scale-95'>
													<PlusIcon className='w-4 h-4 drop-shadow-md' />
													<span className='mt-0.5'>
														ADD YOUR FIRST ITEM
													</span>
												</button>

												{/* Quick Setup Guide */}
												<div className='mt-15 max-w-2xl mx-auto'>
													<div className='bg-secondary/5 border border-secondary/10 rounded-xl p-6'>
														<h4 className='text-base font-semibold text-secondary/50 mb-4 flex items-center gap-2'>
															<svg
																className='w-5 h-5 text-secondary/50'
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
																<div className='w-10 h-10 bg-secondary/10 rounded-lg mx-auto mb-3 flex items-center justify-center'>
																	<span className='text-secondary font-bold'>
																		1
																	</span>
																</div>
																<h5 className='text-3 font-medium text-secondary/80 mb-1'>
																	Create Categories
																</h5>
																<p className='text-3 text-secondary opacity-80'>
																	Organize your products by type
																</p>
															</div>
															<div className='text-center'>
																<div className='w-10 h-10 bg-secondary/10 rounded-lg mx-auto mb-3 flex items-center justify-center'>
																	<span className='text-secondary font-bold'>
																		2
																	</span>
																</div>
																<h5 className='text-3 font-medium text-secondary/80 mb-1'>
																	Add Items
																</h5>
																<p className='text-3 text-secondary] opacity-80'>
																	Set prices and stock levels
																</p>
															</div>
															<div className='text-center'>
																<div className='w-10 h-10 bg-secondary/10 rounded-lg mx-auto mb-3 flex items-center justify-center'>
																	<span className='text-secondary font-bold'>
																		3
																	</span>
																</div>
																<h5 className='text-3 font-medium text-secondary/80 mb-1'>
																	Manage Stock
																</h5>
																<p className='text-3 text-secondary opacity-80'>
																	Track and update inventory
																</p>
															</div>
														</div>
													</div>
												</div>
											</div>
										) : (
											/* Items List */
											items.map((item) => {
												const isExpanded = expandedItems.has(item.id);
												return (
													<div key={item.id} className='bg-primary rounded-lg border border-gray-100 overflow-hidden'>
														{/* Main row */}
														<div className='flex items-center gap-2 px-2 py-1.5'>
															<span className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: getCategoryColor(categories, item.category_id || '') }} />
															<div className='w-8 h-8 rounded bg-gray-100 shrink-0 overflow-hidden relative flex items-center justify-center'>
																{item.img_url ? (
																	<Image src={item.img_url} alt={item.name} width={32} height={32} className='w-full h-full object-cover' />
																) : (
																	<svg className='w-4 h-4 text-gray-400' fill='currentColor' viewBox='0 0 20 20'>
																		<path fillRule='evenodd' d='M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z' clipRule='evenodd' />
																	</svg>
																)}
															</div>
															<span className='text-xs font-semibold text-secondary truncate flex-1 min-w-0'>{item.name}</span>
															<span className='text-xs text-secondary/60 shrink-0 tabular-nums'>{formatCurrency(item.price)}</span>
															<span className={`text-xs font-bold shrink-0 w-8 text-center tabular-nums ${
																item.stock === 0 ? 'text-error' : item.stock <= 5 ? 'text-accent' : 'text-secondary/50'
															}`}>{item.stock}</span>
															<button onClick={() => openEditModal(item)} className='shrink-0 p-1.5 hover:bg-light-accent rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'>
																<EditIcon className='w-4 h-4' />
															</button>
															<button onClick={() => toggleExpandItem(item.id)} className='shrink-0 p-1.5 hover:bg-gray-100 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'>
																<svg className={`w-3 h-3 text-secondary/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
																</svg>
															</button>
														</div>
														{/* Retractable details */}
														{isExpanded && (
															<div className='px-3 pb-2 pt-2 border-t border-gray-100 ml-11 flex flex-wrap gap-x-4 gap-y-1'>
																{item.description ? (
																	<p className='text-xs text-secondary/60 w-full'>{item.description}</p>
																) : (
																	<p className='text-xs text-secondary/30 italic w-full'>No description</p>
																)}
																{item.cost && item.cost > 0 && (
																	<span className='text-xs text-secondary/60'>Cost: {formatCurrency(item.cost)}</span>
																)}
																{item.cost && item.cost > 0 && (
																	<span className='text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded'>
																		{(((item.price - item.cost) / item.price) * 100).toFixed(0)}% margin
																	</span>
																)}
																{item.stock <= 5 && (
																	<span className={`text-xs font-medium ${item.stock === 0 ? 'text-error' : 'text-accent'}`}>
																		{item.stock === 0 ? 'Out of stock' : `Only ${item.stock} left`}
																	</span>
																)}
															</div>
														)}
													</div>
												);
											})
										)}
									</div>
								</div>
								</>
							)}

							{/* Bundles View */}
							{activeTab === 'bundles' && (
								<BundlesView />
							)}
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
						branchId={currentBranch?.id || ''}
						isOpen={showCategoryForm}
						onClose={() => setShowCategoryForm(false)}
						onError={handleError}
					/>

						{/* Delete Confirmation Modal */}
						{showDeleteConfirm && categoryToDelete && (
							<div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
								<div className='bg-white rounded-lg max-w-md w-full p-6'>
									<div className='w-16 h-16 bg-error/20 rounded-xl mx-auto mb-4 flex items-center justify-center'>
										<svg
											className='w-8 h-8 text-error'
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
									<h3 className='text-lg text-center font-bold text-secondary mb-2'>
										Delete Category
									</h3>
									<p className='text-secondary opacity-70 mb-6'>
										Are you sure you want to delete the category{" "}
										<span
											className='px-2 text-primary rounded-full'
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
											className='flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-secondary rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'>
											Cancel
										</button>
										<button
											onClick={confirmDeleteCategory}
											className='flex-1 py-3 bg-error hover:bg-error/50 text-white rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'>
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
	);
}
