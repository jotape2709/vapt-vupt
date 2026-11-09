import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ProductSchema } from '../../packages/domain';
import type { MovementCreate, MovementRecord, MovementResult, ProductCreate, StockItem, StockPage, StockQuery } from '../../packages/domain/contracts';
import { Field, fieldProps, Icon } from './components';
import { RequestError, isAbort } from './data/http';
import { formatQuantity, kindLabel, reasonSuggestions, type MovementKind } from './inventory';

type Errors<K extends string> = Partial<Record<K, string>>;

/** Move o foco para o primeiro campo com erro, na ordem do formulário. */
function focusFirstError(form: HTMLFormElement | null) {
 requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

const PICKER_LIMIT = 50;

type Phase =
 | { name: 'editing' }
 | { name: 'sending' }
 /** Timeout ou perda da resposta: o servidor pode ou não ter registrado. Nada é afirmado. */
 | { name: 'unknown'; detail: string }
 | { name: 'checking' }
 | { name: 'not-recorded' };

/**
 * Registro de entrada/saída. O identificador do evento nasce com o formulário e é reutilizado
 * em qualquer reenvio do MESMO conteúdo: repetir nunca movimenta o estoque duas vezes.
 * Um novo identificador só é criado depois de uma resposta definitiva (conflito ou recusa).
 */
export function MovementForm({ searchProducts, initialProduct, initialKind = 'receipt', submit, verify, onConfirmed, createProduct, canCreateProduct, live }: {
 searchProducts: (q: StockQuery, signal?: AbortSignal) => Promise<StockPage>;
 initialProduct?: StockItem;
 initialKind?: MovementKind;
 submit: (m: MovementCreate) => Promise<MovementResult>;
 verify: (eventId: string) => Promise<MovementRecord | null>;
 onConfirmed: (movement: MovementRecord, replayed: boolean) => void;
 createProduct: () => void;
 canCreateProduct: boolean;
 live: boolean;
}) {
 const [options, setOptions] = useState<StockItem[]>(initialProduct ? [initialProduct] : []);
 const [catalogSize, setCatalogSize] = useState<number | null>(null);
 const [loadError, setLoadError] = useState<string | null>(null);
 const [filter, setFilter] = useState('');
 const [productId, setProductId] = useState(initialProduct?.id ?? '');
 const [kind, setKind] = useState<MovementKind>(initialKind);
 const [quantityText, setQuantityText] = useState('');
 const [reason, setReason] = useState('');
 const [errors, setErrors] = useState<Errors<'product' | 'quantity' | 'reason' | 'form'>>({});
 const [eventId, setEventId] = useState(() => crypto.randomUUID());
 const [phase, setPhase] = useState<Phase>({ name: 'editing' });
 const formRef = useRef<HTMLFormElement>(null);

 // Catálogo pesquisável no servidor: o seletor nunca carrega o catálogo inteiro.
 useEffect(() => {
  const controller = new AbortController();
  const t = setTimeout(() => {
   searchProducts({ q: filter, limit: PICKER_LIMIT }, controller.signal).then(page => {
    setCatalogSize(page.counts.catalog);
    setLoadError(null);
    setOptions(prev => {
     const keep = prev.find(p => p.id === productId);
     const list = keep && !page.items.some(p => p.id === keep.id) ? [keep, ...page.items] : page.items;
     return list;
    });
    setProductId(id => id || page.items[0]?.id || '');
   }, e => { if (!controller.signal.aborted && !isAbort(e)) setLoadError(e instanceof Error ? e.message : 'Falha ao carregar produtos.'); });
  }, filter ? 250 : 0);
  return () => { clearTimeout(t); controller.abort(); };
 }, [filter]);

 const locked = phase.name !== 'editing';
 if (catalogSize === 0 && !initialProduct) return <div className="form-empty">
  <p>Esta empresa ainda não tem produtos. {canCreateProduct ? 'Cadastre um produto para registrar a primeira entrada.' : 'Peça a um gestor ou proprietário para cadastrar o primeiro produto.'}</p>
  {canCreateProduct && <button type="button" className="primary" data-autofocus onClick={createProduct}><Icon name="plus" />Cadastrar produto</button>}
 </div>;

 const product = options.find(p => p.id === productId);
 const quantity = Number(quantityText);
 const validQuantity = quantityText !== '' && Number.isInteger(quantity) && quantity > 0 && quantity <= 1000000;
 const projected = product && validQuantity ? product.quantity + (kind === 'receipt' ? quantity : -quantity) : null;

 /** Qualquer edição depois de uma resposta definitiva é uma nova operação. */
 const edit = (fn: () => void) => { if (locked) return; fn(); setErrors({}); };

 const validate = () => {
  const next: typeof errors = {};
  if (!product) next.product = 'Escolha um produto.';
  if (!validQuantity) next.quantity = 'Informe uma quantidade inteira maior que zero.';
  else if (product && kind === 'issue' && quantity > product.quantity) next.quantity = `A saída não pode ser maior que o saldo disponível (${formatQuantity(product.quantity)} ${product.unit}).`;
  if (reason.trim().length < 3) next.reason = 'Descreva o motivo com pelo menos 3 caracteres.';
  return next;
 };

 const payload = (): MovementCreate => ({ eventId, productId, expectedVersion: product!.stockVersion, kind, quantity, reason: reason.trim() });

 const updateProduct = (patch: { quantity: number; stockVersion: number }) =>
  setOptions(list => list.map(p => (p.id === productId ? { ...p, ...patch } : p)));

 const send = async () => {
  setPhase({ name: 'sending' });
  try {
   const result = await submit(payload());
   onConfirmed(result.movement, result.replayed);
  } catch (e) {
   if (isAbort(e)) return;
   const err = e instanceof RequestError ? e : new RequestError('network', 'Falha inesperada.');
   if (err.outcomeUnknown) { setPhase({ name: 'unknown', detail: err.message }); return; }
   setPhase({ name: 'editing' });
   setEventId(crypto.randomUUID());
   if (err.body?.current) updateProduct(err.body.current);
   if (err.kind === 'version_conflict') setErrors({ form: `${err.message} Saldo atual: ${formatQuantity(err.body?.current?.quantity ?? 0)} ${product?.unit ?? ''}. Revise a quantidade e confirme de novo.` });
   else if (err.kind === 'insufficient_balance') { setErrors({ quantity: err.message }); focusFirstError(formRef.current); }
   else if (err.kind === 'unauthenticated' || err.kind === 'session_expired') setErrors({ form: 'Sua sessão terminou. Entre novamente; o formulário não foi enviado.' });
   else setErrors({ form: err.message });
  }
 };

 const onSubmit = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (locked) return;
  const next = validate();
  setErrors(next);
  if (Object.keys(next).length) { focusFirstError(e.currentTarget); return; }
  void send();
 };

 const check = async () => {
  setPhase({ name: 'checking' });
  try {
   const record = await verify(eventId);
   if (record) onConfirmed(record, true);
   else setPhase({ name: 'not-recorded' });
  } catch (e) {
   if (!isAbort(e)) setPhase({ name: 'unknown', detail: e instanceof Error ? e.message : 'Falha ao verificar.' });
  }
 };

 return <form noValidate onSubmit={onSubmit} className="movement-form" ref={formRef} aria-busy={phase.name === 'sending' || phase.name === 'checking'}>
  <Field label="Produto" id="mv-product" error={errors.product}>
   <select {...fieldProps('mv-product', errors.product)} value={productId} disabled={locked} onChange={e => edit(() => setProductId(e.target.value))} data-autofocus={initialProduct ? undefined : true}>
    {!options.length && <option value="">{loadError ? 'Não foi possível carregar' : 'Carregando produtos…'}</option>}
    {options.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku} — {formatQuantity(p.quantity)} {p.unit}</option>)}
   </select>
  </Field>
  {loadError && <p className="field-error" role="alert"><Icon name="close" />{loadError}</p>}
  {catalogSize !== null && catalogSize > PICKER_LIMIT && <label className="picker-filter">
   <span>Buscar outro produto ({formatQuantity(catalogSize)} no catálogo)</span>
   <input type="search" value={filter} disabled={locked} onChange={e => setFilter(e.target.value)} placeholder="Nome, código ou categoria" />
  </label>}

  <fieldset className="segmented" disabled={locked}>
   <legend>Operação</legend>
   {(['receipt', 'issue'] as const).map(k => <label key={k} className={'segment ' + k}>
    <input type="radio" name="mv-kind" value={k} checked={kind === k} onChange={() => edit(() => setKind(k))} />
    <span><Icon name={k === 'receipt' ? 'plus' : 'minus'} />{kindLabel[k]}</span>
   </label>)}
  </fieldset>

  <Field label={`Quantidade${product ? ` (${product.unit})` : ''}`} id="mv-quantity" error={errors.quantity}>
   <input {...fieldProps('mv-quantity', errors.quantity)} type="number" inputMode="numeric" min={1} max={1000000} step={1} readOnly={locked}
    value={quantityText} onChange={e => edit(() => setQuantityText(e.target.value))} data-autofocus={initialProduct ? true : undefined} />
  </Field>

  {product && <div className="balance-preview" aria-live="polite">
   <div><span>Saldo atual</span><strong>{formatQuantity(product.quantity)} <small>{product.unit}</small></strong></div>
   <Icon name="arrow" />
   <div className={projected !== null && projected < 0 ? 'invalid' : ''}>
    <span>Após {kind === 'receipt' ? 'a entrada' : 'a saída'}</span>
    {projected !== null && projected < 0
     ? <strong>Insuficiente</strong>
     : <strong>{projected === null ? '—' : formatQuantity(projected)} <small>{product.unit}</small></strong>}
   </div>
  </div>}

  <Field label="Motivo" id="mv-reason" error={errors.reason}>
   <input {...fieldProps('mv-reason', errors.reason)} maxLength={160} readOnly={locked} value={reason} onChange={e => edit(() => setReason(e.target.value))} placeholder="Ex.: recebimento de fornecedor" />
  </Field>
  <div className="chips" role="group" aria-label="Sugestões de motivo">
   {reasonSuggestions[kind].map(s => <button type="button" key={s} className="chip" disabled={locked} aria-pressed={reason === s} onClick={() => edit(() => setReason(s))}>{s}</button>)}
  </div>

  {errors.form && <p role="alert" className="error">{errors.form}</p>}

  {(phase.name === 'unknown' || phase.name === 'checking') && <div className="outcome-unknown" role="alert">
   <strong>Não sabemos se a operação foi registrada.</strong>
   <p>{phase.name === 'unknown' ? phase.detail + ' ' : ''}Antes de tentar de novo, verifique pelo identificador. Reenviar o mesmo registro não duplica o estoque.</p>
   <small>Identificador: <code>{eventId.slice(0, 8)}</code></small>
   <div className="confirm-actions">
    <button type="button" className="primary" onClick={check} disabled={phase.name === 'checking'} data-autofocus>{phase.name === 'checking' ? 'Verificando…' : 'Verificar registro'}</button>
   </div>
  </div>}
  {phase.name === 'not-recorded' && <div className="outcome-unknown" role="alert">
   <strong>A operação não foi registrada.</strong>
   <p>O servidor não tem nenhum registro com este identificador. Você pode reenviar exatamente o mesmo conteúdo com segurança, ou descartar e revisar.</p>
   <div className="confirm-actions">
    <button type="button" className="primary" onClick={() => void send()}>Reenviar o mesmo registro</button>
    <button type="button" onClick={() => { setPhase({ name: 'editing' }); setEventId(crypto.randomUUID()); }}>Descartar e revisar</button>
   </div>
  </div>}

  {phase.name !== 'unknown' && phase.name !== 'checking' && phase.name !== 'not-recorded' &&
   <button className="primary submit" disabled={phase.name === 'sending' || !product}>{phase.name === 'sending' ? (live ? 'Enviando ao servidor…' : 'Registrando…') : kind === 'receipt' ? 'Registrar entrada' : 'Registrar saída'}</button>}
 </form>;
}

