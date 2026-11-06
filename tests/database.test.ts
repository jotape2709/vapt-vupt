import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { Repository } from '../apps/api/repository';
const adminUrl=process.env.TEST_ADMIN_DATABASE_URL;
test('PostgreSQL: isolamento real, autorização, idempotência, concorrência e rollback',{skip:!adminUrl},async()=>{
 const admin=new Pool({connectionString:adminUrl});
 let runtime:Pool|undefined;
 const orgA='10000000-0000-4000-8000-000000000001',orgB='10000000-0000-4000-8000-000000000002',product='10000000-0000-4000-8000-000000000003';
 const identity={subject:'alice',issuer:'test-issuer'};
 try{
  // Only a disposable test database. No committed account credentials.
  await admin.query("CREATE ROLE vv_test_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS");
  await admin.query('GRANT USAGE ON SCHEMA public TO vv_test_runtime');
  await admin.query('GRANT SELECT ON organizations,memberships,units,products,inventory_events TO vv_test_runtime');
  await admin.query('GRANT UPDATE(theme) ON organizations TO vv_test_runtime');
  await admin.query('GRANT INSERT,UPDATE ON products TO vv_test_runtime');
  await admin.query('GRANT INSERT ON inventory_events,audit_log TO vv_test_runtime');
  await admin.query('GRANT USAGE,SELECT ON SEQUENCE audit_log_id_seq TO vv_test_runtime');
  await admin.query("INSERT INTO organizations(id,name) VALUES($1,'Test A'),($2,'Test B')",[orgA,orgB]);
  await admin.query("INSERT INTO memberships(organization_id,subject,issuer,role) VALUES($1,'alice','test-issuer','operator'),($1,'reader','test-issuer','viewer')",[orgA]);
  await admin.query("INSERT INTO products(organization_id,id,name,sku,unit,minimum,quantity,category) VALUES($1,$3,'Produto A','SKU','un',1,10,'Demo'),($2,$3,'Produto B','SKU','un',1,99,'Demo')",[orgA,orgB,product]);
  runtime=new Pool({connectionString:adminUrl,options:'-c role=vv_test_runtime',max:4});
  const r=new Repository(runtime);
  const roles=await runtime.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
  assert.equal(roles.rows[0].rolsuper,false);assert.equal(roles.rows[0].rolbypassrls,false);
  assert.equal((await runtime.query('SELECT * FROM products')).rows.length,0);
  assert.equal((await r.products(identity,orgA))[0].quantity,10);
  await assert.rejects(()=>r.products(identity,orgB),{statusCode:403});
  const m={eventId:'10000000-0000-4000-8000-000000000004',productId:product,kind:'issue' as const,quantity:3,expectedVersion:0,reason:'Teste'};
  await assert.rejects(()=>r.move({subject:'reader',issuer:'test-issuer'},orgA,m),{statusCode:403});
  const [first,replay]=await Promise.all([r.move(identity,orgA,m),r.move(identity,orgA,m)]);
  assert.equal(first.quantity,7);assert.equal(replay.quantity,7);
  assert.equal((await r.products(identity,orgA))[0].quantity,7);
  await assert.rejects(()=>r.move(identity,orgA,{...m,quantity:2}),{statusCode:409});
  await assert.rejects(()=>r.move(identity,orgA,{...m,eventId:'10000000-0000-4000-8000-000000000005'}),{statusCode:409});
  await assert.rejects(()=>r.move(identity,orgA,{...m,eventId:'10000000-0000-4000-8000-000000000006',expectedVersion:1,quantity:20}),{statusCode:409});
  assert.equal((await r.products(identity,orgA))[0].quantity,7);
  assert.equal((await admin.query('SELECT quantity FROM products WHERE organization_id=$1',[orgB])).rows[0].quantity,99);
  assert.equal((await runtime.query('SELECT * FROM products')).rows.length,0);
 }finally{await runtime?.end();await admin.end();}
});
