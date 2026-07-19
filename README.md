<p align="center">
  <b>CSSLTD Code</b><br/>
  Wewnętrzny agent AI do pracy z kodem dla inżynierów CSSLTD — terminal (TUI) + serwer HTTP.
</p>

---

## Czym jest CSSLTD Code

CSSLTD Code to firmowe narzędzie do programowania z pomocą AI: agent, który czyta i edytuje kod,
uruchamia polecenia, pracuje na gałęziach git i prowadzi całe zadania inżynierskie w terminalu.
Działa z **płatnymi API** (Anthropic, OpenAI, OpenRouter, Google, Mistral i ~30 innych dostawców)
oraz z **lokalnymi modelami przez Ollama** — bez wysyłania kodu poza firmę.

Najważniejsze zasady:

- **Zero telemetrii domyślnie.** Żadne dane nie opuszczają maszyny. Opcjonalną analitykę firmową
  włącza się dopiero przez `CSSLTD_TELEMETRY_HOST` + `CSSLTD_TELEMETRY_KEY`.
- **Brak logowania do cudzej chmury.** Firmowa brama modeli (gateway) jest opt-in przez
  `CSSLTD_API_URL` / `CSSLTD_API_KEY`; bez niej każdy inżynier używa własnych kluczy API lub Ollamy.
- **Lokalna Ollama wykrywana automatycznie.** Jeśli działa serwer Ollama
  (`http://localhost:11434`, konfigurowalne przez `CSSLTD_OLLAMA_URL` lub `OLLAMA_HOST`),
  wszystkie zainstalowane modele pojawiają się w liście modeli bez żadnej konfiguracji.

## Szybki start

Wymagania: [bun](https://bun.sh) `1.3.x`.

```bash
bun install          # instalacja zależności monorepo
bun dev              # uruchomienie TUI w bieżącym katalogu
```

Budowa binarki dystrybucyjnej:

```bash
cd packages/cssltdcode
bun run build        # artefakty w dist/
```

Po zainstalowaniu paczki dostępne są polecenia: `cssltd`, `cssltd_code`, `cssltdcode` (aliasy).

## Podpięcie modeli

### Płatne API (klucze osobiste lub firmowe)

W TUI wpisz `/connect` i wybierz dostawcę, albo ustaw zmienną środowiskową — provider włącza się
automatycznie:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export OPENROUTER_API_KEY=sk-or-...
```

### Lokalna Ollama

```bash
ollama serve                 # jeśli jeszcze nie działa
ollama pull qwen2.5-coder    # dowolny model
cssltd                       # modele widoczne od razu w /models
```

Niestandardowy adres: `export CSSLTD_OLLAMA_URL=http://192.168.1.50:11434`.

### Firmowa brama (opcjonalnie)

```bash
export CSSLTD_API_URL=https://gateway.cssltd.internal
export CSSLTD_API_KEY=...        # token wydany przez administratora
```

## Konfiguracja

- Projekt: `cssltd.json` / `cssltd.jsonc` lub katalog `.cssltdcode/` w repo.
- Globalnie: `CSSLTD_CONFIG` (ścieżka pliku), `CSSLTD_CONFIG_DIR` (katalog dodatkowy).
- Motyw: domyślny motyw `cssltd` (granat + stalowy błękit + bursztyn); zmiana w `/theme`.

## Struktura monorepo

| Pakiet | Rola |
|---|---|
| `packages/cssltdcode` | CLI/TUI — główny produkt (`@cssltdcode/cli`) |
| `packages/core` | rdzeń agenta: sesje, narzędzia, provider/katalog modeli |
| `packages/tui`, `packages/ui` | warstwa interfejsu terminalowego |
| `packages/server`, `packages/sdk` | serwer HTTP API + SDK klienckie |
| `packages/cssltd-gateway` | integracja z firmową bramą modeli (opt-in) |
| `packages/cssltd-indexing` | indeksowanie kodu / embeddingi (w tym Ollama) |
| `packages/cssltd-telemetry` | analityka — **domyślnie martwa**, opt-in |
| `packages/llm`, `packages/plugin` | adaptery modeli i system pluginów |

## Rozwój

```bash
bun turbo typecheck   # typy w całym monorepo
bun lint              # oxlint
cd packages/cssltdcode && bun run test   # testy CLI
```

---

## English summary

CSSLTD Code is CSSLTD's internal AI coding agent (terminal TUI + HTTP server). It works with paid
provider APIs (Anthropic, OpenAI, OpenRouter, and ~30 more) and with local models via Ollama, which
is auto-detected at `localhost:11434`. Telemetry is disabled by default and there is no third-party
cloud login; an optional company gateway can be enabled via `CSSLTD_API_URL`. Build with `bun
install && bun dev`; the distributable CLI lives in `packages/cssltdcode` (binaries `cssltd`,
`cssltd_code`).

## Licencja

MIT — patrz [LICENSE](LICENSE) oraz [NOTICE.md](NOTICE.md). Projekt zawiera kod wywodzący się
z otwartych projektów Kilo Code i opencode (licencja MIT); wymagane notki o prawach autorskich
zachowano w pliku LICENSE.
