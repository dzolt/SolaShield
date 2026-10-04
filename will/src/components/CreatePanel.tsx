import { useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import { deployment } from "../config";
import { formatDuration } from "../format";
import { Card } from "../ui";

interface CreatePanelProps {
  readonly owner: PublicKey | undefined;
  readonly busy: boolean;
  readonly onCreate: (guardian: string) => void;
}

export function CreatePanel({ owner, busy, onCreate }: CreatePanelProps) {
  const [guardian, setGuardian] = useState("");
  return (
    <Card title="Załóż sejf">
      <div className="stack">
        <p className="muted">
          Sejf dostaje własny adres i własne konto na tokeny, osobne od wszystkich innych. Okresy ustala konfiguracja programu: {formatDuration(deployment.inactivityPeriod)} ciszy,
          potem {formatDuration(deployment.claimPeriod)} procedury.
        </p>
        <label className="field">
          Strażnik z prawem weta (opcjonalnie, można ustawić później)
          <input placeholder="adres portfela" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
        </label>
        <button className="primary" disabled={busy || !owner} onClick={() => onCreate(guardian)}>
          {owner ? "Załóż sejf" : "Połącz portfel"}
        </button>
      </div>
    </Card>
  );
}
