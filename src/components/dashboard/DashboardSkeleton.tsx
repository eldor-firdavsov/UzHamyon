import React from 'react';
import { Skeleton, MetricCardSkeleton, ChartSkeleton, TransactionRowSkeleton } from '@/components/ui/Skeleton';

export default function DashboardSkeleton({
  timeGreeting = 'Xayrli kun',
  displayName = 'Foydalanuvchi',
  currentMonthLabel = 'Joriy hisobot davri',
}: {
  timeGreeting?: string;
  displayName?: string;
  currentMonthLabel?: string;
}) {
  return (
    <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* 1. Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#71717A]">{timeGreeting},</span>
            <span className="text-xs font-medium text-[#18181B] bg-white px-2.5 py-0.5 rounded-full border border-[#E5E7EB]">
              {displayName}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#18181B] tracking-tight">
            Moliyaviy holatingiz
          </h1>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-[#71717A]">
            <Skeleton className="h-4 w-4 rounded-full" />
            <span>Joriy hisobot davri:</span>
            <span className="font-medium text-[#18181B]">{currentMonthLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-white rounded-full border border-[#E5E7EB]">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>

      {/* 2. Top Row: Financial Overview (7 cols) + Income & Expenses Totals (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Main Balance & Overview Card Skeleton (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" className="h-10 w-10" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>

            <div className="space-y-2 pt-2">
              <Skeleton className="h-11 w-56 sm:w-72" />
              <Skeleton className="h-5 w-36 rounded-full" />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB] -mx-6 -mb-6 p-4 sm:px-6 rounded-b-2xl">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>

        {/* Selected Period Summary Card Skeleton (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-3">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <div className="p-3 bg-[#F5F6F8] rounded-xl flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Middle Row: Financial Chart (8 cols) + AI Advice (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] mb-4">
            <div className="space-y-1">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <ChartSkeleton height="h-48" />
        </div>

        <div className="lg:col-span-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <Skeleton variant="circle" className="h-6 w-6" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
      </div>

      {/* 4. Bottom Row: Recent Activity (7 cols) + Savings Goals Summary (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {[1, 2, 3, 4, 5].map((i) => (
              <TransactionRowSkeleton key={i} />
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <Skeleton variant="circle" className="h-6 w-6" />
              <Skeleton className="h-5 w-36" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-3.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
