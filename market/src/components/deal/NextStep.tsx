import type { PublicKey } from "@solana/web3.js";
import { CircleAlert, FlaskConical, Hourglass, PackageCheck, PartyPopper, ShieldCheck, ShoppingBag, Store, Truck, Undo2, Wallet } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AttestRequest } from "../../attestor";
import { DEMO_BUYER_STEAM } from "../../config";
import { windowEnd, type Deal } from "../../data";
import { clock, formatPrice, formatTime, shortAddress } from "../../format";
import type { ActionRunner } from "../../hooks";
import type { Role } from "../../roles";
import { Button, cx, Disclosure, Field, Notice, Ring } from "../../ui";

export interface DealActions {
  readonly onConnect: () => void;
  readonly onAttest: (request: AttestRequest) => void;
  readonly onFund: (steamId: string) => void;
  readonly onCancel: () => void;
  readonly onFinalize: () => void;
  readonly onRefund: () => void;
  readonly onSimulateTrade: () => void;
}

interface NextStepProps extends DealActions {
  readonly deal: Deal;
  readonly now: number;
  readonly owner: PublicKey | undefined;
  readonly role: Role;
  readonly runner: ActionRunner;
  /** The Steam simulator can move this deal's item (both Steam accounts are demo accounts). */
  readonly simAvailable: boolean;
}

type Kind = "act" | "wait" | "done" | "fail";

interface ShellProps {
  readonly kind: Kind;
  readonly icon: ReactNode;
  readonly title: string;
  readonly text: ReactNode;
  readonly ring?: ReactNode;
  readonly children?: ReactNode;
}

const LABELS: Readonly<Record<Kind, string>> = { act: "Twój ruch", wait: "Oczekiwanie", done: "Podsumowanie", fail: "Podsumowanie" };

/** The one thing to look at in a deal: what is happening now, and the single action the viewer can take. */
function Shell({ kind, icon, title, text, ring, children }: ShellProps) {
  return (
    <section className={cx("next-step", `next-${kind}`)} aria-live="polite">
      <div className="next-main">
        <span className="next-icon">{icon}</span>
        <div className="stack tight grow">
          <span className="label">{LABELS[kind]}</span>
          <h3>{title}</h3>
          <p className="muted">{text}</p>
        </div>
        {ring}
      </div>
      {children ? <div className="next-actions">{children}</div> : null}
    </section>
  );
}

function Countdown({ now, start, end, caption, tone }: { readonly now: number; readonly start: number; readonly end: number; readonly caption: string; readonly tone: "accent" | "warn" }) {
  const span = Math.max(1, end - start);
  return (
    <Ring size={116} stroke={9} tone={tone} fraction={Math.max(0, (now - start) / span)}>
      <span className="ring-value">{clock(end - now)}</span>
      <span className="ring-caption">{caption}</span>
    </Ring>
  );
}

function BuyForm({ deal, busy, onFund }: { readonly deal: Deal; readonly busy: boolean; readonly onFund: (steamId: string) => void }) {
  const [steamId, setSteamId] = useState(DEMO_BUYER_STEAM);
  return (
    <div className="stack">
      <Field
        label="Twój SteamID64 (na to konto przyjdzie przedmiot)"
        value={steamId}
        onChange={(event) => setSteamId(event.target.value)}
        inputMode="numeric"
        mono
        hint="Inventory musi być publiczne, inaczej dostawy nie da się udowodnić. Ukrycie go po zapłacie, a przed dostawą, oznacza wypłatę dla sprzedającego."
      />
      <Button variant="primary" size="lg" block icon={<ShoppingBag />} disabled={busy} onClick={() => onFund(steamId)}>
        Kup za {formatPrice(deal.price)} tUSDC
      </Button>
    </div>
  );
}

