import type * as anchor from "@anchor-lang/core";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import { FAUCET_TOKENS, MAX_BENEFICIARIES, MINT, TOKEN_DECIMALS, TOTAL_BPS } from "./config";
import { shareOf, willAddress, type Will } from "./data";
import { formatPercent, formatUsdc, parseAddress, parsePercent, parseUsdc, shortAddress } from "./format";
import type { ActionOutcome } from "./hooks";
import { BN, makeFaucet, type SigningWallet } from "./program";

const ata = (owner: PublicKey): PublicKey => getAssociatedTokenAddressSync(MINT, owner);

export interface HeirDraft {
  readonly wallet: string;
  readonly percent: string;
}

export async function claimTokens(wallet: SigningWallet): Promise<ActionOutcome> {
  const signature = await makeFaucet(wallet)
    .methods.faucet(new BN(FAUCET_TOKENS * 10 ** TOKEN_DECIMALS))
    .accounts({ user: wallet.publicKey, mint: MINT, tokenProgram: TOKEN_PROGRAM_ID })
    .rpc();
  return { message: `Dostałeś ${FAUCET_TOKENS} testowych tUSDC.`, signature };
}

function optionalGuardian(input: string, owner: PublicKey): PublicKey | null {
  if (!input.trim()) return null;
  const guardian = parseAddress(input, "Strażnik");
  if (guardian.equals(owner)) throw new Error("Strażnikiem nie może być właściciel.");
  return guardian;
}

export async function createWill(program: anchor.Program, owner: PublicKey, guardianInput: string): Promise<{ outcome: ActionOutcome; will: PublicKey }> {
  const guardian = optionalGuardian(guardianInput, owner);
  // Milliseconds since 1970 are unique enough per wallet and keep the address computable before sending.
  const id = BigInt(Date.now());
  const will = willAddress(owner, id);
  const signature = await program.methods
    .createWill(new BN(id.toString()), guardian)
    .accounts({ owner, mint: MINT, tokenProgram: TOKEN_PROGRAM_ID })
    .rpc();
  return { outcome: { message: "Sejf założony. Teraz wpłać pieniądze i wskaż spadkobierców.", signature }, will };
}

function fundsAccounts(owner: PublicKey, will: Will) {
  return { owner, will: will.address, mint: MINT, ownerAta: ata(owner), tokenProgram: TOKEN_PROGRAM_ID };
}

export async function deposit(program: anchor.Program, owner: PublicKey, will: Will, input: string): Promise<ActionOutcome> {
  const amount = parseUsdc(input);
  if (amount <= 0n) throw new Error("Kwota musi być większa od zera.");
  const signature = await program.methods.deposit(new BN(amount.toString())).accounts(fundsAccounts(owner, will)).rpc();
  return { message: `Wpłacono ${formatUsdc(amount)}. Licznik wrócił do początku.`, signature };
}

export async function withdraw(program: anchor.Program, owner: PublicKey, will: Will, input: string): Promise<ActionOutcome> {
  const amount = parseUsdc(input);
  if (amount <= 0n) throw new Error("Kwota musi być większa od zera.");
  if (amount > will.balance) throw new Error(`W sejfie jest tylko ${formatUsdc(will.balance)}.`);
  const signature = await program.methods.withdraw(new BN(amount.toString())).accounts(fundsAccounts(owner, will)).rpc();
  return { message: `Wypłacono ${formatUsdc(amount)}. Licznik wrócił do początku.`, signature };
}

export async function cancelWill(program: anchor.Program, owner: PublicKey, will: Will): Promise<ActionOutcome> {
  const signature = await program.methods.cancelWill().accounts(fundsAccounts(owner, will)).rpc();
  return { message: `Sejf zamknięty. Wróciło do ciebie ${formatUsdc(will.balance)} i opłata za konta.`, signature };
}

export async function checkIn(program: anchor.Program, owner: PublicKey, will: Will): Promise<ActionOutcome> {
  const signature = await program.methods.checkIn().accounts({ owner, will: will.address }).rpc();
  return { message: "Zameldowano. Licznik wrócił do początku, strażnik odzyskał weta.", signature };
}

