import { useState, type CSSProperties } from 'react';
import { ThemeSchema, modules, type Theme } from '../../packages/domain';
import { clearDemo, initialBusinesses, loadDemo, MAX_BUSINESSES, saveDemo, type Business } from './demo';
import { Dialog, Icon, Mark } from './components';
import { ConfirmReset, MovementForm, Onboarding, ProductForm } from './forms';
import { formatQuantity, isBelowMinimum, kindLabel, prefillFromSearch, registerMovement, type MovementKind, type StockFilter } from './inventory';
import { Landing } from './Landing';
import { labels, MovementsPage, Overview, StockPage, ThemeEditor, type Actions } from './pages';

const planned: Record<string, { title: string; text: string }> = {
 purchases: { title: 'Compras com contexto', text: 'O fluxo de pedidos e fornecedores será conectado ao estoque. Ainda não é possível enviar ou confirmar compras.' },
 quotes: { title: 'Cotações sem adivinhação', text: 'Não há fornecedores conectados. Nenhuma solicitação será enviada nesta demonstração.' },
 team: { title: 'Cada pessoa, o acesso certo', text: 'Convites, sessões e permissões reais dependem da integração de identidade. A troca de empresa nesta demo não representa autorização.' }
};

const headings: Record<string, string> = {
 inventory: 'Confira saldos e registre entradas ou saídas.',
 products: 'Encontre ou cadastre os produtos desta empresa.',
 movements: 'O que entrou e saiu, com o saldo antes e depois.',
 settings: 'A mesma plataforma. Com a cara do seu negócio.'
};

type Modal =
 | { type: 'movement'; productId?: string; kind?: MovementKind }
 | { type: 'product'; prefill?: { name?: string; sku?: string } }
 | { type: 'onboarding' }
 | { type: 'reset' };

type Notice = { text: string; tone?: 'success' | 'error'; action?: { label: string; run: () => void } };

