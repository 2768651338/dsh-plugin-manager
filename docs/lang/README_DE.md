<!-- Deutsche Fassung. English: README.md -->
<div align="center">

# dsh-plugin-manager

> **Jedes Plugin spricht endlich für sich selbst** — chinesische Namen, verständliche Beschreibungen, Ein-Klick-Aktivierung und Notizbearbeitung direkt in der Oberfläche für DeepSeek Harness.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.3.0-success.svg)](https://github.com/2768651338/dsh-plugin-manager/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)

<br>

<img src="../assets/preview.png" alt="Plugin-Manager-Tab — echter Screenshot" width="720">

**Einstellungen → Plugins → Plugin-Manager** · 165 katalogisierte Plugins, ein Klick zum Umschalten, Notizen direkt bearbeitbar.

<br>

[**English**](../README.md) · [**中文**](README_ZH.md) · [**Español**](README_ES.md) · [**日本語**](README_JA.md) · [**Русский**](README_RU.md) · [**Português**](README_PT.md) · [**한국어**](README_KO.md)

</div>

---

> 🆕 **2026-08-14 · v0.3.0** — Notizbearbeitung in der Oberfläche ist da: Klicke auf **Notizen bearbeiten** an einer beliebigen Karte, um einen Plugin umzubenennen oder seine Beschreibung zu ändern — ohne `catalog.json` anzufassen.
>
> 🔧 **v0.2.x** — 404-Fehler unter tsx-Source-Start (strikte `./typert`-Registrierung) und der cordis-Inject-Zugriff (`ctx.get`-Kanal) behoben.

---

## Warum es das gibt

| Schmerz | Vorher | Mit diesem Plugin |
|---------|--------|-------------------|
| Plugin-Liste sagt nichts aus | Nur englische Modulnamen, keine Ahnung, was jede Zeile tut | Chinesischer Name + einzeilige Beschreibung + Kategorie für jedes Plugin |
| Umschalten ist Handarbeit | `cordis.patch.yml` von Hand editieren (schnell kaputt) | Ein-Klick-Schalter, chirurgische Zeilen-Edits, Hot-Reload in ~1 s |
| Unbekannte Plugins bleiben rätselhaft | Nur Fallback-Text | Eigene Notizen direkt in der UI ergänzen |
| Nichts ist vor Fehlklicks sicher | Jede Zeile kann deaktiviert werden | Systemzeilen gesperrt, `!!js`-gesteuerte Zeilen markiert |

## Installation

```bash
# Option 1: Installation von GitHub (empfohlen, gleicher Bundle-Mechanismus wie dsh-navbar)
dsh plugin --profile web add github:2768651338/dsh-plugin-manager#main

# Option 2: Installation aus einem Zip (von der Release-Seite herunterladen)
# in einen Pfad ohne Leerzeichen entpacken, dann:
dsh plugin --profile web add file:/<entpacktes-verzeichnis>/dsh-plugin-manager

# Option 3: Lokal bauen (Repository klonen)
pnpm build   # tsc + tsdown → lib/index.js (Host-Hälfte) und lib/client.js (Browser-Hälfte)
dsh plugin --profile web add file:./dsh-plugin-manager
```

> Danach **DeepSeek Harness neu starten** und einmal **Strg+F5** drücken. Öffne *Einstellungen → Plugins → Plugin-Manager*.
> Die `lib/`-Artefakte sind eingecheckt — die GitHub-Installation benötigt keinen lokalen Build.

## Funktionen

| Funktion | Beschreibung |
|----------|--------------|
| 📚 Chinesischer Katalog | 130+ eingebaute Einträge (Name / Beschreibung / Kategorie) mit Fallback und Anpassung je Plugin |
| 🔘 Ein-Klick-Schalter | Schreibt `~/.dsh/cordis.patch.yml` (globale Ebene); der HMR-Watcher von DSH wendet es in ~1 Sekunde neu an; Aktivieren schreibt ein explizites `disabled: false`, das untere Ebenen überschreibt |
| ✏️ Notizen in der UI | „Notizen bearbeiten“ an jeder Karte ändert den chinesischen Namen/die Beschreibung (`~/.dsh/plugin-manager/catalog.json`) mit Ein-Klick-Wiederherstellung |
| 🛡️ Sicherungen | Bootstrap-/Transport-/Einstellungs-Shell-Zeilen als „System“ gesperrt; `!!js`-Ausdruckszeilen als „Ausdrucksgesteuert“ markiert |
| 🔍 Suche & Filter | Suche nach Name/Beschreibung/Modul, Filter nach Kategorie, Übersicht der aktivierten Anzahl |

## So funktioniert es

| Hälfte | Datei | Rolle |
|--------|-------|-------|
| Host | `lib/index.js` | Registriert den cordis-Dienst `pluginManager` (Typert-Remote): `list` / `setEnabled` / `setOverride` / `removeOverride`. Schalter nutzen chirurgische Patch-Datei-Edits — Kommentare und `!!js`-Ausdrücke bleiben erhalten; vor dem Schreiben wird erneut gelesen, um parallele Edits zu verschmelzen. |
| Host | `lib/typert.host.js` | Exportiert `./typert`; der typert-loader registriert es als **strikte Aufrufdefinitionen**. Entscheidender Fix: Beim tsx-Source-Start können Gateway und externes Plugin zwei Kopien von typert-protocol halten — Dekorator-Marker sind kopienübergreifend unsichtbar (Symptom: jeder Aufruf liefert 404). Die strikte Registrierung läuft über die gemeinsame Registry und umgeht die Modul-Instanz-Identität. |
| Browser | `lib/client.js` | Mountet den `pluginManager`-Remote-Namespace über den injektionsfreien `ctx.get()`-Kanal (vermeidet einen Selbst-Mount-Deadlock) und registriert den Tab im Slot `settings.plugins.tab`. |

> Laufzeitabhängigkeiten: `@deepseek-ai/cordis` und `@deepseek-ai/dsh-typert-protocol` werden über die `profiles/node_modules`-Fallback-Links von DSH aufgelöst — keine zusätzlichen pnpm-Downloads.

## Eigene Notizen

Klicke an einer Karte auf **Notizen bearbeiten**. Speichern mit beiden leeren Feldern entfernt die Anpassung des Plugins. Power-User können `~/.dsh/plugin-manager/catalog.json` weiterhin direkt bearbeiten:

```json
{
  "@dsh-external/dsh-navbar": { "name": "对话导航条", "desc": "对话区右缘的消息节点导航" }
}
```

Rangfolge: Override-Datei > eingebauter Katalog > englischer Kurzname.

## Projektstruktur

```text
src/
  index.ts              Host-Hälfte: PluginManagerGateway (list / setEnabled / setOverride / removeOverride)
  patch-file.ts         chirurgischer Patch-Datei-Editor (reine Funktionen)
  catalog.ts            eingebauter Katalog + System-Schutzset
  types.ts              gemeinsame Datentypen
  typert-host.ts        Artefakt der strikten Endpunkt-Registrierung (./typert)
  client/
    index.ts            Browser-Hälfte: Remote-Namespace mounten + Tab registrieren
    remote.ts           Client-Remote-Artefakt (strikte zod-Codecs)
    PluginManagerTab.tsx Tab-UI (Liste / Schalter / Notizbearbeitung)
    locales.ts          zh/en-Wörterbücher
cordis.patch.yml        Bundle-Patch (fügt die plugin-manager-Zeile ein)
lib/                    Build-Artefakte (eingecheckt; GitHub-Installation überspringt den Build)
tests/                  Smoke- / End-to-End-Tests
```

## Tests

```bash
node tests/patch-file.smoke.mjs   # 9 Smoke-Tests für den Patch-Editor
node tests/host-gateway.e2e.mjs   # Host-Gateway End-to-End (inkl. Override-Dateiinhalte)
node tests/claims.e2e.mjs         # Endpunkt-Beanspruchung unter plain node und tsx-Source-Start
```

> Absolute Pfade in den Testskripten zeigen auf die lokale DSH-Installation und sind nur für die Entwicklung — sie beeinflussen das Laufzeitverhalten nicht.

## Hinweise

- Das Deaktivieren browserseitiger Plugins (ui-* / client-*) wird erst nach einem Seiten-Refresh vollständig wirksam;
- Beim manuellen Bearbeiten der Patch-Datei die Zeilenblock-Struktur beibehalten (ein `- ` Bindestrich in Spalte 0);
- Deinstallation: `dsh plugin --profile web remove @dsh-external/dsh-plugin-manager`.

---

## Star-Verlauf

<a href="https://www.star-history.com/?repos=2768651338%2Fdsh-plugin-manager&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&legend=top-left" />
  </picture>
</a>

---

<div align="center">

MIT-Lizenz © [2768651338](https://github.com/2768651338)

Auf Basis des öffentlichen Plugin-Mechanismus von DeepSeek Harness erstellt — keine Verbindung zu DeepSeek.

</div>
