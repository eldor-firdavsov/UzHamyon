import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function OnboardingLoading() {
  return (
    <div className="min-h-screen bg-[#F7F8F5] text-[#171B16] flex flex-col justify-center items-center px-4 py-8 antialiased">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-[#E8EBE5] p-6 sm:p-8 space-y-6 shadow-xs animate-pulse">
        {/* Header / Logo */}
        <div className="flex items-center justify-between pb-4 border-b border-[#F0F2ED]">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-8 h-8 rounded-xl" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>

        {/* Content Question */}
        <div className="space-y-3 py-2 text-center">
          <Skeleton className="h-7 w-3/4 mx-auto rounded-lg" />
          <Skeleton className="h-4 w-1/2 mx-auto rounded" />
        </div>

        {/* Options Skeleton */}
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3.5 p-4 rounded-2xl border border-[#E8EBE5] bg-[#F7F8F5]/60">
              <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-52 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Button */}
        <div className="pt-4">
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
