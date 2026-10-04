import { Check, Package } from "lucide-react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { steamImage } from "../../config";
import { shortWear, splitItemName } from "../../format";
import { cx, Pill } from "../../ui";

export interface ItemLook {
  readonly icon?: string;
  readonly color?: string;
}

interface ItemCardProps {
  readonly name: string;
  readonly wear: string;
  readonly pattern: number;
  readonly look: ItemLook;
  /** Overlay in the top-left corner of the picture (a status). */
  readonly badge?: ReactNode;
  readonly footer?: ReactNode;
  readonly selected?: boolean;
  readonly dimmed?: boolean;
  readonly onClick?: () => void;
}

/** Rarity colour of an item as a CSS variable, used for the glow behind its picture. */
export const rarityStyle = (look: ItemLook): CSSProperties => ({ "--rarity": `#${look.color ?? "8ea0b8"}` }) as CSSProperties;

/** The picture of an item on a soft, rarity-coloured background. */
export function ItemImage({ look, size }: { readonly look: ItemLook; readonly size?: "sm" | "lg" }) {
  return (
    <div className={cx("item-image", size && `item-image-${size}`)} style={rarityStyle(look)}>
      {look.icon ? <img src={steamImage(look.icon)} alt="" loading="lazy" /> : <Package aria-hidden="true" />}
    </div>
  );
}

/** An item as players know it: picture, name, condition, float and pattern. Clickable when `onClick` is given. */
export function ItemCard({ name, wear, pattern, look, badge, footer, selected, dimmed, onClick }: ItemCardProps) {
  const { title, exterior } = splitItemName(name);
  const onKey = (event: KeyboardEvent): void => {
    if (onClick && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onClick();
    }
  };
  return (
    <div
      className={cx("item-card", onClick && "is-clickable", selected && "is-selected", dimmed && "is-dimmed")}
      style={rarityStyle(look)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick && selected !== undefined ? selected : undefined}
      onClick={onClick}
      onKeyDown={onKey}
    >
      <div className="item-media">
        {look.icon ? <img src={steamImage(look.icon)} alt="" loading="lazy" /> : <Package aria-hidden="true" />}
        {badge ? <div className="item-badge">{badge}</div> : null}
        {selected ? (
          <span className="item-check" aria-hidden="true">
            <Check />
          </span>
        ) : null}
      </div>
      <div className="item-body">
        <div className="item-title" title={name}>
          {title}
        </div>
        {exterior ? <div className="item-sub">{exterior}</div> : null}
        <div className="item-pills">
          {wear ? <Pill label="float">{shortWear(wear)}</Pill> : null}
          {pattern ? <Pill label="wzór">{pattern}</Pill> : null}
        </div>
      </div>
      {footer ? <div className="item-foot">{footer}</div> : null}
    </div>
  );
}

export function ItemCardSkeleton() {
  return (
    <div className="item-card" aria-hidden="true">
      <div className="item-media skeleton" style={{ borderRadius: 0 }} />
      <div className="item-body">
        <div className="skeleton" style={{ height: 16, width: "70%" }} />
        <div className="skeleton" style={{ height: 12, width: "40%" }} />
        <div className="skeleton" style={{ height: 22, width: "60%" }} />
      </div>
    </div>
  );
}
