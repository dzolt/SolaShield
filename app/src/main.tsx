import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { RPC_URL } from "./config";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// No explicit wallet adapters: Phantom, Solflare, Backpack and others register themselves through the Wallet Standard.
createRoot(root).render(
  <StrictMode>
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </StrictMode>,
);
