import { Lock, Plus, Scale, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { HeirDraft } from "../../actions";
import { MAX_BENEFICIARIES, TOTAL_BPS } from "../../config";
import type { Will } from "../../data";
import { formatPercent } from "../../format";
import { Button, Card, Field, Notice, Progress } from "../../ui";

interface HeirsEditorProps {
  readonly will: Will;
  readonly busy: boolean;
  readonly onSave: (drafts: readonly HeirDraft[]) => void;
  readonly onLock: () => void;
}

const EMPTY: HeirDraft = { wallet: "", percent: "" };

function draftsFrom(will: Will): readonly HeirDraft[] {
  return will.heirs.length > 0 ? will.heirs.map((heir) => ({ wallet: heir.wallet.toBase58(), percent: String(heir.bps / 100) })) : [EMPTY];
}

const percentSum = (drafts: readonly HeirDraft[]): number => drafts.reduce((sum, draft) => sum + Math.round(Number(draft.percent.replace(",", ".")) * 100 || 0), 0);

/** Equal shares for `count` people in basis points; the last one takes the rounding remainder so the sum is exactly 100%. */
function equalShares(count: number): string[] {
  const base = Math.floor(TOTAL_BPS / count);
  return Array.from({ length: count }, (_, index) => String((index === count - 1 ? TOTAL_BPS - base * (count - 1) : base) / 100));
}

/** Add the people who inherit and their shares; saving is reversible until the list is locked for good. */
export function HeirsEditor({ will, busy, onSave, onLock }: HeirsEditorProps) {
  const [drafts, setDrafts] = useState<readonly HeirDraft[]>(() => draftsFrom(will));
  const key = will.address.toBase58();
  const saved = will.heirs.map((heir) => `${heir.wallet.toBase58()}:${heir.bps}`).join(",");
  useEffect(() => setDrafts(draftsFrom(will)), [key, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  if (will.heirsLocked) {
    return (
      <Card title="Spadkobiercy">
        <Notice tone="ok" >Lista spadkobierców jest ostateczna. Nikt, także Ty, nie zmieni jej ani procentów. Wpłaty i wypłaty nadal działają.</Notice>
      </Card>
    );
  }

  const update = (index: number, patch: Partial<HeirDraft>) => setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  const sum = percentSum(drafts);
  const exact = sum === TOTAL_BPS;
  const splitEqually = () => setDrafts((current) => equalShares(current.length).map((percent, index) => ({ ...current[index], percent })));

  return (
    <Card title="Spadkobiercy i udziały" aside={<span className={exact ? "badge badge-ok" : "badge badge-warn"}>{formatPercent(sum)} z 100%</span>}>
      <div className="stack loose">
        <p className="muted">Wklej adresy portfeli i ustal procenty. Razem muszą dać 100%. Dopóki nie zablokujesz listy, możesz ją zmieniać.</p>
        <div className="stack">
          {drafts.map((draft, index) => (
            <div key={index} className="editor-row">
              <Field label={index === 0 ? "Adres portfela" : undefined} placeholder="Adres portfela spadkobiercy" mono value={draft.wallet} onChange={(event) => update(index, { wallet: event.target.value })} />
              <Field label={index === 0 ? "Udział" : undefined} placeholder="0" suffix="%" inputMode="decimal" value={draft.percent} onChange={(event) => update(index, { percent: event.target.value })} />
              <Button variant="ghost" iconOnly aria-label="Usuń osobę" icon={<Trash2 />} disabled={drafts.length === 1} onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))} />
            </div>
          ))}
        </div>
        <div className="row between">
          <div className="row">
            <Button variant="soft" size="sm" icon={<Plus />} disabled={drafts.length >= MAX_BENEFICIARIES} onClick={() => setDrafts((current) => [...current, EMPTY])}>
              Dodaj osobę
            </Button>
            <Button variant="ghost" size="sm" icon={<Scale />} disabled={drafts.length < 2} onClick={splitEqually}>
              Podziel po równo
            </Button>
          </div>
        </div>
        <Progress fraction={sum / TOTAL_BPS} tone={exact ? undefined : sum > TOTAL_BPS ? "bad" : "warn"} />
        <div className="row">
          <Button variant="primary" size="lg" disabled={busy} onClick={() => onSave(drafts)}>
            Zapisz spadkobierców
          </Button>
          <Button
            variant="outline"
            icon={<Lock />}
            disabled={busy || will.heirs.length === 0}
            title="Po zablokowaniu nikt, także Ty, nie zmieni listy ani procentów."
            onClick={() => {
              if (window.confirm("Zablokować listę na zawsze? Po tym nikt, także Ty, nie zmieni spadkobierców ani procentów.")) onLock();
            }}
          >
            Zablokuj listę na zawsze
          </Button>
        </div>
      </div>
    </Card>
  );
}
