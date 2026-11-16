# Image Editor(imageeditor)

ブラウザ上で動く写真編集ツール。EXIF から撮影情報を読み取り、フレーム・透かし・ロゴを付けて書き出す。処理はすべてブラウザ内で完結する(画像をサーバーに送らない)。今後、自動レタッチ・一括処理などを追加し、それらを買い切りの有料機能にする予定。

このファイルは Claude Code と実装担当(実装を受け持つコーディングエージェント)の共通ガイド。リポジトリの事実(構成・コマンド・規約)はここに書き、Claude Code 固有の指示は `CLAUDE.md` に書く。同じことを2か所に書かない。

## プロジェクト

- 絶対パス: `/Volumes/SSD/project/imageeditor`(Orca の worktree では `/Users/bigsunny/orca/workspaces/imageeditor/<worktree名>`)
- スタック: React 19 + TypeScript + Vite 8 + Tailwind CSS v4 / デプロイ先は Cloudflare Workers(静的アセット、`wrangler.jsonc`)

## 構成

```
src/
  main.tsx          エントリ
  App.tsx           ページ全体(見出し・フッター)
  ImageEditor.tsx   編集画面(フレーム描画・EXIF 読み取り・UI)
  index.css         Tailwind とテーマ変数
public/             ロゴ・ファビコン
docs/               仕様書(spec-*.md)
wrangler.jsonc      Cloudflare Workers の設定
```

## 役割分担

設計とレビューは Claude Code、実装と修正は実装担当が担当する(`~/.claude/CLAUDE.md` のとおり)。

1. Claude Code が `docs/spec-<機能名>.md` を書く
2. 実装担当が仕様書のとおりに実装し、「確認コマンド」を通す
3. Claude Code が `git diff` を読んでレビューし、指摘を `ファイル:行` / 事象 / 再現条件 / 根拠 の形で返す
4. 実装担当が指摘を直す。2〜4 を繰り返す
5. Claude Code がコミットする

仕様書にない判断が要るときは、実装で決めずに止めて聞く。

## 確認コマンド

実装を終えたら、次をすべて実行して通すこと(2026-11-16 に確認)。Mac では `npm` / `npx` をそのまま、Windows の PowerShell では `npm.cmd` / `npx.cmd` を使う。

```
npm run build   # tsc -b && vite build(2026-11-16 時点で通る)
npm run lint    # eslint(2026-11-16 時点で既存のエラーが1件: ImageEditor.tsx の set-state-in-effect。spec-auto-retouch で解消する)
```

## 守ること

- コミット・push・デプロイはしない(レビュー後に Claude Code が行う)
- ファイルは UTF-8 のまま保つ。ソース編集は `apply_patch` を優先する
- 依存の追加が要るときは、実装を止めて聞く
- 画像をサーバーに送る処理を入れない(すべてブラウザ内で処理する)
- 有料化を予定している機能は、必ず `src/lib/entitlements.ts` の `canUse()` を通す(仕様は `docs/spec-auto-retouch.md`)
