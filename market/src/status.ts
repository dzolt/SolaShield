import { windowEnd, type Deal } from "./data";

export type Tone = "ok" | "warn" | "bad" | "info";

/** One label per deal state, phrased for players rather than for the program. */
export function dealLabel(deal: Deal, now: number): { text: string; tone: Tone } {
  switch (deal.status) {
    case "listed":
      return deal.listingVerified ? { text: "Na sprzedaż · potwierdzony w Steam", tone: "ok" } : { text: "Na sprzedaż · niepotwierdzony", tone: "warn" };
    case "funded":
      return now > deal.deliveryDeadline ? { text: "Nie dostarczono na czas", tone: "bad" } : { text: "Opłacony · czeka na wymianę", tone: "warn" };
    case "delivered":
      return now > windowEnd(deal) ? { text: "Okno cofnięcia minęło · do wypłaty", tone: "ok" } : { text: "Dostarczony · okno cofnięcia", tone: "warn" };
    case "completed":
      return { text: "Zakończony · sprzedający opłacony", tone: "ok" };
    case "refunded":
      return { text: "Zwrot dla kupującego", tone: "bad" };
  }
}
