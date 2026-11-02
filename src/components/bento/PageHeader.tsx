import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  refreshId?: string;
  refreshTitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

/**
 * Standardized PageHeader component for UzHamyon pages.
 * Integrates semantic h1 heading, optional breadcrumb trail, and responsive action triggers.
 */
export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  breadcrumbs,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`mb-5 sm:mb-6 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-[#71717A] mb-2">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-[#E5E7EB]" />}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-[#18181B] transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'font-medium text-[#18181B]' : ''}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#18181B]">
                {title}
              </h1>
              {badge}
            </div>
          </div>

          {subtitle && (
            <p className="text-xs sm:text-sm text-[#52525B] max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right side controls on desktop & mobile secondary buttons */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 pt-0.5">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;

