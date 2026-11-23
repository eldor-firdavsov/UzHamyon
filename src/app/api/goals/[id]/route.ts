import { NextRequest, NextResponse } from 'next/server';
import { getGoal, updateGoal, deleteGoal } from '@/lib/goals/service';
import { notifyCompletedGoals } from '@/lib/goals/notifications';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getGoal(id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ goal: result.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Maqsadni olishda server xatoligi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await updateGoal(id, body);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (result.data?.status === 'completed') {
      await notifyCompletedGoals(await createClient());
    }

    return NextResponse.json({ goal: result.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Maqsadni yangilashda server xatoligi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await deleteGoal(id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, id: result.data?.id }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Maqsadni o‘chirishda server xatoligi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
