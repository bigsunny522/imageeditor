# スマホでのメモリ不足対策

## 背景

スマホの Chrome で写真を読み込み、「自動補正」を押すとタブが落ちる(オーナーの報告、2026-11-18)。

デスクトップの Chrome で 48MP(8000×6000)の JPEG を試すと、自動補正は 0.1 秒、JS ヒープは 5MB 前後で問題は出なかった。落ちる原因は JS ヒープではなく、**画像のデコード結果と canvas のメモリ**だと見ている(実機での原因の切り分けは未確認)。今の実装には次のメモリの使い方がある:

1. 読み込んだ原寸の `HTMLImageElement` を state に持ち続け、プレビュー・自動補正・ビフォーアフターのたびに原寸画像から `drawImage` している。48MP なら、デコード結果だけで約 192MB ある。スマホの Chrome はこれを捨てては再デコードし、GPU にも載せる
2. 画像を data URL(base64 文字列)で読んでいる
3. `getImageData` を、`willReadFrequently` を指定していない canvas に対して呼んでいる。Android の Chrome では GPU から読み戻すたびに大きな一時メモリを使う
4. 保存時の処理(`renderComposite` + `applyOutput`)は、原寸の canvas と `ImageData` を同時に何枚も持つ。48MP で 192MB × 3〜4 になる。保存でも落ちる可能性が高い

スマホでも 48MP 程度の写真を編集・保存できるように、メモリの使い方を変える。

前提: `docs/spec-auto-retouch.md` / `spec-batch.md` / `spec-sns-output.md` は実装済み。

## 変更対象

触るファイル:

- `src/lib/render.ts`
- `src/lib/output.ts`
- `src/ImageEditor.tsx`
- `src/lib/batch.ts`

触らないファイル:

- `src/lib/retouch.ts`(`applyRetouch` / `analyzeAuto` の計算式は変えない)
- `src/lib/frame.ts` / `src/lib/exif.ts` / `src/lib/entitlements.ts`
- `src/components/**` / `package.json`

## 仕様

### 1. 編集中は縮小画像だけを持つ(`ImageEditor.tsx`・`render.ts`)

- `render.ts` に次の関数を足す:
  ```ts
  /** file をデコードし、長辺 maxEdge 以下に縮小した canvas を返す。元のサイズも返す */
  export async function loadScaled(file: Blob, maxEdge: number): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }>;
  ```
  - `URL.createObjectURL(file)` → `loadImage` → 縮小した canvas に `drawImage`(`imageSmoothingQuality = 'high'`)→ `revokeObjectURL`。原寸の `HTMLImageElement` は関数の中だけで使い、返さない
  - `width` / `height` は原寸の大きさ(情報タブの表示用)
- `RenderInput.img` の型を `CanvasImageSource & { width: number; height: number }` に広げ、`HTMLCanvasElement` も渡せるようにする
- `ImageEditor.tsx`:
  - 読み込み時は `loadScaled(file, 2048)` だけを呼び、結果の canvas を `image` の state に持つ(原寸の `HTMLImageElement` は持たない)
  - `File` 自体は `useRef` で持つ(保存時に原寸をデコードし直すため)
  - **data URL はやめる。** `imageSrc` が「画像が読み込まれているか」の判定にしか使われていないなら、真偽値か `File` の有無で置き換える。表示に URL が要る箇所があれば ObjectURL にし、差し替え時とリセット時に `revokeObjectURL` する
  - プレビュー(`maxEdge: 1600`)・自動補正(長辺 512px に縮小して `analyzeAuto`)・ビフォーアフター(`maxEdge: 2048`)は、すべてこの縮小 canvas から描く
  - 画像を差し替えたとき・リセットしたときは、古い縮小 canvas を `width = height = 0` で解放する
  - **保存・共有**のときだけ、ref の `File` から `loadImage`(ObjectURL 経由)で原寸を読み、`renderComposite` に渡す。使い終わったら `img.src = ''` にし、ObjectURL を revoke する

