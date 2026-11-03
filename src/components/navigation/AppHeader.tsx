'use client';

import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import FastTransactionModal from '@/components/transactions/FastTransactionModal';
import UzHamyonLogo from '@/components/brand/UzHamyonLogo';
import { warmCache, setCacheUser, cachedFetch, peekCache } from '@/lib/cache/clientCache';
import type { FinancialTimelineSummary } from '@/lib/timeline/financialTimeline';
import { createClient } from '@/lib/supabase/client';
import MobileFloatingNav from './MobileFloatingNav';
import {
  Home,
  Receipt,
  ChartNoAxesCombined,
  Brain,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  Plus,
  Calendar,
} from 'lucide-react';

// Exactly 4 Primary Sections in requested order with API warming paths
const PRIMARY_NAV = [
  {
    href: '/dashboard',
    label: 'Bosh sahifa',
    id: 'nav-dashboard-link',
    icon: Home,
    matcher: (path: string) => path === '/dashboard' || path === '/',
    apiToWarm: undefined,
  },
  {
    href: '/transactions',
    label: 'Faoliyat',
    id: 'nav-transactions-link',
    icon: Receipt,
    matcher: (path: string) =>
      path.startsWith('/transactions') ||
      path.startsWith('/categories') ||
      path.startsWith('/imports'),
    apiToWarm: '/api/transactions?page=1&pageSize=12&sortBy=date&sortDirection=desc',
  },
  {
    href: '/analytics',
    label: 'Tahlil',
    id: 'nav-analytics-link',
    icon: ChartNoAxesCombined,
    matcher: (path: string) =>
      path.startsWith('/analytics') ||
      path.startsWith('/budgets') ||
      path.startsWith('/goals') ||
      path.startsWith('/insights'),
    apiToWarm: '/api/timeline/available-months',
  },
  {
    href: '/advisor',
    label: 'AI',
    id: 'nav-advisor-link',
    icon: Brain,
    matcher: (path: string) => path.startsWith('/advisor'),
    apiToWarm: '/api/ai/conversations',
  },
];

interface AppHeaderProps {
  userEmail?: string | null;
  userName?: string | null;
  monthSwitcher?: React.ReactNode;
}

