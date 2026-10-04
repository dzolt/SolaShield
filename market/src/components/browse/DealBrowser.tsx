import type { PublicKey } from "@solana/web3.js";
import { Inbox } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Deal } from "../../data";
import { formatPrice, shortAddress } from "../../format";
import type { DealFilter } from "../../roles";
import { dealLabel } from "../../status";
import { Badge, Empty, Party, Segmented } from "../../ui";
import { ItemCard, ItemCardSkeleton, type ItemLook } from "../items/ItemCard";

interface DealBrowserProps {
  readonly deals: readonly Deal[] | undefined;
  readonly filters: readonly DealFilter[];
  readonly now: number;
  readonly owner: PublicKey | undefined;
  readonly lookFor: (name: string) => ItemLook;
  readonly onOpen: (address: string) => void;
  readonly emptyAction?: (filter: DealFilter) => ReactNode;
}

/** Filter tabs plus a grid of deals; the empty state says what to do next instead of just "nothing here". */
export function DealBrowser({ deals, filters, now, owner, lookFor, onOpen, emptyAction }: DealBrowserProps) {
  const [filterId, setFilterId] = useState(filters[0].id);
  const filter = filters.find((f) => f.id === filterId) ?? filters[0];
  const options = filters.map((f) => ({ value: f.id, label: f.label, count: deals ? deals.filter((d) => f.test(d, owner)).length : undefined }));
  const shown = deals ? deals.filter((d) => filter.test(d, owner)) : [];

  return (
    <div className="stack loose">
      <div>
        <Segmented value={filter.id} options={options} onChange={setFilterId} label="Filtr ogłoszeń" />
      </div>
      {!deals ? (
        <div className="grid-cards">
          {[0, 1, 2].map((i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="card">
          <Empty icon={<Inbox />} title={filter.empty.title} action={emptyAction?.(filter)}>
            {filter.empty.text}
            {filter.byAccount && owner ? ` Pokazuję transakcje konta ${shortAddress(owner)}.` : ""}
            {filter.byAccount && !owner ? " Połącz portfel, żeby je zobaczyć." : ""}
          </Empty>
        </div>
      ) : (
        <div className="grid-cards">
          {shown.map((deal) => {
            const label = dealLabel(deal, now);
            const address = deal.seller.toBase58();
            return (
              <ItemCard
                key={deal.address.toBase58()}
                name={deal.itemName}
                wear={deal.wear}
                pattern={deal.pattern}
                look={lookFor(deal.itemName)}
                dimmed={deal.status === "completed" || deal.status === "refunded"}
                badge={
                  <Badge tone={label.tone} dot>
                    {label.text}
                  </Badge>
                }
                footer={
                  <>
                    <div className="price">
                      <b>{formatPrice(deal.price)}</b>
                      <span>tUSDC</span>
                    </div>
                    <Party address={address} short={shortAddress(deal.seller)} />
                  </>
                }
                onClick={() => onOpen(deal.address.toBase58())}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
