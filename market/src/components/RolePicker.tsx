import type { PublicKey } from "@solana/web3.js";
import { shortAddress } from "../format";
import type { Role } from "../roles";

interface RoleInfo {
  readonly role: Role;
  readonly icon: string;
  readonly title: string;
  readonly summary: string;
  readonly can: readonly string[];
}

export const ROLE_INFO: Readonly<Record<Role, RoleInfo>> = {
  seller: {
    role: "seller",
    icon: "🏷️",
    title: "Sprzedający",
    summary: "Mam aktywo cyfrowe i chcę dostać pieniądze, nie ryzykując, że kupujący zniknie.",
    can: [
      "wystawiam aktywo, a źródło dowodu potwierdza, że naprawdę je mam",
      "przekazuję je zwykłym kanałem (w demo: wymiana na Steamie)",
      "pieniądze dostaję z sejfu programu, gdy minie okno cofnięcia przekazania",
    ],
  },
  buyer: {
    role: "buyer",
    icon: "🛒",
    title: "Kupujący",
    summary: "Chcę kupić aktywo i mieć pewność, że pieniądze nie trafią do oszusta.",
    can: [
      "płacę do sejfu programu, nie do sprzedającego",
      "pieniądze wracają do mnie, gdy aktywo nie dotrze albo przekazanie zostanie cofnięte",
      "muszę mieć konto, na którym dostawę da się publicznie sprawdzić (w demo: publiczne inventory na Steamie)",
    ],
  },
};

const ORDER: readonly Role[] = ["seller", "buyer"];

/** First screen: who are you in this deal? The choice decides what the rest of the app shows. */
export function RolePicker({ onPick }: { readonly onPick: (role: Role) => void }) {
  return (
    <section className="stack">
      <h2 className="picker-title">Kim jesteś w tej transakcji?</h2>
      <p className="muted">Wybierz rolę, a pokażemy tylko to, co możesz zrobić. Rolę można zmienić w każdej chwili.</p>
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

export function RoleBar({ role, owner, onBack }: { readonly role: Role; readonly owner: PublicKey | undefined; readonly onBack: () => void }) {
  const info = ROLE_INFO[role];
  return (
    <div className="row between role-bar">
      <span>
        <span className="role-icon small-icon">{info.icon}</span> <b>{info.title}</b>
        <span className="muted small"> · {owner ? `konto ${shortAddress(owner)}` : "portfel niepołączony"}</span>
      </span>
      <button className="chip" onClick={onBack}>
        ← zmień rolę
      </button>
    </div>
  );
}
