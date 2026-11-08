import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "oidc-client-ts";
import { may, ProductSchema, type MovementInput } from "../../packages/domain";
import {
  api,
  ApiError,
  type Organization,
  type StockProduct,
  type StockRecord,
} from "./api-client";
import {
  authConfigured,
  endLocalSession,
  finishSignIn,
  identityClient,
  startSignIn,
} from "./auth";
import { Dialog, Icon, Mark } from "./components";
import { savePending, readPending, clearPending } from "./pending-operation";

export function ConnectedApp({ back }: { back: () => void }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]),
    [active, setActive] = useState("");
  const [products, setProducts] = useState<StockProduct[]>([]),
    [records, setRecords] = useState<StockRecord[]>([]);
  const [page, setPage] = useState<"inventory" | "movements">("inventory"),
    [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"movement" | "product" | null>(null);
  const [pending, setPending] = useState<{
    org: string;
    event: MovementInput;
  } | null>(null);
  const generation = useRef(0);
  const org = organizations.find((o) => o.id === active);

  useEffect(() => {
    if (!authConfigured) {
      setReady(true);
      return;
    }
    let cancelled = false;
    const client = identityClient();
    const expired = () => {
      setUser(null);
      setProducts([]);
      setRecords([]);
      setOrganizations([]);
      setError("Sua sessão terminou. Entre novamente.");
    };
    client.events.addAccessTokenExpired(expired);
    void (async () => {
      try {
        const current =
          window.location.pathname === "/auth/callback"
            ? await finishSignIn()
            : await client.getUser();
        if (cancelled) return;
        if (current && !current.expired) {
          setUser(current);
          const items = await api.organizations();
          if (!cancelled) {
            setOrganizations(items);
            const receipt = readPending(
              sessionStorage,
              current.profile.iss,
              current.profile.sub,
            );
            setPending(receipt);
            setActive(
              receipt && items.some((o) => o.id === receipt.org)
                ? receipt.org
                : items[0]?.id || "",
            );
          }
        }
      } catch {
        if (!cancelled)
          setError(
            "Não foi possível concluir o acesso. Tente entrar novamente.",
          );
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      client.events.removeAccessTokenExpired(expired);
    };
  }, []);

  useEffect(() => {
    const id = ++generation.current;
    setProducts([]);
    setRecords([]);
    setQuery("");
    setNotice("");
    if (!active || !user) return;
    setLoading(true);
    setError("");
    void Promise.all([api.products(active), api.movements(active)])
      .then(([p, r]) => {
        if (id === generation.current) {
          setProducts(p);
          setRecords(r);
        }
      })
      .catch(() => {
        if (id === generation.current)
          setError(
            "Não foi possível carregar os dados desta empresa. Tente atualizar.",
          );
      })
      .finally(() => {
        if (id === generation.current) setLoading(false);
      });
    return () => {
      generation.current++;
    };
  }, [active, user]);

  async function refresh() {
    if (!org || busy) return;
    setLoading(true);
    setError("");
    setProducts([]);
    setRecords([]);
    try {
      const [p, r] = await Promise.all([
        api.products(org.id),
        api.movements(org.id),
      ]);
      setProducts(p);
      setRecords(r);
    } catch {
      setError("Não foi possível atualizar os dados.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMovement(event: MovementInput) {
    if (!org || busy || !user) return;
    const operation = pending || { org: org.id, event };
    if (operation.org !== org.id) {
      setError(
        "Esta pendência pertence a outra empresa. Peça apoio ao responsável.",
      );
      return;
    }
    try {
      savePending(
        sessionStorage,
        user.profile.iss,
        user.profile.sub,
        operation,
      );
    } catch {
      setError(
        "Não foi possível guardar o recibo. Nenhuma operação foi enviada.",
      );
      return;
    }
    setPending(operation);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.move(operation.org, operation.event);
      setProducts((items) =>
        items.map((p) =>
          p.id === operation.event.productId
            ? { ...p, quantity: result.quantity, version: result.version }
            : p,
        ),
      );
      clearPending(sessionStorage, user.profile.iss, user.profile.sub);
      setPending(null);
      setModal(null);
      setNotice("Movimentação confirmada pelo servidor.");
      // A read failure after commit must never imply that the write failed.
      try {
        setRecords(await api.movements(operation.org));
      } catch {
        setNotice(
          "Movimentação confirmada. Atualize para carregar o histórico.",
        );
      }
    } catch (e) {
      if (e instanceof ApiError && [400, 403, 404, 409].includes(e.status)) {
        clearPending(sessionStorage, user.profile.iss, user.profile.sub);
        setPending(null);
        setError(
          e.status === 409
            ? "O saldo ou registro mudou. Atualize os dados e confira antes de tentar novamente."
            : e.message,
        );
      } else {
        setModal(null);
        setError(
          "A confirmação não chegou. Use “Verificar confirmação” para consultar o mesmo evento, sem duplicar o registro.",
        );
      }
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setOrganizations([]);
        setProducts([]);
        setRecords([]);
        setError("Entre novamente para verificar a movimentação pendente.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!ready)
    return (
      <div className="access-page">
        <Mark />
        <p role="status">Conferindo seu acesso…</p>
      </div>
    );
  if (!user)
    return (
      <main className="access-page">
        <Mark />
        <p className="eyebrow">ACESSO DA EMPRESA</p>
        <h1>
          Seu comércio,
          <br />
          em um só lugar.
        </h1>
        <p>
          {authConfigured
            ? "Entre pelo acesso seguro da sua empresa."
            : "O acesso conectado ainda está sendo preparado nesta instalação. Você já pode explorar a demonstração."}
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {authConfigured && (
          <button
            className="primary large"
            onClick={() => {
              setError("");
              void startSignIn().catch(() =>
                setError("Não foi possível abrir o acesso. Tente novamente."),
              );
            }}
          >
            Entrar com segurança <Icon name="arrow" />
          </button>
        )}
        <button onClick={back}>Voltar ao site</button>
      </main>
    );

  return (
    <div
      className={
        "workspace connected " +
        (org?.theme.mode || "light") +
        " " +
        (org?.theme.density || "comfortable")
      }
      data-accent={org?.theme.accent || "blue"}
    >
      <a className="skip" href="#connected-content">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Mark />
        <div className="business-box">
          <label>
            SUA EMPRESA
            <select
              aria-label="Selecionar empresa autorizada"
              disabled={busy || Boolean(pending) || loading}
              value={active}
              onChange={(e) => setActive(e.target.value)}
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav aria-label="Operação conectada">
          <button
            className={page === "inventory" ? "selected" : ""}
            onClick={() => setPage("inventory")}
          >
            <Icon name="inventory" />
            Estoque
          </button>
          <button
            className={page === "movements" ? "selected" : ""}
            onClick={() => setPage("movements")}
          >
            <Icon name="movements" />
            Movimentações
          </button>
        </nav>
        <div className="sidebar-bottom">
          <p className="form-help">
            Acesso:{" "}
            {org?.role === "viewer"
              ? "Consulta"
              : org?.role === "operator"
                ? "Operação"
                : "Gestão"}
          </p>
          <button
            disabled={busy}
            onClick={() => {
              void endLocalSession().then(() => {
                setUser(null);
                setProducts([]);
                setRecords([]);
                setOrganizations([]);
              });
            }}
          >
            Encerrar sessão no aplicativo
          </button>
        </div>
      </aside>
      <div className="work-area">
        <header className="topbar">
          <span>{org?.name || "Suas empresas"}</span>
          <span className="status">Área conectada</span>
        </header>
        <main
          id="connected-content"
          className="connected-content"
          tabIndex={-1}
        >
          <header className="page-heading">
            <div>
              <p className="eyebrow">
                OPERAÇÃO / {page === "inventory" ? "ESTOQUE" : "REGISTROS"}
              </p>
              <h1>
                {page === "inventory"
                  ? "O estoque da sua empresa."
                  : "Cada movimentação, registrada."}
              </h1>
              <p>Informações recebidas do servidor da instalação.</p>
            </div>
            <button
              disabled={!org || loading || busy}
              onClick={() => void refresh()}
            >
              Atualizar dados
            </button>
          </header>
          {!organizations.length && (
            <div className="panel empty">
              <h2>Nenhuma empresa vinculada</h2>
              <p>
                Peça ao responsável pela instalação para vincular seu acesso a
                uma empresa.
              </p>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {pending && (
            <div className="notice" role="status">
              <span>
                {busy
                  ? "Aguardando confirmação do servidor…"
                  : "Existe uma movimentação sem confirmação. O recibo será preservado nesta aba até a verificação."}
              </span>
              <button
                disabled={busy}
                onClick={() => void sendMovement(pending.event)}
              >
                Verificar confirmação
              </button>
            </div>
          )}
          {org && (
            <>
              <div className="connected-actions">
                {may(org.role, "move") && (
                  <button
                    className="primary"
                    disabled={loading || busy || Boolean(pending)}
                    onClick={() => {
                      setError("");
                      setModal("movement");
                    }}
                  >
                    <Icon name="plus" />
                    Registrar movimentação
                  </button>
                )}
                {may(org.role, "configure") && (
                  <button
                    disabled={loading || busy || Boolean(pending)}
                    onClick={() => {
                      setError("");
                      setModal("product");
                    }}
                  >
                    Novo produto
                  </button>
                )}
              </div>
              {loading ? (
                <p role="status">Carregando informações…</p>
              ) : page === "inventory" ? (
                <section className="panel">
                  <label className="search">
                    <Icon name="search" />
                    <span className="sr-only">Buscar produto conectado</span>
                    <input
                      placeholder="Buscar produto ou código"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <div className="table-scroll">
                    <table>
                      <caption className="sr-only">
                        Estoque de {org.name}
                      </caption>
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Saldo</th>
                          <th>Mínimo</th>
                          <th>Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products
                          .filter((p) =>
                            (p.name + " " + p.sku)
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                          )
                          .map((p) => (
                            <tr key={p.id}>
                              <td>
                                <strong>{p.name}</strong>
                                <small>{p.sku}</small>
                              </td>
                              <td>
                                {p.quantity} {p.unit}
                              </td>
                              <td>
                                {p.minimum} {p.unit}
                              </td>
                              <td>
                                <span
                                  className={
                                    "status " +
                                    (p.quantity < p.minimum ? "warning" : "ok")
                                  }
                                >
                                  {p.quantity < p.minimum
                                    ? "Repor"
                                    : "Suficiente"}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!products.length && (
                    <p className="empty">Nenhum produto carregado.</p>
                  )}
                  <div className="panel-foot">
                    Até 1.000 produtos nesta versão. Recarregue os dados antes
                    de iniciar uma nova operação.
                  </div>
                </section>
              ) : (
                <section className="panel">
                  <div className="movement-list">
                    {records.map((r) => (
                      <article key={r.id}>
                        <span className="movement-sign">
                          {r.kind === "receipt" ? "+" : "−"}
                        </span>
                        <div className="grow">
                          <strong>{r.product}</strong>
                          <small>
                            {r.reason} ·{" "}
                            {new Date(r.at).toLocaleString("pt-BR")}
                          </small>
                        </div>
                        <strong>{r.quantity}</strong>
                        <span className="status">Confirmada</span>
                      </article>
                    ))}
                  </div>
                  {!records.length && (
                    <p className="empty">Nenhuma movimentação carregada.</p>
                  )}
                  <div className="panel-foot">
                    Últimos 100 registros persistidos no servidor.
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
      {modal === "movement" && org && (
        <Dialog
          title="Registrar movimentação"
          close={() => {
            if (!busy) setModal(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget),
                product = products.find((p) => p.id === d.get("product"));
              if (!product) return;
              void sendMovement({
                eventId: crypto.randomUUID(),
                productId: product.id,
                expectedVersion: product.version,
                kind: d.get("kind") === "issue" ? "issue" : "receipt",
                quantity: Number(d.get("quantity")),
                reason: String(d.get("reason")),
              });
            }}
          >
            <fieldset
              disabled={busy || Boolean(pending)}
              className="form-fields"
            >
              <label>
                Produto
                <select name="product" aria-label="Produto" required>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · saldo {p.quantity} {p.unit}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Operação
                <select name="kind" aria-label="Operação">
                  <option value="receipt">Entrada</option>
                  <option value="issue">Saída</option>
                </select>
              </label>
              <label>
                Quantidade
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  max="1000000"
                  step="1"
                  required
                />
              </label>
              <label>
                Motivo
                <input name="reason" minLength={3} maxLength={160} required />
              </label>
              <button className="primary" disabled={!products.length}>
                Confirmar movimentação
              </button>
            </fieldset>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <p className="form-help">
              Só a resposta do servidor confirma o registro. Fechar esta janela
              não cancela um envio em andamento.
            </p>
          </form>
        </Dialog>
      )}
      {modal === "product" && org && (
        <Dialog
          title="Novo produto"
          close={() => {
            if (!busy) setModal(null);
          }}
        >
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              const parsed = ProductSchema.safeParse({
                id: crypto.randomUUID(),
                name: d.get("name"),
                sku: d.get("sku"),
                category: d.get("category"),
                unit: d.get("unit"),
                quantity: 0,
                minimum: Number(d.get("minimum")),
              });
              if (!parsed.success) {
                setError("Confira os campos do produto.");
                return;
              }
              setBusy(true);
              setError("");
              void api
                .createProduct(org.id, parsed.data)
                .then((p) => {
                  setProducts((items) => [...items, p]);
                  setModal(null);
                  setNotice("Produto cadastrado no servidor.");
                })
                .catch((e) =>
                  setError(
                    e instanceof ApiError
                      ? e.message
                      : "O cadastro não foi confirmado. Atualize o catálogo antes de tentar novamente.",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            <fieldset disabled={busy} className="form-fields">
              <label>
                Nome do produto
                <input name="name" minLength={2} maxLength={120} required />
              </label>
              <label>
                Código interno
                <input name="sku" maxLength={40} required />
              </label>
              <label>
                Categoria
                <input name="category" maxLength={40} required />
              </label>
              <label>
                Unidade
                <select name="unit">
                  <option>un</option>
                  <option>kg</option>
                  <option>cx</option>
                  <option>L</option>
                </select>
              </label>
              <label>
                Estoque mínimo
                <input
                  type="number"
                  name="minimum"
                  min="0"
                  max="1000000"
                  defaultValue="0"
                  required
                />
              </label>
              <button className="primary">Cadastrar produto</button>
            </fieldset>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </div>
  );
}