type ProductFields = 'name' | 'sku' | 'unit' | 'category' | 'minimum';
const productMessages: Record<ProductFields, string> = {
 name: 'Informe um nome com 2 a 120 caracteres.',
 sku: 'Informe um código com até 40 caracteres.',
 unit: 'Escolha uma unidade.',
 category: 'Informe uma categoria com até 40 caracteres.',
 minimum: 'Use um número inteiro de 0 a 1.000.000.'
};

/**
 * Cadastro sem saldo: o produto nasce com zero e o saldo só muda por movimentação.
 * O id nasce com o formulário: reenviar depois de uma falha de rede não duplica o produto.
 */
export function ProductForm({ categories, prefill, submit, live }: { categories: string[]; prefill?: { name?: string; sku?: string }; submit: (p: ProductCreate) => Promise<StockItem>; live: boolean }) {
 const [errors, setErrors] = useState<Errors<ProductFields | 'form'>>({});
 const [sending, setSending] = useState(false);
 const [id] = useState(() => crypto.randomUUID());

 const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (sending) return;
  const form = e.currentTarget, d = new FormData(form);
  const minimumText = String(d.get('pr-minimum') ?? '');
  const result = ProductSchema.omit({ quantity: true }).safeParse({
   id, name: d.get('pr-name'), sku: d.get('pr-sku'), unit: d.get('pr-unit'),
   category: d.get('pr-category'), minimum: minimumText === '' ? NaN : Number(minimumText)
  });
  const next: Errors<ProductFields | 'form'> = {};
  if (!result.success) for (const issue of result.error.issues) {
   const key = issue.path[0] as ProductFields;
   if (key && !next[key]) next[key] = productMessages[key];
  }
  setErrors(next);
  if (Object.keys(next).length || !result.success) { focusFirstError(form); return; }
  setSending(true);
  try {
   await submit(result.data);
  } catch (err) {
   const r = err instanceof RequestError ? err : null;
   if (r?.kind === 'duplicate_sku') setErrors({ sku: 'Este código já existe nesta empresa.' });
   else if (r?.outcomeUnknown) setErrors({ form: `${r.message} Não sabemos se o cadastro foi concluído. Salvar de novo é seguro: o mesmo cadastro não é duplicado.` });
   else setErrors({ form: r?.message ?? 'Não foi possível cadastrar.' });
   focusFirstError(form);
  } finally {
   setSending(false);
  }
 };

 return <form noValidate onSubmit={onSubmit} aria-busy={sending}>
  <Field label="Nome do produto" id="pr-name" error={errors.name}>
   <input {...fieldProps('pr-name', errors.name)} maxLength={120} defaultValue={prefill?.name} data-autofocus placeholder="Ex.: Arroz integral · 1 kg" />
  </Field>
  <div className="form-grid">
   <Field label="Código interno" id="pr-sku" error={errors.sku}>
    <input {...fieldProps('pr-sku', errors.sku)} maxLength={40} defaultValue={prefill?.sku} autoCapitalize="characters" />
   </Field>
   <Field label="Unidade" id="pr-unit" error={errors.unit}>
    <select {...fieldProps('pr-unit', errors.unit)} defaultValue="un">{['un', 'kg', 'cx', 'L'].map(u => <option key={u}>{u}</option>)}</select>
   </Field>
  </div>
  <div className="form-grid">
   <Field label="Categoria" id="pr-category" error={errors.category}>
    <input {...fieldProps('pr-category', errors.category)} maxLength={40} list="pr-category-options" />
   </Field>
   <Field label="Estoque mínimo" id="pr-minimum" error={errors.minimum} hint="Abaixo dele, o produto aparece como Repor.">
    <input {...fieldProps('pr-minimum', errors.minimum, 'Abaixo dele, o produto aparece como Repor.')} type="number" inputMode="numeric" min={0} max={1000000} step={1} defaultValue={0} />
   </Field>
  </div>
  <datalist id="pr-category-options">{categories.map(c => <option key={c} value={c} />)}</datalist>
  <p className="form-help">O produto começa com saldo zero. Depois de salvar, você pode registrar a primeira entrada.</p>
  {errors.form && <p role="alert" className="error">{errors.form}</p>}
  <button className="primary submit" disabled={sending}>{sending ? (live ? 'Enviando ao servidor…' : 'Salvando…') : 'Salvar produto'}</button>
 </form>;
}

