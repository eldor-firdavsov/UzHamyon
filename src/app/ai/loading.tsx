import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AILoading() {
  return (
    <div className="h-dvh max-h-dvh bg-[#F7F8F5] text-[#171B16] flex flex-col overflow-hidden antialiased">
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
          <Skeleton className="w-9 h-9 rounded-full" />
        </div>
      </header>

      {/* ── Chat Container Skeleton ── */}
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 flex-1 flex flex-col min-h-0 pb-20 md:pb-6 overflow-hidden">
        <div className="flex-1 flex flex-col bg-white border border-[#E8EBE5] rounded-3xl shadow-xs overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-[#F0F2ED] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-xl" />
              <Skeleton className="h-4 w-28 rounded" />
            </div>
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>

          {/* Prompt pills */}
          <div className="p-4 border-b border-[#F0F2ED] bg-[#F7F8F5]/40">
            <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-3 border border-[#E8EBE5] space-y-2">
                  <Skeleton className="h-7 w-7 rounded-lg" />
                  <Skeleton className="h-3 w-full rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto">
            {/* Assistant message */}
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-xl shrink-0" />
              <div className="bg-white border border-[#E8EBE5] rounded-2xl p-4 max-w-[80%] space-y-2 shadow-2xs">
                <Skeleton className="h-4 w-48 rounded" />
                <Skeleton className="h-3.5 w-64 rounded" />
                <Skeleton className="h-3 w-36 rounded" />
              </div>
            </div>

            {/* User message */}
            <div className="flex items-start justify-end gap-3">
              <div className="bg-[#163300]/10 rounded-2xl p-4 max-w-[70%] space-y-2">
                <Skeleton className="h-4 w-40 rounded" />
              </div>
            </div>
          </div>

          {/* Bottom input */}
          <div className="p-3 sm:p-4 border-t border-[#F0F2ED] bg-white flex items-center gap-2 sm:gap-3">
            <Skeleton className="h-11 flex-1 rounded-full" />
            <Skeleton className="h-11 w-11 rounded-full shrink-0" />
          </div>
        </div>
      </main>
    </div>
  );
}
