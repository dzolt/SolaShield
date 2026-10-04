# ⇄ ProofSwap: skiny CS2 od obcych, bez middlemana (Solana, Anchor)

**Dla kogo:** gracze CS2, którzy kupują i sprzedają skiny poza Steam Market (Discord, Reddit, grupy wymiany), czyli z obcymi ludźmi, bez historii i bez możliwości dochodzenia czegokolwiek.

**Problem:** Steam Market bierze 15% prowizji (5% Steam + 10% CS2), pojedyncze ogłoszenie może kosztować najwyżej 1 800 USD, a pieniędzy z portfela Steam nie da się wypłacić. Duże wymiany idą więc przez „middlemanów” (zaufanych pośredników, pod których podszywają się oszuści) albo przez marketplace'y, które trzymają pieniądze i same rozstrzygają. Od lipca 2025 r. Steam pozwala sprzedającemu **cofnąć wymianę przez 7 dni** (Trade Protection): sprzedający może wziąć pieniądze, a potem odebrać skina.

**Rozwiązanie:** kupujący płaci do sejfu programu na Solanie. Sprzedający wysyła skina zwykłą wymianą na Steamie. Program wypłaca pieniądze dopiero wtedy, gdy Steam pokazuje skina w inventory kupującego **i** minie okno, w którym wymianę można cofnąć. Jeśli w tym oknie skin wróci do sprzedającego, kupujący dostaje zwrot. Pośrednika, który trzyma pieniądze i decyduje, nie ma.

## Gdzie znika pośrednik (kod)

Cała logika jest w [`programs/proofswap/src/`](programs/proofswap/src/):

| Reguła | Gdzie |
|---|---|
| Pieniądze leżą w sejfie, którym rządzi tylko program (PDA transakcji); nikt, także my, nie ma do niego klucza | `instructions/fund.rs`, `token_utils.rs` |
| Kupić można dopiero, gdy Steam potwierdzi, że skin jest u sprzedającego | `instructions/fund.rs` (`listing_verified`) |
| Płacić można tylko z publicznym inventory: bez świeżego podpisu atestatora „inventory tego konta Steam jest czytelne” wpłata się nie wykona. Dzięki temu dostawę da się udowodnić, a ukrycie inventory po zapłacie jest świadomą decyzją kupującego | `instructions/fund.rs` |
| Egzemplarz to nazwa + float + wzór; przedmioty bez floatu (nieunikalne) są odrzucane | `instructions/create_listing.rs` |
| Dostawa: podpisana obserwacja „skin jest w inventory kupującego”, w terminie dostawy | `instructions/attest.rs` |
| Wypłata dopiero po oknie cofnięcia (ochrona Steama + zapas), uruchomić może każdy | `instructions/settle.rs` (`finalize`) |
| Cofnięcie w oknie (skin wrócił do sprzedającego) albo ukrycie inventory przez sprzedającego oznacza zwrot | `instructions/attest_settle.rs` |
| Ukrycie inventory przez kupującego po zapłacie, **a przed dostawą**, oznacza wypłatę dla sprzedającego. W oknie cofnięcia prywatność kupującego nic nie zmienia, więc sprzedający nie może skrócić okna | `instructions/attest_settle.rs` |
| Brak dostawy w terminie oznacza zwrot, uruchomić może każdy | `instructions/settle.rs` (`refund`) |
| Podpis atestatora sprawdza natywny program Ed25519 w tej samej transakcji; program porównuje klucz i dokładną treść wiadomości: transakcja, rodzaj obserwacji, **konto Steam**, czas, hash dowodu. Dowód o jednym koncie nie zastąpi dowodu o innym | `attestation.rs` |

Konto transakcji na łańcuchu przechowuje SteamID obu stron, odcisk przedmiotu, cenę, terminy i hash ostatniego dowodu, więc każdy może sprawdzić, na jakiej podstawie poszła wypłata.

## Kto co może

| Kto | Co może | Czego nie może |
|---|---|---|
| Sprzedający | wystawić i wycofać nieopłacone ogłoszenie | wypłacić pieniądze przed końcem okna cofnięcia |
| Kupujący | zapłacić do sejfu | wyjąć pieniędzy z sejfu na własną rękę; zwrot przychodzi tylko według reguł programu |
| Atestator | podpisać to, co widzi w publicznym inventory Steam | ruszyć pieniędzy ani wysłać ich nikomu poza kupującym i sprzedającym tej transakcji |
| Każdy | wysłać podpisany dowód, uruchomić wypłatę albo zwrot, gdy minie termin | zmienić reguły |
| Autor (my) | raz ustawić konfigurację (atestator, token, okna czasowe) | zmienić jej później: nie ma instrukcji administratora |

Kod programu na devnecie da się jeszcze podmienić kluczem wdrożeniowym. Ostatni krok przed oddaniem projektu to zablokowanie aktualizacji (`solana program set-upgrade-authority --final`); wtedy reguł nie zmieni już nikt.

## Atestator: co robi i czym różni się od pośrednika

Program na Solanie nie ma dostępu do internetu, więc nie może sam zapytać Steama. Atestator ([`attestor/`](attestor/)) czyta **publiczne** inventory (`steamcommunity.com/inventory/<steamid>/730/2`), szuka egzemplarza po nazwie, floacie i wzorze i podpisuje, co zobaczył i kiedy. Nie trzyma pieniędzy i nie może ich wysłać nikomu spoza transakcji, a o wypłacie decydują reguły programu. Podpisany dowód może wysłać na łańcuch każdy, a każdą obserwację da się sprawdzić w tym samym publicznym inventory (hash dowodu jest zapisany na koncie transakcji).

