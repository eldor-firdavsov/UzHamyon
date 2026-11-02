'use client';

import React from 'react';
import MobileNavBar from '@/components/navigation/MobileNavBar';

export type PrototypeTab = 'dashboard' | 'faoliyat' | 'tahlil' | 'ai';

interface FloatingMobileNavProps {
  activeTab: PrototypeTab;
  onTabChange: (tab: PrototypeTab) => void;
  onOpenAddModal: () => void;
}

export function FloatingMobileNav({
  activeTab,
  onTabChange,
  onOpenAddModal,
}: FloatingMobileNavProps) {
  return (
    <MobileNavBar
      onOpenAddTransaction={onOpenAddModal}
      activeTab={activeTab}
      className="lg:hidden"
      onTabChange={(tab) => {
        if (tab === 'dash') onTabChange('dashboard');
        else if (tab === 'act') onTabChange('faoliyat');
        else onTabChange(tab);
      }}
    />
  );
}

export default FloatingMobileNav;
