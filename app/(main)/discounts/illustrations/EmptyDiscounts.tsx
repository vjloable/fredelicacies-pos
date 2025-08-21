'use client';

import React from 'react';

export default function EmptyDiscounts() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8">
      {/* Icon */}
      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-12 h-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
      </div>
      
      {/* Title */}
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No Discounts Yet
      </h3>
      
      {/* Description */}
      <p className="text-gray-500 text-center max-w-md">
        Create discount codes to offer special deals to your customers. Discounts can be percentage-based or flat amounts.
      </p>
    </div>
  );
}
