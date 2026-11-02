import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[#F7F8F5] text-[#171B16] flex flex-col antialiased">
      {/* ── Top Header Skeleton ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8EBE5] h-16 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="hidden md:flex items-center gap-2 p-1 bg-[#F7F8F5] rounded-full border border-[#E8EBE5]">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-9 h-9 rounded-full" />
          </div>
        </div>
      </header>

      {/* ── Content Body Skeleton ── */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 flex-1">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-3xl p-5 border border-[#E8EBE5] space-y-3 shadow-xs">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-7 w-36 rounded-lg" />
              <Skeleton className="h-3 w-44 rounded" />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-[#E8EBE5] space-y-4 shadow-xs">
          <Skeleton className="h-6 w-36 rounded-md" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-2.5 gap-3 border-b border-[#F0F2ED] last:border-b-0 animate-pulse">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-[14px] bg-[#E2E6DE] shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="h-4 w-32 bg-[#E2E6DE] rounded-md" />
                    <div className="h-3 w-20 bg-[#E2E6DE] rounded-md" />
                  </div>
                </div>
                <div className="h-4 w-24 bg-[#E2E6DE] rounded-md shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
