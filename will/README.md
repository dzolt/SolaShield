# Sejf spadkowy (`programs/will_vault`)

Testament bez notariusza: właściciel odkłada tUSDC do sejfu programu i wskazuje spadkobierców z procentami. Gdy przestanie się meldować, program sam dzieli saldo.

- **Osobny adres i osobna pula na każdy testament** (PDA z właściciela i numeru, sejf na tokeny ma za właściciela ten PDA). Nic nie miesza się z ProofSwap ani z pulą ubezpieczeń.
- **Czas:** cisza przez `inactivity_period` (produkcyjnie 90 dni), potem procedura `claim_period` (30 dni), potem wypłatę uruchamia `trigger_distribution` **dowolna osoba**. Okresy są w konfiguracji programu, w demo 20 s i 10 s.
- **Wpłacać i wypłacać może tylko właściciel**, a każda jego transakcja resetuje licznik. Dopóki nikt nie uruchomił wypłaty, może się też zameldować (`check_in`) albo anulować testament (`cancel_will`, wraca wszystko i opłata za konta).
- **Spadkobiercy i procenty mogą być ostateczne** (`lock_beneficiaries`), a wpłaty dalej działają. Udziały liczy się od salda w chwili wypłaty. Ostateczny jest więc podział, nie kwota: właściciel nadal może wypłacić pieniądze albo anulować sejf.
- **Strażnik** (jedna osoba) może zgłosić weto dopiero, gdy właściciel zamilkł, i najwyżej 2 razy do czasu, aż właściciel się zamelduje. Nie ma dostępu do pieniędzy.
- **Wypłata „pull”:** każdy spadkobierca odbiera udział osobnym `claim_share`, więc brak konta tokenowego jednej osoby nie blokuje reszty. Reszta z zaokrągleń trafia do ostatniego spadkobiercy.

```bash
anchor build -p will_vault && solana program deploy target/deploy/will_vault.so --program-id target/deploy/will_vault-keypair.json --keypair keys/deployer.json
CLUSTER=localnet npm run will:setup   # konfiguracja (INACTIVITY=.. CLAIM=.. w sekundach), kopiuje IDL do will/
CLUSTER=localnet npm run will:check   # test dymny: cały scenariusz razem z odmowami
cd will && npm install && npm run dev # aplikacja: http://localhost:5177 (adresy w will.<klaster>.json)
```

Ograniczenia: jeśli właściciel zginie i nikt nie uruchomi wypłaty, pieniądze czekają w sejfie (nie wygasają). Program nie był audytowany.
