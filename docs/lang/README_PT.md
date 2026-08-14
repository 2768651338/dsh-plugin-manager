<!-- Versão em português. English: README.md -->
<div align="center">

# dsh-plugin-manager

> **Cada plugin finalmente fala por si mesmo** — nomes em chinês, descrições em linguagem clara, ativação/desativação com um clique e edição de notas na própria interface para o DeepSeek Harness.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.4.0-success.svg)](https://github.com/2768651338/dsh-plugin-manager/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)

<br>

<img src="../assets/preview.png" alt="Aba Gerenciador de plugins — captura de tela real" width="720">

**Configurações → Plugins → Gerenciador de plugins** · 165 plugins catalogados, um clique para alternar, notas editadas no lugar.

<br>

[**English**](../README.md) · [**中文**](README_ZH.md) · [**Español**](README_ES.md) · [**日本語**](README_JA.md) · [**Deutsch**](README_DE.md) · [**Русский**](README_RU.md) · [**한국어**](README_KO.md)

</div>

> ⚠️ Esta tradução pode estar desatualizada. As seções de autoavaliação para o catálogo (Compatibilidade, Início rápido, Configuração, Permissões e dados, Solução de problemas, Segurança) seguem a [versão em inglês](../README.md).

---

> 🆕 **2026-08-14 · v0.3.0** — A edição de notas na interface chegou: clique em **Editar notas** em qualquer cartão para renomear um plugin ou reescrever sua descrição sem tocar no `catalog.json`.
>
> 🔧 **v0.2.x** — Corrigidos os erros 404 de endpoints na inicialização via código-fonte tsx (registro estrito `./typert`) e o acesso de injeção do cordis (canal `ctx.get`).

---

## Por que ele existe

| Dor | Antes | Com este plugin |
|-----|-------|-----------------|
| A lista de plugins não diz nada | Apenas nomes de módulos em inglês, sem pistas do que cada linha faz | Nome em chinês + descrição de uma linha + categoria para cada plugin |
| Alternar é manual | Editar `cordis.patch.yml` à mão (fácil de quebrar) | Interruptor de um clique, edições cirúrgicas linha a linha, hot-reload em ~1 s |
| Plugins desconhecidos seguem misteriosos | Apenas texto de fallback | Adicione suas próprias notas direto na interface |
| Nada está a salvo de cliques acidentais | Qualquer linha pode ser desativada | Linhas de sistema bloqueadas, linhas controladas por `!!js` rotuladas |

## Instalação

```bash
# Opção 1: instalar a partir do GitHub (recomendado, mesmo mecanismo de bundle do dsh-navbar)
dsh plugin --profile web add github:2768651338/dsh-plugin-manager#main

# Opção 2: instalar a partir de um zip (baixe na página de Releases)
# extraia para um caminho sem espaços e execute:
dsh plugin --profile web add file:/<diretório-extraído>/dsh-plugin-manager

# Opção 3: compilar localmente (clone este repositório)
pnpm build   # tsc + tsdown → lib/index.js (metade host) e lib/client.js (metade navegador)
dsh plugin --profile web add file:./dsh-plugin-manager
```

> Depois **reinicie o DeepSeek Harness** e pressione **Ctrl+F5** uma vez. Abra *Configurações → Plugins → Gerenciador de plugins*.
> Os artefatos `lib/` estão versionados — a instalação pelo GitHub não exige build local.

## Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| 📚 Catálogo em chinês | Mais de 130 entradas integradas (nome / descrição / categoria) com fallback e personalização por plugin |
| 🔘 Interruptor de um clique | Escreve em `~/.dsh/cordis.patch.yml` (camada global); o watcher HMR do DSH reaplica em ~1 segundo; ativar grava um `disabled: false` explícito que sobrescreve camadas inferiores |
| ✏️ Notas na interface | “Editar notas” em cada cartão altera o nome/descrição em chinês (`~/.dsh/plugin-manager/catalog.json`) com restauração do padrão em um clique |
| 🛡️ Proteções | Linhas de bootstrap/transporte/shell de configurações bloqueadas como “Sistema”; linhas com expressões `!!js` rotuladas como “Controladas por expressão” |
| 🔍 Busca e filtro | Busca por nome/descrição/módulo, filtro por categoria, resumo de habilitados |

## Como funciona

| Metade | Arquivo | Papel |
|--------|---------|-------|
| Host | `lib/index.js` | Registra o serviço cordis `pluginManager` (remoto Typert): `list` / `setEnabled` / `setOverride` / `removeOverride`. Os interruptores usam edição cirúrgica do arquivo de patch — comentários e expressões `!!js` são preservados; o arquivo é relido antes da escrita para mesclar edições concorrentes. |
| Host | `lib/typert.host.js` | Exporta `./typert`; o typert-loader o registra como **definições de invocação estritas**. Correção crucial: na inicialização via código-fonte tsx, o gateway e um plugin externo podem carregar duas cópias do typert-protocol — os marcadores de decoradores ficam invisíveis entre cópias (sintoma: toda chamada retorna 404). O registro estrito passa pelo registro compartilhado e contorna a identidade de instância do módulo. |
| Navegador | `lib/client.js` | Monta o namespace remoto `pluginManager` pelo canal `ctx.get()` sem injeção (evita um deadlock de automontagem) e registra a aba no slot `settings.plugins.tab`. |

> Dependências de execução: `@deepseek-ai/cordis` e `@deepseek-ai/dsh-typert-protocol` são resolvidas pelos links de fallback `profiles/node_modules` do DSH — sem downloads extras do pnpm.

## Notas personalizadas

Clique em **Editar notas** em qualquer cartão. Salvar com os dois campos vazios remove a personalização daquele plugin. Usuários avançados podem continuar editando `~/.dsh/plugin-manager/catalog.json` diretamente:

```json
{
  "@dsh-external/dsh-navbar": { "name": "对话导航条", "desc": "对话区右缘的消息节点导航" }
}
```

Precedência: arquivo de sobrescrita > catálogo integrado > nome curto em inglês.

## Estrutura do projeto

```text
src/
  index.ts              metade host: PluginManagerGateway (list / setEnabled / setOverride / removeOverride)
  patch-file.ts         editor cirúrgico do arquivo de patch (funções puras)
  catalog.ts            catálogo integrado + conjunto de proteção do sistema
  types.ts              tipos de dados compartilhados
  typert-host.ts        artefato de registro estrito de endpoints (./typert)
  client/
    index.ts            metade navegador: monta o namespace remoto + registra a aba
    remote.ts           artefato remoto do cliente (codecs estritos zod)
    PluginManagerTab.tsx UI da aba (lista / interruptores / edição de notas)
    locales.ts          dicionários zh/en
cordis.patch.yml        patch do bundle (insere a linha plugin-manager)
lib/                    artefatos compilados (versionados; instalação pelo GitHub pula o build)
tests/                  testes de fumaça / ponta a ponta
```

## Testes

```bash
node tests/patch-file.smoke.mjs   # 9 testes de fumaça do editor de patches
node tests/host-gateway.e2e.mjs   # gateway do host ponta a ponta (incl. conteúdo do arquivo de sobrescrita)
node tests/claims.e2e.mjs         # registro de endpoints sob node simples e inicialização tsx
```

> Os caminhos absolutos dentro dos scripts de teste apontam para a instalação local do DSH e são apenas de desenvolvimento; não afetam o comportamento em tempo de execução.

## Observações

- Desativar plugins do lado do navegador (ui-* / client-*) só é totalmente aplicado após atualizar a página;
- Ao editar o arquivo de patch à mão, mantenha a estrutura de blocos de linhas (um hífen `- ` na coluna 0);
- Desinstalar: `dsh plugin --profile web remove @2768651338/dsh-plugin-manager`.

---

## Histórico de estrelas

<a href="https://www.star-history.com/?repos=2768651338%2Fdsh-plugin-manager&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&legend=top-left" />
  </picture>
</a>

---

<div align="center">

Licença MIT © [2768651338](https://github.com/2768651338)

Construído sobre o mecanismo público de plugins do DeepSeek Harness — sem afiliação com a DeepSeek.

</div>
