import { AsyncLocalStorage } from 'node:async_hooks';
import type { Client } from '@taskop/contracts';
import type { NextFunction, Request, Response } from 'express';

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
  /** The caller's app, known once the access token (or the login body) has been read; null for jobs. */
  client: Client | null;
}

const storage = new AsyncLocalStorage<RequestMeta>();

export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const userAgent = req.headers['user-agent'];
  storage.run(
    {
      ip: req.ip ?? null,
      userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 300) : null,
      client: null,
    },
    next,
  );
}

export function currentRequestMeta(): RequestMeta {
  return storage.getStore() ?? { ip: null, userAgent: null, client: null };
}

/** Tags the rest of this request (its audit rows) with the caller's app. A no-op outside a request. */
export function setRequestClient(client: Client | null): void {
  const meta = storage.getStore();
  if (meta) meta.client = client;
}
