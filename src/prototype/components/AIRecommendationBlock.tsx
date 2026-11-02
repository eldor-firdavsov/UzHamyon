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
      className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#F5FAF0] via-white to-white p-5 sm:p-6 border border-[#9FE870]/40 shadow-[0_4px_20px_rgba(23,27,22,0.04)] space-y-4"
    >
      {/* Subtle decorative left accent stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#26834A]" aria-hidden="true" />

      {/* ── Top Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#9FE870] text-[#163300] flex items-center justify-center shrink-0 shadow-xs border border-[#8ED760]">
            <Sparkles className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#171B16] tracking-tight">
              {DEMO_AI_RECOMMENDATION.title}
            </h2>
            <p className="text-xs text-[#697168]">
              Aqlli moliya yordamchisi
            </p>
          </div>
        </div>

        <span className="inline-flex items-center rounded-full bg-[#163300]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#163300] border border-[#163300]/10">
          {DEMO_AI_RECOMMENDATION.badge}
        </span>
      </div>

      {/* ── Recommendation Body ── */}
      <p className="text-xs sm:text-sm text-[#171B16] leading-relaxed font-normal pl-0.5">
        {DEMO_AI_RECOMMENDATION.content}
      </p>

      {/* ── Branded Action Button ── */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onAskAI}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#163300] hover:bg-[#234A05] text-[#9FE870] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
        >
          <span>AI bilan maslahatlashish</span>
          <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
        </button>
      </div>
    </section>
  );
}
