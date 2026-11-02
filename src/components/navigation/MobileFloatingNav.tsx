'use client';

import React from 'react';
import MobileNavBar from './MobileNavBar';

export interface MobileFloatingNavProps {
  onOpenAddTransaction: () => void;
  className?: string;
}

export default function MobileFloatingNav({
  onOpenAddTransaction,
  className,
}: MobileFloatingNavProps) {
  return (
    <MobileNavBar
      onOpenAddTransaction={onOpenAddTransaction}
      className={className}
    />
  );
}
