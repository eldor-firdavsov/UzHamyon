import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Legacy Vite entry point. Registration happens automatically through
 * Telegram authentication, so there is no separate sign-up screen.
 */
export default function RegisterPage() {
  return <Navigate to="/login" replace />;
}
