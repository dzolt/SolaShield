// Demo Steam: two accounts whose inventories have the exact shape of the real Steam response.
// A "trade" moves an item and gives it a new asset id, as Steam does; a reversal moves it back.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SteamInventory } from "./inventory.ts";

interface SimAccount {
  label: string;
  private: boolean;
  inventory: SteamInventory;
}

interface SimState {
  accounts: Record<string, SimAccount>;
  nextAssetId: number;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "fixtures", "sim-accounts.json");
// SIM_STATE_FILE lets a second attestor (for example one pointed at a local chain) keep its own demo state.
const STATE_FILE = process.env.SIM_STATE_FILE ?? join(HERE, "data", "sim-state.json");

function fresh(): SimState {
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as SimState;
}

let state: SimState = existsSync(STATE_FILE) ? (JSON.parse(readFileSync(STATE_FILE, "utf8")) as SimState) : fresh();

function save(): void {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

export function isSimAccount(steamId: string): boolean {
  return steamId in state.accounts;
}

export function simInventory(steamId: string): { private: boolean; inventory: SteamInventory } {
  const account = state.accounts[steamId];
  if (!account) throw new Error(`Unknown demo Steam account ${steamId}`);
  return { private: account.private, inventory: account.inventory };
}

export function simAccounts(): { steamId: string; label: string; private: boolean; inventory: SteamInventory }[] {
  return Object.entries(state.accounts).map(([steamId, a]) => ({ steamId, label: a.label, private: a.private, inventory: a.inventory }));
}

/** Moves one item between demo inventories. Returns the new asset id it gets in the receiving inventory. */
export function simMove(from: string, to: string, assetid: string): string {
  const source = state.accounts[from];
  const target = state.accounts[to];
  if (!source || !target) throw new Error("Both accounts must be demo accounts");
  const asset = source.inventory.assets?.find((a) => a.assetid === assetid);
  if (!asset) throw new Error(`Item ${assetid} is not in ${source.label}'s inventory`);

  const newAssetId = String(state.nextAssetId++);
  const props = source.inventory.asset_properties?.find((p) => p.assetid === assetid);
  const description = source.inventory.descriptions?.find((d) => d.classid === asset.classid && d.instanceid === asset.instanceid);

  source.inventory = {
    ...source.inventory,
    assets: (source.inventory.assets ?? []).filter((a) => a.assetid !== assetid),
    asset_properties: (source.inventory.asset_properties ?? []).filter((p) => p.assetid !== assetid),
    total_inventory_count: (source.inventory.total_inventory_count ?? 1) - 1,
  };
  const targetHasDescription = target.inventory.descriptions?.some((d) => d.classid === asset.classid && d.instanceid === asset.instanceid);
  target.inventory = {
    ...target.inventory,
    assets: [{ ...asset, assetid: newAssetId }, ...(target.inventory.assets ?? [])],
    descriptions: targetHasDescription || !description ? target.inventory.descriptions : [description, ...(target.inventory.descriptions ?? [])],
    asset_properties: props ? [{ ...props, assetid: newAssetId }, ...(target.inventory.asset_properties ?? [])] : target.inventory.asset_properties,
    total_inventory_count: (target.inventory.total_inventory_count ?? 0) + 1,
  };
  save();
  return newAssetId;
}

export function simSetPrivate(steamId: string, isPrivate: boolean): void {
  const account = state.accounts[steamId];
  if (!account) throw new Error(`Unknown demo Steam account ${steamId}`);
  account.private = isPrivate;
  save();
}

export function simReset(): void {
  state = fresh();
  save();
}
