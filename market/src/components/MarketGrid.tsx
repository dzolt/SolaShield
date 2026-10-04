import type { PublicKey } from "@solana/web3.js";
import { useState } from "react";
import type { Deal } from "../data";
import { formatUsdc } from "../format";
import type { DealFilter } from "../roles";
import { dealLabel } from "../status";
import { Badge, Card } from "../ui";
import { ItemTile } from "./ItemTile";

interface MarketGridProps {
  readonly title: string;
  readonly filters: readonly DealFilter[];
  readonly deals: readonly Deal[];
  readonly now: number;
  readonly owner: PublicKey | undefined;
  readonly selected: string | undefined;
  readonly iconFor: (name: string) => { icon?: string; color?: string };
  readonly onSelect: (address: string) => void;
}

export function MarketGrid({ title, filters, deals, now, owner, selected, iconFor, onSelect }: MarketGridProps) {
  const [filterId, setFilterId] = useState(filters[0]?.id);
  const filter = filters.find((f) => f.id === filterId) ?? filters[0];
  const shown = filter ? deals.filter((d) => filter.test(d, owner)) : [];
  return (
    <Card
      title={title}
      aside={
        <div className="row small">
          {filters.map((f) => (
            <button key={f.id} className={filter?.id === f.id ? "chip active" : "chip"} onClick={() => setFilterId(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      {shown.length === 0 ? (
        <p className="muted">{filter?.empty ?? "Nic tu jeszcze nie ma."}</p>
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
