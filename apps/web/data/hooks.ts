import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbort, RequestError } from './http';

export type Paged<T, Extra> = {
 items: T[]; extra: Extra | null; nextCursor: string | null;
 loading: boolean; refreshing: boolean; loadingMore: boolean; error: RequestError | null;
 loadMore: () => void; retry: () => void;
};

/**
 * Lista paginada com cancelamento: cada mudança de filtro (key) cancela a carga anterior e
 * ignora respostas atrasadas. "Carregar mais" acumula páginas da mesma consulta.
 */
export function usePaged<T, Extra>(
 key: string,
 refresh: number,
 load: (cursor: string | undefined, signal: AbortSignal) => Promise<{ items: T[]; nextCursor: string | null; extra: Extra }>
): Paged<T, Extra> {
 const [state, setState] = useState<{ key: string; items: T[]; extra: Extra | null; nextCursor: string | null; loading: boolean; loadingMore: boolean; error: RequestError | null }>(
  { key, items: [], extra: null, nextCursor: null, loading: true, loadingMore: false, error: null });
 const [attempt, setAttempt] = useState(0);
 const loadRef = useRef(load);
 loadRef.current = load;
 const moreController = useRef<AbortController | null>(null);

 useEffect(() => {
  const controller = new AbortController();
  moreController.current?.abort();
  setState(s => ({ ...s, key, loading: true, error: null, ...(s.key !== key ? { items: [], extra: null, nextCursor: null } : {}) }));
  loadRef.current(undefined, controller.signal).then(page => {
   if (controller.signal.aborted) return;
   setState({ key, items: page.items, extra: page.extra, nextCursor: page.nextCursor, loading: false, loadingMore: false, error: null });
  }, e => {
   if (controller.signal.aborted || isAbort(e)) return;
   setState(s => ({ ...s, loading: false, error: e instanceof RequestError ? e : new RequestError('server_error', 'Falha inesperada.') }));
  });
  return () => controller.abort();
 }, [key, attempt, refresh]);

 const stateRef = useRef(state);
 stateRef.current = state;
 const loadMore = useCallback(() => {
  const s = stateRef.current;
  if (!s.nextCursor || s.loadingMore || s.loading) return;
  const controller = new AbortController();
  moreController.current = controller;
  const forKey = s.key;
  setState(cur => ({ ...cur, loadingMore: true }));
  loadRef.current(s.nextCursor, controller.signal).then(page => {
   if (controller.signal.aborted) return;
   setState(cur => cur.key !== forKey ? cur : { ...cur, items: [...cur.items, ...page.items], extra: page.extra, nextCursor: page.nextCursor, loadingMore: false });
  }, e => {
   if (controller.signal.aborted || isAbort(e)) return;
   setState(cur => ({ ...cur, loadingMore: false, error: e instanceof RequestError ? e : null }));
  });
 }, []);

 useEffect(() => () => moreController.current?.abort(), []);

 return {
  items: state.key === key ? state.items : [], extra: state.key === key ? state.extra : null, nextCursor: state.nextCursor,
  loading: state.key !== key || (state.loading && state.items.length === 0 && !state.extra), refreshing: state.loading, loadingMore: state.loadingMore, error: state.error,
  loadMore, retry: () => setAttempt(n => n + 1)
 };
}

/** Atraso para busca digitada: evita uma requisição por tecla. */
export function useDebounced<T>(value: T, ms = 250) {
 const [current, setCurrent] = useState(value);
 useEffect(() => { const t = setTimeout(() => setCurrent(value), ms); return () => clearTimeout(t); }, [value, ms]);
 return current;
}
