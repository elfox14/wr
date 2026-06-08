import React from 'react';

interface BrandLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function BrandLogo({ className = '', width = 40, height = 40 }: BrandLogoProps) {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Base Geometric Circle */}
      <circle cx="50" cy="50" r="45" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.1" fill="#050505" />
      
      {/* Inner Hexagon / Football geometry hint */}
      <path 
        d="M50 15 L80 32 L80 68 L50 85 L20 68 L20 32 Z" 
        stroke="#0FF0FC" 
        strokeWidth="3" 
        strokeOpacity="0.3"
        fill="none"
      />
      <path 
        d="M50 85 L50 50 L20 32 M50 50 L80 32" 
        stroke="#0FF0FC" 
        strokeWidth="2" 
        strokeOpacity="0.2"
        fill="none"
      />

      {/* Upward Market Arrow */}
      <path 
        d="M35 65 L65 35 M65 35 L45 35 M65 35 L65 55" 
        stroke="#0FF0FC" 
        strokeWidth="5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="drop-shadow-[0_0_8px_rgba(15,240,252,0.6)]"
      />

      {/* Premium Gold Highlight Dot */}
      <circle 
        cx="65" 
        cy="35" 
        r="4" 
        fill="#FFD700" 
        className="drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]"
      />
    </svg>
  );
}
