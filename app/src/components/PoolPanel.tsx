import { explorerAddress, deployment, MINT, POOL } from "../config";
import type { Snapshot } from "../data";
import { formatDuration, formatUsdc, shortAddress } from "../format";
import { Card, Progress, Stat } from "../ui";

const SCALE = 1_000_000n;

function sharePrice(totalAssets: bigint, totalShares: bigint): string {
  if (totalShares === 0n) return "1,0000";
  return (Number((totalAssets * SCALE) / totalShares) / Number(SCALE)).toFixed(4).replace(".", ",");
}

export function PoolPanel({ snapshot }: { readonly snapshot: Snapshot }) {
  const { pool } = snapshot;
  const utilization = pool.totalAssets === 0n ? 0 : Number((pool.reserved * 10_000n) / pool.totalAssets) / 10_000;
  const tone = utilization > 0.9 ? "bad" : utilization > 0.7 ? "warn" : undefined;

  return (
    <Card title="🏦 Wspólna pula (kapitał ubezpieczyciela)">
      <div className="row">
        <Stat label="Kapitał w puli" value={formatUsdc(pool.totalAssets)} />
        <Stat label="Zabezpiecza polisy" value={formatUsdc(pool.reserved)} />
        <Stat label="Wolny kapitał" value={formatUsdc(pool.free)} />
        <Stat label="Cena udziału" value={sharePrice(pool.totalAssets, pool.totalShares)} />
      </div>
      <h3>Wykorzystanie puli (zarezerwowane / kapitał)</h3>
      <Progress fraction={utilization} tone={tone} />
      <p className="muted">
        Pula nigdy nie sprzeda więcej ochrony, niż ma kapitału, a wpłacony kapitał jest zablokowany na{" "}
        {formatDuration(pool.lockupSeconds)} (dawca nie może uciec przed rozliczeniem). Pieniądze leżą na koncie tokenów, którym rządzi tylko
        program (konto PDA): nie ma klucza, który mógłby je wyjąć.
      </p>
      <p className="muted" style={{ marginBottom: 0 }}>
        Program{" "}
        <a href={explorerAddress(deployment.programId)} target="_blank" rel="noreferrer">
          {shortAddress(deployment.programId)}
        </a>
        , pula{" "}
        <a href={explorerAddress(POOL.toBase58())} target="_blank" rel="noreferrer">
          {shortAddress(POOL)}
        </a>
        , token tUSDC{" "}
        <a href={explorerAddress(MINT.toBase58())} target="_blank" rel="noreferrer">
          {shortAddress(MINT)}
        </a>
        .
      </p>
    </Card>
  );
}
