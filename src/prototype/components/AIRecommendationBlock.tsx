'use client';

import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { DEMO_AI_RECOMMENDATION } from '../demoData';

interface AIRecommendationBlockProps {
  onAskAI?: () => void;
}

export function AIRecommendationBlock({ onAskAI }: AIRecommendationBlockProps) {
  return (
    <section 
      aria-label="AI tavsiyasi"
      className="rounded-[20px] bg-white p-4 sm:p-5 border border-[#E8EBE5] shadow-[0_2px_8px_rgba(23,27,22,0.04)] space-y-3"
    >
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[#9FE870] text-[#163300] flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-[#171B16] tracking-tight">
            {DEMO_AI_RECOMMENDATION.title}
          </h2>
        </div>

        <span className="inline-flex items-center rounded-full bg-[#F0F9E9] px-2.5 py-0.5 text-[10px] font-semibold text-[#163300] border border-[#9FE870]/30">
          {DEMO_AI_RECOMMENDATION.badge}
        </span>
      </div>

      {/* ── Recommendation Body ── */}
      <div className="rounded-xl bg-[#F7F8F5] p-3.5 border border-[#E8EBE5] text-xs sm:text-sm text-[#171B16] leading-relaxed">
        <p className="font-normal text-[#171B16]">
          {DEMO_AI_RECOMMENDATION.content}
        </p>
      </div>

      {/* ── Interactive CTA Button ── */}
      <button
        type="button"
        onClick={onAskAI}
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#F7F8F5] hover:bg-[#F0F9E9] border border-[#E8EBE5] text-xs font-semibold text-[#163300] transition-all cursor-pointer active:scale-[0.99]"
      >
        <span>AI bilan maslahatlashish</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </section>
  );
}
