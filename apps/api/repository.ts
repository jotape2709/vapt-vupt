import { Pool, type PoolClient } from 'pg';
import { may, type Product, type MovementInput, type Role, type Theme } from '../../packages/domain';
export class AccessError extends Error { constructor(public statusCode:number,message:string){super(message);} }
export type Identity = { subject:string; issuer:string };
export class Repository {
 constructor(readonly pool:Pool){}
 async tenant<T>(identity:Identity,orgId:string,action:'read'|'move'|'configure',fn:(db:PoolClient)=>Promise<T>):Promise<T>{
  const db=await this.pool.connect();
  try{
   await db.query('BEGIN');
   await db.query("SELECT set_config('app.org_id', $1, true)",[orgId]);
   const member=await db.query<{role:Role}>('SELECT role FROM memberships WHERE organization_id=$1 AND subject=$2 AND issuer=$3',[orgId,identity.subject,identity.issuer]);
   if(!member.rows[0]||!may(member.rows[0].role,action))throw new AccessError(403,'Acesso não permitido.');
   const result=await fn(db);await db.query('COMMIT');return result;
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 async products(identity:Identity,org:string){
  return this.tenant(identity,org,'read',async db=>(await db.query('SELECT id,name,sku,unit,minimum,quantity,category,version FROM products WHERE organization_id=$1 ORDER BY name LIMIT 1000',[org])).rows);
 }
 async createProduct(identity:Identity,org:string,p:Product){
  if(p.quantity!==0)throw new AccessError(400,'Cadastre com saldo zero e registre uma entrada.');
  return this.tenant(identity,org,'configure',async db=>{
   const result=await db.query('INSERT INTO products(organization_id,id,name,sku,unit,minimum,quantity,category) VALUES($1,$2,$3,$4,$5,$6,0,$7) RETURNING *',[org,p.id,p.name,p.sku,p.unit,p.minimum,p.category]);
   await db.query('INSERT INTO audit_log(organization_id,subject,action,entity_id) VALUES($1,$2,$3,$4)',[org,identity.subject,'product.created',p.id]);return result.rows[0];
  });
 }
 async configure(identity:Identity,org:string,theme:Theme){
  return this.tenant(identity,org,'configure',async db=>{
   const result=await db.query('UPDATE organizations SET theme=$2::jsonb WHERE id=$1 RETURNING id,theme',[org,JSON.stringify(theme)]);
   await db.query('INSERT INTO audit_log(organization_id,subject,action,entity_id) VALUES($1,$2,$3,$1)',[org,identity.subject,'theme.updated']);return result.rows[0];
  });
 }
 async move(identity:Identity,org:string,m:MovementInput){
  return this.tenant(identity,org,'move',async db=>{
   // Serialize an event across requests before checking idempotency.
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[org+':'+m.eventId]);
   const prior=await db.query('SELECT payload,result FROM inventory_events WHERE organization_id=$1 AND id=$2',[org,m.eventId]);
   const payload=JSON.stringify(m);
   if(prior.rows[0]){
    const old=prior.rows[0].payload;
    if(Object.keys(m).some(k=>old[k]!==m[k as keyof MovementInput]))throw new AccessError(409,'Identificador já utilizado com outro conteúdo.');
    return {...prior.rows[0].result,replayed:true};
   }
   const row=await db.query('SELECT quantity,version FROM products WHERE organization_id=$1 AND id=$2 FOR UPDATE',[org,m.productId]);
   if(!row.rows[0])throw new AccessError(404,'Produto não encontrado.');
   const p=row.rows[0];
   if(p.version!==m.expectedVersion)throw new AccessError(409,'Saldo alterado. Recarregue e confira antes de reenviar.');
   const delta=m.kind==='receipt'?m.quantity:-m.quantity;
   const balance=p.quantity+delta;
   if(balance<0||balance>1000000)throw new AccessError(409,'Saldo fora dos limites permitidos.');
   await db.query('UPDATE products SET quantity=$3,version=version+1 WHERE organization_id=$1 AND id=$2',[org,m.productId,balance]);
   const result={eventId:m.eventId,quantity:balance,version:p.version+1,status:'confirmed'};
   await db.query('INSERT INTO inventory_events(organization_id,id,product_id,payload,result,subject) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6)',[org,m.eventId,m.productId,payload,JSON.stringify(result),identity.subject]);
   await db.query('INSERT INTO audit_log(organization_id,subject,action,entity_id) VALUES($1,$2,$3,$4)',[org,identity.subject,'inventory.'+m.kind,m.eventId]);
   return result;
  });
 }
}
