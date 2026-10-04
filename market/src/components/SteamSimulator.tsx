import type { SimAccount } from "../attestor";
import { DEMO_BUYER_STEAM, DEMO_SELLER_STEAM } from "../config";
import type { Deal } from "../data";
import { Card } from "../ui";
import { ItemTile } from "./ItemTile";

interface SteamSimulatorProps {
  readonly accounts: readonly SimAccount[] | undefined;
  readonly error: string | undefined;
  readonly deal: Deal | undefined;
  readonly busy: boolean;
  readonly onMove: (from: string, to: string, assetid: string) => void;
  readonly onPrivacy: (steamId: string, isPrivate: boolean) => void;
  readonly onReset: () => void;
}

/**
 * Demo stand-in for Steam, used only when there are no real trade-ready accounts: the same inventory JSON shape,
 * two accounts, a trade (the item moves and gets a new asset id) and a reversal (it moves back).
 */
export function SteamSimulator({ accounts, error, deal, busy, onMove, onPrivacy, onReset }: SteamSimulatorProps) {
  const isDealItem = (name: string, wear: string, pattern: number) =>
    !!deal && deal.itemName === name && deal.wear === wear && deal.pattern === pattern;

  return (
    <Card
      title="Symulator Steam (tylko demo)"
      aside={
        <button disabled={busy} onClick={onReset}>
          Przywróć inventory demo
        </button>
      }
    >
      <p className="muted">
        Dwa konta demo z inventory w formacie steamcommunity.com, żeby pokazać wymianę bez prawdziwych kont. Każdy inny SteamID atestator czyta z prawdziwego
        Steama. Przedmiot z wybranej transakcji jest podświetlony.
      </p>
      {error ? <p className="banner">{error}</p> : null}
      <div className="sim">
        {(accounts ?? []).map((account) => {
          const isSeller = account.steamId === DEMO_SELLER_STEAM;
          const other = isSeller ? DEMO_BUYER_STEAM : DEMO_SELLER_STEAM;
          return (
            <div key={account.steamId} className="sim-account">
              <div className="row between">
                <div>
                  <b>{account.label}</b>
                  <div className="muted small">SteamID {account.steamId}</div>
                </div>
                <label className="row small">
                  <input type="checkbox" checked={account.private} disabled={busy} onChange={(e) => onPrivacy(account.steamId, e.target.checked)} />
                  inventory prywatne
                </label>
              </div>
              {account.private ? <p className="banner">Inventory ukryte: Steam odpowiada „prywatne”.</p> : null}
              <div className="tiles small-tiles">
                {account.items.map((item) => (
                  <ItemTile
                    key={item.assetid}
                    name={item.name}
                    wear={item.wear}
                    pattern={item.pattern}
                    icon={item.icon}
                    color={item.color}
                    highlight={isDealItem(item.name, item.wear, item.pattern)}
                    dimmed={!item.tradable}
                  >
                    <div className="muted tiny">asset {item.assetid}</div>
                    {item.tradable ? (
                      <button disabled={busy} onClick={() => onMove(account.steamId, other, item.assetid)}>
                        {isSeller ? "Wyślij kupującemu (wymiana)" : "Cofnij do sprzedającego"}
                      </button>
                    ) : (
                      <span className="muted tiny">niewymienialny</span>
                    )}
                  </ItemTile>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
