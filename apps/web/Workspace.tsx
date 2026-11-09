import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { modules } from '../../packages/domain';
import {
 OrgSettingsSchema, type MovementRecord, type OrgSettings, type Permission, type SettingsEnvelope, type StockItem, type UserPreferences
} from '../../packages/domain/contracts';
import { Dialog, Icon, Mark } from './components';
import type { Gateway } from './data/gateway';
import { useDebounced, usePaged } from './data/hooks';
import { RequestError } from './data/http';
import { MovementForm, ProductForm } from './forms';
import { formatQuantity, kindLabel, prefillFromSearch, type MovementKind, type StockFilter } from './inventory';
import { labels, MovementsPage, Overview, StockPage, formatTime, type Actions, type Copy } from './pages';
import { SettingsEditor } from './settings';
import { visualOf } from './theme';

export type Notice = { text: string; tone?: 'success' | 'error'; action?: { label: string; run: () => void } };

type Modal =
 | { type: 'movement'; product?: StockItem; kind?: MovementKind }
 | { type: 'product'; prefill?: { name?: string; sku?: string } };

const headings: Record<string, string> = {
 inventory: 'Confira saldos e registre entradas ou saídas.',
 products: 'Encontre ou cadastre os produtos desta empresa.',
 movements: 'O que entrou e saiu, com o saldo antes e depois.',
 settings: 'A mesma plataforma. Com a cara do seu negócio.'
};

export type WorkspaceProps = {
 gateway: Gateway;
 envelope: SettingsEnvelope;
 onEnvelope: (envelope: SettingsEnvelope) => void;
 unitName: string;
 segmentLabel: string;
 permissions: readonly Permission[];
 preferences: UserPreferences;
 onPreferences?: (p: UserPreferences) => void;
 toggleMode: () => void;
 orgSwitcher: ReactNode;
 userStrip: ReactNode;
 sidebarExtras?: ReactNode;
 banner: ReactNode;
 pill: string;
 footer: [string, string];
 copy: Copy;
 onBrand: () => void;
 resetPanel?: ReactNode;
 notice: Notice | null;
 setNotice: (n: Notice | null) => void;
 /** Recarrega a configuração do servidor depois de um conflito de versão. */
 reloadSettings?: () => void;
 planned: Record<string, { title: string; text: string }>;
};

/**
 * Espaço de trabalho de UMA empresa. O componente pai o remonta (key) a cada troca de empresa:
 * nenhum estado, cache ou resposta pendente sobrevive à troca.
 */
