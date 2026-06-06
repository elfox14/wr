'use client';

import React, { useState } from 'react';
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
  const [imgSrc, setImgSrc] = useState<string>(() => {
    // If it's an emoji (e.g. 🇧🇷) or totally empty, immediately use fallback
    if (!image || image.length < 10 || !image.startsWith('http')) {
      return getAvatarFallbackUrl(name);
    }
    return image;
  });

  const handleError = () => {
    // If the original image errors, swap to ui-avatars
    const fallback = getAvatarFallbackUrl(name);
    if (imgSrc !== fallback) {
      setImgSrc(fallback);
    }
  };

  const imageProps = fill
    ? { fill: true, sizes: sizes || "100vw" }
    : { width, height };

  return (
    <Image
      src={imgSrc}
      alt={alt || name}
      className={className}
      onError={handleError}
      unoptimized // Adding unoptimized to avoid weird remote pattern failures temporarily if Next.js blocks it before restart
      {...imageProps}
    />
  );
}
