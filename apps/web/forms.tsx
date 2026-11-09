import { useState, type FormEvent } from 'react';
import { ProductSchema, type Product } from '../../packages/domain';
import { Field, fieldProps, Icon } from './components';
import { formatQuantity, kindLabel, reasonSuggestions, type MovementKind, type MovementRequest } from './inventory';

type Errors<K extends string> = Partial<Record<K, string>>;

/** Move o foco para o primeiro campo com erro, na ordem do formulário. */
function focusFirstError(form: HTMLFormElement) {
 requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

export function MovementForm({ products, initialProductId, initialKind = 'receipt', submit, createProduct }: {
 products: Product[];
 initialProductId?: string;
 initialKind?: MovementKind;
 submit: (request: MovementRequest) => string | void;
 createProduct: () => void;
}) {
 const [productId, setProductId] = useState(initialProductId || products[0]?.id || '');
 const [kind, setKind] = useState<MovementKind>(initialKind);
 const [quantityText, setQuantityText] = useState('');
 const [reason, setReason] = useState('');
 const [errors, setErrors] = useState<Errors<'product' | 'quantity' | 'reason' | 'form'>>({});

 if (!products.length) return <div className="form-empty">
  <p>Esta empresa ainda não tem produtos. Cadastre um produto para registrar a primeira entrada.</p>
  <button type="button" className="primary" data-autofocus onClick={createProduct}><Icon name="plus" />Cadastrar produto</button>
 </div>;

 const product = products.find(p => p.id === productId);
 const quantity = Number(quantityText);
 const validQuantity = quantityText !== '' && Number.isInteger(quantity) && quantity > 0 && quantity <= 1000000;
 const projected = product && validQuantity ? product.quantity + (kind === 'receipt' ? quantity : -quantity) : null;

 const validate = () => {
  const next: typeof errors = {};
  if (!product) next.product = 'Escolha um produto.';
  if (!validQuantity) next.quantity = 'Informe uma quantidade inteira maior que zero.';
  else if (product && kind === 'issue' && quantity > product.quantity) next.quantity = `A saída não pode ser maior que o saldo disponível (${formatQuantity(product.quantity)} ${product.unit}).`;
  if (reason.trim().length < 3) next.reason = 'Descreva o motivo com pelo menos 3 caracteres.';
  return next;
 };

 const onSubmit = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const next = validate();
  setErrors(next);
  if (Object.keys(next).length) { focusFirstError(e.currentTarget); return; }
  const failure = submit({ productId, kind, quantity, reason: reason.trim() });
  if (failure) setErrors({ form: failure });
 };

 return <form noValidate onSubmit={onSubmit} className="movement-form">
  <Field label="Produto" id="mv-product" error={errors.product}>
   <select {...fieldProps('mv-product', errors.product)} value={productId} onChange={e => { setProductId(e.target.value); setErrors({}); }} data-autofocus={initialProductId ? undefined : true}>
    {products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku} — {formatQuantity(p.quantity)} {p.unit}</option>)}
   </select>
  </Field>

  <fieldset className="segmented">
   <legend>Operação</legend>
   {(['receipt', 'issue'] as const).map(k => <label key={k} className={'segment ' + k}>
    <input type="radio" name="mv-kind" value={k} checked={kind === k} onChange={() => { setKind(k); setErrors({}); }} />
    <span><Icon name={k === 'receipt' ? 'plus' : 'minus'} />{kindLabel[k]}</span>
   </label>)}
  </fieldset>

  <Field label={`Quantidade${product ? ` (${product.unit})` : ''}`} id="mv-quantity" error={errors.quantity}>
   <input {...fieldProps('mv-quantity', errors.quantity)} type="number" inputMode="numeric" min={1} max={1000000} step={1}
    value={quantityText} onChange={e => setQuantityText(e.target.value)} data-autofocus={initialProductId ? true : undefined} />
  </Field>

  {product && <div className="balance-preview" aria-live="polite">
   <div><span>Saldo atual</span><strong>{formatQuantity(product.quantity)} <small>{product.unit}</small></strong></div>
   <Icon name="arrow" />
   <div className={projected !== null && projected < 0 ? 'invalid' : ''}>
    <span>Após {kind === 'receipt' ? 'a entrada' : 'a saída'}</span>
    <strong>{projected === null ? '—' : formatQuantity(projected)} <small>{product.unit}</small></strong>
   </div>
  </div>}

  <Field label="Motivo" id="mv-reason" error={errors.reason}>
   <input {...fieldProps('mv-reason', errors.reason)} maxLength={160} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: recebimento de fornecedor" />
  </Field>
  <div className="chips" role="group" aria-label="Sugestões de motivo">
   {reasonSuggestions[kind].map(s => <button type="button" key={s} className="chip" aria-pressed={reason === s} onClick={() => { setReason(s); setErrors(x => ({ ...x, reason: undefined })); }}>{s}</button>)}
  </div>

  {errors.form && <p role="alert" className="error">{errors.form}</p>}
  <button className="primary submit">{kind === 'receipt' ? 'Registrar entrada' : 'Registrar saída'}</button>
 </form>;
}

type ProductFields = 'name' | 'sku' | 'unit' | 'category' | 'minimum';

export function ProductForm({ existing, prefill, submit }: { existing: Product[]; prefill?: { name?: string; sku?: string }; submit: (p: Product) => void }) {
 const [errors, setErrors] = useState<Errors<ProductFields>>({});
 const categories = [...new Set(existing.map(p => p.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

 const onSubmit = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const form = e.currentTarget, d = new FormData(form);
  const minimumText = String(d.get('pr-minimum') ?? '');
  const result = ProductSchema.safeParse({
   id: crypto.randomUUID(), name: d.get('pr-name'), sku: d.get('pr-sku'), unit: d.get('pr-unit'),
   category: d.get('pr-category'), quantity: 0, minimum: minimumText === '' ? NaN : Number(minimumText)
  });
  const next: Errors<ProductFields> = {};
  if (!result.success) {
   for (const issue of result.error.issues) {
    const key = issue.path[0] as ProductFields;
    if (key && !next[key]) next[key] = ({
     name: 'Informe um nome com 2 a 120 caracteres.',
     sku: 'Informe um código com até 40 caracteres.',
     unit: 'Escolha uma unidade.',
     category: 'Informe uma categoria com até 40 caracteres.',
     minimum: 'Use um número inteiro de 0 a 1.000.000.'
    } as Record<ProductFields, string>)[key];
   }
  } else if (existing.some(p => p.sku.toLocaleLowerCase('pt-BR') === result.data.sku.toLocaleLowerCase('pt-BR'))) {
   next.sku = 'Este código já existe nesta empresa.';
  }
  setErrors(next);
  if (Object.keys(next).length || !result.success) { focusFirstError(form); return; }
  submit(result.data);
 };

 return <form noValidate onSubmit={onSubmit}>
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
  <button className="primary submit">Salvar produto</button>
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
