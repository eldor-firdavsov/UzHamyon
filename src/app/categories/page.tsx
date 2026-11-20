import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CategoriesManager from '@/components/categories/CategoriesManager';

export const metadata = {
  title: 'Kategoriyalar — UzHamyon',
  description: 'UzHamyon ilovasida shaxsiy xarajat va daromad kategoriyalarini boshqaring',
};

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-[#F2F4EF] text-[#111511] antialiased">
      <CategoriesManager />
    </div>
  );
}
