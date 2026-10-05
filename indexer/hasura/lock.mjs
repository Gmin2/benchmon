// envio tracks every table in hasura on first start and gives the "public" role
// select on all of them, its own raw_events and chain_metadata included.
// this waits until envio is done with that, then takes public off the internal ones.
// safe to run on every start, it only drops what is there.

const endpoint = process.env.HASURA_GRAPHQL_ENDPOINT;
const secret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;
const port = process.env.ENVIO_INDEXER_PORT || "9898";
const hidden = (process.env.HASURA_PUBLIC_HIDDEN || "raw_events,chain_metadata").split(",").map((t) => t.trim()).filter(Boolean);
const schema = process.env.ENVIO_PG_SCHEMA || "public";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function metadata(body) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hasura-admin-secret": secret, "x-hasura-role": "admin" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${body.type}: ${JSON.stringify(json)}`);
  return json;
}

// envio only opens its http port after storage init, and hasura tracking runs inside init
async function waitForIndexer() {
  for (let i = 0; i < 360; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (res.ok) return;
    } catch {}
    await sleep(5000);
  }
  throw new Error("indexer never came up");
}

async function lock() {
  const meta = await metadata({ type: "export_metadata", args: {} });
  const tables = meta.sources?.find((s) => s.name === "default")?.tables ?? [];
  for (const t of tables) {
    if (!hidden.includes(t.table.name)) continue;
    if (!(t.select_permissions ?? []).some((p) => p.role === "public")) continue;
    await metadata({
      type: "pg_drop_select_permission",
      args: { source: "default", table: { schema, name: t.table.name }, role: "public" },
    });
    console.log(`hasura lock: dropped public select on ${t.table.name}`);
  }
}

if (!endpoint || !secret) {
  console.log("hasura lock: no hasura endpoint or secret, skipping");
  process.exit(0);
}

try {
  await waitForIndexer();
  for (let i = 0; ; i++) {
    try {
      await lock();
      break;
    } catch (e) {
      if (i >= 10) throw e;
      await sleep(3000);
    }
  }
  console.log("hasura lock: done");
} catch (e) {
  console.error("hasura lock failed:", e.message);
  process.exit(1);
}
