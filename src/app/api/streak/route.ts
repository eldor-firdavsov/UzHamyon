import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStreakForUser } from '@/lib/streak/service';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const streak = await getStreakForUser(supabase, user.id);
    return NextResponse.json(streak, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching streak';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