export function App() {
 const [entered, setEntered] = useState(false);
 const [businesses, setBusinesses] = useState(loadDemo);
 const [active, setActive] = useState('mercado');
 const [page, setPage] = useState('overview');
 const [query, setQuery] = useState('');
 const [filter, setFilter] = useState<StockFilter>('all');
 const [historyProduct, setHistoryProduct] = useState('all');
 const [notice, setNotice] = useState<Notice | null>(null);
 const [modal, setModal] = useState<Modal | null>(null);
 const [draft, setDraft] = useState<Theme | null>(null);

 const b = businesses.find(x => x.id === active) || businesses[0] || initialBusinesses()[0];
 const theme = draft || b.theme;
 const critical = b.products.filter(isBelowMinimum);

 /** Salva no navegador; se não der, avisa que a alteração ficou só em memória. Retorna se salvou. */
 const commit = (next: Business[]) => {
  setBusinesses(next);
  try { saveDemo(next); return true; } catch { return false; }
 };
 const persistNote = (saved: boolean) => saved ? '' : ' Atenção: não foi possível salvar neste navegador; a alteração fica só até recarregar a página.';
 const replaceBusiness = (updated: Business) => commit(businesses.map(x => (x.id === updated.id ? updated : x)));

 const changePage = (p: string, options: { query?: string; filter?: StockFilter; product?: string } = {}) => {
  setPage(p); setQuery(options.query ?? ''); setFilter(options.filter ?? 'all'); setHistoryProduct(options.product ?? 'all'); setDraft(null); setNotice(null);
  document.getElementById('content')?.focus({ preventScroll: true });
 };

 const actions: Actions = {
  move: (productId, kind) => setModal({ type: 'movement', productId, kind }),
  createProduct: term => setModal({ type: 'product', prefill: term ? prefillFromSearch(term) : undefined }),
  openStock: (q = '', f = 'all') => changePage('inventory', { query: q, filter: f }),
  openHistory: productId => changePage('movements', { product: productId })
 };

 if (!entered) return <Landing enter={() => setEntered(true)} />;

 const visibleModules = modules.filter(m => m === 'overview' || theme.modules.includes(m));
 const primaryAction = ['overview', 'inventory', 'movements'].includes(page)
  ? <button className="primary" onClick={() => actions.move()}><Icon name="plus" />Registrar movimentação</button>
  : page === 'products' ? <button className="primary" onClick={() => actions.createProduct(query)}><Icon name="plus" />Novo produto</button> : null;

 return <div className={'workspace ' + theme.mode + ' ' + theme.density + ' font-' + theme.font} data-accent={theme.accent} style={{ colorScheme: theme.mode } as CSSProperties}>
  <a className="skip" href="#content">Pular para o conteúdo</a>
  <aside className="sidebar">
   <button className="brand-button" onClick={() => setEntered(false)} aria-label="Voltar ao site"><Mark /></button>
   <div className="business-box">
    <span className="avatar" aria-hidden="true">{theme.logo ? <img src={theme.logo} alt="" /> : theme.name.slice(0, 1)}</span>
    <label>EMPRESA DEMONSTRATIVA
     <select aria-label="Selecionar empresa demonstrativa" value={b.id} onChange={e => {
      const next = businesses.find(x => x.id === e.target.value);
      setActive(e.target.value); changePage('overview');
      if (next) setNotice({ text: `Você está vendo ${next.theme.name}, uma empresa fictícia. Catálogo, saldos e histórico são só desta empresa.` });
     }}>{businesses.map(x => <option value={x.id} key={x.id}>{x.theme.name}</option>)}</select>
    </label>
   </div>
   <p className="nav-label">OPERAÇÃO</p>
   <div className="nav-scroller">
   <nav aria-label="Aplicativo">{visibleModules.map(m => <button key={m} className={page === m ? 'selected' : ''} onClick={() => changePage(m)} aria-current={page === m ? 'page' : undefined}>
    <Icon name={m} /><span>{labels[m]}</span>
    {m === 'inventory' && critical.length > 0 && <span className="nav-count" aria-label={`${critical.length} abaixo do mínimo`}>{critical.length}</span>}
   </button>)}</nav>
   <div className="sidebar-bottom">
    <button className={page === 'settings' ? 'selected' : ''} onClick={() => changePage('settings')} aria-current={page === 'settings' ? 'page' : undefined}><Icon name="settings" />Personalização</button>
    <button onClick={() => setModal({ type: 'onboarding' })}><Icon name="plus" />Criar empresa demo</button>
    <div className="user-strip"><span className="avatar mini" aria-hidden="true">D</span><div>Perfil demonstrativo<small>Sem autenticação</small></div></div>
   </div>
   </div>
  </aside>

  <div className="work-area">
   <header className="topbar">
    <span className="topbar-company" title={theme.name}><strong>{theme.name}</strong><span className="muted"> · {b.segment} · Unidade principal</span></span>
    <div><span className="demo-pill">DEMONSTRAÇÃO</span><button onClick={() => replaceBusiness({ ...b, theme: { ...b.theme, mode: b.theme.mode === 'light' ? 'dark' : 'light' } })} aria-label={b.theme.mode === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}><Icon name="sun" /></button></div>
   </header>
   <div className="demo-banner"><span>Empresa fictícia · dados de demonstração salvos só neste navegador.</span><span>Nada é enviado a servidor ou a terceiros.</span></div>

   <main id="content" tabIndex={-1}>
    <header className="page-heading">
     <div>
      <p className="eyebrow">{theme.name} · {page === 'overview' ? 'SEU DIA, EM ORDEM' : labels[page]}</p>
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

    {page === 'overview' && <Overview business={b} actions={actions} />}
    {(page === 'inventory' || page === 'products') && <StockPage business={b} mode={page} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} actions={actions} />}
    {page === 'movements' && <MovementsPage business={b} productFilter={historyProduct} setProductFilter={setHistoryProduct} actions={actions} />}
    {planned[page] && <section className="panel"><div className="empty"><Icon name={page} /><h2>{planned[page].title}</h2><p>{planned[page].text}</p></div><div className="panel-foot">Módulo planejado • sem operações externas</div></section>}
    {page === 'settings' && <ThemeEditor theme={theme} setDraft={setDraft}
     save={() => {
      const result = ThemeSchema.safeParse(theme);
      if (!result.success) { setNotice({ tone: 'error', text: 'Confira o nome (2 a 60 caracteres) e as opções do tema.' }); return; }
      const saved = replaceBusiness({ ...b, theme: result.data }); setDraft(null);
      setNotice({ tone: 'success', text: 'Personalização salva neste navegador.' + persistNote(saved) });
     }}
     cancel={() => setDraft(null)} reset={() => setModal({ type: 'reset' })} />}

    <footer className="app-footer"><span>Vapt-Vupt · 0.1 / demonstração</span><span>Seus dados reais ainda não pertencem a este ambiente.</span></footer>
   </main>
  </div>

  {modal?.type === 'movement' && <Dialog title="Registrar movimentação" description={`${theme.name} · registro local na demonstração. Nada é enviado a servidor.`} close={() => setModal(null)}>
   <MovementForm products={b.products} initialProductId={modal.productId} initialKind={modal.kind}
    createProduct={() => setModal({ type: 'product' })}
    submit={request => {
     try {
      const { business, movement } = registerMovement(b, request, crypto.randomUUID(), new Date());
      const saved = replaceBusiness(business);
      setModal(null);
      setNotice({
       tone: 'success',
       text: `${kindLabel[movement.kind]} registrada na demonstração: ${movement.kind === 'receipt' ? '+' : '−'}${formatQuantity(movement.quantity)} ${movement.unit} de ${movement.product}. Saldo ${formatQuantity(movement.before)} → ${formatQuantity(movement.after)} ${movement.unit}.` + persistNote(saved),
       action: page === 'movements' ? undefined : { label: 'Ver histórico', run: () => actions.openHistory(movement.productId) }
      });
     } catch (e) {
      return e instanceof Error ? e.message : 'Não foi possível registrar.';
     }
    }} />
  </Dialog>}

  {modal?.type === 'product' && <Dialog title="Novo produto" description={`Cadastro em ${theme.name}, somente nesta demonstração.`} close={() => setModal(null)}>
   <ProductForm existing={b.products} prefill={modal.prefill} submit={p => {
    const saved = replaceBusiness({ ...b, products: [...b.products, p] });
    setModal(null);
    if (page === 'inventory' || page === 'products') { setQuery(p.sku); setFilter('all'); }
    setNotice({ tone: 'success', text: `${p.name} cadastrado com saldo 0 ${p.unit}.` + persistNote(saved), action: { label: 'Registrar entrada', run: () => actions.move(p.id, 'receipt') } });
   }} />
  </Dialog>}

  {modal?.type === 'onboarding' && <Dialog title="Seu negócio, do seu jeito" description="Crie uma empresa fictícia neste navegador. Isso não cria uma conta comercial." close={() => setModal(null)}>
   <Onboarding submit={(name, segment) => {
    if (businesses.length >= MAX_BUSINESSES) { setModal(null); setNotice({ tone: 'error', text: `Limite de ${MAX_BUSINESSES} empresas demonstrativas neste navegador.` }); return; }
    const template = initialBusinesses()[segment] ?? initialBusinesses()[0];
    const id = crypto.randomUUID();
    const saved = commit([...businesses, { ...template, id, theme: { ...template.theme, name }, products: [], movements: [] }]);
    setActive(id); changePage('overview'); setModal(null);
    setNotice({ tone: 'success', text: `${name} criada como empresa fictícia, sem produtos.` + persistNote(saved), action: { label: 'Cadastrar produto', run: () => actions.createProduct() } });
   }} />
  </Dialog>}

  {modal?.type === 'reset' && <Dialog title="Restaurar dados de exemplo?" description="As três empresas voltam ao estado inicial. Produtos, saldos, histórico, personalizações e empresas criadas neste navegador serão apagados." close={() => setModal(null)}>
   <ConfirmReset cancel={() => setModal(null)} confirm={() => {
    try { clearDemo(); } catch { /* armazenamento indisponível: o estado em memória é restaurado mesmo assim */ }
    setBusinesses(initialBusinesses()); setActive('mercado'); setModal(null); changePage('overview');
    setNotice({ tone: 'success', text: 'Dados de exemplo restaurados.' });
   }} />
  </Dialog>}
 </div>;
}
