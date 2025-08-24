'use client';

import { useState } from "react";
import LogsIcon from "@/components/icons/SidebarNav/LogsIcon";
import TopBar from "@/components/TopBar";

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
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
  }
  
  interface BluetoothRemoteGATTCharacteristic {
    uuid: string;
    properties: {
      write: boolean;
      writeWithoutResponse: boolean;
    };
    writeValue(value: ArrayBuffer | ArrayBufferView): Promise<void>;
    writeValueWithoutResponse(value: ArrayBuffer | ArrayBufferView): Promise<void>;
  }
  
  interface RequestDeviceOptions {
    acceptAllDevices?: boolean;
    optionalServices?: string[];
  }
}

export default function LogsScreen() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDevice | null>(null);

  // ESC/POS Commands
  const ESC = '\x1B';
  const GS = '\x1D';
  
  const createTestReceipt = (): Uint8Array => {
    let receipt = '';
    
    // Initialize printer
    receipt += ESC + '@'; // Initialize printer
    
    // Set alignment to center
    receipt += ESC + 'a' + '\x01';
    
    // Print store header
    receipt += ESC + '!' + '\x18'; // Double height and width
    receipt += 'FOODMOOD POS\n';
    receipt += ESC + '!' + '\x00'; // Normal text
    receipt += 'Test Receipt\n';
    receipt += '===============================\n';
    
    // Set alignment to left
    receipt += ESC + 'a' + '\x00';
    
    // Print current date/time
    const now = new Date();
    receipt += `Date: ${now.toLocaleDateString()}\n`;
    receipt += `Time: ${now.toLocaleTimeString()}\n`;
    receipt += '-------------------------------\n';
    
    // Sample items
    receipt += 'ITEMS:\n';
    receipt += 'Burger               x1  250.00 Php\n';
    receipt += 'French Fries         x1  80.00 Php\n';
    receipt += 'Soft Drink           x1  45.00 Php\n';
    receipt += '-------------------------------\n';
    
    // Totals
    receipt += 'SUBTOTAL:               375.00 Php\n';
    receipt += 'TAX (12%):              45.00 Php\n';
    receipt += ESC + '!' + '\x08'; // Emphasized text
    receipt += 'TOTAL:                  420.00 Php\n';
    receipt += ESC + '!' + '\x00'; // Normal text
    
    receipt += '===============================\n';
    
    // Center alignment for footer
    receipt += ESC + 'a' + '\x01';
    receipt += 'Thank you for your business!\n';
    receipt += 'Please come again!\n';
    receipt += '\n';
    
    // Cut paper
    receipt += '\n\n\n';
    receipt += GS + 'V' + 'A' + '\x00'; // Full cut
    
    // Convert to Uint8Array
    const encoder = new TextEncoder();
    return encoder.encode(receipt);
  };

  const connectToBluetoothPrinter = async () => {
    if (!navigator.bluetooth) {
      setStatus('Bluetooth not supported in this browser');
      return;
    }

    setIsConnecting(true);
    setStatus('Scanning for Bluetooth printers...');

    try {
      // Request Bluetooth device with more comprehensive service list
      const device = await navigator.bluetooth.requestDevice({
        // Expanded list of service UUIDs for various thermal printer brands
        optionalServices: [
          // Serial Port Profile
          '00001101-0000-1000-8000-00805f9b34fb',
          // Custom printer services
          '000018f0-0000-1000-8000-00805f9b34fb',
          '0000ff00-0000-1000-8000-00805f9b34fb', 
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          // Additional common printer services
          '0000fff0-0000-1000-8000-00805f9b34fb',
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          // Generic services that some printers use
          '12345678-1234-5678-1234-123456789abc',
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
        ],
        acceptAllDevices: true
      });

      // Log device info for debugging
      console.log('Connected device:', {
        id: device.id,
        name: device.name,
        gatt: !!device.gatt
      });

      setBluetoothDevice(device);
      setStatus(`Connected to: ${device.name || 'Unknown Printer'} - Analyzing services...`);
      
      // Try to connect and discover services immediately
      if (device.gatt) {
        try {
          const server = await device.gatt.connect();
          const services = await server.getPrimaryServices();
          console.log('Available services:', services.map(s => s.uuid));
          setStatus(`Connected to: ${device.name || 'Unknown Printer'} - Found ${services.length} services`);
        } catch (e) {
          console.warn('Could not analyze services:', e);
          setStatus(`Connected to: ${device.name || 'Unknown Printer'} - Ready to print`);
        }
      }
      
    } catch (error: any) {
      console.error('Bluetooth connection error:', error);
      setStatus(`Connection failed: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const printTestReceipt = async () => {
    if (!bluetoothDevice) {
      setStatus('No printer connected');
      return;
    }

    setIsPrinting(true);
    setStatus('Connecting to printer...');

    try {
      // Connect to GATT server
      const server = await bluetoothDevice.gatt?.connect();
      if (!server) {
        throw new Error('Failed to connect to GATT server');
      }

      setStatus('Discovering printer services...');

      // Get all available services first
      let allServices: BluetoothRemoteGATTService[] = [];
      try {
        allServices = await server.getPrimaryServices();
        console.log('All available services:', allServices.map((s: BluetoothRemoteGATTService) => s.uuid));
      } catch (e) {
        console.warn('Could not get all services, trying individual services');
      }

      // Comprehensive list of service UUIDs to try
      const serviceUUIDs = [
        // Serial Port Profile (most common)
        '00001101-0000-1000-8000-00805f9b34fb',
        // Custom printer services
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb', 
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000fff0-0000-1000-8000-00805f9b34fb',
        // Nordic UART Service (used by many modern printers)
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        // If we found services, try them too
        ...allServices.map((s: BluetoothRemoteGATTService) => s.uuid)
      ];

      let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
      let foundServiceUUID = '';

      // Try each service UUID
      for (const serviceUUID of serviceUUIDs) {
        try {
          setStatus(`Trying service: ${serviceUUID.slice(0, 8)}...`);
          
          const service = await server.getPrimaryService(serviceUUID);
          const characteristics = await service.getCharacteristics();
          
          console.log(`Service ${serviceUUID} characteristics:`, 
            characteristics.map(c => ({
              uuid: c.uuid,
              properties: c.properties
            }))
          );
          
          // Look for writable characteristic
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              characteristic = char;
              foundServiceUUID = serviceUUID;
              console.log(`Found writable characteristic: ${char.uuid} in service: ${serviceUUID}`);
              break;
            }
          }
          
          if (characteristic) break;
          
          // If no writable characteristic found, try the first available one
          if (characteristics.length > 0) {
            characteristic = characteristics[0];
            foundServiceUUID = serviceUUID;
            console.log(`Using first available characteristic: ${characteristic.uuid}`);
            break;
          }
          
        } catch (e) {
          console.log(`Service ${serviceUUID} not available:`, e);
          continue;
        }
      }

      if (!characteristic) {
        // Last resort: try to find ANY characteristic that might work
        try {
          for (const service of allServices) {
            const chars = await service.getCharacteristics();
            if (chars.length > 0) {
              characteristic = chars[0];
              foundServiceUUID = service.uuid;
              console.log(`Last resort: using characteristic ${characteristic.uuid} from service ${service.uuid}`);
              break;
            }
          }
        } catch (e) {
          console.error('Last resort failed:', e);
        }
      }

      if (!characteristic) {
        throw new Error(`No writable characteristic found. Device may not be a supported printer. Found services: ${allServices.map((s: BluetoothRemoteGATTService) => s.uuid.slice(0, 8)).join(', ')}`);
      }

      setStatus(`Found printer interface! Sending test receipt...`);

      // Create and send test receipt
      const receiptData = createTestReceipt();
      
      // Try different chunk sizes and methods
      const chunkSizes = [20, 64, 128, 512];
      let success = false;

      for (const chunkSize of chunkSizes) {
        try {
          setStatus(`Printing with ${chunkSize}-byte chunks...`);
          
          // Send data in chunks
          for (let i = 0; i < receiptData.length; i += chunkSize) {
            const chunk = receiptData.slice(i, i + chunkSize);
            
            // Try writeWithoutResponse first (faster), then write
            if (characteristic.properties.writeWithoutResponse) {
              await characteristic.writeValueWithoutResponse(chunk);
            } else if (characteristic.properties.write) {
              await characteristic.writeValue(chunk);
            } else {
              // Force write anyway
              await characteristic.writeValue(chunk);
            }
            
            // Small delay between chunks
            await new Promise(resolve => setTimeout(resolve, 5));
          }
          
          success = true;
          break;
          
        } catch (chunkError) {
          console.warn(`Failed with chunk size ${chunkSize}:`, chunkError);
          if (chunkSize === chunkSizes[chunkSizes.length - 1]) {
            throw chunkError;
          }
        }
      }

      if (success) {
        setStatus(`Test receipt sent successfully! (Service: ${foundServiceUUID.slice(0, 8)}...)`);
      }
      
    } catch (error: any) {
      console.error('Printing error:', error);
      setStatus(`Printing failed: ${error.message}`);
      
      // Add troubleshooting info
      setTimeout(() => {
        setStatus(`${error.message}\n\nTroubleshooting:\n• Try a different printer model\n• Ensure printer is in pairing mode\n• Check if printer supports ESC/POS commands`);
      }, 3000);
    } finally {
      setIsPrinting(false);
    }
  };

  const disconnectPrinter = () => {
    if (bluetoothDevice?.gatt?.connected) {
      bluetoothDevice.gatt.disconnect();
    }
    setBluetoothDevice(null);
    setStatus('Disconnected');
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        
        {/* Header Section - Fixed */}
        <TopBar title="Logs" icon={<LogsIcon />} />

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md w-full">
              <div className="w-24 h-24 bg-[var(--light-accent)] rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-12 h-12 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--secondary)] mb-2">Logs Page</h2>
              <p className="text-[var(--secondary)] opacity-70 mb-8">This page is ready for system logs and activity tracking.</p>
              
              {/* ...existing code... */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
