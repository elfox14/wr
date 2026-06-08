'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface AssetImageProps {
  image: string | null | undefined;
  type?: 'TEAM' | 'PLAYER';
  name: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  fill?: boolean;
}

export function AssetImage({
  image,
  type = 'PLAYER', // Default to PLAYER for safety
  name,
  alt,
  width = 100,
  height = 100,
  className = '',
  sizes,
  fill = false
}: AssetImageProps) {
  const [hasError, setHasError] = useState(false);

  // Reset error state when the image prop changes
  useEffect(() => {
    setHasError(false);
  }, [image]);

  const isLocal = !!image && image.startsWith('/');
  const isExternal = !!image && (image.startsWith('http://') || image.startsWith('https://'));
  const isTeam = type === 'TEAM';
  
  // Heuristic to detect if the string is an emoji (e.g. flag emojis or single soccer ball emojis)
  const isEmojiStr = !!image && (
    image.length <= 8 && 
    (/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]{2}/u.test(image))
  );

  // Fallback initials container with premium styling (cyan/gold border and dark background)
  const renderFallback = () => {
    const initials = name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    // Determine gold or cyan border based on the name character values
    const charSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const isGold = charSum % 2 === 0;
    const themeColor = isGold ? '#FFD700' : '#0FF0FC';
    const glowColor = isGold ? 'rgba(255,215,0,0.15)' : 'rgba(15,240,252,0.15)';

    return (
      <div 
        className={`flex items-center justify-center font-black select-none rounded-xl bg-gradient-to-br from-[#11111e] to-[#1a1a2e] ${className}`}
        style={{
          width: fill ? '100%' : width,
          height: fill ? '100%' : height,
          border: `2px solid ${themeColor}40`,
          boxShadow: `0 0 10px ${glowColor}`,
          color: themeColor,
          fontSize: fill ? 'inherit' : `${Math.min(width, height) * 0.38}px`,
          lineHeight: 1
        }}
        aria-label={alt || name}
      >
        {initials}
      </div>
    );
  };

  // If the image source is an emoji and it's a team, render it directly
  if (isTeam && isEmojiStr && image) {
    return (
      <div 
        className={`flex items-center justify-center select-none ${className}`} 
        style={{ 
          width: fill ? '100%' : width, 
          height: fill ? '100%' : height,
          fontSize: fill ? 'inherit' : `${Math.min(width, height) * 0.6}px`,
          lineHeight: 1
        }}
        aria-label={alt || name}
      >
        {image}
      </div>
    );
  }

  // Load the target image if it is local/external and not an emoji
  const hasValidImage = (isLocal || isExternal) && !isEmojiStr;

  if (!hasValidImage || hasError) {
    return renderFallback();
  }

  const handleError = () => {
    setHasError(true);
  };

  const imageProps = fill
    ? { fill: true, sizes: sizes || "100vw" }
    : { width, height };

  return (
    <Image
      src={image as string}
      alt={alt || name}
      className={className}
      onError={handleError}
      unoptimized
      {...imageProps}
    />
  );
}
