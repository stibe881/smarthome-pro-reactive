# Home Assistant Konfiguration für Push-Nachrichten

Damit deine Automationen funktionieren, musst du den `rest_command` in deiner `configuration.yaml` definieren.
Das ist die Brücke zwischen deinen Automationen und der Supabase Edge Function.

**Füge folgenden Block zu deiner `configuration.yaml` hinzu:**

```yaml
rest_command:
  send_push_notification:
    url: "https://rfqsatohxdjmycfbaqff.supabase.co/functions/v1/send-push"
    method: POST
    verify_ssl: true
    headers:
      Content-Type: "application/json"
      Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcXNhdG9oeGRqbXljZmJhcWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjc3MzQsImV4cCI6MjA4NDg0MzczNH0.IDIB_9QB0ZwkO3ULTa56jriFJYFrMC7JuIoRd_sQrfw"
    payload: >-
      {
        "title": "{{ title }}",
        "body": "{{ message }}",
        "data": {{ data | default({}) | tojson }}
      }
```

### Wichtig zu beachten:
1. **`body` vs `message`**: Deine Automationen senden `message`, aber die Edge Function erwartet `body`. Mein Code oben mappt das automatisch (`"body": "{{ message }}"`). Du musst deine Automationen **nicht** ändern!
2. **Neustart**: Nach dem Einfügen musst du Home Assistant **neu starten** (oder zumindest die YAML-Konfiguration neu laden).

### Testen nach Einrichtung:
Gehe in Home Assistant zu **Entwicklerwerkzeuge** -> **Dienste** (bzw. Aktionen) und führe aus:
- Dienst: `rest_command.send_push_notification`
- Daten:
  ```yaml
  title: "Test von HA"
  message: "Wenn du das liest, funktioniert alles!"
  ```

Wenn das ankommt, funktionieren auch all deine Automationen (Türklingel, etc.) automatisch.
