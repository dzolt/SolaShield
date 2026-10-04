# ⇄ ProofSwap: wymiana aktywów cyfrowych między obcymi, bez pośrednika (Solana, Anchor)

**Dla kogo:** osoby, które kupują i sprzedają aktywa cyfrowe od obcych poza regulowanymi rynkami: bez historii, bez możliwości dochodzenia czegokolwiek i bez zaufanego pośrednika pod ręką. Pierwszy konkretny użytkownik w demo: gracz CS2, który wymienia skiny na Discordzie lub Reddicie.

**Problem:** przy każdej wymianie aktywa za pieniądze ktoś musi zaufać pierwszy. Kupujący płaci i może nie dostać aktywa, sprzedający przekazuje je i może nie dostać pieniędzy. Zwykle ratuje to pośrednik (escrow, marketplace, „middleman”), który trzyma pieniądze, pobiera prowizję i sam rozstrzyga, a pod którego podszywają się oszuści. Przykład z CS2: Steam Market bierze 15% prowizji (5% Steam + 10% CS2), pojedyncze ogłoszenie może kosztować najwyżej 1 800 USD, a pieniędzy z portfela Steam nie da się wypłacić. Do tego od lipca 2025 r. Steam pozwala sprzedającemu **cofnąć wymianę przez 7 dni** (Trade Protection): sprzedający może wziąć pieniądze, a potem odebrać aktywo.

**Rozwiązanie:** kupujący płaci do sejfu programu na Solanie. Sprzedający przekazuje aktywo zwykłym kanałem. Program wypłaca pieniądze dopiero wtedy, gdy **publiczne źródło potwierdza, że aktywo jest u kupującego, i** minie okno, w którym przekazanie można cofnąć. Jeśli w tym oknie aktywo wróci do sprzedającego, kupujący dostaje zwrot. Pośrednika, który trzyma pieniądze i decyduje, nie ma.

**Co jest ogólne, a co jest przykładem.** Ogólny jest mechanizm: sejf rządzony przez program, podpisane potwierdzenie faktu z publicznego źródła, okno cofnięcia, wypłata albo zwrot według reguł. Przykładem jest *adapter źródła*: w demo to Steam i skiny CS2 (potwierdzenie, że egzemplarz jest w publicznym inventory konta). Uczciwie: kod ma dziś **jeden adapter** (Steam/CS2), a opis aktywa w programie (nazwa, float, wzór) jest dopasowany do przedmiotów CS2. Kolejny rodzaj aktywa wymaga nowego adaptera w atestatorze i uogólnienia pól opisu, ale nie zmienia reguł wypłaty ani zwrotu.

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
| Atestator | podpisać to, co widzi w publicznym źródle (w demo: inventory Steam) | ruszyć pieniędzy ani wysłać ich nikomu poza kupującym i sprzedającym tej transakcji |
| Każdy | wysłać podpisany dowód, uruchomić wypłatę albo zwrot, gdy minie termin | zmienić reguły |
| Autor (my) | raz ustawić konfigurację (atestator, token, okna czasowe) | zmienić jej później: nie ma instrukcji administratora |

Kod programu na devnecie da się jeszcze podmienić kluczem wdrożeniowym. Ostatni krok przed oddaniem projektu to zablokowanie aktualizacji (`solana program set-upgrade-authority --final`); wtedy reguł nie zmieni już nikt.

## Atestator: co robi i czym różni się od pośrednika

Program na Solanie nie ma dostępu do internetu, więc nie może sam zapytać źródła. Atestator ([`attestor/`](attestor/)) czyta **publiczne** źródło; w demo to inventory Steam (`steamcommunity.com/inventory/<steamid>/730/2`), w którym szuka egzemplarza po nazwie, floacie i wzorze i podpisuje, co zobaczył i kiedy. Nie trzyma pieniędzy i nie może ich wysłać nikomu spoza transakcji, a o wypłacie decydują reguły programu. Podpisany dowód może wysłać na łańcuch każdy, a każdą obserwację da się sprawdzić w tym samym publicznym inventory (hash dowodu jest zapisany na koncie transakcji).

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

Wymagania: Node 22+ i przeglądarka z portfelem Phantom. Oba programy są już wdrożone na devnecie (adresy niżej), więc niczego nie trzeba budować ani wdrażać.

