# 一括処理

## 背景

旅行などで撮った複数の写真に、同じフレームと補正をまとめてかけたい。今は1枚ずつ読み込んで保存するしかない。将来の有料機能(無料版は3枚まで)にする予定なので、開始時に `canUse('batch')` を通す。

前提: `docs/spec-auto-retouch.md` が実装済み(`src/lib/render.ts` / `retouch.ts` / `frame.ts` / `entitlements.ts` がある)。

## 変更対象

触るファイル:

- `src/lib/exif.ts`(新規)— `ImageEditor.tsx` の `loadImg` にある EXIF 読み取り部分を関数として切り出す
- `src/lib/batch.ts`(新規)— 一括処理の本体
- `src/components/BatchPanel.tsx`(新規)— 一括処理の UI
- `src/ImageEditor.tsx` — EXIF 読み取りを `exif.ts` に置き換え、`BatchPanel` を配置する
- `package.json` / `package-lock.json` — `fflate` の追加(**Claude Code が先に `npm install fflate` 済み。実装担当は触らない**)

触らないファイル:

- `src/lib/frame.ts` / `src/lib/retouch.ts` / `src/lib/render.ts` — 一括処理側から呼ぶだけ。変更が必要になったら止めて聞く
- `src/App.tsx`

## 仕様

### 1. `src/lib/exif.ts`

```ts
export type ExifFields = Partial<Pick<FrameConfig, 'cameraModel' | 'lensName' | 'shootInfo' | 'shootDate'>>;
export async function readExif(file: File): Promise<ExifFields>;
```

- 今の `loadImg` の処理(JPEG / TIFF のときだけ `exifr` を動的 import、`fmtF` / `fmtExp`、メーカー名の重複除去、日付整形)をそのまま移す
- 取れなかった項目はキーごと含めない。EXIF がない・読めないときは `{}` を返す(例外を投げない)
- `shootDate` は `DateTimeOriginal` が取れたときだけ入れる(今の `todayStr` へのフォールバックは呼び出し側でやる)
- `ImageEditor.tsx` の `loadImg` は `readExif` を使う形にする。単体の写真の動作は変えない

### 2. `src/lib/batch.ts`

```ts
export interface BatchOptions {
  retouch: RetouchSettings;
  autoPerPhoto: boolean;   // true: 写真ごとに analyzeAuto した adjust を使う(プリセットと強さは retouch のもの)
  frame: FrameConfig;      // 共通のフレーム設定
  useExifPerPhoto: boolean;// true: cameraModel / lensName / shootInfo / shootDate を写真ごとの EXIF で上書き
  logoImg: HTMLImageElement | null;
  logo: LogoConfig;
}
export interface BatchProgress { done: number; total: number; currentName: string; }
export async function runBatch(
  files: File[], opts: BatchOptions,
  onProgress: (p: BatchProgress) => void, signal: AbortSignal,
): Promise<{ zip: Blob; failed: string[] }>;
```

- 1枚ずつ順番に処理する(並列にしない。メモリのため)
- 各写真: `URL.createObjectURL` → `loadImage` → (`autoPerPhoto` なら長辺 512px に縮小して `analyzeAuto`)→ 新しい canvas に原寸で `renderComposite` → `canvasToBlob(c, 'image/jpeg', 0.92)` → canvas 解放・`revokeObjectURL`
- `useExifPerPhoto` のとき、`readExif` で取れた項目だけ上書きする。取れなかった項目は共通設定の値のまま
- ファイル名: `edited_<元の名前の拡張子を除いた部分>.jpg`。同じ名前が重なったら `_2`, `_3` を付ける
- ZIP は `fflate` の `zipSync` で作る。JPEG は圧縮済みなので `level: 0`。ZIP 名は呼び出し側で `edited_photos_YYYYMMDD.zip`
- 1枚ごとに `onProgress` を呼ぶ。各写真の処理の前に `signal.aborted` を確かめ、中止なら `DOMException('Aborted', 'AbortError')` を投げる
- 読み込みや描画に失敗した写真は飛ばして `failed` にファイル名を入れ、残りを続ける
- 画像でないファイル(`type` が `image/` で始まらない)は `failed` に入れて飛ばす

### 3. `src/components/BatchPanel.tsx`

置き場所: アップロード欄のカード(`画像をアップロード`)のすぐ下に、別のカードとして置く。見出しは「一括処理」(lucide の `Layers` アイコン)。

props: 今の `retouch` / `frame` / `logo` / `logoImg` を受け取る。

画面:

1. 「写真をまとめて選択」ボタン(`<input type="file" accept="image/*" multiple>` を開く)。ドラッグ&ドロップでも複数枚を受け付ける
2. 選んだ写真の枚数と、ファイル名の一覧(最大5件表示、それ以上は「ほか N 枚」)。「クリア」ボタン
3. オプション(既存の `Toggle` と同じ見た目のトグル):
   - 「写真ごとに自動補正」(既定オン)— 説明文「プリセットは現在の設定を使います」
   - 「撮影情報を各写真の EXIF から入れる」(既定オン)
4. 説明文: 「フレーム・ロゴ・補正は、いま画面で設定している内容が使われます」
5. 「N 枚を処理して ZIP で保存」ボタン(primary)。押すとまず `canUse('batch')`。`false` なら `alert('一括処理は有料版で利用できます')` で終了
6. 処理中: 進捗バー、「3 / 20 枚目: IMG_0123.JPG」、「中止」ボタン。処理中は開始ボタンを無効化する
7. 完了: ZIP を自動でダウンロードし、「20 枚を保存しました」。`failed` があれば「処理できなかった写真: …」を表示
8. 中止: 「中止しました」と表示し、ZIP は作らない

## 受け入れ条件

- [ ] `npm run build` が通る
- [ ] `npm run lint` がエラー 0 件
- [ ] `src/lib/frame.ts` / `retouch.ts` / `render.ts` に差分がない
- [ ] (Claude Code がブラウザで確認)JPEG を3枚選んで処理すると、3枚入りの ZIP がダウンロードされ、各画像にフレームと補正がかかり、撮影情報がそれぞれの EXIF の値になっている
- [ ] (同上)処理中に「中止」を押すと止まり、ZIP は保存されない
- [ ] (同上)画像でないファイルを混ぜると、そのファイルだけ「処理できなかった写真」に出て、残りは保存される
- [ ] (同上)単体の写真の読み込み時に、今まで通り EXIF が入る

## 対象外

- 無料版の枚数制限(3枚)の実際の適用。今は `canUse` が常に `true`
- 写真ごとに個別の設定を変える機能、処理後のプレビュー一覧
- Web Worker での並列処理
- 書き出し形式・縦横比の選択(`docs/spec-sns-output.md` で一括処理にも反映する)
- iOS で ZIP を「写真」アプリに直接保存すること

## 想定される落とし穴

- **メモリ**: 24MP の写真 20 枚を同時に持つと落ちる。canvas と ObjectURL は1枚ごとに必ず解放する。出来上がった JPEG の `Uint8Array` だけを溜める
- **`zipSync` の入力**: `Blob` ではなく `Uint8Array` が必要(`new Uint8Array(await blob.arrayBuffer())`)
- **同じファイル名**: iPhone の写真は `IMG_0001.JPG` が別フォルダで重なることがある。重複時の連番を忘れない
- **EXIF の日付**: `readExif` は今日の日付で埋めない。一括処理で EXIF がない写真は共通設定の日付になる
- **単体の動作を壊さない**: `loadImg` を `readExif` に置き換えたあとも、EXIF の各項目の書式が変わっていないこと
