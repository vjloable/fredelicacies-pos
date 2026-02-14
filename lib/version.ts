// Version information utility
// Automatically populated by Vercel deployment environment variables

export const VERSION_INFO = {
  // App version from package.json
  app: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
  
  // Git commit SHA (short)
  commit: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
  
  // Git branch
  branch: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF || 'development',
  
  // Deployment environment
  env: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
  
  // Build timestamp
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
} as const;

export function getVersionString(): string {
  return `v${VERSION_INFO.app}`;
}

export function getFullVersionString(): string {
  return `v${VERSION_INFO.app}-${VERSION_INFO.commit}`;
}

export function getVersionWithEnvironment(): string {
  if (VERSION_INFO.env === 'production') {
    return `v${VERSION_INFO.app}`;
  }
  return `v${VERSION_INFO.app}-${VERSION_INFO.env}`;
}

export function getDetailedVersion(): string {
  return `v${VERSION_INFO.app} (${VERSION_INFO.commit}) - ${VERSION_INFO.branch}`;
}
