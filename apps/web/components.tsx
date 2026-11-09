import { useEffect, useId, useRef, type ReactNode } from 'react';

export function Mark({ small = false }: { small?: boolean }) {
 return <span className={small ? 'brand compact' : 'brand'}>
  <svg aria-hidden="true" data-logo="vv-ribbon-v3" viewBox="0 0 280 120">
   <path d="M8 16H35C44 16 50 20 55 29L92 101H64C52 101 47 96 43 88Z" fill="var(--brand-ribbon-back,#1542af)" />
   <path d="M140 16C149 16 154 20 160 29L197 101H169C158 101 151 95 147 86L119 33C124 21 130 16 140 16Z" fill="var(--brand-ribbon-back,#1542af)" />
   <path d="M64 101C75 101 80 95 85 86L118 27C123 19 130 16 140 16H165L122 91C118 98 111 101 101 101Z" fill="var(--brand-ribbon-front,#397cfa)" />
   <path d="M169 101C180 101 185 95 190 86L224 27C230 19 237 16 246 16H273L229 91C225 98 218 101 208 101Z" fill="var(--brand-ribbon-front,#397cfa)" />
  </svg>
  {!small && <span>vapt<span className="word-dot">·</span>vupt<small>GESTÃO DO SEU JEITO</small></span>}
 </span>;
}

const iconPaths: Record<string, string> = {
 overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 inventory: 'M3 7l9-4 9 4v11l-9 4-9-4z M3 7l9 4 9-4 M12 11v11',
 products: 'M4 4h7l9 9-7 7-9-9z M8 8h.01',
 movements: 'M4 7h15l-4-4 M20 17H5l4 4',
 purchases: 'M4 5h16v16H4z M8 5V3h8v2 M8 10h8 M8 15h5',
 quotes: 'M4 4h16v13H9l-5 4z M8 8h8 M8 12h5',
 team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M18 8a3 3 0 0 1 0 6 M19 17a3 3 0 0 1 3 3',
 settings: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M7 17l-2 2 M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0',
 search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
 arrow: 'M4 12h16 M14 6l6 6-6 6',
 plus: 'M12 5v14 M5 12h14',
 minus: 'M5 12h14',
 check: 'M5 12l5 5 9-10',
 close: 'M6 6l12 12 M18 6L6 18',
 sun: 'M12 3v2 M12 19v2 M3 12h2 M19 12h2 M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0'
};

export function Icon({ name }: { name: string }) {
 return <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name] || iconPaths.overview} /></svg>;
}

/**
 * Diálogo modal nativo. Foca o primeiro campo marcado com data-autofocus (ou o primeiro campo)
 * e devolve o foco a quem o abriu; se esse elemento sumiu da tela, devolve ao conteúdo principal.
 */
export function Dialog({ title, description, close, children }: { title: string; description?: string; close: () => void; children: ReactNode }) {
 const ref = useRef<HTMLDialogElement>(null);
 const titleId = useId(), descriptionId = useId();
 useEffect(() => {
  const dialog = ref.current;
  if (!dialog) return;
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (!dialog.open) dialog.showModal();
  (dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.querySelector<HTMLElement>('form input, form select, form button'))?.focus();
  return () => {
   dialog.close();
   if (opener?.isConnected) opener.focus();
   else document.getElementById('content')?.focus();
  };
 }, []);
 return <dialog ref={ref} onCancel={e => { e.preventDefault(); close(); }} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
  <div className="dialog-head">
   <h2 id={titleId}>{title}</h2>
   <button type="button" className="icon-button" onClick={close} aria-label="Fechar"><Icon name="close" /></button>
  </div>
  {description && <p className="form-help" id={descriptionId}>{description}</p>}
  {children}
 </dialog>;
}

export function Empty({ title, text, children, icon = 'inventory' }: { title: string; text: string; children?: ReactNode; icon?: string }) {
 return <div className="empty">
  <Icon name={icon} />
  <h2>{title}</h2>
  <p>{text}</p>
  {children && <div className="empty-actions">{children}</div>}
 </div>;
}

export function StockStatus({ below }: { below: boolean }) {
 return <span className={'status ' + (below ? 'warning' : 'ok')}>{below ? 'Repor' : 'Suficiente'}</span>;
}

/** Campo com rótulo, erro associado (aria-describedby) e estado inválido. */
export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; id: string; children: ReactNode }) {
 return <div className={'field' + (error ? ' has-error' : '')}>
  <label htmlFor={id}>{label}</label>
  {children}
  {hint && !error && <p className="field-hint" id={id + '-hint'}>{hint}</p>}
  {error && <p className="field-error" id={id + '-error'}><Icon name="close" />{error}</p>}
 </div>;
}

export function fieldProps(id: string, error?: string, hint?: string) {
 return { id, name: id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? id + '-error' : hint ? id + '-hint' : undefined } as const;
}
