import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Check, ChevronDown, Coins, Copy, ExternalLink, LogOut, Repeat, Wallet } from "lucide-react";
import { useState } from "react";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { MenuItem, useDismiss } from "./Menu";

interface WalletChipProps {
  /** Already formatted for display; undefined while the balances load. */
  readonly balances: { readonly sol: string; readonly tokens: string } | undefined;
  readonly faucetLabel: string;
  readonly busy: boolean;
  readonly onClaim: () => void;
  readonly explorerHref: (address: string) => string;
  readonly short: (address: string) => string;
}

/** Connect button that turns into an account chip with a small menu (balances, faucet, copy, switch, disconnect). */
export function WalletChip({ balances, faucetLabel, busy, onClaim, explorerHref, short }: WalletChipProps) {
  const { publicKey, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));

  if (!publicKey) {
    return (
      <Button variant="primary" icon={<Wallet />} loading={connecting} onClick={() => setVisible(true)}>
        Połącz portfel
      </Button>
    );
  }

  const address = publicKey.toBase58();
  const copy = (): void => {
    void navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="wallet-chip" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Avatar address={address} />
        <span>{short(address)}</span>
        <span className="chip-balance">{balances ? balances.sol : "…"}</span>
        <ChevronDown className="chev" aria-hidden="true" />
      </button>
      {open ? (
        <div className="menu" role="menu">
          <div className="menu-head">
            <div className="stack tight">
              <span className="label">Połączone konto</span>
              <strong>{short(address)}</strong>
            </div>
          </div>
          <div className="menu-balance">
            <span className="muted">SOL (opłaty sieci)</span>
            <b>{balances?.sol ?? "…"}</b>
          </div>
          <div className="menu-balance">
            <span className="muted">tUSDC</span>
            <b>{balances?.tokens ?? "…"}</b>
          </div>
          <div className="menu-sep" />
          <MenuItem
            icon={<Coins />}
            disabled={busy}
            onClick={() => {
              setOpen(false);
              onClaim();
            }}
          >
            {faucetLabel}
          </MenuItem>
          <MenuItem icon={copied ? <Check /> : <Copy />} onClick={copy}>
            {copied ? "Skopiowano" : "Kopiuj adres"}
          </MenuItem>
          <a className="menu-item" role="menuitem" href={explorerHref(address)} target="_blank" rel="noreferrer">
            <ExternalLink />
            Zobacz w Explorerze
          </a>
          <div className="menu-sep" />
          <MenuItem
            icon={<Repeat />}
            onClick={() => {
              setOpen(false);
              setVisible(true);
            }}
          >
            Zmień portfel
          </MenuItem>
          <MenuItem
            icon={<LogOut />}
            onClick={() => {
              setOpen(false);
              void disconnect();
            }}
          >
            Rozłącz
          </MenuItem>
        </div>
      ) : null}
    </div>
  );
}
