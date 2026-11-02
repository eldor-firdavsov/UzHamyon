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
      // If unauthenticated (e.g. prototype preview or guest visitor), provide live OpenRouter AI response
      if (result.status === 401 || result.error.includes('Avtorizatsiya')) {
        const { generateAIContent } = await import('@/lib/ai/aiClient');
        const systemInstruction = `Siz UzHamyon — O‘zbekistondagi eng zamonaviy shaxsiy moliya va budjet boshqaruvi platformasining sun’iy intellekt moliyaviy maslahatchisisiz.
Foydalanuvchining savoliga o‘zbek tilida aniq, samimiy, tushunarli, dalillarga asoslangan va professional tarzda javob bering.
Agar hisob-kitob, tejash, xarajatlar yoki budjet haqida so‘ralsa, O‘zbekiston sharoitiga mos amaliy raqamlar va tavsiyalar keltiring.
${body.context ? `\nFoydalanuvchining joriy moliyaviy konteksti:\n${body.context}` : ''}`;

        const aiRes = await generateAIContent(question, systemInstruction);
        const replyText = aiRes.text || 'Kechirasiz, hozirda javobni shakllantirishda xatolik yuz berdi. Iltimos qaytadan urinib ko‘ring.';

        return NextResponse.json(
          {
            response: {
              conversationId: 'demo-guest',
              messageId: 'msg-' + Date.now(),
              answer: replyText,
              isAiFallback: aiRes.isFallback,
              evidence: { model: aiRes.model },
            },
            answer: replyText,
            reply: replyText,
          },
          { status: 200 }
        );
      }

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
