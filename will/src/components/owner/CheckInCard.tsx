import { Heart } from "lucide-react";
import type { Phase } from "../../data";
import { Button } from "../../ui";

const COPY: Readonly<Record<Phase, { readonly title: string; readonly text: string }>> = {
  active: { title: "Daj znać, że jesteś", text: "Zameldowanie zeruje licznik. Każda Twoja wpłata i wypłata robi to samo, więc zwykle nie musisz o tym pamiętać." },
  pending: { title: "Zamelduj się teraz", text: "Właściciel milczał zbyt długo i trwa procedura wypłaty. Jedno kliknięcie ją przerywa i zeruje licznik." },
  claimable: { title: "Jeszcze możesz się zameldować", text: "Procedura minęła, ale nikt nie uruchomił wypłaty. Zameldowanie przywraca wszystko do początku." },
  distributing: { title: "", text: "" },
};

export function CheckInCard({ phase, busy, onCheckIn }: { readonly phase: Phase; readonly busy: boolean; readonly onCheckIn: () => void }) {
  const copy = COPY[phase];
  return (
    <section className={`card card-pad checkin checkin-${phase}`}>
      <span className="checkin-icon">
        <Heart aria-hidden="true" />
      </span>
      <div className="stack tight grow">
        <h3>{copy.title}</h3>
        <p className="muted">{copy.text}</p>
      </div>
      <Button variant="primary" size="lg" icon={<Heart />} disabled={busy} onClick={onCheckIn}>
        Jestem, resetuj licznik
      </Button>
    </section>
  );
}
