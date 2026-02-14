'use client';

import { VERSION_INFO, getFullVersionString } from '@/lib/version';

interface VersionDisplayProps {
  variant?: 'simple' | 'detailed' | 'full';
  className?: string;
  showEnvironment?: boolean;
}

export default function VersionDisplay({ 
  variant = 'simple', 
  className = '',
  showEnvironment = false 
}: VersionDisplayProps) {
  const renderVersion = () => {
    switch (variant) {
      case 'detailed':
        return (
          <div className={`text-xs ${className}`}>
            <div>Version: {VERSION_INFO.app}</div>
            <div>Commit: {VERSION_INFO.commit}</div>
            <div>Branch: {VERSION_INFO.branch}</div>
            {showEnvironment && <div>Env: {VERSION_INFO.env}</div>}
          </div>
        );
      
      case 'full':
        return (
          <div className={`text-xs space-y-1 ${className}`}>
            <div className="font-semibold">v{VERSION_INFO.app}</div>
            <div className="opacity-70">
              {VERSION_INFO.commit} • {VERSION_INFO.branch}
            </div>
            {showEnvironment && (
              <div className="opacity-50">{VERSION_INFO.env}</div>
            )}
            <div className="opacity-50 text-[10px]">
              Built: {new Date(VERSION_INFO.buildTime).toLocaleString()}
            </div>
          </div>
        );
      
      case 'simple':
      default:
        return (
          <span className={`text-xs ${className}`}>
            {getFullVersionString()}
          </span>
        );
    }
  };

  return renderVersion();
}
