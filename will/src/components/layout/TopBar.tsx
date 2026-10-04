import type { PublicKey } from "@solana/web3.js";
import { Gift, KeyRound, Leaf, ShieldCheck } from "lucide-react";
import { explorerAddress, FAUCET_TOKENS, IS_DEVNET } from "../../config";
import type { Role, WalletState } from "../../data";
import { formatPrice, shortAddress } from "../../format";
import { Badge, Segmented, WalletChip } from "../../ui";

interface TopBarProps {
  readonly role: Role | undefined;
  readonly onRole: (role: Role) => void;
  readonly onHome: () => void;
  readonly owner: PublicKey | undefined;
  readonly wallet: WalletState | undefined;
  readonly busy: boolean;
  readonly onClaim: () => void;
  /** How many wills the connected account has in each role (shown as small counters). */
  readonly counts: Readonly<Record<Role, number>>;
}

export function TopBar({ role, onRole, onHome, owner, wallet, busy, onClaim, counts }: TopBarProps) {
  const balances = owner && wallet ? { sol: `${wallet.sol.toFixed(3)} SOL`, tokens: `${formatPrice(wallet.tokens)} tUSDC` } : undefined;
  const options = [
    { value: "owner" as const, label: "Właściciel", icon: <KeyRound />, count: counts.owner },
    { value: "guardian" as const, label: "Strażnik", icon: <ShieldCheck />, count: counts.guardian },
    { value: "heir" as const, label: "Spadkobierca", icon: <Gift />, count: counts.heir },
  ];
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a
          className="brand"
          href={window.location.pathname}
          onClick={(event) => {
            event.preventDefault();
            onHome();
          }}
        >
          <span className="brand-mark">
            <Leaf aria-hidden="true" />
          </span>
          <span className="brand-name">Ostatnia Wola Sola</span>
          <Badge tone="accent">{IS_DEVNET ? "devnet" : "localnet"}</Badge>
        </a>
        <div className="topbar-center">{role ? <Segmented value={role} options={options} onChange={onRole} label="Twoja rola" /> : null}</div>
        <div className="topbar-actions">
          <WalletChip balances={balances} faucetLabel={`Odbierz ${FAUCET_TOKENS} testowych tUSDC`} busy={busy} onClaim={onClaim} explorerHref={explorerAddress} short={shortAddress} />
        </div>
      </div>
    </header>
  );
}
