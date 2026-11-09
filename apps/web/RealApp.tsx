import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ContextSchema, MeSchema, SessionSchema, UserPreferencesSchema, roleLabels, segmentLabels, type Context, type Me, type Session, type UserPreferences } from '../../packages/domain/contracts';
import { z } from 'zod';
import { Icon, Mark } from './components';
import { ApiGateway } from './data/apiGateway';
import { ApiClient, RequestError, isAbort } from './data/http';
import type { Copy } from './pages';
import { navigate } from './router';
import { visualOf } from './theme';
import { Workspace, type Notice } from './Workspace';

type Phase =
 | { name: 'loading' }
 | { name: 'anonymous'; reason?: string }
 | { name: 'expired' }
 | { name: 'error'; message: string }
 | { name: 'ready'; session: Session; me: Me };

const planned: Record<string, { title: string; text: string }> = {
 purchases: { title: 'Compras com contexto', text: 'Compras e fornecedores ainda não estão disponíveis na operação real. Nenhum pedido é enviado.' },
 quotes: { title: 'Cotações sem adivinhação', text: 'Não há fornecedores conectados. Nenhuma solicitação é enviada.' },
 team: { title: 'Cada pessoa, o acesso certo', text: 'No piloto, pessoas e funções são concedidas pelo administrador (comando documentado). Esconder um menu não muda o que o servidor permite.' }
};

const authMessages: Record<string, string> = {
 expired: 'O login demorou demais ou foi aberto em outra aba. Tente de novo.',
 denied: 'O login foi cancelado no provedor de identidade.',
 failed: 'Não foi possível concluir o login. Tente de novo; se persistir, fale com o administrador.'
};

/**
 * Operação real: sessão de servidor, empresas autorizadas pelo servidor e dados persistidos.
 * Ao trocar de empresa, sair ou perder a sessão, todo dado em memória é descartado.
 */
