import type { z } from 'zod';
import { ErrorBodySchema, type ErrorBody, type ErrorCode } from '../../../packages/domain/contracts';

/**
 * Classificação de falhas que a interface sabe tratar. "timeout" e "network" significam
 * resultado DESCONHECIDO para operações de escrita: nunca afirmar sucesso nem falha.
 */
export type FailureKind = ErrorCode | 'timeout' | 'network' | 'aborted' | 'invalid_response';

export class RequestError extends Error {
 constructor(readonly kind: FailureKind, message: string, readonly status = 0, readonly body?: ErrorBody) { super(message); }
 /** O servidor pode ter concluído a operação: só a reconciliação pelo identificador decide. */
 get outcomeUnknown() { return this.kind === 'timeout' || this.kind === 'network' || this.kind === 'invalid_response' || (this.status >= 500 && this.kind !== 'aborted'); }
}

export const isAbort = (e: unknown) => e instanceof RequestError && e.kind === 'aborted';

type Options = { method?: 'GET' | 'POST' | 'PUT'; body?: unknown; raw?: Blob; contentType?: string; signal?: AbortSignal; timeoutMs?: number };

/**
 * Cliente HTTP do mesmo domínio. A sessão viaja no cookie HttpOnly (o JavaScript não a lê);
 * o token CSRF fica só em memória e acompanha toda requisição que altera dados.
 */
export class ApiClient {
 private csrf = '';
 constructor(private readonly onUnauthenticated: (kind: 'unauthenticated' | 'session_expired') => void, private readonly timeoutMs = 15_000) {}

 setCsrf(token: string) { this.csrf = token; }

 async request<T>(path: string, schema: z.ZodType<T>, options: Options = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), options.timeoutMs ?? this.timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout.signal]) : timeout.signal;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-CSRF-Token'] = this.csrf;
  let body: BodyInit | undefined;
  if (options.raw) { body = options.raw; headers['Content-Type'] = options.contentType ?? options.raw.type; }
  else if (options.body !== undefined) { body = JSON.stringify(options.body); headers['Content-Type'] = 'application/json'; }
  let response: Response;
  try {
   response = await fetch(path, { method, headers, body, credentials: 'same-origin', signal, cache: 'no-store' });
  } catch {
   clearTimeout(timer);
   if (options.signal?.aborted) throw new RequestError('aborted', 'Requisição cancelada.');
   if (timeout.signal.aborted) throw new RequestError('timeout', 'O servidor não respondeu a tempo.');
   throw new RequestError('network', 'Sem conexão com o servidor.');
  }
  clearTimeout(timer);
  let json: unknown = null;
  try { json = await response.json(); } catch { json = null; }
  if (options.signal?.aborted) throw new RequestError('aborted', 'Requisição cancelada.');
  if (!response.ok) {
   const parsed = ErrorBodySchema.safeParse(json);
   const error = parsed.success
    ? new RequestError(parsed.data.error, parsed.data.message, response.status, parsed.data)
    : new RequestError(response.status >= 500 ? 'server_error' : 'validation', 'Não foi possível concluir a operação.', response.status);
   if (error.kind === 'unauthenticated' || error.kind === 'session_expired') this.onUnauthenticated(error.kind);
   throw error;
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new RequestError('invalid_response', 'Resposta inesperada do servidor.', response.status);
  return parsed.data;
 }
}
