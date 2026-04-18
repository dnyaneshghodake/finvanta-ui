'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header, Sidebar } from '@/components/layout';
import { useAuthStore } from '@/store/authStore';

/**
 * Authenticated layout for dashboard and other pages
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, loadUserFromStorage } = useAuthStore();

  useEffect(() => {
    // Load user from storage on mount
    loadUserFromStorage();
  }, [loadUserFromStorage]);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated && typeof window !== 'undefined') {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
