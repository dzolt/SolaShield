import { ArrowRight, ShieldCheck, ShoppingBag, Tag } from "lucide-react";
import { ATTESTOR_KEY, deployment } from "../../config";
import { formatDuration, shortAddress } from "../../format";
import type { Role } from "../../roles";
import { Disclosure } from "../../ui";

interface LandingProps {
  readonly onPick: (role: Role) => void;
}

const steps = (reversalWindow: string) => [
  { title: "Kupujący płaci do sejfu", text: "Nie do sprzedającego i nie do nas. Sejfem rządzi wyłącznie kod programu na Solanie." },
  { title: "Sprzedający przekazuje aktywo", text: "Zwykłym kanałem. W demo to wymiana skina CS2 na Steamie." },
  { title: "Źródło potwierdza, program wypłaca", text: `Po oknie cofnięcia (w demo ${reversalWindow}, na Steamie 7 dni) pieniądze trafiają do sprzedającego, a przy cofnięciu wracają do kupującego.` },
];

/** First screen: what this is in one sentence, who you are, and how it works in three steps. */
export function Landing({ onPick }: LandingProps) {
  const reversalWindow = `${formatDuration(deployment.protectionPeriod)} + ${formatDuration(deployment.gracePeriod)}`;
  return (
    <main className="page">
      <section className="hero fade-up">
        <span className="badge badge-accent">
          <ShieldCheck size={14} aria-hidden="true" /> Wymiana aktywów cyfrowych
        </span>
        <h1>
          Handluj z obcymi. <em>Bez pośrednika.</em>
        </h1>
        <p className="lead">Pieniądze czekają w sejfie programu na Solanie. Wypłata następuje dopiero wtedy, gdy publiczne źródło potwierdzi, że aktywo dotarło.</p>
      </section>

      <section className="role-cards fade-up" aria-label="Wybierz rolę">
        <button type="button" className="role-card" onClick={() => onPick("buyer")}>
          <span className="role-icon">
            <ShoppingBag aria-hidden="true" />
          </span>
          <h2>Kupuję</h2>
          <p>Płacisz do sejfu programu, nie do sprzedającego. Jeśli aktywo nie dotrze, dostajesz zwrot.</p>
          <span className="role-go">
            Przeglądaj rynek <ArrowRight aria-hidden="true" />
          </span>
        </button>
        <button type="button" className="role-card" onClick={() => onPick("seller")}>
          <span className="role-icon">
            <Tag aria-hidden="true" />
          </span>
          <h2>Sprzedaję</h2>
          <p>Wystawiasz aktywo i widzisz, że pieniądze już są w sejfie, zanim cokolwiek przekażesz.</p>
          <span className="role-go">
            Wystaw przedmiot <ArrowRight aria-hidden="true" />
          </span>
        </button>
      </section>

      <section className="how-steps" aria-label="Jak to działa">
        {steps(reversalWindow).map((step, index) => (
          <div className="how-step" key={step.title}>
            <span className="how-num">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
        ))}
      </section>

      <div className="landing-note">
        <Disclosure title="Kto potwierdza dostawę i czy trzeba mu ufać?">
          <p className="muted">
            Atestator ({shortAddress(ATTESTOR_KEY)}) podpisuje wyłącznie to, co widzi w publicznym źródle (w demo: inventory Steam). Nie rusza pieniędzy, a transakcję z jego podpisem może wysłać każdy;
            decyzję podejmuje program, a hash każdego dowodu jest zapisany na łańcuchu. W MVP to jeden klucz, docelowo dowód kryptograficzny (zkTLS) i kilku niezależnych atestatorów.
          </p>
        </Disclosure>
      </div>
    </main>
  );
}
