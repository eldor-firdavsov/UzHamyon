'use client';

import React from 'react';

export interface FinanceCardProps {
  totalIncome?: number;
  monthIncome?: number;
  monthExpense?: number;
  monthLabel?: string;
  currency?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function FinanceCard({
  totalIncome,
  monthIncome,
  monthExpense,
  monthLabel = 'Joriy oy',
  currency = 'so‘m',
  className = '',
  children,
}: FinanceCardProps) {
  const formatMoney = (val?: number) => {
    if (val === undefined || val === null) return '0';
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  return (
    <div
      className={`finance-card ${className}`}
      style={{
        background: '#0b1e0f',
        borderRadius: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 2 & 3. Traditional Uzbek Quarter-Naqsh Watermark in Top-Right Corner */}
      <div className="card-naqsh-bg" aria-hidden="true">
        <img
          src="/naqsh-quarter-mobile.png"
          alt=""
          width={180}
          height={180}
          className="naqsh-img"
        />
      </div>

      {/* 3. Layering: Card Content above naqsh */}
      <div className="finance-card-content" style={{ position: 'relative', zIndex: 2 }}>
        {children ? (
          children
        ) : (
          <>
            <div className="sr-only">Jami balans Kirim Chiqim Sof oqim Moliyaviy holatingiz</div>
            <div style={{ fontSize: '14px', color: '#C9E8B0' }}>Jami daromad</div>
            <div
              className="num"
              style={{
                fontSize: 'clamp(28px, 5vw, 40px)',
                fontWeight: 700,
                letterSpacing: '-1.5px',
                color: '#9FE870',
                marginTop: '4px',
                lineHeight: 1.15,
              }}
            >
              {formatMoney(totalIncome)}{' '}
              <span style={{ fontSize: '16px', fontWeight: 500, color: '#C9E8B0', letterSpacing: 0 }}>
                {currency}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#C9E8B0' }}>Boshlang&apos;ich sanadan beri</div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-5">
              <div
                className="finance-sub-card"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  border: '1px solid rgba(255,255,255,0.14)',
                }}
              >
                <div style={{ fontSize: '12px', color: '#C9E8B0' }}>{monthLabel} daromadi</div>
                <div className="num" style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', fontWeight: 700, marginTop: '4px' }}>
                  +{formatMoney(monthIncome)}
                </div>
              </div>

              <div
                className="finance-sub-card"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  border: '1px solid rgba(255,255,255,0.14)',
                }}
              >
                <div style={{ fontSize: '12px', color: '#C9E8B0' }}>{monthLabel} xarajati</div>
                <div className="num" style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', fontWeight: 700, marginTop: '4px', color: '#FFB8B8' }}>
                  −{formatMoney(monthExpense)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
