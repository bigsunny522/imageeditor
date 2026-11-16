# SNS 向け書き出しとビフォーアフター画像

## 背景

今の保存は「原寸の PNG」だけで、Instagram の 4:5 やストーリーズの 9:16 に合わせるには別のアプリが要る。PNG はファイルが大きく、SNS への投稿に向かない。書き出しの縦横比・サイズ・形式を選べるようにする。

また、補正の前後を並べた「ビフォーアフター画像」を保存できるようにする。SNS に投稿されるとアプリの宣伝になる。将来の有料機能なので `canUse('compare')` を通す。

前提: `docs/spec-auto-retouch.md` と `docs/spec-batch.md` が実装済み。

## 変更対象

触るファイル:

- `src/lib/output.ts`(新規)— 書き出し設定の型と、縦横比・サイズの変換、ビフォーアフター画像の合成
- `src/components/OutputPanel.tsx`(新規)— 書き出し設定の UI
- `src/ImageEditor.tsx` — 書き出しタブの追加、保存・共有を書き出し設定に従わせる、ビフォーアフター保存ボタン
- `src/lib/batch.ts` — 書き出し設定を受け取り、一括処理の出力にも反映する
- `src/components/BatchPanel.tsx` — 書き出し設定を `runBatch` に渡すだけ
- `src/lib/entitlements.ts` — 変更なしで済むはず(`'compare'` は定義済み)

触らないファイル:

- `src/lib/frame.ts` / `src/lib/retouch.ts` / `src/lib/render.ts`
- `src/App.tsx` / `package.json`

## 仕様

### 1. `src/lib/output.ts`

```ts
export type AspectId = 'original' | '1:1' | '4:5' | '9:16' | '16:9' | '3:2';
export type FillMode = 'frame' | 'white' | 'black';
export type SizeId = 'original' | '2048' | '1080';
export type FormatId = 'jpeg' | 'png';
export interface OutputSettings { aspect: AspectId; fill: FillMode; size: SizeId; format: FormatId; }
export const DEFAULT_OUTPUT: OutputSettings; // { aspect:'original', fill:'frame', size:'original', format:'jpeg' }
export function applyOutput(src: HTMLCanvasElement, s: OutputSettings, frameBg: string | null): HTMLCanvasElement;
export function outputMime(s: OutputSettings): string;   // 'image/jpeg' | 'image/png'
export function outputExt(s: OutputSettings): string;    // 'jpg' | 'png'
export const JPEG_QUALITY = 0.92;
export function renderCompare(before: HTMLCanvasElement, after: HTMLCanvasElement): HTMLCanvasElement;
```

`applyOutput`(`src` は `renderComposite` の結果。フレーム込み):

1. 縦横比: `aspect` が `original` 以外なら、`src` 全体が収まる最小のその比率のキャンバスを作り、中央に `src` を置く(切り取らない。余白を足すだけ)。余白の色は `fill`:`frame` なら `frameBg`(フレームなしで `null` のときは白)、`white` は `#ffffff`、`black` は `#000000`
2. サイズ: `size` が `2048` / `1080` なら、長辺がその値になるよう縮小する(元が小さければ拡大しない)。縮小は `imageSmoothingQuality = 'high'`
3. 新しい canvas を返す。`src` は変更しない。途中で作った canvas は解放する

`renderCompare`:

- 2枚を同じ大きさで並べる。横長(幅 ≥ 高さ)の写真は上下に、縦長は左右に並べる
- 背景 `#111111`、2枚の間と外周に、短辺の 2% の余白
- 各画像の左上に、白文字・半透明黒の角丸ラベル「BEFORE」「AFTER」(文字の高さは短辺の 4%、`system-ui` の太字)
- 出来上がりの長辺が 2048px を超える場合は 2048px に縮小する

### 2. `src/components/OutputPanel.tsx`

props: `{ value: OutputSettings; onChange: (v: OutputSettings) => void; hasFrame: boolean }`

