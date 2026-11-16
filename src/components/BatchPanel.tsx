import { useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import type { FrameConfig, LogoConfig } from '../lib/frame';
import type { RetouchSettings } from '../lib/retouch';
import { canUse } from '../lib/entitlements';
import { runBatch } from '../lib/batch';
import type { BatchProgress } from '../lib/batch';

interface Props {
  retouch: RetouchSettings;
  frame: FrameConfig;
  logo: LogoConfig;
  logoImg: HTMLImageElement | null;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!on)} aria-pressed={on}
    className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-secondary border border-border/60'}`}>
    <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`}/>
  </button>;
}

export function BatchPanel({ retouch, frame, logo, logoImg }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [auto, setAuto] = useState(true);
  const [exif, setExif] = useState(true);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState<string[]>([]);

  const start = async () => {
    if (!canUse('batch')) {
      alert('一括処理は有料版で利用できます');
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setMessage('');
    setFailed([]);
    try {
      const result = await runBatch(files, { retouch, frame, logo, logoImg, autoPerPhoto: auto, useExifPerPhoto: exif }, setProgress, abort.signal);
      const url = URL.createObjectURL(result.zip);
      const date = new Date();
      const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `edited_photos_${stamp}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`${files.length - result.failed.length} 枚を保存しました`);
      setFailed(result.failed);
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'AbortError' ? '中止しました' : '処理に失敗しました');
    } finally {
      controller.current = null;
      setRunning(false);
      setProgress(null);
    }
  };

  return <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-5 space-y-3"
    onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!running) setFiles(Array.from(e.dataTransfer.files)); }}>
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Layers size={13} className="text-primary"/> 一括処理</p>
    <button disabled={running} onClick={() => input.current?.click()} className="w-full py-3 rounded-xl border border-dashed border-border/60 text-sm disabled:opacity-40">写真をまとめて選択</button>
    <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={e => { setFiles(Array.from(e.target.files || [])); e.target.value = ''; }}/>
    {files.length > 0 && <div className="text-xs text-muted-foreground space-y-1">
      <div className="flex justify-between"><span>{files.length} 枚</span><button disabled={running} onClick={() => setFiles([])}>クリア</button></div>
      {files.slice(0, 5).map((file, i) => <p key={i}>{file.name}</p>)}
      {files.length > 5 && <p>ほか {files.length - 5} 枚</p>}
    </div>}
    <div className="flex justify-between items-center text-sm"><div>写真ごとに自動補正<p className="text-xs text-muted-foreground">プリセットは現在の設定を使います</p></div><Toggle on={auto} onChange={setAuto}/></div>
    <div className="flex justify-between items-center text-sm"><span>撮影情報を各写真の EXIF から入れる</span><Toggle on={exif} onChange={setExif}/></div>
    <p className="text-xs text-muted-foreground">フレーム・ロゴ・補正は、いま画面で設定している内容が使われます</p>
    <button disabled={running || files.length === 0} onClick={start} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40">{files.length} 枚を処理して ZIP で保存</button>
    {running && progress && <div className="space-y-2 text-xs"><progress className="w-full accent-primary" value={progress.done} max={progress.total}/><p>{progress.done} / {progress.total} 枚目: {progress.currentName}</p><button onClick={() => controller.current?.abort()}>中止</button></div>}
    {message && <p className="text-sm" role="status">{message}</p>}
    {failed.length > 0 && <p className="text-xs text-muted-foreground">処理できなかった写真: {failed.join('、')}</p>}
  </div>;
}
