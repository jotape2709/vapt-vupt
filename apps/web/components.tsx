import { useEffect, useRef, type ReactNode } from 'react';
export function Mark({small=false}:{small?:boolean}) { return <span className={small?'brand compact':'brand'}><svg aria-hidden="true" viewBox="0 0 64 48"><path d="M2 6h12l12 28L38 6h12L30 46h-8z" fill="currentColor"/><path d="M32 6h12l8 18 8-18h4L52 46z" fill="currentColor" opacity=".55"/></svg>{!small&&<span>vapt<span className="word-dot">·</span>vupt<small>GESTÃO DO SEU JEITO</small></span>}</span>; }
export function Icon({name}:{name:string}) {
 const paths:Record<string,string>={overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',inventory:'M3 7l9-4 9 4v11l-9 4-9-4z M3 7l9 4 9-4 M12 11v11',products:'M4 4h7l9 9-7 7-9-9z M8 8h.01',movements:'M4 7h15l-4-4 M20 17H5l4 4',purchases:'M4 5h16v16H4z M8 5V3h8v2 M8 10h8 M8 15h5',quotes:'M4 4h16v13H9l-5 4z M8 8h8 M8 12h5',team:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M18 8a3 3 0 0 1 0 6 M19 17a3 3 0 0 1 3 3',settings:'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M7 17l-2 2 M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',arrow:'M4 12h16 M14 6l6 6-6 6',plus:'M12 5v14 M5 12h14',sun:'M12 3v2 M12 19v2 M3 12h2 M19 12h2 M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0'};
 return <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]||paths.overview}/></svg>;
}
export function Dialog({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=ref.current; const previous=document.activeElement as HTMLElement|null; d?.showModal(); return ()=>{d?.close();previous?.focus();};},[]);
 return <dialog ref={ref} onCancel={e=>{e.preventDefault();close();}} aria-labelledby="dialog-title"><div className="dialog-head"><h2 id="dialog-title">{title}</h2><button onClick={close} aria-label="Fechar">×</button></div>{children}</dialog>;
}
