import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import type { PublicKey } from "@solana/web3.js";
import { explorerAddress, FAUCET_TOKENS, IS_DEVNET } from "../config";
import type { Snapshot } from "../data";
import { formatUsdc, shortAddress } from "../format";
import type { ActionRunner } from "../hooks";
import { Card, Stat } from "../ui";

interface WalletPanelProps {
  readonly owner: PublicKey | undefined;
  readonly snapshot: Snapshot | undefined;
  readonly runner: ActionRunner;
  readonly onClaim: () => Promise<{ message: string; signature?: string }>;
}

export function WalletPanel({ owner, snapshot, runner, onClaim }: WalletPanelProps) {
  const wallet = snapshot?.wallet;
  return (
    <Card title={`👛 Portfel (${IS_DEVNET ? "Solana devnet" : "lokalna sieć"})`}>
      <div className="row">
        <WalletMultiButton />
        {owner ? (
          <a href={explorerAddress(owner.toBase58())} target="_blank" rel="noreferrer">
            {shortAddress(owner)}
          </a>
        ) : (
          <span className="muted">Połącz Phantom, Solflare lub Backpack (przełącz portfel na devnet).</span>
        )}
      </div>
      {owner ? (
        <>
          <div className="row" style={{ marginTop: 12 }}>
            <Stat label="SOL (opłaty i konta)" value={wallet ? wallet.sol.toFixed(3) : "…"} />
            <Stat label="tUSDC" value={wallet ? formatUsdc(wallet.tokens) : "…"} />
            <Stat label="Udziały w puli" value={wallet ? formatUsdc(wallet.shareValue) : "…"} />
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" disabled={runner.busy} onClick={() => void runner.run(onClaim)}>
              Odbierz {FAUCET_TOKENS} testowych tUSDC
            </button>
            {IS_DEVNET ? (
              <a href="https://faucet.solana.com" target="_blank" rel="noreferrer">
                Brakuje SOL? Faucet devnetu
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </Card>
  );
}
