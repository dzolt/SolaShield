import { RotateCcw, Send } from "lucide-react";
import type { InventoryItem, SimAccount } from "../../attestor";
import { DEMO_BUYER_STEAM, DEMO_SELLER_STEAM } from "../../config";
import type { Deal } from "../../data";
import { shortWear, splitItemName } from "../../format";
import { Badge, Button, Drawer, Notice, Switch } from "../../ui";
import { ItemImage } from "../items/ItemCard";

interface DemoPanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly accounts: readonly SimAccount[] | undefined;
  readonly error: string | undefined;
  readonly deal: Deal | undefined;
  readonly busy: boolean;
  readonly onMove: (from: string, to: string, assetid: string) => void;
  readonly onPrivacy: (steamId: string, isPrivate: boolean) => void;
  readonly onReset: () => void;
}

const isDealItem = (deal: Deal | undefined, item: InventoryItem): boolean => !!deal && deal.itemName === item.name && deal.wear === item.wear && deal.pattern === item.pattern;

/** Tools for the demo: two Steam accounts that live in the attestor, so a trade can be shown without real accounts. */
export function DemoPanel({ open, onClose, accounts, error, deal, busy, onMove, onPrivacy, onReset }: DemoPanelProps) {
  return (
    <Drawer open={open} onClose={onClose} label="Symulator Steam" title={<strong>Symulator Steam (demo)</strong>}>
      <Notice>Dwa konta demo mają inventory w formacie Steama, żeby pokazać wymianę bez prawdziwych kont. Każdy inny SteamID jest czytany z prawdziwego Steama.</Notice>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {(accounts ?? []).map((account) => {
        const isSeller = account.steamId === DEMO_SELLER_STEAM;
        const other = isSeller ? DEMO_BUYER_STEAM : DEMO_SELLER_STEAM;
        return (
          <section className="card sim-account" key={account.steamId}>
            <div className="row between">
              <div className="stack tight">
                <strong>{account.label}</strong>
                <span className="muted tiny">SteamID {account.steamId}</span>
              </div>
              <Switch checked={account.private} disabled={busy} onChange={(value) => onPrivacy(account.steamId, value)} label="Inventory prywatne" />
            </div>
            {account.private ? <Notice tone="warn">Inventory ukryte: Steam odpowiada „prywatne”.</Notice> : null}
            <ul className="sim-list">
              {account.items.map((item) => {
                const { title, exterior } = splitItemName(item.name);
                return (
                  <li key={item.assetid} className={isDealItem(deal, item) ? "sim-item is-deal" : "sim-item"}>
                    <ItemImage size="sm" look={{ icon: item.icon, color: item.color }} />
                    <div className="stack tight grow">
                      <span className="truncate sim-name">{title}</span>
                      <span className="muted tiny">
                        {exterior}
                        {item.wear ? ` · float ${shortWear(item.wear)}` : ""} · asset {item.assetid}
                      </span>
                    </div>
                    {isDealItem(deal, item) ? <Badge tone="warn">z tej transakcji</Badge> : null}
                    {item.tradable ? (
                      <Button size="sm" variant="soft" icon={<Send />} disabled={busy} onClick={() => onMove(account.steamId, other, item.assetid)}>
                        {isSeller ? "Do kupującego" : "Z powrotem"}
                      </Button>
                    ) : (
                      <span className="muted tiny">niewymienialny</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <Button variant="outline" icon={<RotateCcw />} disabled={busy} onClick={onReset}>
        Przywróć inventory demo
      </Button>
    </Drawer>
  );
}
