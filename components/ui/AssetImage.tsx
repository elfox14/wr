'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { getAvatarFallbackUrl } from '@/lib/images';

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
  type,
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
  
  // Heuristic to detect if the string is an emoji (e.g. flag emojis or single soccer ball emojis)
  const isEmojiStr = !!image && (
    image.length <= 8 && 
    (/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]{2}/u.test(image))
  );

  const fallbackUrl = getAvatarFallbackUrl(name);

  // If the image source is an emoji, render it as text in a styled container
  if (isEmojiStr && image) {
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

  // Load the target image if it is local/external; otherwise, use fallback avatar
  const srcToLoad = (isLocal || isExternal) ? image : fallbackUrl;
  const currentSrc = hasError ? fallbackUrl : srcToLoad;

  const handleError = () => {
    setHasError(true);
  };

  const imageProps = fill
    ? { fill: true, sizes: sizes || "100vw" }
    : { width, height };

  return (
    <Image
      src={currentSrc || fallbackUrl}
      alt={alt || name}
      className={className}
      onError={handleError}
      unoptimized
      {...imageProps}
    />
  );
}
