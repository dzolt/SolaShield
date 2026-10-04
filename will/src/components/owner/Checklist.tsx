import { Check } from "lucide-react";
import type { ReactNode } from "react";
import type { Will } from "../../data";
import { Button, Card, cx, Progress } from "../../ui";

export type OwnerTab = "overview" | "heirs" | "funds" | "settings";

interface ChecklistProps {
  readonly will: Will;
  readonly onGo: (tab: OwnerTab) => void;
}

interface Item {
  readonly key: string;
  readonly title: string;
  readonly text: string;
  readonly done: boolean;
  readonly tab: OwnerTab;
  readonly action: string;
  readonly optional?: boolean;
}

/** What is left to do after creating a vault; disappears once money and heirs are in place. */
export function Checklist({ will, onGo }: ChecklistProps): ReactNode {
  const items: readonly Item[] = [
    { key: "funds", title: "Wpłać środki", text: "Bez nich nie ma co przekazać.", done: will.balance > 0n, tab: "funds", action: "Wpłać" },
    { key: "heirs", title: "Wskaż spadkobierców", text: "Adresy portfeli i procenty, razem 100%.", done: will.heirs.length > 0, tab: "heirs", action: "Dodaj" },
    { key: "guardian", title: "Dodaj strażnika", text: "Opcjonalnie: ktoś, kto może wstrzymać wypłatę przez pomyłkę.", done: will.guardian !== null, tab: "settings", action: "Ustaw", optional: true },
  ];
  const required = items.filter((item) => !item.optional);
  if (required.every((item) => item.done)) return null;
  const doneCount = items.filter((item) => item.done).length;

  return (
    <Card title="Dokończ konfigurację" aside={<span className="muted small">{doneCount} z {items.length}</span>}>
      <div className="stack loose">
        <Progress fraction={doneCount / items.length} />
        <ul className="checklist">
          {items.map((item) => (
            <li key={item.key} className={cx("check-item", item.done && "is-done")}>
              <span className="check-dot">{item.done ? <Check aria-hidden="true" /> : null}</span>
              <div className="stack tight grow">
                <strong>
                  {item.title}
                  {item.optional ? <span className="muted small"> (opcjonalnie)</span> : null}
                </strong>
                <span className="muted small">{item.text}</span>
              </div>
              {item.done ? null : (
                <Button size="sm" variant={item.optional ? "ghost" : "soft"} onClick={() => onGo(item.tab)}>
                  {item.action}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
