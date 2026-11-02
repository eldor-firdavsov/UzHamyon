import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import UzHamyonPrototypeApp from '@/components/prototype/UzHamyonPrototypeApp';

export const metadata = {
  title: 'Budjetlar — UzHamyon',
  description: 'Xarajat limitlarini belgilang va real vaqtda sarf-xarajatlarni kuzatib boring.',
};

export default async function BudgetsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  const profileName = profile?.first_name ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ''}` : '';
  const metaName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || user.user_metadata?.full_name || '';
  const emailPrefix = (user.email || '').split('@')[0] || '';
  const cleanEmailName = emailPrefix.replace(/[0-9_.-]/g, ' ').trim();
  const displayName = profileName || metaName || (cleanEmailName ? cleanEmailName.charAt(0).toUpperCase() + cleanEmailName.slice(1).toLowerCase() : 'Foydalanuvchi');

  return (
    <UzHamyonPrototypeApp
      initialTab="tahlil"
      initialSubTab="an"
      initialUserName={displayName}
      userEmail={user.email}
    />
  );
}
