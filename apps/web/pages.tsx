import { useState, type FormEvent, type ReactNode } from 'react';
import type { MovementRecord, OverviewBlock, StockItem, StockPage } from '../../packages/domain/contracts';
import { Empty, Icon, StockStatus } from './components';
import type { Paged } from './data/hooks';
import { formatQuantity, kindLabel, type MovementKind, type StockFilter } from './inventory';

export const labels: Record<string, string> = { overview: 'Visão geral', inventory: 'Estoque', products: 'Produtos', movements: 'Movimentações', purchases: 'Compras', quotes: 'Cotações', team: 'Equipe', settings: 'Personalização' };

export type Actions = {
 move: (product?: StockItem, kind?: MovementKind) => void;
 createProduct: (term?: string) => void;
 openStock: (query?: string, filter?: StockFilter) => void;
 openHistory: (product?: { id: string; name: string }) => void;
};

/** Textos que mudam entre a demonstração (navegador) e a operação real (servidor). */
export type Copy = {
 movementsMetric: string;
 stockFoot: string;
 productsFoot: string;
 historyFoot: string;
 dailyNote: string;
};

const isBelow = (p: StockItem) => p.quantity < p.minimum;

/* ---------- Estados de carga ---------- */

export function LoadState({ loading, error, retry, label }: { loading: boolean; error: { message: string } | null; retry: () => void; label: string }) {
 if (error) return <div className="load-state error" role="alert">
  <Icon name="close" /><div className="grow"><strong>Não foi possível carregar {label}.</strong><small>{error.message}</small></div>
  <button onClick={retry}>Tentar de novo</button>
 </div>;
 if (loading) return <div className="load-state" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" />Carregando {label}…</div>;
 return null;
}

/* ---------- Visão geral ---------- */

export function Overview({ blocks, critical, recent, actions, copy, canMove, canCreate }: {
 blocks: OverviewBlock[];
 critical: Paged<StockItem, StockPage['counts']>;
 recent: Paged<MovementRecord, number>;
 actions: Actions; copy: Copy; canMove: boolean; canCreate: boolean;
}) {
 const [term, setTerm] = useState('');
 const find = (e: FormEvent) => { e.preventDefault(); actions.openStock(term); };
 const counts = critical.extra;
 const show = (b: OverviewBlock) => blocks.includes(b);
 return <>
  {show('quick_find') && <form className="quick-find" role="search" onSubmit={find}>
   <label className="search">
    <Icon name="search" />
    <span className="sr-only">Encontrar produto no estoque</span>
    <input type="search" placeholder="Encontrar produto por nome ou código" value={term} onChange={e => setTerm(e.target.value)} />
   </label>
   <button type="submit">Buscar no estoque</button>
  </form>}

  {show('metrics') && <section className="metrics" aria-label="Resumo do estoque" aria-busy={critical.loading || recent.loading}>
   <div><span>Produtos cadastrados</span><strong>{counts ? formatQuantity(counts.catalog) : '—'}<small>itens</small></strong><p>Catálogo desta empresa</p></div>
   <div><span>Abaixo do mínimo</span><strong>{counts ? formatQuantity(counts.critical) : '—'}<small>itens</small></strong><p className={counts?.critical ? 'attention' : ''}>{!counts ? 'Carregando…' : counts.critical ? 'Confira antes de comprar' : 'Todos acima do mínimo'}</p></div>
   <div><span>Movimentações registradas</span><strong>{recent.extra === null ? '—' : formatQuantity(recent.extra)}<small>registros</small></strong><p>{copy.movementsMetric}</p></div>
  </section>}

  {(show('priority') || show('daily_note')) && <div className={'overview-grid' + (show('priority') && show('daily_note') ? '' : ' single')}>
   {show('priority') && <section className="panel" aria-labelledby="priority-title">
    <div className="section-heading">
     <div><p className="eyebrow">PRIORIDADE AGORA</p><h2 id="priority-title">Precisa de reposição</h2></div>
     {!!counts?.critical && <button className="text-button" onClick={() => actions.openStock('', 'critical')}>Ver no estoque <Icon name="arrow" /></button>}
    </div>
    <LoadState loading={critical.loading} error={critical.error} retry={critical.retry} label="a reposição" />
    {!critical.loading && !critical.error && (!counts?.catalog
     ? <Empty title="Nenhum produto cadastrado" text="Cadastre o primeiro produto desta empresa para acompanhar saldo e reposição.">{canCreate && <button className="primary" onClick={() => actions.createProduct()}><Icon name="plus" />Cadastrar produto</button>}</Empty>
     : critical.items.length
      ? critical.items.map(p => <div className="priority-row" key={p.id}>
       <span className="product-avatar" aria-hidden="true">{p.name.slice(0, 1)}</span>
       <div className="grow"><strong>{p.name}</strong><small>{p.sku} · {p.category}</small></div>
       <div className="stock-number"><strong>{formatQuantity(p.quantity)} <small>{p.unit}</small></strong><small>Mínimo: {formatQuantity(p.minimum)}</small></div>
       {canMove && <button className="row-action receipt" onClick={() => actions.move(p, 'receipt')} aria-label={`Registrar entrada de ${p.name}`}><Icon name="plus" /><span>Entrada</span></button>}
      </div>)
      : <Empty title="Tudo acima do mínimo" text="Os limites cadastrados não indicam falta neste momento." icon="check" />)}
    <div className="panel-foot">Critério: saldo abaixo do mínimo cadastrado. Não é previsão de demanda.{counts && counts.critical > critical.items.length ? ` Mostrando ${critical.items.length} de ${formatQuantity(counts.critical)}.` : ''}</div>
   </section>}

   {show('daily_note') && <aside className="daily-note">
    <span className="eyebrow">UMA COISA DE CADA VEZ</span>
    <h2>O próximo passo<br />fica mais fácil.</h2>
    <p>{copy.dailyNote}</p>
    {canMove && <button onClick={() => actions.move(undefined, 'receipt')}>Registrar entrada <Icon name="arrow" /></button>}
    <div className="vv-watermark" aria-hidden="true">vv</div>
    <span className="note-footer">CLAREZA PARA QUEM FAZ ACONTECER.</span>
   </aside>}
  </div>}

  {show('recent') && <section className="recent" aria-labelledby="recent-title">
   <div className="section-heading"><h2 id="recent-title">Últimas movimentações</h2>{recent.items.length > 0 && <button className="text-button" onClick={() => actions.openHistory()}>Ver histórico <Icon name="arrow" /></button>}</div>
   <LoadState loading={recent.loading} error={recent.error} retry={recent.retry} label="as movimentações" />
   {!recent.loading && !recent.error && <MovementList movements={recent.items} empty={<Empty title="Nenhuma movimentação registrada" text="Registre uma entrada ou saída para acompanhar a alteração de saldo." icon="movements" />} />}
  </section>}
 </>;
}

