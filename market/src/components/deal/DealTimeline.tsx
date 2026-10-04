import { windowEnd, type Deal } from "../../data";
import { formatDuration, formatPrice, formatTime } from "../../format";
import { Timeline, type TimelineStep } from "../../ui";

/** The stages of one deal, derived from what the program stored. */
export function dealSteps(deal: Deal, now: number): TimelineStep[] {
  const funded = deal.fundedAt > 0;
  const delivered = deal.deliveredAt > 0;
  const settled = deal.status === "completed" || deal.status === "refunded";
  const end = windowEnd(deal);
  return [
    {
      key: "listed",
      title: "Wystawione",
      detail: `${formatTime(deal.createdAt)} · ${deal.listingVerified ? "potwierdzone: przedmiot jest u sprzedającego" : "czeka na potwierdzenie ze Steama"}`,
      state: "done",
    },
    {
      key: "funded",
      title: "Zapłacone do sejfu programu",
      detail: funded ? `${formatTime(deal.fundedAt)} · ${formatPrice(deal.price)} tUSDC czeka w sejfie` : "czeka na kupującego",
      state: funded ? "done" : "active",
    },
    {
      key: "delivered",
      title: "Przedmiot dostarczony",
      detail: delivered ? `${formatTime(deal.deliveredAt)} · potwierdzone w inventory kupującego` : funded ? `sprzedający ma czas do ${formatTime(deal.deliveryDeadline)}` : "po zapłacie",
      state: delivered ? "done" : deal.status === "refunded" ? "failed" : funded ? "active" : "todo",
    },
    {
      key: "window",
      title: "Okno cofnięcia wymiany",
      detail: delivered
        ? now > end
          ? `zamknięte ${formatTime(end)}`
          : `jeszcze ${formatDuration(end - now)}`
        : `ochrona ${formatDuration(deal.protectionPeriod)} + zapas ${formatDuration(deal.gracePeriod)}`,
      state: delivered ? (now > end || settled ? "done" : "active") : "todo",
    },
    {
      key: "settled",
      title: deal.status === "refunded" ? "Zwrot dla kupującego" : "Rozliczenie",
      detail: settled
        ? `${formatTime(deal.settledAt)} · ${deal.status === "completed" ? "pieniądze trafiły do sprzedającego" : "pieniądze wróciły do kupującego"}`
        : "wypłata albo zwrot, zawsze według reguł programu",
      state: deal.status === "completed" ? "done" : deal.status === "refunded" ? "failed" : "todo",
    },
  ];
}

export function DealTimeline({ deal, now }: { readonly deal: Deal; readonly now: number }) {
  return <Timeline steps={dealSteps(deal, now)} />;
}
