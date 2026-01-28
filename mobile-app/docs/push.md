# Push-Benachrichtigungen

## Übersicht

Die App sendet lokale Push-Benachrichtigungen basierend auf Home Assistant Events.

---

## 1. Türsensoren (Security Center)

**Trigger:** Binary Sensor wechselt von `off` → `on`

**Erkannte Sensoren:**
- Entity-ID muss `tur`, `tür` oder `door` enthalten
- Ausgeschlossen: Sensoren mit `motion`, `bewegung`, `kamera`, `camera`

| Sensor | Einstellung |
|--------|-------------|
| Waschküchentüre | `notificationSettings.doors.waschkueche` |
| Highlighttür | `notificationSettings.doors.highlight` |

**Beispiel-Nachricht:**
```
Titel: Security Center
Text: Waschküchentüre wurde geöffnet
```

**Code:** `HomeAssistantContext.tsx` (Zeilen 220-280)

---

## 2. Haustür-Öffner Bestätigung

**Trigger:** Benutzer drückt den "Öffnen" Button für die Haustür

**Beispiel-Nachricht:**
```
Titel: Security Center
Text: Die Haustüre wurde geöffnet
```

**Code:** `index.tsx` → `DoorOpenerTile` Komponente

---

## 3. Geofencing - Willkommen Zuhause

**Trigger:** Benutzer betritt die Home-Region (100m Radius)

**Voraussetzung:** 
- Hintergrund-Standortberechtigung erteilt
- Home-Standort in Einstellungen gesetzt

**Beispiel-Nachricht:**
```
Titel: Willkommen Zuhause
Text: Möchtest du die Haustüre öffnen?
Aktion: [Haustüre öffnen] Button
```

**Code:** `HomeAssistantContext.tsx` → `GEOFENCING_TASK`

---

## Einstellungen

Die Benachrichtigungen können in den App-Einstellungen gesteuert werden:

```typescript
interface NotificationSettings {
    enabled: boolean;        // Master-Schalter
    doors: {
        highlight: boolean;      // Highlighttür
        waschkueche: boolean;    // Waschküchentüre
    };
}
```

Gespeichert unter: `AsyncStorage` Key `@smarthome_notif_settings`
