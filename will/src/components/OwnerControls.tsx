import { useState } from "react";
import type { Will } from "../data";
import { shortAddress } from "../format";

interface OwnerControlsProps {
  readonly will: Will;
  readonly busy: boolean;
  readonly onCheckIn: () => void;
  readonly onDeposit: (amount: string) => void;
  readonly onWithdraw: (amount: string) => void;
  readonly onGuardian: (address: string) => void;
  readonly onCancel: () => void;
}

/** Everything the owner can do while the payout has not been triggered. Each action is also a sign of life. */
export function OwnerControls({ will, busy, onCheckIn, onDeposit, onWithdraw, onGuardian, onCancel }: OwnerControlsProps) {
  const [amount, setAmount] = useState("");
  const [guardian, setGuardian] = useState("");

  return (
    <div className="stack">
      <button className="primary big-button" disabled={busy} onClick={onCheckIn}>
        Jestem, resetuj licznik
      </button>
      <div className="row">
        <input className="grow" placeholder="kwota tUSDC" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button disabled={busy} onClick={() => onDeposit(amount)}>
          Wpłać
        </button>
        <button disabled={busy} onClick={() => onWithdraw(amount)}>
          Wypłać
        </button>
      </div>
      <div className="row">
        <input
          className="grow"
          placeholder={will.guardian ? `strażnik: ${shortAddress(will.guardian)} (puste = usuń)` : "adres strażnika (opcjonalnie)"}
          value={guardian}
          onChange={(e) => setGuardian(e.target.value)}
        />
        <button disabled={busy} onClick={() => onGuardian(guardian)}>
          {will.guardian ? "Zmień strażnika" : "Ustaw strażnika"}
        </button>
      </div>
      <button
        className="danger"
        disabled={busy}
        onClick={() => {
          if (window.confirm("Zamknąć sejf? Wszystkie pieniądze wrócą do ciebie, a testament przestanie istnieć.")) onCancel();
        }}
      >
        Anuluj testament i zabierz wszystko
      </button>
    </div>
  );
}
