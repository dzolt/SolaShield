import type { PublicKey } from "@solana/web3.js";
import { Users } from "lucide-react";
import { explorerAddress } from "../../config";
import { shareOf, type Will } from "../../data";
import { formatPercent, formatPrice, shortAddress } from "../../format";
import { Badge, Button, colorsOf, cx, Empty, Party } from "../../ui";
import { Donut } from "./Donut";

interface HeirsListProps {
  readonly will: Will;
  readonly me: PublicKey | undefined;
  /** Shares can be collected (the payout has been triggered). */
  readonly canClaim: boolean;
  readonly busy: boolean;
  readonly onClaim: (index: number) => void;
}

/** The heirs with their shares as a chart and a list; once the payout runs, each row gets its own "collect" button. */
export function HeirsList({ will, me, canClaim, busy, onClaim }: HeirsListProps) {
  if (will.heirs.length === 0) {
    return (
      <Empty icon={<Users />} title="Nie wskazano jeszcze spadkobierców">
        Właściciel dodaje ich w zakładce „Spadkobiercy”. Bez tego nie ma komu przekazać środków.
      </Empty>
    );
  }
  const total = will.distributing ? will.distributedTotal : will.balance;
  return (
    <div className="heirs-layout">
      <Donut segments={will.heirs.map((heir) => ({ key: heir.wallet.toBase58(), value: heir.bps, color: colorsOf(heir.wallet.toBase58()).from }))}>
        <span className="donut-value">{will.heirs.length}</span>
        <span className="ring-caption">{will.heirs.length === 1 ? "spadkobierca" : "spadkobierców"}</span>
      </Donut>
      <ul className="heir-rows">
        {will.heirs.map((heir, index) => {
          const address = heir.wallet.toBase58();
          const mine = !!me && heir.wallet.equals(me);
          return (
            <li key={address} className={cx("heir-row", mine && "is-me")}>
              <Party address={address} short={shortAddress(heir.wallet)} href={explorerAddress(address)} tag={mine ? <Badge tone="accent">Ty</Badge> : null} />
              <div className="heir-share">
                <b>{formatPercent(heir.bps)}</b>
                <div className="share-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, heir.bps / 100)}%`, background: colorsOf(address).from }} />
                </div>
              </div>
              <div className="heir-amount">
                <b>{formatPrice(shareOf(will, index, total))}</b>
                <span>tUSDC</span>
              </div>
              <div className="heir-action">
                {heir.claimed ? (
                  <Badge tone="ok" dot>
                    Wypłacono
                  </Badge>
                ) : canClaim ? (
                  <Button size="sm" variant={mine ? "primary" : "outline"} disabled={busy} onClick={() => onClaim(index)}>
                    {mine ? "Odbierz mój udział" : "Wypłać za nich"}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
