/**
 * API request/response logging middleware
 * Wraps API route handlers to log requests, responses, and errors
 */

import { log, getRequestContext, measureTime } from '@/lib/logging';

export type ApiHandlerParams = {
  req: Request;
  params?: Record<string, string>;
};

type ApiHandler = (params: ApiHandlerParams) => Promise<Response>;

/**
 * Wrap an API handler with automatic request/response logging
 * Usage:
 *   export const POST = withLogging(async ({ req, params }) => {
 *     // Your handler code
 *   });
 */
export function withLogging(handler: ApiHandler) {
  return async (req: Request, context?: { params?: Record<string, string> }) => {
    const timer = measureTime();
    const requestContext = getRequestContext(req);
    const pathname = new URL(req.url).pathname;

    log.info('API request started', {
      ...requestContext,
      pathname,
      contentType: req.headers.get('content-type'),
    });

    try {
      const response = await handler({
        req,
        params: context?.params,
      });

      const duration = timer.duration();
      log.info('API request completed', {
        ...requestContext,
        pathname,
        statusCode: response.status,
        duration,
      });

      return response;
    } catch (err) {
      const duration = timer.duration();
      log.error('API request failed', err as Error, {
        ...requestContext,
        pathname,
        duration,
      });

      // Return error response
      return Response.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
