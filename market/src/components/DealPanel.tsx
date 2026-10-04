import type { PublicKey } from "@solana/web3.js";
import { useState } from "react";
import type { AttestRequest, AttestResult } from "../attestor";
import { DEMO_BUYER_STEAM, explorerAddress } from "../config";
import { windowEnd, type Deal } from "../data";
import { formatDuration, formatTime, formatUsdc, shortAddress, shortWear } from "../format";
import type { ActionRunner } from "../hooks";
import type { Role } from "../roles";
import { dealLabel } from "../status";
import { Badge, Card, Party, Progress, Section } from "../ui";
import { ItemTile } from "./ItemTile";
import { ProofCard } from "./ProofCard";

interface DealPanelProps {
  readonly role: Role;
  readonly deal: Deal | undefined;
  readonly now: number;
  readonly owner: PublicKey | undefined;
  readonly runner: ActionRunner;
  readonly proofs: readonly AttestResult[];
  readonly look: { icon?: string; color?: string };
  readonly onAttest: (request: AttestRequest) => void;
  readonly onFund: (steamId: string) => void;
  readonly onCancel: () => void;
  readonly onFinalize: () => void;
  readonly onRefund: () => void;
}

interface Step {
  readonly title: string;
  readonly detail: string;
  readonly state: "done" | "active" | "todo" | "failed";
}

function steps(deal: Deal, now: number): Step[] {
  const funded = deal.fundedAt > 0;
  const delivered = deal.deliveredAt > 0;
  const settled = deal.status === "completed" || deal.status === "refunded";
  const end = windowEnd(deal);
  return [
    {
      title: "Wystawiony",
      detail: `${formatTime(deal.createdAt)} · ${deal.listingVerified ? "Steam potwierdził, że przedmiot jest u sprzedającego" : "jeszcze bez potwierdzenia ze Steama"}`,
      state: "done",
    },
    {
      title: "Zapłata do sejfu programu",
      detail: funded
        ? `${formatTime(deal.fundedAt)} · ${formatUsdc(deal.price)} czeka w sejfie (inventory kupującego było publiczne)`
        : "czeka na kupującego, który musi mieć publiczne inventory",
      state: funded ? "done" : "active",
    },
    {
      title: "Dostawa potwierdzona przez Steam",
      detail: delivered
        ? `${formatTime(deal.deliveredAt)} · przedmiot w inventory kupującego`
        : funded
          ? `sprzedający ma czas do ${formatTime(deal.deliveryDeadline)}`
          : "po zapłacie",
      state: delivered ? "done" : deal.status === "refunded" ? "failed" : funded ? "active" : "todo",
    },
    {
      title: "Okno cofnięcia wymiany",
      detail: delivered
        ? now > end
          ? `zamknięte ${formatTime(end)}`
          : `jeszcze ${formatDuration(end - now)} (do ${formatTime(end)})`
        : `ochrona ${formatDuration(deal.protectionPeriod)} + zapas ${formatDuration(deal.gracePeriod)}`,
      state: delivered ? (now > end || settled ? "done" : "active") : "todo",
    },
    {
      title: "Rozliczenie",
      detail: settled
        ? `${formatTime(deal.settledAt)} · ${deal.status === "completed" ? "pieniądze u sprzedającego" : "pieniądze wróciły do kupującego"}`
        : "wypłata albo zwrot, zawsze według reguł programu",
      state: deal.status === "completed" ? "done" : deal.status === "refunded" ? "failed" : "todo",
    },
  ];
}

