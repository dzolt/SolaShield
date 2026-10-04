import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { sha256Hex, type AttestResult } from "../../attestor";
import { formatTime, shortAddress, shortWear } from "../../format";
import { Badge } from "../../ui";

const KIND_LABEL: Record<string, string> = {
  listedItemInSellerInventory: "Przedmiot jest u sprzedającego",
  deliveredToBuyer: "Przedmiot dotarł do kupującego",
  returnedToSeller: "Przedmiot wrócił do sprzedającego (cofnięcie)",
  sellerInventoryHidden: "Sprzedający ukrył inventory",
  buyerInventoryHidden: "Kupujący ukrył inventory",
  buyerInventoryPublic: "Inventory kupującego jest publiczne",
};

interface Evidence {
  steam_id: string;
  source: string;
  inventory_private: boolean;
  /** Absent when the proof is only about visibility; null when the item was looked for and not found. */
  match?: { assetid: string; name: string; wear: string; pattern: number } | null;
}

function inventoryState(evidence: Evidence): string {
  if (evidence.inventory_private) return "prywatne";
  return evidence.match === null ? "brak przedmiotu" : "publiczne, da się je odczytać";
}

/** One proof: what the source showed, the hash the program stored, and a local re-check that the two match. */
function Proof({ attestation, onChainHash }: { readonly attestation: AttestResult; readonly onChainHash: string | undefined }) {
  const [localHash, setLocalHash] = useState<string | undefined>(undefined);
  useEffect(() => {
    void sha256Hex(attestation.evidence).then(setLocalHash);
  }, [attestation.evidence]);
  const evidence = JSON.parse(attestation.evidence) as Evidence;
  const hashOk = localHash !== undefined && localHash === attestation.evidenceHash;
  const onChain = onChainHash === attestation.evidenceHash;

  return (
    <details className="proof">
      <summary>
        <ShieldCheck className="proof-icon" aria-hidden="true" />
        <span className="stack tight grow">
          <strong>{KIND_LABEL[attestation.kind] ?? attestation.kind}</strong>
          <span className="muted tiny">{formatTime(attestation.observedAt)}</span>
        </span>
        <Badge tone={hashOk ? "ok" : "warn"} dot>
          {hashOk ? "hash zgodny" : "sprawdzam…"}
        </Badge>
      </summary>
      <dl className="kv">
        <dt>Źródło</dt>
        <dd>
          <code>{evidence.source}</code>
        </dd>
        <dt>Konto Steam</dt>
        <dd>
          <code>{evidence.steam_id}</code>
        </dd>
        {evidence.match ? (
          <>
            <dt>Egzemplarz</dt>
            <dd>
              {evidence.match.name} · float {shortWear(evidence.match.wear)} · wzór {evidence.match.pattern} · asset {evidence.match.assetid}
            </dd>
          </>
        ) : (
          <>
            <dt>Inventory</dt>
            <dd>{inventoryState(evidence)}</dd>
          </>
        )}
        <dt>Hash dowodu</dt>
        <dd>
          <code title={attestation.evidenceHash}>{attestation.evidenceHash?.slice(0, 28)}…</code>
        </dd>
        <dt>Podpis atestatora</dt>
        <dd>
          <code title={attestation.signature}>
            {shortAddress(attestation.attestor)} · {attestation.signature?.slice(0, 18)}…
          </code>
        </dd>
        <dt>W programie</dt>
        <dd>{onChainHash ? (onChain ? "ten sam hash jest zapisany na łańcuchu" : "zapisany jest nowszy dowód") : "brak"}</dd>
      </dl>
    </details>
  );
}

export function Proofs({ proofs, onChainHash, lastKind }: { readonly proofs: readonly AttestResult[]; readonly onChainHash: string | undefined; readonly lastKind: string | null }) {
  if (proofs.length === 0) {
    return (
      <p className="muted small">
        {lastKind ? `Ostatni dowód zapisany w programie: ${KIND_LABEL[lastKind] ?? lastKind}. Szczegóły dowodów widać na urządzeniu, na którym zostały pobrane.` : "Dowody pojawią się tu po pierwszej obserwacji źródła."}
      </p>
    );
  }
  return (
    <div className="stack">
      {proofs.map((proof) => (
        <Proof key={`${proof.kind}-${proof.observedAt}`} attestation={proof} onChainHash={onChainHash} />
      ))}
    </div>
  );
}
