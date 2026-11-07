# security — fragmenty stacku Expo

Reguły klienta natywnego do `SKILL.md`. Czytasz je przy kodzie aplikacji, deep linkach, logowaniu i przy audycie.

## Model zagrożeń

- Paczka aplikacji jest publiczna i da się ją zdekompilować, urządzenie może mieć root albo jailbreak, a deep link może wysłać każda inna aplikacja. Dlatego klucz z paczki nie jest barierą: chroni RLS i kontrola w Edge Function.

## Punkty wejścia

- Dane z deep linku (Expo Router, `expo-linking`), skanu QR, `data` powiadomienia push i pickera plików (typ, rozmiar, nazwa) to wejście z zewnątrz: parsujesz je schematem Zod. Parametr deep linku bez walidacji to finding.

## Przechowywanie na urządzeniu

- Sesja Supabase: domyślnie `expo-sqlite/localStorage/install` (D9). `LargeSecureStore` to opcja dla aplikacji z danymi wrażliwymi, a wybór i powód zapisujesz w planie zadania.
- Token sesji w AsyncStorage albo `expo-sqlite` to MEDIUM przy danych wrażliwych, nie CRITICAL: to domyślny wariant Supabase, a ryzyko dotyczy urządzenia z rootem i kopii zapasowej. W aplikacji bez danych wrażliwych nie zgłaszasz go jako błędu.
- Inne sekrety trzymasz w `expo-secure-store` (Keychain, Keystore). AsyncStorage to zwykły tekst.

## Deep linki i OAuth

- Logowanie przez przeglądarkę idzie przez PKCE. Universal Links i App Links mają pierwszeństwo przed własnym schematem, bo schemat może przejąć inna aplikacja.
- Redirect URLs w Supabase wypisujesz jawnie ze schematem, bez wildcard.
- Trasa za logowaniem ma guard w layoucie grupy, bo deep link omija ekrany po drodze.

## WebView i treści z danych

- `WebView` ma listę dozwolonych URL, walidujesz `onMessage`, a `injectedJavaScript` z danymi użytkownika to odpowiednik XSS.
- DOMPurify nie działa w RN: bez `window.document` jego `sanitize` nie istnieje, więc wywołanie rzuca `TypeError`. HTML sanitujesz po stronie serwera albo go nie renderujesz.
- URL z danych przed `Linking.openURL` i `Image source` przechodzi przez `new URL()` i listę protokołów (`https:`, `http:`, `mailto:`).

## Biometria i ekrany wrażliwe

- `expo-local-authentication` to lokalna bramka interfejsu, nie autoryzacja: uprawnienia sprawdza serwer na podstawie tokenu.
- Blokada zrzutów i maskowanie w przełączniku aplikacji na ekranach wrażliwych: LOW.

## Sekrety w paczce

- `EXPO_PUBLIC_*` jest w paczce jawnym tekstem: wolno tam publishable key i jawne URL-e. Klucze płatnych API idą za Edge Function. Klucz sekretny albo `service_role` w paczce to CRITICAL.
- `console.log` z sesją albo danymi osobowymi widać w logcat i Console.app.

## Konfiguracja platformy

- Bez wyjątków cleartext i ATS: `expo-build-properties` (`android.usesCleartextTraffic`, `ios.infoPlist.NSAppTransportSecurity`) ustawiasz tylko z powodem w planie. Android blokuje cleartext domyślnie.
- CSP, `X-Frame-Options` i HSTS nie dotyczą klienta natywnego; dotyczą strony web projektu, jeśli ją ma.

## EAS Update

- OTA omija review sklepu, więc kontrolujesz dostęp do kanałów. Code signing update'ów jest dostępny tylko w planach EAS Production i Enterprise: sprawdź plan, zanim go zaplanujesz.

## PII w Sentry

- `sendDefaultPii: false` w `@sentry/react-native`: przełącznik `dataCollection` dotyczy JS SDK. Szczegóły: skill sentry-integration.

## Ramy audytu

- OWASP Mobile Top 10 2024 dla aplikacji, MASVS 2.1 i MASTG 2.0 jako lista kontrolna, OWASP Top 10:2025 tylko dla backendu.
- Przykłady klasyfikacji. CRITICAL: `service_role` w paczce. HIGH: parametry deep linku bez walidacji, OAuth bez PKCE na własnym schemacie, `injectedJavaScript` z danymi. MEDIUM: płatny klucz w `EXPO_PUBLIC_*`, dane osobowe w `console.log`. LOW: maskowanie przełącznika aplikacji, certificate pinning.
