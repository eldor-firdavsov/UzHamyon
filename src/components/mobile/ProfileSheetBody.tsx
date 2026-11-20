'use client';

import React from 'react';
import { ChevronRight, Download, Flame, LayoutGrid, Settings, Snowflake, Trophy } from 'lucide-react';
import type { StreakSummary } from '@/lib/streak/compute';

interface ProfileSheetBodyProps {
  userName: string;
  userEmail?: string | null;
  streak: StreakSummary | null;
  onLogout: () => void;
}

const LINKS = [
  { href: '/settings', label: 'Sozlamalar', bg: '#6B7068', Icon: Settings },
  { href: '/categories', label: 'Kategoriyalar', bg: '#7A5AE0', Icon: LayoutGrid },
  { href: '/imports', label: 'Import', bg: '#2457C5', Icon: Download },
];

/** Profile: who you are, your streak in three numbers, a short settings list. */
export default function ProfileSheetBody({ userName, userEmail, streak, onLogout }: ProfileSheetBodyProps) {
  const name = userName.trim();
  return (
    <div className="uz-p">
      <div className="uz-p-head">
        <div className="uz-p-avatar" aria-hidden="true">{name ? name[0].toUpperCase() : '?'}</div>
        <div className="uz-p-name">{name || 'Profil'}</div>
        {userEmail && <div className="uz-m-row-sub">{userEmail}</div>}
      </div>

      {streak && (
        <div className="uz-p-stats">
          <div className="uz-p-stat" aria-label={`Hozirgi seriya ${streak.current} kun`}>
            <Flame size={22} color="#E8930C" fill="#FFB020" aria-hidden="true" />
            <span className="num">{streak.current}</span>
            <span>Hozir</span>
          </div>
          <div className="uz-p-stat" aria-label={`Eng uzun seriya ${streak.best} kun`}>
            <Trophy size={22} color="#B8860B" aria-hidden="true" />
            <span className="num">{streak.best}</span>
            <span>Rekord</span>
          </div>
          <div className="uz-p-stat" aria-label={`Shu hafta muzlatish: ${streak.freezesLeft}`}>
            <Snowflake size={22} color="#3B8FD9" aria-hidden="true" />
            <span className="num">{streak.freezesLeft}</span>
            <span>Muzlatish</span>
          </div>
        </div>
      )}

      <div className="uz-m-list">
        {LINKS.map(({ href, label, bg, Icon }) => (
          <a key={href} href={href} className="uz-m-row uz-p-link">
            <span className="uz-p-link-ic" style={{ background: bg }}><Icon size={17} strokeWidth={2.2} /></span>
            <span className="uz-m-row-main"><span className="uz-p-link-label">{label}</span></span>
            <ChevronRight size={16} color="#AEB4AA" aria-hidden="true" />
          </a>
        ))}
      </div>

      <div className="uz-m-list">
        <button type="button" className="uz-m-row uz-p-danger" onClick={onLogout}>
          Hisobdan chiqish
        </button>
      </div>
    </div>
  );
}
