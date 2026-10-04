import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useState } from "react";
import { formatPrice, parseUsdc, toInputAmount } from "../../format";
import { Button, Card, Field } from "../../ui";

interface FundsPanelProps {
  readonly busy: boolean;
  /** tUSDC on the owner's account (undefined while it loads). */
  readonly walletTokens: bigint | undefined;
  readonly vaultBalance: bigint;
  readonly onDeposit: (amount: string) => void;
  readonly onWithdraw: (amount: string) => void;
}

const validAmount = (input: string): boolean => {
  try {
    return parseUsdc(input) > 0n;
  } catch {
    return false;
  }
};

const QUICK = ["100", "500", "1000"] as const;

interface AmountCardProps {
  readonly title: string;
  readonly hint: string;
  readonly cta: string;
  readonly icon: React.ReactNode;
  readonly busy: boolean;
  readonly primary: boolean;
  readonly full?: bigint;
  readonly onSubmit: (amount: string) => void;
}

function AmountCard({ title, hint, cta, icon, busy, primary, full, onSubmit }: AmountCardProps) {
  const [amount, setAmount] = useState("");
  const ok = validAmount(amount);
  return (
    <Card title={title}>
      <div className="stack loose">
        <Field large suffix="tUSDC" placeholder="0" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} hint={hint} error={amount.trim() && !ok ? "Podaj kwotę, np. 100 lub 12,50" : undefined} />
        <div className="row">
          {QUICK.map((value) => (
            <Button key={value} size="sm" variant="outline" onClick={() => setAmount(value)}>
              {value}
            </Button>
          ))}
          {full !== undefined && full > 0n ? (
            <Button size="sm" variant="outline" onClick={() => setAmount(toInputAmount(full))}>
              Całość
            </Button>
          ) : null}
        </div>
        <Button variant={primary ? "primary" : "outline"} size="lg" block icon={icon} disabled={busy || !ok} onClick={() => onSubmit(amount)}>
          {cta}
        </Button>
      </div>
    </Card>
  );
}

/** Put money into the vault or take it back; both also reset the silence counter. */
export function FundsPanel({ busy, walletTokens, vaultBalance, onDeposit, onWithdraw }: FundsPanelProps) {
  return (
    <div className="funds-grid">
      <AmountCard
        title="Wpłać do sejfu"
        hint={walletTokens === undefined ? "Zamelduje Cię przy okazji." : `Na koncie masz ${formatPrice(walletTokens)} tUSDC. Wpłata zeruje licznik.`}
        cta="Wpłać"
        icon={<ArrowDownToLine />}
        busy={busy}
        primary
        onSubmit={onDeposit}
      />
      <AmountCard
        title="Wypłać z sejfu"
        hint={`W sejfie jest ${formatPrice(vaultBalance)} tUSDC. Wypłata zeruje licznik.`}
        cta="Wypłać"
        icon={<ArrowUpFromLine />}
        busy={busy}
        primary={false}
        full={vaultBalance}
        onSubmit={onWithdraw}
      />
    </div>
  );
}
