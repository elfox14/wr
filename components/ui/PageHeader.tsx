import React, { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children?: ReactNode; // Extra elements like filters or buttons
  glowColor?: string; // e.g., 'bg-primary/10' or 'bg-accent/10'
  textColor?: string; // e.g., 'text-primary' or 'text-accent'
}

export function PageHeader({ 
  title, 
  description, 
  icon, 
  children,
  glowColor = 'bg-primary/10',
  textColor = 'text-primary'
}: PageHeaderProps) {
  return (
    <div className="relative mb-6 rounded-3xl border border-white/5 bg-surface/55 px-5 py-4 shadow-card md:px-6 md:py-5">
      {/* Compact background glow effect */}
      <div className={`absolute right-8 top-1/2 h-24 w-24 -translate-y-1/2 ${glowColor} rounded-full blur-3xl opacity-70 -z-10`} />
      
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            {icon && (
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/25 ${textColor}`}>
                {icon}
              </span>
            )}
            <h1 className="truncate text-2xl font-black tracking-tight text-white md:text-3xl">
              {title}
            </h1>
          </div>
          {description && (
            <p className="max-w-3xl text-sm leading-relaxed text-gray-400 md:text-base">
              {description}
            </p>
          )}
        </div>
        
        {children && (
          <div className="flex w-full items-center justify-center gap-3 md:w-auto md:justify-end">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
