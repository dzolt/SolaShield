# 🛡️ SolaShield: ochrona wypłaty w SOL (Solana, Anchor)

**Dla kogo:** freelancerzy i contributorzy DAO, którzy dostają wynagrodzenie w SOL, ale koszty mają w USD/PLN.
**Co robi:** kupujesz ochronę do dnia wypłaty. Jeśli kurs SOL/USD spadnie o wybrany procent, **program sam wypłaca** ustaloną kwotę w tUSDC. Nie ma ubezpieczyciela, likwidatora szkód ani zgody administratora.
**Kto był pośrednikiem:** ubezpieczyciel albo broker instrumentów pochodnych (trzyma kapitał, ocenia, decyduje o wypłacie). Jego rolę przejmuje program on-chain.

W repo: program Anchor (`programs/`), skrypty (`scripts/`) i aplikacja webowa z portfelem Phantom (`app/`).

## Gdzie znika pośrednik (kod)

Cała logika jest w [`programs/micro_insurance/src/`](programs/micro_insurance/src/):

| Co | Gdzie |
|---|---|
| Kapitał leży na koncie tokenów, którym rządzi tylko program (PDA), żaden klucz go nie ruszy | `instructions/initialize_pool.rs` (konto `vault`), `token_utils.rs` (jedyne miejsce wypłat) |
| Cena referencyjna jest czytana z Pytha **przez program** przy zakupie, a próg liczy ze wzoru (kupujący go nie wybiera) | `instructions/buy_policy.rs`, `math.rs` (`strike_for`) |
| Wypłata zależy wyłącznie od ceny Pytha po terminie, rozliczyć może **każdy**, pieniądze idą zawsze do właściciela ochrony | `instructions/settle_price.rs` |
| Pula nie sprzeda ochrony bez pokrycia, jedna ochrona to najwyżej 20% puli, dawca nie wypłaci kapitału, który zabezpiecza aktywne ochrony | `instructions/buy_policy.rs`, `instructions/withdraw.rs` |
| **Blokada wpłaty dawcy:** po każdej wpłacie program odrzuca wypłatę przez czas ustalony przy tworzeniu puli (na devnecie 10 minut), więc dawca nie wycofa kapitału tuż przed rozliczeniem. Każda kolejna wpłata odnawia blokadę całej pozycji | `instructions/deposit.rs` (`unlock_at`), `instructions/withdraw.rs` |
| Gdy nikt nie rozliczy: po 7 dniach każdy może unieważnić ochronę i zwrócić składkę | `instructions/void_policy.rs` |

**Kto ma jakie uprawnienia:** admin może tylko dodawać nowe produkty (`add_product`); nie ruszy środków ani istniejących ochron, a produktu nie da się później zmienić. Program da się zaktualizować, dopóki autor nie zablokuje tego (`solana program set-upgrade-authority --final`): do zrobienia przed pokazem.

## Uczciwie o ograniczeniach

- **Cenę dostarcza Pyth.** To rozproszona sieć publikatorów, nie my i nie strona umowy, ale nadal zewnętrzne źródło prawdy.
- **Okno rozliczenia (10 min):** liczy się pierwsza cena z 10 minut po końcu ochrony, więc obie strony mogą wybrać moment wywołania w tym oknie, a kto nie zdąży, traci możliwość wypłaty (szczegóły i plan naprawy niżej).
- **Składka to stały procent wypłaty**, a nie wycena opcji. W krachu SOL wszystkie ochrony płacą naraz, więc dawcy mogą stracić (łagodzi to limit 20% na ochronę i reguła rezerw).
- **Blokada dawcy liczy się od wpłaty, nie od zakupu ochrony.** Dawca, który wpłacił dawno temu, może w każdej chwili wyjąć kapitał, który nie jest zarezerwowany, więc blokada utrudnia „ucieczkę tuż po wpłacie”, ale nie wszystkie jej formy. Na produkcji blokada powinna być dłuższa niż najdłuższa ochrona (tu 10 minut tylko na potrzeby demo). Długość ustala się raz, przy tworzeniu puli.
- **Token tUSDC** to testowy token z otwartym faucetem (devnet), nie prawdziwy USDC.
- **Demo na devnecie** nie wymusi spadku ceny o 15%. Pokazujemy mechanizm przez „spadek” i „wzrost” z progiem 0% kupione naraz: jedna z nich się wypłaci.
- Program nie był audytowany.

