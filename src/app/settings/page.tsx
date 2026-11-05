import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/AppHeader';
import ProfileForm from '@/components/ProfileForm';
import LogoutButton from '@/components/LogoutButton';
import {
  User,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Wallet,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export const metadata = {
  title: 'Sozlamalar — UzHamyon',
  description: 'Hisobingiz va profilingiz sozlamalarini boshqaring',
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user profile from database
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const firstName = profile?.first_name || user.user_metadata?.first_name || '';
  const lastName = profile?.last_name || user.user_metadata?.last_name || '';
  const email = user.email || '';
  const emailPrefix = email.split('@')[0] || '';
  const cleanEmailName = emailPrefix.replace(/[0-9_.-]/g, ' ').trim();
  const formattedEmailName = cleanEmailName
    ? cleanEmailName.charAt(0).toUpperCase() + cleanEmailName.slice(1).toLowerCase()
    : '';
  const fullName = `${firstName} ${lastName}`.trim() || formattedEmailName || 'Foydalanuvchi';

  // Extract initials (e.g. Eldor Firdavsov -> EF)
  const initials = firstName && lastName
    ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    : fullName.slice(0, 2).toUpperCase() || 'UZ';

  return (
    <div className="min-h-screen bg-[#F7F8F5] text-[#171B16] pb-44 md:pb-16 antialiased">
      <AppHeader userEmail={user.email} userName={fullName} />

      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
        {/* Breadcrumb Trail & Page Title */}
        <div className="space-y-2">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-[#697168]">
            <Link href="/dashboard" className="hover:text-[#171B16] transition-colors">
              Bosh sahifa
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-[#959E94]" />
            <span className="text-[#171B16]">Sozlamalar</span>
          </nav>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171B16] pt-1">
            Hisob sozlamalari
          </h1>
        </div>

        {/* 1. Profile Hero & Edit Card */}
        <section className="bg-white rounded-3xl p-5 sm:p-8 border border-[#E8EBE5] shadow-xs space-y-6">
          {/* User Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 pb-6 border-b border-[#F0F2ED]">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#163300] text-[#9FE870] font-extrabold text-xl sm:text-2xl flex items-center justify-center shrink-0 shadow-xs ring-4 ring-[#9FE870]/20">
              {initials}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-[#171B16] truncate">
                  {fullName}
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#26834A] bg-[#EDF7F0] border border-[#26834A]/20 px-2 py-0.5 rounded-full shrink-0">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Tasdiqlangan</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#697168] break-all">
                {email.startsWith('tg_') && email.endsWith('@telegram.uzhamyon.uz')
                  ? 'Telegram hisobi orqali ulangan'
                  : email}
              </p>
              <div className="pt-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#163300] bg-[#F0F9E9] px-2.5 py-0.5 rounded-md">
                  UzHamyon Foydalanuvchisi
                </span>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-[#163300]" />
              <h3 className="text-sm font-bold text-[#171B16] uppercase tracking-wider">
                Shaxsiy ma’lumotlarni tahrirlash
              </h3>
            </div>

            <ProfileForm
              initialFirstName={firstName}
              initialLastName={lastName}
              email={email}
            />
          </div>
        </section>

        {/* 2. Quick Action Navigation Hub */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-[#171B16]">
            Boshqaruv va bo‘limlar
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            <Link
              href="/categories"
              className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E8EBE5] hover:border-[#163300]/30 hover:shadow-card transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 rounded-2xl bg-[#F0F9E9] text-[#163300] group-hover:scale-105 transition-transform shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#171B16] truncate">
                    Kategoriyalarni sozlash
                  </h3>
                  <p className="text-xs text-[#697168] truncate mt-0.5">
                    Daromad va xarajat toifalarini boshqarish
                  </p>
                </div>
              </div>
              <div className="h-8 w-8 rounded-xl bg-[#F7F8F5] flex items-center justify-center text-[#697168] group-hover:text-[#163300] group-hover:bg-[#F0F9E9] transition-colors shrink-0">
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>

            <Link
              href="/imports"
              className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E8EBE5] hover:border-[#163300]/30 hover:shadow-card transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 rounded-2xl bg-[#EBF2FF] text-[#2563EB] group-hover:scale-105 transition-transform shrink-0">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#171B16] truncate">
                    Bank ko‘chirmalarini import qilish
                  </h3>
                  <p className="text-xs text-[#697168] truncate mt-0.5">
                    Excel, CSV va 1C ko‘chirmalarini yuklash
                  </p>
                </div>
              </div>
              <div className="h-8 w-8 rounded-xl bg-[#F7F8F5] flex items-center justify-center text-[#697168] group-hover:text-[#163300] group-hover:bg-[#F0F9E9] transition-colors shrink-0">
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>

            <Link
              href="/budgets"
              className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E8EBE5] hover:border-[#163300]/30 hover:shadow-card transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 rounded-2xl bg-[#FEF7EC] text-[#D97706] group-hover:scale-105 transition-transform shrink-0">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#171B16] truncate">
                    Jamg‘arma va budjetlar
                  </h3>
                  <p className="text-xs text-[#697168] truncate mt-0.5">
                    Oylik xarajat limitlari va moliyaviy maqsadlar
                  </p>
                </div>
              </div>
              <div className="h-8 w-8 rounded-xl bg-[#F7F8F5] flex items-center justify-center text-[#697168] group-hover:text-[#163300] group-hover:bg-[#F0F9E9] transition-colors shrink-0">
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>

            <Link
              href="/advisor"
              className="bg-white rounded-3xl p-4 sm:p-5 border border-[#E8EBE5] hover:border-[#163300]/30 hover:shadow-card transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 rounded-2xl bg-[#F5F0FF] text-[#7C3AED] group-hover:scale-105 transition-transform shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#171B16] truncate">
                    AI Moliyaviy maslahatchi
                  </h3>
                  <p className="text-xs text-[#697168] truncate mt-0.5">
                    Shaxsiy moliyaviy tahlil va tavsiyalar
                  </p>
                </div>
              </div>
              <div className="h-8 w-8 rounded-xl bg-[#F7F8F5] flex items-center justify-center text-[#697168] group-hover:text-[#163300] group-hover:bg-[#F0F9E9] transition-colors shrink-0">
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
          </div>
        </section>

        {/* 3. Danger Zone / Security & Session */}
        <section className="bg-white rounded-3xl p-5 sm:p-8 border border-[#E8EBE5] shadow-xs space-y-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-[#171B16]">
              Xavfsizlik va tizimdan chiqish
            </h2>
            <p className="text-xs sm:text-sm text-[#697168]">
              Joriy qurilmadagi faol sessiyani yakunlash yoki hisobdan chiqish
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[#F0F2ED]">
            <div className="text-xs text-[#697168]">
              Sessiyani yakunlaganingizdan so‘ng qayta kirish uchun Telegram hisobingizdan foydalanasiz.
            </div>
            <LogoutButton className="w-full sm:w-auto justify-center" />
          </div>
        </section>
      </main>
    </div>
  );
}
