import type { PublicKey } from "@solana/web3.js";
import type { Deal } from "./data";
import { isFinished } from "./status";

/** Who you are in a deal. The choice decides what the app shows; the program itself lets anyone send any proof. */
export type Role = "seller" | "buyer";

const ROLE_PARAM = "role";
const DEAL_PARAM = "deal";

export function roleFromUrl(): Role | undefined {
  const value = new URLSearchParams(window.location.search).get(ROLE_PARAM);
  return value === "seller" || value === "buyer" ? value : undefined;
}

export function dealFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get(DEAL_PARAM) ?? undefined;
}

function writeParam(name: string, value: string | undefined): void {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  window.history.replaceState(null, "", url);
}

/** Keeps the role in the address (?role=seller), so two windows can be opened straight into their views. */
export const writeRoleToUrl = (role: Role | undefined): void => writeParam(ROLE_PARAM, role);

/** Keeps the open deal in the address (?deal=...), so a link opens that transaction. */
export const writeDealToUrl = (deal: string | undefined): void => writeParam(DEAL_PARAM, deal);

export interface DealFilter {
  readonly id: string;
  readonly label: string;
  /** Shown when the list is empty. */
  readonly empty: { readonly title: string; readonly text: string };
  /** The result depends on which account is connected (so an empty list may just mean the wrong account). */
  readonly byAccount?: boolean;
  readonly test: (deal: Deal, owner: PublicKey | undefined) => boolean;
}

const soldBy = (deal: Deal, owner: PublicKey | undefined): boolean => !!owner && deal.seller.equals(owner);
const boughtBy = (deal: Deal, owner: PublicKey | undefined): boolean => !!owner && (deal.buyer?.equals(owner) ?? false);

export const SELLER_FILTERS: readonly DealFilter[] = [
  {
    id: "active",
    label: "Aktywne",
    byAccount: true,
    empty: { title: "Nie masz jeszcze ogłoszeń", text: "Wystaw pierwszy przedmiot: wybierz go z inventory, ustal cenę, a źródło potwierdzi, że go masz." },
    test: (deal, owner) => soldBy(deal, owner) && !isFinished(deal),
  },
  {
    id: "done",
    label: "Zakończone",
    byAccount: true,
    empty: { title: "Brak zakończonych transakcji", text: "Gdy transakcja się zakończy, pojawi się tutaj." },
    test: (deal, owner) => soldBy(deal, owner) && isFinished(deal),
  },
];

export const BUYER_FILTERS: readonly DealFilter[] = [
  {
    id: "open",
    label: "Otwarte",
    empty: { title: "Rynek jest jeszcze pusty", text: "Nikt nie wystawił jeszcze niczego do kupienia. Przełącz się na „Sprzedaję”, żeby wystawić pierwszy przedmiot." },
    test: (deal) => deal.status === "listed" && deal.listingVerified,
  },
  {
    id: "mine",
    label: "Moje zakupy",
    byAccount: true,
    empty: { title: "Jeszcze nic nie kupiłeś", text: "Zakupy, które zrobisz, pojawią się tutaj razem z ich stanem." },
    test: boughtBy,
  },
  {
    id: "all",
    label: "Wszystkie",
    empty: { title: "Nic tu jeszcze nie ma", text: "Gdy ktoś wystawi przedmiot, zobaczysz go tutaj." },
    test: () => true,
  },
];
