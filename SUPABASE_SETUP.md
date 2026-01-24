# Supabase Setup Anleitung

## 1. SQL Schema in Supabase ausführen

1. Gehe zu deiner Supabase Console: https://app.supabase.com/project/rfqsatohxdjmycfbaqff
2. Klicke auf **SQL Editor** in der linken Navigation
3. Öffne die Datei `supabase-schema.sql`
4. Kopiere den gesamten SQL-Code
5. Füge ihn in den SQL Editor ein
6. Klicke auf **Run** (oder drücke Ctrl+Enter)

Das erstellt:
- `user_settings` Tabelle für HA-Konfigurationen
- Row Level Security Policies (Benutzer sehen nur ihre eigenen Daten)
- Automatische `updated_at` Timestamps

## 2. Email-Bestätigung deaktivieren (Optional für Entwicklung)

Für einfacheres Testing kannst du die Email-Bestätigung deaktivieren:

1. Gehe zu **Authentication** → **Email Templates**
2. Deaktiviere "Confirm email"

**ODER** in der Produktion lassen und Email-Templates anpassen.

## 3. App testen

1. Starte die App: `npm run dev`
2. Öffne http://localhost:5173
3. Registriere einen neuen Benutzer
4. Login sollte automatisch erfolgen
5. Gehe zu Settings und speichere deine HA-Konfiguration

## Umgebungsvariablen

Die `.env` Datei ist bereits konfiguriert mit:
```
VITE_SUPABASE_URL=https://rfqsatohxdjmycfbaqff.supabase.co
VITE_SUPABASE_ANON_KEY=<dein_key>
```

## Vorteile von Supabase

✅ Keine Backend-Wartung nötig
✅ Automatische JWT-Authentifizierung  
✅ PostgreSQL-Datenbank
✅ Row Level Security für Multi-Tenant-Isolation
✅ Real-time Subscriptions (für spätere Features)
✅ Automatische API-Generierung

## Nächste Schritte

Nach dem SQL-Schema-Setup ist die App einsatzbereit!
- Benutzer können sich registrieren/anmelden
- Jeder Benutzer hat seine eigene HA-Konfiguration
- Daten bleiben persistent in Supabase
- Automatische Sicherheit durch RLS
