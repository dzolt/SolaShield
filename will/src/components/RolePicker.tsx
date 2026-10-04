import { deployment, MAX_VETOES } from "../config";
import { formatDuration } from "../format";
import type { Role } from "../data";

interface RoleInfo {
  readonly role: Role;
  readonly icon: string;
  readonly title: string;
  readonly summary: string;
  readonly can: readonly string[];
}

export const ROLE_INFO: Readonly<Record<Role, RoleInfo>> = {
  owner: {
    role: "owner",
    icon: "🗝️",
    title: "Założyciel sejfu",
    summary: "Odkładam pieniądze i wskazuję, kto je dostanie, gdy mnie zabraknie.",
    can: ["zakładam sejf i wpłacam tUSDC", "wskazuję spadkobierców z procentami i mogę zablokować listę", "meldam się, wypłacam albo anuluję sejf", "wyznaczam strażnika"],
  },
  guardian: {
    role: "guardian",
    icon: "🛡️",
    title: "Strażnik",
    summary: "Ktoś mi zaufał: mogę wstrzymać wypłatę, gdy właściciel jest tylko nieosiągalny.",
    can: [`mogę zgłosić weto (najwyżej ${MAX_VETOES} razy), gdy właściciel zamilkł`, "weto zeruje licznik na nowo", "nie mam dostępu do pieniędzy"],
  },
  heir: {
    role: "heir",
    icon: "🎁",
    title: "Spadkobierca",
    summary: "Ktoś wpisał mnie do testamentu i chcę widzieć swój udział i odebrać go w swoim czasie.",
    can: ["widzę swój procent i ile dostałbym dziś", "po upływie obu okresów uruchamiam wypłatę", "odbieram swój udział, bez czekania na pozostałych"],
  },
};

const ORDER: readonly Role[] = ["owner", "guardian", "heir"];

/** First screen: who are you in this will? The choice decides what the rest of the app shows. */
export function RolePicker({ onPick }: { readonly onPick: (role: Role) => void }) {
  return (
    <section className="stack">
      <h2 className="picker-title">Kim jesteś w tym testamencie?</h2>
      <p className="muted">
        Pieniądze wypłaca się po {formatDuration(deployment.inactivityPeriod)} ciszy właściciela i {formatDuration(deployment.claimPeriod)} procedury (produkcyjnie 90 i 30
        dni). Wybierz rolę, a pokażemy tylko to, co możesz zrobić.
      </p>
      <div className="role-tiles">
        {ORDER.map((role) => {
          const info = ROLE_INFO[role];
          return (
            <button key={role} className="role-tile" onClick={() => onPick(role)}>
              <span className="role-icon">{info.icon}</span>
              <b>{info.title}</b>
              <span className="muted">{info.summary}</span>
              <ul>
                {info.can.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function RoleBar({ role, onBack }: { readonly role: Role; readonly onBack: () => void }) {
  const info = ROLE_INFO[role];
  return (
    <div className="row between role-bar">
      <span>
        <span className="role-icon small-icon">{info.icon}</span> <b>{info.title}</b>
      </span>
      <button className="chip" onClick={onBack}>
        ← zmień rolę
      </button>
    </div>
  );
}
