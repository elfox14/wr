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
    <div className="relative mb-10 md:mb-12">
      {/* Background glow effect */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 ${glowColor} rounded-full blur-3xl -z-10`}></div>
      
      <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6 text-center md:text-right">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 flex items-center justify-center md:justify-start gap-4">
            {icon && <span className={textColor}>{icon}</span>}
            <span>
              {title.split(' ').map((word, i, arr) => (
                <span key={i} className={i === arr.length - 1 ? textColor : 'text-white'}>
                  {word}{i !== arr.length - 1 ? ' ' : ''}
                </span>
              ))}
            </span>
            {icon && <span className={`${textColor} md:hidden`}>{icon}</span>}
          </h1>
          {description && (
            <p className="text-lg md:text-xl text-gray-400 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        
        {children && (
          <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0 justify-center md:justify-end">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
