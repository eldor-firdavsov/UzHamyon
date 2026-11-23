import { NextRequest, NextResponse } from 'next/server';
import { updateInsightStatus } from '@/lib/ai/insightsService';
import type { InsightStatus } from '@/types/database';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['new', 'viewed', 'dismissed', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: 'Holat quyidagilardan biri bo‘lishi kerak: new, viewed, dismissed, resolved' },
        { status: 400 }
      );
    }

    const result = await updateInsightStatus(id, status as InsightStatus);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ insight: result.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Xulosani yangilashda server xatoligi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
