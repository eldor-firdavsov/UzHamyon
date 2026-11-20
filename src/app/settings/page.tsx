import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, LayoutGrid, Send, Target } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import ProfileForm from '@/components/ProfileForm';
import LogoutButton from '@/components/LogoutButton';

const LINKS = [
  { href: '/categories', label: 'Kategoriyalar', bg: '#7A5AE0', Icon: LayoutGrid },
  { href: '/imports', label: 'Import', bg: '#2457C5', Icon: Download },
  { href: '/analytics', label: 'Limitlar va maqsadlar', bg: '#3E8E0A', Icon: Target },
];

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

  const initial = fullName.charAt(0).toUpperCase() || 'U';
  const viaTelegram = email.startsWith('tg_') && email.endsWith('@telegram.uzhamyon.uz');

  return (
    <div className="min-h-screen bg-[#F2F4EF] text-[#111511] antialiased">
      <main className="w-full max-w-xl mx-auto px-4 pt-4 pb-16 flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            aria-label="Orqaga"
            className="h-10 w-10 rounded-full bg-white text-[#3B403A] grid place-items-center shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[28px] font-extrabold tracking-tight">Sozlamalar</h1>
          <span className="sr-only">Hisob sozlamalari</span>
        </div>

        <div className="flex flex-col items-center gap-1.5 pt-1">
          <div className="h-20 w-20 rounded-full bg-[#163300] text-[#9FE870] grid place-items-center text-[32px] font-extrabold">
            {initial}
          </div>
          <div className="text-[22px] font-extrabold tracking-tight text-center">{fullName}</div>
          {viaTelegram ? (
            <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2AABEE]">
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              Telegram
            </div>
          ) : (
            <div className="text-[13px] text-[#6B7068] break-all">{email}</div>
          )}
        </div>

        <ProfileForm initialFirstName={firstName} initialLastName={lastName} email={email} />

        <div className="uz-m-list">
          {LINKS.map(({ href, label, bg, Icon }) => (
            <Link key={href} href={href} className="uz-m-row uz-p-link">
              <span className="uz-p-link-ic" style={{ background: bg }}>
                <Icon size={17} strokeWidth={2.2} />
              </span>
              <span className="uz-m-row-main">
                <span className="uz-p-link-label">{label}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-[#AEB4AA]" aria-hidden="true" />
            </Link>
          ))}
        </div>

        <div className="uz-m-list">
          <LogoutButton />
        </div>
      </main>
    </div>
  );
}
