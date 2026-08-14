<!-- 日本語版。English: README.md -->
<div align="center">

# dsh-plugin-manager

> **すべてのプラグインが、ようやく自分の言葉で語る** — 中国語名、平易な説明、ワンクリックの有効/無効切り替え、そして UI 内でのメモ編集を DeepSeek Harness に提供します。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.3.0-success.svg)](https://github.com/2768651338/dsh-plugin-manager/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)

<br>

<img src="../assets/preview.png" alt="プラグインマネージャータブ — 実際のスクリーンショット" width="720">

**設定 → プラグイン → プラグインマネージャー** · 165 個のプラグインをカタログ化、ワンクリックで切り替え、メモはその場で編集。

<br>

[**English**](../README.md) · [**中文**](README_ZH.md) · [**Español**](README_ES.md) · [**Deutsch**](README_DE.md) · [**Русский**](README_RU.md) · [**Português**](README_PT.md) · [**한국어**](README_KO.md)

</div>

> ⚠️ 本翻訳は英語版より遅れている場合があります。カタログ収録の自己チェック用セクション（互換性 / クイックスタート / 設定 / 権限とデータ / トラブルシューティング / セキュリティ）は[英語版](../README.md)を正とします。

---

> 🆕 **2026-08-14 · v0.3.0** — UI 内でのメモ編集が登場。カードの **メモを編集** をクリックすれば、プラグインの名前変更や説明の書き換えを `catalog.json` を触らずに行えます。
>
> 🔧 **v0.2.x** — tsx ソース起動時のエンドポイント 404（`./typert` による厳密登録）と cordis のインジェクションアクセス（`ctx.get` チャネル）を修正。

---

## なぜ存在するのか

| 悩み | これまで | このプラグインで |
|------|----------|------------------|
| プラグイン一覧が読めない | 英語のモジュール名だけで、各行が何をするのか分からない | 各プラグインに中国語名 + 一文説明 + カテゴリ |
| 切り替えが手作業 | `cordis.patch.yml` を手で編集（壊しやすい） | ワンクリックのスイッチ、行単位の外科的編集、約 1 秒でホットリロード |
| 未収録プラグインは謎のまま | フォールバック文言のみ | UI の中で直接メモを追記できる |
| 誤操作から何も守られない | どの行でも無効化できてしまう | システム行はロック、`!!js` 制御の行にはラベル表示 |

## インストール

```bash
# 方法 1: GitHub からインストール（推奨。dsh-navbar と同じ bundle 機構）
dsh plugin --profile web add github:2768651338/dsh-plugin-manager#main

# 方法 2: zip からインストール（Release ページからダウンロード）
# スペースを含まないパスに解凍してから:
dsh plugin --profile web add file:/<解凍先>/dsh-plugin-manager

# 方法 3: ローカルでビルド（このリポジトリをクローン）
pnpm build   # tsc + tsdown → lib/index.js（ホスト側）と lib/client.js（ブラウザ側）
dsh plugin --profile web add file:./dsh-plugin-manager
```

> その後 **DeepSeek Harness を再起動**し、**Ctrl+F5** を一度押します。設定 → プラグイン → プラグインマネージャー を開いてください。
> `lib/` の成果物はコミット済みなので、GitHub からのインストールにビルドは不要です。

## 機能

| 機能 | 説明 |
|------|------|
| 📚 中国語カタログ | 130 以上の内蔵エントリ（名前 / 説明 / カテゴリ）。フォールバックとプラグインごとのカスタマイズ付き |
| 🔘 ワンクリック切り替え | `~/.dsh/cordis.patch.yml`（グローバル層）に書き込み、DSH の HMR ウォッチャーが約 1 秒で再適用。有効化時は下位層を上書きする明示的な `disabled: false` を書き込む |
| ✏️ UI 内メモ編集 | 各カードの「メモを編集」で中国語名/説明を編集（`~/.dsh/plugin-manager/catalog.json` に保存）。ワンクリックでデフォルトに復元 |
| 🛡️ 安全ガード | ブートストラップ/トランスポート/設定シェルの行は「システム」としてロック。`!!js` 式の行は「式で制御」と表示 |
| 🔍 検索とフィルタ | 名前/説明/モジュールで検索、カテゴリで絞り込み、有効数のサマリー |

## 仕組み

| 側 | ファイル | 役割 |
|----|----------|------|
| ホスト | `lib/index.js` | `pluginManager` cordis サービス（Typert リモート）を登録: `list` / `setEnabled` / `setOverride` / `removeOverride`。切り替えはパッチファイルの外科的編集 — コメントと `!!js` 式を保持し、書き込み前に再読込して同時編集をマージ |
| ホスト | `lib/typert.host.js` | `./typert` をエクスポートし、typert-loader が**厳密な呼び出し定義**として登録。重要な修正: tsx ソース起動時、ゲートウェイと外部プラグインが typert-protocol の別コピーを持つことがあり、デコレータマーカーがコピー間で見えない（症状: 全呼び出しが 404）。厳密登録は共有レジストリを経由し、モジュールインスタンスの同一性問題を回避 |
| ブラウザ | `lib/client.js` | インジェクション不要の `ctx.get()` チャネルで `pluginManager` リモート名前空間をマウント（自己マウントのデッドロックを回避）し、`settings.plugins.tab` スロットにタブを登録 |

> 実行時依存: `@deepseek-ai/cordis` と `@deepseek-ai/dsh-typert-protocol` は DSH の `profiles/node_modules` フォールバックリンクで解決され、pnpm の追加ダウンロードは不要です。

## カスタムメモ

任意のカードで **メモを編集** をクリック。両方のフィールドを空にして保存すると、そのプラグインのカスタマイズは削除されます。上級者は `~/.dsh/plugin-manager/catalog.json` を直接編集することもできます:

```json
{
  "@dsh-external/dsh-navbar": { "name": "对话导航条", "desc": "对话区右缘的消息节点导航" }
}
```

優先順位: 上書きファイル > 内蔵カタログ > 英語の短縮名。

## プロジェクト構成

```text
src/
  index.ts              ホスト側: PluginManagerGateway（list / setEnabled / setOverride / removeOverride）
  patch-file.ts         パッチファイルの外科的エディタ（純関数）
  catalog.ts            内蔵カタログ + システム保護セット
  types.ts              共有プレーンデータ型
  typert-host.ts        厳密エンドポイント登録アーティファクト（./typert）
  client/
    index.ts            ブラウザ側: リモート名前空間のマウント + タブ登録
    remote.ts           クライアントリモートアーティファクト（厳密 zod codec）
    PluginManagerTab.tsx タブ UI（一覧 / 切り替え / メモ編集）
    locales.ts          zh/en 辞書
cordis.patch.yml        bundle パッチ（plugin-manager 行を挿入）
lib/                    ビルド成果物（コミット済み。GitHub インストールはビルド不要）
tests/                  スモーク / エンドツーエンドテスト
```

## テスト

```bash
node tests/patch-file.smoke.mjs   # パッチエディタのスモークテスト 9 件
node tests/host-gateway.e2e.mjs   # ホストゲートウェイのエンドツーエンド（上書きファイルの内容を含む）
node tests/claims.e2e.mjs         # 通常 node と tsx ソース起動でのエンドポイント主張
```

> テストスクリプト内の絶対パスはローカルの DSH インストールを指す開発専用のもので、実行時の動作には影響しません。

## 注意事項

- ブラウザ側プラグイン（ui-* / client-*）の無効化は、ページを更新するまで完全には反映されません;
- パッチファイルを手で編集する場合は行ブロック構造（列 0 の `- ` ダッシュ）を保ってください;
- アンインストール: `dsh plugin --profile web remove @dsh-external/dsh-plugin-manager`。

---

## スター履歴

<a href="https://www.star-history.com/?repos=2768651338%2Fdsh-plugin-manager&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&legend=top-left" />
  </picture>
</a>

---

<div align="center">

MIT License © [2768651338](https://github.com/2768651338)

DeepSeek Harness の公開プラグイン機構で構築 — DeepSeek とは無関係です。

</div>
