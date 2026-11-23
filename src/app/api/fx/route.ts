import { NextResponse } from 'next/server';
import { getUsdUzsRate } from '@/lib/fx/rates';

/** Current USD → UZS rate for the currency switch (public data, no auth needed). */
export async function GET() {
  const rate = await getUsdUzsRate();
  return NextResponse.json(rate, {
    status: 200,
    headers: { 'Cache-Control': 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600' },
  });
}
