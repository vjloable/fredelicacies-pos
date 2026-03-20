'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';

// Web Bluetooth API type declarations
declare global {
  interface Navigator {
    bluetooth?: Bluetooth;
  }

  interface Bluetooth {
    requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
    getDevices?(): Promise<BluetoothDevice[]>;
  }

  interface BluetoothDevice extends EventTarget {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
    addEventListener(type: 'gattserverdisconnected', listener: (event: Event) => void): void;
    removeEventListener(type: 'gattserverdisconnected', listener: (event: Event) => void): void;
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

const PRINTER_SERVICES = [
  '00001101-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
];

interface BluetoothContextType {
  bluetoothDevice: BluetoothDevice | null;
  bluetoothStatus: string;
  isConnecting: boolean;
  connectToBluetoothPrinter: () => Promise<void>;
  disconnectPrinter: () => void;
  testPrint: () => Promise<void>;
  printReceipt: (receiptData: Uint8Array) => Promise<boolean>;
}

const BluetoothContext = createContext<BluetoothContextType | undefined>(undefined);

export const useBluetoothPrinter = () => {
  const context = useContext(BluetoothContext);
  if (!context) throw new Error('useBluetoothPrinter must be used within a BluetoothProvider');
  return context;
};

export const BluetoothProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDevice | null>(null);
  const [bluetoothStatus, setBluetoothStatus] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Cache writable characteristic — avoid re-discovering services on every print
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReconnectingRef = useRef(false);
  const deviceRef = useRef<BluetoothDevice | null>(null);

  // Keep deviceRef in sync so callbacks always see the latest device
  useEffect(() => { deviceRef.current = bluetoothDevice; }, [bluetoothDevice]);

  // ── GATT helpers ──────────────────────────────────────────────────────────

  const getWritableCharacteristic = async (
    device: BluetoothDevice
  ): Promise<BluetoothRemoteGATTCharacteristic | null> => {
    const server = await device.gatt!.connect();
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const chars = await service.getCharacteristics();
        const writable = chars.find(c => c.properties.write || c.properties.writeWithoutResponse);
        if (writable) return writable;
      } catch { /* service may not expose characteristics — skip */ }
    }
    return null;
  };

  const writeData = async (
    characteristic: BluetoothRemoteGATTCharacteristic,
    data: Uint8Array
  ): Promise<boolean> => {
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      try {
        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
        await new Promise(r => setTimeout(r, 50));
      } catch (err: any) {
        console.error('Write error:', err);
        return false;
      }
    }
    return true;
  };

  // ── Disconnect handler + auto-reconnect ───────────────────────────────────

  const handleDisconnected = useCallback(() => {
    const device = deviceRef.current;
    if (!device) return;

    console.log('Printer disconnected — scheduling reconnect...');
    characteristicRef.current = null;
    setBluetoothStatus('Printer disconnected — reconnecting...');

    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(async () => {
      if (isReconnectingRef.current) return;
      isReconnectingRef.current = true;
      try {
        const char = await getWritableCharacteristic(device);
        if (char) {
          characteristicRef.current = char;
          setBluetoothStatus(`Reconnected to ${device.name || 'printer'}`);
        }
      } catch {
        setBluetoothStatus(`${device.name || 'Printer'} out of range — will retry on next print`);
      } finally {
        isReconnectingRef.current = false;
      }
    }, 2000);
  }, []);

  // ── Silent reconnect via getDevices() ────────────────────────────────────

  const silentReconnect = useCallback(async (): Promise<boolean> => {
    if (!navigator.bluetooth?.getDevices) return false;
    const saved = localStorage.getItem('connectedPrinter');
    if (!saved) return false;

    let printerInfo: { id: string; name: string };
    try { printerInfo = JSON.parse(saved); } catch { return false; }

    try {
      const devices = await navigator.bluetooth.getDevices();
      const device = devices.find(d => d.id === printerInfo.id);
      if (!device) return false;

      const char = await getWritableCharacteristic(device);
      if (!char) return false;

      characteristicRef.current = char;

      if (deviceRef.current?.id !== device.id) {
        device.addEventListener('gattserverdisconnected', handleDisconnected);
        setBluetoothDevice(device);
      }

      setBluetoothStatus(`Reconnected to ${printerInfo.name}`);
      return true;
    } catch {
      return false;
    }
  }, [handleDisconnected]);

  // ── Ensure connected before any print ────────────────────────────────────

  const ensureConnected = useCallback(async (): Promise<BluetoothRemoteGATTCharacteristic | null> => {
    // Fast path — cached char and GATT still up
    if (characteristicRef.current && deviceRef.current?.gatt?.connected) {
      return characteristicRef.current;
    }

    // Try direct reconnect on current device object
    if (deviceRef.current) {
      try {
        const char = await getWritableCharacteristic(deviceRef.current);
        if (char) { characteristicRef.current = char; return char; }
      } catch { /* fall through */ }
    }

    // Fall back to getDevices() silent reconnect
    const ok = await silentReconnect();
    return ok ? characteristicRef.current : null;
  }, [silentReconnect]);

  // ── Public API ────────────────────────────────────────────────────────────

  const connectToBluetoothPrinter = async () => {
    if (!navigator.bluetooth) {
      setBluetoothStatus('Bluetooth not supported in this browser');
      return;
    }
    setIsConnecting(true);
    setBluetoothStatus('Scanning for Bluetooth printers...');
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES,
      });

      const char = await getWritableCharacteristic(device);
      if (!char) throw new Error('No writable characteristic found on this device');

      device.addEventListener('gattserverdisconnected', handleDisconnected);
      characteristicRef.current = char;
      setBluetoothDevice(device);
      localStorage.setItem('connectedPrinter', JSON.stringify({ id: device.id, name: device.name || 'Unknown Printer' }));
      setBluetoothStatus(`Connected to ${device.name || 'Unknown Printer'} — ready`);
    } catch (err: any) {
      setBluetoothStatus(`Connection failed: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectPrinter = () => {
    const device = deviceRef.current;
    if (device) {
      device.removeEventListener('gattserverdisconnected', handleDisconnected);
      if (device.gatt?.connected) device.gatt.disconnect();
    }
    characteristicRef.current = null;
    setBluetoothDevice(null);
    localStorage.removeItem('connectedPrinter');
    setBluetoothStatus('Disconnected');
  };

  const testPrint = async () => {
    if (!deviceRef.current) { setBluetoothStatus('No printer connected'); return; }
    setBluetoothStatus('Connecting...');
    const char = await ensureConnected();
    if (!char) { setBluetoothStatus('Could not reach printer'); return; }

    const data = new Uint8Array([
      0x1B, 0x40,
      0x1B, 0x61, 0x01,
      0x1D, 0x21, 0x11,
      ...new TextEncoder().encode('FREDELECACIES\n'),
      0x1D, 0x21, 0x00,
      0x1B, 0x61, 0x00,
      ...new TextEncoder().encode('\n'),
      ...new TextEncoder().encode('Test Receipt\n'),
      ...new TextEncoder().encode('Date: ' + new Date().toLocaleString() + '\n'),
      ...new TextEncoder().encode('\n'),
      ...new TextEncoder().encode('Bluetooth connection successful!\n'),
      ...new TextEncoder().encode('\n\n\n'),
      0x1D, 0x56, 0x00,
    ]);

    setBluetoothStatus('Printing...');
    const ok = await writeData(char, data);
    setBluetoothStatus(ok ? 'Test print sent!' : 'Print failed — try reconnecting');
  };

  const printReceipt = async (receiptData: Uint8Array): Promise<boolean> => {
    const char = await ensureConnected();
    if (!char) { console.error('printReceipt: no connected printer'); return false; }
    return writeData(char, receiptData);
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // On mount — silent reconnect to last known printer
    silentReconnect().then(ok => {
      if (!ok) {
        const saved = localStorage.getItem('connectedPrinter');
        if (saved) {
          try { setBluetoothStatus(`${JSON.parse(saved).name} not available. Click to reconnect.`); }
          catch { /* ignore */ }
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Reconnect when tab becomes visible or window gains focus
    const onVisible = () => {
      if (!document.hidden && deviceRef.current && !deviceRef.current.gatt?.connected) {
        silentReconnect();
      }
    };
    const onFocus = () => {
      if (deviceRef.current && !deviceRef.current.gatt?.connected) {
        silentReconnect();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [silentReconnect]);

  useEffect(() => {
    return () => { if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current); };
  }, []);

  return (
    <BluetoothContext.Provider value={{
      bluetoothDevice,
      bluetoothStatus,
      isConnecting,
      connectToBluetoothPrinter,
      disconnectPrinter,
      testPrint,
      printReceipt,
    }}>
      {children}
    </BluetoothContext.Provider>
  );
};
