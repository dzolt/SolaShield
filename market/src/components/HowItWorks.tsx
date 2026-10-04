import { ATTESTOR_KEY, deployment } from "../config";
import { formatDuration, shortAddress } from "../format";

/** The rules in one glance: where the money is, who decides, and what the attestor can and cannot do. */
export function HowItWorks() {
  return (
    <section className="how">
      <div className="how-step">
        <b>1. Kupujący płaci do sejfu programu</b>
        <span>
          Nie do sprzedającego i nie do nas. Sejfem rządzi tylko kod programu (PDA). Płacić można tylko wtedy, gdy źródło dowodu może później potwierdzić
          dostawę (w demo: publiczne inventory Steam).
        </span>
      </div>
      <div className="how-step">
        <b>2. Sprzedający przekazuje aktywo zwykłym kanałem</b>
        <span>W demo to wymiana skina CS2 na Steamie. Aktywo rozpoznajemy po cechach, które nie zmieniają się przy przekazaniu (tu: nazwa, float i wzór, bo ID przedmiotu się zmienia).</span>
      </div>
      <div className="how-step">
        <b>3. Źródło potwierdza dostawę, potem czekamy na okno cofnięcia</b>
        <span>
          Przekazanie bywa odwracalne (na Steamie przez 7 dni). Program płaci dopiero po tym oknie (w demo {formatDuration(deployment.protectionPeriod)}
          {" + "}
          {formatDuration(deployment.gracePeriod)}), a dowód cofnięcia oznacza zwrot dla kupującego.
        </span>
      </div>
      <div className="how-step trust">
        <b>Kto co może</b>
        <span>
          Atestator ({shortAddress(ATTESTOR_KEY)}) tylko podpisuje, co widzi w publicznym źródle (w demo: inventory Steam). Nie rusza pieniędzy. Transakcję z jego podpisem może wysłać
          każdy, a decyzję podejmuje program.
        </span>
      </div>
    </section>
  );
}
