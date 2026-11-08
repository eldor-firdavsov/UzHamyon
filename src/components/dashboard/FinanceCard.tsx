'use client';

import React from 'react';

export interface FinanceCardProps {
  balance?: number;
  currentBalance?: number;
  totalIncome?: number;
  totalExpense?: number;
  totalSavings?: number;
  monthIncome?: number;
  monthExpense?: number;
  monthLabel?: string;
  currency?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function FinanceCard({
  balance,
  currentBalance,
  totalIncome,
  totalExpense,
  totalSavings = 0,
  monthIncome,
  monthExpense,
  monthLabel = 'Joriy oy',
  currency = 'so‘m',
  className = '',
  children,
}: FinanceCardProps) {
  const formatMoney = (val?: number) => {
    if (val === undefined || val === null || val === 0) return '0';
    const isNeg = val < 0;
    const absStr = Math.abs(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return isNeg ? `−${absStr}` : absStr;
  };

  const computedBalance = currentBalance !== undefined
    ? currentBalance
    : balance !== undefined
      ? balance
      : ((totalIncome ?? 0) - (totalExpense ?? 0) - (totalSavings ?? 0));
  const isNegative = computedBalance < 0;

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
            <div className="sr-only">Joriy balans Jami balans Kirim Chiqim Sof oqim Moliyaviy holatingiz {computedBalance} {currency}</div>
            <div style={{ fontSize: '14px', color: '#C9E8B0' }}>Joriy balans</div>
            <div
              className="num"
              style={{
                fontSize: 'clamp(28px, 5vw, 40px)',
                fontWeight: 700,
                letterSpacing: '-1.5px',
                color: isNegative ? '#FFB8B8' : '#9FE870',
                marginTop: '4px',
                lineHeight: 1.15,
              }}
            >
              {formatMoney(computedBalance)}{' '}
              <span style={{ fontSize: '16px', fontWeight: 500, color: isNegative ? '#FFB8B8' : '#C9E8B0', letterSpacing: 0 }}>
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