## Okno rozliczenia: dlaczego 10 minut i co po nim

**Jak działa dziś.** Konto ceny Pytha na Solanie przechowuje tylko najnowszy odczyt i jest nadpisywane co ok. 20 s, więc program widzi cenę „z ostatnich sekund”, a nie z dokładnej chwili końca ochrony. Dlatego rozliczenie przyjmuje cenę opublikowaną w oknie `[koniec, koniec + 10 min]` (stała `OBSERVATION_WINDOW` w `constants.rs`). Pierwsze udane wywołanie zamyka ochronę.

**Dlaczego akurat 10 minut.** To kompromis, który wybrałem ręcznie, nie wartość wyliczona z danych. Okno musi być dość długie, żeby ktoś zdążył je zauważyć i rozliczyć (kilka odświeżeń feedu, czas na podpis w portfelu), a dość krótkie, żeby ograniczyć możliwość wybierania momentu. Można je zmienić jedną stałą.

**Co jeśli nikt nie rozliczy w ciągu 10 minut.**
- Rozliczenie nie jest już możliwe: żadna cena, którą da się podać, nie spełnia warunku okna.
- Ochrona zostaje „Aktywna”, składka i zarezerwowany kapitał pozostają zablokowane w puli.
- Po **7 dniach od końca** każdy może wywołać `void_policy`: właściciel dostaje z powrotem **składkę**, rezerwa się zwalnia.
- Konsekwencja: **nawet jeśli cena spełniała warunek, właściciel, który nie zdążył, nie dostaje wypłaty, tylko zwrot składki**, a kapitał dawców jest zamrożony na 7 dni. To realna wada obecnego prototypu. Łagodzi ją bot rozliczający zaraz po końcu (`npm run keeper`, `scripts/keeper.ts`) i komunikat w aplikacji o minionym oknie. Bot nie ma żadnych specjalnych uprawnień: to kolejny wywołujący, który płaci opłatę, a wynik i adresata wypłaty nadal wyznacza program; gdyby przestał działać, rozliczyć może ktokolwiek inny.

**Plan naprawy (gdyby był tydzień): cena z dokładnej chwili końca.** Wtedy okno przestaje być potrzebne, bo rozliczyć można w dowolnym momencie po końcu, a wynik jest ten sam. Krok po kroku:
1. Bot pobiera z Pytha cenę z konkretnego znacznika czasu i publikuje ją na łańcuchu przez program odbiorczy Pytha. Program już dziś przyjmuje każde w pełni zweryfikowane konto ceny tego programu.
2. Program dopisuje regułę „poprzednia publikacja była przed końcem ochrony, ta po końcu” (pole `prev_publish_time` ceny), która wskazuje dokładnie jedną cenę.
3. Ograniczenie: pobieranie cen historycznych wymaga klucza API Pytha. Plan darmowy nie daje dostępu do API, a plany z API zaczynają się od 500 USD/mc (okres próbny jest, ale nie znalazłem jego długości). Klucza nie wolno trzymać we froncie, więc potrzebny jest mały backend, który tylko pobiera i publikuje cenę (podpisy sprawdza program, backend o niczym nie decyduje).
4. Nie sprawdzałem tego w działającym kodzie: to plan, nie coś zrobionego.

## Uruchomienie lokalne (bez internetu i bez prawdziwych SOL)

Wymagania: Docker, Node 22+. Kontener z Anchorem, Solaną i Surfpoolem jest w `Dockerfile` (na Macu z Apple Silicon działa przez emulację amd64, więc pierwszy build jest wolny). Wszystkie komendy uruchamiasz z głównego katalogu repo.

