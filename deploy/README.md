# Wdrożenie na VPS (Docker, jeden izolowany stos)

`deploy/ship.sh` buduje obie aplikacje lokalnie (`market`, `will`), wysyła je razem z atestatorem na VPS i uruchamia jako osobny projekt Docker Compose `proofswap-demo`.

```bash
deploy/ship.sh up      # build, wysyłka, start (powtarzalne: po zmianie kodu lub nowym deploymencie programu)
deploy/ship.sh urls    # publiczne adresy (Cloudflare Tunnel)
deploy/ship.sh logs    # logi tylko tego stosu
deploy/ship.sh down    # zatrzymuje i usuwa kontenery, obraz, wolumen i katalog ~/proofswap-demo
```

Serwer: `DEPLOY_HOST` (domyślnie `ubuntu@1.....`), wymaga klucza SSH i `sudo` bez hasła.

## Co działa na serwerze

| Kontener                       | Rola                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `web` (nginx)                  | statyczne pliki obu aplikacji, `/api` do atestatora, `/rpc` do dostawcy RPC (z limitami zapytań) |
| `attestor`                     | atestator i symulator Steama, klucz atestatora tylko jako plik tylko do odczytu                  |
| `tunnel-market`, `tunnel-will` | Cloudflare Tunnel: publiczny adres https dla każdej aplikacji                                    |

- **Żaden port hosta nie jest publikowany** i stos nie ma nic wspólnego z innymi projektami na tym serwerze (osobna sieć, osobne limity pamięci i CPU).
- **Klucz dostawcy RPC** (`VITE_RPC_URL` z `market/.env.local`) trafia tylko do `.env` na serwerze. Paczki dla przeglądarki dostają `/rpc`, a `ship.sh` odmawia wysyłki, jeśli znajdzie w nich klucz.
- **Na serwer nie jedzie klucz deployera**, tylko `keys/attestor.json`.
- Adresy `*.trycloudflare.com` są losowe i **zmieniają się po restarcie kontenerów tuneli**. Stały adres wymaga własnej domeny na Cloudflare i nazwanego tunelu.
- Po zmianie adresów programu (nowy deployment) uruchom `deploy/ship.sh up` ponownie, bo aplikacje i atestator mają adresy wbudowane z `src/generated/`.
- Symulator Steama jest wspólny dla wszystkich odwiedzających (jeden stan na serwerze), a `/api/sim/reset` może wywołać każdy.
