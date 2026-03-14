"use client";

import { useState, useEffect, useRef } from "react";
import { subscribeToDiscounts, Discount, calculateDiscountAmount, calculateEligibleSubtotal, isDiscountEligible, CartItemForDiscount } from "@/services/discountService";
import { formatCurrency } from "@/lib/currency_formatter";
import { useBranch } from "@/contexts/BranchContext";

interface DiscountDropdownProps {
  value: string;
  onChange: (code: string) => void;
  onDiscountApplied: (discount: Discount | null, amount: number) => void;
  cartItems: CartItemForDiscount[];
}

export default function DiscountDropdown({
  value,
  onChange,
  onDiscountApplied,
  cartItems,
}: DiscountDropdownProps) {
  const { currentBranch } = useBranch();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Subscribe to discounts
  useEffect(() => {
    if (!currentBranch) return;
    const unsubscribe = subscribeToDiscounts(currentBranch.id, (data) => {
      setDiscounts(data);
    });
    return () => unsubscribe();
  }, [currentBranch]);

  // Sync appliedDiscount when value changes externally
  useEffect(() => {
    if (!value) {
      setAppliedDiscount(null);
      return;
    }
    const match = discounts.find(
      (d) => d.name.toLowerCase() === value.toLowerCase() && d.status === "active"
    );
    setAppliedDiscount(match ?? null);
  }, [value, discounts]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const activeDiscounts = discounts.filter((d) => d.status === "active");
  const filtered = search
    ? activeDiscounts.filter((d) =>
        d.name.toLowerCase().includes(search.toLowerCase())
      )
    : activeDiscounts;

  const getPreview = (discount: Discount) => {
    const sub = calculateEligibleSubtotal(discount, cartItems);
    return calculateDiscountAmount(discount, sub);
  };

  const handleSelect = (discount: Discount) => {
    const eligible = isDiscountEligible(discount, cartItems);
    onChange(discount.name);
    setIsOpen(false);
    setSearch("");
    if (eligible) {
      const preview = getPreview(discount);
      onDiscountApplied(discount, preview);
    } else {
      onDiscountApplied(null, 0);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    onDiscountApplied(null, 0);
    setAppliedDiscount(null);
  };

  const eligible = appliedDiscount ? isDiscountEligible(appliedDiscount, cartItems) : false;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 h-9.5 text-3 border-2 rounded-lg transition-all ${
          appliedDiscount && eligible
            ? "border-accent bg-accent/10 text-secondary"
            : "border-secondary/20 bg-light-accent/40 text-secondary/50"
        } focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent`}
      >
        <span className={appliedDiscount && eligible ? "font-medium text-secondary" : ""}>
          {appliedDiscount && eligible ? appliedDiscount.name : "Select a discount..."}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {appliedDiscount && eligible && (
            <>
              <span className="text-xs text-accent font-semibold">
                -{formatCurrency(getPreview(appliedDiscount))}
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="ml-1 text-secondary/40 hover:text-secondary/80 transition-colors"
                aria-label="Clear discount"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
          <svg
            className={`w-4 h-4 text-secondary/40 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Ineligible notice */}
      {appliedDiscount && !eligible && (
        <div className="mt-1.5 px-3 py-1.5 bg-(--error)/10 border border-(--error)/20 rounded-lg">
          <p className="text-xs text-(--error) font-medium">
            This discount doesn&apos;t apply to the items in your cart
          </p>
        </div>
      )}

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-1 bg-white border-2 border-secondary/20 rounded-lg shadow-lg">
          {/* Search */}
          <div className="p-2 border-b border-secondary/10">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search discounts..."
                className="w-full pl-8 pr-3 py-1.5 text-3 border-2 border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-secondary/50 text-xs">
                {search ? `No discounts matching "${search}"` : "No active discounts"}
              </div>
            ) : (
              filtered.map((discount) => {
                const discountEligible = isDiscountEligible(discount, cartItems);
                const preview = getPreview(discount);
                const isSelected = value.toLowerCase() === discount.name.toLowerCase();

                return (
                  <button
                    key={discount.id}
                    type="button"
                    onClick={() => handleSelect(discount)}
                    className={`w-full text-left px-3 py-2.5 border-b border-secondary/10 last:border-b-0 transition-colors ${
                      isSelected
                        ? "bg-accent/10"
                        : discountEligible
                        ? "hover:bg-secondary/5"
                        : "hover:bg-secondary/5 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-secondary text-xs truncate">
                            {discount.name}
                          </span>
                          {isSelected && (
                            <svg className="w-3.5 h-3.5 text-accent shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          {!discountEligible && (
                            <span className="text-xs text-(--error) bg-(--error)/10 px-1.5 py-0.5 rounded font-medium shrink-0">
                              Not eligible
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-secondary/50 mt-0.5">
                          {discount.type === "percentage"
                            ? `${discount.value}% off`
                            : `₱${discount.value} off`}
                          {discountEligible && preview > 0 && (
                            <span className="text-(--success) font-medium ml-1">
                              · save {formatCurrency(preview)}
                            </span>
                          )}
                        </div>
                      </div>
                      {discountEligible && preview > 0 && (
                        <div className="text-right ml-3 shrink-0">
                          <div className="font-semibold text-(--success) text-xs">
                            -{formatCurrency(preview)}
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
