import { ShieldCheck, TriangleAlert, UserMinus } from "lucide-react";
import { useState } from "react";
import { explorerAddress } from "../../config";
import type { Will } from "../../data";
import { shortAddress } from "../../format";
import { Button, Card, Disclosure, Field, Notice, Party } from "../../ui";

interface SettingsPanelProps {
  readonly will: Will;
  readonly busy: boolean;
  readonly onGuardian: (address: string) => void;
  readonly onCancel: () => void;
}

/** The guardian, and the one irreversible action (closing the vault) tucked away. */
export function SettingsPanel({ will, busy, onGuardian, onCancel }: SettingsPanelProps) {
  const [guardian, setGuardian] = useState("");
  return (
    <div className="stack loose">
      <Card title="Strażnik z prawem weta">
        <div className="stack loose">
          <p className="muted">Osoba, która może wstrzymać wypłatę, gdy jesteś tylko nieosiągalny (najwyżej dwa razy do Twojego zameldowania). Nie ma dostępu do pieniędzy.</p>
          <div className="row">
            <span className="muted">Teraz:</span>
            {will.guardian ? <Party address={will.guardian.toBase58()} short={shortAddress(will.guardian)} href={explorerAddress(will.guardian.toBase58())} /> : <span>brak strażnika</span>}
          </div>
          <Field label={will.guardian ? "Nowy strażnik" : "Adres portfela strażnika"} placeholder="Adres portfela" mono value={guardian} onChange={(event) => setGuardian(event.target.value)} />
          <div className="row">
            <Button variant="primary" icon={<ShieldCheck />} disabled={busy || !guardian.trim()} onClick={() => onGuardian(guardian)}>
              {will.guardian ? "Zmień strażnika" : "Ustaw strażnika"}
            </Button>
            {will.guardian ? (
              <Button variant="ghost" icon={<UserMinus />} disabled={busy} onClick={() => onGuardian("")}>
                Usuń strażnika
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Disclosure title={<span className="row nowrap"><TriangleAlert size={18} aria-hidden="true" /> Strefa ryzyka</span>}>
        <div className="stack">
          <Notice tone="bad">Zamknięcie sejfu zwraca wszystkie pieniądze Tobie i usuwa testament. Tego nie da się cofnąć.</Notice>
          <div>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Zamknąć sejf? Wszystkie pieniądze wrócą do ciebie, a testament przestanie istnieć.")) onCancel();
              }}
            >
              Anuluj testament i zabierz wszystko
            </Button>
          </div>
        </div>
      </Disclosure>
    </div>
  );
}
