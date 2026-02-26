"use client";

import { useState, useEffect } from "react";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
	AppSettings,
	loadSettingsFromLocal,
	saveSettingsToLocal,
	loadSettings,
	syncSettingsToBackend,
} from "@/services/settingsService";
import SettingsIcon from "@/components/icons/SidebarNav/SettingsIcon";
import { useBluetoothPrinter } from "@/contexts/BluetoothContext";

export default function SettingsScreen() {
	const [settings, setSettings] = useState<AppSettings>({
		hideOutOfStock: false,
	});
	const [savedSettings, setSavedSettings] = useState<AppSettings>({
		hideOutOfStock: false,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [isSyncing, setIsSyncing] = useState(false);
	const [syncStatus, setSyncStatus] = useState<
		"idle" | "success" | "error" | "created"
	>("idle");
	const [syncMessage, setSyncMessage] = useState("");

	// Use Bluetooth context
	const {
		bluetoothDevice,
		bluetoothStatus,
		isConnecting,
		connectToBluetoothPrinter,
		disconnectPrinter,
		testPrint,
	} = useBluetoothPrinter();

	// Check if there are unsaved changes
	const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

	// Load settings on component mount
	useEffect(() => {
		const loadSettingsData = async () => {
			try {
				// Use cached settings (will auto-refresh if cache is older than 1 hour)
				const cachedSettings = await loadSettings();
				setSettings(cachedSettings);
				setSavedSettings(cachedSettings);
				console.log("✅ Settings loaded (cached or refreshed)");
			} catch (error) {
				// Fallback to localStorage
				console.log("Error loading settings:", error);
				const localSettings = loadSettingsFromLocal();
				setSettings(localSettings);
				setSavedSettings(localSettings);
			} finally {
				setIsLoading(false);
			}
		};

		loadSettingsData();
	}, []);

	const handleHideOutOfStockToggle = () => {
		setSettings((prev) => ({ ...prev, hideOutOfStock: !prev.hideOutOfStock }));
	};

	const handleSave = () => {
		saveSettingsToLocal(settings);
		setSavedSettings(settings);
	};

	const handleCancel = () => {
		setSettings(savedSettings);
	};

	const handleSync = async () => {
		setIsSyncing(true);
		setSyncStatus("idle");
		setSyncMessage("");

		try {
			// Use current settings (which may include unsaved changes)
			const settingsToSync = hasChanges ? settings : savedSettings;

			const result = await syncSettingsToBackend(settingsToSync);

			// If we synced unsaved changes, update savedSettings to match
			if (hasChanges) {
				saveSettingsToLocal(settings);
				setSavedSettings(settings);
			}

			// Force refresh settings from backend to ensure sync
			const refreshedSettings = await loadSettings(true);
			setSettings(refreshedSettings);
			setSavedSettings(refreshedSettings);

			if (result.isNew) {
				setSyncStatus("created");
				setSyncMessage("Settings created in cloud successfully!");
			} else {
				setSyncStatus("success");
				setSyncMessage("Settings synced to cloud successfully!");
			}

			// Clear status after 3 seconds
			setTimeout(() => {
				setSyncStatus("idle");
				setSyncMessage("");
			}, 3000);
		} catch (error) {
			console.log("Error syncing settings:", error);
			setSyncStatus("error");
			setSyncMessage("Failed to sync settings to cloud. Please try again.");

			// Clear error status after 5 seconds
			setTimeout(() => {
				setSyncStatus("idle");
				setSyncMessage("");
			}, 5000);
		} finally {
			setIsSyncing(false);
		}
	};

	return (
		<div className='flex h-full overflow-hidden'>
			{/* Main Content Area */}
			<div className='flex flex-col flex-1 h-full overflow-hidden'>
				{/* Header Section - Fixed */}
				{/* Mobile/Tablet TopBar - visible below xl: breakpoint (< 1280px) */}
				<div className='xl:hidden w-full'>
					<MobileTopBar title='Settings' icon={<SettingsIcon />} />
				</div>
				{/* Desktop TopBar - visible at xl: breakpoint and above (≥ 1280px) */}
				<div className='hidden xl:block w-full'>
					<TopBar title='Settings' icon={<SettingsIcon />} />
				</div>

				{isLoading && (
					<div className='flex-1 flex items-center justify-center'>
						<LoadingSpinner />
					</div>
				)}

				{!isLoading && (
					<div className='flex-1 overflow-y-auto px-6 pb-6'>
						<div className='max-w-6xl mx-auto pt-8'>
							{/* Two Column Layout */}
							<div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
								{/* Left Column - Preferences */}
								<div className='space-y-6'>
									<div className='mb-6'>
										<h2 className='text-xl font-bold text-secondary mb-2'>
											Preferences
										</h2>
										<p className='text-secondary opacity-70'>
											Customize your app experience and display settings.
										</p>
									</div>

									{/* Menu Display Setting */}
									<div className='bg-white rounded-lg p-6 shadow-sm border border-gray-100'>
										<h3 className='text-base font-semibold text-secondary mb-4'>
											Menu Display
										</h3>
										<div className='flex items-center justify-between'>
											<div className='flex-1'>
												<label
													htmlFor='hide-out-of-stock'
													className='block text-xs font-medium text-secondary'>
													Hide Out-of-Stock Items
												</label>
												<p className='text-xs text-gray-500 mt-1'>
													Hide items with zero stock from the store menu
												</p>
											</div>
											<div className='flex items-center'>
												<button
													type='button'
													className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
														settings.hideOutOfStock
															? "bg-accent"
															: "bg-gray-200"
													}`}
													onClick={handleHideOutOfStockToggle}>
													<span
														className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
															settings.hideOutOfStock
																? "translate-x-6"
																: "translate-x-1"
														}`}
													/>
												</button>
											</div>
										</div>
									</div>

									{/* Save/Sync Actions */}
									<div className='bg-white rounded-lg p-6 shadow-sm border border-gray-100'>
										<h3 className='text-base font-semibold text-secondary mb-4'>
											Save & Sync
										</h3>

										{/* Action Buttons */}
										<div className='space-y-3'>
											{/* Local Save/Cancel Row */}
											<div className='flex gap-3'>
												<button
													onClick={handleSave}
													disabled={!hasChanges}
													className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
														hasChanges
															? "bg-accent text-white hover:bg-accent/90"
															: "bg-gray-100 text-gray-400 cursor-not-allowed"
													}`}>
													Save Locally
												</button>
												{hasChanges && (
													<button
														onClick={handleCancel}
														className='px-4 py-2 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors'>
														Cancel
													</button>
												)}
											</div>

											{/* Cloud Sync Button */}
											<button
												onClick={handleSync}
												disabled={isSyncing}
												className={`w-full px-4 py-2 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
													syncStatus === "success"
														? "bg-(--success)/10 text-(--success) border border-(--success)"
														: syncStatus === "created"
														? "bg-secondary/10 text-secondary border border-secondary"
														: syncStatus === "error"
														? "bg-(--error)/10 text-(--error) border border-(--error)"
														: isSyncing
														? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
														: "bg-white text-secondary border border-gray-300 hover:bg-gray-50"
												}`}>
												{isSyncing ? (
													<>
														<div className='w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin'></div>
														Syncing...
													</>
												) : syncStatus === "success" ? (
													<>
														Synced to Cloud
													</>
												) : syncStatus === "created" ? (
													<>
														Created in Cloud
													</>
												) : syncStatus === "error" ? (
													<>
														Sync Failed
													</>
												) : (
													<>
														Sync to Cloud
													</>
												)}
											</button>
										</div>

										{/* Status Messages */}
										{syncMessage && (
											<div
												className={`mt-2 p-2 rounded-md text-xs text-center transition-all duration-200 ${
													syncStatus === "success"
														? "bg-(--success)/10 text-(--success) border border-(--success)"
														: syncStatus === "created"
														? "bg-secondary/10 text-secondary border border-secondary"
														: syncStatus === "error"
														? "bg-(--error)/10 text-(--error) border border-(--error)"
														: "bg-gray-50 text-gray-600 border border-gray-200"
												}`}>
												{syncMessage}
											</div>
										)}

										{hasChanges && (
											<p className='text-xs text-secondary mt-2 text-center'>
												Sync will save and upload your current changes to
												cloud
											</p>
										)}
									</div>
								</div>

								{/* Right Column - Utilities */}
								<div className='space-y-6'>
									<div className='mb-6'>
										<h2 className='text-xl font-bold text-secondary mb-2'>
											Utilities
										</h2>
										<p className='text-secondary opacity-70'>
											Hardware connections and system utilities.
										</p>
									</div>

									{/* Bluetooth Printer Section */}
									<div className='bg-white rounded-lg p-6 shadow-sm border border-gray-100'>
										<h3 className='text-base font-semibold text-secondary mb-4 flex items-center gap-2'>
											Bluetooth
										</h3>

										<p className='text-xs text-secondary opacity-70 mb-4'>
											Connect to a thermal receipt printer. Once connected,
											receipts will automatically print when orders are
											confirmed.
										</p>

										{/* Bluetooth Status Display */}
										{bluetoothStatus && (
											<div className='mb-4 p-3 bg-gray-50 rounded-lg border'>
												<p className='text-xs text-secondary'>
													{bluetoothStatus}
												</p>
											</div>
										)}

										{/* Connection Status Indicator */}
										<div className='mb-4'>
											<div
												className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
													bluetoothDevice
														? "bg-green-100 text-green-800"
														: "bg-gray-100 text-gray-600"
												}`}>
												<div
													className={`w-2 h-2 rounded-full mr-2 ${
														bluetoothDevice ? "bg-green-400" : "bg-gray-400"
													}`}></div>
												{bluetoothDevice
													? `Connected: ${bluetoothDevice.name || "Unknown"}`
													: "Not Connected"}
											</div>
										</div>

										{/* Action Buttons */}
										<div className='space-y-3'>
											{!bluetoothDevice ? (
												<button
													onClick={connectToBluetoothPrinter}
													disabled={isConnecting}
													className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
														isConnecting
															? "bg-gray-300 text-gray-500 cursor-not-allowed"
															: "bg-accent hover:bg-secondary/80 text-white hover:shadow-lg"
													}`}>
													{isConnecting ? (
														<div className='flex items-center justify-center'>
															<div className='animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2'></div>
															Connecting...
														</div>
													) : (
														"Connect Printer"
													)}
												</button>
											) : (
												<>
													<button
														onClick={testPrint}
														className='w-full py-2 px-4 rounded-lg font-medium bg-(--success) hover:bg-(--success)/50 text-secondary hover:shadow-lg transition-all'>
														Test Print
													</button>
													<button
														onClick={disconnectPrinter}
														className='w-full py-2 px-4 rounded-lg font-medium bg-(--error) hover:bg-(--error)/50 text-primary hover:shadow-lg transition-all'>
														Disconnect
													</button>
												</>
											)}
										</div>

										{/* Instructions */}
										<div className='mt-6 p-4 bg-secondary/5 rounded-lg border border-secondary/20'>
											<h4 className='font-medium text-secondary mb-2 text-xs'>
												How to use:
											</h4>
											<ul className='text-xs text-secondary opacity-70 space-y-1'>
												<li>• Put your thermal printer in pairing mode</li>
												<li>
													• Click {"Connect Printer"} and select your device
												</li>
												<li>• Use {"Test Print"} to verify the connection</li>
												<li>
													• Once connected, receipts will auto-print on order
													confirmation
												</li>
												<li>
													• Connection persists until manually disconnected
												</li>
											</ul>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
