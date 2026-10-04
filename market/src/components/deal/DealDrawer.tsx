import type { PublicKey } from "@solana/web3.js";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { AttestResult } from "../../attestor";
import { explorerAddress } from "../../config";
import type { Deal } from "../../data";
import { formatPrice, shortAddress, shortWear, splitItemName } from "../../format";
import type { ActionRunner } from "../../hooks";
import type { Role } from "../../roles";
import { dealLabel } from "../../status";
import { Badge, Card, Disclosure, Drawer, Party, Pill } from "../../ui";
import { ItemImage, type ItemLook } from "../items/ItemCard";
import { DealTimeline } from "./DealTimeline";
import { NextStep, type DealActions } from "./NextStep";
import { Proofs } from "./Proofs";

interface DealDrawerProps extends DealActions {
  readonly deal: Deal | undefined;
  readonly now: number;
  readonly owner: PublicKey | undefined;
  readonly role: Role;
  readonly runner: ActionRunner;
  readonly proofs: readonly AttestResult[];
  readonly look: ItemLook;
  readonly simAvailable: boolean;
  readonly onClose: () => void;
}

function DealBody(props: DealDrawerProps & { readonly deal: Deal }) {
  const { deal, now, owner, role, runner, proofs, look, simAvailable } = props;
  const { title, exterior } = splitItemName(deal.itemName);
  return (
    <>
      <div className="deal-hero">
        <ItemImage size="lg" look={look} />
        <div className="stack tight">
          <h2 className="deal-title">{title}</h2>
          {exterior ? <p className="muted">{exterior}</p> : null}
          <div className="item-pills">
            {deal.wear ? <Pill label="float">{shortWear(deal.wear)}</Pill> : null}
            {deal.pattern ? <Pill label="wzór">{deal.pattern}</Pill> : null}
          </div>
          <div className="deal-price">
            <b>{formatPrice(deal.price)}</b>
            <span>tUSDC</span>
          </div>
        </div>
      </div>

      <div className="parties-row">
        <div className="stack tight">
          <span className="label">Sprzedający</span>
          <Party address={deal.seller.toBase58()} short={shortAddress(deal.seller)} href={explorerAddress(deal.seller.toBase58())} />
        </div>
        <ArrowRight className="parties-arrow" aria-hidden="true" />
        <div className="stack tight">
          <span className="label">Kupujący</span>
          {deal.buyer ? <Party address={deal.buyer.toBase58()} short={shortAddress(deal.buyer)} href={explorerAddress(deal.buyer.toBase58())} /> : <span className="muted small">czeka na kupującego</span>}
        </div>
      </div>

      <NextStep
        deal={deal}
        now={now}
        owner={owner}
        role={role}
        runner={runner}
        simAvailable={simAvailable}
        onConnect={props.onConnect}
        onAttest={props.onAttest}
        onFund={props.onFund}
        onCancel={props.onCancel}
        onFinalize={props.onFinalize}
        onRefund={props.onRefund}
        onSimulateTrade={props.onSimulateTrade}
      />

      <Card title="Przebieg transakcji">
        <DealTimeline deal={deal} now={now} />
      </Card>

      <Disclosure title={`Dowody ze źródła${proofs.length ? ` (${proofs.length})` : ""}`}>
        <Proofs proofs={proofs} onChainHash={deal.lastEvidenceHash} lastKind={deal.lastKind} />
      </Disclosure>

      <a className="drawer-link" href={explorerAddress(deal.address.toBase58())} target="_blank" rel="noreferrer">
        Konto transakcji {shortAddress(deal.address)} w Explorerze <ExternalLink size={14} aria-hidden="true" />
      </a>
    </>
  );
}

/** A deal opened from a card: item, parties, what to do next, how far it got, and the proofs for those who want them. */
export function DealDrawer(props: DealDrawerProps) {
  const { deal, now, onClose } = props;
  const label = deal ? dealLabel(deal, now) : undefined;
  return (
    <Drawer
      open={!!deal}
      onClose={onClose}
      label="Szczegóły transakcji"
      title={
        deal && label ? (
          <div className="row nowrap">
            <span className="eyebrow">Transakcja #{deal.id}</span>
            <Badge tone={label.tone} dot>
              {label.text}
            </Badge>
          </div>
        ) : null
      }
    >
      {deal ? <DealBody {...props} deal={deal} /> : null}
    </Drawer>
  );
}
