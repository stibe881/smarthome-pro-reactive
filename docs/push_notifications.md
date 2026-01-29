# Push-Benachrichtigungen einrichten

Diese Dokumentation beschreibt, wie das Push-Benachrichtigungssystem funktioniert und wie man neue Benachrichtigungen hinzufügt.

---

## 1. Architektur Überblick

Das System funktioniert zuverlässig auch im Hintergrund (wenn die App geschlossen ist), da es **Server-Side Push** verwendet.

1.  **Trigger:** Home Assistant erkennt ein Ereignis (z.B. Klingel, Waschmaschine fertig).
2.  **Aktion:** Home Assistant ruft via `REST Command` die Supabase Edge Function `send-push` auf.
3.  **Verteilung:** Die Edge Function sucht in der Datenbank alle registrierten Geräte (`push_token` in `family_members`).
4.  **Versand:** Die Edge Function sendet die Nachricht über die Expo Push API an Apple/Google.
5.  **Empfang:** Dein Handy zeigt die Nachricht an.

---

## 2. Einrichtung in Home Assistant

Damit Home Assistant Nachrichten senden kann, muss der `rest_command` in der `configuration.yaml` definiert sein.

### Einmalige Konfiguration (`configuration.yaml`)

```yaml
rest_command:
  # ... andere Commands ...
  
  send_push_notification:
    url: "https://rfqsatohxdjmycfbaqff.supabase.co/functions/v1/send-push"
    method: POST
    content_type: "application/json"
    payload: >
      {
        "title": "{{ title }}",
        "body": "{{ message }}",
        "data": {{ data | default({}) | to_json }}
      }
```
*Nach Änderungen an der configuration.yaml muss Home Assistant neu gestartet werden.*

---

## 3. Neue Benachrichtigung erstellen

Du kannst für jedes beliebige Ereignis eine Push-Benachrichtigung senden, indem du eine **Automation** erstellst.

### Beispiel: Wenn Trockner fertig ist

**Als YAML (in `automations.yaml`):**

```yaml
- alias: "Push: Trockner fertig"
  trigger:
    - platform: numeric_state
      entity_id: sensor.trockner_leistung
      below: 5
      for: "00:02:00"
  action:
    - service: rest_command.send_push_notification
      data:
        title: "Trockner"
        message: "Die Wäsche ist trocken!"
```

**Im Visuellen Editor:**

1.  Erstelle eine neue Automation.
2.  Wähle bei **Aktion**: "Dienst ausführen" (Call Service).
3.  Dienst: `RESTful Command: send_push_notification`.
4.  Kopiere folgendes in das **"Service data (YAML mode)"** Feld:

```yaml
title: "Trockner"
message: "Die Wäsche ist trocken!"
```

---

## 4. Parameter

Die `send-push` Funktion akzeptiert folgende Felder:

| Feld | Beschreibung | Pflicht? | Beispiel |
| :--- | :--- | :--- | :--- |
| `title` | Die Überschrift der Benachrichtigung. | Ja | `"Es hat geklingelt!"` |
| `message` | Der Text der Nachricht. | Ja | `"Jemand steht vor der Tür."` |
| `data` | Zusätzliche Daten für die App (z.B. wohin sie öffnen soll). | Nein | `{"screen": "doorbell"}` |

### Mögliche Screens für `data`:
- `{"screen": "doorbell"}` - Öffnet die Kamera-Ansicht.
- `{"screen": "security"}` - Öffnet die Sicherheits-Übersicht (z.B. bei Alarm).

---

## 5. Troubleshooting (Fehlerbehebung)

**Problem: Es kommt keine Nachricht an.**

1.  **Token prüfen:** Stelle sicher, dass du die App auf deinem Handy **einmal komplett neu gestartet** hast. Nur beim Start wird der Token an die Datenbank gesendet.
2.  **Datenbank prüfen:** Schaue in Supabase in die Tabelle `family_members`. Bei deinem Benutzer muss in der Spalte `push_token` ein Wert stehen (z.B. `ExponentPushToken[...]`).
3.  **Logs prüfen:** 
    - Gehe ins Supabase Dashboard -> Functions -> `send-push` -> Logs.
    - Wenn dort Fehler stehen, wurde der Request abgelehnt.
    - Wenn dort `Success: true` steht, liegt es an den Berechtigungen am Handy (Mitteilungen erlaubt?).
