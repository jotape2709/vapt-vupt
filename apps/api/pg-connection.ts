/**
 * Conexão com o PostgreSQL a partir de uma URL SEM senha e da senha numa variável separada.
 *
 * Senhas geradas aleatoriamente podem conter caracteres reservados de URL (/ @ : % ? # …). Colocadas
 * cruas em postgresql://usuario:senha@host, quebram a URL ("Invalid URL") ou mudam o host/usuário.
 * Aqui a senha é codificada (encodeURIComponent) antes de entrar na URL, e o driver a decodifica de
 * volta para o valor original. Nunca registre o resultado: ele contém a senha.
 *
 *   DATABASE_URL=postgresql://vv_runtime@postgres:5432/vapt_vupt  +  DATABASE_PASSWORD=<segredo>
 *
 * Sem a variável de senha, a URL é usada como está (compatível com o desenvolvimento local).
 */
export function connectionString(url: string, password: string | undefined, names: { url: string; password: string }): string {
 let parsed: URL;
 try { parsed = new URL(url); } catch { throw new Error(`${names.url} não é uma URL válida. Coloque a senha em ${names.password}, não na URL.`); }
 if (!/^postgres(ql)?:$/.test(parsed.protocol)) throw new Error(`${names.url} deve começar com postgresql://`);
 if (password === undefined || password === '') return url;
 if (parsed.password) throw new Error(`${names.url} já contém senha; defina-a só em ${names.password}.`);
 if (!parsed.username) throw new Error(`${names.url} precisa do usuário (postgresql://usuario@host/banco).`);
 parsed.password = encodeURIComponent(password);
 return parsed.toString();
}

/** Lê {PREFIXO}_URL e {PREFIXO}_PASSWORD do ambiente (ex.: MIGRATION_DATABASE). */
export function connectionFromEnv(prefix: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
 const url = env[`${prefix}_URL`];
 return url ? connectionString(url, env[`${prefix}_PASSWORD`], { url: `${prefix}_URL`, password: `${prefix}_PASSWORD` }) : undefined;
}
