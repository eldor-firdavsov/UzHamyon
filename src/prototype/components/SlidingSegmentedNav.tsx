'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';

export interface SlidingSegmentedOption<T extends string> {
  id: T;
  label: string;
  activeBg?: string;
  activeColor?: string;
  testId?: string;
}

export interface SlidingSegmentedNavProps<T extends string> {
  options: SlidingSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  style?: React.CSSProperties;
  height?: number;
}

export function SlidingSegmentedNav<T extends string>({
  options,
  value,
  onChange,
  className = '',
  style = {},
  height = 48,
}: SlidingSegmentedNavProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const resolveIndex = useCallback(() => {
    const idx = options.findIndex((opt) => opt.id === value);
    return idx >= 0 ? idx : 0;
  }, [options, value]);

  const [activeIndex, setActiveIndex] = useState<number>(resolveIndex);
  const [scrubProgress, setScrubProgress] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  useEffect(() => {
    setActiveIndex(resolveIndex());
  }, [resolveIndex]);

  const getContinuousIndexFromX = (clientX: number): number => {
    if (!containerRef.current) return activeIndex;
    const rect = containerRef.current.getBoundingClientRect();
    const pad = 4; // 4px inner padding matching .seg
    const trackWidth = rect.width - pad * 2;
    const slotWidth = trackWidth / options.length;
    const relativeX = clientX - rect.left - pad - slotWidth / 2;
    const rawIndex = relativeX / slotWidth;
    return Math.max(0, Math.min(options.length - 1, rawIndex));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsScrubbing(true);
    const continuous = getContinuousIndexFromX(e.clientX);
    setScrubProgress(continuous);

    const snapped = Math.round(continuous);
    if (snapped !== activeIndex) {
      setActiveIndex(snapped);
      onChange(options[snapped].id);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(6);
        } catch {}
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    const continuous = getContinuousIndexFromX(e.clientX);
    setScrubProgress(continuous);

    const snapped = Math.round(continuous);
    if (snapped !== activeIndex) {
      setActiveIndex(snapped);
      onChange(options[snapped].id);
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
    setActiveIndex(finalIndex);
    onChange(options[finalIndex].id);
  };

  const displayIndex = scrubProgress !== null ? scrubProgress : activeIndex;
  const currentActiveOption = options[Math.round(displayIndex)] || options[0];

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`touch-none select-none ${className}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: '#E4E8DF',
        borderRadius: '24px',
        padding: '4px',
        border: '1px solid #D8DED3',
        height: `${height}px`,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Sliding Active Pill (Exact Original Colors & Shadows with Fluid Spring Translation) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 left-1 flex items-center justify-center"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translate3d(${displayIndex * 100}%, 0, 0)`,
          transition: isScrubbing
            ? 'none'
            : 'transform 360ms cubic-bezier(0.34, 1.35, 0.64, 1)',
        }}
      >
        <div
          className="w-full h-full"
          style={{
            background: currentActiveOption.activeBg || '#FFFFFF',
            borderRadius: '20px',
            boxShadow: '0 1px 4px rgba(23, 27, 22, 0.08)',
            transform: isScrubbing ? 'scale(1.02, 0.98)' : 'scale(1)',
            transition:
              'background-color 200ms ease, transform 120ms ease-out',
          }}
        />
      </div>

      {/* Clickable Nav Items (Exact Original Fonts, Colors, and Weight) */}
      {options.map((opt, idx) => {
        const isActive = Math.round(displayIndex) === idx;
        const color = isActive
          ? opt.activeColor || '#171B16'
          : '#555E53';

        return (
          <button
            key={opt.id}
            id={opt.testId || (opt.id === 'an' ? 'tab-btn-analytics' : opt.id === 'go' ? 'tab-btn-goals' : undefined)}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveIndex(idx);
              onChange(opt.id);
            }}
            className="relative z-10 flex-1 flex items-center justify-center h-full border-0 bg-transparent cursor-pointer transition-colors duration-150 focus-visible:outline-none"
            style={{
              color,
              fontWeight: isActive ? 600 : 500,
              fontSize: '14px',
              borderRadius: '20px',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default SlidingSegmentedNav;
