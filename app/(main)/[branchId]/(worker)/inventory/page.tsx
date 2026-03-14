"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import EditItemModal from "./components/EditItemModal";
import AddItemModal from "./components/AddItemModal";
import AddCategoryModal from "./components/AddCategoryModal";
import BundlesView from "./components/BundlesView";
import type { InventoryItem, Category } from "@/types/domain";
import { subscribeToInventoryItems, updateInventoryItem } from "@/services/inventoryService";
import { logActivity } from "@/services/activityLogService";
import { recordWastage } from "@/services/wastageService";
import { useAuth } from "@/contexts/AuthContext";
import {
	subscribeToCategories,
	getCategoryColor,
	deleteCategory,
	updateCategory,
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
	id: string;
}

// Tag/categories icon for mobile button
function CategoriesIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
		</svg>
	);
}

export default function InventoryScreen() {
	const { currentBranch } = useBranch();
	const { user } = useAuth();
	const [categories, setCategories] = useState<Category[]>([]);
	const [items, setItems] = useState<Item[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isClient, setIsClient] = useState(false);
	const { canAccessPOS } = usePOSAccessControl(currentBranch?.id);
	const [activeTab, setActiveTab] = useState<'items' | 'bundles'>('items');
	const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
	const [showCategoriesPane, setShowCategoriesPane] = useState(false);
	const [showCategoryForm, setShowCategoryForm] = useState(false);
	const [editingCategory, setEditingCategory] = useState<Category | null>(null);
	const [showItemForm, setShowItemForm] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
	const [editingItem, setEditingItem] = useState<Item | null>(null);
	const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
	const [destockMode, setDestockMode] = useState(false);
	const [selectedForDestock, setSelectedForDestock] = useState<Set<string>>(new Set());
	const [showDestockConfirm, setShowDestockConfirm] = useState(false);
	const [destocking, setDestocking] = useState(false);
	const [newItem, setNewItem] = useState({
		name: "",
		price: "",
		categoryId: "",
		stock: "",
		description: "",
		imgUrl: "",
	});

	useEffect(() => {
		setIsClient(true);
	}, []);

	useEffect(() => {
		if (!isClient || !currentBranch) return;

		const unsubscribe = subscribeToCategories(currentBranch.id, (cats: Category[]) => {
			setCategories(cats);
			if (cats.length > 0 && !newItem.categoryId) {
				setNewItem((prev) => ({ ...prev, categoryId: cats[0].id! }));
			}
		});

		return () => { if (unsubscribe) unsubscribe(); };
	}, [isClient, currentBranch?.id, newItem.categoryId]);

	useEffect(() => {
		if (!isClient || !currentBranch) return;

		setLoading(true);
		setError(null);

		const unsubscribe = subscribeToInventoryItems(
			currentBranch.id,
			(items: InventoryItem[]) => {
				setItems(items.map((item: InventoryItem) => ({ ...item, id: item.id! })));
				setLoading(false);
			}
		);

		const timeoutId = setTimeout(() => { setLoading(false); }, 15000);

		return () => {
			clearTimeout(timeoutId);
			if (unsubscribe) unsubscribe();
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
		const categoryItems = items.filter((item) => item.category_id === category.id);
		if (categoryItems.length > 0) {
			setError(
				`Cannot delete category "${category.name}" because it has ${categoryItems.length} item${categoryItems.length > 1 ? "s" : ""}. Please move or delete all items in this category first.`
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
			if (activeCategoryId === categoryToDelete.id) setActiveCategoryId(null);
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

	const toggleCategoryVisibility = async (cat: Category) => {
		await updateCategory(cat.id!, { is_hidden: !cat.is_hidden });
	};

	const toggleExpandItem = (id: string) => {
		setExpandedItems(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});
	};

	const toggleDestockSelection = (id: string) => {
		setSelectedForDestock(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});
	};

	const confirmDestock = async () => {
		if (!currentBranch || selectedForDestock.size === 0) return;
		setDestocking(true);
		const selectedItems = items.filter(item => selectedForDestock.has(item.id));
		const wastageItems: { item_id: string; item_name: string; quantity_wasted: number; cost_per_unit: number }[] = [];
		for (const item of selectedItems) {
			const oldStock = item.stock;
			const { error: updateError } = await updateInventoryItem(item.id, { stock: 0 });
			if (!updateError && oldStock > 0) {
				void logActivity({
					branchId: currentBranch.id,
					userId: user?.id ?? null,
					action: 'stock_removed',
					entityType: 'inventory',
					entityId: item.id,
					details: { item_name: item.name, old_stock: oldStock, new_stock: 0, delta: oldStock },
				});
				wastageItems.push({ item_id: item.id, item_name: item.name, quantity_wasted: oldStock, cost_per_unit: item.price });
			}
		}
		if (wastageItems.length > 0) {
			void recordWastage(currentBranch.id, user?.id ?? null, wastageItems);
		}
		setDestocking(false);
		setShowDestockConfirm(false);
		setSelectedForDestock(new Set());
		setDestockMode(false);
	};

	// Filtered items based on active category
	const filteredItems = activeCategoryId
		? items.filter(item => item.category_id === activeCategoryId)
		: items;

	// Categories side pane inner content (shared desktop + mobile)
	const categoriesPaneContent = (
		<>
			{/* Header */}
			<div className='flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0'>
				<span className='text-3.5 font-bold text-secondary uppercase tracking-wide'>Categories</span>
				<button
					onClick={() => { setEditingCategory(null); setShowCategoryForm(true); }}
					className={`w-8 h-8 flex items-center justify-center bg-accent/10 hover:bg-accent/20 text-accent rounded-lg transition-all ${!canAccessPOS ? 'opacity-50 pointer-events-none' : ''}`}
					title='Add category'
				>
					<PlusIcon className='w-4 h-4' />
				</button>
			</div>

			{/* List */}
			<div className='flex-1 min-h-0 overflow-y-auto py-1'>
				{/* All */}
				<button
					onClick={() => { setActiveCategoryId(null); setShowCategoriesPane(false); }}
					className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
						activeCategoryId === null ? 'bg-accent/10 text-accent' : 'text-secondary hover:bg-gray-50'
					}`}
				>
					<span className='w-2.5 h-2.5 rounded-full bg-secondary/20 shrink-0' />
					<span className='text-3.5 font-medium flex-1 truncate'>All</span>
					<span className='text-3 text-secondary/40 tabular-nums'>{items.length}</span>
				</button>

				{categories.map((cat) => (
					<div
						key={cat.id}
						className={`group flex items-center gap-3 px-4 py-3 transition-colors ${
							activeCategoryId === cat.id ? 'bg-accent/10' : 'hover:bg-gray-50'
						}`}
					>
						<button
							onClick={() => { setActiveCategoryId(cat.id ?? null); setShowCategoriesPane(false); }}
							className='flex items-center gap-3 flex-1 min-w-0 text-left'
						>
							<span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cat.is_hidden ? 'opacity-30' : ''}`} style={{ backgroundColor: cat.color }} />
							<span className={`text-3.5 font-medium truncate ${
								activeCategoryId === cat.id ? 'text-accent' : cat.is_hidden ? 'text-secondary/30' : 'text-secondary'
							}`}>
								{cat.name}
							</span>
						</button>
						<div className={`flex items-center gap-1 ${!canAccessPOS ? 'hidden' : ''}`}>
							{/* Visibility toggle — always visible */}
							<button
								onClick={() => toggleCategoryVisibility(cat)}
								className={`p-1.5 rounded-lg transition-colors ${
									cat.is_hidden
										? 'text-error hover:bg-error/10'
										: 'text-secondary/30 hover:bg-gray-100 hover:text-secondary'
								}`}
								title={cat.is_hidden ? 'Hidden from store — click to show' : 'Visible in store — click to hide'}
							>
								{cat.is_hidden ? (
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21' />
									</svg>
								) : (
									<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
									</svg>
								)}
							</button>
							{/* Edit / Delete — visible on hover */}
							<button
								onClick={() => { setEditingCategory(cat); setShowCategoryForm(true); }}
								className='p-1.5 hover:bg-accent/10 rounded-lg text-secondary/30 hover:text-accent transition-colors opacity-0 group-hover:opacity-100'
								title='Edit'
							>
								<EditIcon className='w-4 h-4' />
							</button>
							<button
								onClick={() => handleDeleteCategory(cat)}
								className='p-1.5 hover:bg-error/10 rounded-lg text-secondary/30 hover:text-error transition-colors opacity-0 group-hover:opacity-100'
								title='Delete'
							>
								<DeleteIcon className='w-4 h-4' />
							</button>
						</div>
					</div>
				))}

				{categories.length === 0 && (
					<p className='text-3.5 text-secondary/30 text-center py-6 px-4'>No categories yet</p>
				)}
			</div>
		</>
	);

	// Mobile categories button for top row (same position as cart icon in store page)
	const categoriesButton = (
		<button
			onClick={() => setShowCategoriesPane(true)}
			className='relative h-12 w-12 bg-accent xl:bg-primary rounded-xl flex justify-center items-center opacity-100 hover:opacity-50 transition-all cursor-pointer'
			title='Categories'
		>
			<CategoriesIcon className='w-6 h-6 text-primary' />
			{activeCategoryId && (
				<span className='absolute top-1.5 right-1.5 w-2 h-2 bg-white rounded-full' />
			)}
		</button>
	);

	return (
		<div className='flex h-full overflow-hidden'>
			{/* Main Content Area */}
			<div className='flex flex-col flex-1 min-w-0 h-full overflow-hidden'>
				{/* Mobile TopBar */}
				<div className='xl:hidden w-full'>
					<MobileTopBar title='Inventory' icon={<InventoryIcon />} topRightAction={categoriesButton} />
				</div>
				{/* Desktop TopBar */}
				<div className='hidden xl:block w-full'>
					<TopBar title='Inventory' icon={<InventoryIcon />} />
				</div>
				<span className='flex h-6'></span>

				{!isClient ? (
					<div className='flex items-center justify-center py-8'>
						<LoadingSpinner size="md"/>
						<span className='ml-3 text-secondary'>Initializing...</span>
					</div>
				) : (
					<>
						{error && (
							<div className='mx-6 mb-4 p-2 bg-error/10 border border-error/40 rounded-lg'>
								<div className='flex items-center gap-3'>
									<svg className='w-5 h-5 text-error' fill='currentColor' viewBox='0 0 20 20'>
										<path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z' clipRule='evenodd' />
									</svg>
									<span className='text-error font-medium text-3'>{error}</span>
									<button onClick={() => setError(null)} className='ml-auto text-error hover:text-error/20'>
										<DeleteIcon />
									</button>
								</div>
							</div>
						)}

						{loading && (
							<div className='flex items-center justify-center py-8'>
								<LoadingSpinner size="md"/>
								<span className='ml-3 text-secondary'>Loading inventory...</span>
							</div>
						)}

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
										{/* Items Section */}
										<div>
											<div className='flex items-center justify-between mb-3'>
												<h2 className='text-lg font-semibold text-secondary'>
													Items
												</h2>
												<div className='flex items-center gap-2'>
													{destockMode && selectedForDestock.size > 0 && (
														<button
															onClick={() => setShowDestockConfirm(true)}
															className={`px-4 py-2 rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95 bg-error text-white ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}
														>
															<div className='flex flex-row items-center gap-2 font-black text-3'>
																<svg fill='currentColor' stroke='currentColor' viewBox='0 0 15 15' className='w-4 h-4'>
																	<path d='M0.89502 7.50028H14.3021' stroke='currentColor' strokeWidth='3' strokeLinecap='round' />
																</svg>
																<span className='mt-0.5'>DESTOCKS {selectedForDestock.size}</span>
															</div>
														</button>
													)}
													<button
														onClick={() => { setDestockMode(prev => !prev); setSelectedForDestock(new Set()); }}
														className={`px-4 py-2 rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95
															${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}
															${destockMode ? "bg-error text-white" : "bg-error/10 text-error hover:bg-error/20"}`}
													>
														<div className='flex flex-row items-center gap-2 font-black text-3'>
															<div className='size-4'>
																{destockMode ? (
																	<svg fill='none' stroke='currentColor' viewBox='0 0 24 24' className='w-4 h-4'>
																		<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
																	</svg>
																) : (
																	<svg fill='none' stroke='currentColor' viewBox='0 0 15 15' className='w-4 h-4'>
																		<path d='M0.89502 7.50028H14.3021' stroke='currentColor' strokeWidth='3' strokeLinecap='round' />
																	</svg>
																)}
															</div>
															<span className='mt-0.5'>{destockMode ? 'DONE' : 'DESTOCK'}</span>
														</div>
													</button>
													<button
														onClick={() => setShowItemForm(true)}
														className={`bg-accent text-secondary text-3 px-4 py-2 rounded-lg hover:bg-accent/90 shadow-sm transition-all font-semibold hover:scale-105 active:scale-95 ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}
													>
														<div className='flex flex-row items-center gap-2 text-primary text-shadow-md font-black text-3'>
															<div className='size-4'>
																<PlusIcon className='drop-shadow-lg' />
															</div>
															<span className='mt-0.5'>ADD ITEM</span>
														</div>
													</button>
												</div>
											</div>

											{/* Items List */}
											<div className={`space-y-1 ${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}`}>
												{filteredItems.length === 0 && items.length === 0 ? (
													/* Empty State */
													<div className='text-center py-16 px-4'>
														<div className='w-90 mb-4 mx-auto opacity-50 flex items-center justify-center'>
															<EmptyInventory />
														</div>
														<h3 className='text-4 font-semibold text-secondary mb-3'>No Items in Inventory</h3>
														<p className='w-75 text-3 text-secondary opacity-70 mb-6 max-w-md mx-auto'>
															Start by adding your first item to begin managing your products and stock levels.
														</p>
														<button
															onClick={() => setShowItemForm(true)}
															className='text-3 inline-flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent/90 transition-all font-black text-shadow-lg hover:scale-105 active:scale-95'>
															<PlusIcon className='w-4 h-4 drop-shadow-md' />
															<span className='mt-0.5'>ADD YOUR FIRST ITEM</span>
														</button>
														<div className='mt-15 max-w-2xl mx-auto'>
															<div className='bg-secondary/5 border border-secondary/10 rounded-xl p-6'>
																<h4 className='text-base font-semibold text-secondary/50 mb-4 flex items-center gap-2'>
																	<svg className='w-5 h-5 text-secondary/50' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																		<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
																	</svg>
																	Quick Setup Guide
																</h4>
																<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
																	<div className='text-center'>
																		<div className='w-10 h-10 bg-secondary/10 rounded-lg mx-auto mb-3 flex items-center justify-center'>
																			<span className='text-secondary font-bold'>1</span>
																		</div>
																		<h5 className='text-3 font-medium text-secondary/80 mb-1'>Create Categories</h5>
																		<p className='text-3 text-secondary opacity-80'>Organize your products by type</p>
																	</div>
																	<div className='text-center'>
																		<div className='w-10 h-10 bg-secondary/10 rounded-lg mx-auto mb-3 flex items-center justify-center'>
																			<span className='text-secondary font-bold'>2</span>
																		</div>
																		<h5 className='text-3 font-medium text-secondary/80 mb-1'>Add Items</h5>
																		<p className='text-3 text-secondary opacity-80'>Set prices and stock levels</p>
																	</div>
																	<div className='text-center'>
																		<div className='w-10 h-10 bg-secondary/10 rounded-lg mx-auto mb-3 flex items-center justify-center'>
																			<span className='text-secondary font-bold'>3</span>
																		</div>
																		<h5 className='text-3 font-medium text-secondary/80 mb-1'>Manage Stock</h5>
																		<p className='text-3 text-secondary opacity-80'>Track and update inventory</p>
																	</div>
																</div>
															</div>
														</div>
													</div>
												) : filteredItems.length === 0 ? (
													<div className='text-center py-10 text-secondary/40 text-xs'>
														No items in this category
													</div>
												) : (
													filteredItems.map((item) => {
														const isExpanded = expandedItems.has(item.id);
														return (
															<div key={item.id} className={`bg-primary rounded-lg border overflow-hidden transition-colors ${destockMode ? 'border-error/30' : 'border-gray-100'}`}>
																<div className='flex items-center gap-2 px-2 py-1.5'>
																	{destockMode && (
																		<button
																			onClick={() => toggleDestockSelection(item.id)}
																			className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full border-2 transition-all hover:scale-110 active:scale-95 ${
																				selectedForDestock.has(item.id)
																					? 'bg-error border-error text-white'
																					: 'border-error/40 bg-transparent hover:border-error'
																			}`}
																		>
																			{selectedForDestock.has(item.id) && (
																				<svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 15 15'>
																					<path d='M0.89502 7.50028H14.3021' stroke='currentColor' strokeWidth='3' strokeLinecap='round' />
																				</svg>
																			)}
																		</button>
																	)}
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
									<BundlesView categoryFilter={activeCategoryId} categories={categories} />
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
							editingCategory={editingCategory ?? undefined}
							onClose={() => { setShowCategoryForm(false); setEditingCategory(null); }}
							onError={handleError}
						/>

						{/* Delete Category Confirmation */}
						{showDeleteConfirm && categoryToDelete && (
							<div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
								<div className='bg-white rounded-lg max-w-md w-full p-6'>
									<div className='w-16 h-16 bg-error/20 rounded-xl mx-auto mb-4 flex items-center justify-center'>
										<svg className='w-8 h-8 text-error' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16' />
										</svg>
									</div>
									<h3 className='text-lg text-center font-bold text-secondary mb-2'>Delete Category</h3>
									<p className='text-secondary opacity-70 mb-6'>
										Are you sure you want to delete the category{" "}
										<span className='px-2 text-primary rounded-full' style={{ backgroundColor: `${categoryToDelete.color}` }}>
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

						{/* Destock Confirmation Modal */}
						{showDestockConfirm && (
							<div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
								<div className='bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl'>
									<div className='w-14 h-14 bg-error/10 rounded-xl mx-auto mb-4 flex items-center justify-center'>
										<svg className='w-7 h-7 text-error' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' />
										</svg>
									</div>
									<h3 className='text-base text-center font-bold text-secondary mb-1'>
										Zero out stock for {selectedForDestock.size} item{selectedForDestock.size !== 1 ? 's' : ''}?
									</h3>
									<div className='mt-3 mb-5 max-h-36 overflow-y-auto space-y-1'>
										{items.filter(i => selectedForDestock.has(i.id)).map(i => (
											<div key={i.id} className='flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg'>
												<span className='text-xs font-medium text-secondary truncate'>{i.name}</span>
												<span className='text-xs text-error font-bold ml-2 shrink-0'>{i.stock} → 0</span>
											</div>
										))}
									</div>
									<div className='flex gap-3'>
										<button
											onClick={() => setShowDestockConfirm(false)}
											disabled={destocking}
											className='flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-secondary rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50'
										>
											Cancel
										</button>
										<button
											onClick={confirmDestock}
											disabled={destocking}
											className='flex-1 py-2.5 bg-error hover:bg-error/80 text-white rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50'
										>
											{destocking ? 'Destocking…' : 'Destock'}
										</button>
									</div>
								</div>
							</div>
						)}
					</>
				)}
			</div>

			{/* Right Side — Categories Pane (Desktop, xl+) */}
			<div className='hidden lg:flex flex-col w-64 shrink-0 h-full border-l border-gray-200 bg-primary overflow-hidden'>
				{categoriesPaneContent}
			</div>

			{/* Mobile Categories Slide-in Panel */}
			<AnimatePresence>
				{showCategoriesPane && (
					<>
						{/* Backdrop */}
						<motion.div
							className='fixed inset-0 z-40 lg:hidden bg-black/20'
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setShowCategoriesPane(false)}
						/>
						{/* Panel */}
						<motion.div
							className='fixed top-0 right-0 bottom-0 w-72 bg-primary z-50 lg:hidden flex flex-col shadow-xl border-l border-gray-200'
							initial={{ x: '100%' }}
							animate={{ x: 0 }}
							exit={{ x: '100%' }}
							transition={{ type: 'tween', duration: 0.25 }}
						>
							{/* Close button row */}
							<div className='flex justify-end px-4 pt-4 shrink-0'>
								<button
									onClick={() => setShowCategoriesPane(false)}
									className='p-2 hover:bg-gray-100 rounded-lg text-secondary/50 transition-colors'
								>
									<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
									</svg>
								</button>
							</div>
							{categoriesPaneContent}
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</div>
	);
}
