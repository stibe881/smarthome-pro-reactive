# Push Benachrichtigungen Übersicht

Alle Benachrichtigungen können nun in der App unter **Optionen -> Benachrichtigungen** aktiviert oder deaktiviert werden.

Die "Kritischen" Benachrichtigungen (Sicherheit, Türklingel, Wetter, Baby) werden nicht mehr direkt vom Handy überwacht, sondern **vom Home Assistant gesteuert**.
Das Handy sagt dem Home Assistant nur: "Ich möchte informiert werden".

Damit dies funktioniert, müssen im Home Assistant **Helfer (Input Booleans)** erstellt werden.

## 1. Sicherheit ("Türen UG")
**Schalter:** `Türen UG`

Steuert die Benachrichtigung bei Öffnung der Kellertüren (Waschküche / Highlight).
Verknüpft mit Helper:
*   `input_boolean.notify_stibe_turen_ug`

## 2. Zuhause ("Türklingel")
**Schalter:** `Türklingel`

Steuert die Benachrichtigung, wenn jemand klingelt.
Verknüpft mit Helper:
*   `input_boolean.notify_stibe_doorbell`

## 3. Wetter ("Wetterwarnung")
**Schalter:** `Wetterwarnung`

Steuert automatische Warnungen bei Sturm/Regen etc.
Verknüpft mit Helper:
*   `input_boolean.notify_stibe_weatheralert`

## 4. Baby ("Baby Weint")
**Schalter:** `Baby Weint`

Steuert Benachrichtigung, wenn eine Kamera Babygeschrei erkennt.
Verknüpft mit Helper:
*   `input_boolean.notify_stibe_baby_cry`

**Automation Trigger (Beispiel):**
Deine Automation sollte auf folgende Sensoren reagieren:
- `binary_sensor.kamera_eingang_baby_cry_detected`
- `binary_sensor.kamera_balkon_baby_cry_detected`
- `binary_sensor.kamera_grillplatz_baby_cry_detected`
- ... (alle Baby Cry Sensoren)

**Condition:**
Muss prüfen ob `input_boolean.notify_stibe_baby_cry` == `on` ist.

---

## Nur auf dem Handy (Lokal)
Diese Benachrichtigungen laufen rein auf dem Handy (Geofence):

### 5. Haushalt ("Einkaufs-Erinnerung")
**Schalter:** `Einkaufs-Erinnerung`
Erinnert dich an die Einkaufsliste, wenn du bei Coop/Migros bist.

### 6. Zuhause ("Willkommen")
**Schalter:** `Willkommen Zuhause`
Fragt dich "Türe öffnen?", wenn du nach Hause kommst.
