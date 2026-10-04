import type { PublicKey } from "@solana/web3.js";
import type { HeirDraft } from "./actions";
import type { Will } from "./data";
import type { ActionRunner } from "./hooks";

/** Everything a person can do with a will; the app wires each one to a transaction. */
export interface WillActions {
  readonly onCheckIn: () => void;
  readonly onDeposit: (amount: string) => void;
  readonly onWithdraw: (amount: string) => void;
  readonly onGuardian: (address: string) => void;
  readonly onCancel: () => void;
  readonly onSaveHeirs: (drafts: readonly HeirDraft[]) => void;
  readonly onLockHeirs: () => void;
  readonly onVeto: () => void;
  readonly onTrigger: () => void;
  readonly onClaimShare: (index: number) => void;
}

/** What every role's view needs to know about the will on screen. */
export interface WillContext {
  readonly will: Will;
  readonly now: number;
  readonly me: PublicKey | undefined;
  readonly runner: ActionRunner;
}
