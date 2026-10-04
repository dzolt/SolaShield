import type { ReactNode } from "react";

export interface DonutSegment {
  readonly key: string;
  /** Any positive weight; segments are drawn in proportion. */
  readonly value: number;
  readonly color: string;
}

interface DonutProps {
  readonly segments: readonly DonutSegment[];
  readonly size?: number;
  readonly stroke?: number;
  readonly children?: ReactNode;
}

/** A ring split into coloured arcs (the heirs' shares), with room for a figure in the middle. */
export function Donut({ segments, size = 148, stroke = 18, children }: DonutProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const gap = segments.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {segments.map((segment) => {
          const length = Math.max(0, (segment.value / total) * circumference - gap);
          const arc = (
            <circle
              key={segment.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={stroke}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += (segment.value / total) * circumference;
          return arc;
        })}
      </svg>
      <div className="donut-center">{children}</div>
    </div>
  );
}
