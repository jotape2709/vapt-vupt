import { useMemo, useRef, useState } from 'react';
import { segmentLabels } from '../../packages/domain/contracts';
import { Dialog, Icon } from './components';
import { DemoGateway } from './data/demoGateway';
import { clearDemo, initialBusinesses, loadDemo, MAX_BUSINESSES, saveDemo, type Business } from './demo';
import { ConfirmReset, Onboarding } from './forms';
import type { Copy } from './pages';
import { navigate } from './router';
import { segmentFromLabel } from './theme';
import { Workspace, type Notice } from './Workspace';

const planned: Record<string, { title: string; text: string }> = {
 purchases: { title: 'Compras com contexto', text: 'O fluxo de pedidos e fornecedores será conectado ao estoque. Ainda não é possível enviar ou confirmar compras.' },
 quotes: { title: 'Cotações sem adivinhação', text: 'Não há fornecedores conectados. Nenhuma solicitação será enviada nesta demonstração.' },
 team: { title: 'Cada pessoa, o acesso certo', text: 'Na demonstração não há contas nem permissões: a troca de empresa não representa autorização. Na operação real, funções são definidas no servidor.' }
};

const copy: Copy = {
 movementsMetric: 'Demonstração neste navegador',
 stockFoot: 'Saldos demonstrativos. Quantidades inteiras nesta primeira versão.',
 productsFoot: 'Catálogo demonstrativo desta empresa. Código interno único por empresa.',
 historyFoot: 'Histórico demonstrativo salvo apenas neste navegador (últimos 200 registros). Não é registro de auditoria comercial.',
 dailyNote: 'Conferiu a entrega? Registre a entrada para manter os saldos da demonstração em dia.'
};

const demoPermissions = ['catalog.read', 'stock.read', 'history.read', 'settings.read', 'stock.move', 'product.create', 'settings.appearance', 'settings.identity', 'logo.upload'] as const;
const demoPreferences = { mode: 'organization', density: 'organization' } as const;

/**
 * Sandbox pública: empresas fictícias no navegador, separada da operação real.
 * Nada daqui é importado para organizações reais.
 */
export function DemoApp() {
 const [businesses, setBusinesses] = useState(loadDemo);
 const current = useRef(businesses);
 current.current = businesses;
 const [active, setActive] = useState('mercado');
 const [generation, setGeneration] = useState(0);
 const [notice, setNotice] = useState<Notice | null>(null);
 const [modal, setModal] = useState<'onboarding' | 'reset' | null>(null);
 const [storageOk, setStorageOk] = useState(true);

 const b = businesses.find(x => x.id === active) ?? businesses[0] ?? initialBusinesses()[0];

 /** Salva no navegador; devolve false (e a tela avisa) quando o navegador não permite. */
 const persistAll = (next: Business[]) => {
  current.current = next;
  setBusinesses(next);
  try { saveDemo(next); setStorageOk(true); return true; } catch { setStorageOk(false); return false; }
 };

 const gateway = useMemo(
  () => new DemoGateway(b, updated => persistAll(current.current.map(x => (x.id === updated.id ? updated : x)))),
  // Uma instância por empresa e por restauração; o estado interno acompanha as gravações.
  [b.id, generation]);
 const envelope = gateway.envelope();

 const toggleMode = () => {
  const s = envelope.settings;
  void gateway.saveSettings(envelope.version, { ...s, appearance: { ...s.appearance, mode: s.appearance.mode === 'light' ? 'dark' : 'light' } }).catch(() => undefined);
 };

 return <>
  <Workspace key={b.id + ':' + generation}
   gateway={gateway} envelope={envelope} onEnvelope={() => undefined}
   unitName="Unidade principal" segmentLabel={segmentLabels[segmentFromLabel(b.segment)]}
   permissions={demoPermissions} preferences={demoPreferences} toggleMode={toggleMode}
   notice={notice} setNotice={setNotice} planned={planned} copy={copy}
   onBrand={() => navigate('/')}
   pill="DEMONSTRAÇÃO"
   footer={['Vapt-Vupt · demonstração', 'Sandbox fictícia, separada da operação real.']}
   banner={<div className="demo-banner"><span>{storageOk ? 'Empresa fictícia · dados de demonstração salvos só neste navegador.' : 'Empresa fictícia · o navegador não permite salvar: as alterações valem só nesta aba.'}</span><span>Nada é enviado a servidor ou a terceiros.</span></div>}
   orgSwitcher={<label>EMPRESA DEMONSTRATIVA
    <select aria-label="Selecionar empresa demonstrativa" value={b.id} onChange={e => {
     const next = businesses.find(x => x.id === e.target.value);
     setActive(e.target.value);
     if (next) setNotice({ text: `Você está vendo ${next.theme.name}, uma empresa fictícia. Catálogo, saldos e histórico são só desta empresa.` });
    }}>{businesses.map(x => <option value={x.id} key={x.id}>{x.theme.name}</option>)}</select>
   </label>}
   sidebarExtras={<button onClick={() => setModal('onboarding')}><Icon name="plus" />Criar empresa demo</button>}
   userStrip={<div className="user-strip"><span className="avatar mini" aria-hidden="true">D</span><div>Perfil demonstrativo<small>Sem autenticação · <a href="/app" onClick={e => { e.preventDefault(); navigate('/app'); }}>Entrar na operação real</a></small></div></div>}
   resetPanel={<section className="panel theme-controls reset-panel">
    <h2>Dados da demonstração</h2>
    <p className="form-help">Volta as três empresas de exemplo ao estado inicial e apaga produtos, saldos, histórico e personalizações guardados neste navegador.</p>
    <button onClick={() => setModal('reset')}>Restaurar dados de exemplo</button>
   </section>}
  />

  {modal === 'onboarding' && <Dialog title="Seu negócio, do seu jeito" description="Crie uma empresa fictícia neste navegador. Isso não cria uma conta comercial." close={() => setModal(null)}>
   <Onboarding submit={(name, segment) => {
    if (businesses.length >= MAX_BUSINESSES) { setModal(null); setNotice({ tone: 'error', text: `Limite de ${MAX_BUSINESSES} empresas demonstrativas neste navegador.` }); return; }
    const template = initialBusinesses()[segment] ?? initialBusinesses()[0];
    const id = crypto.randomUUID();
    const saved = persistAll([...businesses, { ...template, id, theme: { ...template.theme, name }, products: [], movements: [] }]);
    setActive(id); setModal(null);
    setNotice(saved
     ? { tone: 'success', text: `${name} criada como empresa fictícia, sem produtos.` }
     : { tone: 'error', text: `${name} criada só nesta aba: o navegador não permitiu salvar e ela some ao recarregar.` });
   }} />
  </Dialog>}

  {modal === 'reset' && <Dialog title="Restaurar dados de exemplo?" description="As três empresas voltam ao estado inicial. Produtos, saldos, histórico, personalizações e empresas criadas neste navegador serão apagados." close={() => setModal(null)}>
   <ConfirmReset cancel={() => setModal(null)} confirm={() => {
    let cleared = true;
    try { clearDemo(); } catch { cleared = false; }
    const fresh = initialBusinesses();
    current.current = fresh;
    setBusinesses(fresh); setActive('mercado'); setGeneration(g => g + 1); setModal(null);
    setNotice(cleared
     ? { tone: 'success', text: 'Dados de exemplo restaurados.' }
     : { tone: 'error', text: 'Dados de exemplo restaurados nesta aba, mas o navegador não permitiu apagar o que estava salvo: ao recarregar, os dados anteriores podem voltar.' });
   }} />
  </Dialog>}
 </>;
}
