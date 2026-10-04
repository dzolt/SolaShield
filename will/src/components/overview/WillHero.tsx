import { explorerAddress } from "../../config";
import { phaseOf, type Role, type Will } from "../../data";
import { formatPrice, shortAddress, timeLeft } from "../../format";
import { countdownOf, stageOf } from "../../phases";
import { Party, Ring, Stat } from "../../ui";
import { PhaseTrack } from "./PhaseTrack";

const NOTES: Readonly<Record<Role, Readonly<Record<ReturnType<typeof phaseOf>, string>>>> = {
  owner: {
    active: "Każde zameldowanie i każda wpłata zerują licznik.",
    pending: "Zamelduj się teraz, żeby przerwać procedurę.",
    claimable: "Procedura minęła. Dopóki nikt nie uruchomi wypłaty, nadal możesz się zameldować.",
    distributing: "Wypłata ruszyła. Nie można już niczego zmienić.",
  },
  guardian: {
    active: "Właściciel jest aktywny. Weto będzie możliwe dopiero, gdy zamilknie.",
    pending: "Właściciel milczy. Jeśli wiesz, że żyje, możesz użyć weta.",
    claimable: "Wypłata jest gotowa, ale do jej uruchomienia nadal możesz użyć weta.",
    distributing: "Wypłata ruszyła, weto nie jest już możliwe.",
  },
  heir: {
    active: "Właściciel jest aktywny. Nic nie musisz robić.",
    pending: "Właściciel milczy. Po zakończeniu procedury będzie można uruchomić wypłatę.",
    claimable: "Procedura minęła: wypłatę może uruchomić każdy, także Ty.",
    distributing: "Środki zostały podzielone. Odbierz swój udział.",
  },
};

/** The state of one will at a glance: how much is in it, who is involved, and the timer that matters now. */
export function WillHero({ will, now, role }: { readonly will: Will; readonly now: number; readonly role: Role }) {
  const phase = phaseOf(will, now);
  const stage = stageOf(phase);
  const countdown = countdownOf(will, now);
  const frozen = will.distributing;
  const amount = frozen ? will.distributedTotal : will.balance;
  const ringTone = stage.tone === "accent" ? "accent" : stage.tone === "neutral" ? "ok" : stage.tone;
  const ringValue = phase === "claimable" ? "Gotowe" : phase === "distributing" ? "W toku" : timeLeft(countdown.remaining);

  return (
    <section className="card hero-card">
      <div className="hero-card-main">
        <div className="stack loose grow">
          <div className="stack tight">
            <span className="label">{frozen ? "Do podziału" : "W sejfie"}</span>
            <div className="big-amount">
              <b>{formatPrice(amount)}</b>
              <span>tUSDC</span>
            </div>
          </div>
          <div className="stack tight">
            <h2 className="hero-headline">{stage.headline}</h2>
            <p className="muted">{NOTES[role][phase]}</p>
          </div>
          <div className="row hero-people">
            <Stat label="Właściciel" value={<Party address={will.owner.toBase58()} short={shortAddress(will.owner)} href={explorerAddress(will.owner.toBase58())} />} />
            <Stat
              label="Strażnik"
              value={
                will.guardian ? <Party address={will.guardian.toBase58()} short={shortAddress(will.guardian)} href={explorerAddress(will.guardian.toBase58())} /> : <span className="muted">brak</span>
              }
            />
          </div>
        </div>
        <div className="hero-ring">
          <Ring size={176} stroke={12} tone={ringTone} fraction={countdown.fraction}>
            <span className="ring-value ring-value-sm">{ringValue}</span>
            <span className="ring-caption">{countdown.caption}</span>
          </Ring>
        </div>
      </div>
      <PhaseTrack will={will} now={now} />
    </section>
  );
}
