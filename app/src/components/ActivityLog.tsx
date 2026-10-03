import { explorerTx } from "../config";
import { formatDateTime, shortAddress } from "../format";
import type { ActivityEntry } from "../activity";
import { Card } from "../ui";

export function ActivityLog({ entries }: { readonly entries: readonly ActivityEntry[] }) {
  return (
    <Card title="🧾 Twoje transakcje (Solana Explorer)">
      {entries.length === 0 ? (
        <p className="muted">Tu pojawią się linki do transakcji z tej przeglądarki.</p>
      ) : (
        <ul className="timeline">
          {entries.map((entry) => (
            <li key={entry.signature}>
              <time>{formatDateTime(Math.floor(entry.at / 1000))}</time>
              {entry.text}{" "}
              <a href={explorerTx(entry.signature)} target="_blank" rel="noreferrer">
                {shortAddress(entry.signature)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
