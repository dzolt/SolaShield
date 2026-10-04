import type { CSSProperties } from "react";

export function Skeleton({ width = "100%", height = 16, radius }: { readonly width?: number | string; readonly height?: number | string; readonly radius?: number }) {
  const style: CSSProperties = { width, height, ...(radius === undefined ? {} : { borderRadius: radius }) };
  return <div className="skeleton" style={style} aria-hidden="true" />;
}
