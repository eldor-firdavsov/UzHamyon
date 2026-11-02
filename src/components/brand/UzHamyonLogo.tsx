import React from 'react';

export interface UzHamyonLogoProps {
  /**
   * 'icon': Faqat ramz (monogram)
   * 'full': To‘liq logo (ramz + UzHamyon matni)
   */
  variant?: 'icon' | 'full';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  priority?: boolean;
}

export default function UzHamyonLogo({
  variant = 'icon',
  size = 'md',
  className = '',
}: UzHamyonLogoProps) {
  if (variant === 'full') {
    const iconSizes = {
      sm: 'h-7 w-7',
      md: 'h-9 w-9',
      lg: 'h-12 w-12',
      xl: 'h-16 w-16',
    };

    const textSizes = {
      sm: 'text-base font-bold',
      md: 'text-xl font-bold',
      lg: 'text-2xl font-extrabold',
      xl: 'text-3xl font-extrabold',
    };

    return (
      <div className={`inline-flex items-center gap-2.5 justify-center select-none ${className}`}>
        <div className={`relative shrink-0 ${iconSizes[size]}`}>
          <img
            src="/uzhamyon-icon-transparent.png"
            alt="UzHamyon"
            className="w-full h-full object-contain"
          />
        </div>
        <span className={`tracking-tight text-[#171B16] ${textSizes[size]}`}>
          UzHamyon
        </span>
      </div>
    );
  }

  // Variant: icon
  const containerSizes = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  const imageSizes = {
    sm: 28,
    md: 36,
    lg: 48,
    xl: 64,
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${containerSizes[size]} ${className}`}
    >
      <img
        src="/uzhamyon-icon-transparent.png"
        alt="UzHamyon"
        width={imageSizes[size]}
        height={imageSizes[size]}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