export function NextStep(props: NextStepProps) {
  const { deal, now, owner, role, runner, simAvailable } = props;
  const isSeller = owner?.equals(deal.seller) ?? false;
  const sellerView = role === "seller";
  const busy = runner.busy || !owner;
  const price = `${formatPrice(deal.price)} tUSDC`;
  const end = windowEnd(deal);
  const connect = !owner ? (
    <Button variant="primary" size="lg" block icon={<Wallet />} onClick={props.onConnect}>
      Połącz portfel
    </Button>
  ) : null;

  if (deal.status === "completed") {
    return (
      <Shell kind="done" icon={<PartyPopper />} title="Transakcja zakończona" text={sellerView ? `Sprzedający dostał ${price}. Wszystko rozliczył program, bez pośrednika.` : `Sprzedający dostał ${price}, a przedmiot jest u Ciebie.`} />
    );
  }
  if (deal.status === "refunded") {
    return (
      <Shell kind="fail" icon={<Undo2 />} title="Zwrot dla kupującego" text={sellerView ? "Transakcja nie doszła do skutku: pieniądze wróciły do kupującego." : `Pieniądze (${price}) wróciły do Ciebie.`} />
    );
  }

  if (deal.status === "listed") {
    if (sellerView) {
      if (owner && !isSeller) {
        return (
          <Notice tone="warn">
            To ogłoszenie należy do konta {shortAddress(deal.seller)}, a jesteś połączony jako {shortAddress(owner)}. Przełącz konto w portfelu, żeby wykonać kroki sprzedającego.
          </Notice>
        );
      }
      return deal.listingVerified ? (
        <Shell kind="wait" icon={<Store />} title="Ogłoszenie jest na rynku" text="Czekasz na kupującego. Jego pieniądze trafią do sejfu programu, zanim cokolwiek przekażesz.">
          {connect ?? (
            <Button variant="outline" disabled={busy} onClick={props.onCancel}>
              Wycofaj ogłoszenie
            </Button>
          )}
        </Shell>
      ) : (
        <Shell kind="act" icon={<ShieldCheck />} title="Potwierdź, że masz ten przedmiot" text="Źródło sprawdzi Twoje publiczne inventory i podpisze potwierdzenie. Dopiero wtedy kupujący będzie mógł zapłacić.">
          {connect ?? (
            <>
              <Button variant="primary" size="lg" block icon={<ShieldCheck />} disabled={busy} onClick={() => props.onAttest("listing")}>
                Potwierdź w Steam
              </Button>
              <Button variant="ghost" disabled={busy} onClick={props.onCancel}>
                Wycofaj ogłoszenie
              </Button>
            </>
          )}
        </Shell>
      );
    }
    if (isSeller) {
      return (
        <Notice tone="info">To Twoje ogłoszenie. Kup coś od innego sprzedającego albo przełącz się na „Sprzedaję”, żeby nim zarządzać.</Notice>
      );
    }
    if (!deal.listingVerified) {
      return <Shell kind="wait" icon={<Hourglass />} title="Czekamy na potwierdzenie ze Steama" text="Kupić można dopiero, gdy źródło potwierdzi, że przedmiot jest u sprzedającego. Program tego pilnuje." />;
    }
    return (
      <Shell kind="act" icon={<ShoppingBag />} title="Kup ten przedmiot" text="Zapłacisz do sejfu programu, nie do sprzedającego. Dostanie on pieniądze dopiero po dostawie i oknie cofnięcia.">
        {connect ?? <BuyForm deal={deal} busy={busy} onFund={props.onFund} />}
      </Shell>
    );
  }

  if (deal.status === "funded") {
    const overdue = now > deal.deliveryDeadline;
    const ring = overdue ? undefined : <Countdown now={now} start={deal.fundedAt} end={deal.deliveryDeadline} caption="do końca terminu" tone="accent" />;
    if (sellerView) {
      return overdue ? (
        <Shell kind="fail" icon={<CircleAlert />} title="Termin dostawy minął" text="Kupujący może odzyskać pieniądze. Przedmiotu nie da się już dostarczyć w tej transakcji." />
      ) : (
        <Shell kind="act" icon={<Truck />} title="Przekaż przedmiot kupującemu" text={`Pieniądze (${price}) już leżą w sejfie programu. Wyślij przedmiot zwykłą wymianą na Steamie, a potem sprawdź dostawę.`} ring={ring}>
          {connect ?? (
            <>
              {simAvailable ? (
                <Button variant="soft" block icon={<FlaskConical />} disabled={busy} onClick={props.onSimulateTrade}>
                  Wyślij w symulatorze Steam (demo)
                </Button>
              ) : null}
              <Button variant="primary" size="lg" block icon={<PackageCheck />} disabled={busy} onClick={() => props.onAttest("delivery")}>
                Sprawdź, czy przedmiot dotarł
              </Button>
              <Disclosure title="Więcej opcji">
                <Button variant="link" disabled={busy} onClick={() => props.onAttest("buyer_hidden")}>
                  Kupujący ukrył inventory po zapłacie? Zgłoś (dostajesz pieniądze)
                </Button>
              </Disclosure>
            </>
          )}
        </Shell>
      );
    }
    return overdue ? (
      <Shell kind="act" icon={<Undo2 />} title="Sprzedający nie dostarczył na czas" text="Możesz odzyskać swoje pieniądze. Program zwróci je, bo termin dostawy minął.">
        {connect ?? (
          <Button variant="primary" size="lg" block icon={<Undo2 />} disabled={busy} onClick={props.onRefund}>
            Odzyskaj pieniądze
          </Button>
        )}
      </Shell>
    ) : (
      <Shell kind="wait" icon={<Hourglass />} title="Czekamy na sprzedającego" text={`Twoje pieniądze są bezpieczne w sejfie programu. Sprzedający ma czas do ${formatTime(deal.deliveryDeadline)} na przekazanie przedmiotu.`} ring={ring} />
    );
  }

  // delivered
  const windowOpen = now <= end;
  const ring = windowOpen ? <Countdown now={now} start={deal.deliveredAt} end={end} caption="okno cofnięcia" tone="warn" /> : undefined;
  if (sellerView) {
    return windowOpen ? (
      <Shell kind="wait" icon={<Hourglass />} title="Okno cofnięcia trwa" text="Przedmiot dotarł. Steam pozwala jeszcze cofnąć wymianę, więc program wstrzymuje wypłatę do końca okna." ring={ring}>
        <Button variant="primary" size="lg" block disabled>
          Wypłać mi {price} (za {clock(end - now)})
        </Button>
      </Shell>
    ) : (
      <Shell kind="act" icon={<PartyPopper />} title="Pieniądze czekają na Ciebie" text="Okno cofnięcia minęło i nikt nie udowodnił cofnięcia. Możesz odebrać wypłatę.">
        {connect ?? (
          <Button variant="primary" size="lg" block icon={<Wallet />} disabled={busy} onClick={props.onFinalize}>
            Wypłać mi {price}
          </Button>
        )}
      </Shell>
    );
  }
  return windowOpen ? (
    <Shell kind="wait" icon={<PackageCheck />} title="Przedmiot dotarł" text="Sprzedający dostanie pieniądze po zamknięciu okna cofnięcia. Jeśli wcześniej cofnie wymianę, dostaniesz zwrot." ring={ring}>
      {connect ?? (
        <>
          <Button variant="outline" block icon={<ShieldCheck />} disabled={busy} onClick={() => props.onAttest("reversal")}>
            Sprawdź, czy wymiana nie została cofnięta
          </Button>
          <Disclosure title="Więcej opcji">
            <Button variant="link" disabled={busy} onClick={() => props.onAttest("seller_hidden")}>
              Sprzedający ukrył inventory? Zgłoś (dostajesz zwrot)
            </Button>
          </Disclosure>
        </>
      )}
    </Shell>
  ) : (
    <Shell kind="wait" icon={<Hourglass />} title="Okno cofnięcia minęło" text="Przedmiot jest Twój. Sprzedający może teraz odebrać pieniądze z sejfu programu." />
  );
}
