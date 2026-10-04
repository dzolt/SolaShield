import type { PublicKey } from "@solana/web3.js";
import type { Deal } from "./data";

/** Who you are in a deal. The choice decides what the app shows; the program itself lets anyone send any proof. */
export type Role = "seller" | "buyer";

const ROLE_PARAM = "role";

export function roleFromUrl(): Role | undefined {
  const value = new URLSearchParams(window.location.search).get(ROLE_PARAM);
  return value === "seller" || value === "buyer" ? value : undefined;
}

/** Keeps the role in the address (?role=seller), so two windows can be opened straight into their views. */
export function writeRoleToUrl(role: Role | undefined): void {
  const url = new URL(window.location.href);
  if (role) url.searchParams.set(ROLE_PARAM, role);
  else url.searchParams.delete(ROLE_PARAM);
  window.history.replaceState(null, "", url);
}

export interface DealFilter {
  readonly id: string;
  readonly label: string;
  readonly empty: string;
  readonly test: (deal: Deal, owner: PublicKey | undefined) => boolean;
}

const finished = (deal: Deal): boolean => deal.status === "completed" || deal.status === "refunded";
const soldBy = (deal: Deal, owner: PublicKey | undefined): boolean => !!owner && deal.seller.equals(owner);
const boughtBy = (deal: Deal, owner: PublicKey | undefined): boolean => !!owner && (deal.buyer?.equals(owner) ?? false);

export const SELLER_FILTERS: readonly DealFilter[] = [
  {
    id: "active",
    label: "Aktywne",
    empty: "Nie masz jeszcze ogłoszeń. Wystaw skina w zakładce „Wystaw skina”.",
    test: (deal, owner) => soldBy(deal, owner) && !finished(deal),
  },
  { id: "done", label: "Zakończone", empty: "Zakończone transakcje pojawią się tutaj.", test: (deal, owner) => soldBy(deal, owner) && finished(deal) },
];

export const BUYER_FILTERS: readonly DealFilter[] = [
  {
    id: "open",
    label: "Otwarte",
    empty: "Nikt jeszcze nic nie wystawił. Poproś sprzedającego albo wejdź w widok sprzedającego i wystaw skina.",
    test: (deal) => deal.status === "listed" && deal.listingVerified,
  },
  { id: "mine", label: "Moje zakupy", empty: "Jeszcze nic nie kupiłeś.", test: boughtBy },
  { id: "all", label: "Wszystkie", empty: "Nic tu jeszcze nie ma.", test: () => true },
];