export function Workspace(props: WorkspaceProps) {
 const { gateway, envelope, copy, notice, setNotice, permissions } = props;
 const live = gateway.mode === 'live';
 const [page, setPage] = useState<string>(envelope.settings.navigation.landing);
 const [query, setQuery] = useState('');
 const [filter, setFilter] = useState<StockFilter>('all');
 const [historyProduct, setHistoryProduct] = useState<{ id: string; name: string } | null>(null);
 const [historyKind, setHistoryKind] = useState<'all' | MovementKind>('all');
 const [modal, setModal] = useState<Modal | null>(null);
 const [draft, setDraft] = useState<OrgSettings | null>(null);
 const [saving, setSaving] = useState(false);
 const [dataVersion, setDataVersion] = useState(0);
 const refresh = () => setDataVersion(v => v + 1);

 const settings = draft ?? envelope.settings;
 const visual = visualOf({ ...envelope, settings }, props.preferences);
 const can = (p: Permission) => permissions.includes(p);
 const name = settings.identity.displayName;

 const changePage = (p: string, options: { query?: string; filter?: StockFilter; product?: { id: string; name: string } | null } = {}) => {
  setPage(p); setQuery(options.query ?? ''); setFilter(options.filter ?? 'all'); setHistoryProduct(options.product ?? null); setHistoryKind('all'); setDraft(null); setNotice(null);
  document.getElementById('content')?.focus({ preventScroll: true });
 };

 const actions: Actions = {
  move: (product, kind) => setModal({ type: 'movement', product, kind }),
  createProduct: term => setModal({ type: 'product', prefill: term ? prefillFromSearch(term) : undefined }),
  openStock: (q = '', f = 'all') => changePage('inventory', { query: q, filter: f }),
  openHistory: product => changePage('movements', { product: product ? { id: product.id, name: product.name } : null })
 };

 const movementNotice = (m: MovementRecord, replayed: boolean): Notice => {
  const sign = m.kind === 'receipt' ? '+' : '−';
  const figures = `${sign}${formatQuantity(m.quantity)} ${m.measure} de ${m.productName}. Saldo ${formatQuantity(m.balanceBefore)} → ${formatQuantity(m.balanceAfter)} ${m.measure}.`;
  const text = replayed
   ? `${kindLabel[m.kind]} já estava registrada${live ? ' no servidor' : ''} com este identificador; o saldo não foi alterado de novo. Registro original: ${figures}`
   : live
    ? `${kindLabel[m.kind]} confirmada pelo servidor: ${figures} Registrada às ${formatTime(m.recordedAt)}${m.actorName ? ' por ' + m.actorName : ''}.`
    : `${kindLabel[m.kind]} registrada na demonstração: ${figures}${storage()}`;
  return { tone: 'success', text, action: page === 'movements' ? undefined : { label: 'Ver histórico', run: () => actions.openHistory({ id: m.productId, name: m.productName }) } };
 };
 const storage = () => (gateway.mode === 'demo' && 'storageWarning' in gateway && gateway.storageWarning ? ' ' + String(gateway.storageWarning) : '');

 const saveSettings = async () => {
  const result = OrgSettingsSchema.safeParse(settings);
  if (!result.success) { setNotice({ tone: 'error', text: 'Confira o nome (2 a 60 caracteres) e as opções da personalização.' }); return; }
  setSaving(true);
  try {
   const saved = await gateway.saveSettings(envelope.version, result.data);
   props.onEnvelope(saved); setDraft(null);
   setNotice(live
    ? { tone: 'success', text: `Personalização salva no servidor (versão ${saved.version}). Vale para todas as pessoas desta empresa.` }
    : storage() ? { tone: 'error', text: 'Personalização aplicada só nesta aba.' + storage() } : { tone: 'success', text: 'Personalização salva neste navegador.' });
  } catch (e) {
   const err = e instanceof RequestError ? e : null;
   if (err?.kind === 'settings_conflict') setNotice({ tone: 'error', text: err.message, action: props.reloadSettings ? { label: 'Recarregar configuração', run: () => { setDraft(null); props.reloadSettings!(); } } : undefined });
   else if (err?.kind === 'forbidden') setNotice({ tone: 'error', text: 'Sua função não permite alterar esta parte da personalização. Nada foi salvo.' });
   else if (err?.outcomeUnknown) setNotice({ tone: 'error', text: `${err.message} Não sabemos se a personalização foi salva. Recarregue para conferir antes de salvar de novo.`, action: props.reloadSettings ? { label: 'Recarregar configuração', run: () => { setDraft(null); props.reloadSettings!(); } } : undefined });
   else setNotice({ tone: 'error', text: err?.message ?? 'Não foi possível salvar.' });
  } finally { setSaving(false); }
 };

 const visibleModules = modules.filter(m => m === 'overview' || settings.modules.includes(m));
 const canMove = can('stock.move'), canCreate = can('product.create');
 const primaryAction = ['overview', 'inventory', 'movements'].includes(page) && canMove
  ? <button className="primary" onClick={() => actions.move()}><Icon name="plus" />Registrar movimentação</button>
  : page === 'products' && canCreate ? <button className="primary" onClick={() => actions.createProduct(query)}><Icon name="plus" />Novo produto</button> : null;

 return <div className={'workspace ' + visual.mode + ' ' + visual.density + ' font-' + visual.font} data-accent={visual.accent} data-mode={gateway.mode} style={{ colorScheme: visual.mode } as CSSProperties}>
  <a className="skip" href="#content">Pular para o conteúdo</a>
  <aside className="sidebar">
   <button className="brand-button" onClick={props.onBrand} aria-label="Voltar ao site"><Mark /></button>
   <div className="business-box">
    <span className="avatar" aria-hidden="true">{envelope.logoUrl && settings.identity.logoAssetId === envelope.settings.identity.logoAssetId ? <img src={envelope.logoUrl} alt="" /> : name.slice(0, 1)}</span>
    {props.orgSwitcher}
   </div>
   <p className="nav-label">OPERAÇÃO</p>
   <div className="nav-scroller">
    <nav aria-label="Aplicativo">{visibleModules.map(m => <button key={m} className={page === m ? 'selected' : ''} onClick={() => changePage(m)} aria-current={page === m ? 'page' : undefined}>
     <Icon name={m} /><span>{labels[m]}</span>
     {m === 'inventory' && <CriticalBadge gateway={gateway} refresh={dataVersion} />}
    </button>)}</nav>
    <div className="sidebar-bottom">
     <button className={page === 'settings' ? 'selected' : ''} onClick={() => changePage('settings')} aria-current={page === 'settings' ? 'page' : undefined}><Icon name="settings" />Personalização</button>
     {props.sidebarExtras}
     {props.userStrip}
    </div>
   </div>
  </aside>

  <div className="work-area">
   <header className="topbar">
    <span className="topbar-company" title={name}><strong>{name}</strong><span className="muted"> · {props.segmentLabel} · {props.unitName}</span></span>
    <div><span className={'demo-pill' + (live ? ' live' : '')}>{props.pill}</span><button onClick={props.toggleMode} aria-label={visual.mode === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}><Icon name="sun" /></button></div>
   </header>
   {props.banner}

   <main id="content" tabIndex={-1}>
    <header className="page-heading">
     <div>
      <p className="eyebrow">{name} · {page === 'overview' ? 'SEU DIA, EM ORDEM' : labels[page]}</p>
      <h1>{page === 'overview' ? 'Vamos cuidar do seu estoque.' : labels[page]}</h1>
      <p>{page === 'overview' ? 'Um olhar rápido no que merece a sua atenção.' : headings[page] || 'Módulo planejado para as próximas etapas.'}</p>
     </div>
     {primaryAction}
    </header>

    {notice && <div className={'notice' + (notice.tone ? ' ' + notice.tone : '')} role={notice.tone === 'error' ? 'alert' : 'status'}>
     {notice.tone === 'success' && <Icon name="check" />}
     <span className="grow-text">{notice.text}</span>
     {notice.action && <button className="notice-action" onClick={notice.action.run}>{notice.action.label}</button>}
     <button className="icon-button" onClick={() => setNotice(null)} aria-label="Dispensar mensagem"><Icon name="close" /></button>
    </div>}

    {page === 'overview' && <OverviewContainer gateway={gateway} refresh={dataVersion} blocks={settings.overview.blocks} actions={actions} copy={copy} canMove={canMove} canCreate={canCreate} />}
    {(page === 'inventory' || page === 'products') && <StockContainer gateway={gateway} refresh={dataVersion} displayName={name} mode={page} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} actions={actions} copy={copy} canMove={canMove} canCreate={canCreate} />}
    {page === 'movements' && <HistoryContainer gateway={gateway} refresh={dataVersion} product={historyProduct} setProduct={setHistoryProduct} kind={historyKind} setKind={setHistoryKind} actions={actions} copy={copy} canMove={canMove} />}
    {props.planned[page] && <section className="panel"><div className="empty"><Icon name={page} /><h2>{props.planned[page].title}</h2><p>{props.planned[page].text}</p></div><div className="panel-foot">Módulo planejado • sem operações externas</div></section>}
    {page === 'settings' && <SettingsEditor settings={settings} setDraft={setDraft} dirty={!!draft} save={() => void saveSettings()} cancel={() => setDraft(null)} saving={saving}
     canIdentity={can('settings.identity')} canAppearance={can('settings.appearance')} logoUrl={envelope.logoUrl}
     uploadLogo={file => gateway.uploadLogo(file)} live={live} preferences={props.preferences} onPreferences={props.onPreferences} resetPanel={props.resetPanel} />}

    <footer className="app-footer"><span>{props.footer[0]}</span><span>{props.footer[1]}</span></footer>
   </main>
  </div>

  {modal?.type === 'movement' && <Dialog title="Registrar movimentação" description={live ? `${name} · ${props.unitName}. O saldo só muda depois da confirmação do servidor.` : `${name} · registro local na demonstração. Nada é enviado a servidor.`} close={() => setModal(null)}>
   <MovementForm searchProducts={(q, signal) => gateway.listStock(q, signal)} initialProduct={modal.product} initialKind={modal.kind} live={live}
    submit={m => gateway.move(m)} verify={id => gateway.findMovement(id)} canCreateProduct={canCreate}
    createProduct={() => setModal({ type: 'product' })}
    onConfirmed={(movement, replayed) => { setModal(null); refresh(); setNotice(movementNotice(movement, replayed)); }} />
  </Dialog>}

  {modal?.type === 'product' && <Dialog title="Novo produto" description={live ? `Cadastro no catálogo de ${name}, salvo no servidor.` : `Cadastro em ${name}, somente nesta demonstração.`} close={() => setModal(null)}>
   <ProductForm categories={settings.catalog.suggestedCategories} prefill={modal.prefill} live={live} submit={async p => {
    const item = await gateway.createProduct(p);
    setModal(null); refresh();
    if (page === 'inventory' || page === 'products') { setQuery(item.sku); setFilter('all'); }
    setNotice({ tone: 'success', text: `${item.name} cadastrado com saldo 0 ${item.unit}.` + (live ? ' Cadastro confirmado pelo servidor.' : storage()), action: canMove ? { label: 'Registrar entrada', run: () => actions.move(item, 'receipt') } : undefined });
    return item;
   }} />
  </Dialog>}
 </div>;
}

