import { useState, type ReactNode } from 'react';
import { modules } from '../../packages/domain';
import {
 overviewBlocks, segmentLabels, segments, templates, type OrgSettings, type OverviewBlock, type Segment, type UserPreferences
} from '../../packages/domain/contracts';
import { Mark } from './components';
import { RequestError } from './data/http';
import { labels } from './pages';

const blockLabels: Record<OverviewBlock, string> = { quick_find: 'Busca rápida', metrics: 'Resumo em números', priority: 'Precisa de reposição', recent: 'Últimas movimentações', daily_note: 'Nota do dia' };
const plannedModules = ['purchases', 'quotes', 'team'];

/**
 * Personalização da empresa (identidade, aparência, navegação) separada das preferências
 * pessoais. O que cada função pode alterar é decidido no servidor; aqui só se evita oferecer
 * controles que seriam recusados.
 */
export function SettingsEditor({ settings, setDraft, dirty, save, cancel, saving, canIdentity, canAppearance, logoUrl, uploadLogo, live, preferences, onPreferences, resetPanel }: {
 settings: OrgSettings; setDraft: (s: OrgSettings) => void; dirty: boolean;
 save: () => void; cancel: () => void; saving: boolean;
 canIdentity: boolean; canAppearance: boolean;
 logoUrl: string | null; uploadLogo: (file: File) => Promise<{ assetId: string; previewUrl: string }>;
 live: boolean;
 preferences?: UserPreferences; onPreferences?: (p: UserPreferences) => void;
 resetPanel?: ReactNode;
}) {
 const [error, setError] = useState('');
 const [preview, setPreview] = useState<string | null>(null);
 const [uploading, setUploading] = useState(false);
 const [template, setTemplate] = useState<Exclude<Segment, 'other'>>(settings.identity.segment === 'other' ? 'market' : settings.identity.segment);
 const patch = (p: Partial<OrgSettings>) => setDraft({ ...settings, ...p });
 const shownLogo = settings.identity.logoAssetId ? preview ?? logoUrl : null;

 const onLogo = async (file?: File) => {
  if (!file) return;
  setUploading(true); setError('');
  try {
   const result = await uploadLogo(file);
   setPreview(result.previewUrl);
   patch({ identity: { ...settings.identity, logoAssetId: result.assetId } });
  } catch (e) {
   setError(e instanceof RequestError ? e.message : 'Não foi possível enviar a imagem.');
  } finally { setUploading(false); }
 };

 const applyTemplate = () => {
  const { label: _label, schemaVersion: _v, ...t } = templates[template];
  setDraft({ ...settings, ...structuredClone(t), identity: { ...settings.identity, segment: template } });
 };

 return <div className="theme-layout">
  <div className="theme-column">
   <section className="panel theme-controls" aria-labelledby="identity-title">
    <h2 id="identity-title">Identidade da empresa</h2>
    <p className="form-help">{live
     ? (canIdentity ? 'Vale para todas as pessoas desta empresa. Cada alteração salva gera uma nova versão.' : 'Somente o proprietário altera nome, segmento, logotipo e módulos.')
     : 'A prévia atualiza a interface. Salve para guardar as alterações neste navegador.'}</p>
    <fieldset disabled={!canIdentity} className="plain">
     <label>Nome exibido<input value={settings.identity.displayName} maxLength={60} onChange={e => patch({ identity: { ...settings.identity, displayName: e.target.value } })} /></label>
     <label>Segmento<select value={settings.identity.segment} onChange={e => patch({ identity: { ...settings.identity, segment: e.target.value as Segment } })}>{segments.map(s => <option key={s} value={s}>{segmentLabels[s]}</option>)}</select></label>
     <label>Logotipo · PNG, JPG ou WebP{live ? ', até 256 KB e 1024 × 1024 px (validado no servidor)' : ', até 120 KB'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void onLogo(e.target.files?.[0])} disabled={uploading} /></label>
     {uploading && <p className="form-help" role="status">Enviando logotipo…</p>}
     {settings.identity.logoAssetId && <button type="button" onClick={() => { setPreview(null); patch({ identity: { ...settings.identity, logoAssetId: null } }); }}>Remover logotipo</button>}
     <div className="fieldset-like"><span className="legend-like">Módulos no menu</span><p className="form-help">Organiza a navegação. Não concede nem remove permissões: o servidor decide o que cada função pode fazer.</p>
      {modules.filter(m => m !== 'overview').map(m => <label className="check" key={m}><input type="checkbox" checked={settings.modules.includes(m)} onChange={e => {
       const next = e.target.checked ? modules.filter(x => x === m || settings.modules.includes(x)) : settings.modules.filter(x => x !== m);
       patch({ modules: next, navigation: next.includes(settings.navigation.landing) ? settings.navigation : { landing: 'overview' } });
      }} />{labels[m]}{plannedModules.includes(m) && <small>Planejado</small>}</label>)}
     </div>
     <div className="template-row">
      <label>Modelo de segmento<select value={template} onChange={e => setTemplate(e.target.value as typeof template)}>{Object.entries(templates).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select></label>
      <button type="button" onClick={applyTemplate}>Aplicar modelo ao rascunho</button>
     </div>
    </fieldset>
   </section>

   <section className="panel theme-controls" aria-labelledby="appearance-title">
    <h2 id="appearance-title">Aparência e navegação</h2>
    {live && !canAppearance && <p className="form-help">Somente gestores e proprietários alteram a aparência padrão da empresa. Ajuste a sua em Preferências pessoais.</p>}
    <fieldset disabled={!canAppearance} className="plain">
     <fieldset><legend>Paleta</legend><div className="swatches">{(['blue', 'navy', 'sky'] as const).map((a, i) => <button type="button" aria-pressed={settings.appearance.palette === a} onClick={() => patch({ appearance: { ...settings.appearance, palette: a } })} key={a}><span className={'swatch ' + a} />{['Azul Royal', 'Azul Marinho', 'Azul Atlântico'][i]}</button>)}</div></fieldset>
     <div className="form-grid">
      <label>Aparência{live ? ' padrão' : ''}<select value={settings.appearance.mode} onChange={e => patch({ appearance: { ...settings.appearance, mode: e.target.value as 'light' | 'dark' } })}><option value="light">Claro</option><option value="dark">Escuro</option></select></label>
      <label>Densidade<select value={settings.appearance.density} onChange={e => patch({ appearance: { ...settings.appearance, density: e.target.value as 'comfortable' | 'compact' } })}><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></label>
     </div>
     <label>Tipografia<select value={settings.appearance.font} onChange={e => patch({ appearance: { ...settings.appearance, font: e.target.value as 'humanist' | 'system' } })}><option value="humanist">Humanista — Trebuchet / sistema</option><option value="system">Sistema operacional</option></select></label>
     <label>Página inicial<select value={settings.navigation.landing} onChange={e => patch({ navigation: { landing: e.target.value as OrgSettings['navigation']['landing'] } })}>{settings.modules.map(m => <option key={m} value={m}>{labels[m]}</option>)}</select></label>
     <div className="fieldset-like"><span className="legend-like">Blocos da visão geral</span>
      {overviewBlocks.map(b => <label className="check" key={b}><input type="checkbox" checked={settings.overview.blocks.includes(b)} onChange={e => patch({ overview: { blocks: e.target.checked ? overviewBlocks.filter(x => x === b || settings.overview.blocks.includes(x)) : settings.overview.blocks.filter(x => x !== b) } })} />{blockLabels[b]}</label>)}
     </div>
     {live && <label>Categorias sugeridas no cadastro (separe por vírgula)<input value={settings.catalog.suggestedCategories.join(', ')} onChange={e => patch({ catalog: { suggestedCategories: e.target.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 30) } })} /></label>}
    </fieldset>
    {error && <p className="error" role="alert">{error}</p>}
    {(canIdentity || canAppearance) && <div className="form-actions"><button className="primary" onClick={save} disabled={saving || uploading}>{saving ? 'Salvando…' : 'Salvar personalização'}</button><button onClick={cancel} disabled={!dirty || saving}>Descartar prévia</button></div>}
   </section>

   {live && preferences && onPreferences && <section className="panel theme-controls" aria-labelledby="personal-title">
    <h2 id="personal-title">Preferências pessoais</h2>
    <p className="form-help">Só para você, em qualquer empresa. Não altera a aparência padrão da empresa.</p>
    <div className="form-grid">
     <label>Minha aparência<select value={preferences.mode} onChange={e => onPreferences({ ...preferences, mode: e.target.value as UserPreferences['mode'] })}><option value="organization">Padrão da empresa</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label>
     <label>Minha densidade<select value={preferences.density} onChange={e => onPreferences({ ...preferences, density: e.target.value as UserPreferences['density'] })}><option value="organization">Padrão da empresa</option><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></label>
    </div>
   </section>}
   {resetPanel}
  </div>
  <aside className="theme-preview"><p className="eyebrow">PRÉVIA AO VIVO</p><div className="preview-brand">{shownLogo ? <img src={shownLogo} alt="Logotipo em prévia" /> : <Mark small />}<h2>{settings.identity.displayName}</h2></div><p>Seu comércio. Sua identidade.<br />A mesma base Vapt-Vupt.</p><div className="preview-row"><span>Arroz branco · 5 kg</span><span className="status warning">Repor</span></div><button className="primary" disabled>Exemplo de botão</button><p className="fine">Paletas controladas. Nenhum CSS ou script arbitrário é aceito.</p></aside>
 </div>;
}