**1. Phantom na devnecie.** Ustawienia → Developer Settings → Testnet Mode → Solana Devnet. Do opłat sieci wystarczy ok. 0,05 SOL devnetu ([faucet.solana.com](https://faucet.solana.com)). Tokeny tUSDC do płacenia daje przycisk „Odbierz 1000 testowych tUSDC” w aplikacji.

**2. Instalacja.**

```bash
git clone <adres tego repozytorium> && cd <katalog>
npm install && (cd market && npm install) && (cd will && npm install)
```

**3. Ostatnia Wola Sola** (sam frontend, bez serwera):

```bash
cd will && npm run dev        # http://localhost:5177
```

**4. ProofSwap** (frontend i atestator):

```bash
export CLUSTER=devnet RPC_URL=<adres RPC devnetu>
npm run attestor              # atestator + symulator Steama: http://localhost:8787
cd market && npm run dev      # http://localhost:5176  (?role=seller albo ?role=buyer otwiera od razu dany widok)
```

Atestator podpisuje kluczem z `keys/attestor.json`. To klucz demo tylko na devnecie i nie ma go w repozytorium (`keys/*.json` jest w `.gitignore`). Bez niego można uruchomić Ostatnią Wolę Sola oraz oglądać rynek ProofSwap; zapłata i dostawa wymagają podpisu atestatora (instancja na devnecie, którą uruchamiamy my).

**Konfiguracja (wszystko opcjonalne).** Żadna zmienna nie jest wymagana. Zalecany jest tylko własny RPC, bo publiczny RPC devnetu często odpowiada błędem 429:

```bash
cp market/.env.example market/.env.local    # i odkomentuj VITE_RPC_URL=<adres RPC, np. bezpłatny klucz Helius>
cp will/.env.example will/.env.local        # to samo dla Ostatniej Woli Sola
```

Atestator nie czyta plików `.env`, tylko zmiennych powłoki: `export RPC_URL=<adres RPC>` przed `npm run attestor` (domyślnie publiczny RPC). Pozostałe zmienne z `.env.example` (`VITE_ATTESTOR_URL`, `VITE_MARKET_SINCE`) są potrzebne tylko wtedy, gdy atestator działa pod innym adresem albo chcesz zobaczyć ogłoszenia testowe z czasu budowy (`VITE_MARKET_SINCE=0`).

### Scenariusz testowy (dwa konta Phantom, np. dwa profile Chrome)

**ProofSwap.** Okno 1: `?role=seller`, „Odbierz tUSDC”, „Wczytaj inventory”, wybierz skina, „Wystaw i potwierdź w Steam”. Okno 2: `?role=buyer`, „Odbierz tUSDC”, wybierz ogłoszenie, „Kup za…”. W oknie 1: w „Symulatorze Steam” przy skinie „Wyślij kupującemu”, potem „Sprawdź w Steam, czy skin dotarł”. Po oknie cofnięcia (w demo 1 min 30 s + 15 s) sprzedający klika „Wypłać mi”.

**Ostatnia Wola Sola.** Konto 1 („Założyciel sejfu”): „Odbierz tUSDC”, „Załóż sejf”, „Wpłać”, dodaj spadkobiercę (adres konta 2) i „Zapisz spadkobierców”. Nic nie rób przez 2 min (cisza) i 1 min (procedura). Konto 2 („Spadkobierca”): „Uruchom wypłatę”, potem „Wypłać udział”.

Test dymny całego przepływu ProofSwap (wymaga klucza wdrożeniowego): `npm run ps:check`.

Lokalnie bez devnetu: walidator Surfpool w kontenerze (`Dockerfile`), `solana program deploy target/deploy/proofswap.so ...`, potem `CLUSTER=localnet npm run ps:setup` i to samo co wyżej z `CLUSTER=localnet`.

## Adresy na devnecie

| Co | Adres |
|---|---|
| Program ProofSwap | `7kWKy3wvsLi37vZ5Cp3YvcrpvAkscHj5mXWopBG2JaZd` |
| Konfiguracja | `6EHFTtviJRkYUhb2jiSEePGa5qAYvfvnBiyZWJtqUBNM` |
| Klucz atestatora | `EhcyoHBQgb3CywfVyhVXjhW7AYgKTqqffXKFpPNVddt6` |
| Token tUSDC (z otwartym faucetem) | `Dfxy54rAvVdZD2CKnEHe4J594q7PFixe5BJMJDx1yrdH` |

## Ostatnia Wola Sola (`programs/will_vault`)

Testament bez notariusza: właściciel odkłada tUSDC do sejfu programu i wskazuje spadkobierców z procentami. Gdy przestanie się meldować, program sam dzieli saldo.

- **Osobny adres i osobna pula na każdy testament** (PDA z właściciela i numeru, sejf na tokeny ma za właściciela ten PDA). Nic nie miesza się z ProofSwap ani z pulą ubezpieczeń.
- **Czas:** cisza przez `inactivity_period` (produkcyjnie 90 dni), potem procedura `claim_period` (30 dni), potem wypłatę uruchamia `trigger_distribution` **dowolna osoba**. Okresy są w konfiguracji programu, na devnecie w demo 2 min i 1 min.
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
programs/will_vault/       program Anchor: Ostatnia Wola Sola (licznik ciszy, spadkobiercy, strażnik, wypłata na żądanie)
will/                      aplikacja React Ostatniej Woli Sola (port 5177)
scripts/will-*.ts          konfiguracja i test dymny Ostatniej Woli Sola
programs/micro_insurance/  wcześniejszy prototyp (SolaShield); ProofSwap korzysta tylko z jego otwartego faucetu tUSDC
app/, scripts/*.ts         aplikacja i skrypty wcześniejszego prototypu
```
