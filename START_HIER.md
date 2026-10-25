# PULSE – so bekommst du die App aufs iPhone

Diese Dateien sind der komplette Quellcode. Eine fertige, installierbare App kann in der Entwicklungsumgebung hier nicht gebaut werden
(kein Zugriff auf die Paket-Server, kein Xcode). Du baust sie in wenigen Schritten selbst. Die App wurde bisher **nie gestartet** –
rechne beim ersten Start mit kleinen Fehlern, die sich meist schnell beheben lassen.

## Weg A – am schnellsten: Demo auf dem iPhone mit Expo Go (ohne Apple-Entwicklerkonto)
Du brauchst: einen Computer (Mac oder Windows) mit Node.js 22 (nodejs.org) und die kostenlose App „Expo Go“ aus dem App Store.

1. ZIP entpacken, Terminal im Ordner `pulse` öffnen.
2. `npm install`
3. `npx expo install --fix`   (setzt alle Paketversionen passend zusammen)
4. `npx expo start`
5. Mit der iPhone-Kamera den QR-Code scannen → öffnet sich in Expo Go. iPhone und Computer im selben WLAN.
6. In der App „Demo-Modus starten“. Alle Werte sind dann erfundene Beispieldaten und so gekennzeichnet.

Eingeschränkt in Expo Go: Anmeldung per Link und Fitbit-Verbindung brauchen später einen eigenen Build (Weg B).

## Weg B – eigene App auf dem iPhone (braucht Apple Developer Account, ca. 99 USD/Jahr)
1. Schritte 1–3 von Weg A.
2. `npm install -g eas-cli` und `eas login` (kostenloses Expo-Konto), dann `eas build:configure`.
3. `eas build --platform ios --profile development` (Bau in der Expo-Cloud, kein Xcode nötig) und auf dem iPhone installieren.
   Für den App Store: `eas build --platform ios --profile production` und `eas submit --platform ios`.

## Weg C – Android
1. Schritte 1–3 von Weg A.
2. Für die Demo: QR-Code mit der „Expo Go“-App aus dem Play Store scannen (Android-Gerät und Computer im selben WLAN).
3. Für einen eigenen Build: `npm install -g eas-cli`, `eas login`, `eas build:configure`, dann
   `eas build --platform android --profile development` (keine Android-Studio-Einrichtung nötig, Bau in der Expo-Cloud).
   Für den Play Store: `eas build --platform android --profile production` und `eas submit --platform android`.

## Live-Modus (Fitbit Air, KI-Coach, Foto-Erkennung) – später
Dafür brauchst du eigene Zugänge: Supabase-Projekt, Google-Cloud-OAuth-Client (Google Health API), Anthropic-API-Key.
Anleitung: `README.md` und `docs/GOOGLE_HEALTH_SETUP.md`. Kopiere `.env.example` nach `.env` und trage nur die öffentlichen Werte ein;
Geheimnisse gehören ausschließlich in die Supabase-Secrets, nie in die App.

## Wenn etwas nicht startet
`npm test` prüft die Rechenlogik (159 Tests, braucht kein `npm install`). Schick mir die Fehlermeldung aus dem Terminal, dann behebe ich sie.
