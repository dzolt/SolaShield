import { deployment, MAX_VETOES } from "../config";
import { formatDuration } from "../format";

/** The rules in one glance: who holds the money, what starts the payout and who can stop it. */
export function HowItWorks() {
  const inactivity = formatDuration(deployment.inactivityPeriod);
  const claim = formatDuration(deployment.claimPeriod);
  return (
    <section className="how">
      <div className="how-step">
        <b>1. Sejf należy do programu, nie do nas</b>
        <span>Wpłacać i wypłacać możesz tylko ty. Każdy twój podpis (wpłata, wypłata, „Jestem”) resetuje licznik.</span>
      </div>
      <div className="how-step">
        <b>2. Cisza przez {inactivity} uruchamia procedurę</b>
        <span>
          Masz wtedy jeszcze {claim}, żeby się zameldować. W produkcji to 90 i 30 dni, w demo {inactivity} i {claim}.
        </span>
      </div>
      <div className="how-step">
        <b>3. Potem wypłatę może uruchomić każdy</b>
        <span>Program dzieli saldo według procentów z testamentu. Każdy spadkobierca odbiera swoją część osobno, reszta z zaokrągleń trafia do ostatniego.</span>
      </div>
      <div className="how-step trust">
        <b>Kto co może</b>
        <span>
          Strażnik może {MAX_VETOES} razy przerwać procedurę, gdy cię nie ma, ale nie ruszy pieniędzy. Listę spadkobierców możesz zablokować na zawsze. Dopóki
          nikt nie uruchomił wypłaty, możesz się zameldować albo zamknąć sejf.
        </span>
      </div>
    </section>
  );
}
