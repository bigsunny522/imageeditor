import { ImageEditor } from './ImageEditor'

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16 max-w-7xl">
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
    </div>
  )
}

export default App
