import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApi } from '../apps/api/app';
import { AccessError } from '../apps/api/repository';
const org='00000000-0000-4000-8000-000000000001';
const repo={products:async(_identity:unknown,id:string)=>{if(id!==org)throw new AccessError(403,'Acesso não permitido.');return[];},createProduct:async()=>null,configure:async()=>null,move:async()=>null};
test('API exige credencial e valida antes de executar',async()=>{
 const api=buildApi(repo,async token=>{if(token!=='test-only')throw new Error('invalid');return {subject:'test',issuer:'test'};});
 try{
  assert.equal((await api.inject({url:'/api/organizations/'+org+'/products'})).statusCode,401);
  assert.equal((await api.inject({url:'/api/organizations/'+org+'/products',headers:{authorization:'Bearer invalid'}})).statusCode,401);
  assert.equal((await api.inject({url:'/api/organizations/'+org+'/products',headers:{authorization:'Bearer test-only'}})).statusCode,200);
  assert.equal((await api.inject({url:'/api/organizations/00000000-0000-4000-8000-000000000002/products',headers:{authorization:'Bearer test-only'}})).statusCode,403);
  assert.equal((await api.inject({url:'/api/organizations/not-uuid/products',headers:{authorization:'Bearer test-only'}})).statusCode,400);
  assert.equal((await api.inject({method:'POST',url:'/api/organizations/'+org+'/movements',headers:{authorization:'Bearer test-only'},payload:{quantity:-1}})).statusCode,400);
 }finally{await api.close();}
});