### 2. `getImageData` を使う canvas に `willReadFrequently`

- `renderComposite` の作業用 canvas、自動補正の解析用 canvas、`batch.ts` の解析用 canvas は、`getContext('2d', { willReadFrequently: true })` で取る

### 3. 補正を帯ごとにかける(`render.ts`)

- `renderComposite` は、`isDefaultRetouch(retouch)` が真なら `getImageData` / `applyRetouch` / `putImageData` を丸ごと飛ばす
- 補正をかけるときは、画像全体を1つの `ImageData` にせず、**高さ 256 行ずつの帯**に分けて `getImageData(0, y, w, bandH)` → `applyRetouch` → `putImageData(…, 0, y)` を繰り返す
  - `applyRetouch` は画素ごとに独立した処理なので、帯に分けても結果は変わらない(`analyzeAuto` は帯に分けない。もともと 512px で呼んでいる)

### 4. 余計な原寸 canvas を作らない(`output.ts`)

- `applyOutput` は、`aspect === 'original'` かつ縮小が不要(`size === 'original'`、または長辺がすでに指定以下)のとき、**`src` をそのまま返す**
- 呼び出し側(`ImageEditor.tsx` のプレビュー・保存、`batch.ts`)は、`result !== source` のときだけ `result` を解放する。同じ canvas を2回解放したり、解放済みの canvas を `toBlob` に渡したりしないこと

### 5. 一括処理(`batch.ts`)

- 1枚ごとの処理は今のまま(1枚ずつ原寸で読み、使い終わったら解放)。§2・§4 の変更に合わせるだけでよい
- 原寸の `HTMLImageElement` は、使い終わったら `img.src = ''` にする

## 受け入れ条件

- [ ] `npm run build` が通る
- [ ] `npm run lint` がエラー 0 件
- [ ] `src/lib/retouch.ts` / `frame.ts` / `exif.ts` / `src/components/**` に差分がない
- [ ] `src/ImageEditor.tsx` に `readAsDataURL`(写真の読み込み用)が残っていない。ロゴの読み込みは今のままでよい
- [ ] (Claude Code がブラウザで確認)48MP の JPEG で、読み込み・自動補正・プリセット・保存・ビフォーアフター保存・一括処理ができる。保存結果は原寸(8000×6000 + フレーム)
- [ ] (同上)補正をかけて保存した画像が、変更前のコミットで保存した画像と見た目で同じ(帯に分けたことで継ぎ目が出ていない)
- [ ] (オーナーがスマホで確認)自動補正を押しても Chrome が落ちない

## 対象外

- 保存時の原寸処理をさらに減らす(タイル単位でのフレーム描画・JPEG エンコードなど)。§1〜4 で足りなければ別の仕様書にする
- Web Worker / OffscreenCanvas への移行
- 書き出しの最大画素数の制限

## 想定される落とし穴

- **`image` の型が変わる**: `HTMLImageElement` 前提で `naturalWidth` などを使っている箇所があれば、`loadScaled` が返す元のサイズに置き換える。情報タブの「幅・高さ」は原寸の値を出す
- **プレビューの拡大率**: 縮小 canvas(長辺 2048)を `maxEdge: 1600` で描くので、プレビューの見た目は今と同じになるはず。フレームの文字サイズなどが原寸基準で計算されていないか確認する(`getPad` が `w, h` から計算していれば問題ない)
- **自動補正の結果**: 解析の元が「原寸から 512px」から「2048px から 512px」に変わる。値がわずかに変わることはあるが、許容する
- **非同期の競合**: 保存の途中で別の写真を読み込んだとき、古い `File` で保存が続いてもよいが、保存後に新しい写真の state を壊さないこと
- **`applyOutput` が `src` を返す場合の解放**: §4 のとおり、呼び出し側で同じ canvas を2回解放しない
