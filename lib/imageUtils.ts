const shimmerSvg = (w: number, h: number) =>
  `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="#e8e8e8" stop-opacity="1"/>
        <stop offset="50%"  stop-color="#f2f2f2" stop-opacity="1"/>
        <stop offset="100%" stop-color="#e8e8e8" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
  </svg>`;

const toBase64 = (str: string) =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str);

/** A tiny shimmer SVG encoded as a base64 data URL — use as `blurDataURL` on Next.js Image */
export const shimmerBlur = (w = 8, h = 8) =>
  `data:image/svg+xml;base64,${toBase64(shimmerSvg(w, h))}`;
