'use client';

import { motion } from 'motion/react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-9 h-9',
  lg: 'w-12 h-12',
};

export default function LoadingSpinner({ size = 'sm', className = '' }: LoadingSpinnerProps) {
  return (
    <motion.div
      className={`${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
      animate={{ rotate: 720 }}
      transition={{
        // 2 revolutions (720°) in 1s: ease-in ramps up speed, ending at full
        // velocity so the stop reads as a quick jerk, then hold 500ms and repeat.
        duration: 1,
        ease: 'easeIn',
        repeat: Infinity,
        repeatDelay: 0.5,
      }}
      style={{ willChange: 'transform' }}
    >
      <svg viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M37.011 18.5055C37.011 8.28519 28.7258 0 18.5055 0C8.28521 0 3.14087e-06 8.28519 0 18.5055C-3.14087e-06 28.7258 8.28521 37.011 18.5055 37.011C28.7258 37.011 37.011 28.7258 37.011 18.5055Z" fill="var(--accent)" />
        <path d="M20.4846 12.887C20.4846 15.2137 22.3708 17.0999 24.6976 17.0999C27.0243 17.0999 28.9105 15.2137 28.9105 12.887C28.9105 10.5602 27.0243 8.67397 24.6976 8.67397C22.3708 8.67397 20.4846 10.5602 20.4846 12.887Z" fill="var(--secondary)" />
        <path d="M24.6976 27.5934C24.6976 26.1715 25.8503 25.0188 27.2722 25.0188C28.6941 25.0188 29.8468 26.1715 29.8468 27.5934C29.8468 29.0153 28.6941 30.168 27.2722 30.168C25.8503 30.168 24.6976 29.0153 24.6976 27.5934Z" fill="var(--secondary)" />
        <path d="M18.6511 28.0225C17.3477 28.0225 16.2911 29.0791 16.2911 30.3825C16.2911 31.686 17.3477 32.7426 18.6511 32.7426C19.9546 32.7426 21.0112 31.686 21.0112 30.3825C21.0112 29.0791 19.9546 28.0225 18.6511 28.0225Z" fill="var(--secondary)" />
        <path d="M10.5958 17.3145C12.4378 17.3145 13.931 15.8212 13.931 13.9792C13.931 12.1372 12.4378 10.6439 10.5958 10.6439C8.75373 10.6439 7.26047 12.1372 7.26047 13.9792C7.26048 15.8212 8.75373 17.3145 10.5958 17.3145Z" fill="var(--secondary)" />
      </svg>
      <span className="sr-only">Loading...</span>
    </motion.div>
  );
}
