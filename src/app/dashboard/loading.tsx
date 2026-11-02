import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#F7F8F5] text-[#171B16] pb-36 md:pb-16 antialiased">
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

      {/* ── Main Content Skeleton ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Month & User Welcome Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-48 rounded-lg" />
            <Skeleton className="h-4 w-64 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-36 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>

        {/* 3 Metric Cards Skeleton (Balance, Income, Expense) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-[24px] p-5 sm:p-6 border border-[#E8EBE5] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="w-8 h-8 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-36 rounded-lg" />
              <Skeleton className="h-3.5 w-44 rounded-md" />
            </div>
          ))}
        </div>

        {/* 2-Column Grid (Main Chart + Recent Activity) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* Left Column (Chart) */}
          <div className="lg:col-span-7 bg-white rounded-[24px] p-5 sm:p-6 border border-[#E8EBE5] space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F2ED]">
              <div className="space-y-1">
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-3.5 w-48 rounded-md" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            {/* Bar chart bars skeleton */}
            <div className="h-52 flex items-end justify-between gap-2.5 pt-4 pb-2">
              {[45, 70, 35, 90, 60, 80, 50, 75].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div className="w-full max-w-[28px] rounded-t-lg bg-[#E2E6DE] animate-pulse" style={{ height: `${h}%` }} />
                  <Skeleton className="h-2.5 w-6 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Right Column (Recent Transactions) */}
          <div className="lg:col-span-5 bg-white rounded-[24px] p-5 sm:p-6 border border-[#E8EBE5] space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F2ED]">
              <Skeleton className="h-5 w-36 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between py-2 gap-3 animate-pulse">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-[14px] bg-[#E2E6DE] shrink-0" />
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="h-4 w-32 bg-[#E2E6DE] rounded-md" />
                      <div className="h-3 w-20 bg-[#E2E6DE] rounded-md" />
                    </div>
                  </div>
                  <div className="h-4 w-20 bg-[#E2E6DE] rounded-md shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
