<!-- Versión en español. English: README.md -->
<div align="center">

# dsh-plugin-manager

> **Cada plugin finalmente habla por sí mismo** — nombres en chino, descripciones en lenguaje claro, activación/desactivación con un clic y edición de notas en la interfaz para DeepSeek Harness.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.7.0-success.svg)](https://github.com/2768651338/dsh-plugin-manager/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)

<br>

<img src="../assets/preview.png" alt="Pestaña Plugin Manager — captura real" width="720">

**Configuración → Plugins → Plugin Manager** · 165 plugins catalogados, un clic para alternar, notas editadas en el sitio.

<br>

[**English**](../README.md) · [**中文**](README_ZH.md) · [**日本語**](README_JA.md) · [**Deutsch**](README_DE.md) · [**Русский**](README_RU.md) · [**Português**](README_PT.md) · [**한국어**](README_KO.md)

</div>

> ⚠️ Esta traducción puede estar desactualizada. Las secciones de autoevaluación para el catálogo (Compatibilidad, Inicio rápido, Configuración, Permisos y datos, Solución de problemas, Seguridad) toman como referencia la [versión en inglés](../README.md).

---

> 🆕 **2026-10-01 · v0.7.0** — Adaptado a **DSH 0.2.0** (verificado contra `0.2.0-rc.2`) manteniendo el funcionamiento en hosts 0.1.x: los artefactos codec de doble forma se registran tanto en la cadena typert de 0.1.x (instancia zod) como en la de 0.2.0 (fábrica `create()`) — toda la suite e2e pasa tanto en 0.2.0-rc.2 como en 0.1.5-rc.3. El catálogo incorpora las filas de 0.2.0 (`dsh-hmr`, la división del LLM de DeepSeek, las filas del plugin manager oficial); los rangos de peer se amplían a `0.2.0-rc.0`+. La recarga en caliente sigue funcionando en 0.2.0 (el servicio `dsh-hmr` vigila el archivo de parches global).
>
> 🆕 **2026-10-01 · v0.6.0** — Adaptado a **DSH 0.1.5** (verificado contra el conjunto de paquetes `0.1.5-rc.3`): la mitad host y la client compilan y pasan toda la suite e2e en 0.1.5-rc.3, y la suite de pruebas ahora es autocontenida (sin instalación local de DSH). También corrige una colisión de espacio de nombres de localización con `@linxin666/dsh-web-ui-all`.
>
> 🆕 **2026-08-14 · v0.3.0** — La edición de notas en la interfaz ya está disponible: haz clic en **Editar notas** en cualquier tarjeta para renombrar un plugin o reescribir su descripción sin tocar `catalog.json`.
>
> 🔧 **v0.2.x** — Corregido el 404 de endpoints en el arranque con código fuente tsx (registro estricto `./typert`) y el acceso de inyección de cordis (canal `ctx.get`).

---

## Por qué existe

| Dolor | Antes | Con este plugin |
|-------|-------|-----------------|
| La lista de plugins no dice nada | Solo nombres de módulo en inglés, sin pistas de qué hace cada fila | Nombre en chino + descripción de una línea + categoría para cada plugin |
| Alternar es manual | Editar `cordis.patch.yml` a mano (fácil de romper) | Interruptor de un clic, ediciones quirúrgicas por línea, recarga en ~1 s |
| Los plugins desconocidos siguen siendo un misterio | Solo texto de respaldo | Añade tus propias notas directamente en la interfaz |
| Nada está a salvo de un clic torpe | Cualquier fila puede desactivarse | Filas del sistema bloqueadas, filas controladas por `!!js` etiquetadas |

## Instalación

```bash
# Opción 1: instalar desde GitHub (recomendado, mismo mecanismo de bundle que dsh-navbar)
dsh plugin --profile web add github:2768651338/dsh-plugin-manager#main

# Opción 2: instalar desde un zip (descárgalo de la página de Releases)
# descomprime en una ruta sin espacios y ejecuta:
dsh plugin --profile web add file:/<directorio-descomprimido>/dsh-plugin-manager

# Opción 3: compilar localmente (clona este repositorio)
pnpm build   # tsc + tsdown → lib/index.js (mitad host) y lib/client.js (mitad navegador)
dsh plugin --profile web add file:./dsh-plugin-manager
```

> Luego **reinicia DeepSeek Harness** y pulsa **Ctrl+F5** una vez. Abre *Configuración → Plugins → Plugin Manager*.
> Los artefactos `lib/` están versionados, así que la instalación desde GitHub no requiere compilar.

## Funciones

| Función | Descripción |
|---------|-------------|
| 📚 Catálogo bilingüe | Más de 195 entradas integradas (nombre / descripción / categoría) en chino e inglés — la interfaz en inglés muestra textos en inglés y, si faltan, el nombre corto + una nota en inglés en lugar de chino; con respaldo y personalización por plugin |
| 🔘 Interruptor de un clic | Escribe `~/.dsh/cordis.patch.yml` (capa global); el watcher HMR de DSH lo re-aplica en ~1 segundo; al activar escribe un `disabled: false` explícito que anula capas inferiores |
| ✏️ Notas en la interfaz | "Editar notas" en cada tarjeta edita el nombre/descripción en chino (`~/.dsh/plugin-manager/catalog.json`) con restauración de valores por defecto en un clic |
| 🛡️ Protecciones | Filas de arranque/transporte/entorno de ajustes bloqueadas como "Sistema"; filas con expresiones `!!js` etiquetadas como "Controlado por expresión" |
| 🔍 Búsqueda y filtro | Busca por nombre/descripción/módulo, filtra por categoría, resumen de habilitados |
| 💾 Copia de seguridad y restauración | Exporta notas + lista de plugins (dependencias/bundles del perfil) + el parche de activación/desactivación a un JSON; la importación fusiona (nunca elimina tus entradas existentes) e imprime el comando exacto de reinstalación |

## Cómo funciona

| Mitad | Archivo | Rol |
|-------|---------|-----|
| Host | `lib/index.js` | Registra el servicio cordis `pluginManager` (remoto Typert): `list` / `setEnabled` / `setOverride` / `removeOverride` / `exportBackup` / `importBackup`. Los interruptores usan edición quirúrgica del archivo de parches — se conservan comentarios y expresiones `!!js`; el archivo se relee antes de escribir para fusionar ediciones concurrentes. |
| Host | `lib/typert.host.js` | Exporta `./typert`; el typert-loader lo registra como **definiciones de invocación estrictas**. Corrección clave: en el arranque con código fuente tsx, el gateway y un plugin externo pueden cargar dos copias de typert-protocol — los marcadores de decoradores son invisibles entre copias (síntoma: todos los llamados devuelven 404). El registro estricto pasa por el registro compartido y evita el problema de identidad de instancia de módulo. |
| Navegador | `lib/client.js` | Monta el espacio de nombres remoto `pluginManager` mediante el canal `ctx.get()` sin inyección (evita un bloqueo de auto-montaje) y registra la pestaña Plugin Manager en el slot `settings.plugins.tab`. |

> Dependencias en tiempo de ejecución: `@deepseek-ai/cordis` y `@deepseek-ai/dsh-typert-protocol` se resuelven mediante los enlaces de respaldo `profiles/node_modules` de DSH — sin descargas adicionales de pnpm.

## Notas personalizadas

Haz clic en **Editar notas** en cualquier tarjeta. Guardar con ambos campos vacíos elimina la personalización de ese plugin. Los usuarios avanzados pueden seguir editando `~/.dsh/plugin-manager/catalog.json` directamente:

```json
{
  "@dsh-external/dsh-navbar": { "name": "对话导航条", "desc": "对话区右缘的消息节点导航" }
}
```

Prioridad: archivo de anulaciones > catálogo integrado > nombre corto en inglés.

## Seguridad

Este plugin **no incluye autenticación propia**: quién puede alcanzar sus operaciones de escritura (activar/desactivar, notas, importación de copias de seguridad) lo decide por completo la barrera de confianza de la app web de DSH. Por defecto, el servidor web solo escucha en la interfaz de loopback. Si configuras el servidor web de DSH en una dirección distinta de loopback (opciones `host`/`port`), **cualquiera que alcance ese puerto podrá alternar plugins y reescribir tu `cordis.patch.yml` y las dependencias del perfil** — no expongas el servidor web a redes no confiables.

## Estructura del proyecto

```text
src/
  index.ts              mitad host: PluginManagerGateway (list / setEnabled / setOverride / removeOverride)
  patch-file.ts         editor quirúrgico del archivo de parches (funciones puras)
  catalog.ts            catálogo integrado + conjunto de protección del sistema
  types.ts              tipos de datos compartidos
  typert-host.ts        artefacto de registro estricto de endpoints (./typert)
  client/
    index.ts            mitad navegador: monta el espacio de nombres remoto + registra la pestaña
    remote.ts           artefacto remoto del cliente (codecs estrictos zod)
    PluginManagerTab.tsx UI de la pestaña (lista / interruptores / edición de notas)
    locales.ts          diccionarios zh/en
cordis.patch.yml        parche del bundle (inserta la fila plugin-manager)
lib/                    artefactos compilados (versionados; las instalaciones desde GitHub no compilan)
tests/                  pruebas de humo / de extremo a extremo
```

## Pruebas

```bash
node tests/patch-file.smoke.mjs   # 9 pruebas de humo del editor de parches
node tests/host-gateway.e2e.mjs   # gateway del host de extremo a extremo (incl. contenido del archivo de anulaciones)
node tests/claims.e2e.mjs         # reclamación de endpoints bajo node plano y arranque tsx
```

> Las rutas absolutas dentro de los scripts de prueba apuntan a la instalación local de DSH y son solo de desarrollo; no afectan el comportamiento en tiempo de ejecución.

## Notas

- Desactivar plugins del lado del navegador (ui-* / client-*) solo se descarga por completo tras refrescar la página;
- Al editar el archivo de parches a mano, conserva la estructura de bloques (un guion `- ` en la columna 0);
- Desinstalar: `dsh plugin --profile web remove @txc2768651338/dsh-plugin-manager`.

---

## Historial de estrellas

<a href="https://www.star-history.com/?repos=2768651338%2Fdsh-plugin-manager&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&legend=top-left" />
  </picture>
</a>

---

<div align="center">

Licencia MIT © [2768651338](https://github.com/2768651338)

Construido sobre el mecanismo público de plugins de DeepSeek Harness — sin afiliación con DeepSeek.

</div>