/* ---------- Estoque e produtos ---------- */

const filterLabels: Record<StockFilter, string> = { all: 'Todos', critical: 'Repor', ok: 'Suficiente' };

export function StockPage({ displayName, mode, query, setQuery, filter, setFilter, stock, actions, copy, canMove, canCreate }: {
 displayName: string; mode: 'inventory' | 'products'; query: string; setQuery: (q: string) => void;
 filter: StockFilter; setFilter: (f: StockFilter) => void; stock: Paged<StockItem, StockPage['counts']>;
 actions: Actions; copy: Copy; canMove: boolean; canCreate: boolean;
}) {
 const counts = stock.extra;
 const caption = mode === 'inventory' ? `Saldos de ${displayName}` : `Produtos cadastrados em ${displayName}`;
 return <section className="panel stock-panel" aria-label={mode === 'inventory' ? 'Saldos de estoque' : 'Catálogo de produtos'} aria-busy={stock.refreshing}>
  <div className="toolbar">
   <label className="search">
    <Icon name="search" />
    <span className="sr-only">Buscar produto</span>
    <input type="search" placeholder="Buscar por nome, código ou categoria" value={query} onChange={e => setQuery(e.target.value)} />
    {query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="Limpar busca"><Icon name="close" /></button>}
   </label>
   <div className="chips" role="group" aria-label="Filtrar por situação">
    {(['all', 'critical', 'ok'] as const).map(f => <button key={f} type="button" className={'chip' + (f === 'critical' ? ' warning' : '')} aria-pressed={filter === f} onClick={() => setFilter(f)}>{filterLabels[f]} <span className="chip-count">{counts ? formatQuantity(counts[f]) : '…'}</span></button>)}
   </div>
  </div>
  <p className="result-count" role="status">{counts && counts.catalog > 0 && !stock.loading ? resultCount(stock.items.length, filter === 'all' && !query ? counts.catalog : counts[filter], filter === 'all' && !query, counts.catalog) : ''}</p>
  <LoadState loading={stock.loading} error={stock.error} retry={stock.retry} label="os produtos" />

  {!stock.loading && !stock.error && (stock.items.length > 0
   ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de produtos com rolagem horizontal">
    <table className={'stock-table ' + mode}>
     <caption className="sr-only">{caption}</caption>
     <thead><tr>
      <th scope="col">Produto</th>
      {mode === 'products' && <th scope="col">Categoria</th>}
      {mode === 'products' && <th scope="col">Unidade</th>}
      <th scope="col" className="num">Saldo</th>
      <th scope="col" className="num">Mínimo</th>
      <th scope="col">Situação</th>
      <th scope="col" className="actions-col"><span className={mode === 'inventory' ? 'sr-only' : ''}>{mode === 'inventory' ? 'Movimentar' : 'Histórico'}</span></th>
     </tr></thead>
     <tbody>{stock.items.map(p => <ProductRow key={p.id} product={p} mode={mode} actions={actions} canMove={canMove} />)}</tbody>
    </table>
   </div>
   : <NoResults catalog={counts?.catalog ?? 0} query={query} filter={filter} clear={() => { setQuery(''); setFilter('all'); }} actions={actions} canCreate={canCreate} />)}
  {stock.nextCursor && !stock.loading && <div className="load-more"><button onClick={stock.loadMore} disabled={stock.loadingMore}>{stock.loadingMore ? 'Carregando…' : 'Carregar mais produtos'}</button></div>}

  <div className="panel-foot">{mode === 'inventory' ? copy.stockFoot : copy.productsFoot}</div>
 </section>;
}

