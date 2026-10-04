import type { ReactNode } from "react";
import { cx } from "./cx";

const hueOf = (text: string): number => {
  let hue = 0;
  for (const char of text) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
};

/** The colour pair an address gets everywhere (avatar, share bars, charts). */
export function colorsOf(address: string): { readonly from: string; readonly to: string } {
  const hue = hueOf(address);
  return { from: `hsl(${hue} 62% 56%)`, to: `hsl(${(hue + 40) % 360} 64% 42%)` };
}

/** A round badge whose colour comes from the address, so the same wallet looks the same everywhere. */
export function Avatar({ address, large }: { readonly address: string; readonly large?: boolean }) {
  const { from, to } = colorsOf(address);
  return (
    <span className={cx("avatar", large && "avatar-lg")} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} aria-hidden="true">
      {address.slice(0, 2).toUpperCase()}
    </span>
  );
}

interface PartyProps {
  readonly address: string;
  readonly short: string;
  readonly href?: string;
  readonly tag?: ReactNode;
  readonly large?: boolean;
}

/** A wallet shown as avatar plus a short address that links to the Explorer. */
export function Party({ address, short, href, tag, large }: PartyProps) {
  return (
    <span className="party">
      <Avatar address={address} large={large} />
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {short}
        </a>
      ) : (
        <span className="party-name">{short}</span>
      )}
      {tag}
    </span>
  );
}
