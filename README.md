# PULSE

Premium-Health-, Fitness- und Longevity-App (iOS & Android, Expo / React Native + TypeScript) mit Supabase-Backend und Anbindung an das **Fitbit Air** über die **Google Health API**.

> **Wellness-App, keine Medizinprodukt-Software.** Keine Diagnosen, keine Therapieempfehlungen. Die App ist nicht rechtlich geprüft und nicht „DSGVO-zertifiziert“ – vor einem Produktivbetrieb sind eine rechtliche Prüfung und eine Datenschutz-Folgenabschätzung nötig.

## Ehrlicher Status

| Bereich | Stand |
|---|---|
| Berechnungen (Recovery, Schlaf, Belastung, Vitalität, Ernährung, Bioverfügbarkeit, Coach-Regeln) | implementiert, **159 automatisierte Tests laufen grün** (`npm test`) |
| Aktivitätskatalog (MET-Kalorienschätzung) und Science-based Lifting mit 80+ Übungen und Muskelfigur (Wochenvolumen, e1RM, Progression, Deload-Hinweis) | Logik implementiert und getestet; Screen `app/lifting.tsx` **nie gestartet**. Daten nur lokal auf dem Gerät. Richtwerte siehe `docs/LIFTING.md` |
| Google-Health-Client, OAuth, Token-Verschlüsselung, Mapper, Sync | implementiert und gegen simulierte API-Antworten getestet. **Nicht gegen ein echtes Konto getestet** |
| Edge Functions (OAuth, Sync, Foto-Analyse, Coach, Export, Löschung) | geschrieben, **nicht deployt und nicht ausgeführt** |
| Datenbank-Migration mit Row-Level Security | geschrieben, **nicht gegen eine echte Postgres-Instanz ausgeführt** |
| Expo-App (alle Screens) | geschrieben; Logik per Typecheck gegen Platzhalter-Typen geprüft. **Noch nie gebaut oder gestartet**, UI nicht auf einem Gerät gesehen |
| Foto-Erkennung | Server-Funktion + Auswertung implementiert/getestet; **Modellaufruf nie ausgeführt** |
| Webhooks | Endpunkt prüft nur den Authorization-Header und quittiert; **Signaturprüfung und Verarbeitung fehlen**, weil Nachrichtenformat und Schlüsselbezug in der Doku nicht belegt sind |

Die Entwicklungsumgebung hatte keinen Zugriff auf die npm-Registry. Deshalb wurden Abhängigkeiten nie installiert.

## Schnellstart (Demo-Modus – ohne Backend)

```bash
npm install
npx expo install --fix      # richtet alle Paketversionen auf das passende Expo-SDK aus
npx expo start --ios        # iOS-Simulator; auf dem iPhone: Expo Go oder Development Build
# Android: npx expo start --android (Emulator) bzw. QR-Code mit dem Expo-Go-App scannen
```
In der App „Demo-Modus starten“. Alle Werte sind dann **erfundene Beispieldaten** und überall als „Demo“ markiert. Foto-Erkennung, KI-Coach und Fitbit-Verbindung sind im Demo-Modus bewusst nicht simuliert.

Die in `package.json` auf `latest` gesetzten Versionen sind Platzhalter: `expo install --fix` ersetzt sie durch kompatible. Danach `npm run typecheck`. Rechne mit kleinen Anpassungen an API-Änderungen (z. B. `expo-image-manipulator`, `expo-router`).

## Tests

```bash
npm test          # Node ≥ 22, kein Paket nötig
```
Abgedeckt: Basiswerte, Schlaf, Recovery, Belastung, Vitalität, gesperrter Altersindikator, Demo-Daten, Lebensmitteldatenbank, Rating, Bioverfügbarkeit, Perspektiven, Bildanalyse-Auswertung, Tipps, Coach, Google-Health-Client (Seiten, Retry/Backoff, 401-Erneuerung), Mapper (Einheiten, Zeiträume, fehlende Felder), Sync-Zustände, Krypto, OAuth-State, Konsistenz App↔Server.
Nicht abgedeckt: UI-Rendering, echte Netzwerk-/Datenbankzugriffe, Edge Functions als Ganzes.

## Einrichtung des Backends (für Live-Modus)

