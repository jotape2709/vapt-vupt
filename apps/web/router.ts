import { useEffect, useState } from 'react';

/** Roteamento mínimo por caminho: / (site), /demo (sandbox) e /app (operação real). */
export function navigate(path: string) {
 if (location.pathname + location.search === path) return;
 history.pushState(null, '', path);
 dispatchEvent(new PopStateEvent('popstate'));
}

export function usePath() {
 const [path, setPath] = useState(() => location.pathname);
 useEffect(() => {
  const update = () => setPath(location.pathname);
  addEventListener('popstate', update);
  return () => removeEventListener('popstate', update);
 }, []);
 return path;
}
