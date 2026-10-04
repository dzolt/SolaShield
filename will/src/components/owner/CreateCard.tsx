import { Coins, KeyRound, Leaf, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { deployment } from "../../config";
import { formatDuration } from "../../format";
import { Button, Card, Disclosure, Field } from "../../ui";

interface CreateCardProps {
  readonly connected: boolean;
  readonly busy: boolean;
  readonly onCreate: (guardian: string) => void;
  readonly onConnect: () => void;
}

const STEPS = [
  { icon: <Leaf />, title: "Zakładasz sejf", text: "Dostaje własny adres i konto na tokeny, osobne od wszystkich innych." },
  { icon: <Coins />, title: "Wpłacasz środki", text: "Wpłacać i wypłacać możesz tylko Ty." },
  { icon: <Users />, title: "Wskazujesz bliskich", text: "Dzielisz saldo procentami między wybrane osoby." },
];

/** The first thing an owner sees: what a vault is, in three steps, and one button to create it. */
export function CreateCard({ connected, busy, onCreate, onConnect }: CreateCardProps) {
  const [guardian, setGuardian] = useState("");
  return (
    <Card className="create-card">
      <div className="create-head">
        <span className="create-icon">
          <KeyRound aria-hidden="true" />
        </span>
        <div className="stack tight">
          <h2>Załóż swój sejf</h2>
          <p className="muted">
            Cisza przez {formatDuration(deployment.inactivityPeriod)} uruchomi procedurę, a potem masz jeszcze {formatDuration(deployment.claimPeriod)} na reakcję. Każde zameldowanie zeruje licznik.
          </p>
        </div>
      </div>
      <ol className="create-steps">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <span className="create-step-icon">{step.icon}</span>
            <div className="stack tight">
              <strong>
                {index + 1}. {step.title}
              </strong>
              <span className="muted small">{step.text}</span>
            </div>
          </li>
        ))}
      </ol>
      <Disclosure title="Dodaj strażnika (opcjonalnie)">
        <Field
          label="Adres portfela strażnika"
          hint="Strażnik może wstrzymać wypłatę, gdy jesteś tylko nieosiągalny. Nie ma dostępu do pieniędzy. Możesz ustawić go później."
          placeholder="np. 7tNa…sSsF"
          value={guardian}
          onChange={(event) => setGuardian(event.target.value)}
          mono
        />
      </Disclosure>
      {connected ? (
        <Button variant="primary" size="lg" block icon={<Leaf />} loading={busy} onClick={() => onCreate(guardian)}>
          Załóż sejf
        </Button>
      ) : (
        <Button variant="primary" size="lg" block icon={<Wallet />} onClick={onConnect}>
          Połącz portfel, żeby założyć sejf
        </Button>
      )}
    </Card>
  );
}
