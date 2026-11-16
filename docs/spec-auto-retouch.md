# 自動レタッチ(補正タブ)

## 背景

今のアプリは、EXIF 入りのフレーム・透かし・ロゴを付けるだけで、写真そのものの補正ができない。ワンタップの自動補正とプリセットを追加し、将来の有料機能の中心にする。今回は全員が使える状態で出すが、後で有料化できるよう、有料化予定の機能は必ず1か所の判定 `canUse()` を通す。

あわせて、後の一括処理(`docs/spec-batch.md`)と SNS 書き出し(`docs/spec-sns-output.md`)が同じ描画処理を使えるよう、`ImageEditor.tsx` に詰まっている描画処理を `src/lib/` に切り出す。

処理はすべてブラウザ内で行う。画像をサーバーに送らない。新しい依存は追加しない。

## 変更対象

触るファイル:

- `src/lib/frame.ts`(新規)— `ImageEditor.tsx` からフレーム描画まわりを**そのまま移す**(型 `FrameStyle` / `FramePos` / `FrameConfig` / `LogoConfig` / `Pad`、`STYLE_DEFAULTS`、`getPad`、`roundRectPath`〜`decorateTech` の描画関数、`renderFrame`、`fmtExp`、`fmtF`、`DEFAULT_FRAME`、`DEFAULT_LOGO`、`todayStr`)。中身のロジックは変えない。外から使うものだけ `export` する
- `src/lib/retouch.ts`(新規)— 補正の型・プリセット・自動解析・画素処理
- `src/lib/render.ts`(新規)— 「画像 → 補正 → フレーム合成」をまとめて canvas に描く関数
- `src/lib/entitlements.ts`(新規)— 有料化用の判定(今は常に許可)
- `src/components/RetouchPanel.tsx`(新規)— 「補正」タブの UI
- `src/ImageEditor.tsx` — 上の切り出し、補正タブの追加、プレビューと書き出しの描画を `render.ts` 経由に変更、既存の lint エラーの解消

触らないファイル:

- `src/App.tsx` / `src/index.css` / `public/**` / `wrangler.jsonc` / `package.json` — 今回は不要

## 仕様

### 1. `src/lib/entitlements.ts`

```ts
export type Feature = 'retouch' | 'batch' | 'compare';
export function canUse(feature: Feature): boolean { return true; }
```

- 今は常に `true` を返す。後でログインと購入状況を見るように差し替える
- 呼び出す場所: 補正が初期値以外のときの「保存」「共有」の直前で `canUse('retouch')`。`false` のときは何もせず `alert('この機能は有料版で利用できます')` を出す(今は到達しない)

### 2. `src/lib/retouch.ts`

#### 型

```ts
export interface Adjustments {
  exposure: number;    // -100..100
  contrast: number;    // -100..100
  highlights: number;  // -100..100
  shadows: number;     // -100..100
  saturation: number;  // -100..100
  temperature: number; // -100..100(+ で暖色)
  tint: number;        // -100..100(+ でマゼンタ)
  blackPoint: number;  // 0..0.2  (UI には出さない。自動補正だけが設定する)
  whitePoint: number;  // 0.8..1  (同上)
}
export type PresetId = 'none' | 'natural' | 'vivid' | 'film' | 'mono' | 'cinema' | 'cool';
export interface PresetDef {
  id: PresetId; label: string;
  adjust: Partial<Omit<Adjustments,'blackPoint'|'whitePoint'>>;
  fade?: number;       // 0..1 黒の持ち上げ量
  mono?: boolean;
  splitShadow?: [number, number, number];    // 影に足す RGB(-1..1)
  splitHighlight?: [number, number, number]; // 明部に足す RGB(-1..1)
}
export interface RetouchSettings {
  adjust: Adjustments;
  preset: PresetId;
  presetStrength: number; // 0..100
}
export const DEFAULT_ADJUST: Adjustments; // 全部 0、blackPoint 0、whitePoint 1
export const DEFAULT_RETOUCH: RetouchSettings; // adjust: DEFAULT_ADJUST, preset 'none', presetStrength 100
export function isDefaultRetouch(s: RetouchSettings): boolean;
export const PRESETS: PresetDef[];
export function analyzeAuto(data: ImageData): Adjustments;
export function applyRetouch(data: ImageData, s: RetouchSettings): void; // data をその場で書き換える
```

#### プリセット(値はこのとおりにする)

| id | label | adjust | その他 |
|---|---|---|---|
| none | なし | — | — |
| natural | ナチュラル | contrast 8, saturation 8, shadows 10 | — |
| vivid | 鮮やか | contrast 18, saturation 35, highlights -10 | — |
| film | フィルム風 | contrast -10, saturation -15, temperature 12 | fade 0.08, splitShadow [0, 0.02, 0.03], splitHighlight [0.03, 0.015, 0] |
| mono | モノクロ | contrast 20 | mono |
| cinema | シネマ | contrast 12, saturation -10 | splitShadow [-0.02, 0.01, 0.04], splitHighlight [0.04, 0.02, -0.02] |
| cool | クール | temperature -18, saturation -5, highlights -8 | — |

