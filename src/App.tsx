import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faXTwitter, faInstagram, faYoutube, faTiktok, faAmazon } from '@fortawesome/free-brands-svg-icons'
import { faEnvelope } from '@fortawesome/free-solid-svg-icons'
import { ImageEditor } from './ImageEditor'

function FaIcon({ icon, className }: { icon: IconDefinition; className?: string }) {
  const [w, h, , , path] = icon.icon
  return (
    <svg viewBox={`0 0 ${w} ${h}`} fill="currentColor" className={className} aria-hidden="true">
      {Array.isArray(path)
        ? path.map((d, i) => <path key={i} d={String(d)} />)
        : <path d={String(path)} />}
    </svg>
  )
}

const SOCIAL_LINKS: { href: string; label: string; icon: IconDefinition }[] = [
  { href: 'https://x.com/xyzack271',                                          label: 'X (Twitter)',     icon: faXTwitter  },
  { href: 'https://www.instagram.com/xyzack271/',                              label: 'Instagram',       icon: faInstagram },
  { href: 'https://www.youtube.com/@xyzack271',                                label: 'YouTube',         icon: faYoutube   },
  { href: 'https://www.tiktok.com/@xyzack271',                                 label: 'TikTok',          icon: faTiktok    },
  { href: 'https://mail.google.com/mail/?view=cm&to=xyzack271@gmail.com',      label: 'Contact',         icon: faEnvelope  },
  { href: 'https://www.amazon.jp/hz/wishlist/ls/1STJ1FJAUP72F?ref_=wl_share', label: 'Amazon Wishlist', icon: faAmazon    },
]

const NAV_LINKS = [
  { href: 'https://xyzack271.com/reviews',        label: 'Reviews'           },
  { href: 'https://xyzack271.com/gear',           label: 'Gear'              },
  { href: 'https://xyzack271.com/about',          label: 'About'             },
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
        {/* Wave divider — matches ざっくらぼ SectionDivider type="curve" position="top" */}
        <div
          className="absolute left-0 top-0 w-full overflow-hidden"
          style={{ height: 64, lineHeight: 0, zIndex: 20, transform: 'translateY(-100%) translateY(1px)' }}
        >
          <svg
            className="relative block h-full fill-blue-50 dark:fill-[#0B1120]"
            style={{ width: 'calc(100% + 1.3px)' }}
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
          >
            <path d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
          </svg>
        </div>

        <div className="container mx-auto flex flex-col items-center gap-6 px-4 relative z-10">
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
              <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                className="hover:text-primary transition-colors">
                {label}
              </a>
            ))}
          </div>

          <div className="flex gap-4">
            {SOCIAL_LINKS.map(({ href, label, icon }) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-full hover:bg-secondary">
                <FaIcon icon={icon} className="w-5 h-5" />
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
