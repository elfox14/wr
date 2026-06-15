'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { getTeamFlagUrl } from '@/lib/teamFlags';
import { hasUsablePlayerImage } from '@/lib/playerDedupe';

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
  type = 'PLAYER',
  name,
  alt,
  width = 100,
  height = 100,
  className = '',
  sizes,
  fill = false
}: AssetImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [image]);

  const isLocal = !!image && image.startsWith('/');
  const isExternal = !!image && (image.startsWith('http://') || image.startsWith('https://'));
  const isTeam = type === 'TEAM';
  const teamFlagUrl = isTeam ? getTeamFlagUrl({ name, image }, Math.max(width, height, 80)) : null;
  
  const isEmojiStr = !!image && (
    image.length <= 8 && 
    (/[🌀-🧿]|[😀-🙏]|[🚀-🛿]|[☀-➿]|[🇦-🇿]{2}/u.test(image))
  );

  const renderTeamFlag = (src: string) => (
    <img
      src={src}
      alt={alt || name}
      className={`select-none rounded-xl object-cover ${className}`}
      loading="lazy"
      style={{ width: fill ? '100%' : width, height: fill ? '100%' : height }}
    />
  );

  if (isTeam && teamFlagUrl) return renderTeamFlag(teamFlagUrl);

  const renderFallback = () => {
    const initials = name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

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

  if (isTeam && isEmojiStr && image) {
    return (
      <div
        className={`flex items-center justify-center select-none rounded-xl bg-white/10 ${className}`}
        style={{ width: fill ? '100%' : width, height: fill ? '100%' : height, fontSize: `${Math.min(width, height) * 0.6}px` }}
        aria-label={alt || name}
      >
        {image}
      </div>
    );
  }

  const hasValidImage = type === 'PLAYER' ? hasUsablePlayerImage(image) : (isLocal || isExternal) && !isEmojiStr;

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