/* ---------- Contêineres de dados: montam só quando a página está ativa ---------- */

type Base = { gateway: Gateway; refresh: number };

function CriticalBadge({ gateway, refresh }: Base) {
 const data = usePaged(gateway.organizationId + '|badge', refresh, useCallback(async (_c: string | undefined, signal: AbortSignal) => {
  const page = await gateway.listStock({ status: 'critical', limit: 1 }, signal);
  return { items: [], nextCursor: null, extra: page.counts.critical };
 }, [gateway]));
 const n = data.extra ?? 0;
 return n > 0 ? <span className="nav-count" aria-label={`${n} abaixo do mínimo`}>{n}</span> : null;
}

function OverviewContainer({ gateway, refresh, ...rest }: Base & Omit<Parameters<typeof Overview>[0], 'critical' | 'recent'>) {
 const critical = usePaged(gateway.organizationId + '|critical', refresh, useCallback(async (_c: string | undefined, signal: AbortSignal) => {
  const page = await gateway.listStock({ status: 'critical', limit: 6 }, signal);
  return { items: page.items, nextCursor: null, extra: page.counts };
 }, [gateway]));
 const recent = usePaged(gateway.organizationId + '|recent', refresh, useCallback(async (_c: string | undefined, signal: AbortSignal) => {
  const page = await gateway.listMovements({ limit: 5 }, signal);
  return { items: page.items, nextCursor: null, extra: page.total };
 }, [gateway]));
 return <Overview critical={critical} recent={recent} {...rest} />;
}

