import { ThemeSchema, ProductSchema, type Theme, type Product } from '../../packages/domain';
export type DemoMovement = { id:string; product:string; kind:string; quantity:number; at:string; reason:string };
export type Business = { id:string; segment:string; theme:Theme; products:Product[]; movements:DemoMovement[] };
const product = (id:number,name:string,sku:string,quantity:number,minimum:number,category:string,unit:Product['unit']='un'):Product => ({ id:'00000000-0000-4000-8000-'+String(id).padStart(12,'0'),name,sku,quantity,minimum,category,unit });
export function initialBusinesses():Business[] { return [
 {id:'mercado',segment:'Mercado',theme:{version:1,name:'Mercado Aurora',accent:'forest',mode:'light',density:'comfortable',font:'humanist',modules:['overview','inventory','products','movements','purchases','quotes','team']},products:[
 product(1,'Arroz branco · 5 kg','AUR-001',8,20,'Mercearia'), product(2,'Café torrado · 500 g','AUR-002',6,12,'Mercearia'), product(3,'Leite integral · 1 L','AUR-003',36,24,'Laticínios'), product(4,'Óleo de soja · 900 ml','AUR-004',18,12,'Mercearia'),product(5,'Feijão carioca · 1 kg','AUR-005',4,15,'Mercearia'),product(6,'Detergente neutro · 500 ml','AUR-006',42,10,'Limpeza')],movements:[]},
 {id:'adega',segment:'Adega',theme:{version:1,name:'Adega Vértice',accent:'wine',mode:'dark',density:'comfortable',font:'humanist',modules:['overview','inventory','products','movements','quotes']},products:[product(11,'Vinho tinto seco · 750 ml','VER-001',5,12,'Vinhos'),product(12,'Cerveja pilsen · caixa 12','VER-002',24,10,'Cervejas','cx'),product(13,'Água com gás · 500 ml','VER-003',8,20,'Sem álcool'),product(14,'Suco de uva · 1 L','VER-004',16,8,'Sem álcool')],movements:[]},
 {id:'bar',segment:'Bar e cozinha',theme:{version:1,name:'Bar da Esquina',accent:'copper',mode:'light',density:'compact',font:'system',modules:['overview','inventory','products','movements','purchases']},products:[product(21,'Água tônica · 350 ml','ESQ-001',6,18,'Bebidas'),product(22,'Arroz branco · 1 kg','ESQ-002',20,12,'Cozinha'),product(23,'Guardanapo · pacote','ESQ-003',3,10,'Descartáveis'),product(24,'Óleo de soja · 900 ml','ESQ-004',12,6,'Cozinha')],movements:[]}
 ]; }
const key='vv-next-demo-v1';
export function loadDemo():Business[] {
 try {
  const raw=localStorage.getItem(key); if(!raw) return initialBusinesses();
  const data:unknown=JSON.parse(raw);
  if(!Array.isArray(data) || data.length>10) return initialBusinesses();
  return data.map((b:Business)=>({
   id:typeof b.id==='string' ? b.id : '', segment:typeof b.segment==='string' ? b.segment.slice(0,40):'Comércio',
   theme:ThemeSchema.parse(b.theme), products:ProductSchema.array().max(1000).parse(b.products),
   movements:[] // The demonstration ledger lasts only this session; no audit guarantee.
  }));
 } catch {return initialBusinesses();}
}
export function saveDemo(businesses:Business[]) {
 // Browser-only preferences and fictional data. Never credentials or authorization.
 localStorage.setItem(key,JSON.stringify(businesses.map(b=>({...b,movements:[]}))));
}
