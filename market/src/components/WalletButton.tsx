import { BaseWalletMultiButton } from "@solana/wallet-adapter-react-ui";

const LABELS = {
  "change-wallet": "Zmień portfel",
  connecting: "Łączenie…",
  "copy-address": "Kopiuj adres",
  copied: "Skopiowano",
  disconnect: "Rozłącz",
  "has-wallet": "Połącz",
  "no-wallet": "Połącz portfel",
} as const;

/** The wallet adapter's connect / account button, with Polish labels. */
export function WalletButton() {
  return <BaseWalletMultiButton labels={LABELS} />;
}
