import type { OutputSettings, AspectId, FillMode, SizeId, FormatId } from '../lib/output';

interface Props { value: OutputSettings; onChange: (value: OutputSettings) => void; hasFrame: boolean; }

export function OutputPanel({ value, onChange, hasFrame }: Props) {
  const button = (selected: boolean) => `rounded-lg border px-2 py-2 text-xs transition-colors disabled:opacity-40 ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 bg-secondary/50'}`;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground mb-2">縦横比</p>
        <div className="grid grid-cols-3 gap-2">
          {(['original', '1:1', '4:5', '9:16', '16:9', '3:2'] as AspectId[]).map(aspect => (
            <button key={aspect} className={button(value.aspect === aspect)} onClick={() => onChange({ ...value, aspect })}>
              {aspect === 'original' ? '元のまま' : aspect}
              {aspect === '4:5' && <span className="block text-[10px]">Instagram</span>}
              {aspect === '9:16' && <span className="block text-[10px]">ストーリーズ</span>}
            </button>
          ))}
        </div>
      </div>
      {value.aspect !== 'original' && <div>
        <p className="text-xs text-muted-foreground mb-2">余白の色</p>
        <div className="grid grid-cols-3 gap-2">
          {([['frame', 'フレームの背景色'], ['white', '白'], ['black', '黒']] as [FillMode, string][]).map(([fill, label]) => (
            <button key={fill} disabled={fill === 'frame' && !hasFrame} className={button(value.fill === fill)} onClick={() => onChange({ ...value, fill })}>{label}</button>
          ))}
        </div>
      </div>}
      <div>
        <p className="text-xs text-muted-foreground mb-2">サイズ</p>
        <div className="grid gap-2">
          {([['original', '元のサイズ'], ['2048', '長辺 2048px（SNS 向け）'], ['1080', '長辺 1080px']] as [SizeId, string][]).map(([size, label]) => (
            <button key={size} className={button(value.size === size)} onClick={() => onChange({ ...value, size })}>{label}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">形式</p>
        <div className="grid grid-cols-2 gap-2">
          {([['jpeg', 'JPEG（おすすめ）'], ['png', 'PNG']] as [FormatId, string][]).map(([format, label]) => (
            <button key={format} className={button(value.format === format)} onClick={() => onChange({ ...value, format })}>{label}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">PNG は画質が落ちませんが、ファイルが大きくなります</p>
      </div>
    </div>
  );
}
