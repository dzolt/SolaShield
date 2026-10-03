import type { PublicKey } from "@solana/web3.js";
import { OBSERVATION_WINDOW_SECONDS, VOID_AFTER_SECONDS } from "../config";
import type { PolicyStatus, PolicyView, ProductView, Snapshot } from "../data";
import { formatDateTime, formatDuration, formatUsd, formatUsdc, shortAddress } from "../format";
import type { ActionOutcome, ActionRunner } from "../hooks";
import { Badge, Card } from "../ui";

const STATUS: Readonly<Record<PolicyStatus, { text: string; tone: "ok" | "warn" | "bad" | "info" }>> = {
  active: { text: "Aktywna", tone: "info" },
  paidOut: { text: "Wypłacona", tone: "ok" },
  expired: { text: "Wygasła (bez zdarzenia)", tone: "warn" },
  voided: { text: "Unieważniona (zwrot składki)", tone: "bad" },
};

interface PoliciesPanelProps {
  readonly snapshot: Snapshot;
  readonly owner: PublicKey | undefined;
  readonly runner: ActionRunner;
  readonly connected: boolean;
  readonly onSettle: (policy: PolicyView, product: ProductView) => Promise<ActionOutcome>;
  readonly onVoid: (policy: PolicyView) => Promise<ActionOutcome>;
}

interface RowProps extends PoliciesPanelProps {
  readonly policy: PolicyView;
  readonly product: ProductView | undefined;
}

function PolicyRow({ policy, product, snapshot, owner, runner, connected, onSettle, onVoid }: RowProps) {
  const status = STATUS[policy.status];
  const active = policy.status === "active";
  const below = product?.trigger !== "priceAbove";
  const mine = owner !== undefined && policy.holder.equals(owner);
  const price = product ? snapshot.prices[product.feedHex] : undefined;
  const secondsToEnd = policy.expiry - snapshot.now;
  const over = secondsToEnd <= 0;
  const windowOpen = over && snapshot.now <= policy.expiry + OBSERVATION_WINDOW_SECONDS;
  const wouldPay = price ? (below ? price.price <= policy.strike : price.price >= policy.strike) : undefined;
  const canVoid = active && snapshot.now >= policy.expiry + VOID_AFTER_SECONDS;

  return (
    <li className="card" style={{ listStyle: "none", padding: 14 }}>
      <div className="row between">
        <b>
          {below ? "📉" : "📈"} #{policy.id} {below ? "spadek" : "wzrost"} ceny SOL o {policy.thresholdBps / 100}%
        </b>
        <Badge tone={status.tone}>{status.text}</Badge>
      </div>
      <p className="muted" style={{ margin: "6px 0" }}>
        {mine ? "Twoja" : shortAddress(policy.holder)} · wypłata <b>{formatUsdc(policy.payout)}</b> · składka{" "}
        {formatUsdc(policy.premium)} · koniec {formatDateTime(policy.expiry)}
      </p>
      <p className="muted" style={{ margin: "6px 0" }}>
        Cena referencyjna (zapisana przez program): <b>{formatUsd(policy.referencePrice)}</b> · próg wypłaty:{" "}
        <b>
          {below ? "≤" : "≥"} {formatUsd(policy.strike)}
        </b>
        {active && price ? (
          <>
            {" "}
            · cena teraz: <b>{formatUsd(price.price)}</b>
            {over ? (wouldPay ? " (przy rozliczeniu: wypłata)" : " (przy rozliczeniu: bez wypłaty)") : ""}
          </>
        ) : null}
      </p>
      {active && product ? (
        over && !windowOpen ? (
          <p className="muted" style={{ margin: 0 }}>
            Okno rozliczenia ({formatDuration(OBSERVATION_WINDOW_SECONDS)} po końcu) minęło bez rozliczenia. Po 7 dniach od
            końca każdy może ochronę unieważnić i zwrócić składkę.
          </p>
        ) : (
          <div className="row">
            <button className="primary" disabled={runner.busy || !connected || !over} onClick={() => void runner.run(() => onSettle(policy, product))}>
              Rozlicz (cena z Pytha, robi to program)
            </button>
            <span className="muted">
              {over
                ? `Okno rozliczenia: ${formatDuration(OBSERVATION_WINDOW_SECONDS)} po końcu. Feed Pytha odświeża się co ok. 20 s, więc może trzeba chwilę poczekać; pierwsze udane wywołanie decyduje.`
                : `Koniec ochrony za ${formatDuration(secondsToEnd)}.`}
            </span>
          </div>
        )
      ) : null}
      {canVoid ? (
        <button disabled={runner.busy || !connected} onClick={() => void runner.run(() => onVoid(policy))}>
          Unieważnij (brak rozliczenia po 7 dniach): zwrot składki
        </button>
      ) : null}
    </li>
  );
}

export function PoliciesPanel(props: PoliciesPanelProps) {
  const ordered = [...props.snapshot.policies].reverse();
  return (
    <Card title="📄 Ochrony">
      {ordered.length === 0 ? (
        <p className="muted">Nie ma jeszcze żadnych ochron. Kup pierwszą.</p>
      ) : (
        <ul className="stack" style={{ padding: 0, margin: 0 }}>
          {ordered.map((policy) => (
            <PolicyRow key={policy.id} {...props} policy={policy} product={props.snapshot.products.find((p) => p.id === policy.productId)} />
          ))}
        </ul>
      )}
    </Card>
  );
}
