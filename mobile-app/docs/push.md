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

## 2. Türklingel

**Trigger:** Event `event.hausture_klingeln` ändert seinen Status

**Kategorie:** `DOORBELL_ACTION`

**Beispiel-Nachricht:**
```
Titel: Jemand hat geklingelt
Text: Möchtest du die Türe öffnen?
Aktion: [Türe öffnen] Button → ruft button.hausture_tur_offnen auf
```

**Code:** `HomeAssistantContext.tsx` → `setEventCallback` in useEffect

---

## 3. Haustür-Öffner Bestätigung

**Trigger:** Benutzer drückt den "Öffnen" Button für die Haustür (oder reagiert auf Türklingel-Benachrichtigung)

**Beispiel-Nachricht:**
```
Titel: Haustür
Text: Öffnen Befehl gesendet.
```

**Code:** `HomeAssistantContext.tsx` → `handleDoorOpenAction`

---

## 4. Geofencing - Willkommen Zuhause

**Trigger:** Benutzer betritt die Home-Region (100m Radius)

**Voraussetzung:** 
- Hintergrund-Standortberechtigung erteilt
- Home-Standort in Einstellungen gesetzt

**Kategorie:** `DOOR_OPEN_ACTION`

**Beispiel-Nachricht:**
```
Titel: Willkommen Zuhause
Text: Möchtest du die Haustüre öffnen?
Aktion: [Haustüre öffnen] Button → ruft button.hausture_tur_offnen auf
```

**Code:** `HomeAssistantContext.tsx` → `GEOFENCING_TASK`

---

## 5. Einkaufen Erinnerung

**Trigger:** Benutzer ist länger als 2 Minuten in einem Geschäft (Coop, Migros, Volg, Aldi, Lidl, Kaufland, Denner) und hat Artikel auf der Einkaufsliste

**Voraussetzung:**
- Hintergrund-Standortberechtigung erteilt
- Einkaufsliste hat mindestens 1 Artikel

**Kategorie:** `SHOPPING_ACTION`

**Beispiel-Nachricht:**
```
Titel: Einkaufsliste
Text: Du hast noch X Artikel auf deiner Liste!
Aktion: Öffnet die Einkaufsliste beim Tippen
```

**Code:** `HomeAssistantContext.tsx` → `SHOPPING_TASK`

---

## 6. Wetterwarnung (MeteoAlarm)

**Trigger:** `binary_sensor.meteoalarm` wechselt auf `on`

**Voraussetzung:** Neue Warnung (noch nicht angezeigt)

**Beispiel-Nachricht:**
```
Titel: [Übersetzter Warntyp, z.B. "Gewitter Warnung"]
Text: [Beschreibung der Warnung] (gültig ab [Datum])
```

**Code:** `HomeAssistantContext.tsx` → `checkWeather` useEffect

---

## Benachrichtigungs-Kategorien

| Kategorie | Aktionen | Beschreibung |
|-----------|----------|--------------|
| `DOOR_OPEN_ACTION` | `open_door_btn` | Haustüre öffnen (Geofencing) |
| `DOORBELL_ACTION` | `open_door_btn` | Türe öffnen (Klingel) |
| `SHOPPING_ACTION` | - | Öffnet Einkaufsliste |

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

---

## Technische Hinweise

- Alle Benachrichtigungen werden lokal über `expo-notifications` gesendet
- Aktions-Buttons funktionieren auch im Hintergrund (`opensAppToForeground: false`)
- Geofencing und Shopping-Tasks laufen als Background-Tasks via `expo-task-manager`
- Wetterwarnungen werden nur einmal pro Warnung angezeigt (gespeichert in AsyncStorage)
