import type { Will } from "../../data";
import { formatPrice } from "../../format";
import { Segmented } from "../../ui";

interface WillPickerProps {
  readonly wills: readonly Will[];
  readonly selected: string | undefined;
  readonly onSelect: (address: string) => void;
}

/** Shown only when the account has more than one will in this role: the newest is number one. */
export function WillPicker({ wills, selected, onSelect }: WillPickerProps) {
  if (wills.length < 2) return null;
  const options = wills.map((will, index) => ({
    value: will.address.toBase58(),
    label: `Sejf ${wills.length - index} · ${formatPrice(will.distributing ? will.distributedTotal : will.balance)} tUSDC`,
  }));
  return <Segmented value={selected ?? options[0].value} options={options} onChange={onSelect} label="Wybór sejfu" />;
}