export function RealApp() {
 const [phase, setPhase] = useState<Phase>({ name: 'loading' });
 const [activeOrg, setActiveOrg] = useState<string | null>(null);
 const [context, setContext] = useState<{ orgId: string; data: Context } | null>(null);
 const [contextError, setContextError] = useState<{ orgId: string; error: RequestError } | null>(null);
 const [contextAttempt, setContextAttempt] = useState(0);
 const [notice, setNotice] = useState<Notice | null>(null);
 const [preferences, setPreferences] = useState<UserPreferences>(UserPreferencesSchema.parse({}));
 const activeRef = useRef<string | null>(null);

 const resetData = useCallback(() => { setContext(null); setContextError(null); setActiveOrg(null); activeRef.current = null; setNotice(null); }, []);
 const api = useMemo(() => new ApiClient(kind => {
  resetData();
  setPhase(kind === 'session_expired' ? { name: 'expired' } : { name: 'anonymous' });
 }), [resetData]);

 const bootstrap = useCallback(async () => {
  setPhase({ name: 'loading' });
  try {
   const session = await api.request('/api/session', SessionSchema);
   api.setCsrf(session.csrfToken);
   const me = await api.request('/api/me', MeSchema);
   setPreferences(me.preferences);
   setPhase({ name: 'ready', session, me });
   const first = me.organizations.find(o => o.id === me.lastOrganizationId) ?? me.organizations[0];
   activeRef.current = first?.id ?? null;
   setActiveOrg(first?.id ?? null);
  } catch (e) {
   if (e instanceof RequestError && (e.kind === 'unauthenticated' || e.kind === 'session_expired')) {
    const reason = new URLSearchParams(location.search).get('auth_error') ?? (new URLSearchParams(location.search).has('signed_out') ? 'signed_out' : undefined);
    setPhase(e.kind === 'session_expired' ? { name: 'expired' } : { name: 'anonymous', reason });
   } else setPhase({ name: 'error', message: e instanceof Error ? e.message : 'Falha ao iniciar.' });
  }
 }, [api]);

 useEffect(() => { void bootstrap(); }, [bootstrap]);

 // Ao voltar para a aba, confere a sessão: expiração aparece sem esperar uma ação.
 useEffect(() => {
  const onVisible = () => { if (document.visibilityState === 'visible' && phase.name === 'ready') void api.request('/api/session', SessionSchema).catch(() => undefined); };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
 }, [api, phase.name]);

 // Contexto da empresa ativa. Resposta de uma empresa anterior é descartada.
 useEffect(() => {
  if (!activeOrg) return;
  const controller = new AbortController();
  setContext(null); setContextError(null);
  api.request(`/api/orgs/${activeOrg}/context`, ContextSchema, { signal: controller.signal }).then(data => {
   if (controller.signal.aborted || activeRef.current !== activeOrg || data.organization.id !== activeOrg) return;
   setContext({ orgId: activeOrg, data });
  }, e => {
   if (controller.signal.aborted || isAbort(e) || activeRef.current !== activeOrg) return;
   setContextError({ orgId: activeOrg, error: e instanceof RequestError ? e : new RequestError('server_error', 'Falha inesperada.') });
  });
  return () => controller.abort();
 }, [api, activeOrg, contextAttempt]);

 // Um gateway por empresa carregada; descartado (requisições canceladas) na troca ou saída.
 const [gateway, setGateway] = useState<ApiGateway | null>(null);
 useEffect(() => {
  if (!context) { setGateway(null); return; }
  const g = new ApiGateway(api, context.orgId, context.data.unit.id);
  setGateway(g);
  return () => g.dispose();
 }, [api, context]);

 const switchOrg = (id: string) => {
  if (id === activeRef.current) return;
  activeRef.current = id;
  setGateway(null);
  setActiveOrg(id);
  const org = phase.name === 'ready' ? phase.me.organizations.find(o => o.id === id) : undefined;
  setNotice(org ? { text: `Você está em ${org.displayName} como ${roleLabels[org.role]}. Catálogo, saldos e histórico são só desta empresa.` } : null);
 };

 const logout = async () => {
  try {
   const { redirectTo } = await api.request('/auth/logout', z.object({ redirectTo: z.string().url() }).strict(), { method: 'POST' });
   resetData(); setPhase({ name: 'anonymous', reason: 'signed_out' });
   location.assign(redirectTo);
  } catch (e) {
   setNotice({ tone: 'error', text: (e instanceof Error ? e.message : 'Falha ao sair.') + ' A sessão pode continuar ativa; tente sair de novo.' });
  }
 };

 const savePreferences = async (next: UserPreferences) => {
  const previous = preferences;
  setPreferences(next);
  try { setPreferences(await api.request('/api/me/preferences', UserPreferencesSchema, { method: 'PUT', body: next })); }
  catch (e) { if (!isAbort(e)) { setPreferences(previous); setNotice({ tone: 'error', text: 'Não foi possível salvar sua preferência pessoal. Nada mudou no servidor.' }); } }
 };

 const login = () => { location.assign('/auth/login?returnTo=' + encodeURIComponent('/app')); };

 if (phase.name === 'loading') return <AuthScreen title="Conferindo sua sessão…" busy />;
 if (phase.name === 'error') return <AuthScreen title="Não foi possível falar com o servidor" text={phase.message}><button className="primary" onClick={() => void bootstrap()}>Tentar de novo</button></AuthScreen>;
 if (phase.name === 'anonymous') return <AuthScreen title="Entre para operar o seu estoque" text={phase.reason === 'signed_out' ? 'Você saiu. Seus dados continuam guardados no servidor da empresa.' : phase.reason ? authMessages[phase.reason] ?? authMessages.failed : 'Use a conta fornecida pela sua empresa. Os dados ficam no servidor, não neste navegador.'} tone={phase.reason && phase.reason !== 'signed_out' ? 'error' : undefined}>
  <button className="primary large" onClick={login}>Entrar com a conta da empresa <Icon name="arrow" /></button>
  <a className="link-arrow" href="/demo" onClick={e => { e.preventDefault(); navigate('/demo'); }}>Ver a demonstração com dados fictícios ↗</a>
 </AuthScreen>;
 if (phase.name === 'expired') return <AuthScreen title="Sua sessão terminou" text="Por segurança, a sessão expira depois de um tempo sem uso. Os dados em tela foram descartados; nada que não tenha sido confirmado pelo servidor foi registrado." tone="error">
  <button className="primary large" onClick={login}>Entrar novamente <Icon name="arrow" /></button>
 </AuthScreen>;

 const { me, session } = phase;
 if (!me.organizations.length) return <AuthScreen title="Sua conta ainda não tem acesso a uma empresa" text="O acesso é concedido pelo administrador do piloto. Envie a ele o identificador abaixo.">
  <dl className="identity-box"><dt>Identificador</dt><dd><code>{session.user.subject}</code></dd><dt>Provedor</dt><dd><code>{session.user.issuer}</code></dd></dl>
  <button onClick={() => void logout()}>Sair</button>
 </AuthScreen>;

 const orgSwitcher = <label>EMPRESA
  <select aria-label="Selecionar empresa" value={activeOrg ?? ''} onChange={e => switchOrg(e.target.value)}>
   {me.organizations.map(o => <option key={o.id} value={o.id}>{o.displayName} · {roleLabels[o.role]}</option>)}
  </select>
 </label>;

 if (contextError && contextError.orgId === activeOrg) {
  const denied = contextError.error.kind === 'forbidden';
  return <AuthScreen title={denied ? 'Acesso negado a esta empresa' : 'Não foi possível abrir a empresa'} text={denied ? 'O servidor não reconhece sua permissão nesta empresa. Ela pode ter sido removida há pouco.' : contextError.error.message} tone="error">
   {me.organizations.length > 1 && <div className="auth-switch">{orgSwitcher}</div>}
   <button className="primary" onClick={() => denied ? void bootstrap() : setContextAttempt(n => n + 1)}>{denied ? 'Atualizar minhas empresas' : 'Tentar de novo'}</button>
   <button onClick={() => void logout()}>Sair</button>
  </AuthScreen>;
 }
 if (!context || !gateway || context.orgId !== activeOrg || gateway.organizationId !== activeOrg) return <AuthScreen title="Abrindo a empresa…" busy />;

 const ctx = context.data;
 const unit = ctx.unit.name + (ctx.units.length <= 1 ? ' (piloto: uma unidade por empresa)' : '');
 const copy: Copy = {
  movementsMetric: `Unidade ${ctx.unit.name}, no servidor`,
  stockFoot: `Saldos da unidade ${ctx.unit.name}, confirmados pelo servidor. O piloto opera uma unidade por empresa; não há saldo consolidado. Quantidades inteiras.`,
  productsFoot: 'Catálogo da empresa. Código interno único por empresa. O saldo só muda por movimentação.',
  historyFoot: `Histórico da unidade ${ctx.unit.name}, registrado no servidor com autor e horário. Registros não são editados nem apagados.`,
  dailyNote: 'Conferiu a entrega? Registre a entrada: o saldo muda quando o servidor confirmar.'
 };
 const effective = visualOf(ctx.settings, preferences);

 return <Workspace key={context.orgId}
  gateway={gateway} envelope={ctx.settings}
  onEnvelope={env => setContext(c => c && c.orgId === env.organizationId ? { ...c, data: { ...c.data, settings: env, organization: { ...c.data.organization, displayName: env.settings.identity.displayName } } } : c)}
  unitName={unit} segmentLabel={segmentLabels[ctx.settings.settings.identity.segment]}
  permissions={ctx.permissions} preferences={preferences} onPreferences={p => void savePreferences(p)}
  toggleMode={() => void savePreferences({ ...preferences, mode: effective.mode === 'light' ? 'dark' : 'light' })}
  notice={notice} setNotice={setNotice} planned={planned} copy={copy}
  reloadSettings={() => setContextAttempt(n => n + 1)}
  onBrand={() => navigate('/')}
  pill="OPERAÇÃO REAL"
  footer={['Vapt-Vupt · piloto', 'Sessão no servidor; termina sozinha após inatividade.']}
  banner={<div className="demo-banner live-banner"><span>Dados desta empresa salvos no servidor. Unidade: {unit}.</span><span>Sua função: {roleLabels[ctx.role]}.</span></div>}
  orgSwitcher={orgSwitcher}
  userStrip={<div className="user-strip"><span className="avatar mini" aria-hidden="true">{(me.user.name ?? '?').slice(0, 1)}</span><div>{me.user.name ?? 'Usuário'}<small>{roleLabels[ctx.role]} · <button className="link-button" onClick={() => void logout()}>Sair</button></small></div></div>}
 />;
}

function AuthScreen({ title, text, children, busy, tone }: { title: string; text?: string; children?: ReactNode; busy?: boolean; tone?: 'error' }) {
 return <div className="auth-screen">
  <main className="auth-card" aria-busy={busy}>
   <a href="/" onClick={e => { e.preventDefault(); navigate('/'); }} aria-label="Vapt-Vupt início"><Mark /></a>
   <p className="eyebrow">OPERAÇÃO REAL</p>
   <h1>{title}</h1>
   {busy && <span className="spinner" role="status" aria-label="Carregando" />}
   {text && <p className={tone === 'error' ? 'auth-text error-text' : 'auth-text'} role={tone === 'error' ? 'alert' : undefined}>{text}</p>}
   {children && <div className="auth-actions">{children}</div>}
  </main>
 </div>;
}