Uczciwie: w MVP atestator to jeden klucz, któremu program ufa. Może odmówić podpisu albo podpisać nieprawdę, a wtedy transakcja rozstrzygnie się źle. Następny krok to **zkTLS** (np. Reclaim, którego weryfikator działa już na Solanie): program sprawdza wtedy dowód samej odpowiedzi HTTPS ze Steama zamiast słowa jednego atestatora.

## Uczciwie o ograniczeniach

- **Symulator Steama w demo.** Żeby pokazać wymianę bez dwóch prawdziwych kont Steam (Steam Guard od 7 dni, konta bez ograniczeń), dwa konta demo są symulowane w atestatorze, z inventory w dokładnie takim formacie, jaki zwraca Steam. Każdy inny SteamID atestator czyta z prawdziwego Steama.
- **Okno cofnięcia jest w demo skrócone** (90 s + 15 s). Na produkcji musi wynosić co najmniej 7 dni (Trade Protection) plus zapas.
- **Publiczne inventory jest warunkiem.** Ukrycie go w trakcie transakcji działa na niekorzyść tego, kto je ukrył: sprzedający w oknie cofnięcia traci sprzedaż (zwrot dla kupującego), a kupujący po zapłacie i przed dostawą traci pieniądze (wypłata dla sprzedającego). Interfejs mówi o tym wprost przed płatnością.
- **Dowód cofnięcia musi trafić na łańcuch przed końcem okna.** W demo wysyła go przycisk, bo każdy może to zrobić. Na produkcji potrzebny jest strażnik (bot, którego może uruchomić każdy kupujący albo osoba trzecia) sprawdzający inventory sprzedającego co kilka minut przez cały okres ochrony.
- **Konto Steam nie jest jeszcze powiązane z portfelem.** Fałszywe ogłoszenie z cudzym SteamID (z publicznym inventory) nie ukradnie pieniędzy, bo dostawa przyjdzie tylko z prawdziwego konta, więc kupujący dostaje zwrot po terminie dostawy. Może jednak zająć mu czas. Następny krok to logowanie przez Steam OpenID i podpis „to konto należy do tego portfela”.
- **Steam ogranicza liczbę zapytań** do inventory; przy dużym ruchu atestator potrzebuje cache i kilku adresów.
- **Trade Protection dotyczy dziś tylko CS2.** Dla innych gier ze Steama okres sporu ustawia się w konfiguracji.
- **Token tUSDC** to testowy token z otwartym faucetem (devnet). Program nie był audytowany.

## Uruchomienie

Wymagania: Docker (Anchor, Solana, Surfpool w `Dockerfile`), Node 22+.

```bash
npm install && (cd market && npm install)

# devnet (program już wdrożony, adresy niżej)
export CLUSTER=devnet RPC_URL=<adres RPC devnetu>
npm run attestor                      # atestator + symulator Steama na http://localhost:8787
cd market && npm run dev              # aplikacja na http://localhost:5176 (VITE_RPC_URL w market/.env.local)

# test dymny całego przepływu (atestator musi działać)
npm run ps:check
```

Lokalnie: walidator Surfpool w kontenerze, `solana program deploy target/deploy/proofswap.so ...`, potem `CLUSTER=localnet npm run ps:setup` i to samo co wyżej z `CLUSTER=localnet`.

**Phantom:** Ustawienia → Developer Settings → Testnet Mode → Solana Devnet. W aplikacji przycisk „Odbierz testowe tUSDC” daje tokeny do płacenia.

## Adresy na devnecie

| Co | Adres |
|---|---|
| Program ProofSwap | `7kWKy3wvsLi37vZ5Cp3YvcrpvAkscHj5mXWopBG2JaZd` |
| Konfiguracja | `6EHFTtviJRkYUhb2jiSEePGa5qAYvfvnBiyZWJtqUBNM` |
| Klucz atestatora | `EhcyoHBQgb3CywfVyhVXjhW7AYgKTqqffXKFpPNVddt6` |
| Token tUSDC (z otwartym faucetem) | `Dfxy54rAvVdZD2CKnEHe4J594q7PFixe5BJMJDx1yrdH` |

## Sejf spadkowy (`programs/will_vault`)

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
cd will && npm install && npm run dev # aplikacja: http://localhost:5177
```

Ograniczenia: jeśli właściciel zginie i nikt nie uruchomi wypłaty, pieniądze czekają w sejfie (nie wygasają). Program nie był audytowany.

## Struktura

```
programs/proofswap/        program Anchor: ogłoszenia, sejf, atestacje Ed25519, okno cofnięcia, wypłata i zwrot
attestor/                  atestator (czyta inventory Steam, podpisuje obserwacje) i symulator Steama do demo
market/                    aplikacja React + Wallet Adapter (Phantom): rynek, wystawianie, transakcja z dowodami
scripts/proofswap-setup.ts konfiguracja programu na klastrze, kopiuje IDL do aplikacji
scripts/proofswap-check.ts test dymny: sprzedaż, cofnięcie wymiany, odmowa fałszywej dostawy
programs/will_vault/       program Anchor: sejf spadkowy (licznik ciszy, spadkobiercy, strażnik, wypłata na żądanie)
will/                      aplikacja React dla sejfu spadkowego (port 5177)
scripts/will-*.ts          konfiguracja i test dymny sejfu spadkowego
programs/micro_insurance/  wcześniejszy prototyp (SolaShield); ProofSwap korzysta tylko z jego otwartego faucetu tUSDC
app/, scripts/*.ts         aplikacja i skrypty wcześniejszego prototypu
```
