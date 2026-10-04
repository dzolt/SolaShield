import { ATTESTOR_KEY, deployment } from "../config";
import { formatDuration, shortAddress } from "../format";

/** The rules in one glance: where the money is, who decides, and what the attestor can and cannot do. */
export function HowItWorks() {
  return (
    <section className="how">
      <div className="how-step">
        <b>1. Kupujący płaci do sejfu programu</b>
        <span>
          Nie do sprzedającego i nie do nas. Sejfem rządzi tylko kod programu (PDA). Płacić można tylko z publicznym inventory, bo tylko z niego da się
          udowodnić dostawę.
        </span>
      </div>
      <div className="how-step">
        <b>2. Sprzedający wysyła skina zwykłą wymianą na Steamie</b>
        <span>Steam rozpoznaje egzemplarz po nazwie, floacie i wzorze. ID przedmiotu po wymianie się zmienia, to nie przeszkadza.</span>
      </div>
      <div className="how-step">
        <b>3. Steam potwierdza dostawę, potem czekamy na okno cofnięcia</b>
        <span>
          Od 2025 r. sprzedający może cofnąć wymianę przez 7 dni. Program płaci dopiero po tym oknie (w demo {formatDuration(deployment.protectionPeriod)}
          {" + "}
          {formatDuration(deployment.gracePeriod)}), a dowód cofnięcia oznacza zwrot dla kupującego.
        </span>
      </div>
      <div className="how-step trust">
        <b>Kto co może</b>
        <span>
          Atestator ({shortAddress(ATTESTOR_KEY)}) tylko podpisuje, co widzi w publicznym inventory. Nie rusza pieniędzy. Transakcję z jego podpisem może wysłać
          każdy, a decyzję podejmuje program.
        </span>
      </div>
    </section>
  );
}
