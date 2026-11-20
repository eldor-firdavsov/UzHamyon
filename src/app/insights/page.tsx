import { redirect } from 'next/navigation';

/** Insights now live in the AI tab. */
export default function InsightsPage() {
  redirect('/ai');
}
