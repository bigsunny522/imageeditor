import { Wand2 } from 'lucide-react';
import { DEFAULT_RETOUCH, PRESETS } from '../lib/retouch';
import type { Adjustments, RetouchSettings } from '../lib/retouch';

const sliders: [keyof Omit<Adjustments, 'blackPoint' | 'whitePoint'>, string][] = [
  ['exposure', '露出'], ['contrast', 'コントラスト'], ['highlights', 'ハイライト'],
  ['shadows', 'シャドウ'], ['saturation', '彩度'], ['temperature', '色温度'], ['tint', '色かぶり'],
];

export function RetouchPanel({ value, onChange, onAuto, disabled }: {
  value: RetouchSettings;
  onChange: (value: RetouchSettings) => void;
  onAuto: () => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-5">
      <button onClick={onAuto} disabled={disabled}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40">
        <Wand2 size={16}/> 自動補正
      </button>
      <div>
        <p className="text-xs text-muted-foreground mb-1">プリセット</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map(preset => (
            <button key={preset.id} onClick={() => onChange({ ...value, preset: preset.id })}
              className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${value.preset === preset.id ? 'bg-primary/15 border-primary/50 text-primary' : 'bg-secondary/50 border-border/50 text-muted-foreground hover:border-primary/30'}`}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      {value.preset !== 'none' && (
        <label className="block text-xs text-muted-foreground">
          強さ: {value.presetStrength}%
          <input className="w-full accent-primary" type="range" min={0} max={100} value={value.presetStrength}
            onChange={e => onChange({ ...value, presetStrength: +e.target.value })}/>
        </label>
      )}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">調整</p>
        {sliders.map(([key, label]) => (
          <label key={key} className="block text-xs text-muted-foreground">
            <span className="flex justify-between" onDoubleClick={() => onChange({ ...value, adjust: { ...value.adjust, [key]: 0 } })}>
              <span>{label}</span><span>{value.adjust[key] > 0 ? '+' : ''}{value.adjust[key]}</span>
            </span>
            <input className="w-full accent-primary" type="range" min={-100} max={100} step={1} value={value.adjust[key]}
              onChange={e => onChange({ ...value, adjust: { ...value.adjust, [key]: +e.target.value } })}/>
          </label>
        ))}
      </div>
      <button onClick={() => onChange(DEFAULT_RETOUCH)}
        className="w-full py-2.5 rounded-xl border border-border/50 bg-secondary/50 text-sm font-bold">
        補正をリセット
      </button>
    </div>
  );
}
