"use client";

import LogsIcon from "@/components/icons/SidebarNav/LogsIcon";
import TopBar from "@/components/TopBar";
import MobileTopBar from "@/components/MobileTopBar";

// Web Bluetooth API type declarations
declare global {
	interface Navigator {
		bluetooth?: Bluetooth;
	}

	interface Bluetooth {
		requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
	}

	interface BluetoothDevice {
		id: string;
		name?: string;
		gatt?: BluetoothRemoteGATTServer;
	}

	interface BluetoothRemoteGATTServer {
		connected: boolean;
		connect(): Promise<BluetoothRemoteGATTServer>;
		disconnect(): void;
		getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
		getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
	}

	interface BluetoothRemoteGATTService {
		uuid: string;
		getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
		getCharacteristic(
			characteristic: string
		): Promise<BluetoothRemoteGATTCharacteristic>;
	}

	interface BluetoothRemoteGATTCharacteristic {
		uuid: string;
		properties: {
			write: boolean;
			writeWithoutResponse: boolean;
		};
		writeValue(value: ArrayBuffer | ArrayBufferView): Promise<void>;
		writeValueWithoutResponse(
			value: ArrayBuffer | ArrayBufferView
		): Promise<void>;
	}

	interface RequestDeviceOptions {
		acceptAllDevices?: boolean;
		optionalServices?: string[];
	}
}

export default function LogsScreen() {
	// const [isConnecting, setIsConnecting] = useState(false);
	// const [isPrinting, setIsPrinting] = useState(false);
	// const [status, setStatus] = useState<string>('');
	// const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDevice | null>(null);

	// const createTestReceipt = (): Uint8Array => {
	//   let receipt = '';

	//   // Initialize printer
	//   receipt += ESC + '@'; // Initialize printer

	//   // Set alignment to center
	//   receipt += ESC + 'a' + '\x01';

	//   // Print store header
	//   receipt += ESC + '!' + '\x18'; // Double height and width
	//   receipt += 'FOODMOOD POS\n';
	//   receipt += ESC + '!' + '\x00'; // Normal text
	//   receipt += 'Test Receipt\n';
	//   receipt += '===============================\n';

	//   // Set alignment to left
	//   receipt += ESC + 'a' + '\x00';

	//   // Print current date/time
	//   const now = new Date();
	//   receipt += `Date: ${now.toLocaleDateString()}\n`;
	//   receipt += `Time: ${now.toLocaleTimeString()}\n`;
	//   receipt += '-------------------------------\n';

	//   // Sample items
	//   receipt += 'ITEMS:\n';
	//   receipt += 'Burger               x1  250.00 Php\n';
	//   receipt += 'French Fries         x1  80.00 Php\n';
	//   receipt += 'Soft Drink           x1  45.00 Php\n';
	//   receipt += '-------------------------------\n';

	//   // Totals
	//   receipt += 'SUBTOTAL:               375.00 Php\n';
	//   receipt += 'TAX (12%):              45.00 Php\n';
	//   receipt += ESC + '!' + '\x08'; // Emphasized text
	//   receipt += 'TOTAL:                  420.00 Php\n';
	//   receipt += ESC + '!' + '\x00'; // Normal text

	//   receipt += '===============================\n';

	//   // Center alignment for footer
	//   receipt += ESC + 'a' + '\x01';
	//   receipt += 'Thank you for your business!\n';
	//   receipt += 'Please come again!\n';
	//   receipt += '\n';

	//   // Cut paper
	//   receipt += '\n\n\n';
	//   receipt += GS + 'V' + 'A' + '\x00'; // Full cut

	//   // Convert to Uint8Array
	//   const encoder = new TextEncoder();
	//   return encoder.encode(receipt);
	// };

	return (
		<div className='flex h-full overflow-hidden'>
			{/* Main Content Area */}
			<div className='flex flex-col flex-1 h-full overflow-hidden'>
				{/* Header Section - Fixed */}
				{/* Mobile/Tablet TopBar - visible below xl: breakpoint (< 1280px) */}
				<div className='xl:hidden w-full'>
					<MobileTopBar title='Logs' icon={<LogsIcon />} />
				</div>
				{/* Desktop TopBar - visible at xl: breakpoint and above (≥ 1280px) */}
				<div className='hidden xl:block w-full'>
					<TopBar title='Logs' icon={<LogsIcon />} />
				</div>

					{/* Main Content - Scrollable */}
					<div className='flex-1 overflow-y-auto px-6 pb-6'>
						<div className='flex items-center justify-center h-full'>
							<div className='text-center max-w-md w-full'>
								<div className='w-24 h-24 bg-light-accent rounded-full mx-auto mb-4 flex items-center justify-center'>
									<svg
										className='w-12 h-12 text-accent'
										fill='currentColor'
										viewBox='0 0 20 20'>
										<path
											fillRule='evenodd'
											d='M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z'
											clipRule='evenodd'
										/>
									</svg>
								</div>
								<h2 className='text-lg font-semibold text-secondary mb-2'>
									Logs Page
								</h2>
								<p className='text-secondary opacity-70 mb-8'>
									This page is ready for system logs and activity tracking.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
	);
}
