#!/usr/bin/env python3
"""Co robi każdy hook konta — z przeczytania skryptów i hooks.json pluginów (2026-09-28). Klucz: etykieta z etykieta_hooka()
(hooki z ~/.claude/settings.json) albo id pluginu (hooki pluginów). Brak klucza = opis pusty; po zmianie skryptu zaktualizuj opis."""

HOOKI_OPIS = {
    'hook_handler.py': 'Odtwarza dźwięk macOS: Notification = Ping (Claude czeka na Ciebie), Stop = Hero (koniec odpowiedzi), SubagentStop = '
                       'Submarine (koniec subagenta), PostToolUse = Pop tylko po TodoWrite. Nic nie dokłada do kontekstu.',
    'error-handling-reminder.sh': 'Na koniec każdej odpowiedzi przegląda zmienione pliki .ts/.tsx repo: console.* w src/ → każe użyć Sentry; '
                                  'w supabase/functions wymaga captureError + flush. Blokujący (exit 2) — Claude musi zareagować. Pochodzi '
                                  'z szablonu, a działa w każdym projekcie z gitem.',
    'skill-activation-prompt.sh': 'Przy każdym Twoim prompcie czyta .claude/skills/skill-rules.json projektu i dopisuje do kontekstu „RECOMMENDED '
                                  'SKILLS”. Plik reguł ma 10 starszych projektów (akademia-automatyzacji-dashboard, kurs_cc_demo, kurs_cc_aa, miter, '
                                  'piszemy_wirale, live-02-04, live-02-04-demo, live-02-04-YT, n8n-worker, lp-fb-group-project); w pozostałych nic nie robi.',
    'jq → bash-command-log.txt': 'Dopisuje KAŻDĄ komendę Bash (z opisem) do ~/.claude/bash-command-log.txt — dziś 77 MB, bez limitu; '
                                 'w komendach bywają tokeny i hasła.',
    'aibiz@aibiz': 'SessionStart: kopiuje kontekst firmowy AIBIZ do .claude/rules (tylko w vaultach Obsidian) i sygnalizuje czekające propozycje '
                   '/reflect. UserPromptSubmit: uruchamia Pulsa (claude-cron), jeśli jest zainstalowany. PreToolUse Skill + UserPromptExpansion: '
                   'blokuje skill aibiz, któremu brakuje klucza API.',
    'hookify@claude-plugins-official': 'Cztery hooki sprawdzają reguły z plików hookify w .claude/ projektu; takich plików nie masz, więc nic nie '
                                       'robią, ale startują Pythona przy każdym narzędziu (licznik 358 tys. odpaleń).',
    'posthog@claude-plugins-official': 'SessionEnd: wysyła przebieg sesji do PostHog LLM Analytics — tylko przy POSTHOG_LLMA_CC_ENABLED=true (nie masz, '
                                       'więc nic nie wysyła). PreToolUse: pyta o zgodę przed zapisami przez MCP posthog.',
    'security-guidance@claude-plugins-official': 'Przy każdej edycji pliku regexy na sekrety, SQL/command injection itp.; na koniec odpowiedzi dwie '
                                                 'analizy Haiku zmian w gicie (dodatkowe wywołania modelu) i wymusza reakcję (exit 2).',
    'strona-przez-rozmowe@synced': 'md-guard: blokuje każdą komendę Bash, która wygląda na zapis pliku Markdown — także fałszywie (w tej sesji '
                                   'zablokował dwa odczyty). W aplikacji desktop działa jako strona-przez-rozmowe@inline.',
}
