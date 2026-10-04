import { ArrowRight, Gift, KeyRound, Leaf, ShieldCheck } from "lucide-react";
import { deployment, MAX_VETOES } from "../../config";
import type { Role } from "../../data";
import { formatDuration } from "../../format";
import { Disclosure } from "../../ui";

interface LandingProps {
  readonly onPick: (role: Role) => void;
}

/** First screen: the idea in one sentence, who you are, and how it works in three steps. */
export function Landing({ onPick }: LandingProps) {
  const inactivity = formatDuration(deployment.inactivityPeriod);
  const claim = formatDuration(deployment.claimPeriod);
  const steps = [
    { title: "Wpłacasz i wskazujesz bliskich", text: "Odkładasz tokeny do sejfu programu i dzielisz je procentami między wybrane osoby. Sejf należy do programu, nie do nikogo z nas." },
    { title: "Meldujesz się, gdy chcesz", text: `Cisza przez ${inactivity} uruchamia procedurę, a Ty masz jeszcze ${claim} na reakcję. W produkcji to 90 i 30 dni.` },
    { title: "Program dzieli saldo", text: "Każdy spadkobierca odbiera swój udział osobno, bez notariusza, banku i hasła w sejfie." },
  ];
  return (
    <main className="page">
      <section className="hero fade-up">
        <span className="badge badge-accent">
          <Leaf size={14} aria-hidden="true" /> Przekazanie środków bez pośrednika
        </span>
        <h1>
          Zadbaj o bliskich, <em>gdy Cię zabraknie.</em>
        </h1>
        <p className="lead">Odkładasz tokeny do sejfu na Solanie. Jeśli przestaniesz się meldować, program sam podzieli je między wskazane osoby.</p>
      </section>

      <section className="role-cards three fade-up" aria-label="Wybierz rolę">
        <button type="button" className="role-card" onClick={() => onPick("owner")}>
          <span className="role-icon">
            <KeyRound aria-hidden="true" />
          </span>
          <h2>Zakładam sejf</h2>
          <p>Wpłacasz środki, wskazujesz spadkobierców i meldujesz się od czasu do czasu.</p>
          <span className="role-go">
            Jestem właścicielem <ArrowRight aria-hidden="true" />
          </span>
        </button>
        <button type="button" className="role-card" onClick={() => onPick("guardian")}>
          <span className="role-icon">
            <ShieldCheck aria-hidden="true" />
          </span>
          <h2>Pilnuję</h2>
          <p>Możesz wstrzymać wypłatę, gdy właściciel jest tylko nieosiągalny. Nie masz dostępu do pieniędzy.</p>
          <span className="role-go">
            Jestem strażnikiem <ArrowRight aria-hidden="true" />
          </span>
        </button>
        <button type="button" className="role-card" onClick={() => onPick("heir")}>
          <span className="role-icon">
            <Gift aria-hidden="true" />
          </span>
          <h2>Dziedziczę</h2>
          <p>Widzisz swój udział i odbierasz go, gdy przyjdzie na to czas.</p>
          <span className="role-go">
            Jestem spadkobiercą <ArrowRight aria-hidden="true" />
          </span>
        </button>
      </section>

      <section className="how-steps" aria-label="Jak to działa">
        {steps.map((step, index) => (
          <div className="how-step" key={step.title}>
            <span className="how-num">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
        ))}
      </section>

      <div className="landing-note stack">
        <Disclosure title="Kto co może">
          <p className="muted">
            Strażnik może {MAX_VETOES} razy przerwać procedurę, gdy Cię nie ma, ale nie ruszy pieniędzy. Listę spadkobierców możesz zablokować na zawsze, a dopóki nikt nie uruchomił wypłaty, możesz się
            zameldować albo zamknąć sejf. Wypłatę uruchomić może każdy, ale pieniądze zawsze trafiają tylko do wpisanych spadkobierców.
          </p>
        </Disclosure>
        <Disclosure title="Ważne zastrzeżenie">
          <p className="muted">
            To demonstracja mechanizmu na sieci testowej (devnet), z testowymi tokenami. Nie zastępuje testamentu w rozumieniu prawa spadkowego i nie był audytowany.
          </p>
        </Disclosure>
      </div>
    </main>
  );
}