function parseHeirs(drafts: readonly HeirDraft[], owner: PublicKey): { wallet: PublicKey; bps: number }[] {
  const rows = drafts.filter((d) => d.wallet.trim() || d.percent.trim());
  if (rows.length === 0 || rows.length > MAX_BENEFICIARIES) throw new Error(`Podaj od 1 do ${MAX_BENEFICIARIES} spadkobierców.`);
  const heirs = rows.map((d, i) => ({ wallet: parseAddress(d.wallet, `Spadkobierca ${i + 1}`), bps: parsePercent(d.percent) }));
  if (heirs.some((h) => h.bps <= 0)) throw new Error("Każdy udział musi być większy od zera.");
  if (heirs.some((h) => h.wallet.equals(owner))) throw new Error("Właściciel nie może być własnym spadkobiercą.");
  if (new Set(heirs.map((h) => h.wallet.toBase58())).size !== heirs.length) throw new Error("Każdy spadkobierca może wystąpić tylko raz.");
  const sum = heirs.reduce((s, h) => s + h.bps, 0);
  if (sum !== TOTAL_BPS) throw new Error(`Udziały dają razem ${formatPercent(sum)}, a muszą dać 100%.`);
  return heirs;
}

export async function setHeirs(program: anchor.Program, owner: PublicKey, will: Will, drafts: readonly HeirDraft[]): Promise<ActionOutcome> {
  const heirs = parseHeirs(drafts, owner);
  const signature = await program.methods.setBeneficiaries(heirs).accounts({ owner, will: will.address }).rpc();
  return { message: `Zapisano ${heirs.length} spadkobierców. Możesz to jeszcze zmienić, dopóki nie zablokujesz listy.`, signature };
}

export async function lockHeirs(program: anchor.Program, owner: PublicKey, will: Will): Promise<ActionOutcome> {
  const signature = await program.methods.lockBeneficiaries().accounts({ owner, will: will.address }).rpc();
  return { message: "Lista spadkobierców jest ostateczna. Wpłaty i wypłaty dalej działają.", signature };
}

export async function setGuardian(program: anchor.Program, owner: PublicKey, will: Will, input: string): Promise<ActionOutcome> {
  const guardian = optionalGuardian(input, owner);
  const signature = await program.methods.setGuardian(guardian).accounts({ owner, will: will.address }).rpc();
  return { message: guardian ? `Strażnik: ${shortAddress(guardian)}.` : "Sejf nie ma już strażnika.", signature };
}

export async function veto(program: anchor.Program, guardian: PublicKey, will: Will): Promise<ActionOutcome> {
  const signature = await program.methods.veto().accounts({ guardian, will: will.address }).rpc();
  return { message: "Weto przyjęte: procedura wypłaty przerwana, licznik liczy od nowa.", signature };
}

export async function triggerDistribution(program: anchor.Program, submitter: PublicKey, will: Will): Promise<ActionOutcome> {
  const signature = await program.methods.triggerDistribution().accounts({ submitter, will: will.address }).rpc();
  return { message: `Wypłata uruchomiona: ${formatUsdc(will.balance)} do podziału. Każdy spadkobierca może teraz odebrać swój udział.`, signature };
}

/** Anyone may pay a heir their share; the heir's token account is created on the way if it does not exist. */
export async function claimShare(program: anchor.Program, submitter: PublicKey, will: Will, index: number): Promise<ActionOutcome> {
  const heir = will.heirs[index];
  const signature = await program.methods
    .claimShare(index)
    .accounts({ submitter, will: will.address, beneficiaryAta: ata(heir.wallet), mint: MINT, tokenProgram: TOKEN_PROGRAM_ID })
    .preInstructions([createAssociatedTokenAccountIdempotentInstruction(submitter, ata(heir.wallet), heir.wallet, MINT)])
    .rpc();
  const amount = shareOf(will, index, will.distributedTotal);
  return { message: `${shortAddress(heir.wallet)} dostał ${formatUsdc(amount)}.`, signature };
}