ブランドのフィルムシミュレーション名(Fujifilm など)は使わない。

#### 画素処理 `applyRetouch`(この順で、各チャンネルを 0..1 の実数として計算する)

前処理として、実効値を求める。`k = presetStrength / 100`。
- 数値の各項目: `eff[x] = adjust[x] + (preset.adjust[x] ?? 0) * k`
- `fade = (preset.fade ?? 0) * k`、`split* = (preset.split* ?? [0,0,0]) * k`、`monoAmount = preset.mono ? k : 0`

`L(r,g,b) = 0.2126r + 0.7152g + 0.0722b`。1画素ごとに:

1. 色温度・色かぶり: `r *= 1 + 0.2*T`、`b *= 1 - 0.2*T`(`T = temperature/100`)、`g *= 1 - 0.15*M`(`M = tint/100`)
2. レベル: `v = (v - blackPoint) / (whitePoint - blackPoint)`
3. 露出: `v *= 2^(exposure/100)`
4. コントラスト: `v = (v - 0.5) * (1 + contrast/100) + 0.5`
5. シャドウ・ハイライト: 0..1 にクランプしてから `l = L(r,g,b)`、`nl = l + (shadows/100)*0.3*(1-l)^3 + (highlights/100)*0.3*l^3`。`l > 0.001` なら r,g,b に `nl / l` を掛ける
6. 彩度: `l = L(...)`、`v = l + (v - l) * (1 + saturation/100)`
7. スプリットトーン: `l = L(...)`、`v += splitShadow[c] * (1-l) + splitHighlight[c] * l`
8. フェード: `v = v * (1 - fade) + fade`
9. モノクロ: `l = L(...)`、`v = v + (l - v) * monoAmount`
10. 0..1 にクランプし、`Math.round(v*255)` で書き戻す。アルファはそのまま

`isDefaultRetouch(s)` が `true` のときは何もせず返す(速度のため)。

#### 自動補正 `analyzeAuto`(決定的に計算する。乱数は使わない)

すべて 0..1 の値で計算する。

- 輝度ヒストグラム(256 段階)を作り、累積 0.5% の値を `pLow`、99.5% を `pHigh`、10% を `p10`、95% を `p95` とする
- `blackPoint = clamp(pLow, 0, 0.1)`、`whitePoint = clamp(pHigh, 0.85, 1)`
- 輝度が 0.15〜0.9 の画素だけで r,g,b の平均 `mr, mg, mb` を出し、`avg = (mr+mg+mb)/3`(該当画素が 0 なら色温度・色かぶりは 0)
  - `temperature = clamp(round(125 * (mb - mr) / avg), -50, 50)`
  - `tint = clamp(round(333 * (mg - (mr+mb)/2) / avg), -40, 40)`
- レベル適用後の平均輝度 `mL = mean((L - blackPoint)/(whitePoint - blackPoint))`(0..1 にクランプ)
  - `exposure = clamp(round(60 * log2(clamp(mL, 0.35, 0.65) / max(mL, 0.01))), -30, 60)`(平均が 0.35〜0.65 の範囲なら動かさない。白背景の写真などを暗くしすぎないよう、マイナス側は -30 まで。2026-11-16 のブラウザ確認で変更)
- 輝度の標準偏差が 0.18 未満なら `contrast = 15`、それ以外 0
- `p10 < 0.08` なら `shadows = 20`、それ以外 0
- `p95 > 0.97` なら `highlights = -20`、それ以外 0
- `saturation = 0`

### 3. `src/lib/render.ts`

```ts
export interface RenderInput {
  img: HTMLImageElement;           // 読み込み済みの元画像
  retouch: RetouchSettings;
  frame: FrameConfig;
  logoImg: HTMLImageElement | null;
  logo: LogoConfig;
  maxEdge?: number;                // 指定時は画像の長辺をこの値以下に縮小してから処理(拡大はしない)
}
export function renderComposite(target: HTMLCanvasElement, input: RenderInput): void;
export function loadImage(src: string): Promise<HTMLImageElement>;
export function canvasToBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob>;
```

`renderComposite` の処理:

1. 元画像を `maxEdge` に合わせた大きさ(`w`, `h`)の作業用 canvas に描き、`getImageData` → `applyRetouch` → `putImageData`
2. 今の `drawCanvas` と同じ手順で、`target` に背景塗り → 作業用 canvas を `(ox, oy)` に描画 → `renderFrame`(`getPad` には `w`, `h` を渡す)
3. 作業用 canvas は最後に `width = height = 0` にして解放する

ロゴ画像の読み込みは呼び出し側で済ませて `logoImg` に渡す(`renderComposite` は同期関数)。

### 4. `ImageEditor.tsx` の変更