1. **Supabase-Projekt** anlegen; `supabase link` und `supabase db push` (führt `supabase/migrations/0001_init.sql` aus).
2. **Google-Cloud-Projekt**: Google Health API aktivieren, OAuth-Zustimmungsbildschirm konfigurieren, OAuth-Client „Web“ erstellen (Redirect-URI = `https://<projekt>.functions.supabase.co/google-health-oauth-callback`). Details und Checkliste: [`docs/GOOGLE_HEALTH_SETUP.md`](docs/GOOGLE_HEALTH_SETUP.md).
3. **Secrets setzen** (siehe `.env.example`): `supabase secrets set --env-file ./.env.server`. Schlüssel erzeugen mit `openssl rand -base64 32`.
4. **Functions deployen**: `supabase functions deploy` (Callback und Webhook laufen ohne JWT, siehe `supabase/config.toml`).
5. App-Variablen in `.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
6. Optional KI: `ANTHROPIC_API_KEY` (+ `FOOD_MODEL`, `COACH_MODEL`) als Secret. Ohne Schlüssel: Coach regelbasiert, Fotos nicht analysierbar (manuelle Eingabe bleibt).

Geheimnisse (`GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY` …) liegen **nur** als Edge-Function-Secrets. Nur der öffentliche `anon`-Key steckt im App-Bundle; Schutz bieten Row-Level Security und signierte Sitzungen. Tokens zu Google werden AES-256-GCM-verschlüsselt gespeichert, die Tabelle `wearable_secrets` hat keine Client-Policy.

## Build & Deployment (iOS & Android)

iOS: `eas build --platform ios` (Apple-Developer-Konto nötig), danach TestFlight.
Android: `eas build --platform android` (Play-Store-Veröffentlichung zusätzlich `eas submit --platform android`; EAS-Projekt mit `eas init` einrichten).
Bundle-/Package-ID in `app.json` anpassen (`app.pulse.mobile`). Kamera-/Fotozugriffstexte stehen bereits in `app.json` (iOS `infoPlist`, Android `permissions`). Für den Store: Datenschutzerklärung, „App Privacy“-Angaben (Gesundheitsdaten), ggf. Anforderungen von Google an die App-Verifizierung für Health-Scopes.

## Architektur

```
app/                 Expo-Router-Screens (Tabs: Home · Recovery · Schlaf · Belastung · Vitalität; dazu Ernährung, Coach, Training, Wohlbefinden, Datenquellen, Einstellungen)
src/core/            reine Berechnungen (keine Abhängigkeiten, getestet) – Formeln siehe docs/METHODS.md
src/components/      Designsystem-Bausteine, Diagramme (react-native-svg)
src/state/           App-Zustand (lokal persistiert) + Live-Daten
src/data/            Demo-Daten (deterministisch) und Live-Loader
supabase/migrations  Schema + RLS
supabase/functions/  Edge Functions + _shared (API-Client, Mapper, Sync, Krypto)
```
Austauschbarer Datenadapter: Die App liest ausschließlich normalisierte Tabellen (`daily_metrics`, `sleep_sessions`, `workouts`). Ein weiterer Anbieter braucht nur einen eigenen Mapper/Sync nach dem Muster in `supabase/functions/_shared/`.

## Bekannte Grenzen

- **Mahlzeiten, Check-ins, Gewohnheiten, manuelle Trainings** liegen aktuell **nur lokal** auf dem Gerät (nicht im Server-Schema synchronisiert, obwohl `meals`/`meal_items` in der Migration vorbereitet sind).
- **Mace Woodville**: Zu seiner Ernährungsweise ließen sich keine verlässlichen Quellen finden. Die Perspektive „Mace Woodville / eigene Regeln“ enthält deshalb nur Regeln, die die Nutzerin bzw. der Nutzer selbst festlegt.
- **Physiologischer Altersindikator** bleibt „nicht verfügbar“, solange kein wissenschaftlich validiertes Modell eingebunden ist (Absicht).
- Antwortschemata einiger Google-Health-Datentypen (Atemfrequenz, SpO₂ täglich, Hauttemperatur, VO₂max, aktive Minuten, Schlafphasen) sind in der gelesenen Doku nicht beschrieben. Der Mapper probiert Kandidatenfelder und **meldet Warnungen statt Werte zu erfinden**; beim ersten Test mit echtem Konto sind Anpassungen wahrscheinlich.
- Die Fitbit-Web-API wird laut Google am 30.10.2026 abgeschaltet; diese App nutzt ausschließlich die Google Health API.
