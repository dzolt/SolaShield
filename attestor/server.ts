// HTTP API of the attestor and the demo Steam simulator.
//   GET  /health                      cluster, attestor key, program
//   GET  /inventory/:steamId          parsed CS2 inventory (demo account or real public Steam)
//   POST /attest {deal, kind[, steamId]}  signed observation, or the reason it cannot be signed
//                                     (steamId only for kind "buyer_public": the buyer is checked before paying)
//   GET  /sim/accounts                demo inventories
//   POST /sim/move {from,to,assetid}  demo trade (the item gets a new asset id, like on Steam)
//   POST /sim/privacy {steamId,private}
//   POST /sim/reset
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { attest, isAttestRequest, REQUESTS } from "./attest.ts";
import { attestorKey, cluster, program } from "./chain.ts";
import { parseInventory } from "./inventory.ts";
import { simAccounts, simMove, simReset, simSetPrivate } from "./simulator.ts";
import { readInventory } from "./steam.ts";

const PORT = Number(process.env.ATTESTOR_PORT ?? 8787);

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Missing field: ${field}`);
  return value;
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "OPTIONS") return send(res, 204, {});

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { ok: true, cluster, attestor: attestorKey.publicKey.toBase58(), program: program.programId.toBase58() });
  }
  const inventoryMatch = url.pathname.match(/^\/inventory\/(\d{17})$/);
  if (req.method === "GET" && inventoryMatch) {
    const read = await readInventory(inventoryMatch[1]);
    return send(res, 200, { steamId: inventoryMatch[1], source: read.source, private: read.private, items: read.inventory ? parseInventory(read.inventory) : [] });
  }
  if (req.method === "POST" && url.pathname === "/attest") {
    const body = await readBody(req);
    if (!isAttestRequest(body.kind)) throw new Error(`kind must be one of: ${Object.keys(REQUESTS).join(", ")}`);
    const steamId = body.steamId === undefined ? undefined : text(body.steamId, "steamId");
    return send(res, 200, await attest(text(body.deal, "deal"), body.kind, steamId));
  }
  if (req.method === "GET" && url.pathname === "/sim/accounts") {
    return send(res, 200, simAccounts().map((a) => ({ steamId: a.steamId, label: a.label, private: a.private, items: parseInventory(a.inventory) })));
  }
  if (req.method === "POST" && url.pathname === "/sim/move") {
    const body = await readBody(req);
    return send(res, 200, { newAssetId: simMove(text(body.from, "from"), text(body.to, "to"), text(body.assetid, "assetid")) });
  }
  if (req.method === "POST" && url.pathname === "/sim/privacy") {
    const body = await readBody(req);
    simSetPrivate(text(body.steamId, "steamId"), body.private === true);
    return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/sim/reset") {
    simReset();
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: "Not found" });
}

createServer((req, res) => {
  route(req, res).catch((error: unknown) => send(res, 400, { error: error instanceof Error ? error.message : String(error) }));
}).listen(PORT, () => {
  console.log(`attestor on http://localhost:${PORT} · cluster ${cluster} · key ${attestorKey.publicKey.toBase58()}`);
});
