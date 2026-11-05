import { NextRequest, NextResponse } from 'next/server';
import { askFinancialAdvisor, simulateBudgetScenario } from '@/lib/ai/advisorService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if simulation request or Q&A
    if (body.action === 'simulate') {
      const { categoryName, percentageReduction } = body;
      if (!categoryName || percentageReduction === undefined) {
        return NextResponse.json(
          { error: 'categoryName and percentageReduction are required for simulation' },
          { status: 400 }
        );
      }
      const simRes = await simulateBudgetScenario(categoryName, Number(percentageReduction));
      if (simRes.error) {
        return NextResponse.json({ error: simRes.error }, { status: simRes.status });
      }
      return NextResponse.json({ simulation: simRes.data }, { status: 200 });
    }

    const question = (body.question || body.message || body.prompt || '').trim();
    const conversationId = body.conversationId;
    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }

    const result = await askFinancialAdvisor(question, conversationId);
    if (result.error) {
      // AI is available only to authenticated Telegram Mini App users.
      // Never accept client-supplied financial context or fabricate guest answers.
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      {
        response: result.data,
        answer: result.data?.answer,
        reply: result.data?.answer,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error in AI Advisor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
