'use client';

import DrawerProvider from '@/components/DrawerProvider';
import AuthGuard from '@/components/AuthGuard';
import { BluetoothProvider } from '@/contexts/BluetoothContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <AuthGuard>
      <BluetoothProvider>
        <DrawerProvider>
          <div className="flex flex-col h-full overflow-hidden">
            <main className="flex-1 overflow-auto bg-gray-50">
              {children}
            </main>
          </div>
        </DrawerProvider>
      </BluetoothProvider>
    </AuthGuard>
  );
}
