"use client";

import { useState, useEffect, useRef } from "react";
import { subscribeToDiscounts, Discount, calculateDiscountAmount } from "@/services/discountService";
import { formatCurrency } from "@/lib/currency_formatter";
import { useBranch } from "@/contexts/BranchContext";

interface DiscountDropdownProps {
  value: string;
  onChange: (code: string) => void;
  onDiscountApplied: (discount: Discount | null, amount: number) => void;
  subtotal: number;
}

export default function DiscountDropdown({
  value,
  onChange,
  onDiscountApplied,
  subtotal
}: DiscountDropdownProps) {
  const { currentBranch } = useBranch();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [filteredDiscounts, setFilteredDiscounts] = useState<Discount[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
  const [isValidCode, setIsValidCode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribe to discounts
  useEffect(() => {
    if (!currentBranch) return;

    const unsubscribe = subscribeToDiscounts(currentBranch.id, (discountsData) => {
      setDiscounts(discountsData);
    });

    return () => unsubscribe();
  }, [currentBranch]);

  // Filter discounts based on input
  useEffect(() => {
    if (!value) {
      setFilteredDiscounts([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = discounts.filter(discount =>
      discount.name.toLowerCase().includes(value.toLowerCase()) &&
      discount.status === 'active'
    );

    setFilteredDiscounts(filtered);
    setShowSuggestions(filtered.length > 0 && value.length > 0);
  }, [value, discounts]);

  // Validate current discount code
  useEffect(() => {
    if (!value) {
      setAppliedDiscount(null);
      setIsValidCode(false);
      return;
    }

    const exactMatch = discounts.find(discount => 
      discount.name.toLowerCase() === value.toLowerCase() &&
      discount.status === 'active'
    );

    if (exactMatch) {
      setIsValidCode(true);
      setAppliedDiscount(exactMatch);
    } else {
      setIsValidCode(false);
      setAppliedDiscount(null);
    }
  }, [value, discounts]);

  // Handle clicking outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    onChange(newValue);
  };

  const handleSuggestionClick = (discount: Discount) => {
    onChange(discount.name);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const handleApplyDiscount = () => {
    if (appliedDiscount) {
      const discountAmount = calculateDiscountAmount(
        appliedDiscount, 
        subtotal
      );
      onDiscountApplied(appliedDiscount, discountAmount);
    } else {
      onDiscountApplied(null, 0);
    }
  };

  const getDiscountPreview = (discount: Discount): number => {
    return calculateDiscountAmount(discount, subtotal);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex flex-row border border-accent rounded-md bg-(--light-accent)/40">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => value && filteredDiscounts.length > 0 && setShowSuggestions(true)}
          className="grow py-2 px-4 text-[12px] border-none rounded-l-md focus:outline-none bg-transparent"
          placeholder="Enter discount coupon code"
        />
        <button
          onClick={handleApplyDiscount}
          className={`shrink py-2 px-4 font-bold text-sm rounded-e-md transition-all ${
            isValidCode 
              ? 'bg-accent text-primary hover:bg-(--accent)/80' 
              : 'bg-(--accent)/50 text-primary text-shadow-lg cursor-not-allowed'
          }`}
          disabled={!isValidCode}
        >
          {isValidCode ? (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              APPLY
            </span>
          ) : (
            'APPLY'
          )}
        </button>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredDiscounts.map((discount) => {
            const previewAmount = getDiscountPreview(discount);

            return (
              <div
                key={discount.id}
                onClick={() => handleSuggestionClick(discount)}
                className="p-3 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-secondary text-sm">
                        {discount.name}
                      </span>
                    </div>
                    <div className="text-xs text-secondary opacity-70 mt-1">
                      {discount.type === 'percentage' 
                        ? `${discount.value}% off`
                        : `₱${discount.value} off`
                      }
                      {previewAmount > 0 && (
                        <span className="text-(--success) font-medium ml-2">
                          (-{formatCurrency(previewAmount)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Savings</div>
                    <div className="font-semibold text-(--success)">
                      {formatCurrency(previewAmount)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredDiscounts.length === 0 && value && (
            <div className="p-3 text-center text-gray-500 text-sm">
              No discount codes found matching &quot;{value}&quot;
            </div>
          )}
        </div>
      )}

      {/* Current Discount Info */}
      {appliedDiscount && isValidCode && (
        <div className="mt-2 px-4 py-2 bg-(--accent)/10 border border-dashed border-accent rounded-lg">
          <div className="flex items-center justify-between text-[14px]">
            <div>
              <span className="font-semibold text-secondary">
                {appliedDiscount.name}
              </span>
              <span className="text-secondary ml-2">
                ({appliedDiscount.type === 'percentage' 
                  ? `${appliedDiscount.value}% off`
                  : `₱${appliedDiscount.value} off`
                })
              </span>
            </div>
            <div className="text-right">
              <div className="font-semibold text-secondary">
                -{formatCurrency(getDiscountPreview(appliedDiscount))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
