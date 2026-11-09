import { useState, type FormEvent, type ReactNode } from 'react';
import { modules, type Product, type Theme } from '../../packages/domain';
import { Empty, Icon, Mark, StockStatus } from './components';
import type { Business, DemoMovement } from './demo';
import { filterProducts, formatQuantity, isBelowMinimum, kindLabel, type MovementKind, type StockFilter } from './inventory';

export const labels: Record<string, string> = { overview: 'Visão geral', inventory: 'Estoque', products: 'Produtos', movements: 'Movimentações', purchases: 'Compras', quotes: 'Cotações', team: 'Equipe', settings: 'Personalização' };

export type Actions = {
 move: (productId?: string, kind?: MovementKind) => void;
 createProduct: (term?: string) => void;
 openStock: (query?: string, filter?: StockFilter) => void;
 openHistory: (productId?: string) => void;
};

/* ---------- Visão geral ---------- */

export function Overview({ business, actions }: { business: Business; actions: Actions }) {
 const critical = business.products.filter(isBelowMinimum);
 const [term, setTerm] = useState('');
 const find = (e: FormEvent) => { e.preventDefault(); actions.openStock(term); };
 return <>
  <form className="quick-find" role="search" onSubmit={find}>
   <label className="search">
    <Icon name="search" />
    <span className="sr-only">Encontrar produto no estoque</span>
    <input type="search" placeholder="Encontrar produto por nome ou código" value={term} onChange={e => setTerm(e.target.value)} />
   </label>
   <button type="submit">Buscar no estoque</button>
  </form>

  <section className="metrics" aria-label="Resumo do estoque">
   <div><span>Produtos cadastrados</span><strong>{formatQuantity(business.products.length)}<small>itens</small></strong><p>Catálogo desta empresa</p></div>
   <div><span>Abaixo do mínimo</span><strong>{formatQuantity(critical.length)}<small>itens</small></strong><p className={critical.length ? 'attention' : ''}>{critical.length ? 'Confira antes de comprar' : 'Todos acima do mínimo'}</p></div>
   <div><span>Movimentações registradas</span><strong>{formatQuantity(business.movements.length)}<small>registros</small></strong><p>Demonstração neste navegador</p></div>
  </section>

  <div className="overview-grid">
   <section className="panel" aria-labelledby="priority-title">
    <div className="section-heading">
     <div><p className="eyebrow">PRIORIDADE AGORA</p><h2 id="priority-title">Precisa de reposição</h2></div>
     {critical.length > 0 && <button className="text-button" onClick={() => actions.openStock('', 'critical')}>Ver no estoque <Icon name="arrow" /></button>}
    </div>
    {!business.products.length
     ? <Empty title="Nenhum produto cadastrado" text="Cadastre o primeiro produto desta empresa para acompanhar saldo e reposição."><button className="primary" onClick={() => actions.createProduct()}><Icon name="plus" />Cadastrar produto</button></Empty>
     : critical.length
      ? critical.map(p => <div className="priority-row" key={p.id}>
       <span className="product-avatar" aria-hidden="true">{p.name.slice(0, 1)}</span>
       <div className="grow"><strong>{p.name}</strong><small>{p.sku} · {p.category}</small></div>
       <div className="stock-number"><strong>{formatQuantity(p.quantity)} <small>{p.unit}</small></strong><small>Mínimo: {formatQuantity(p.minimum)}</small></div>
       <button className="row-action receipt" onClick={() => actions.move(p.id, 'receipt')} aria-label={`Registrar entrada de ${p.name}`}><Icon name="plus" /><span>Entrada</span></button>
      </div>)
      : <Empty title="Tudo acima do mínimo" text="Os limites cadastrados não indicam falta neste momento." icon="check" />}
    <div className="panel-foot">Critério: saldo abaixo do mínimo cadastrado. Não é previsão de demanda.</div>
   </section>

   <aside className="daily-note">
    <span className="eyebrow">UMA COISA DE CADA VEZ</span>
    <h2>O próximo passo<br />fica mais fácil.</h2>
    <p>Conferiu a entrega? Registre a entrada para manter os saldos da demonstração em dia.</p>
    <button onClick={() => actions.move(undefined, 'receipt')}>Registrar entrada <Icon name="arrow" /></button>
    <div className="vv-watermark" aria-hidden="true">vv</div>
    <span className="note-footer">CLAREZA PARA QUEM FAZ ACONTECER.</span>
   </aside>
  </div>

  <section className="recent" aria-labelledby="recent-title">
   <div className="section-heading"><h2 id="recent-title">Últimas movimentações</h2>{business.movements.length > 0 && <button className="text-button" onClick={() => actions.openHistory()}>Ver histórico <Icon name="arrow" /></button>}</div>
   <MovementList movements={business.movements.slice(0, 5)} empty={<Empty title="Nenhuma movimentação registrada" text="Registre uma entrada ou saída demonstrativa para acompanhar a alteração de saldo." icon="movements" />} />
  </section>
 </>;
}

