import { useState } from "react";
import type { Will } from "../data";
import { shortAddress } from "../format";
import { Section } from "../ui";

interface BusyProps {
  readonly busy: boolean;
}

/** Everything below is what the owner can do while the payout has not been triggered. Each action is also a sign of life. */

export function CheckInSection({ busy, onCheckIn }: BusyProps & { readonly onCheckIn: () => void }) {
  return (
    <Section title="Sygnał życia">
      <p className="muted">Każda Twoja transakcja zeruje licznik, ale możesz też po prostu dać znać, że jesteś.</p>
      <button className="primary big-button" disabled={busy} onClick={onCheckIn}>
        Jestem, resetuj licznik
      </button>
    </Section>
  );
}

export function FundsSection({ busy, onDeposit, onWithdraw }: BusyProps & { readonly onDeposit: (amount: string) => void; readonly onWithdraw: (amount: string) => void }) {
  const [amount, setAmount] = useState("");
  return (
    <Section title="Środki w sejfie">
      <div className="row">
        <input className="grow" placeholder="kwota tUSDC" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="primary" disabled={busy} onClick={() => onDeposit(amount)}>
          Wpłać
        </button>
        <button disabled={busy} onClick={() => onWithdraw(amount)}>
          Wypłać
        </button>
      </div>
    </Section>
  );
}

export function GuardianSection({ will, busy, onGuardian }: BusyProps & { readonly will: Will; readonly onGuardian: (address: string) => void }) {
  const [guardian, setGuardian] = useState("");
  return (
    <Section title="Strażnik z prawem weta">
      <p className="muted">Osoba, która może wstrzymać wypłatę, gdy jesteś tylko nieosiągalny. Nie ma dostępu do pieniędzy. Pole zostaw puste, żeby usunąć strażnika.</p>
      <div className="row">
        <input
          className="grow"
          placeholder={will.guardian ? `teraz: ${shortAddress(will.guardian)}` : "adres portfela (opcjonalnie)"}
          value={guardian}
          onChange={(e) => setGuardian(e.target.value)}
        />
        <button disabled={busy} onClick={() => onGuardian(guardian)}>
          {will.guardian ? "Zmień strażnika" : "Ustaw strażnika"}
        </button>
      </div>
    </Section>
  );
}

export function DangerSection({ busy, onCancel }: BusyProps & { readonly onCancel: () => void }) {
  return (
    <Section>
      <div className="danger-zone">
        <span className="muted">Anulowanie zamyka sejf: wszystkie pieniądze wracają do Ciebie, a testament przestaje istnieć.</span>
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
    </Section>
  );
}
