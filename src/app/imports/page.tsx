import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ImportManager from '@/components/imports/ImportManager';

export const metadata = {
  title: 'Import — UzHamyon',
  description: 'Bank ko‘chirmalari va moliyaviy ma’lumotlarni dublikatsiz yuklang.',
};

export default async function ImportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-[#F2F4EF] text-[#111511] antialiased">
      <ImportManager />
    </div>
  );
}
