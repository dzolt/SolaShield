import type { PublicKey } from "@solana/web3.js";
import { CircleCheck, Gift, Hourglass, Play, Wallet } from "lucide-react";
import { phaseOf, shareOf, type Will } from "../../data";
import { formatPercent, formatPrice } from "../../format";
import type { ActionRunner } from "../../hooks";
import { Button, Card, Empty } from "../../ui";
import { HeirsList } from "../heirs/HeirsList";
import { WillHero } from "../overview/WillHero";
import { WillPicker } from "../overview/WillPicker";

interface HeirViewProps {
  readonly wills: readonly Will[];
  readonly will: Will | undefined;
  readonly onSelect: (address: string) => void;
  readonly now: number;
  readonly me: PublicKey | undefined;
  readonly runner: ActionRunner;
  readonly onTrigger: () => void;
  readonly onClaimShare: (index: number) => void;
  readonly onConnect: () => void;
}

function ShareCard({ will, now, me, busy, onTrigger, onClaimShare }: { readonly will: Will; readonly now: number; readonly me: PublicKey; readonly busy: boolean; readonly onTrigger: () => void; readonly onClaimShare: (index: number) => void }) {
  const index = will.heirs.findIndex((heir) => heir.wallet.equals(me));
  if (index < 0) return null;
  const heir = will.heirs[index];
  const phase = phaseOf(will, now);
  const total = will.distributing ? will.distributedTotal : will.balance;
  const amount = shareOf(will, index, total);

  let action;
  if (phase === "distributing") {
    action = heir.claimed ? (
      <div className="share-done">
        <CircleCheck aria-hidden="true" /> Udział odebrany
      </div>
    ) : (
      <Button variant="primary" size="lg" icon={<Gift />} disabled={busy} onClick={() => onClaimShare(index)}>
        Odbierz mój udział
      </Button>
    );
  } else if (phase === "claimable") {
    action = (
      <Button variant="primary" size="lg" icon={<Play />} disabled={busy} onClick={onTrigger}>
        Uruchom wypłatę
      </Button>
    );
  } else {
    action = (
      <Button variant="outline" size="lg" icon={<Hourglass />} disabled>
        Wypłata jeszcze niemożliwa
      </Button>
    );
  }

  return (
    <Card>
      <div className="share-card">
        <div className="stack tight grow">
          <span className="label">Twój udział</span>
          <div className="big-amount">
            <b>{formatPrice(amount)}</b>
            <span>tUSDC</span>
          </div>
          <p className="muted">
            {formatPercent(heir.bps)} {will.distributing ? "podzielonej kwoty" : "dzisiejszego salda sejfu. Zmieni się, jeśli właściciel wpłaci lub wypłaci pieniądze."}
          </p>
        </div>
        {action}
      </div>
    </Card>
  );
}

/** What an heir sees: their own share first, the one action available now, and everyone else below. */
export function HeirView({ wills, will, onSelect, now, me, runner, onTrigger, onClaimShare, onConnect }: HeirViewProps) {
  const head = (
    <div className="page-head">
      <div>
        <h1>Moje dziedziczenie</h1>
        <p className="lead">Tu zobaczysz, ile przypada Tobie i kiedy możesz to odebrać. Nic nie musisz robić, dopóki właściciel się melduje.</p>
      </div>
    </div>
  );
  if (!me) {
    return (
      <main className="page">
        {head}
        <Card>
          <Empty icon={<Wallet />} title="Połącz portfel" action={<Button variant="primary" size="lg" icon={<Wallet />} onClick={onConnect}>Połącz portfel</Button>}>
            Pokażemy sejfy, w których to konto jest spadkobiercą.
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
          <Empty icon={<Gift />} title="Nikt jeszcze nie wpisał tego konta">
            Właściciel dodaje spadkobierców w zakładce „Spadkobiercy” swojego sejfu. Gdy wpisze to konto, zobaczysz tu swój udział.
          </Empty>
        </Card>
      </main>
    );
  }
  return (
    <main className="page">
      {head}
      <WillPicker wills={wills} selected={will.address.toBase58()} onSelect={onSelect} />
      <WillHero will={will} now={now} role="heir" />
      <ShareCard will={will} now={now} me={me} busy={runner.busy} onTrigger={onTrigger} onClaimShare={onClaimShare} />
      <Card title="Wszyscy spadkobiercy">
        <HeirsList will={will} me={me} canClaim={will.distributing} busy={runner.busy} onClaim={onClaimShare} />
      </Card>
    </main>
  );
}
