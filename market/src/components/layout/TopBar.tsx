import { ArrowLeftRight, FlaskConical, ShoppingBag, Tag } from "lucide-react";
import type { PublicKey } from "@solana/web3.js";
import { explorerAddress, FAUCET_TOKENS, IS_DEVNET } from "../../config";
import type { WalletState } from "../../data";
import { formatPrice, shortAddress } from "../../format";
import type { Role } from "../../roles";
import { Badge, Button, Segmented, WalletChip } from "../../ui";

interface TopBarProps {
  readonly role: Role | undefined;
  readonly onRole: (role: Role) => void;
  readonly onHome: () => void;
  readonly owner: PublicKey | undefined;
  readonly wallet: WalletState | undefined;
  readonly busy: boolean;
  readonly onClaim: () => void;
  /** The Steam simulator is a seller-side tool; this opens it. */
  readonly onOpenDemo: (() => void) | undefined;
}

const ROLE_OPTIONS = [
  { value: "buyer" as const, label: "Kupuję", icon: <ShoppingBag /> },
  { value: "seller" as const, label: "Sprzedaję", icon: <Tag /> },
];

export function TopBar({ role, onRole, onHome, owner, wallet, busy, onClaim, onOpenDemo }: TopBarProps) {
  const balances = owner && wallet ? { sol: `${wallet.sol.toFixed(3)} SOL`, tokens: `${formatPrice(wallet.tokens)} tUSDC` } : undefined;
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
            <ArrowLeftRight aria-hidden="true" />
          </span>
          <span className="brand-name">ProofSwap</span>
          <Badge tone="accent">{IS_DEVNET ? "devnet" : "localnet"}</Badge>
        </a>
        <div className="topbar-center">{role ? <Segmented value={role} options={ROLE_OPTIONS} onChange={onRole} label="Twoja rola" /> : null}</div>
        <div className="topbar-actions">
          {onOpenDemo ? (
            <Button variant="ghost" icon={<FlaskConical />} onClick={onOpenDemo} title="Symulator Steam (tylko demo)">
              <span className="hide-sm">Demo</span>
            </Button>
          ) : null}
          <WalletChip balances={balances} faucetLabel={`Odbierz ${FAUCET_TOKENS} testowych tUSDC`} busy={busy} onClaim={onClaim} explorerHref={explorerAddress} short={shortAddress} />
        </div>
      </div>
    </header>
  );
}