function ProductRow({ product: p, mode, actions, canMove }: { product: StockItem; mode: 'inventory' | 'products'; actions: Actions; canMove: boolean }) {
 const below = isBelow(p);
 return <tr>
  <th scope="row"><strong>{p.name}</strong><small>{p.sku}{mode === 'inventory' ? ` · ${p.category}` : ''}</small>
   <span className={'inline-balance' + (below ? ' below' : '')}><b>{formatQuantity(p.quantity)} {p.unit}</b> · mín. {formatQuantity(p.minimum)}{below ? ' · Repor' : ''}</span></th>
  {mode === 'products' && <td>{p.category}</td>}
  {mode === 'products' && <td>{p.unit}</td>}
  <td className="num"><strong>{formatQuantity(p.quantity)}</strong> {p.unit}<small className={'min-hint' + (below ? ' below' : '')} aria-hidden="true">{below ? 'Repor · ' : ''}mín. {formatQuantity(p.minimum)}</small></td>
  <td className="num">{formatQuantity(p.minimum)} {p.unit}</td>
  <td><StockStatus below={below} /></td>
  <td className="actions-col">{mode === 'inventory'
   ? canMove
    ? <div className="row-actions">
     <button className="row-action receipt" onClick={() => actions.move(p, 'receipt')} aria-label={`Registrar entrada de ${p.name}`}><Icon name="plus" /><span>Entrada</span></button>
     <button className="row-action issue" onClick={() => actions.move(p, 'issue')} aria-label={`Registrar saída de ${p.name}`}><Icon name="minus" /><span>Saída</span></button>
    </div>
    : <button className="row-action" onClick={() => actions.openHistory(p)} aria-label={`Ver histórico de ${p.name}`}><Icon name="movements" /><span>Histórico</span></button>
   : <button className="row-action" onClick={() => actions.openHistory(p)} aria-label={`Ver histórico de ${p.name}`}><Icon name="movements" /><span>Histórico</span></button>}
  </td>
 </tr>;
}

function NoResults({ catalog, query, filter, clear, actions, canCreate }: { catalog: number; query: string; filter: StockFilter; clear: () => void; actions: Actions; canCreate: boolean }) {
 if (!catalog) return <Empty title="Nenhum produto cadastrado" text={canCreate ? 'Cadastre o primeiro produto desta empresa. Ele começa com saldo zero.' : 'Ainda não há produtos. Peça a um gestor ou proprietário para cadastrar.'}>
  {canCreate && (query.trim()
   ? <button className="primary" onClick={() => actions.createProduct(query)}><Icon name="plus" />Cadastrar “{query.trim().slice(0, 40)}”</button>
   : <button className="primary" onClick={() => actions.createProduct()}><Icon name="plus" />Cadastrar produto</button>)}
 </Empty>;
 if (query.trim()) return <Empty icon="search" title={`Nenhum produto para “${query.trim()}”`} text={filter === 'all' ? `Confira a grafia ou o código.${canCreate ? ' Se o produto ainda não existe nesta empresa, cadastre agora.' : ''}` : `Nenhum resultado no filtro “${filterLabels[filter]}”. Confira a grafia, limpe a busca${canCreate ? ' ou cadastre o produto' : ''}.`}>
  {canCreate && <button className="primary" onClick={() => actions.createProduct(query)}><Icon name="plus" />Cadastrar “{query.trim().slice(0, 40)}”</button>}
  <button onClick={clear}>Limpar busca</button>
 </Empty>;
 return <Empty icon="check" title={filter === 'critical' ? 'Nenhum produto abaixo do mínimo' : 'Nenhum produto com estoque suficiente'} text="Altere o filtro para ver os demais produtos.">
  <button onClick={clear}>Mostrar todos</button>
 </Empty>;
}

