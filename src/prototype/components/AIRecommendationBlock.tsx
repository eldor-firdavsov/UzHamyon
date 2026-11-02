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
      className="rounded-[20px] bg-white p-5 border border-[#E8EBE5]/80 shadow-[0_1px_4px_rgba(23,27,22,0.03)] space-y-3 relative overflow-hidden"
    >
      {/* Subtle left accent line for distinction without heavy coloring */}
      <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#26834A] rounded-r" aria-hidden="true" />

      {/* ── Top Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-[#F0F9E9] text-[#163300] flex items-center justify-center shrink-0 border border-[#9FE870]/40">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-sm font-semibold text-[#171B16] tracking-tight">
            {DEMO_AI_RECOMMENDATION.title}
          </h2>
        </div>

        <span className="inline-flex items-center rounded-full bg-[#F7F8F5] px-2.5 py-0.5 text-[10px] font-semibold text-[#697168] border border-[#E8EBE5]">
          {DEMO_AI_RECOMMENDATION.badge}
        </span>
      </div>

      {/* ── Recommendation Body (Clean, direct typography without nested box) ── */}
      <p className="text-xs sm:text-sm text-[#171B16] leading-relaxed pl-1 font-normal">
        {DEMO_AI_RECOMMENDATION.content}
      </p>

      {/* ── Compact CTA ── */}
      <div className="pt-1 pl-1">
        <button
          type="button"
          onClick={onAskAI}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#163300] hover:text-[#26834A] transition-colors cursor-pointer group"
        >
          <span>AI bilan maslahatlashish</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </section>
  );
}