function DefaultHeaderMonthSwitcher() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [timeline, setTimeline] = useState<FinancialTimelineSummary | null>(() => {
    return peekCache<FinancialTimelineSummary>('/api/timeline/available-months') || null;
  });

  const fetchTimeline = useCallback(() => {
    cachedFetch<FinancialTimelineSummary>('/api/timeline/available-months')
      .then((data) => {
        if (data) {
          setTimeline(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTimeline();

    const handleInvalidation = (e: Event) => {
      const customEvent = e as CustomEvent<{ urlPrefix?: string }>;
      const prefix = customEvent.detail?.urlPrefix;
      if (!prefix || prefix.startsWith('/api/timeline') || prefix.startsWith('/api/transactions')) {
        fetchTimeline();
      }
    };

    window.addEventListener('uzhamyon:cache-invalidated', handleInvalidation);
    return () => window.removeEventListener('uzhamyon:cache-invalidated', handleInvalidation);
  }, [fetchTimeline]);

  const isMonthSupported =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/transactions') ||
    pathname.startsWith('/analytics');

  if (!isMonthSupported) return null;

  const months = timeline?.availableMonths || [];

  if (months.length === 0) {
    return (
      <div className="hidden md:inline-flex items-center gap-1.5 bg-[#F7F8F5] border border-[#E8EBE5] rounded-xl px-3 py-1.5 text-xs text-[#697168] font-medium shadow-2xs">
        <Calendar className="h-3.5 w-3.5 text-[#959E94]" />
        <span>Tranzaksiyalar mavjud emas</span>
      </div>
    );
  }

  const currentParam = searchParams.get('month');
  const activeKey = currentParam || (timeline?.latestMonthKey || months[0]?.key);

  const currentIndex = months.findIndex((m) => m.key === activeKey);
  const activeMonthObj = currentIndex >= 0 ? months[currentIndex] : months[0];
  const activeLabel = activeMonthObj ? activeMonthObj.labelUz : '';

  const canGoPrev = currentIndex < months.length - 1;
  const canGoNext = currentIndex > 0;

  const handleNavigate = (direction: -1 | 1) => {
    // direction === -1: go to previous (older) month: currentIndex + 1
    // direction === 1: go to next (newer) month: currentIndex - 1
    const nextIdx = direction === -1 ? currentIndex + 1 : currentIndex - 1;
    if (nextIdx >= 0 && nextIdx < months.length) {
      const nextMonth = months[nextIdx];
      const params = new URLSearchParams(searchParams.toString());
      params.set('month', nextMonth.key);
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <div className="hidden md:inline-flex items-center bg-[#F7F8F5] border border-[#E8EBE5] rounded-xl p-1 shadow-2xs">
      <button
        type="button"
        aria-label="Oldingi oy"
        disabled={!canGoPrev}
        onClick={() => handleNavigate(-1)}
        className="h-8 w-8 rounded-lg flex items-center justify-center text-[#697168] hover:text-[#171B16] hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="px-3 py-1 text-xs sm:text-sm font-semibold text-[#171B16] select-none whitespace-nowrap">
        {activeLabel}
      </span>
      <button
        type="button"
        aria-label="Keyingi oy"
        disabled={!canGoNext}
        onClick={() => handleNavigate(1)}
        className="h-8 w-8 rounded-lg flex items-center justify-center text-[#697168] hover:text-[#171B16] hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function getCleanFallbackName(email?: string | null): string {
  if (!email) return 'Foydalanuvchi';
  const prefix = email.split('@')[0] || '';
  const clean = prefix.replace(/[0-9_.-]/g, ' ').trim();
  if (!clean) return 'Foydalanuvchi';
  return clean
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export default function AppHeader({ userEmail, userName, monthSwitcher }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resolvedName, setResolvedName] = useState<string>(() => {
    if (userName && !userName.includes('@')) return userName;
    return getCleanFallbackName(userEmail);
  });
  const profileRef = useRef<HTMLDivElement>(null);

  const [prevUserName, setPrevUserName] = useState(userName);
  if (userName !== prevUserName) {
    setPrevUserName(userName);
    if (userName && !userName.includes('@')) {
      setResolvedName(userName);
    }
  }

  // User cache isolation
  useEffect(() => {
    setCacheUser(userEmail || null);
  }, [userEmail]);

  // Resolve user full name from prop, database profile, or user metadata
  useEffect(() => {
    if (userName && !userName.includes('@')) {
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(async (userRes: any) => {
      const user = userRes?.data?.user;
      if (user) {
        // Priority 1: profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) {
          const profName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
          if (profName && !profName.includes('@')) {
            setResolvedName(profName);
            return;
          }
        }

        // Priority 2: user_metadata
        const meta = user.user_metadata || {};
        const metaName = `${meta.first_name || ''} ${meta.last_name || ''}`.trim();
        if (metaName && !metaName.includes('@')) {
          setResolvedName(metaName);
          return;
        }

        // Priority 3: Fallback from email prefix (e.g. firdavsove1 -> Firdavs)
        const emailPrefix = (user.email || userEmail || '').split('@')[0] || '';
        const cleanName = emailPrefix.replace(/[0-9_.-]/g, ' ').trim();
        if (cleanName) {
          const formatted = cleanName
            .split(/\s+/)
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
          setResolvedName(formatted);
          return;
        }

        setResolvedName('Foydalanuvchi');
      }
    });
  }, [userName, userEmail]);

  // Pre-warm key routes during browser idle time
  useEffect(() => {
    const timer = setTimeout(() => {
      router.prefetch('/transactions');
      router.prefetch('/analytics');
      router.prefetch('/advisor');
      router.prefetch('/dashboard');
      router.prefetch('/budgets');
      router.prefetch('/goals');
      warmCache('/api/transactions?page=1&pageSize=12&sortBy=date&sortDirection=desc');
      warmCache('/api/timeline/available-months');
      warmCache('/api/budgets?currency=UZS');
      warmCache('/api/goals?currency=UZS');
      warmCache('/api/categories');
      warmCache('/api/categories?type=expense');
      warmCache('/api/ai/conversations');
    }, 800);

    return () => clearTimeout(timer);
  }, [router]);

  const handlePrewarm = (href: string, apiToWarm?: string) => {
    router.prefetch(href);
    if (apiToWarm) {
      warmCache(apiToWarm);
    }
  };

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md text-[#171B16] border-b border-[#E8EBE5] shadow-xs">
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-3 sm:gap-4">
            {/* Logo on Left */}
            <div className="flex items-center gap-3 lg:gap-8">
              <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
                <UzHamyonLogo variant="icon" size="md" />
                <span className="font-bold text-base sm:text-lg text-[#171B16] tracking-tight">
                  UzHamyon
                </span>
              </Link>

              {/* 4 Primary Navigation Links (Desktop) */}
              <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-xl bg-[#F7F8F5] border border-[#E8EBE5]" aria-label="Asosiy navigatsiya">
                {PRIMARY_NAV.map((item) => {
                  const isActive = item.matcher(pathname);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      id={item.id}
                      prefetch={true}
                      onMouseEnter={() => handlePrewarm(item.href, item.apiToWarm)}
                      onFocus={() => handlePrewarm(item.href, item.apiToWarm)}
                      onTouchStart={() => handlePrewarm(item.href, item.apiToWarm)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm rounded-lg transition-all ${
                        isActive
                          ? 'bg-[#163300] text-white font-semibold shadow-xs'
                          : 'text-[#697168] hover:text-[#171B16] hover:bg-white/80 font-medium'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? 'text-[#9FE870]' : 'text-current'}`} />
                      <span>{item.label}</span>
                      {item.href === '/advisor' && <span className="sr-only">AI yordamchi</span>}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right Side: Month Switcher + Tranzaksiya Button & Profile Menu */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Month Switcher Capsule directly next to transaction button */}
              {monthSwitcher ? (
                monthSwitcher
              ) : (
                <Suspense fallback={null}>
                  <DefaultHeaderMonthSwitcher />
                </Suspense>
              )}

              {/* Primary Tranzaksiya Action Button (Desktop/Tablet) */}
              <button
                type="button"
                id="header-add-transaction-btn"
                onClick={() => setIsModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-[#9FE870] hover:bg-[#8ED760] text-[#163300] text-sm font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>Tranzaksiya</span>
              </button>

              {/* Profile Menu Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  id="profile-dropdown-button"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E8EBE5] bg-white hover:bg-[#F7F8F5] px-3 py-1.5 text-sm font-semibold text-[#171B16] transition-colors focus:outline-none focus:ring-2 focus:ring-[#9FE870] cursor-pointer"
                  aria-label="Foydalanuvchi menyusi"
                  aria-expanded={profileMenuOpen}
                >
                  <div className="h-7 w-7 rounded-full bg-[#163300] text-[#9FE870] flex items-center justify-center font-bold text-xs shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="hidden sm:inline-block max-w-[170px] truncate text-sm text-[#171B16] font-semibold">
                    {resolvedName && !resolvedName.includes('@')
                      ? resolvedName
                      : getCleanFallbackName(userEmail)}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#697168] shrink-0" />
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-[#E5E7EB] mb-1">
                      <div className="text-[11px] text-[#71717A] uppercase tracking-wider font-medium">Hisob</div>
                      <div className="text-sm text-[#18181B] font-semibold truncate mt-0.5">
                        {resolvedName && !resolvedName.includes('@')
                          ? resolvedName
                          : getCleanFallbackName(userEmail)}
                      </div>
                      {userEmail && (
                        <div className="text-xs text-[#71717A] truncate mt-0.5">{userEmail}</div>
                      )}
                    </div>

                    <Link
                      href="/settings"
                      id="settings-nav-link"
                      onClick={() => setProfileMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-xl transition-colors ${
                        pathname === '/settings'
                          ? 'bg-[#ECFDF5] text-[#059669]'
                          : 'text-[#18181B] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <Settings className="h-4 w-4 text-[#71717A]" />
                      <span>Sozlamalar</span>
                    </Link>

                    <div className="my-1 border-t border-[#E5E7EB]" />

                    <div className="px-1 pt-0.5">
                      <LogoutButton className="w-full justify-center text-sm py-2 text-[#DC2626] hover:bg-rose-50 rounded-xl font-medium transition-colors" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Floating Bottom Navigation (Pill + Detached FAB) */}
      <MobileFloatingNav onOpenAddTransaction={() => setIsModalOpen(true)} />

      {/* Accessible Hidden Logout Button for SSR Discovery */}
      <div className="sr-only" aria-hidden="true">
        <LogoutButton />
      </div>

      {/* Fast Transaction Entry Modal Available Everywhere */}
      <FastTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
