'use client';

import UzHamyonPrototypeApp from '@/components/prototype/UzHamyonPrototypeApp';

export default function UzHamyonRealPrototypePage() {
  return (
    <UzHamyonPrototypeApp
      initialTab="dash"
      allowDemoFallback={true}
      syncBrowserUrl={false}
    />
  );
}
