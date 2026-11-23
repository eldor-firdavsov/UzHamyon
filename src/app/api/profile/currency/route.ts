import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DISPLAY_CURRENCIES, toDisplayCurrency } from '@/lib/fx/currency';
import { getPreferredCurrency, setPreferredCurrency } from '@/lib/profile/preferredCurrency';

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: 'Ruxsat yo‘q: avval tizimga kiring' }, { status: 401 });
  const currency = await getPreferredCurrency(supabase, user.id);
  return NextResponse.json({ currency }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: NextRequest) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: 'Ruxsat yo‘q: avval tizimga kiring' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { currency?: string } | null;
  const raw = String(body?.currency || '').trim().toUpperCase();
  if (!DISPLAY_CURRENCIES.includes(raw as never)) {
    return NextResponse.json({ error: 'Valyuta UZS yoki USD bo‘lishi kerak' }, { status: 400 });
  }
  const currency = toDisplayCurrency(raw);
  const res = await setPreferredCurrency(supabase, user.id, currency);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ currency });
}
