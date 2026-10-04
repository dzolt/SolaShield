import type { PublicKey } from "@solana/web3.js";
import { ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import { MAX_VETOES } from "../../config";
import { phaseOf, type Will } from "../../data";
import type { ActionRunner } from "../../hooks";
import { Button, Card, Empty } from "../../ui";
import { HeirsList } from "../heirs/HeirsList";
import { WillHero } from "../overview/WillHero";
import { WillPicker } from "../overview/WillPicker";

interface GuardianViewProps {
  readonly wills: readonly Will[];
  readonly will: Will | undefined;
  readonly onSelect: (address: string) => void;
  readonly now: number;
  readonly me: PublicKey | undefined;
  readonly runner: ActionRunner;
  readonly onVeto: () => void;
  readonly onConnect: () => void;
}

function VetoCard({ will, now, busy, onVeto }: { readonly will: Will; readonly now: number; readonly busy: boolean; readonly onVeto: () => void }) {
  const phase = phaseOf(will, now);
  const left = MAX_VETOES - will.vetoesUsed;
  const reason =
    phase === "distributing"
      ? "Wypłata już ruszyła, więc weto nie jest możliwe."
      : phase === "active"
        ? "Weto będzie możliwe dopiero, gdy właściciel zamilknie na cały okres ciszy."
        : left <= 0
          ? "Wykorzystałeś oba weta. Licznik może zresetować już tylko właściciel."
          : undefined;
  return (
    <Card>
      <div className="veto-card">
        <span className="checkin-icon">
          <ShieldAlert aria-hidden="true" />
        </span>
        <div className="stack tight grow">
          <h3>Weto strażnika</h3>
          <p className="muted">{reason ?? "Jeśli wiesz, że właściciel żyje, użyj weta: odliczanie zacznie się od nowa, a wypłata zostanie wstrzymana."}</p>
          <div className="veto-dots" aria-label={`Zostało ${Math.max(0, left)} z ${MAX_VETOES} wet`}>
            {Array.from({ length: MAX_VETOES }, (_, index) => (
              <span key={index} className={index < will.vetoesUsed ? "veto-dot is-used" : "veto-dot"} />
            ))}
            <span className="muted small">zostało {Math.max(0, left)} z {MAX_VETOES}</span>
          </div>
        </div>
        <Button variant="primary" size="lg" icon={<ShieldCheck />} disabled={busy || !!reason} onClick={onVeto}>
          Użyj weta
        </Button>
      </div>
    </Card>
  );
}

/** What a guardian sees: the state of the vault they watch, and the one thing they can do about it. */
export function GuardianView({ wills, will, onSelect, now, me, runner, onVeto, onConnect }: GuardianViewProps) {
  const head = (
    <div className="page-head">
      <div>
        <h1>Sejfy, które pilnujesz</h1>
        <p className="lead">Nie masz dostępu do pieniędzy. Możesz tylko wstrzymać wypłatę, gdy właściciel jest nieosiągalny, a żyje.</p>
      </div>
    </div>
  );
  if (!me) {
    return (
      <main className="page">
        {head}
        <Card>
          <Empty icon={<Wallet />} title="Połącz portfel" action={<Button variant="primary" size="lg" icon={<Wallet />} onClick={onConnect}>Połącz portfel</Button>}>
            Pokażemy sejfy, w których to konto jest strażnikiem.
          </Empty>
        </Card>
      </main>
    );
  }
  if (!will) {
    return (
      <main className="page">
        {head}
        <Card>
          <Empty icon={<ShieldCheck />} title="Nikt Cię jeszcze nie wyznaczył">
            Właściciel ustawia strażnika w zakładce „Ustawienia” swojego sejfu. Gdy to zrobi, zobaczysz tu ten sejf.
          </Empty>
        </Card>
      </main>
    );
  }
  return (
    <main className="page">
      {head}
      <WillPicker wills={wills} selected={will.address.toBase58()} onSelect={onSelect} />
      <WillHero will={will} now={now} role="guardian" />
      <VetoCard will={will} now={now} busy={runner.busy} onVeto={onVeto} />
      <Card title="Spadkobiercy">
        <HeirsList will={will} me={me} canClaim={false} busy={runner.busy} onClaim={() => undefined} />
      </Card>
    </main>
  );
}
