// Reads a CS2 inventory: from the demo simulator for the demo accounts, from the real public Steam endpoint otherwise.
import { isSimAccount, simInventory } from "./simulator.ts";
import type { SteamInventory } from "./inventory.ts";

export interface InventoryRead {
  source: string;
  private: boolean;
  inventory: SteamInventory | null;
}

const CS2_APP = 730;
const CS2_CONTEXT = 2;

export function inventoryUrl(steamId: string): string {
  return `https://steamcommunity.com/inventory/${steamId}/${CS2_APP}/${CS2_CONTEXT}?l=english&count=2000`;
}

export async function readInventory(steamId: string): Promise<InventoryRead> {
  if (!/^\d{17}$/.test(steamId)) throw new Error("A SteamID64 has 17 digits");
  if (isSimAccount(steamId)) {
    const sim = simInventory(steamId);
    return { source: `demo:${steamId}`, private: sim.private, inventory: sim.private ? null : sim.inventory };
  }
  const response = await fetch(inventoryUrl(steamId), { headers: { "user-agent": "ProofSwap attestor (hackathon demo)" } });
  // Steam answers 403 for a private inventory; any other failure is an error, not a privacy setting.
  if (response.status === 403) return { source: inventoryUrl(steamId), private: true, inventory: null };
  if (!response.ok) throw new Error(`Steam answered ${response.status} for ${steamId}`);
  return { source: inventoryUrl(steamId), private: false, inventory: (await response.json()) as SteamInventory };
}
