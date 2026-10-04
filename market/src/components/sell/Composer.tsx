import type { PublicKey } from "@solana/web3.js";
import { Package, RefreshCcw, Settings2, Tag } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getInventory, type InventoryItem, type InventoryResponse } from "../../attestor";
import { DEMO_SELLER_STEAM } from "../../config";
import { explainError } from "../../errors";
import { parseUsdc, shortWear, splitItemName } from "../../format";
import type { ActionRunner } from "../../hooks";
import { Button, Card, Empty, Field, Notice } from "../../ui";
import { ItemCard, ItemCardSkeleton, ItemImage } from "../items/ItemCard";

interface ComposerProps {
  readonly owner: PublicKey | undefined;
  readonly runner: ActionRunner;
  readonly onLoaded: (items: readonly InventoryItem[]) => void;
  readonly onList: (steamId: string, item: InventoryItem, price: string) => void;
  readonly onConnect: () => void;
}

const validPrice = (input: string): boolean => {
  try {
    return parseUsdc(input) > 0n;
  } catch {
    return false;
  }
};

/** Pick a skin from a public Steam inventory (the demo account by default) and list it with a price. */
export function Composer({ owner, runner, onLoaded, onList, onConnect }: ComposerProps) {
  const [steamId, setSteamId] = useState(DEMO_SELLER_STEAM);
  const [editing, setEditing] = useState(false);
  const [inventory, setInventory] = useState<InventoryResponse | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [picked, setPicked] = useState<InventoryItem | undefined>(undefined);
  const [price, setPrice] = useState("100");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(undefined);
    setPicked(undefined);
    try {
      const result = await getInventory(id.trim());
      setInventory(result);
      onLoaded(result.items);
    } catch (e: unknown) {
      setInventory(undefined);
      setError(explainError(e));
    } finally {
      setLoading(false);
    }
  }, [onLoaded]);

  useEffect(() => {
    void load(DEMO_SELLER_STEAM);
    // Only the first load is automatic; later loads are the seller's choice.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sellable = inventory?.items.filter((item) => item.tradable && item.wear !== "") ?? [];
  const priceOk = validPrice(price);
  const demoAccount = steamId.trim() === DEMO_SELLER_STEAM;

  return (
    <>
      <Card>
        <div className="card-head">
          <div className="stack tight">
            <h2>Twoje inventory</h2>
            <p className="muted small">
              Konto Steam <code>{inventory?.steamId ?? steamId}</code> {demoAccount ? "(demo z symulatora)" : "(publiczne, czytane ze Steama)"}
            </p>
          </div>
          <Button variant="ghost" size="sm" icon={<Settings2 />} onClick={() => setEditing((value) => !value)} aria-expanded={editing}>
            Inne konto
          </Button>
        </div>

        {editing ? (
          <div className="row form-row inline-form fade-up">
            <div className="grow">
              <Field label="SteamID64" value={steamId} onChange={(event) => setSteamId(event.target.value)} inputMode="numeric" placeholder="17 cyfr" mono />
            </div>
            <Button variant="soft" icon={<RefreshCcw />} loading={loading} onClick={() => void load(steamId)}>
              Wczytaj
            </Button>
          </div>
        ) : null}

        {error ? (
          <Notice tone="bad" action={<Button size="sm" variant="outline" onClick={() => void load(steamId)}>Spróbuj ponownie</Button>}>
            {error}
          </Notice>
        ) : null}
        {inventory?.private ? <Notice tone="warn">To inventory jest prywatne. Ustaw je jako publiczne, inaczej nikt nie sprawdzi dostawy.</Notice> : null}

        {loading && !inventory ? (
          <div className="grid-cards">
            {[0, 1, 2].map((i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        ) : inventory && !inventory.private ? (
          sellable.length === 0 ? (
            <Empty icon={<Package />} title="Nie ma tu czego wystawić">
              Wystawić można tylko skiny z floatem, bo to on (razem ze wzorem) jednoznacznie identyfikuje egzemplarz.
            </Empty>
          ) : (
            <div className="stack">
              <p className="muted small">
                {sellable.length} {sellable.length === 1 ? "przedmiot" : "przedmiotów"} z floatem możesz wystawić. Wybierz jeden.
              </p>
              <div className="grid-cards">
                {sellable.map((item) => (
                  <ItemCard
                    key={item.assetid}
                    name={item.name}
                    wear={item.wear}
                    pattern={item.pattern}
                    look={{ icon: item.icon, color: item.color }}
                    selected={picked?.assetid === item.assetid}
                    onClick={() => setPicked(item)}
                  />
                ))}
              </div>
            </div>
          )
        ) : null}
      </Card>

      {picked ? (
        <div className="action-bar" role="region" aria-label="Wystawianie przedmiotu">
          <div className="action-main">
            <ItemImage size="sm" look={{ icon: picked.icon, color: picked.color }} />
            <div className="stack tight">
              <strong className="truncate">{splitItemName(picked.name).title}</strong>
              <span className="muted small">
                {splitItemName(picked.name).exterior} · float {shortWear(picked.wear)}
              </span>
            </div>
          </div>
          <div className="action-fields">
            <Field
              label="Cena"
              suffix="tUSDC"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              inputMode="decimal"
              error={price.trim() && !priceOk ? "Np. 100 lub 12,50" : undefined}
            />
            {owner ? (
              <Button variant="primary" size="lg" icon={<Tag />} loading={runner.busy} disabled={!priceOk} onClick={() => onList(steamId.trim(), picked, price)}>
                Wystaw na sprzedaż
              </Button>
            ) : (
              <Button variant="primary" size="lg" onClick={onConnect}>
                Połącz portfel
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
