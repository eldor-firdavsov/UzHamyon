'use client';

import { useTransition } from 'react';
import { logoutAction } from '@/app/auth/actions';
import { LogOut, Loader2 } from 'lucide-react';
import { clearAllCache } from '@/lib/cache/clientCache';

export default function LogoutButton({
  className = '',
}: {
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    clearAllCache();
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <button
      id="logout-button"
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={`min-h-[38px] sm:min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-[#E8EBE5] bg-white px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-[#171B16] transition-all hover:bg-rose-50 hover:text-[#D64D4D] hover:border-[#D64D4D]/30 disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs active:scale-98 cursor-pointer ${className}`}
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-[#697168]" />
          <span>Chiqilmoqda...</span>
        </>
      ) : (
        <>
          <LogOut className="h-4 w-4 text-[#697168] group-hover:text-[#D64D4D]" />
          <span>Chiqish</span>
        </>
      )}
    </button>
  );
}
