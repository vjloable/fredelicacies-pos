'use client';

import { useState } from "react";
import HomeIcon from "@/components/icons/HomeIcon";
import HorizontalLogo from "@/components/icons/HorizontalLogo";
import InventoryIcon from "@/components/icons/InventoryIcon";
import OrderHistoryIcon from "@/components/icons/OrderHistory";
import LogsIcon from "@/components/icons/LogsIcon";

export default function Home() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([
    { id: 1, name: 'Item Title', price: 50.00, quantity: 1 },
    { id: 2, name: 'Item Title', price: 50.00, quantity: 1 },
    { id: 3, name: 'Item Title', price: 50.00, quantity: 1 },
    { id: 4, name: 'Item Title', price: 50.00, quantity: 1 },
  ]);

  const categories = ['All', 'Category Titleç', 'Category Title', 'Category Title', 'Category Title'];
  const menuItems = Array(8).fill(null).map((_, i) => ({ id: i, name: 'Name', price: 0.00 }));

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal;

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

  const updateQuantity = (id: number, delta: number) => {
    setCart(cart.map(item => 
      item.id === id 
        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
        : item
    ).filter(item => item.quantity > 0));
  };

  return (
    <div className="flex h-screen bg-[var(--background)]">
      {/* Drawer Overlay */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleDrawer}
        />
      )}

      {/* Left Sidebar/Drawer */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        transform ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        transition-transform duration-300 ease-in-out
        w-[271px] bg-[var(--primary)] border-r border-gray-200
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center border-b border-gray-200 h-[90px] px-6">
            <HorizontalLogo/>
          </div>

          {/* Navigation */}
          <nav className="flex-1">
            <ul className="space-y-2">
              <li>
                <a href="#" className="flex h-12 items-center gap-3 text-[var(--secondary)] bg-[var(--light-accent)] font-bold">
                  <HomeIcon className="w-12 h-12 mx-3 gap-3" />
                  Home
                </a>
              </li>
              <li>
                <a href="#" className="flex h-12 items-center gap-3 text-[var(--secondary)] bg-[var(--primary)] font-bold">
                  <InventoryIcon className="w-12 h-12 mx-3 gap-3" />
                  Inventory
                </a>
              </li>
              <li>
                <a href="#" className="flex h-12 items-center gap-3 text-[var(--secondary)] bg-[var(--primary)] font-bold">
                  <OrderHistoryIcon className="w-12 h-12 mx-3 gap-3" />
                  Order History
                </a>
              </li>
              <li>
                <a href="#" className="flex h-12 items-center gap-3 text-[var(--secondary)] bg-[var(--primary)] font-bold">
                  <LogsIcon className="w-12 h-12 mx-3 gap-3" />
                  Logs
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-row lg:ml-0">

        <div className="flex-1 flex h-full">
          {/* Menu Area */}
          <div className="flex flex-col flex-1 p-6 gap-y-3">

            <div className="flex items-center justify-between h-14">
              <div className="flex-col items-center gap-4">
                <button
                  onClick={toggleDrawer}
                  className="lg:hidden p-2 text-[var(--secondary)] hover:bg-gray-100 rounded-lg"
                >
                  <span className="w-6 h-1 color-[var(--accent)]">☰</span>
                </button>
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 bg-[var(--primary)] rounded-xl flex justify-center items-end">
                    {/* <button onClick={toggleDrawer} className="lg:hidden p-2 text-[var(--secondary)] hover:bg-gray-100 rounded-lg"> */}
                      <span className=" text-[var(--secondary)] text-[42px] flex">☰</span>
                    {/* </button> */}
                  </div>
                  <div className="flex-0 h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] font-medium gap-3 items-center">
                    <span className="w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm">W</span>
                    Worker
                  </div>
                  <div className="h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] font-medium gap-3 items-center">
                    <span className="w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm">C</span>
                    Wed, 29 May 2024
                  </div>
                  -
                  <div className="h-14 px-3 py-3 text-center flex bg-[var(--primary)] rounded-xl text-[var(--secondary)] font-medium gap-3 items-center">
                    <span className="w-8 h-8 bg-[var(--light-accent)] rounded-full flex items-center justify-center text-[var(--secondary)] font-bold text-sm">T</span>
                    07:59 AM
                  </div>
                </div>
              </div>
            </div>
            {/* Categories */}
            <h2 className="text-[var(--secondary)] text-[16px] font-bold">Category</h2>
            <div className="flex gap-4 flex-wrap">
              {categories.map((category, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedCategory(category)}
                  className={`
                    w-45 h-35 rounded-xl flex flex-col items-center justify-center
                    ${selectedCategory === category 
                      ? 'bg-[var(--accent)] text-white' 
                      : 'bg-[var(--primary)] text-[var(--secondary)] border-2 border-gray-200'
                    }
                    hover:shadow-md transition-all
                  `}
                >
                  <div className="w-8 h-8 bg-current opacity-20 rounded-full mb-1"></div>
                  <span className="text-xs text-center">{category}</span>
                  <span className="text-xs opacity-70">Items</span>
                </div>
              ))}
            </div>

            {/* Menu Items */}
            
            <div className="flex items-center justify-between">
              <h2 className="text-[var(--secondary)] font-bold">Menu</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {menuItems.map((item, index) => (
                <div
                  key={index}
                  className={`
                    bg-[var(--primary)] rounded-lg p-4 border-2 cursor-pointer
                    hover:shadow-md transition-all
                    ${index === 0 ? 'border-[var(--accent)]' : 'border-gray-200'}
                  `}
                >
                  <div className="w-full h-24 bg-gray-100 rounded-lg mb-3"></div>
                  <h3 className="font-medium text-[var(--secondary)] mb-1">{item.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 rounded">Name</span>
                    <span className="font-semibold text-[var(--secondary)]">{item.price.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side Panel - Order Summary */}
          <div className="flex-col shadow-lg bg-[var(--primary)]">
            <div className="w-104 h-[90px] bg-[var(--primary)] border-l border-gray-200 shadow-lg">
              <div className="flex items-center gap-3 p-3">
                <div className="bg-[var(--light-accent)] w-16 h-16 rounded-full"></div>
                <div className="flex flex-1 flex-col items-center justify-space-between">
                  <span className="text-[var(--secondary)] font-medium text-[16px]">Order Title</span>
                  <span className="text-[var(--secondary)] font-light text-[12px]">Order Number: #001</span>
                </div>
                <div className="bg-[var(--light-accent)] w-16 h-16 rounded-full"></div>
              </div>
            </div>

            <div>
              <div className="h-16 p-3">
                <div className="flex items-center justify-between bg-[var(--background)] rounded-[12px] gap-3">
                  <span  className="text-[var(--secondary)]/50 font-regular font-[14px] w-full text-end">Dine In</span>
                  <div className="bg-[var(--light-accent)] w-[42px] h-[42px] rounded-full"></div>
                </div>
              </div>

              {/* Cart Items */}
              <div className="space-y-4 mb-6">
                {cart.map((item) => (
                  <div key={item.id} className="border-b border-gray-200 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-[var(--secondary)]">{item.name}</span>
                      <button className="text-[var(--accent)] hover:bg-gray-100 p-1 rounded">✏️</button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--accent)] font-semibold">{item.price.toFixed(2)}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-[var(--secondary)]">Subtotal</span>
                  <span className="font-semibold">{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--secondary)]">Tax</span>
                  <span className="font-semibold">00.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--secondary)]">Discount</span>
                  <span className="font-semibold">00.00</span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="Discount Coupon Code"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <button className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
                      ✓
                    </button>
                  </div>
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Place Order Button */}
              <button className="w-full bg-[var(--accent)] text-white py-4 rounded-lg font-semibold text-lg hover:bg-[var(--accent)]/90 transition-colors">
                PLACE ORDER
              </button>
            </div>
          </div>  
        </div>
      </div>
    </div>
  );
}
