# Google Health API – Einrichtung und Verifikationsstatus

Stand der Dokumentationsrecherche: 24.10.2026. Quellen: developers.google.com/health (Übersicht, Scopes, Rate-Limits, Datentypen, Gerätekompatibilität, Referenz `users.dataTypes.dataPoints`, `projects.subscribers`).

## Checkliste
- [ ] Google-Cloud-Projekt anlegen, **Google Health API** aktivieren
- [ ] OAuth-Zustimmungsbildschirm konfigurieren (App-Name, Datenschutzerklärung, Testnutzer)
- [ ] Scopes eintragen (nur lesend): `…/auth/googlehealth.sleep.readonly`, `…activity_and_fitness.readonly`, `…health_metrics_and_measurements.readonly`
- [ ] OAuth-Client (Typ „Webanwendung“) erstellen, Redirect-URI: `https://<projekt>.functions.supabase.co/google-health-oauth-callback`
- [ ] Client-ID/-Secret als Supabase-Secrets setzen
- [ ] App-Verifizierung bei Google prüfen (Doku verweist auf eine eigene „App verification“-Seite; Anforderungen nicht eingesehen)
- [ ] Mit einem **echten Fitbit-Air-Konto** testen und die Mapper-Warnungen auswerten
- [ ] Optional: Subscriber/Webhook anlegen (`projects.subscribers.create`, HTTPS-Endpunkt, `endpointAuthorization.secret`)

## Belegt (Doku)
Basis `https://health.googleapis.com/v4`; `GET /v4/users/me/dataTypes/{type}/dataPoints` mit `pageSize` (Standard 1440, max. 10000; sleep/exercise 25), `pageToken`, `filter` (AIP-160, z. B. `steps.interval.civil_start_time >= "…"`, `sleep.interval.civil_end_time`, `dailyHeartRateVariability.date`); Antwort `{dataPoints, nextPageToken}`. Rate-Limit 300 Anfragen/Minute/Nutzer, HTTP 429. Fitbit Air (`air`) unterstützt 23 Datentypen (siehe `supabase/functions/_shared/catalog.ts`). Fitbit Web API: Support-Ende 30.09.2026, Abschaltung 30.10.2026.

## Nicht belegt – deshalb defensiv umgesetzt
- Feldnamen von `dailyRespiratoryRate`, `dailyOxygenSaturation`, `dailySleepTemperatureDerivations`, `dailyVo2Max`, `activeMinutes`, `activeZoneMinutes`, `sleep.stages/summary`, Exercise-Metriken.
- Filter-Schreibweise mehrwortiger Typen (snake_case vs. camelCase): der Client probiert bei HTTP 400 die zweite Variante.
- `Retry-After` bei 429; Backoff ist exponentiell mit Jitter, `Retry-After` wird beachtet, falls vorhanden.
- Webhook-Nachrichtenformat und Bezug des öffentlichen Schlüssels für die ECDSA-Signatur (`GOOGLE-HEALTH-API-SIGNATURE`). Der Endpunkt verarbeitet deshalb **nichts** und quittiert nur. Bis dahin: manueller/geplanter Sync (z. B. per Supabase-Cron `google-health-sync`).
- Ob und wie Zeitzonen in `civilStartTime` geliefert werden (Zeitzuordnung der Tage hängt daran; Fallback auf UTC erzeugt eine Warnung).

## Erwartetes Verhalten
Verweigerte Berechtigungen (Teil-/Nullzustimmung) führen nicht zum Absturz: betroffene Datentypen zeigen „Berechtigung fehlt“. Nicht vom Gerät unterstützte Typen zeigen „nicht unterstützt“, leere Zeiträume „keine Daten“. Bei `invalid_grant` wird die Verbindung auf „Erneute Anmeldung nötig“ gesetzt.
