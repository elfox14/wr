import React from 'react';
import Image from 'next/image';

interface AssetImageProps {
  image: string;
  name: string;
  className?: string;
  width?: number;
  height?: number;
}

export function AssetImage({ image, name, className = '', width = 100, height = 100 }: AssetImageProps) {
  if (!image) return null;

  const isUrl = image.startsWith('http');

  if (isUrl) {
    return (
      <div className={`relative flex items-center justify-center ${className}`} style={{ width: className.includes('w-') ? undefined : width, height: className.includes('h-') ? undefined : height }}>
        <Image 
          src={image} 
          alt={name} 
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      </div>
    );
  }

  // Fallback for emojis
  return <span className={className}>{image}</span>;
}
