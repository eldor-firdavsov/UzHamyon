'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Receipt,
  ChartNoAxesCombined,
  Plus,
} from 'lucide-react';

export interface MobileNavBarProps {
  onOpenAddTransaction: () => void;
  activeTab?: 'dashboard' | 'faoliyat' | 'tahlil' | 'ai' | 'dash' | 'act';
  onTabChange?: (tab: 'dash' | 'act' | 'tahlil' | 'ai') => void;
  className?: string;
}

export const NAV_ITEMS = [
  { id: 'home', name: 'Bosh sahifa', href: '/dashboard', linkId: 'mobile-nav-dashboard-link', icon: Home, prototypeTab: 'dash' as const },
  { id: 'activity', name: 'Faoliyat', href: '/transactions', linkId: 'mobile-nav-transactions-link', icon: Receipt, prototypeTab: 'act' as const },
  { id: 'analytics', name: 'Tahlil', href: '/analytics', linkId: 'mobile-nav-analytics-link', icon: ChartNoAxesCombined, prototypeTab: 'tahlil' as const },
] as const;

export const MobileNavBar: React.FC<MobileNavBarProps> = ({
  onOpenAddTransaction,
  activeTab,
  onTabChange,
  className,
}) => {
  const router = useRouter();
  const currentPathname = usePathname() || '';
  const pillRef = useRef<HTMLDivElement>(null);

  // Resolve active index including nested routes (e.g., /analytics/monthly -> index 2)
  const resolveActiveIndex = useCallback(() => {
    if (activeTab) {
      if (activeTab === 'dash' || activeTab === 'dashboard') return 0;
      if (activeTab === 'act' || activeTab === 'faoliyat') return 1;
      if (activeTab === 'tahlil') return 2;
    }
    if (!currentPathname) return 0;
    if (currentPathname === '/' || currentPathname === '/dashboard') return 0;
    if (currentPathname.startsWith('/transactions') || currentPathname.startsWith('/activity')) return 1;
    if (
      currentPathname.startsWith('/analytics') ||
      currentPathname.startsWith('/budgets') ||
      currentPathname.startsWith('/goals') ||
      currentPathname.startsWith('/insights')
    ) {
      return 2;
    }
    return 0;
  }, [currentPathname, activeTab]);

  const [activeIndex, setActiveIndex] = useState<number>(resolveActiveIndex);
  // Continuous floating index (0.00 -> 3.00) during thumb scrubbing
  const [scrubProgress, setScrubProgress] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubVelocity, setScrubVelocity] = useState<number>(0);
  const lastCoordRef = useRef<{ x: number; time: number }>({ x: 0, time: 0 });

  useEffect(() => {
    setActiveIndex(resolveActiveIndex());
  }, [resolveActiveIndex]);

  // Convert pointer X coordinate into continuous 0..3 slot index
  const getContinuousIndexFromX = (clientX: number): number => {
    if (!pillRef.current) return activeIndex;
    const rect = pillRef.current.getBoundingClientRect();
    const pad = 6; // 6px inner padding
    const trackWidth = rect.width - pad * 2;
    const slotWidth = trackWidth / NAV_ITEMS.length;
    const relativeX = clientX - rect.left - pad - slotWidth / 2;
    const rawIndex = relativeX / slotWidth;
    return Math.max(0, Math.min(NAV_ITEMS.length - 1, rawIndex));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsScrubbing(true);
    lastCoordRef.current = { x: e.clientX, time: performance.now() };
    setScrubVelocity(0);
    const continuous = getContinuousIndexFromX(e.clientX);
    setScrubProgress(continuous);

    const snapped = Math.round(continuous);
    if (snapped !== activeIndex) {
      setActiveIndex(snapped);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(6);
        } catch {}
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastCoordRef.current.time);
    const dx = e.clientX - lastCoordRef.current.x;
    const v = dx / dt;
    lastCoordRef.current = { x: e.clientX, time: now };
    setScrubVelocity(Math.max(-1.5, Math.min(1.5, v)));

    const continuous = getContinuousIndexFromX(e.clientX);
    setScrubProgress(continuous);

    const snapped = Math.round(continuous);
    if (snapped !== activeIndex) {
      setActiveIndex(snapped);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(6);
        } catch {}
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    const continuous = getContinuousIndexFromX(e.clientX);
    const finalIndex = Math.round(continuous);

    setIsScrubbing(false);
    setScrubProgress(null);
    setScrubVelocity(0);
    setActiveIndex(finalIndex);

    const targetItem = NAV_ITEMS[finalIndex];
    if (onTabChange) {
      onTabChange(targetItem.prototypeTab);
    } else if (currentPathname !== targetItem.href) {
      router.push(targetItem.href);
    }
  };

  const handleItemClick = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex(idx);
    const targetItem = NAV_ITEMS[idx];
    if (onTabChange) {
      onTabChange(targetItem.prototypeTab);
    } else if (currentPathname !== targetItem.href) {
      router.push(targetItem.href);
    }
  };

  const displayIndex = scrubProgress !== null ? scrubProgress : activeIndex;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 pointer-events-none flex items-center justify-center px-3 ${
        className ?? 'md:hidden'
      }`}
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 12px) + 0.5rem)',
      }}
    >
      {/* ── Native iOS 26/27 SVG Displacement Filter for Edge Optical Refraction ── */}
      <svg className="sr-only" aria-hidden="true" width="0" height="0">
        <defs>
          <filter id="ios-liquid-refraction" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <nav
        aria-label="Mobil navigatsiya"
        className="pointer-events-auto flex items-center justify-between gap-2.5 sm:gap-3 w-full max-w-[430px]"
      >
        {/* Hidden accessible links for SSR Discovery and Screen Readers */}
        <div className="sr-only" aria-hidden="true">
          <a href="/dashboard" id="mobile-nav-dashboard-link">Bosh sahifa</a>
          <a href="/transactions" id="mobile-nav-transactions-link">Faoliyat</a>
          <a href="/analytics" id="mobile-nav-analytics-link">Tahlil</a>
          <a href="/advisor" id="mobile-nav-advisor-link">AI</a>
        </div>
        {/* 1. LEFT CAPSULE: 3-Item Liquid Glass Pill */}
        <div
          ref={pillRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`liquid-glass-pill relative grid grid-cols-3 items-center flex-1 rounded-full p-1.5 h-[58px] sm:h-[62px] touch-none select-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            isScrubbing ? 'scale-[1.025]' : 'scale-100'
          }`}
        >
          {/* Edge Refractive Optical Underlay */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full overflow-hidden opacity-85"
            style={{
              backdropFilter: 'blur(24px) saturate(190%) url(#ios-liquid-refraction)',
              WebkitBackdropFilter: 'blur(24px) saturate(190%)',
            }}
          />

          {/* Sliding Liquid Glass Active Droplet with Inflatable Lens & Jelly Physics */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-1.5 left-1.5 flex items-center justify-center z-2"
            style={{
              width: 'calc((100% - 0.75rem) / 3)',
              transform: `translate3d(${displayIndex * 100}%, 0, 0)`,
              transition: isScrubbing
                ? 'none'
                : 'transform 420ms cubic-bezier(0.34, 1.35, 0.64, 1)',
            }}
          >
            <div
              className="liquid-glass-primary w-11 h-11 sm:w-12 sm:h-12 rounded-full"
              style={{
                transform: isScrubbing
                  ? `scale(1.12, 0.94) skewX(${scrubVelocity * -6}deg)`
                  : 'scale(1)',
                transition: isScrubbing
                  ? 'transform 60ms ease-out'
                  : 'transform 360ms cubic-bezier(0.34, 1.5, 0.64, 1)',
              }}
            />
          </div>

          {/* 4 Interactive Slots: Recessed Wells + Icon Buttons in identical grid cells */}
          {NAV_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const isActive = Math.round(displayIndex) === idx;

            return (
              <div
                key={item.id}
                className="relative flex items-center justify-center h-full"
              >
                {/* Recessed Circular Glass Well */}
                <div
                  aria-hidden="true"
                  className="liquid-glass-slot absolute w-11 h-11 sm:w-12 sm:h-12 rounded-full pointer-events-none transition-opacity duration-200"
                />

                {/* Interactive Icon Button */}
                <button
                  id={item.linkId}
                  type="button"
                  onClick={(e) => handleItemClick(idx, e)}
                  aria-label={item.name}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative z-10 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                    isActive
                      ? 'text-[#163300]'
                      : 'text-[#52525B] hover:text-[#171B16]'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 stroke-[2.3] transition-transform duration-200 ${
                      isActive ? 'scale-110 stroke-[2.5]' : 'scale-100'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* 2. RIGHT FAB: Detached Circular Liquid Glass Plus Button */}
        <button
          type="button"
          onClick={onOpenAddTransaction}
          aria-label="Add transaction"
          className="liquid-glass-primary relative flex-shrink-0 flex items-center justify-center w-[58px] h-[58px] sm:w-[62px] sm:h-[62px] rounded-full ring-4 ring-card/60 dark:ring-card/40 backdrop-blur-md active:scale-90 hover:opacity-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          {/* Refraction underlay for detached circle */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full overflow-hidden opacity-85"
            style={{
              backdropFilter: 'blur(16px) saturate(180%) url(#ios-liquid-refraction)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            }}
          />
          <Plus className="w-6 h-6 stroke-[2.5] relative z-10" />
        </button>
      </nav>
    </div>
  );
};

export default MobileNavBar;
