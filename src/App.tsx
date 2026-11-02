import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import UzHamyonPrototypeApp from '@/components/prototype/UzHamyonPrototypeApp';
import LoginPage from '@/routes/LoginPage';
import RegisterPage from '@/routes/RegisterPage';
import OnboardingPage from '@/routes/OnboardingPage';
import { ProtectedRoute, PublicOnlyRoute } from '@/routes/ProtectedRoute';
import TelegramMiniAppInit from '@/components/telegram/TelegramMiniAppInit';

export default function App() {
  return (
    <>
      <TelegramMiniAppInit />
      <Routes>
      {/* Public Auth Routes */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Onboarding Route */}
      <Route path="/onboarding" element={<OnboardingPage />} />

      {/* Unauthenticated Prototype Preview Route */}
      <Route
        path="/prototype"
        element={<UzHamyonPrototypeApp initialTab="dash" allowDemoFallback={true} syncBrowserUrl={false} />}
      />

      {/* Protected Production Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<UzHamyonPrototypeApp initialTab="dash" />} />
        <Route path="/transactions" element={<UzHamyonPrototypeApp initialTab="act" />} />
        <Route path="/analytics" element={<UzHamyonPrototypeApp initialTab="tahlil" />} />
        <Route path="/advisor" element={<UzHamyonPrototypeApp initialTab="ai" />} />
        <Route path="/ai" element={<UzHamyonPrototypeApp initialTab="ai" />} />
        <Route path="/budgets" element={<UzHamyonPrototypeApp initialTab="tahlil" initialSubTab="an" />} />
        <Route path="/goals" element={<UzHamyonPrototypeApp initialTab="tahlil" initialSubTab="go" />} />
        <Route path="/settings" element={<UzHamyonPrototypeApp initialTab="dash" />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </>
  );
}
