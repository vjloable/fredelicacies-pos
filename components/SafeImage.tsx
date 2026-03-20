'use client';

import { useState } from 'react';
import Image from "next/image";
import { shimmerBlur } from "@/lib/imageUtils";

interface SafeImageProps {
    src: string;
    alt: string;
    className?: string
}

const BLUR_URL = shimmerBlur(8, 8);

export default function SafeImage({ src, alt, className }: SafeImageProps) {
    const [hasError, setHasError] = useState(false);

    if (hasError || !src) {
        return null;
    }

    return (
        <Image
            src={src}
            alt={alt}
            fill
            className={`object-cover ${className || ''}`}
            sizes="102px"
            placeholder="blur"
            blurDataURL={BLUR_URL}
            onError={() => {
                console.error('Image failed to load:', src);
                setHasError(true);
            }}
        />
    );
};
