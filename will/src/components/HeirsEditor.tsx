import { useEffect, useState } from "react";
import type { HeirDraft } from "../actions";
import { MAX_BENEFICIARIES, TOTAL_BPS } from "../config";
import type { Will } from "../data";
import { formatPercent } from "../format";
import { Section } from "../ui";

interface HeirsEditorProps {
  readonly will: Will;
  readonly busy: boolean;
  readonly onSave: (drafts: readonly HeirDraft[]) => void;
  readonly onLock: () => void;
}

const EMPTY: HeirDraft = { wallet: "", percent: "" };

function draftsFrom(will: Will): readonly HeirDraft[] {
  return will.heirs.length > 0 ? will.heirs.map((h) => ({ wallet: h.wallet.toBase58(), percent: String(h.bps / 100) })) : [EMPTY];
}

function percentSum(drafts: readonly HeirDraft[]): number {
  return drafts.reduce((sum, d) => sum + Math.round(Number(d.percent.replace(",", ".")) * 100 || 0), 0);
}

/** Edits the list of heirs while it is not final; locking makes it permanent. */
export function HeirsEditor({ will, busy, onSave, onLock }: HeirsEditorProps) {
  const [drafts, setDrafts] = useState<readonly HeirDraft[]>(() => draftsFrom(will));
  const key = will.address.toBase58();
  const saved = will.heirs.map((h) => `${h.wallet.toBase58()}:${h.bps}`).join(",");
  useEffect(() => setDrafts(draftsFrom(will)), [key, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (index: number, patch: Partial<HeirDraft>) => setDrafts((current) => current.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  const sum = percentSum(drafts);

  return (
    <Section title="Spadkobiercy i udziały">
      <p className="muted">Wklej adresy portfeli i procenty. Razem muszą dać 100%. Dopóki nie zablokujesz listy, możesz ją zmieniać.</p>
      {drafts.map((d, i) => (
        <div key={i} className="row heir-input">
          <input className="grow" placeholder="adres portfela spadkobiercy" value={d.wallet} onChange={(e) => update(i, { wallet: e.target.value })} />
          <input className="pct" placeholder="%" value={d.percent} onChange={(e) => update(i, { percent: e.target.value })} />
          <button className="chip" disabled={drafts.length === 1} onClick={() => setDrafts((current) => current.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <div className="row between">
        <button className="chip" disabled={drafts.length >= MAX_BENEFICIARIES} onClick={() => setDrafts((current) => [...current, EMPTY])}>
          + dodaj osobę
        </button>
        <span className={`small ${sum === TOTAL_BPS ? "muted" : "warn-text"}`}>razem {formatPercent(sum)}{sum === TOTAL_BPS ? " ✓" : " (ma być 100%)"}</span>
      </div>
      <div className="row">
        <button className="primary" disabled={busy} onClick={() => onSave(drafts)}>
          Zapisz spadkobierców
        </button>
        <button disabled={busy || will.heirs.length === 0} onClick={onLock} title="Po zablokowaniu nikt, także ty, nie zmieni listy ani procentów.">
          Zablokuj listę na zawsze
        </button>
      </div>
    </Section>
  );
}

