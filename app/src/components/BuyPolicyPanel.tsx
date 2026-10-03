import { useState } from "react";
import type { CoverOrder } from "../actions";
import { MAX_COVER_SHARE } from "../config";
import type { Snapshot } from "../data";
import { formatUsd, formatUsdc, parseUsdc } from "../format";
import type { ActionOutcome, ActionRunner } from "../hooks";
import { Card } from "../ui";

const START_OPTIONS = [
  { label: "za 2 minuty (tryb demo)", seconds: 120 },
  { label: "za 10 minut", seconds: 600 },
  { label: "za 1 godzinę", seconds: 3600 },
] as const;

const QUICK_THRESHOLDS = [15, 5, 0] as const;

interface BuyCoverPanelProps {
  readonly snapshot: Snapshot;
  readonly runner: ActionRunner;
  readonly connected: boolean;
  readonly onBuy: (order: CoverOrder) => Promise<ActionOutcome>;
}

function previewPremium(payoutText: string, premiumBps: number): string {
  try {
    return formatUsdc((parseUsdc(payoutText) * BigInt(premiumBps)) / 10_000n);
  } catch {
    return "–";
  }
}

export function BuyPolicyPanel({ snapshot, runner, connected, onBuy }: BuyCoverPanelProps) {
  const [productId, setProductId] = useState(0);
  const [payoutText, setPayoutText] = useState("100");
  const [startIndex, setStartIndex] = useState(0);
  const [thresholdText, setThresholdText] = useState("15");

  const product = snapshot.products.find((p) => p.id === productId) ?? snapshot.products[0];
  if (!product) return <Card title="🛒 Kup ochronę">Brak produktów w puli.</Card>;

  const below = product.trigger === "priceBelow";
  const price = snapshot.prices[product.feedHex];
  const start = START_OPTIONS[Math.min(startIndex, START_OPTIONS.length - 1)];
  const threshold = Number(thresholdText.replace(",", "."));
  const validThreshold = Number.isFinite(threshold) && threshold >= 0 && threshold <= 90;
  const strikePreview = price && validThreshold ? price.price * (1 + (below ? -threshold : threshold) / 100) : undefined;
  const maxPayout = (snapshot.pool.totalAssets * 20n) / 100n;

  const buy = () =>
    runner.run(() => onBuy({ product, payoutText, startsInSeconds: start.seconds, thresholdPercent: threshold }));

  return (
    <Card title="🛒 Kup ochronę wypłaty w SOL">
      <div className="stack">
        <label className="field">
          Przed czym chronisz
          <select
            value={product.id}
            onChange={(e) => {
              setProductId(Number(e.target.value));
            }}
          >
            {snapshot.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.trigger === "priceBelow" ? "📉" : "📈"} {p.name}
              </option>
            ))}
          </select>
        </label>

        <p className="muted" style={{ margin: 0 }}>
          Cena SOL z Pytha teraz: <b>{price ? formatUsd(price.price) : "…"}</b>. Program zapisze ją przy zakupie jako cenę
          referencyjną i wypłaci, jeśli w chwili rozliczenia cena będzie{" "}
          <b>{below ? "niższa o co najmniej" : "wyższa o co najmniej"} {validThreshold ? threshold : "…"}%</b>
          {strikePreview ? <> (czyli {below ? "≤" : "≥"} {formatUsd(strikePreview)})</> : null}.
        </p>

        <div className="row">
          <label className="field">
            Chroniony ruch ceny (%)
            <input value={thresholdText} onChange={(e) => setThresholdText(e.target.value)} />
          </label>
          {QUICK_THRESHOLDS.map((value) => (
            <button key={value} onClick={() => setThresholdText(String(value))}>
              {value === 0 ? "0% (demo)" : `${value}%`}
            </button>
          ))}
        </div>

        <div className="row">
          <label className="field">
            Ochrona trwa
            <select value={startIndex} onChange={(e) => setStartIndex(Number(e.target.value))}>
              {START_OPTIONS.map((o, i) => (
                <option key={o.label} value={i}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Wypłata (tUSDC)
            <input value={payoutText} onChange={(e) => setPayoutText(e.target.value)} />
          </label>
          <div className="stat" style={{ flex: "none" }}>
            <span className="muted">Składka</span>
            <b>{previewPremium(payoutText, product.premiumBps)}</b>
          </div>
        </div>

        <p className="muted" style={{ margin: 0 }}>
          O wypłacie decyduje wyłącznie program na podstawie ceny z konta Pytha: nikt, także autor, nie może tego
          zatwierdzić ani odrzucić. Jedna ochrona może obiecać najwyżej {MAX_COVER_SHARE * 100}% kapitału puli
          (teraz do {formatUsdc(maxPayout)}). Demo: kup „spadek” i „wzrost” z progiem 0%, a jedna z nich się wypłaci.
        </p>
        <div>
          <button className="primary" disabled={runner.busy || !connected || !validThreshold} onClick={() => void buy()}>
            Kup ochronę
          </button>
        </div>
      </div>
    </Card>
  );
}
