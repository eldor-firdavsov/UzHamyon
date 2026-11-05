import { redirect } from 'next/navigation';

export default function RegisterPage() {
  // Registration happens automatically through Telegram authentication.
  // There is no separate email/password sign-up flow.
  redirect('/login');
}