/* ---------- Histórico ---------- */

export function MovementsPage({ history, product, setProduct, kind, setKind, actions, copy, canMove }: {
 history: Paged<MovementRecord, number>; product: { id: string; name: string } | null; setProduct: (p: { id: string; name: string } | null) => void;
 kind: 'all' | MovementKind; setKind: (k: 'all' | MovementKind) => void; actions: Actions; copy: Copy; canMove: boolean;
}) {
 const filtered = !!product || kind !== 'all';
 const options = new Map<string, string>();
 if (product) options.set(product.id, product.name);
 for (const m of history.items) options.set(m.productId, m.productName);
 const total = history.extra ?? 0;
 return <section className="panel" aria-busy={history.refreshing}>
  {(total > 0 || filtered) && <div className="toolbar">
   <label className="filter-label">Produto
    <select value={product?.id ?? 'all'} onChange={e => setProduct(e.target.value === 'all' ? null : { id: e.target.value, name: options.get(e.target.value) ?? '' })}>
     <option value="all">Todos os produtos</option>
     {[...options].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
    </select>
   </label>
   <div className="chips" role="group" aria-label="Filtrar por operação">
    {(['all', 'receipt', 'issue'] as const).map(k => <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'all' ? 'Todas' : kindLabel[k] + 's'}</button>)}
   </div>
  </div>}
  {total > 0 && !history.loading && <p className="result-count" role="status">Mostrando {formatQuantity(history.items.length)} de {formatQuantity(total)} {total === 1 ? 'registro' : 'registros'}</p>}
  <LoadState loading={history.loading} error={history.error} retry={history.retry} label="o histórico" />
  {!history.loading && !history.error && <MovementList movements={history.items} empty={filtered
   ? <Empty icon="search" title="Nenhuma movimentação neste filtro" text="Altere o produto ou a operação para ver outros registros."><button onClick={() => { setProduct(null); setKind('all'); }}>Limpar filtros</button></Empty>
   : <Empty icon="movements" title="Nenhuma movimentação registrada" text="Registre uma entrada ou saída para acompanhar a alteração de saldo.">{canMove && <button className="primary" onClick={() => actions.move()}><Icon name="plus" />Registrar movimentação</button>}</Empty>} />}
  {history.nextCursor && !history.loading && <div className="load-more"><button onClick={history.loadMore} disabled={history.loadingMore}>{history.loadingMore ? 'Carregando…' : 'Carregar registros anteriores'}</button></div>}
  <div className="panel-foot">{copy.historyFoot}</div>
 </section>;
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const formatTime = (iso: string) => dateFormat.format(new Date(iso));

export function MovementList({ movements, empty }: { movements: MovementRecord[]; empty: ReactNode }) {
 if (!movements.length) return <>{empty}</>;
 return <ol className="movement-list">
  {movements.map(m => <li key={m.eventId}>
   <span className={'movement-sign ' + m.kind} aria-hidden="true">{m.kind === 'receipt' ? '+' : '−'}</span>
   <div className="grow">
    <strong>{m.productName}</strong>
    <small>{kindLabel[m.kind]} · {m.reason} · <time dateTime={m.recordedAt}>{formatTime(m.recordedAt)}</time>{m.actorName ? ` · ${m.actorName}` : ''}</small>
   </div>
   <div className="movement-figures">
    <strong className={'delta ' + m.kind}>{m.kind === 'receipt' ? '+' : '−'}{formatQuantity(m.quantity)} <small>{m.measure}</small></strong>
    <small>Saldo {formatQuantity(m.balanceBefore)} → {formatQuantity(m.balanceAfter)}</small>
   </div>
  </li>)}
 </ol>;
}

function resultCount(shown: number, total: number, wholeCatalog: boolean, catalog: number) {
 const noun = wholeCatalog ? (total === 1 ? 'produto' : 'produtos') : (total === 1 ? 'resultado' : 'resultados');
 const base = `Mostrando ${formatQuantity(shown)} de ${formatQuantity(total)} ${noun}`;
 return wholeCatalog ? base : `${base} · ${formatQuantity(catalog)} ${catalog === 1 ? 'produto' : 'produtos'} no catálogo`;
}
