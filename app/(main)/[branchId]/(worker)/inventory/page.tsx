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
import LockItemModal from "./components/LockItemModal";
import SubmitEODModal from "./components/SubmitEODModal";
import type { InventoryItem, Category } from "@/types/domain";
import type { EodItemLock, EodSession } from "@/types/domain/eod";
import { subscribeToInventoryItems, updateInventoryItem } from "@/services/inventoryService";
import { logActivity } from "@/services/activityLogService";
import { recordWastage } from "@/services/wastageService";
import { subscribeToEodLocks, getEodLocks, flagUncarriedItems, resolveUncarried } from "@/services/eodService";
import { categoryEodPolicyRepository } from "@/lib/repositories/categoryEodPolicyRepository";
import type { CategoryEodPolicy } from "@/types/domain/category";
import { useAuth } from "@/contexts/AuthContext";
import {
	subscribeToCategories,
	getCategoryColor,
	deleteCategory,
	updateCategory,
} from "@/services/categoryService";
import { useBranch } from "@/contexts/BranchContext";
import { useDateTime } from "@/contexts/DateTimeContext";
import HelpButton from "@/components/HelpButton";
import { inventorySteps } from "@/components/TutorialSteps";
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
	const { date: todayFormatted } = useDateTime();
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
	// EOD state
	const [eodLocks, setEodLocks] = useState<EodItemLock[]>([]);
	const [eodSession, setEodSession] = useState<EodSession | null>(null);
	const [eodPanelOpen, setEodPanelOpen] = useState(true);
	const [lockingItem, setLockingItem] = useState<Item | null>(null);
	const [showSubmitEOD, setShowSubmitEOD] = useState(false);
	// EOD policy state
	const [eodPolicies, setEodPolicies] = useState<CategoryEodPolicy[]>([]);
	// Uncarried stock resolution state
	const [resolveMode, setResolveMode] = useState(false);
	const [selectedForResolve, setSelectedForResolve] = useState<Set<string>>(new Set());
	const [resolving, setResolving] = useState(false);
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

	// Subscribe to today's EOD locks
	useEffect(() => {
		if (!isClient || !currentBranch || !canAccessPOS) return;
		const today = new Date().toISOString().slice(0, 10);
		// Fetch session too on mount
		getEodLocks(currentBranch.id, today).then(({ session }) => setEodSession(session));
		const unsubscribe = subscribeToEodLocks(currentBranch.id, today, setEodLocks);
		return () => { unsubscribe(); };
	}, [isClient, currentBranch, canAccessPOS]);

	// Subscribe to EOD policies
	useEffect(() => {
		if (!isClient || !currentBranch) return;
		const unsubscribe = categoryEodPolicyRepository.subscribe(currentBranch.id, setEodPolicies);
		return () => { unsubscribe(); };
	}, [isClient, currentBranch?.id]);

	// Helper: check if a category is destock-only
	const isDestockOnly = (categoryId: string | null): boolean => {
		if (!categoryId) return false;
		return eodPolicies.some(p => p.category_id === categoryId && p.eod_policy === 'destock_only');
	};

	// Items with uncarried stock
	const uncarriedItems = items.filter(item => item.uncarried_stock > 0);

	// Toggle resolve selection
	const toggleResolveSelection = (id: string) => {
		setSelectedForResolve(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});
	};

	// Resolve selected uncarried items
	const confirmResolve = async (resolution: 'carry_over' | 'destock') => {
		if (!currentBranch || selectedForResolve.size === 0) return;
		setResolving(true);
		const selectedItems = items.filter(item => selectedForResolve.has(item.id));
		await resolveUncarried(currentBranch.id, user?.id ?? null, selectedItems, resolution);
		setResolving(false);
		setSelectedForResolve(new Set());
		setResolveMode(false);
	};

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
					<MobileTopBar title='Inventory' icon={<InventoryIcon />} topRightAction={categoriesButton} rightAction={<HelpButton variant='page' steps={inventorySteps} />} />
				</div>
				{/* Desktop TopBar */}
				<div className='hidden xl:block w-full'>
					<TopBar title='Inventory' icon={<InventoryIcon />} rightAction={<HelpButton variant='page' steps={inventorySteps} />} />
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
													{/* Resolve uncarried controls */}
													{resolveMode && selectedForResolve.size > 0 && (
														<>
															<button
																onClick={() => confirmResolve('carry_over')}
																disabled={resolving}
																className={`px-3 py-2 rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95 bg-success text-white text-3 font-black ${resolving ? 'opacity-50' : ''}`}
															>
																CARRY OVER {selectedForResolve.size}
															</button>
															<button
																onClick={() => confirmResolve('destock')}
																disabled={resolving}
																className={`px-3 py-2 rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95 bg-error text-white text-3 font-black ${resolving ? 'opacity-50' : ''}`}
															>
																DESTOCK {selectedForResolve.size}
															</button>
														</>
													)}
													{uncarriedItems.length > 0 && (
														<button
															onClick={() => { setResolveMode(prev => !prev); setSelectedForResolve(new Set()); }}
															className={`px-3 py-2 rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95
																${!canAccessPOS ? "blur-[1px] pointer-events-none" : ""}
																${resolveMode ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}
														>
															<div className='flex flex-row items-center gap-2 font-black text-3'>
																<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																	<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
																</svg>
																<span className='mt-0.5'>{resolveMode ? 'DONE' : `RESOLVE ${uncarriedItems.length}`}</span>
															</div>
														</button>
													)}
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

											{/* EOD Audit Panel */}
											{canAccessPOS && (
												<div className='mb-3 border border-secondary/15 rounded-xl overflow-hidden'>
													<button
														onClick={() => setEodPanelOpen(p => !p)}
														className='w-full flex items-center justify-between px-3 py-2.5 bg-secondary/5 hover:bg-secondary/10 transition-colors'
													>
														<div className='flex items-center gap-2'>
															<svg className='w-3.5 h-3.5 text-secondary/60' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' />
															</svg>
															<span className='text-xs font-semibold text-secondary'>End-of-Day Audit</span>
															<span className='text-xs text-secondary/40'>· {todayFormatted}</span>
															{eodLocks.length > 0 && (
																<span className='text-xs bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-full font-semibold'>
																	{eodLocks.length} locked
																</span>
															)}
															{eodLocks.filter(l => l.discrepancy !== 0).length > 0 && (
																<span className='text-xs bg-error/10 text-error px-1.5 py-0.5 rounded-full font-semibold'>
																	{eodLocks.filter(l => l.discrepancy !== 0).length} disc.
																</span>
															)}
															{eodSession?.status === 'submitted' && (
																<span className='text-xs bg-success/10 text-success px-1.5 py-0.5 rounded-full font-semibold'>Submitted</span>
															)}
														</div>
														<svg className={`w-3.5 h-3.5 text-secondary/40 transition-transform ${eodPanelOpen ? 'rotate-180' : ''}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
															<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
														</svg>
													</button>
													{eodPanelOpen && (
														<div className='px-3 py-2.5 space-y-2'>
															{eodLocks.length === 0 ? (
																<p className='text-xs text-secondary/40 text-center py-2'>
																	No items locked yet. Click the lock icon on any item to start auditing.
																</p>
															) : (
																<>
																	<div className='flex items-center gap-2'>
																		<div className='flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden'>
																			<div
																				className='h-full bg-secondary/60 rounded-full transition-all'
																				style={{ width: `${Math.min(100, (eodLocks.length / Math.max(items.length, 1)) * 100)}%` }}
																			/>
																		</div>
																		<span className='text-xs text-secondary/50 tabular-nums shrink-0'>
																			{eodLocks.length} / {items.length}
																		</span>
																	</div>
																	<div className='space-y-1 max-h-40 overflow-y-auto'>
																		{eodLocks.map(lock => (
																			<div key={lock.id} className='flex items-center gap-2 text-xs py-0.5'>
																				<span className='truncate flex-1 text-secondary'>{lock.item_name}</span>
																				<span className='text-secondary/40 shrink-0 tabular-nums'>exp {lock.expected_stock} → {lock.locked_stock}</span>
																				{lock.discrepancy === 0 ? (
																					<svg className='w-3 h-3 text-success shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M5 13l4 4L19 7' />
																					</svg>
																				) : (
																					<span className={`shrink-0 font-bold ${lock.resolution ? 'text-secondary/40' : 'text-error'}`}>
																						{lock.discrepancy > 0 ? '+' : ''}{lock.discrepancy}
																					</span>
																				)}
																			</div>
																		))}
																	</div>
																</>
															)}
															{eodLocks.length > 0 && eodSession?.status !== 'submitted' && (
																<button
																	onClick={() => setShowSubmitEOD(true)}
																	className='w-full mt-1 py-2 bg-secondary hover:bg-secondary/80 text-primary text-xs font-bold rounded-lg transition-all hover:scale-105 active:scale-95'
																>
																	Submit End-of-Day & Carry Over →
																</button>
															)}
														</div>
													)}
												</div>
											)}

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
															<div key={item.id} className={`bg-primary rounded-lg border overflow-hidden transition-colors ${destockMode ? 'border-error/30' : resolveMode && item.uncarried_stock > 0 ? 'border-amber-400/50' : 'border-gray-100'}`}>
																<div className='flex items-center gap-2 px-2 py-1.5'>
																	{resolveMode && item.uncarried_stock > 0 && (
																		<button
																			onClick={() => toggleResolveSelection(item.id)}
																			className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full border-2 transition-all hover:scale-110 active:scale-95 ${
																				selectedForResolve.has(item.id)
																					? 'bg-amber-500 border-amber-500 text-white'
																					: 'border-amber-400/40 bg-transparent hover:border-amber-500'
																			}`}
																		>
																			{selectedForResolve.has(item.id) && (
																				<svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																					<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
																				</svg>
																			)}
																		</button>
																	)}
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
																	{item.uncarried_stock > 0 ? (
																		<span className='text-2.5 font-bold shrink-0 text-center tabular-nums text-amber-600' title={`(${item.uncarried_stock} uncarried) + ${item.stock - item.uncarried_stock} new`}>
																			<span className='line-through opacity-50'>{item.uncarried_stock}</span>+{item.stock - item.uncarried_stock}
																		</span>
																	) : (
																		<span className={`text-xs font-bold shrink-0 w-8 text-center tabular-nums ${
																			item.stock === 0 ? 'text-error' : item.stock <= 5 ? 'text-accent' : 'text-secondary/50'
																		}`}>{item.stock}</span>
																	)}
																	<button onClick={() => openEditModal(item)} className='shrink-0 p-1.5 hover:bg-light-accent rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1'>
																		<EditIcon className='w-4 h-4' />
																	</button>
																	{canAccessPOS && !isDestockOnly(item.category_id) && (() => {
																		const lock = eodLocks.find(l => l.item_id === item.id);
																		return (
																			<button
																				onClick={() => setLockingItem(item)}
																				title={lock ? 'Locked for End-of-Day' : 'Lock for End-of-Day audit'}
																				className={`shrink-0 p-1.5 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
																					lock ? 'text-secondary bg-secondary/10 hover:bg-secondary/20' : 'text-secondary/30 hover:bg-gray-100 hover:text-secondary'
																				}`}
																			>
																				<svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
																					{lock ? (
																						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
																					) : (
																						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z' />
																					)}
																				</svg>
																			</button>
																		);
																	})()}
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
							eodLock={editingItem ? (eodLocks.find(l => l.item_id === editingItem.id) ?? null) : null}
							onUnlocked={() => {
								if (editingItem) setEodLocks(prev => prev.filter(l => l.item_id !== editingItem.id));
							}}
						/>

						{lockingItem && (
							<LockItemModal
								isOpen={!!lockingItem}
								item={lockingItem}
								existingLock={eodLocks.find(l => l.item_id === lockingItem.id) ?? null}
								onClose={() => setLockingItem(null)}
								onLocked={(lock) => {
									setEodLocks(prev => [...prev.filter(l => l.item_id !== lock.item_id), lock]);
									if (!eodSession) getEodLocks(currentBranch?.id ?? '', new Date().toISOString().slice(0, 10)).then(({ session }) => setEodSession(session));
									setLockingItem(null);
								}}
								onUnlocked={() => {
									setEodLocks(prev => prev.filter(l => l.item_id !== lockingItem.id));
									setLockingItem(null);
								}}
								onError={handleError}
							/>
						)}

						{showSubmitEOD && eodSession && (
							<SubmitEODModal
								isOpen={showSubmitEOD}
								session={eodSession}
								locks={eodLocks}
								allItems={items}
								onClose={() => setShowSubmitEOD(false)}
								onSubmitted={() => {
									setShowSubmitEOD(false);
									setEodSession(prev => prev ? { ...prev, status: 'submitted' } : prev);
								}}
								onError={handleError}
							/>
						)}

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
