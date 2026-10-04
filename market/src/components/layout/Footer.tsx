import { ExternalLink } from "lucide-react";
import { explorerAddress, PROGRAM_ID } from "../../config";
import { shortAddress } from "../../format";

export function Footer() {
  return (
    <footer className="footer">
      <span>ProofSwap · projekt hackathonowy na Solana devnet. Okno cofnięcia w demo jest skrócone.</span>
      <a href={explorerAddress(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">
        program {shortAddress(PROGRAM_ID)} <ExternalLink size={13} style={{ verticalAlign: "-2px" }} aria-hidden="true" />
      </a>
    </footer>
  );
}
