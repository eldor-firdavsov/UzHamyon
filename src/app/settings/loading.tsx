import React from 'react';

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-[#F2F4EF]" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="w-full max-w-xl mx-auto px-4 pt-4 flex flex-col gap-5 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-white" />
          <div className="h-8 w-40 rounded-lg bg-[#E6EAE2]" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-20 w-20 rounded-full bg-[#E6EAE2]" />
          <div className="h-6 w-44 rounded-lg bg-[#E6EAE2]" />
        </div>
        <div className="h-[105px] rounded-[20px] bg-white" />
        <div className="h-[157px] rounded-[20px] bg-white" />
        <div className="h-[52px] rounded-[20px] bg-white" />
      </div>
    </div>
  );
}
