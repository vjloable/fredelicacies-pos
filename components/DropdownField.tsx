"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface DropdownFieldProps {
	options?: string[];
	defaultValue?: string;
	onChange?: (value: string) => void;
	dropdownOffset?: {
		top?: number;
		left?: number;
		right?: number;
	};
	dropdownPosition?:
		| "bottom"
		| "top"
		| "bottom-right"
		| "bottom-left"
		| "top-right"
		| "top-left";
	roundness?: string;
	height?: number;
	valueAlignment?: "left" | "center" | "right";
	shadow?: boolean;
	borderClassName?: string;
	heightClassName?: string;
	fontSize?: string;
	padding?: string;
	maxVisibleOptions?: number;
	hasAllOptionsVisible?: boolean;
	allSuffix?: string;
}

export default function DropdownField({
	options = [],
	defaultValue,
	onChange,
	dropdownOffset = { top: 1, left: 0 },
	dropdownPosition = "bottom-left",
	roundness = "none",
	height = 32,
	valueAlignment = "right",
	shadow = true,
	borderClassName,
	heightClassName,
	fontSize = "10px",
	padding = "12px",
	maxVisibleOptions,
	hasAllOptionsVisible = false,
	allSuffix = "",
}: DropdownFieldProps) {
	const [isOpen, setIsOpen] = useState(false);

	const initialValue =
		defaultValue ||
		(hasAllOptionsVisible ? `ALL ${allSuffix.toUpperCase()}` : undefined);
	const [selectedValue, setSelectedValue] = useState(initialValue);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const [listStyle, setListStyle] = useState<React.CSSProperties>({});
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const calcPosition = useCallback(() => {
		if (!triggerRef.current) return;
		const rect = triggerRef.current.getBoundingClientRect();
		const offsetTop = dropdownOffset.top ?? 1;
		const offsetLeft = dropdownOffset.left ?? 0;
		const offsetRight = dropdownOffset.right ?? 0;

		const maxH = maxVisibleOptions
			? (hasAllOptionsVisible ? maxVisibleOptions + 1 : maxVisibleOptions) *
					40 +
				8
			: 240;

		const style: React.CSSProperties = {
			position: "fixed",
			zIndex: 9999,
			backgroundColor: "white",
			border: "1px solid var(--accent)",
			borderRadius: "2px",
			boxShadow:
				"0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1)",
			overflowY: "auto",
			minWidth: rect.width,
			maxHeight: `${maxH}px`,
		};

		if (dropdownPosition.startsWith("bottom")) {
			style.top = rect.bottom + offsetTop;
		} else {
			style.bottom = window.innerHeight - rect.top + offsetTop;
		}

		if (dropdownPosition.endsWith("right")) {
			style.right = window.innerWidth - rect.right + offsetRight;
		} else {
			style.left = rect.left + offsetLeft;
		}

		setListStyle(style);
	}, [dropdownOffset, dropdownPosition, maxVisibleOptions, hasAllOptionsVisible]);

	useEffect(() => {
		if (!isOpen) return;
		calcPosition();
		window.addEventListener("scroll", calcPosition, true);
		window.addEventListener("resize", calcPosition);
		return () => {
			window.removeEventListener("scroll", calcPosition, true);
			window.removeEventListener("resize", calcPosition);
		};
	}, [isOpen, calcPosition]);

	// Close on outside click
	useEffect(() => {
		if (!isOpen) return;
		function handleDown(e: MouseEvent) {
			if (
				!triggerRef.current?.contains(e.target as Node) &&
				!listRef.current?.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		}
		document.addEventListener("mousedown", handleDown);
		return () => document.removeEventListener("mousedown", handleDown);
	}, [isOpen]);

	// Sync selectedValue when defaultValue changes
	useEffect(() => {
		setSelectedValue(
			defaultValue ||
				(hasAllOptionsVisible ? `ALL ${allSuffix.toUpperCase()}` : undefined)
		);
	}, [defaultValue, hasAllOptionsVisible, allSuffix]);

	const handleSelect = (value: string) => {
		setSelectedValue(value);
		setIsOpen(false);
		onChange?.(value);
	};

	const finalOptions = hasAllOptionsVisible
		? [`ALL ${allSuffix.toUpperCase()}`, ...options]
		: options;

	// Resolve border-radius from the roundness prop without dynamic Tailwind classes
	const borderRadius =
		roundness === "none"
			? "0"
			: roundness === "full"
				? "9999px"
				: /^\d+$/.test(roundness)
					? `${roundness}px`
					: roundness;

	const triggerStyle: React.CSSProperties = {
		...(heightClassName ? {} : { height: `${height}px` }),
		fontSize,
		textAlign: valueAlignment,
		paddingLeft: padding || "16px",
		paddingRight: "56px",
		borderRadius,
		display: "flex",
		alignItems: "center",
	};

	return (
		<div style={heightClassName ? undefined : { height: `${height}px` }} className={`w-full relative ${heightClassName ?? ""}`}>
			<div
				className={`grid grid-cols-1 w-full ${heightClassName ?? ""}`}
				style={heightClassName ? undefined : { height: `${height}px` }}>
				{/* Trigger button */}
				<button
					ref={triggerRef}
					type='button'
					onClick={() => setIsOpen(!isOpen)}
					className={`col-start-1 row-start-1 w-full appearance-none text-secondary font-regular focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent cursor-pointer hover:bg-accent/50 transition-colors ${
						borderClassName
							? borderClassName
							: shadow
							? "shadow-md border-none"
							: "shadow-none border border-gray-200"
					}`}
					style={triggerStyle}>
					{selectedValue}
				</button>

				{/* Arrow icon */}
        <div className="h-8 w-8 absolute top-1/2 right-2 -translate-y-1/2 pointer-events-none">
          <svg
            viewBox='0 0 43 42'
            fill='none'
            className={`pointer-events-none col-start-1 row-start-1 self-center justify-self-end transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}>
            <path
              d='M21.0985 22.8117L17.4756 19.1888H24.7214L21.0985 22.8117Z'
              stroke={"var(--secondary)"}
              strokeWidth='3'
            />
          </svg>
        </div>
			</div>

			{/* Dropdown list — rendered into document.body via portal to escape overflow clips */}
			{isOpen &&
				mounted &&
				createPortal(
					<div ref={listRef} style={listStyle}>
						<div className='py-1'>
							{finalOptions.map((option, index) => {
								const isAllOption =
									hasAllOptionsVisible &&
									option === `ALL ${allSuffix.toUpperCase()}`;
								return (
									<button
										key={index}
										type='button'
										onClick={() => handleSelect(option)}
										className={`w-full px-4 py-2 text-xs hover:bg-accent/50 hover:text-secondary transition-colors ${
											selectedValue === option
												? "bg-accent text-primary font-medium"
												: "text-secondary"
										} ${
											isAllOption
												? "font-semibold border-b border-gray-200 mb-1"
												: ""
										}`}
										style={{ textAlign: valueAlignment }}>
										{option}
									</button>
								);
							})}
						</div>
					</div>,
					document.body
				)}
		</div>
	);
}