/* ---------- Estoque e produtos ---------- */

const filterLabels: Record<StockFilter, string> = { all: 'Todos', critical: 'Repor', ok: 'Suficiente' };

export function StockPage({ business, mode, query, setQuery, filter, setFilter, actions }: {
 business: Business; mode: 'inventory' | 'products'; query: string; setQuery: (q: string) => void;
 filter: StockFilter; setFilter: (f: StockFilter) => void; actions: Actions;
}) {
 const { products } = business;
 const visible = filterProducts(products, query, filter);
 const counts: Record<StockFilter, number> = { all: filterProducts(products, query, 'all').length, critical: filterProducts(products, query, 'critical').length, ok: filterProducts(products, query, 'ok').length };
 const caption = mode === 'inventory' ? `Saldos de ${business.theme.name}` : `Produtos cadastrados em ${business.theme.name}`;

 return <section className="panel stock-panel" aria-label={mode === 'inventory' ? 'Saldos de estoque' : 'Catálogo de produtos'}>
  <div className="toolbar">
   <label className="search">
    <Icon name="search" />
    <span className="sr-only">Buscar produto</span>
    <input type="search" placeholder="Buscar por nome, código ou categoria" value={query} onChange={e => setQuery(e.target.value)} />
    {query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="Limpar busca"><Icon name="close" /></button>}
   </label>
   <div className="chips" role="group" aria-label="Filtrar por situação">
    {(['all', 'critical', 'ok'] as const).map(f => <button key={f} type="button" className={'chip' + (f === 'critical' ? ' warning' : '')} aria-pressed={filter === f} onClick={() => setFilter(f)}>{filterLabels[f]} <span className="chip-count">{counts[f]}</span></button>)}
   </div>
  </div>
  <p className="result-count" role="status">{products.length ? `Mostrando ${visible.length} de ${products.length} produtos` : ''}</p>

  {visible.length > 0
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
     <tbody>{visible.map(p => <ProductRow key={p.id} product={p} mode={mode} actions={actions} />)}</tbody>
    </table>
   </div>
   : <NoResults products={products} query={query} filter={filter} clear={() => { setQuery(''); setFilter('all'); }} actions={actions} />}

  <div className="panel-foot">{mode === 'inventory' ? 'Saldos demonstrativos. Quantidades inteiras nesta primeira versão.' : 'Catálogo demonstrativo desta empresa. Código interno único por empresa.'}</div>
 </section>;
}

function ProductRow({ product: p, mode, actions }: { product: Product; mode: 'inventory' | 'products'; actions: Actions }) {
 const below = isBelowMinimum(p);
 return <tr>
  <th scope="row"><strong>{p.name}</strong><small>{p.sku}{mode === 'inventory' ? ` · ${p.category}` : ''}</small>
   <span className={'inline-balance' + (below ? ' below' : '')}><b>{formatQuantity(p.quantity)} {p.unit}</b> · mín. {formatQuantity(p.minimum)}{below ? ' · Repor' : ''}</span></th>
  {mode === 'products' && <td>{p.category}</td>}
  {mode === 'products' && <td>{p.unit}</td>}
  <td className="num"><strong>{formatQuantity(p.quantity)}</strong> {p.unit}<small className={'min-hint' + (below ? ' below' : '')} aria-hidden="true">{below ? 'Repor · ' : ''}mín. {formatQuantity(p.minimum)}</small></td>
  <td className="num">{formatQuantity(p.minimum)} {p.unit}</td>
  <td><StockStatus below={below} /></td>
  <td className="actions-col">{mode === 'inventory'
   ? <div className="row-actions">
    <button className="row-action receipt" onClick={() => actions.move(p.id, 'receipt')} aria-label={`Registrar entrada de ${p.name}`}><Icon name="plus" /><span>Entrada</span></button>
    <button className="row-action issue" onClick={() => actions.move(p.id, 'issue')} aria-label={`Registrar saída de ${p.name}`}><Icon name="minus" /><span>Saída</span></button>
   </div>
   : <button className="row-action" onClick={() => actions.openHistory(p.id)} aria-label={`Ver histórico de ${p.name}`}><Icon name="movements" /><span>Histórico</span></button>}
  </td>
 </tr>;
}

