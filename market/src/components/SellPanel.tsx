import type { PublicKey } from "@solana/web3.js";
import { useState } from "react";
import { getInventory, type InventoryItem, type InventoryResponse } from "../attestor";
import { DEMO_SELLER_STEAM } from "../config";
import { explainError } from "../errors";
import type { ActionRunner } from "../hooks";
import { Card } from "../ui";
import { ItemTile } from "./ItemTile";

interface SellPanelProps {
  readonly owner: PublicKey | undefined;
  readonly runner: ActionRunner;
  readonly onLoaded: (items: readonly InventoryItem[]) => void;
  readonly onList: (steamId: string, item: InventoryItem, price: string) => void;
}

/** Pick a skin from a public Steam inventory (a demo account or any real one) and list it. */
export function SellPanel({ owner, runner, onLoaded, onList }: SellPanelProps) {
  const [steamId, setSteamId] = useState(DEMO_SELLER_STEAM);
  const [inventory, setInventory] = useState<InventoryResponse | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [picked, setPicked] = useState<InventoryItem | undefined>(undefined);
  const [price, setPrice] = useState("100");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(undefined);
    setPicked(undefined);
    try {
      const result = await getInventory(steamId.trim());
      setInventory(result);
      onLoaded(result.items);
    } catch (e: unknown) {
      setInventory(undefined);
      setError(explainError(e));
    } finally {
      setLoading(false);
    }
  };

  const sellable = inventory?.items.filter((i) => i.tradable && i.wear !== "") ?? [];
  return (
    <Card title="Wystaw skina">
      <p className="muted">
        Wczytaj publiczne inventory CS2. Domyślnie to konto demo z symulatora; prawdziwy SteamID64 z publicznym inventory czytamy wprost ze Steama.
      </p>
      <div className="row">
        <label className="field grow">
          SteamID64 sprzedającego
          <input value={steamId} onChange={(e) => setSteamId(e.target.value)} inputMode="numeric" />
        </label>
        <button disabled={loading} onClick={() => void load()}>
          {loading ? "Wczytuję…" : "Wczytaj inventory"}
        </button>
      </div>
      {error ? <p className="banner">{error}</p> : null}
      {inventory?.private ? <p className="banner">To inventory jest prywatne. Ustaw je jako publiczne, inaczej nikt nie sprawdzi dostawy.</p> : null}
      {inventory && !inventory.private ? (
        <>
          <p className="muted small">
            {inventory.items.length} przedmiotów, {sellable.length} skinów z floatem do wystawienia. Źródło: {inventory.source}
          </p>
          <div className="tiles">
            {sellable.map((item) => (
              <ItemTile
                key={item.assetid}
                name={item.name}
                wear={item.wear}
                pattern={item.pattern}
                icon={item.icon}
                color={item.color}
                selected={picked?.assetid === item.assetid}
                onClick={() => setPicked(item)}
              />
            ))}
          </div>
        </>
      ) : null}
      {picked ? (
        <div className="row sell-row">
          <span>
            Wybrany: <b>{picked.name}</b>
          </span>
          <label className="field">
            Cena (tUSDC)
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
          </label>
          <button className="primary" disabled={runner.busy || !owner} onClick={() => onList(steamId.trim(), picked, price)}>
            Wystaw i potwierdź w Steam
          </button>
          {!owner ? <span className="muted">Połącz portfel.</span> : null}
        </div>
      ) : null}
    </Card>
  );
}
