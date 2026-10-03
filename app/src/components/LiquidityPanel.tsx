import { useState } from "react";
import type { Snapshot } from "../data";
import { formatDateTime, formatDuration, formatUsdc } from "../format";
import type { ActionOutcome, ActionRunner } from "../hooks";
import { Card } from "../ui";

interface LiquidityPanelProps {
  readonly snapshot: Snapshot;
  readonly runner: ActionRunner;
  readonly connected: boolean;
  readonly onDeposit: (amount: string) => Promise<ActionOutcome>;
  readonly onWithdraw: (amount: string) => Promise<ActionOutcome>;
}

export function LiquidityPanel({ snapshot, runner, connected, onDeposit, onWithdraw }: LiquidityPanelProps) {
  const [depositAmount, setDepositAmount] = useState("1000");
  const [withdrawAmount, setWithdrawAmount] = useState("100");
  const disabled = runner.busy || !connected;
  const unlockAt = snapshot.wallet?.unlockAt ?? 0;
  const lockedFor = Math.max(0, unlockAt - snapshot.now);
  const locked = lockedFor > 0;

  return (
    <Card title="💼 Dawca płynności">
      <p className="muted" style={{ marginTop: 0 }}>
        Wnosisz kapitał do puli i zarabiasz na składkach. Jeśli wypłat będzie więcej niż składek, <b>tracisz</b>: to
        Twoja część ryzyka. Twoje udziały: <b>{snapshot.wallet ? formatUsdc(snapshot.wallet.shareValue) : "–"}</b>.
      </p>
      <div className="row">
        <label className="field">
          Wpłać (tUSDC)
          <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
        </label>
        <button className="primary" disabled={disabled} onClick={() => void runner.run(() => onDeposit(depositAmount))}>
          Wpłać do puli
        </button>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <label className="field">
          Wypłać (tUSDC)
          <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
        </label>
        <button disabled={disabled || locked} onClick={() => void runner.run(() => onWithdraw(withdrawAmount))}>
          Wypłać z puli
        </button>
        <span className="muted">Wolny kapitał: {formatUsdc(snapshot.pool.free)}</span>
      </div>
      <p className="muted" style={{ margin: "10px 0 0" }}>
        {locked
          ? `Twoja wpłata jest zablokowana jeszcze ${formatDuration(lockedFor)} (do ${formatDateTime(unlockAt)}). Dzięki temu dawca nie może wycofać kapitału tuż przed rozliczeniem ochron.`
          : `Po każdej wpłacie kapitał jest zablokowany na ${formatDuration(snapshot.pool.lockupSeconds)} (każda kolejna wpłata odnawia blokadę całej pozycji).`}
      </p>
    </Card>
  );
}