function NoResults({ products, query, filter, clear, actions }: { products: Product[]; query: string; filter: StockFilter; clear: () => void; actions: Actions }) {
 if (!products.length) return <Empty title="Nenhum produto cadastrado" text="Cadastre o primeiro produto desta empresa. Ele começa com saldo zero.">
  <button className="primary" onClick={() => actions.createProduct()}><Icon name="plus" />Cadastrar produto</button>
 </Empty>;
 if (query.trim()) return <Empty icon="search" title={`Nenhum produto para “${query.trim()}”`} text={filter === 'all' ? 'Confira a grafia ou o código. Se o produto ainda não existe nesta empresa, cadastre agora.' : `Nenhum resultado no filtro “${filterLabels[filter]}”. Confira a grafia, limpe a busca ou cadastre o produto.`}>
  <button className="primary" onClick={() => actions.createProduct(query)}><Icon name="plus" />Cadastrar “{query.trim().slice(0, 40)}”</button>
  <button onClick={clear}>Limpar busca</button>
 </Empty>;
 return <Empty icon="check" title={filter === 'critical' ? 'Nenhum produto abaixo do mínimo' : 'Nenhum produto com estoque suficiente'} text="Altere o filtro para ver os demais produtos.">
  <button onClick={clear}>Mostrar todos</button>
 </Empty>;
}

/* ---------- Histórico ---------- */

