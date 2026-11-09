import { DemoApp } from './DemoApp';
import { Landing } from './Landing';
import { RealApp } from './RealApp';
import { navigate, usePath } from './router';

/** Site público, demonstração (sandbox) e operação real compartilham a mesma base de telas. */
export function Root() {
 const path = usePath();
 if (path === '/demo' || path.startsWith('/demo/')) return <DemoApp />;
 if (path === '/app' || path.startsWith('/app/')) return <RealApp />;
 return <Landing enter={() => navigate('/demo')} signIn={() => navigate('/app')} />;
}
