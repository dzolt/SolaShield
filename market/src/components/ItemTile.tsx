import type { ReactNode } from "react";
import { steamImage } from "../config";
import { shortWear } from "../format";

interface ItemTileProps {
  readonly name: string;
  readonly wear: string;
  readonly pattern: number;
  readonly icon?: string;
  readonly color?: string;
  readonly selected?: boolean;
  readonly highlight?: boolean;
  readonly dimmed?: boolean;
  readonly onClick?: () => void;
  readonly children?: ReactNode;
}

/** A CS2 item as players know it from Steam: image, name, float and pattern, framed in its rarity colour. */
export function ItemTile({ name, wear, pattern, icon, color = "b0c3d9", selected, highlight, dimmed, onClick, children }: ItemTileProps) {
  const classes = ["tile", selected ? "selected" : "", highlight ? "highlight" : "", dimmed ? "dimmed" : "", onClick ? "clickable" : ""].join(" ");
  return (
    <div className={classes} style={{ borderTopColor: `#${color}` }} onClick={onClick} role={onClick ? "button" : undefined}>
      <div className="tile-img">{icon ? <img src={steamImage(icon)} alt="" loading="lazy" /> : <span className="muted">brak obrazka</span>}</div>
      <div className="tile-name" title={name}>
        {name}
      </div>
      <div className="tile-meta">
        <span title={wear}>float {shortWear(wear)}</span>
        {pattern ? <span>wzór {pattern}</span> : null}
      </div>
      {children}
    </div>
  );
}
