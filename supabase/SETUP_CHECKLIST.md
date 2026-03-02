# Setup-Checkliste für Admin-Rolle

## 🔴 Problem: Admin-Menü wird nicht angezeigt

### Schritt 1: Basis-Schema erstellen
**Status:** ❓ Bitte überprüfen

Führe in Supabase SQL Editor aus:
```
supabase-schema.sql
```

### Schritt 2: User Management Schema erstellen  
**Status:** ❓ Bitte überprüfen

Führe in Supabase SQL Editor aus:
```
supabase-user-management.sql
```

### Schritt 3: Diagnose ausführen
**Status:** ⏳ Jetzt tun!

1. Öffne `diagnose-database.sql`
2. Führe es im Supabase SQL Editor aus
3. Schau dir die Ergebnisse an:
   - Zeile 1: Tabelle existiert? (sollte `true` sein)
   - Zeile 2: Wie viele Rollen? (sollte mindestens 1 sein)
   - Zeile 3: Liste aller Benutzer mit Rollen
   - Zeile 4: Admin-Benutzer (sollte `stefan.gross@hotmail.ch` zeigen)

### Schritt 4: Admin-Rolle setzen (falls nötig)
**Status:** ⏳ Falls Diagnose zeigt, dass keine admin-Rolle existiert

Führe aus:
```
fix-admin-role.sql
```

### Schritt 5: Frontend neu laden
**Status:** ⏳ Nachdem alles in der DB korrekt ist

1. Im Browser: **Strg+Shift+R** (Hard Reload)
2. Oder: Abmelden → Neu anmelden
3. Öffne Konsole (F12)
4. Prüfe Logs:
   - `[AuthContext] User role data: { role: 'admin' }`
   - `[App] User role: admin`

---

## ❓ Welchen Schritt hast du bereits gemacht?

Sende mir die **Ergebnisse der Diagnose** (Schritt 3)!
