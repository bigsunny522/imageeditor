import { useRef, useState, useEffect } from 'react';
import { DEFAULT_FRAME, DEFAULT_LOGO, STYLE_DEFAULTS, todayStr } from './lib/frame';
import type { FrameConfig, FramePos, FrameStyle, LogoConfig } from './lib/frame';
import { DEFAULT_RETOUCH, isDefaultRetouch, analyzeAuto } from './lib/retouch';
import { RetouchPanel } from './components/RetouchPanel';
import { BatchPanel } from './components/BatchPanel';
import { readExif } from './lib/exif';
import { canUse } from './lib/entitlements';
import { renderComposite, loadImage, canvasToBlob } from './lib/render';
import { Upload, Download, ImageIcon, RotateCcw, Trash2, Share2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type TabId = 'info' | 'retouch' | 'frame' | 'logo';

interface ImageInfo {
  name: string; sizeKb: number; width: number; height: number; type: string;
}

const COLOR_PRESETS = ['#ffffff','#000000','#7BABFF','#f59e0b','#ef4444','#10b981','#8b5cf6','#ec4899','#e03030','#FF6900'];

// ─── Sub-components ───────────────────────────────────────────────────────────
function Lbl({children}: {children:React.ReactNode}) {
  return <label className="text-xs text-muted-foreground mb-1 block">{children}</label>;
}
function Txt({value,onChange,placeholder}: {value:string;onChange:(v:string)=>void;placeholder?:string}) {
  return <input type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/50 text-sm focus:outline-none focus:border-primary/50"/>;
}
function Toggle({on, onChange}: {on:boolean; onChange:(v:boolean)=>void}) {
  return (
    <button onClick={()=>onChange(!on)} aria-pressed={on}
      className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors ${on?'bg-primary':'bg-secondary border border-border/60'}`}>
      <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${on?'translate-x-4':''}`}/>
    </button>
  );
}
function ColorSwatches({colors,openKey,onToggle}: {
  colors:{key:string;label:string;value:string;onChange:(v:string)=>void}[];
  openKey:string|null; onToggle:(key:string)=>void;
}) {
  const active = colors.find(c=>c.key===openKey);
  return (
    <div className="bg-secondary/20 rounded-xl px-3 pt-2 pb-2">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">カラー</p>
      <div className="grid grid-cols-4 gap-2">
        {colors.map(({key,label,value})=>(
          <div key={key} className="flex flex-col items-center gap-1">
            <button onClick={()=>onToggle(key)} title={label}
              className={`w-full h-8 rounded-lg border-2 transition-all ${openKey===key?'border-primary ring-2 ring-primary/20':'border-border/50 hover:brightness-110'}`}
              style={{background:value}}/>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">{label}</span>
          </div>
        ))}
      </div>
      {active&&(
        <div className="mt-2 pt-2 border-t border-border/20">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {COLOR_PRESETS.map(c=>(
              <button key={c} onClick={()=>active.onChange(c)}
                className={`w-5 h-5 rounded border-2 transition-transform hover:scale-110 ${active.value===c?'border-primary scale-110':'border-transparent'}`}
                style={{backgroundColor:c}}/>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={active.value} onChange={e=>active.onChange(e.target.value)}
              className="w-7 h-7 rounded border border-border/50 cursor-pointer bg-transparent"/>
            <span className="text-xs font-mono text-muted-foreground">{active.value}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function ImageEditor() {
  const loadSequence = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const logoRef   = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string|null>(null);
  const [imgInfo,  setImgInfo]  = useState<ImageInfo|null>(null);
  const [frame,    setFrame]    = useState<FrameConfig>(DEFAULT_FRAME);
  const [logo,     setLogo]     = useState<LogoConfig>(DEFAULT_LOGO);
  const [dragging,      setDragging]      = useState(false);
  const [logoDragging,  setLogoDragging]  = useState(false);
  const [tab,           setTab]           = useState<TabId>('info');
  const [exifLoading,   setExifLoading]   = useState(false);
  const [openColor,     setOpenColor]     = useState<string|null>(null);
  const [comparing, setComparing] = useState(false);
  const [retouch, setRetouch] = useState(DEFAULT_RETOUCH);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const shareSupported = typeof navigator !== 'undefined' && 'share' in navigator;

  useEffect(() => {
    let active = true;
    if (logo.src) {
      loadImage(logo.src).then(img => { if (active) setLogoImage(img); });
    }
    return () => { active = false; };
  }, [logo.src]);

  useEffect(() => {
    if (!imageSrc || !image || !canvasRef.current) return;
    const id = requestAnimationFrame(() => {
      if (canvasRef.current) renderComposite(canvasRef.current, {
        img: image, retouch: comparing ? DEFAULT_RETOUCH : retouch, frame, logoImg: logo.src ? logoImage : null, logo, maxEdge: 1600,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [imageSrc, image, retouch, frame, logo, logoImage, comparing]);

  // ── File handler with EXIF ──────────────────────────────────────────────────
  const loadImg = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const sequence = ++loadSequence.current;

    if (file.type === 'image/jpeg' || file.type === 'image/tiff') {
      setExifLoading(true);
      const fields = await readExif(file);
      if (sequence !== loadSequence.current) return;
      if (Object.keys(fields).length) {
        setFrame(f => ({ ...f, ...fields, shootDate: fields.shootDate ?? todayStr }));
      }
      if (sequence !== loadSequence.current) return;
      setExifLoading(false);
    }

    const r = new FileReader();
    r.onload = e => {
      const src = e.target?.result as string;
      loadImage(src).then(i => {
        if (sequence !== loadSequence.current) return;
        setImage(i);
        setImageSrc(src);
        setImgInfo({ name:file.name, sizeKb:Math.round(file.size/1024), width:i.width, height:i.height, type:file.type });
      });
    };
    r.readAsDataURL(file);
    setTab('info');
  };

  const loadLogo = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const r = new FileReader();
    r.onload = e => setLogo(l=>({...l,src:e.target?.result as string}));
    r.readAsDataURL(file);
  };

  const makeBlob = async () => {
    if (!image) return null;
    if (!isDefaultRetouch(retouch) && !canUse('retouch')) {
      alert('この機能は有料版で利用できます');
      return null;
    }
    const canvas = document.createElement('canvas');
    try {
      renderComposite(canvas, { img: image, retouch, frame, logoImg: logo.src ? logoImage : null, logo });
      return await canvasToBlob(canvas, 'image/png');
    } finally {
      canvas.width = canvas.height = 0;
    }
  };

  const download = async () => {
    const blob = await makeBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = imgInfo ? `edited_${imgInfo.name.replace(/\.[^.]+$/,'.png')}` : 'edited.png';
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareToSNS = async () => {
    const blob = await makeBlob();
    if (!blob) return;
    const file = new File([blob], 'photo.png', { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else if ('share' in navigator) await navigator.share({ title: 'Photo' });
    } catch { /* cancelled */ }
  };

  const reset = () => {
    loadSequence.current++;
    setExifLoading(false);
    setImage(null);
    setComparing(false);
    setImageSrc(null); setImgInfo(null);
    setFrame(DEFAULT_FRAME); setLogo(DEFAULT_LOGO); setRetouch(DEFAULT_RETOUCH);
    if (fileRef.current) fileRef.current.value='';
    if (logoRef.current) logoRef.current.value='';
  };

  const autoRetouch = () => {
    if (!image) return;
    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const adjust = analyzeAuto(ctx.getImageData(0, 0, canvas.width, canvas.height));
    canvas.width = canvas.height = 0;
    setRetouch(current => ({ ...current, adjust }));
  };

  const setFF  = <K extends keyof FrameConfig>(k:K,v:FrameConfig[K]) => setFrame(f=>({...f,[k]:v}));
  const setLF  = <K extends keyof LogoConfig>(k:K,v:LogoConfig[K])   => setLogo(l=>({...l,[k]:v}));

  const changeStyle = (s:FrameStyle) => {
    if (s==='none') setFrame(f=>({...f,style:'none'}));
    else setFrame(f=>({...f,style:s,...STYLE_DEFAULTS[s]}));
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  const TABS: {id:TabId;label:string}[] = [
    {id:'info',label:'情報'},{id:'retouch',label:'補正'},{id:'frame',label:'フレーム'},{id:'logo',label:'ロゴ'},
  ];

  const STYLES: [FrameStyle,string,string][] = [
    ['none','なし',''],['minimal','ミニマル','border-l-2 border-red-500'],
    ['pro','プロ','border-l-2 border-orange-500'],['analog','アナログ','border-l-2 border-yellow-500'],
    ['retro','レトロ','border-l-2 border-gray-400'],['tech','テック','border-l-2 border-sky-500'],
  ];

  const POSITIONS: [FramePos,string][] = [
    ['surround','全体'],['bottom','下のみ'],['topbottom','上下'],['right','右のみ'],
  ];

  const hasMeta = frame.style!=='none';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(380px,44%)_1fr] gap-5 items-start">
      {/* Controls */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pb-4"
        style={{scrollbarWidth:'thin'}}>
        {/* Upload */}
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <ImageIcon size={13} className="text-primary"/> 画像をアップロード
            {exifLoading && <span className="ml-auto text-primary animate-pulse">EXIF 取得中...</span>}
          </p>
          <div
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${dragging?'border-primary bg-primary/10':'border-border/60 hover:border-primary/50 hover:bg-primary/5'}`}
            onClick={()=>fileRef.current?.click()}
            onDragOver={e=>{e.preventDefault();setDragging(true);}}
            onDragLeave={()=>setDragging(false)}
            onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)loadImg(f);}}
          >
            <Upload size={22} className="mx-auto mb-2 text-muted-foreground"/>
            <p className="text-sm text-muted-foreground">クリック / ドラッグ＆ドロップ</p>
            <p className="text-xs text-muted-foreground/50 mt-1">JPEG の場合 EXIF を自動取得</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)loadImg(f);}}/>
        </div>

        <BatchPanel retouch={retouch} frame={frame} logo={logo} logoImg={logo.src ? logoImage : null}/>

        {/* Tabs */}
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden">
          <div className="flex border-b border-border/50">
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={`flex-1 py-2.5 text-xs font-bold transition-colors ${tab===t.id?'bg-primary/10 text-primary border-b-2 border-primary':'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* 情報 */}
            {tab==='info' && (
              imgInfo ? (
                <dl className="text-sm">
                  {([
                    ['ファイル名',imgInfo.name],
                    ['形式',imgInfo.type.replace('image/','').toUpperCase()],
                    ['解像度',`${imgInfo.width} × ${imgInfo.height} px`],
                    ['サイズ',`${imgInfo.sizeKb} KB`],
                    ['比率',(()=>{const g=(a:number,b:number):number=>b===0?a:g(b,a%b);const d=g(imgInfo.width,imgInfo.height);return `${imgInfo.width/d} : ${imgInfo.height/d}`;})()],
                    ['MP',`${(imgInfo.width*imgInfo.height/1_000_000).toFixed(1)} MP`],
                  ] as [string,string][]).map(([k,v])=>(
                    <div key={k} className="flex justify-between py-2 border-b border-border/30 last:border-0">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-mono font-bold text-xs">{v}</dd>
                    </div>
                  ))}
                  {(frame.cameraModel||frame.lensName||frame.shootInfo)&&(
                    <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <p className="text-xs text-primary font-bold mb-2.5">EXIF 取得済み</p>
                      {frame.cameraModel&&<p className="text-xs text-muted-foreground mb-1">カメラ: {frame.cameraModel}</p>}
                      {frame.lensName&&<p className="text-xs text-muted-foreground mb-1">レンズ: {frame.lensName}</p>}
                      {frame.shootInfo&&<p className="text-xs text-muted-foreground font-mono">{frame.shootInfo}</p>}
                    </div>
                  )}
                </dl>
              ) : <p className="text-sm text-muted-foreground text-center py-8">画像をアップロードすると<br/>情報が表示されます</p>
            )}

            {tab==='retouch' && (
              <RetouchPanel value={retouch} onChange={setRetouch} onAuto={autoRetouch} disabled={!imageSrc}/>
            )}

            {/* フレーム */}
            {tab==='frame' && (
              <div className="space-y-5">
                <div>
                  <Lbl>スタイル</Lbl>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLES.map(([v,label,accent])=>(
                      <button key={v} onClick={()=>changeStyle(v)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${accent} ${frame.style===v?'bg-primary/15 border-primary/50 text-primary':'bg-secondary/50 border-border/50 text-muted-foreground hover:border-primary/30'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {frame.style!=='none'&&(<>
                  <div>
                    <Lbl>配置</Lbl>
                    <div className="grid grid-cols-2 gap-2">
                      {POSITIONS.map(([v,label])=>(
                        <button key={v} onClick={()=>setFF('pos',v)}
                          className={`py-2 rounded-lg text-xs font-bold border transition-colors ${frame.pos===v?'bg-primary/15 border-primary/50 text-primary':'bg-secondary/50 border-border/50 text-muted-foreground hover:border-primary/30'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <ColorSwatches
                    openKey={openColor}
                    onToggle={k=>setOpenColor(o=>o===k?null:k)}
                    colors={[
                      {key:'bg',     label:'背景',   value:frame.bgColor,     onChange:v=>setFF('bgColor',v)},
                      {key:'accent', label:'ACC',    value:frame.accentColor, onChange:v=>setFF('accentColor',v)},
                      {key:'text',   label:'文字',   value:frame.textColor,   onChange:v=>setFF('textColor',v)},
                      {key:'sub',    label:'サブ',   value:frame.subColor,    onChange:v=>setFF('subColor',v)},
                    ]}
                  />

                  <div className="space-y-2.5">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      情報テキスト
                      {exifLoading&&<span className="text-primary animate-pulse text-[10px]">EXIF取得中</span>}
                    </p>
                    <div>
                      <Lbl>{frame.style==='analog'?'フィルム名':frame.style==='retro'?'タイトル':'メインテキスト'}</Lbl>
                      <Txt value={frame.mainText} onChange={v=>setFF('mainText',v)}
                        placeholder={frame.style==='analog'?'ORIGINAL FILM 400':frame.style==='retro'?'思い出のタイトル':'例: My Shot'}/>
                    </div>
                    <div>
                      <Lbl>サブタイトル</Lbl>
                      <Txt value={frame.subTitle} onChange={v=>setFF('subTitle',v)} placeholder="メインの下に小さく表示"/>
                    </div>
                    {frame.style!=='analog'&&(
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Lbl>カメラ機種</Lbl>
                          <Toggle on={frame.showCamera} onChange={v=>setFF('showCamera',v)}/>
                        </div>
                        <Txt value={frame.cameraModel} onChange={v=>setFF('cameraModel',v)} placeholder="SONY α7 IV"/>
                      </div>
                    )}
                    {hasMeta&&(
                      <div className="grid grid-cols-2 gap-2">
                        {frame.style!=='analog'&&(
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <Lbl>レンズ</Lbl>
                              <Toggle on={frame.showLens} onChange={v=>setFF('showLens',v)}/>
                            </div>
                            <Txt value={frame.lensName} onChange={v=>setFF('lensName',v)} placeholder="50mm"/>
                          </div>
                        )}
                        <div className={frame.style==='analog'?'col-span-2':''}>
                          <div className="flex items-center justify-between mb-1">
                            <Lbl>設定値</Lbl>
                            <Toggle on={frame.showShootInfo} onChange={v=>setFF('showShootInfo',v)}/>
                          </div>
                          <Txt value={frame.shootInfo} onChange={v=>setFF('shootInfo',v)} placeholder="f/2 1/250"/>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Lbl>日付</Lbl>
                          <Toggle on={frame.showDate} onChange={v=>setFF('showDate',v)}/>
                        </div>
                        <Txt value={frame.shootDate} onChange={v=>setFF('shootDate',v)} placeholder={todayStr}/>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Lbl>場所</Lbl>
                          <Toggle on={frame.showLocation} onChange={v=>setFF('showLocation',v)}/>
                        </div>
                        <Txt value={frame.location} onChange={v=>setFF('location',v)} placeholder="Tokyo"/>
                      </div>
                    </div>
                  </div>
                </>)}
              </div>
            )}

            {/* ロゴ */}
            {tab==='logo' && (
              <div className="space-y-4">
                {frame.style==='none'&&(
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-600 dark:text-amber-400">
                    フレームスタイルを選択するとロゴを配置できます
                  </div>
                )}

                {logo.src ? (
                  <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl border border-border/50">
                    <img src={logo.src} alt="" className="w-12 h-12 object-contain rounded-lg" style={{background:'repeating-conic-gradient(#80808030 0% 25%,transparent 0% 50%) 0 0/12px 12px'}}/>
                    <span className="text-sm flex-1 text-muted-foreground">ロゴ設定済み</span>
                    <button onClick={()=>{setLogo(l=>({...l,src:null}));if(logoRef.current)logoRef.current.value='';}} className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={13}/></button>
                  </div>
                ) : (
                  <div
                    onClick={()=>logoRef.current?.click()}
                    onDragOver={e=>{e.preventDefault();setLogoDragging(true);}}
                    onDragLeave={()=>setLogoDragging(false)}
                    onDrop={e=>{e.preventDefault();setLogoDragging(false);const f=e.dataTransfer.files[0];if(f)loadLogo(f);}}
                    className={`w-full flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors select-none ${logoDragging?'border-primary bg-primary/10 text-primary':'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary'}`}>
                    <Upload size={18}/>
                    <span className="text-sm font-medium">ロゴをアップロード</span>
                    <span className="text-xs opacity-60">クリック または ドラッグ＆ドロップ</span>
                  </div>
                )}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)loadLogo(f);}}/>

                <div>
                  <Lbl>ユーザー名（ロゴの隣に表示）</Lbl>
                  <Txt value={logo.username} onChange={v=>setLF('username',v)} placeholder="@username"/>
                </div>

                {logo.src&&(<>
                  <div className="p-2.5 bg-secondary/30 rounded-lg text-xs text-muted-foreground/70 flex items-center gap-2">
                    <span className="text-primary">●</span>
                    日付の左下に円形で表示されます
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Lbl>サイズ: {logo.sizePct}%</Lbl><input type="range" min={20} max={90} value={logo.sizePct} onChange={e=>setLF('sizePct',+e.target.value)} className="w-full accent-primary"/></div>
                    <div><Lbl>不透明度: {logo.opacity}%</Lbl><input type="range" min={10} max={100} value={logo.opacity} onChange={e=>setLF('opacity',+e.target.value)} className="w-full accent-primary"/></div>
                  </div>
                </>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-5 min-h-[500px] flex flex-col">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          プレビュー
          {imageSrc && !isDefaultRetouch(retouch) && (
            <button className="ml-auto px-2 py-1 rounded-lg bg-secondary/50 text-xs"
              onPointerDown={() => setComparing(true)} onPointerUp={() => setComparing(false)}
              onPointerLeave={() => setComparing(false)} onPointerCancel={() => setComparing(false)}>
              元画像
            </button>
          )}
          {imageSrc&&(
            <button onClick={()=>{loadSequence.current++;setImage(null);setComparing(false);setImageSrc(null);setImgInfo(null);if(fileRef.current)fileRef.current.value='';}}
              className={`${isDefaultRetouch(retouch) ? 'ml-auto' : ''} p-1.5 rounded-lg hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors`}>
              <Trash2 size={12}/>
            </button>
          )}
        </p>
        {imageSrc ? (
          <div className="flex-1 flex items-center justify-center rounded-xl overflow-auto"
            style={{backgroundImage:'repeating-conic-gradient(#80808018 0% 25%,transparent 0% 50%)',backgroundSize:'16px 16px'}}>
            <canvas ref={canvasRef} className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-xl"/>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 rounded-xl border-2 border-dashed border-border/30">
            <ImageIcon size={48} strokeWidth={1}/>
            <div className="text-center">
              <p className="text-sm font-medium">画像をアップロードしてください</p>
              <p className="text-xs opacity-50 mt-1">JPEG は撮影情報を自動取得します</p>
            </div>
          </div>
        )}
        <div className="flex gap-2 mt-4 pt-4 border-t border-border/30">
          <button onClick={reset} className="flex items-center gap-2 px-3 py-3 rounded-xl border border-border/50 bg-secondary/50 hover:bg-secondary text-sm font-bold transition-colors">
            <RotateCcw size={13}/>
          </button>
          {shareSupported&&(
            <button onClick={shareToSNS} disabled={!imageSrc}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border/50 bg-secondary/50 hover:bg-secondary text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Share2 size={14}/> 共有
            </button>
          )}
          <button onClick={download} disabled={!imageSrc}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={14}/> 保存
          </button>
        </div>
      </div>
    </div>
  );
}
