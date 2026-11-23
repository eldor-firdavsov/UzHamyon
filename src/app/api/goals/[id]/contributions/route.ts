import { NextRequest, NextResponse } from 'next/server';
import { contributeToGoal, listGoalContributions } from '@/lib/goals/service';
import { notifyCompletedGoals } from '@/lib/goals/notifications';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await listGoalContributions(id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (err: unknown) {
    console.error('[api/goals/contributions] GET error:', err);
    return NextResponse.json({ error: 'Hissalar ro‘yxatini olishda server xatoligi' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    // Web contributions are always 'manual'; the client cannot choose another source.
    const result = await contributeToGoal(id, { amount: body?.amount, note: body?.note }, undefined, 'manual');

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (result.data?.status === 'completed') {
      await notifyCompletedGoals(await createClient());
    }

    return NextResponse.json({ goal: result.data }, { status: 200 });
  } catch (err: unknown) {
    console.error('[api/goals/contributions] POST error:', err);
    return NextResponse.json({ error: 'Maqsadga hissa qo‘shishda server xatoligi' }, { status: 500 });
  }
}
