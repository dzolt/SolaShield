import { windowEnd, type Deal } from "./data";
import type { Tone } from "./ui";

export interface DealLabel {
  readonly text: string;
  readonly tone: Tone;
}

/** A short label per deal state, phrased for people rather than for the program (cards, badges). */
export function dealLabel(deal: Deal, now: number): DealLabel {
  switch (deal.status) {
    case "listed":
      return deal.listingVerified ? { text: "Na sprzedaż", tone: "ok" } : { text: "Niepotwierdzone", tone: "warn" };
    case "funded":
      return now > deal.deliveryDeadline ? { text: "Po terminie", tone: "bad" } : { text: "Opłacone", tone: "accent" };
    case "delivered":
      return now > windowEnd(deal) ? { text: "Do wypłaty", tone: "ok" } : { text: "Okno cofnięcia", tone: "warn" };
    case "completed":
      return { text: "Zakończone", tone: "ok" };
    case "refunded":
      return { text: "Zwrot", tone: "bad" };
  }
}

export const isFinished = (deal: Deal): boolean => deal.status === "completed" || deal.status === "refunded";
