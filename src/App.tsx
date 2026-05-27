import { ImageEditor } from './ImageEditor'

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex-1 container mx-auto px-4 py-16 max-w-7xl">
        <div className="mb-10 text-center space-y-3">
          <h1 className="text-[clamp(2rem,5vw,3rem)] font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
            Image Editor
          </h1>
          <p className="text-muted-foreground text-sm">
            画像をアップロードして透かし・フレームを追加できます。すべてブラウザ内で処理されます。
          </p>
        </div>
        <ImageEditor />
      </div>

      <footer className="border-t border-border/30 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-5 max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <a
            href="https://xyzack271.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 group"
          >
            <span className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center text-[10px] font-black text-black select-none">
              Z
            </span>
            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
              ざっくらぼ
            </span>
            <span className="text-xs text-muted-foreground/60 font-mono">/ Zack Lab</span>
          </a>
          <p className="text-xs text-muted-foreground/50 text-center sm:text-right">
            このツールは{' '}
            <a
              href="https://xyzack271.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/70 hover:text-primary transition-colors underline underline-offset-2"
            >
              ざっくらぼ
            </a>
            {' '}が制作しました
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
