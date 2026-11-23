import { NextResponse } from 'next/server';
import { listImportJobs } from '@/lib/imports/service';

export async function GET() {
  try {
    const result = await listImportJobs();

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ jobs: result.data }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Importlar ro‘yxatini olishda server xatoligi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