```bash
docker build --platform linux/amd64 --target toolchain -t micro-insurance-dev .
docker run --rm -it -v "$PWD":/workspaces/micro-insurance -w /workspaces/micro-insurance -p 8899:8899 micro-insurance-dev
# w kontenerze: anchor build, potem walidator i wdrożenie (komendy niżej)

npm install
CLUSTER=localnet npm run setup      # mint tUSDC, pula, produkty; kopiuje IDL do aplikacji
npm run feed:local                  # lokalny odpowiednik feedu Pytha (cenę zmienisz: echo 130 > keys/local-price.txt)
CLUSTER=localnet npm run check      # test dymny: zakup trzech ochron i rozliczenie
CLUSTER=localnet npm run keeper     # opcjonalny bot: sam rozlicza ochrony po terminie (z KEEPER=1 w `check` nikt nie klika)
cd app && npm install && npm run dev   # aplikacja: http://localhost:5175
```

Uruchomienie walidatora (w kontenerze, port 8899) i wdrożenie programu:

```bash
surfpool start --offline --host 0.0.0.0 --no-tui --no-studio --no-deploy -y \
  --airdrop <adres_deployera> -q 100000000000
solana program deploy target/deploy/micro_insurance.so \
  --program-id target/deploy/micro_insurance-keypair.json --keypair keys/deployer.json --url http://127.0.0.1:8899
```

**Własny portfel (Phantom) na lokalnej sieci:** Ustawienia → Developer Settings → włącz Testnet Mode → wybierz Solana Localnet. Zasil adres: `curl localhost:8899 -X POST -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"requestAirdrop","params":["<twój adres>",1000000000]}'`.

## Devnet (wymóg zadania)

1. Zasil deployera (adres w `keys/deployer.json`, klucz **nie** idzie do repo) przez https://faucet.solana.com (potrzeba ok. 5 SOL na wdrożenie programu).
2. `solana program deploy ... --url devnet`, potem `CLUSTER=devnet npm run setup` i `CLUSTER=devnet npm run check`.
3. Publiczny RPC devnetu ogranicza zapytania: do pokazu ustaw własny klucz, np. `VITE_RPC_URL=<adres RPC>` dla aplikacji (w `app/.env.local`, plik nie trafia do repo) i `RPC_URL=<adres RPC>` dla skryptów.
4. Cena SOL/USD pochodzi z kont Pytha zasilanych na devnecie (odczyt on-chain nie wymaga klucza API).

## Adresy na devnecie

| Co | Adres |
|---|---|
| Program | `GHrWtBXvB126xq3JTaZkpziobURgi7XA29JisS1Ra18R` |
| Pula | `HXwQAHfGffPSeN6dC9gmBPDdCYty5Q4H4ZbQAUZcr285` |
| Token tUSDC | `Dfxy54rAvVdZD2CKnEHe4J594q7PFixe5BJMJDx1yrdH` |

Aktualne adresy zawsze są w `deployment.<klaster>.json` i w karcie „Wspólna pula” w aplikacji. Adres puli jest liczony z adresu tokena, więc nowy token oznacza nową pulę.

## Struktura

```
programs/micro_insurance/   program Anchor (Rust): pula, produkty, polisy, rozliczenie z Pytha, zwrot po terminie, faucet
scripts/setup.ts            mint tUSDC, pula, produkty; zapisuje deployment.<klaster>.json i kopiuje IDL do aplikacji
scripts/check.ts            test dymny na żywej sieci (faucet, wpłata, zakup, rozliczenie, saldo)
scripts/keeper.ts           opcjonalny bot rozliczający ochrony po terminie (bez uprawnień)
scripts/local-feed.ts       lokalny odpowiednik konta cen Pytha (tylko do testów offline)
scripts/lib/                wspólne klocki (klucze, odczyt konta cen Pytha), używane też przez aplikację
app/                        aplikacja React + Wallet Adapter (Vite), portfel Phantom
keys/                       klucze testowe (ignorowane przez git)
Dockerfile, .devcontainer/  środowisko z Anchorem, Solaną i Surfpoolem
```
