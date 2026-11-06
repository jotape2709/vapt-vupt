import { Pool } from 'pg';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { buildApi } from './app';
import { Repository } from './repository';
const required=(key:string)=>{const value=process.env[key];if(!value)throw new Error('Configuração obrigatória: '+key);return value;};
const issuer=required('OIDC_ISSUER'),audience=required('OIDC_AUDIENCE');
const jwksUrl=new URL(required('OIDC_JWKS_URL'));
if(jwksUrl.protocol!=='https:')throw new Error('JWKS exige HTTPS.');
const jwks=createRemoteJWKSet(jwksUrl);
const pool=new Pool({connectionString:required('DATABASE_URL'),max:10});
const api=buildApi(new Repository(pool),async token=>{
 const {payload}=await jwtVerify(token,jwks,{issuer,audience,algorithms:['RS256','ES256'],requiredClaims:['sub','iss','aud','exp','iat'],maxTokenAge:'15m'});
 if(!payload.sub||payload.sub.length>255)throw new Error('Identidade inválida');
 return {subject:payload.sub,issuer};
});
api.addHook('onClose',async()=>{await pool.end();});
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{void api.close();});
await api.listen({host:process.env.API_HOST||'127.0.0.1',port:Number(process.env.PORT||3001)});