export function MovementsPage({ business, productFilter, setProductFilter, actions }: { business: Business; productFilter: string; setProductFilter: (id: string) => void; actions: Actions }) {
 const [kind, setKind] = useState<'all' | MovementKind>('all');
 const visible = business.movements.filter(m => (productFilter === 'all' || m.productId === productFilter) && (kind === 'all' || m.kind === kind));
 const filtered = productFilter !== 'all' || kind !== 'all';
 const productsWithHistory = business.products.filter(p => business.movements.some(m => m.productId === p.id) || p.id === productFilter);
 return <section className="panel">
  {business.movements.length > 0 && <div className="toolbar">
   <label className="filter-label">Produto
    <select value={productFilter} onChange={e => setProductFilter(e.target.value)}>
     <option value="all">Todos os produtos</option>
     {productsWithHistory.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
   </label>
   <div className="chips" role="group" aria-label="Filtrar por operação">
    {(['all', 'receipt', 'issue'] as const).map(k => <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'all' ? 'Todas' : kindLabel[k] + 's'}</button>)}
   </div>
  </div>}
  <MovementList movements={visible} empty={filtered && business.movements.length
   ? <Empty icon="search" title="Nenhuma movimentação neste filtro" text="Altere o produto ou a operação para ver outros registros."><button onClick={() => { setProductFilter('all'); setKind('all'); }}>Limpar filtros</button></Empty>
   : <Empty icon="movements" title="Nenhuma movimentação registrada" text="Registre uma entrada ou saída demonstrativa para acompanhar a alteração de saldo.">{business.products.length > 0 && <button className="primary" onClick={() => actions.move()}><Icon name="plus" />Registrar movimentação</button>}</Empty>} />
  <div className="panel-foot">Histórico demonstrativo salvo apenas neste navegador (últimos 200 registros). Não é registro de auditoria comercial.</div>
 </section>;
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function MovementList({ movements, empty }: { movements: DemoMovement[]; empty: ReactNode }) {
 if (!movements.length) return <>{empty}</>;
 return <ol className="movement-list">
  {movements.map(m => <li key={m.id}>
   <span className={'movement-sign ' + m.kind} aria-hidden="true">{m.kind === 'receipt' ? '+' : '−'}</span>
   <div className="grow">
    <strong>{m.product}</strong>
    <small>{kindLabel[m.kind]} · {m.reason} · <time dateTime={m.at}>{dateFormat.format(new Date(m.at))}</time></small>
   </div>
   <div className="movement-figures">
    <strong className={'delta ' + m.kind}>{m.kind === 'receipt' ? '+' : '−'}{formatQuantity(m.quantity)} <small>{m.unit}</small></strong>
    <small>Saldo {formatQuantity(m.before)} → {formatQuantity(m.after)}</small>
   </div>
  </li>)}
 </ol>;
}

/* ---------- Personalização ---------- */

export function ThemeEditor({ theme, setDraft, save, cancel, reset }: { theme: Theme; setDraft: (t: Theme) => void; save: () => void; cancel: () => void; reset: () => void }) {
 const [error, setError] = useState('');
 const patch = (p: Partial<Theme>) => setDraft({ ...theme, ...p });
 const onLogo = async (file?: File) => {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 120000) { setError('Use PNG, JPG ou WebP de até 120 KB.'); return; }
  try {
   const bitmap = await createImageBitmap(file);
   const tooLarge = bitmap.width > 2048 || bitmap.height > 2048;
   bitmap.close();
   if (tooLarge) { setError('Use uma imagem de até 2048 × 2048 pixels.'); return; }
   const reader = new FileReader();
   reader.onload = () => { patch({ logo: String(reader.result) }); setError(''); };
   reader.onerror = () => setError('Não foi possível ler a imagem.');
   reader.readAsDataURL(file);
  } catch { setError('A imagem não pôde ser aberta.'); }
 };
 return <div className="theme-layout">
  <div className="theme-column">
   <section className="panel theme-controls">
    <h2>Identidade & aparência</h2>
    <p className="form-help">A prévia atualiza a interface. Salve para manter as alterações neste navegador.</p>
    <label>Nome exibido<input value={theme.name} maxLength={60} onChange={e => patch({ name: e.target.value })} /></label>
    <fieldset><legend>Paleta</legend><div className="swatches">{(['blue', 'navy', 'sky'] as const).map((a, i) => <button aria-pressed={theme.accent === a} onClick={() => patch({ accent: a })} key={a}><span className={'swatch ' + a} />{['Azul Royal', 'Azul Marinho', 'Azul Atlântico'][i]}</button>)}</div></fieldset>
    <div className="form-grid">
     <label>Aparência<select value={theme.mode} onChange={e => patch({ mode: e.target.value as Theme['mode'] })}><option value="light">Claro</option><option value="dark">Escuro</option></select></label>
     <label>Densidade<select value={theme.density} onChange={e => patch({ density: e.target.value as Theme['density'] })}><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></label>
    </div>
    <label>Tipografia<select value={theme.font} onChange={e => patch({ font: e.target.value as Theme['font'] })}><option value="humanist">Humanista — Trebuchet / sistema</option><option value="system">Sistema operacional</option></select></label>
    <label>Logotipo · PNG, JPG ou WebP, até 120 KB<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => onLogo(e.target.files?.[0])} /></label>
    {theme.logo && <button onClick={() => patch({ logo: undefined })}>Remover logotipo</button>}
    <fieldset><legend>Módulos no menu</legend><p className="form-help">Organiza a navegação da demo. Não concede nem remove permissões de acesso.</p>
     {modules.filter(m => m !== 'overview').map(m => <label className="check" key={m}><input type="checkbox" checked={theme.modules.includes(m)} onChange={e => patch({ modules: e.target.checked ? [...theme.modules, m] : theme.modules.filter(x => x !== m) })} />{labels[m]}{['quotes', 'purchases', 'team'].includes(m) && <small>Planejado</small>}</label>)}
    </fieldset>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="form-actions"><button className="primary" onClick={save}>Salvar personalização</button><button onClick={cancel}>Descartar prévia</button></div>
   </section>
   <section className="panel theme-controls reset-panel">
    <h2>Dados da demonstração</h2>
    <p className="form-help">Volta as três empresas de exemplo ao estado inicial e apaga produtos, saldos, histórico e personalizações salvos neste navegador.</p>
    <button onClick={reset}>Restaurar dados de exemplo</button>
   </section>
  </div>
  <aside className="theme-preview"><p className="eyebrow">PRÉVIA AO VIVO</p><div className="preview-brand">{theme.logo ? <img src={theme.logo} alt="Logotipo em prévia" /> : <Mark small />}<h2>{theme.name}</h2></div><p>Seu comércio. Sua identidade.<br />A mesma base Vapt-Vupt.</p><div className="preview-row"><span>Arroz branco · 5 kg</span><span className="status warning">Repor</span></div><button className="primary" disabled>Exemplo de botão</button><p className="fine">Paletas controladas. Nenhum CSS ou script arbitrário é aceito.</p></aside>
 </div>;
}
