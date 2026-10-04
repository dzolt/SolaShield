import { BlockhashExpiredError } from "./txPhase";

/** Polish texts for the program's errors (programs/will_vault/src/error.rs), keyed by error name. */
const PROGRAM_ERRORS: Readonly<Record<string, string>> = {
  InvalidWindow: "Niepoprawna długość okresu.",
  ZeroAmount: "Kwota musi być większa od zera.",
  NotOwner: "Tylko właściciel sejfu może to zrobić.",
  NotGuardian: "Tylko strażnik tego sejfu może zgłosić weto.",
  GuardianIsOwner: "Strażnikiem nie może być właściciel.",
  WrongStatus: "Wypłata dla spadkobierców już ruszyła: sejfu nie da się już zmienić.",
  BeneficiariesLocked: "Lista spadkobierców jest ostateczna i nie da się jej zmienić.",
  InvalidBeneficiaryCount: "Podaj od 1 do 10 spadkobierców.",
  InvalidShares: "Każdy udział musi być większy od zera, a wszystkie razem muszą dać 100%.",
  InvalidBeneficiary: "Każdy spadkobierca może wystąpić raz i nie może nim być właściciel.",
  NoBeneficiaries: "Najpierw wskaż przynajmniej jednego spadkobiercę.",
  NothingToVeto: "Właściciel jest aktywny, procedura wypłaty nie trwa: nie ma czego wetować.",
  NoVetoesLeft: "Strażnik wykorzystał oba weta. Licznik może zresetować już tylko właściciel.",
  ClaimNotOpen: "Za wcześnie: właściciel ma jeszcze czas, żeby się zameldować.",
  BadIndex: "Nie ma spadkobiercy o tym numerze.",
  AlreadyClaimed: "Ten udział został już wypłacony.",
  WrongRecipient: "To konto nie należy do tego spadkobiercy.",
  InsufficientFunds: "W sejfie nie ma tyle pieniędzy.",
  MathOverflow: "Błąd obliczeń (przepełnienie).",
};

/** Turns a wallet / Anchor / RPC error into one short message for the UI. */
export function explainError(error: unknown): string {
  if (error instanceof BlockhashExpiredError) {
    return `Transakcja wygasła, zanim trafiła do sieci: podpis w portfelu trwał ${error.signSeconds} s, a transakcja jest ważna tylko około pół minuty. Spróbuj jeszcze raz i zatwierdź w Phantomie od razu.`;
  }
  const anchorError = (error as { error?: { errorCode?: { code?: string }; errorMessage?: string } } | undefined)?.error;
  const code = anchorError?.errorCode?.code;
  if (code && PROGRAM_ERRORS[code]) return PROGRAM_ERRORS[code];
  if (anchorError?.errorMessage) return anchorError.errorMessage;
  const text = error instanceof Error ? error.message : String(error);
  if (/user rejected|rejected the request|declined/i.test(text)) return "Odrzucono w portfelu.";
  if (/insufficient lamports|insufficient funds|0x1\b/i.test(text)) return "Za mało SOL albo tUSDC. Odbierz testowe tUSDC lub doładuj SOL z faucetu devnetu.";
  if (/AccountNotInitialized|could not find account|account does not exist/i.test(text)) return "Brakuje konta tUSDC. Kliknij najpierw „Odbierz testowe tUSDC”.";
  if (/ConstraintSeeds|seeds constraint/i.test(text)) return "Tylko właściciel sejfu może to zrobić.";
  if (/429|Too Many Requests/i.test(text)) return "RPC ogranicza zapytania. Spróbuj za chwilę.";
  if (/simulation failed|custom program error|Instruction \d+/i.test(text)) {
    const reason = text.match(/Error Message: ([^."\\]+)/)?.[1];
    return reason ? `Program odrzucił transakcję: ${reason.trim()}.` : "Program odrzucił tę transakcję. Odśwież stronę i spróbuj jeszcze raz.";
  }
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}