function StockContainer({ gateway, refresh, query, filter, ...rest }: Base & Omit<Parameters<typeof StockPage>[0], 'stock'>) {
 const q = useDebounced(query.trim(), 200);
 const stock = usePaged(`${gateway.organizationId}|stock|${q}|${filter}`, refresh, useCallback(async (cursor: string | undefined, signal: AbortSignal) => {
  const page = await gateway.listStock({ q, status: filter, cursor, limit: 50 }, signal);
  return { items: page.items, nextCursor: page.nextCursor, extra: page.counts };
 }, [gateway, q, filter]));
 return <StockPage stock={stock} query={query} filter={filter} {...rest} />;
}

function HistoryContainer({ gateway, refresh, product, kind, ...rest }: Base & Omit<Parameters<typeof MovementsPage>[0], 'history'>) {
 const history = usePaged(`${gateway.organizationId}|history|${product?.id ?? ''}|${kind}`, refresh, useCallback(async (cursor: string | undefined, signal: AbortSignal) => {
  const page = await gateway.listMovements({ productId: product?.id, kind: kind === 'all' ? undefined : kind, cursor, limit: 50 }, signal);
  return { items: page.items, nextCursor: page.nextCursor, extra: page.total };
 }, [gateway, product?.id, kind]));
 return <MovementsPage history={history} product={product} kind={kind} {...rest} />;
}
