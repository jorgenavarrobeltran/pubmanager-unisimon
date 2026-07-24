'use client';

import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import AIChatWidget from '@/components/AIChatWidget';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname.startsWith('/login');

  return (
    <AuthProvider>
      {isLoginPage ? (
        children
      ) : (
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
          <AIChatWidget />
        </div>
      )}
    </AuthProvider>
  );
}