export function DealPanel({ role, deal, now, owner, runner, proofs, look, onAttest, onFund, onCancel, onFinalize, onRefund }: DealPanelProps) {
  const [buyerSteam, setBuyerSteam] = useState(DEMO_BUYER_STEAM);
  if (!deal) {
    return (
      <Card title="Transakcja">
        <p className="muted">
          {role === "seller"
            ? "Wybierz swoje ogłoszenie, żeby zobaczyć jego stan, dowody ze Steama i kolejne kroki."
            : "Wybierz ogłoszenie z rynku, żeby zobaczyć jego stan, dowody ze Steama i dostępne kroki."}
        </p>
      </Card>
    );
  }
  const label = dealLabel(deal, now);
  const isSeller = owner?.equals(deal.seller) ?? false;
  const sellerView = role === "seller";
  const end = windowEnd(deal);
  const busy = runner.busy || !owner;

  return (
    <Card title="Transakcja" aside={<Badge tone={label.tone}>{label.text}</Badge>}>
      <div className="deal-head">
        <ItemTile name={deal.itemName} wear={deal.wear} pattern={deal.pattern} icon={look.icon} color={look.color} />
        <div className="stack">
          <div className="big">{formatUsdc(deal.price)}</div>
          <span className="muted" title={deal.wear}>
            float {shortWear(deal.wear)} · wzór {deal.pattern}
          </span>
          <div className="parties">
            <span className="muted small">Sprzedający</span>
            <div className="party-line">
              <Party address={deal.seller.toBase58()} short={shortAddress(deal.seller)} href={explorerAddress(deal.seller.toBase58())} />
              <span className="muted small">Steam {deal.sellerSteamId}</span>
            </div>
            {deal.buyer ? (
              <>
                <span className="muted small">Kupujący</span>
                <div className="party-line">
                  <Party address={deal.buyer.toBase58()} short={shortAddress(deal.buyer)} href={explorerAddress(deal.buyer.toBase58())} />
                  <span className="muted small">Steam {deal.buyerSteamId}</span>
                </div>
              </>
            ) : null}
          </div>
          <a className="small" href={explorerAddress(deal.address.toBase58())} target="_blank" rel="noreferrer">
            konto transakcji {shortAddress(deal.address)} w Explorerze
          </a>
        </div>
      </div>

      <ol className="steps">
        {steps(deal, now).map((s) => (
          <li key={s.title} className={s.state}>
            <b>{s.title}</b>
            <span>{s.detail}</span>
          </li>
        ))}
      </ol>

      {deal.status === "delivered" ? (
        <Progress fraction={(now - deal.deliveredAt) / Math.max(1, end - deal.deliveredAt)} tone={now > end ? undefined : "warn"} />
      ) : null}

      {owner && sellerView && !isSeller ? (
        <p className="banner">
          To ogłoszenie należy do konta {shortAddress(deal.seller)}, a jesteś połączony jako {shortAddress(owner)}. Przełącz konto w Phantomie, żeby wykonać kroki sprzedającego.
        </p>
      ) : null}
      {!owner ? <p className="hint">Połącz portfel, żeby wykonać kolejny krok. Każdy krok może wykonać każdy: liczy się dowód, nie to, kto go wysyła.</p> : null}

      <div className="actions">
        {deal.status === "listed" ? (
          sellerView ? (
            <>
              {!deal.listingVerified ? (
                <button className="primary" disabled={busy} onClick={() => onAttest("listing")}>
                  Potwierdź w Steam, że skin jest u mnie
                </button>
              ) : (
                <span className="muted">Ogłoszenie jest na rynku. Czekasz na kupującego, pieniądze trafią do sejfu programu.</span>
              )}
              {isSeller ? (
                <button disabled={busy} onClick={onCancel}>
                  Wycofaj ogłoszenie
                </button>
              ) : null}
            </>
          ) : (
            <>
              <div className="row form-row">
                <label className="field">
                  Twój SteamID64 (tu przyjdzie skin)
                  <input value={buyerSteam} onChange={(e) => setBuyerSteam(e.target.value)} inputMode="numeric" />
                </label>
                <button className="primary" disabled={busy || !deal.listingVerified || isSeller} onClick={() => onFund(buyerSteam)}>
                  Kup za {formatUsdc(deal.price)}
                </button>
              </div>
              {isSeller ? (
                <span className="muted small">To Twoje ogłoszenie. Kup coś od innego sprzedającego albo przełącz się na widok sprzedającego.</span>
              ) : !deal.listingVerified ? (
                <span className="muted small">Kupić można dopiero, gdy Steam potwierdzi, że skin jest u sprzedającego. Program tego pilnuje.</span>
              ) : (
                <span className="muted small">
                  Przed płatnością Steam musi pokazać, że Twoje inventory jest publiczne (inaczej dostawy nie da się udowodnić). Nie ukrywaj go do końca
                  transakcji: ukrycie po zapłacie, a przed dostawą, oznacza wypłatę dla sprzedającego.
                </span>
              )}
            </>
          )
        ) : null}

        {deal.status === "funded" ? (
          sellerView ? (
            <>
              <span className="muted">Pieniądze są w sejfie programu. Wyślij skina zwykłą wymianą na Steamie (w demo: w symulatorze poniżej), potem sprawdź dostawę.</span>
              <button className="primary" disabled={busy} onClick={() => onAttest("delivery")}>
                Sprawdź w Steam, czy skin dotarł
              </button>
              <button className="link" disabled={busy} onClick={() => onAttest("buyer_hidden")}>
                Kupujący ukrył inventory po zapłacie? Zgłoś (dostajesz pieniądze)
              </button>
            </>
          ) : (
            <>
              <span className="muted">Zapłacono. Pieniądze są w sejfie programu, sprzedający ma czas na wysłanie skina do {formatTime(deal.deliveryDeadline)}.</span>
              {now > deal.deliveryDeadline ? (
                <button className="primary" disabled={busy} onClick={onRefund}>
                  Odzyskaj pieniądze (minął termin dostawy)
                </button>
              ) : null}
            </>
          )
        ) : null}

        {deal.status === "delivered" ? (
          sellerView ? (
            <>
              {now > end ? (
                <button className="primary" disabled={busy} onClick={onFinalize}>
                  Wypłać mi {formatUsdc(deal.price)}
                </button>
              ) : (
                <span className="muted">Wypłata możliwa za {formatDuration(end - now)}, jeśli nikt nie udowodni cofnięcia wymiany.</span>
              )}
            </>
          ) : (
            <>
              <span className="muted">
                {now > end
                  ? "Okno cofnięcia minęło. Sprzedający może odebrać pieniądze."
                  : `Skin dotarł. Okno cofnięcia trwa jeszcze ${formatDuration(end - now)}: jeśli sprzedający cofnie wymianę, dostaniesz zwrot.`}
              </span>
              <button disabled={busy || now > end} onClick={() => onAttest("reversal")}>
                Sprawdź w Steam, czy wymiana nie została cofnięta
              </button>
              <button className="link" disabled={busy || now > end} onClick={() => onAttest("seller_hidden")}>
                Sprzedający ukrył inventory? Zgłoś (dostajesz zwrot)
              </button>
            </>
          )
        ) : null}
      </div>

      {proofs.length > 0 ? (
        <Section title="Dowody ze Steama">
          {proofs.map((p) => (
            <ProofCard key={`${p.kind}-${p.observedAt}`} attestation={p} onChainHash={deal.lastEvidenceHash} />
          ))}
        </Section>
      ) : deal.lastKind ? (
        <Section>
          <p className="muted small">Ostatni dowód w programie: {deal.lastKind}, hash {deal.lastEvidenceHash.slice(0, 16)}…</p>
        </Section>
      ) : null}
    </Card>
  );
}
