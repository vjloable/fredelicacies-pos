"use client";

import { useState } from "react";
import InputField from "@/components/InputField";
import DropdownField from "@/components/DropdownField";
import TopBar from "@/components/TopBar";
import EditIcon from "./components/EditIcon";
import MinusIcon from "./components/MinusIcon";
import OrderCartIcon from "./components/OrderCartIcon";

export default function Home() {
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [cart, setCart] = useState([
        { id: 1, name: "Item Title", price: 50.0, quantity: 1 },
        { id: 2, name: "Item Title", price: 50.0, quantity: 1 },
        { id: 3, name: "Item Title", price: 50.0, quantity: 1 },
        { id: 4, name: "Item Title", price: 50.0, quantity: 1 },
        { id: 5, name: "Item Title", price: 50.0, quantity: 1 },
    ]);

    const categories = [
        "All",
        "Category Titleç",
        "Category Title",
        "Category Title",
        "Category Title",
    ];
    const menuItems = Array(8)
        .fill(null)
        .map((_, i) => ({ id: i, name: "Name", price: 0.0 }));

    const subtotal = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );
    const total = subtotal;

    const updateQuantity = (id: number, delta: number) => {
        setCart(
            cart
                .map((item) =>
                    item.id === id
                        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
                        : item
                )
                .filter((item) => item.quantity > 0)
        );
    };

    return (
        <div className="flex h-full overflow-hidden">
            {/* Menu Area - This should expand to fill available space */}
            <div className="flex flex-col flex-1 h-full overflow-hidden">
                {/* Header Section - Fixed */}
                <TopBar title="Home" />
                
                <div className="flex-shrink-0 p-6 pb-0">
                    <h2 className="text-[var(--secondary)] text-[16px] font-bold mb-3">
                        Category
                    </h2>
                </div>

                {/* Content Section */}
                <div className="flex-shrink-0 pb-0">
                    <div className="flex gap-4 overflow-x-auto scrollbar-hide mb-3 w-full px-6 pt-1 pb-6">
                        {categories.map((category, index) => (
                            <div
                                key={index}
                                onClick={() => setSelectedCategory(category)}
                                className={`
                                    flex-shrink-0 w-40 h-25 rounded-xl flex flex-col items-center justify-center
                                    ${selectedCategory === category
                                                        ? "bg-[var(--accent)] text-white border-1 border-[var(--accent)]"
                                                        : "bg-[var(--primary)] text-[var(--secondary)] border-1 border-gray-200"
                                                    }
                                    hover:shadow-lg hover:border-2 hover:scale-105 transition-all cursor-pointer
                                    shadow-sm
                                `}>
                                <div className="w-8 h-8 bg-current opacity-20 rounded-full mb-1"></div>
                                <span className="text-xs text-center">{category}</span>
                                <span className="text-xs opacity-70">Items</span>
                            </div>
                        ))}
                    </div>
                </div>


                {/* Menu Header - Fixed */}
                <div className="flex items-center justify-between mb-3 pl-6">
                    <h2 className="text-[var(--secondary)] font-bold">Menu</h2>
                </div>

                {/* Menu Items - Scrollable */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <div
                        className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4 py-2"
                    >
                        {menuItems.map((item, index) => (
                            <div
                                key={index}
                                className={`
                    bg-[var(--primary)] rounded-lg p-4 border-2 h-65 lg:h-60 xl:h-75 cursor-pointer
                    hover:shadow-md hover:border-[var(--accent)] hover:scale-105 transition-all
                    ${index === 0 ? "border-[var(--accent)]" : "border-gray-200"
                                    }
                  `}
                            >
                                <div className="w-full h-40 lg:h-35 xl:h-50 bg-gray-100 rounded-lg mb-3"></div>
                                <h3 className="font-medium text-[var(--secondary)] mb-1">
                                    {item.name}
                                </h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 rounded">
                                        Name
                                    </span>
                                    <span className="font-semibold text-[var(--secondary)]">
                                        {item.price.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side Panel - Order Summary */}
            <div className="flex flex-col h-full shadow-lg bg-[var(--primary)] overflow-hidden w-[416px] flex-shrink-0">
                {/* Header Section - Fixed at top (154px total) */}
                <div className="flex-shrink-0">
                    <div className="w-full h-[90px] bg-[var(--primary)] border-l border-gray-200 shadow-lg">
                        {/* Order Header */}
                        <div className="flex items-center gap-3 p-3">
                            <div className="bg-[var(--light-accent)] w-16 h-16 rounded-full items-center justify-center flex">
                                <OrderCartIcon/>
                            </div>
                            <div className="flex flex-1 flex-col items-center">
                                <span className="text-[var(--secondary)] font-medium text-[16px] self-start">
                                    Order Title
                                </span>
                                <span className="text-[var(--secondary)] font-light text-[12px] self-start">
                                    Order Number: #001
                                </span>
                            </div>
                            <div className="hidden bg-[var(--light-accent)] w-16 h-16 rounded-full"></div>
                        </div>
                    </div>

                    <div className="h-16 p-3 border-b border-[var(--secondary)]/20">
                        <div className="flex h-[42px] items-center justify-between bg-[var(--background)] rounded-[24px] gap-3">
                            <DropdownField
                                options={["DINE-IN", "TAKE OUT", "DELIVERY"]}
                                defaultValue="TAKE OUT"
                                dropdownPosition="bottom-right"
                                dropdownOffset={{ top: 2, right: 0 }}
                                onChange={(value) => console.log("Selected:", value)}
                            />
                        </div>
                    </div>
                </div>
                
                {/* Cart Items - Scrollable middle section */}
                <div className="flex-1 overflow-y-auto px-3 pb-6">
                    <div className="space-y-0">
                        {cart.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-row items-center gap-3 w-full h-[124px] bg-white border-b border-dashed border-[#4C2E24]"
                            >
                                {/* Item Image Placeholder - 102x100px */}
                                <div className="flex-none w-[102px] h-[100px] bg-[#F7F7F7] rounded-md"></div>

                                {/* Item Details - 278px width */}
                                <div className="flex flex-col items-start gap-3 w-[278px] h-[100px] flex-grow">
                                    {/* Item Info Section */}
                                    <div className="flex flex-col items-start gap-3 w-full h-[53px] flex-grow">
                                        {/* Title and Price Row */}
                                        <div className="flex flex-row items-center gap-5 w-full h-[21px]">
                                            <span className="font-normal text-base leading-[21px] text-[#4C2E24] font-['Poppins']">
                                                {item.name}
                                            </span>
                                        </div>
                                        <div className="flex flex-row items-center w-full h-[21px]">
                                            <span className="font-normal text-sm leading-[21px] text-[#DA834D] font-['Poppins']">
                                                {item.price.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Controls Section */}
                                    <div className="flex flex-row justify-between items-end gap-3 w-full h-[35px]">
                                        {/* Edit Button */}
                                        <button className="flex flex-col justify-center items-center p-[6px] gap-5 w-[35px] h-[35px] bg-[#FFDEC9] rounded-[24px] hover:scale-110 transition-all">
                                            <EditIcon/>
                                        </button>

                                        {/* Quantity Controls */}
                                        <div className="flex flex-row justify-between items-center px-[6px] w-[120px] h-[35px] bg-[#FFDEC9] rounded-[24px]">
                                            <button
                                                onClick={() => updateQuantity(item.id, -1)}
                                                className="flex flex-col justify-center items-center p-[6px] gap-5 w-[23px] h-[23px] bg-white rounded-[24px] hover:scale-110 hover:bg-[var(--accent)] transition-all"
                                            >
                                                <MinusIcon/>
                                            </button>

                                            <span className="font-bold text-base leading-[21px] text-[#4C2E24] font-['Poppins']">
                                                {item.quantity}
                                            </span>

                                            <button
                                                onClick={() => updateQuantity(item.id, 1)}
                                                className="flex flex-col justify-center items-center p-[6px] gap-5 w-[23px] h-[23px] bg-white rounded-[24px] hover:scale-110 hover:bg-[var(--accent)] transition-all"
                                            >
                                                <svg
                                                    width="13.41"
                                                    height="13.41"
                                                    viewBox="0 0 14 14"
                                                    fill="none"
                                                >
                                                    <path
                                                        d="M7 1V13M1 7H13"
                                                        stroke="#4C2E24"
                                                        strokeWidth="3"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Order Summary */}
                <div className="flex-shrink-0 h-[306px] pt- border-t-2 rounded-[12px] border-[var(--accent)]">
                    <div className="flex justify-between h-[39px] text-[var(--secondary)] text-[14px] font-medium px-3 py-[6px] items-end">
                        <span>Subtotal</span>
                        <span>{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between h-[33px] text-[var(--secondary)] text-[14px] font-medium px-3 py-[6px]">
                        <span>Tax</span>
                        <span>00.00</span>
                    </div>
                    <div className="flex justify-between h-[33px] text-[var(--secondary)] text-[14px] font-medium px-3 py-[6px]">
                        <span>Discount</span>
                        <span>00.00</span>
                    </div>
                    <div className="gap-2 p-3">
                        <InputField />
                    </div>
                    <div className="border-t-1 border-dashed border-[var(--accent)] h-[135px]">
                        <div className="flex justify-between font-semibold text-lg h-[62px] p-3 items-center">
                            <span>Total</span>
                            <span>{total.toFixed(2)}</span>
                        </div>

                        {/* Place Order Button */}
                        <button className="w-full bg-[var(--accent)] text-white py-4 font-semibold text-lg hover:bg-[var(--accent)]/90 hover:shadow-lg hover:scale-[1.02] transition-all h-16">
                            PLACE ORDER
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