- 切り出した関数・型を `src/lib/frame.ts` から import する
- 元画像の `HTMLImageElement` とロゴの `HTMLImageElement` は、`imageSrc` / `logo.src` が変わったときだけ読み込んで state か ref に持つ。描画のたびに `new Image()` しない
- **プレビュー**: `renderComposite(canvasRef.current, { ..., maxEdge: 1600 })`。補正・フレーム・ロゴの設定が変わったら再描画する。補正スライダーの操作中は重くなるので、`requestAnimationFrame` で1フレームに1回までにまとめる
- **保存・共有**: プレビュー canvas を使わず、新しい canvas に `maxEdge` なし(原寸)で `renderComposite` してから `toBlob` する。形式は今と同じ PNG。終わったら canvas を解放する
- **自動補正の解析**: 元画像を長辺 512px に縮小した ImageData で `analyzeAuto` を呼ぶ
- タブを `情報 / 補正 / フレーム / ロゴ` の4つにする。`TabId` に `'retouch'` を足す
- リセットボタン(`reset`)は補正も `DEFAULT_RETOUCH` に戻す。新しい画像を読み込んだときは補正をリセットしない(同じ補正で別の写真を試せるように)
- 既存の lint エラー(`useEffect` 内の `setShareSupported`)を解消する: state をやめて `const shareSupported = typeof navigator !== 'undefined' && 'share' in navigator;` にする
- **比較表示**: プレビュー右上(今のゴミ箱ボタンの左)に「元画像」ボタンを置く。押している間(`pointerdown`〜`pointerup` / `pointerleave`)だけ、補正なし(`DEFAULT_RETOUCH`)で描いたプレビューを表示する。補正が初期値のときは表示しない

### 5. `src/components/RetouchPanel.tsx`

props: `{ value: RetouchSettings; onChange: (v: RetouchSettings) => void; onAuto: () => void; disabled: boolean }`(`disabled` は画像未読み込みのとき)

上から順に:

1. 「自動補正」ボタン(幅いっぱい、primary 色、lucide の `Wand2` アイコン)。押すと `onAuto`。結果は `adjust` 全体を置き換える(プリセットはそのまま)
2. 「プリセット」: `PRESETS` を3列のボタンで並べる。選択中は既存のスタイル選択ボタンと同じ見た目(`bg-primary/15 border-primary/50 text-primary`)
3. プリセットが `none` 以外のとき「強さ: N%」スライダー(0〜100)
4. 「調整」: 露出・コントラスト・ハイライト・シャドウ・彩度・色温度・色かぶり のスライダー(各 -100〜100、step 1)。ラベルの右に現在値(`+12` / `0` / `-8`)。ラベルか値をダブルクリックするとその項目だけ 0 に戻る
5. 「補正をリセット」ボタン(`DEFAULT_RETOUCH` に戻す)

見た目は既存のフレームタブ(`Lbl`、`accent-primary` のスライダー、`rounded-xl` のボタン)に合わせる。`Lbl` は `ImageEditor.tsx` にあるので、`RetouchPanel.tsx` 内に同じ見た目の小さなラベルを持ってよい。

## 受け入れ条件

- [ ] `npm run build` が通る
- [ ] `npm run lint` がエラー 0 件で通る(既存の `set-state-in-effect` も解消されている)
- [ ] `src/lib/retouch.ts` に `PRESETS` の7件が上の表の値で定義されている
- [ ] `src/lib/frame.ts` に移した描画関数の中身が、移す前の `ImageEditor.tsx` と同じ(`git diff` で移動以外の変更がない)
- [ ] (Claude Code がブラウザで確認)画像を読み込み「補正」タブで「自動補正」を押すと、スライダーの値が変わり、プレビューが変わる
- [ ] (同上)プリセットを切り替えるとプレビューが変わり、「元画像」ボタンを押している間は補正前が表示される
- [ ] (同上)フレームと補正を両方かけて「保存」すると、原寸の PNG が保存され、補正もフレームも反映されている
- [ ] (同上)補正が初期値のとき、保存結果は変更前のアプリと同じ見た目になる

## 対象外

- 一括処理(`docs/spec-batch.md`)、縦横比・形式の書き出し設定とビフォーアフター画像(`docs/spec-sns-output.md`)
- ログイン・決済・実際の機能制限
- Web Worker 化、WebGL / WebGPU での高速化
- トーンカーブ・HSL 個別調整・部分補正・AI による補正
- ノイズ除去・シャープ

## 想定される落とし穴

- **描画関数の移動で見た目が変わる**: 移動だけにし、ついでの整理や名前変更をしない
- **プレビューと保存の食い違い**: プレビューは 1600px に縮小、保存は原寸。補正の計算は解像度に依存しない式にしてあるので、同じ見た目になるはず。フレームの `getPad` は短辺に比例するので、縮小後の `w`, `h` を渡す
- **大きな画像のメモリ**: 24MP 以上の画像では作業用 canvas と ImageData が数百 MB になる。作業用 canvas は使い終わったら必ず解放する。保存時に数秒かかるのは今回は許容する
- **非同期の競合**: 画像を差し替えた直後に古い画像の描画が終わって上書きしないよう、読み込み完了時に `imageSrc` が変わっていないか確かめる
- **`exposure` などの state 更新が多い**: スライダー操作ごとの再描画は `requestAnimationFrame` でまとめる
- **iOS Safari の canvas 上限**: 長辺が非常に大きい画像(約 16MP を超える canvas)は iOS で描画に失敗することがある。今回は対応しないが、既存の動作より悪化させない