export function Onboarding({ submit }: { submit: (name: string, segment: number) => void }) {
 const [error, setError] = useState('');
 return <form noValidate onSubmit={e => {
  e.preventDefault();
  const d = new FormData(e.currentTarget), name = String(d.get('ob-name')).trim();
  if (name.length < 2 || name.length > 60) { setError('Informe um nome com 2 a 60 caracteres.'); focusFirstError(e.currentTarget); return; }
  submit(name, Number(d.get('ob-segment')));
 }}>
  <Field label="Nome da empresa" id="ob-name" error={error}>
   <input {...fieldProps('ob-name', error)} maxLength={60} placeholder="Ex.: Mercado do Bairro" />
  </Field>
  <Field label="Tipo de estabelecimento" id="ob-segment">
   <select {...fieldProps('ob-segment')}><option value="0">Mercado / outros comércios</option><option value="1">Adega</option><option value="2">Bar e restaurante</option></select>
  </Field>
  <button className="primary submit">Criar ambiente demonstrativo</button>
 </form>;
}

export function ConfirmReset({ confirm, cancel }: { confirm: () => void; cancel: () => void }) {
 return <div className="confirm-actions">
  <button type="button" data-autofocus onClick={cancel}>Cancelar</button>
  <button type="button" className="primary danger" onClick={confirm}>Restaurar dados de exemplo</button>
 </div>;
}