1. 「縦横比」: `元のまま / 1:1 / 4:5 / 9:16 / 16:9 / 3:2` を3列のボタンで。`4:5` の下に小さく「Instagram」、`9:16` に「ストーリーズ」と添える
2. 縦横比が `original` 以外のとき「余白の色」: `フレームの背景色 / 白 / 黒`(`hasFrame` が `false` のとき「フレームの背景色」は無効)
3. 「サイズ」: `元のサイズ / 長辺 2048px(SNS 向け) / 長辺 1080px`
4. 「形式」: `JPEG(おすすめ) / PNG`。説明文「PNG は画質が落ちませんが、ファイルが大きくなります」

見た目は既存のフレームタブの「配置」ボタンに合わせる。

### 3. `ImageEditor.tsx` の変更

- タブを `情報 / 補正 / フレーム / ロゴ / 書き出し` の5つにする(`TabId` に `'output'`)。5つで狭いときは文字を小さくしてよいが、折り返さない
- `output` の state(初期値 `DEFAULT_OUTPUT`)。リセットボタンで初期値に戻す
- **保存・共有**: 原寸の `renderComposite` → `applyOutput` → `canvasToBlob(c, outputMime, JPEG_QUALITY)`。ファイル名は `edited_<元の名前>.<outputExt>`。共有の `File` も同じ形式・名前にする
- **プレビュー**: 縦横比の設定もプレビューに反映する(1600px のプレビューに `applyOutput` を `size: 'original'` としてかけて表示)。サイズと形式はプレビューに反映しない
- **ビフォーアフター保存**: 保存ボタンの並びに、lucide の `Columns2` アイコンのボタン(title「ビフォーアフター画像を保存」)を足す。補正が初期値のときは無効
  - 押すとまず `canUse('compare')`。`false` なら `alert('この機能は有料版で利用できます')`
  - before は `DEFAULT_RETOUCH`、after は今の補正で、どちらも**フレームなし**(`frame.style = 'none'` に差し替えて)`maxEdge: 2048` で `renderComposite` → `renderCompare` → JPEG で保存。ファイル名 `compare_<元の名前>.jpg`

### 4. 一括処理への反映

- `BatchOptions` に `output: OutputSettings` を足し、各写真の `renderComposite` のあとに `applyOutput` をかける。形式・拡張子も `output` に従う
- `BatchPanel` は今の `output` を受け取って渡す。説明文を「フレーム・ロゴ・補正・書き出し設定は、いま画面で設定している内容が使われます」に変える

## 受け入れ条件

- [ ] `npm run build` が通る
- [ ] `npm run lint` がエラー 0 件
- [ ] `src/lib/frame.ts` / `retouch.ts` / `render.ts` に差分がない
- [ ] (Claude Code がブラウザで確認)縦横比 4:5・長辺 1080px・JPEG で保存すると、1080×1350 以下で比率が 4:5 の JPEG になり、写真が切れていない
- [ ] (同上)縦横比を変えるとプレビューにも余白が付く
- [ ] (同上)補正をかけてビフォーアフターを保存すると、BEFORE / AFTER のラベル付きで2枚並んだ JPEG が保存される。補正が初期値のときはボタンが押せない
- [ ] (同上)書き出し設定を 1:1・PNG にして一括処理すると、ZIP の中身が 1:1 の PNG になる
- [ ] (同上)初期設定のまま保存すると、原寸の JPEG になる(以前の PNG から変わる。意図した変更)

## 対象外

- 切り取り(クロップ)・トリミング位置の調整
- ぼかした写真での余白の塗りつぶし(Safari の canvas `filter` の対応状況が読めないため)
- パノラマのカルーセル分割
- ビフォーアフターの境界線をドラッグする比較表示(GIF・動画も含む)
- EXIF を書き出し後の画像に残すこと

## 想定される落とし穴

- **既定の形式が PNG → JPEG に変わる**: 意図した変更。JPEG では透過が失われるが、このアプリの出力は常に背景を塗っているので問題ない
- **プレビューと保存の比率**: プレビュー(1600px)と原寸で、`applyOutput` の結果の縦横比が同じになること。余白の計算で丸めを `Math.round` で揃える
- **ビフォーアフターのフレーム**: フレーム設定の state を書き換えずに、コピーした設定(`{...frame, style:'none'}`)を渡す
- **一括処理のファイル名**: 形式が PNG のときは拡張子を `.png` にする。重複時の連番の処理を壊さない
