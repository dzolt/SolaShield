import type { PublicKey } from "@solana/web3.js";
import { shareOf, type Will } from "../data";
import { formatPercent, formatUsdc, shortAddress } from "../format";
import { Badge } from "../ui";

interface HeirsTableProps {
  readonly will: Will;
  readonly me: PublicKey | undefined;
  readonly canClaim: boolean;
  readonly busy: boolean;
  readonly onClaim: (index: number) => void;
}

/** Heirs with their share of today's balance (or of the frozen total once the payout runs). */
export function HeirsTable({ will, me, canClaim, busy, onClaim }: HeirsTableProps) {
  if (will.heirs.length === 0) return <p className="muted">Nie wskazano jeszcze spadkobierców.</p>;
  const total = will.distributing ? will.distributedTotal : will.balance;
  return (
    <table className="heirs">
      <thead>
        <tr>
          <th>Spadkobierca</th>
          <th>Udział</th>
          <th>{will.distributing ? "Do wypłaty" : "Dziś by dostał"}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {will.heirs.map((h, i) => (
          <tr key={h.wallet.toBase58()}>
            <td>
              {shortAddress(h.wallet)} {me && h.wallet.equals(me) ? <Badge>ty</Badge> : null}
            </td>
            <td>{formatPercent(h.bps)}</td>
            <td>{formatUsdc(shareOf(will, i, total))}</td>
            <td>
              {h.claimed ? (
                <Badge tone="ok">wypłacono</Badge>
              ) : canClaim ? (
                <button className="chip" disabled={busy} onClick={() => onClaim(i)}>
                  Wypłać udział
                </button>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
