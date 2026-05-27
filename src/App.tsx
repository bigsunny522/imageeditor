import { ImageEditor } from './ImageEditor'

const SOCIAL_LINKS = [
  {
    href: 'https://x.com/xyzack271',
    label: 'X (Twitter)',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    href: 'https://www.instagram.com/xyzack271/',
    label: 'Instagram',
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  },
  {
    href: 'https://www.youtube.com/@xyzack271',
    label: 'YouTube',
    path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
  {
    href: 'https://www.tiktok.com/@xyzack271',
    label: 'TikTok',
    path: 'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.73z',
  },
  {
    href: 'https://mail.google.com/mail/?view=cm&to=xyzack271@gmail.com',
    label: 'Contact',
    path: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  },
  {
    href: 'https://www.amazon.jp/hz/wishlist/ls/1STJ1FJAUP72F?ref_=wl_share',
    label: 'Amazon Wishlist',
    path: 'M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.7-3.182v.685zm3.186 7.705c-.209.189-.512.201-.745.074-1.052-.872-1.238-1.276-1.814-2.106-1.734 1.768-2.962 2.297-5.209 2.297-2.66 0-4.731-1.641-4.731-4.925 0-2.565 1.391-4.309 3.37-5.164 1.715-.754 4.11-.891 5.942-1.099v-.41c0-.753.06-1.642-.383-2.294-.385-.579-1.124-.819-1.775-.819-1.205 0-2.277.618-2.54 1.897-.054.285-.261.567-.548.582l-3.061-.33c-.259-.056-.548-.266-.472-.661C5.577 2.772 8.277 2 10.688 2c1.234 0 2.847.328 3.822 1.265C15.733 4.51 15.625 6.22 15.625 8v4.449c0 1.337.555 1.925 1.078 2.648.183.259.224.569-.01.762l-1.549 1.336zm3.606 3.87C18.516 23.38 14.671 24 11.337 24 7.145 24 3.37 22.531 0 19.996c-.277-.224-.03-.531.303-.357 3.582 2.09 7.998 3.347 12.572 3.347 3.084 0 6.478-.639 9.604-1.964.471-.198.868.309.271.643zm.925-2.803c-.381-.49-2.516-.23-3.474-.117-.291.036-.335-.218-.073-.402 1.701-1.196 4.49-.851 4.814-.45.325.4-.085 3.2-1.681 4.537-.244.205-.478.096-.369-.173.359-.897 1.164-2.903.783-3.395z',
  },
] as const

const NAV_LINKS = [
  { href: 'https://xyzack271.com/reviews', label: 'Reviews' },
  { href: 'https://xyzack271.com/gear', label: 'Gear' },
  { href: 'https://xyzack271.com/about', label: 'About' },
  { href: 'https://xyzack271.com/privacy-policy', label: 'プライバシーポリシー' },
] as const

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

      <footer className="relative mt-auto border-t border-primary/10 bg-blue-50 dark:bg-[#0B1120] pt-12 pb-8">
        <div className="container mx-auto flex flex-col items-center gap-6 px-4">

          <a
            href="https://xyzack271.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 group"
          >
            <img src="/logo.svg" alt="ざっくらぼ" className="h-8 w-auto" />
            <span className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
              ざっくらぼ
            </span>
          </a>

          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-foreground/80">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                {label}
              </a>
            ))}
          </div>

          <div className="flex gap-4">
            {SOCIAL_LINKS.map(({ href, label, path }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-full hover:bg-secondary"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d={path} />
                </svg>
                <span className="sr-only">{label}</span>
              </a>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-2">
            © {new Date().getFullYear()} ざっくらぼ. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
