import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import type { PublicKey } from "@solana/web3.js";
import { explorerAddress, FAUCET_TOKENS, IS_DEVNET, PROGRAM_ID } from "../config";
import type { WalletState } from "../data";
import { formatUsdc, shortAddress } from "../format";
import type { ActionRunner } from "../hooks";

interface HeaderProps {
  readonly owner: PublicKey | undefined;
  readonly wallet: WalletState | undefined;
  readonly runner: ActionRunner;
  readonly onClaim: () => void;
}

export function Header({ owner, wallet, runner, onClaim }: HeaderProps) {
  return (
    <header className="header">
      <div>
        <div className="brand">
          <span className="logo">⌛</span> Sejf spadkowy
        </div>
        <p className="tagline">
          Testament bez notariusza i bez banku. Odkładasz pieniądze do sejfu programu na Solanie. Jeśli przestaniesz się meldować, program sam podzieli je między
          wskazane osoby.
        </p>
        <div className="row small">
          <span className="badge">{IS_DEVNET ? "Solana devnet" : "lokalna sieć"}</span>
          <a href={explorerAddress(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">
            program {shortAddress(PROGRAM_ID)}
          </a>
        </div>
      </div>
      <div className="wallet-box">
        <WalletMultiButton />
        {owner ? (
          <div className="row small">
            <span>{wallet ? `${wallet.sol.toFixed(3)} SOL` : "…"}</span>
            <b>{wallet ? formatUsdc(wallet.tokens) : "…"}</b>
            <button disabled={runner.busy} onClick={onClaim}>
              Odbierz {FAUCET_TOKENS} testowych tUSDC
            </button>
          </div>
        ) : (
          <span className="muted">Połącz Phantom (sieć: {IS_DEVNET ? "devnet" : "localnet"}).</span>
        )}
      </div>
    </header>
  );
}
