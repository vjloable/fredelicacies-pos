'use client';

import DrawerProvider from '@/components/DrawerProvider';
import AuthGuard from '@/components/AuthGuard';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <AuthGuard>
      <DrawerProvider>
        <div className="flex flex-col h-full overflow-hidden">
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </DrawerProvider>
    </AuthGuard>
  );
}
