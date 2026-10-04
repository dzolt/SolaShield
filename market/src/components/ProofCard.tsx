import { useEffect, useState } from "react";
import { sha256Hex, type AttestResult } from "../attestor";
import { formatTime, shortAddress, shortWear } from "../format";

const KIND_LABEL: Record<string, string> = {
  listedItemInSellerInventory: "Przedmiot jest u sprzedającego",
  deliveredToBuyer: "Dostarczono do kupującego",
  returnedToSeller: "Wrócił do sprzedającego (cofnięcie)",
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

/** What Steam showed, the hash the program stored, and a local re-check that the two match. */
export function ProofCard({ attestation, onChainHash }: { readonly attestation: AttestResult; readonly onChainHash: string | undefined }) {
  const [localHash, setLocalHash] = useState<string | undefined>(undefined);
  useEffect(() => {
    void sha256Hex(attestation.evidence).then(setLocalHash);
  }, [attestation.evidence]);
  const evidence = JSON.parse(attestation.evidence) as Evidence;
  const hashOk = localHash !== undefined && localHash === attestation.evidenceHash;
  const onChain = onChainHash === attestation.evidenceHash;

  return (
    <div className="proof">
      <div className="row between">
        <b>Dowód: {KIND_LABEL[attestation.kind] ?? attestation.kind}</b>
        <span className="muted">{formatTime(attestation.observedAt)}</span>
      </div>
      <div className="proof-grid">
        <span>Źródło</span>
        <code>{evidence.source}</code>
        <span>Konto Steam</span>
        <code>{evidence.steam_id}</code>
        {evidence.match ? (
          <>
            <span>Znaleziony egzemplarz</span>
            <code>
              {evidence.match.name} · float {shortWear(evidence.match.wear)} · wzór {evidence.match.pattern} · asset {evidence.match.assetid}
            </code>
          </>
        ) : (
          <>
            <span>Inventory</span>
            <code>{inventoryState(evidence)}</code>
          </>
        )}
        <span>Hash dowodu</span>
        <code title={attestation.evidenceHash}>{attestation.evidenceHash?.slice(0, 24)}…</code>
        <span>Podpis atestatora</span>
        <code title={attestation.signature}>
          {shortAddress(attestation.attestor)} · {attestation.signature?.slice(0, 16)}…
        </code>
      </div>
      <div className="row small">
        <span className={`badge ${hashOk ? "ok" : "warn"}`}>{hashOk ? "✓ hash przeliczony w przeglądarce się zgadza" : "sprawdzam hash…"}</span>
        {onChainHash ? <span className={`badge ${onChain ? "ok" : ""}`}>{onChain ? "✓ ten sam hash zapisany w programie" : "w programie jest nowszy dowód"}</span> : null}
      </div>
    </div>
  );
}
