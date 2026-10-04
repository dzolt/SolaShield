import type { PublicKey } from "@solana/web3.js";
import { rolesOf, type Role, type Will } from "../data";
import { formatUsdc, shortAddress } from "../format";
import { Card } from "../ui";
import { PhaseBadge } from "./PhaseInfo";

const ROLE_LABELS: Readonly<Record<Role, string>> = { owner: "twój sejf", guardian: "jesteś strażnikiem", heir: "jesteś spadkobiercą" };

interface WillListProps {
  readonly title: string;
  readonly wills: readonly Will[];
  readonly now: number;
  readonly me: PublicKey | undefined;
  readonly selected: string | undefined;
  readonly empty: string;
  readonly onSelect: (address: string) => void;
}

export function WillList({ title, wills, now, me, selected, empty, onSelect }: WillListProps) {
  return (
    <Card title={title}>
      {wills.length === 0 ? <p className="muted">{empty}</p> : null}
      <div className="will-list">
        {wills.map((w) => {
          const key = w.address.toBase58();
          return (
            <button key={key} className={`will-row ${selected === key ? "selected" : ""}`} onClick={() => onSelect(key)}>
              <div className="row between">
                <b>{formatUsdc(w.distributing ? w.distributedTotal : w.balance)}</b>
                <PhaseBadge will={w} now={now} />
              </div>
              <div className="row small muted">
                <span>właściciel {shortAddress(w.owner)}</span>
                <span>{w.heirs.length} spadkobierców</span>
                {rolesOf(w, me).map((r) => (
                  <span key={r} className="badge">
                    {ROLE_LABELS[r]}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
