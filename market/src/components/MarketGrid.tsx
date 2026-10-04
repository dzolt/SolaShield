import type { PublicKey } from "@solana/web3.js";
import { useState } from "react";
import type { Deal } from "../data";
import { formatUsdc } from "../format";
import { dealLabel } from "../status";
import { Badge, Card } from "../ui";
import { ItemTile } from "./ItemTile";

type Filter = "open" | "mine" | "all";

interface MarketGridProps {
  readonly deals: readonly Deal[];
  readonly now: number;
  readonly owner: PublicKey | undefined;
  readonly selected: string | undefined;
  readonly iconFor: (name: string) => { icon?: string; color?: string };
  readonly onSelect: (address: string) => void;
}

/** Open = confirmed listings plus deals in progress; unconfirmed listings and finished deals stay under "Wszystkie". */
function visible(deal: Deal, filter: Filter, owner: PublicKey | undefined): boolean {
  if (filter === "all") return true;
  if (filter === "mine") return !!owner && (deal.seller.equals(owner) || (deal.buyer?.equals(owner) ?? false));
  return (deal.status === "listed" && deal.listingVerified) || deal.status === "funded" || deal.status === "delivered";
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "open", label: "Otwarte" },
  { id: "mine", label: "Moje" },
  { id: "all", label: "Wszystkie" },
];

export function MarketGrid({ deals, now, owner, selected, iconFor, onSelect }: MarketGridProps) {
  const [filter, setFilter] = useState<Filter>("open");
  const shown = deals.filter((d) => visible(d, filter, owner));
  return (
    <Card
      title="Rynek"
      aside={
        <div className="row small">
          {FILTERS.map((f) => (
            <button key={f.id} className={filter === f.id ? "chip active" : "chip"} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      {shown.length === 0 ? (
        <p className="muted">
          {filter === "open" ? "Brak otwartych ogłoszeń. Wystaw skina w zakładce „Wystaw skina”." : "Nic tu jeszcze nie ma."}
        </p>
      ) : (
        <div className="tiles">
          {shown.map((deal) => {
            const label = dealLabel(deal, now);
            const look = iconFor(deal.itemName);
            return (
              <ItemTile
                key={deal.address.toBase58()}
                name={deal.itemName}
                wear={deal.wear}
                pattern={deal.pattern}
                icon={look.icon}
                color={look.color}
                selected={selected === deal.address.toBase58()}
                dimmed={deal.status === "completed" || deal.status === "refunded"}
                onClick={() => onSelect(deal.address.toBase58())}
              >
                <div className="tile-price">{formatUsdc(deal.price)}</div>
                <Badge tone={label.tone}>{label.text}</Badge>
              </ItemTile>
            );
          })}
        </div>
      )}
    </Card>
  );
}
