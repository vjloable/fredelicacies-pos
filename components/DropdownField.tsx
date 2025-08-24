'use client';

import { useState, useRef, useEffect } from 'react';

interface DropdownFieldProps {
  options?: string[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  dropdownOffset?: {
    top?: number;
    left?: number;
    right?: number;
  };
  dropdownPosition?: 'bottom' | 'top' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  roundness?: string;
  height?: number;
  valueAlignment?: 'left' | 'center' | 'right';
  shadow?: boolean;
  fontSize?: string;
  padding?: string;
}

export default function DropdownField({ 
  options = [], 
  defaultValue,
  onChange,
  dropdownOffset = { top: 1, left: 0 },
  dropdownPosition = 'bottom-left',
  roundness = "none",
  height = 42,
  valueAlignment = 'right',
  shadow = true,
  fontSize = "14px",
  padding = "12px"
}: DropdownFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update selectedValue when defaultValue changes
  useEffect(() => {
    setSelectedValue(defaultValue);
  }, [defaultValue]);

  const handleSelect = (value: string) => {
    setSelectedValue(value);
    setIsOpen(false);
    onChange?.(value);
  };

  const getDropdownClasses = () => {
    const baseClasses = "absolute z-50 bg-white border border-[var(--accent)] rounded-sm shadow-lg min-w-full";
    
    const positionClasses = {
      'bottom': 'top-full left-0',
      'top': 'bottom-full left-0',
      'bottom-right': 'top-full right-0',
      'bottom-left': 'top-full left-0',
      'top-right': 'bottom-full right-0',
      'top-left': 'bottom-full left-0'
    };

    return `${baseClasses} ${positionClasses[dropdownPosition]}`;
  };

  const getDropdownStyle = () => {
    return {
      marginTop: dropdownOffset.top ? `${dropdownOffset.top}px` : undefined,
      marginLeft: dropdownOffset.left ? `${dropdownOffset.left}px` : undefined,
      marginRight: dropdownOffset.right ? `${dropdownOffset.right}px` : undefined,
    };
  };

  return (
    <div className={`h-[${height}px] w-full relative`} ref={dropdownRef}>
      <div className={`grid shrink-0 grid-cols-1 focus-within:relative h-[${height}px] w-full`}>
        {/* Custom Dropdown Trigger */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`py-[${padding}] bg-[var(--primary)] col-start-1 row-start-1 w-full appearance-none 
            text-[${fontSize}] text-[var(--secondary)] font-regular focus:outline-none
            rounded-${roundness} focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-${valueAlignment} pr-14 px-4 cursor-pointer 
            hover:bg-[var(--accent)] transition-colors 
            ${shadow ? 'shadow-md border-none' : 'shadow-none border-2 border-[var(--secondary)]/20'}`}
          style={height ? { height: `${height}px` } : {}}
        >
          {selectedValue}
        </button>
        
        {/* Arrow Icon */}
        <svg 
          width="43" 
          height="42" 
          viewBox="0 0 43 42" 
          fill="none" 
          className={`pointer-events-none col-start-1 row-start-1 self-center justify-self-end transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M21.0985 22.8117L17.4756 19.1888H24.7214L21.0985 22.8117Z" stroke={"var(--secondary)"} strokeWidth="3"/>
        </svg>

        {/* Custom Dropdown Menu */}
        {isOpen && (
          <div 
            className={getDropdownClasses()}
            style={getDropdownStyle()}
          >
            <div className="py-1">
              {options.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full text-${valueAlignment} px-4 py-2 text-sm hover:bg-[var(--accent)]/50 hover:text-[var(--secondary)] transition-colors ${
                    selectedValue === option 
                      ? 'bg-[var(--accent)] text-[var(--primary)] font-medium' 
                      : 'text-[var(--secondary)]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}