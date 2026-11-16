export type FrameStyle  = 'none' | 'minimal' | 'pro' | 'analog' | 'retro' | 'tech';
export type FramePos    = 'surround' | 'bottom' | 'topbottom' | 'right';

export interface FrameConfig {
  style: FrameStyle; pos: FramePos;
  bgColor: string; accentColor: string; textColor: string; subColor: string;
  mainText: string; subTitle: string; cameraModel: string; lensName: string; shootInfo: string;
  shootDate: string; location: string;
  showCamera: boolean; showLens: boolean; showShootInfo: boolean; showDate: boolean; showLocation: boolean;
}

export interface LogoConfig {
  src: string | null; sizePct: number; opacity: number;
  username: string;
}

type Pad = { top: number; bottom: number; left: number; right: number; };

// ─── Style defaults ───────────────────────────────────────────────────────────
export const STYLE_DEFAULTS: Record<Exclude<FrameStyle,'none'>, Pick<FrameConfig,'bgColor'|'accentColor'|'textColor'|'subColor'>> = {
  minimal: { bgColor:'#1c1c1c', accentColor:'#e03030', textColor:'#ffffff', subColor:'#999999' },
  pro:     { bgColor:'#080808', accentColor:'#FF6900', textColor:'#ffffff', subColor:'#666666' },
  analog:  { bgColor:'#141210', accentColor:'#E8A020', textColor:'#E8A020', subColor:'#665544' },
  retro:   { bgColor:'#f0ece4', accentColor:'#2c2c2c', textColor:'#2c2c2c', subColor:'#888888' },
  tech:    { bgColor:'#0e1218', accentColor:'#00AADD', textColor:'#ffffff', subColor:'#445566' },
};

// ─── Pad calculator ───────────────────────────────────────────────────────────
export function getPad(imgW: number, imgH: number, style: FrameStyle, pos: FramePos): Pad {
  if (style === 'none') return { top:0, bottom:0, left:0, right:0 };
  const sh   = Math.min(imgW, imgH);
  const base = Math.round(sh * 0.04);
  const btmH = style === 'retro' ? Math.round(sh * 0.22) : Math.round(sh * 0.135);
  const topH = Math.round(sh * 0.057);
  switch (pos) {
    case 'surround':  return { top:base, bottom:btmH, left:base,  right:base };
    case 'bottom':    return { top:0,    bottom:btmH, left:0,     right:0    };
    case 'topbottom': return { top:topH, bottom:btmH, left:0,     right:0    };
    case 'right':     return { top:0,    bottom:0,    left:0,     right:btmH };
  }
}

// ─── Canvas utilities ─────────────────────────────────────────────────────────
const SAN   = 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", "Palatino Linotype", serif';
const MONO  = '"Courier New", Consolas, "Lucida Console", monospace';

function roundRectPath(ctx: CanvasRenderingContext2D, x:number,y:number,w:number,h:number,r:number) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

function hairline(ctx: CanvasRenderingContext2D, x:number,y:number,w:number,h:number,color:string,alpha=0.22) {
  const prev = ctx.globalAlpha;
  ctx.strokeStyle=color; ctx.lineWidth=1; ctx.globalAlpha=alpha;
  ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  ctx.globalAlpha=prev;
}

function drawSpaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number): number {
  if (!text) return 0;
  const chars = [...text];
  const widths = chars.map(c => ctx.measureText(c).width);
  const total  = widths.reduce((s,w)=>s+w,0) + Math.max(0, spacing*(chars.length-1));
  let x = cx - total/2;
  ctx.textAlign = 'left';
  chars.forEach((c,i) => { ctx.fillText(c,x,y); x += widths[i]+spacing; });
  return total/2;
}

// ─── Circle logo + username helper ───────────────────────────────────────────
function drawCircleLogo(
  ctx: CanvasRenderingContext2D, li: HTMLImageElement, logo: LogoConfig,
  x: number, yBottom: number, size: number, font: string, textColor: string) {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = logo.opacity / 100;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size/2, yBottom - size/2, size/2, 0, Math.PI*2);
  ctx.clip();
  ctx.drawImage(li, x, yBottom - size, size, size);
  ctx.restore();
  if (logo.username) {
    ctx.globalAlpha = logo.opacity / 100;
    const sz = Math.round(size * 0.50);
    ctx.font = `bold ${sz}px ${font}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(logo.username, x + size + Math.round(size * 0.28), yBottom - size/2);
  }
  ctx.globalAlpha = prev;
}

// ─── Horizontal strip layout (3-column grid) ─────────────────────────────────
interface HResult { cx:number; rowA:number; rowB:number; mainHalfW:number; mainSz:number; leftX:number; rightX:number; }

function drawHContent(ctx: CanvasRenderingContext2D, cfg: FrameConfig,
  stripY: number, stripH: number, totalW: number, ox: number, font: string,
  logoImg?: HTMLImageElement | null, logo?: LogoConfig | null): HResult {
  const hMgn  = ox > 0 ? ox : Math.round(stripH * 0.20);
  const vPad  = Math.round(stripH * 0.16);
  const avH   = stripH - vPad * 2;
  const leftX = hMgn;
  const rightX= totalW - hMgn;
  const cx    = totalW / 2;

  const mainSz    = Math.round(avH * 0.46);
  const subSz     = Math.round(mainSz * 0.50);
  const tinySz    = Math.round(mainSz * 0.40);
  const subTitleSz = Math.round(mainSz * 0.34);

  const slot = avH / 3;
  const s1Y  = stripY + vPad + slot * 0.55;
  const s2Y  = stripY + vPad + slot * 1.55;
  const s3Y  = stripY + vPad + slot * 2.55;

  const rowA = stripY + vPad + avH * 0.50;

  const label = (cfg.mainText || '').toUpperCase();
  ctx.font = `bold ${mainSz}px ${font}`;
  ctx.fillStyle = cfg.textColor;
  ctx.textBaseline = 'alphabetic';
  const mainHalfW = label ? drawSpaced(ctx, label, cx, rowA, mainSz * 0.1) : 0;

  if (cfg.subTitle) {
    ctx.font = `${subTitleSz}px ${font}`; ctx.fillStyle = cfg.subColor;
    ctx.textAlign = 'center';
    ctx.fillText(cfg.subTitle, cx, rowA + mainSz * 0.16 + subTitleSz);
  }

  const dateLocStr = [
    cfg.showDate && cfg.shootDate ? cfg.shootDate : '',
    cfg.showLocation && cfg.location ? `@${cfg.location}` : '',
  ].filter(Boolean).join('  ');
  if (dateLocStr) {
    ctx.font = `${subSz}px ${font}`; ctx.fillStyle = cfg.subColor;
    ctx.textAlign = 'left'; ctx.fillText(dateLocStr, leftX, s1Y);
  }
  if (logoImg && logo) {
    const circleSize = Math.round(tinySz * 2.2 * (logo.sizePct / 55));
    drawCircleLogo(ctx, logoImg, logo, leftX, s3Y, circleSize, font, cfg.subColor);
  }

  if (cfg.showCamera && cfg.cameraModel) {
    ctx.font = `${subSz}px ${font}`; ctx.fillStyle = cfg.subColor;
    ctx.textAlign = 'right'; ctx.fillText(cfg.cameraModel, rightX, s1Y);
  }
  if (cfg.showLens && cfg.lensName) {
    ctx.font = `${tinySz}px ${font}`; ctx.fillStyle = cfg.subColor;
    ctx.textAlign = 'right'; ctx.fillText(cfg.lensName, rightX, s2Y);
  }
  if (cfg.showShootInfo && cfg.shootInfo) {
    const formatted = cfg.shootInfo.split(/\s+/).filter(Boolean).join(' · ');
    ctx.font = `${tinySz}px ${font}`; ctx.fillStyle = cfg.subColor;
    ctx.textAlign = 'right'; ctx.fillText(formatted, rightX, s3Y);
  }

  return { cx, rowA, rowB: s3Y, mainHalfW, mainSz, leftX, rightX };
}

// ─── Vertical strip (right side) with letter-spacing ─────────────────────────
function drawVContent(ctx: CanvasRenderingContext2D, cfg: FrameConfig,
  stripX: number, stripW: number, imgH: number, oy: number, font: string) {
  const mainSz  = Math.round(stripW * 0.27);
  const subSz   = Math.round(mainSz * 0.46);
  const spacing = mainSz * 0.1;

  ctx.save();
  ctx.translate(stripX + stripW/2, oy + imgH/2);
  ctx.rotate(-Math.PI/2);
  ctx.textBaseline = 'middle';

  ctx.font = `bold ${mainSz}px ${font}`;
  ctx.fillStyle = cfg.textColor;
  const mainHalfW = drawSpaced(ctx, (cfg.mainText || 'ORIGINAL').toUpperCase(), 0, 0, spacing);

  const offset = Math.min(mainHalfW + mainSz * 0.55, imgH * 0.3);
  ctx.font = `${subSz}px ${font}`; ctx.fillStyle = cfg.subColor; ctx.textAlign = 'center';
  if (cfg.showDate && cfg.shootDate)         ctx.fillText(cfg.shootDate,           offset, 0);
  if (cfg.showLocation && cfg.location)      ctx.fillText(`@${cfg.location}`,     -offset, 0);
  ctx.restore();
}

// ─── Frame decorators ─────────────────────────────────────────────────────────
function decorateMinimal(ctx: CanvasRenderingContext2D, cfg: FrameConfig,
  ox:number,oy:number,imgW:number,imgH:number,totalW:number,_totalH:number,pad:Pad,
  logoImg?: HTMLImageElement|null, logo?: LogoConfig|null) {
  hairline(ctx,ox,oy,imgW,imgH,cfg.accentColor,.3);

  if (pad.bottom>0) {
    const r = drawHContent(ctx,cfg,oy+imgH,pad.bottom,totalW,ox,SAN,logoImg,logo);

    const dotR = r.mainSz * 0.32;
    const dotX = r.cx - r.mainHalfW - dotR * 2.4;
    const dotY = r.rowA - r.mainSz * 0.38;
    ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI*2);
    ctx.fillStyle = cfg.accentColor; ctx.fill();

    const lineY = r.rowA + r.mainSz * 0.22;
    const lineX1 = dotX - dotR;
    const lineX2 = r.cx + r.mainHalfW;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = 0.2; ctx.strokeStyle = cfg.accentColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lineX1, lineY); ctx.lineTo(lineX2, lineY); ctx.stroke();
    ctx.globalAlpha = prev;
  }

  if (pad.right>0) {
    drawVContent(ctx,cfg,ox+imgW,pad.right,imgH,oy,SAN);
    const dotR = Math.round(pad.right * 0.11);
    ctx.beginPath(); ctx.arc(ox+imgW+pad.right/2, oy+dotR*2.5, dotR, 0, Math.PI*2);
    ctx.fillStyle = cfg.accentColor; ctx.fill();
  }

  if (pad.top>0 && cfg.showShootInfo) {
    const formatted = cfg.shootInfo.split(/\s+/).filter(Boolean).join(' · ');
    if (formatted) {
      ctx.font=`${Math.round(pad.top*.36)}px ${SAN}`; ctx.fillStyle=cfg.subColor;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(formatted, totalW/2, pad.top/2);
    }
  }
}

function decoratePro(ctx: CanvasRenderingContext2D, cfg: FrameConfig,
  ox:number,oy:number,imgW:number,imgH:number,totalW:number,_totalH:number,pad:Pad,
  logoImg?: HTMLImageElement|null, logo?: LogoConfig|null) {
  const mLen = Math.round(Math.min(imgW,imgH)*0.044);
  const mT   = Math.max(2, Math.round(mLen*.1));
  ctx.fillStyle = cfg.accentColor;
  const corners: [number,number,number,number][] = [
    [ox,oy,1,1],[ox+imgW,oy,-1,1],[ox,oy+imgH,1,-1],[ox+imgW,oy+imgH,-1,-1],
  ];
  for (const [cx2,cy2,dx,dy] of corners) {
    ctx.fillRect(cx2,cy2,dx*mLen,mT*dy); ctx.fillRect(cx2,cy2,mT*dx,dy*mLen);
  }

  if (pad.bottom>0) {
    const barH = Math.max(2, Math.round(pad.bottom*.022));
    ctx.fillStyle=cfg.accentColor;
    ctx.fillRect(ox, oy+imgH+Math.round(pad.bottom*.09), imgW, barH);
    drawHContent(ctx,cfg,oy+imgH,pad.bottom,totalW,ox,SAN,logoImg,logo);
  }
  if (pad.right>0) {
    const barW = Math.max(2, Math.round(pad.right*.022));
    ctx.fillStyle=cfg.accentColor;
    ctx.fillRect(ox+imgW+Math.round(pad.right*.09), oy, barW, imgH);
    drawVContent(ctx,cfg,ox+imgW,pad.right,imgH,oy,SAN);
  }
  if (pad.top>0) {
    const barH = Math.max(2, Math.round(pad.top*.022));
    ctx.fillStyle=cfg.accentColor;
    ctx.fillRect(ox, oy+pad.top-barH, imgW, barH);
  }
}

function decorateAnalog(ctx: CanvasRenderingContext2D, cfg: FrameConfig,
  ox:number,oy:number,imgW:number,imgH:number,totalW:number,_totalH:number,pad:Pad,
  logoImg?: HTMLImageElement|null, logo?: LogoConfig|null) {
  const drawPerfs=(baseY:number,areaH:number)=>{
    const hH=Math.round(areaH*.58), hW=Math.round(hH*.72), hR=Math.round(hH*.2);
    const gap=Math.round(hW*2.3); let hx=Math.round(gap*.45);
    ctx.fillStyle='#282420';
    while(hx+hW<totalW){roundRectPath(ctx,hx,baseY+Math.round((areaH-hH)/2),hW,hH,hR);ctx.fill();hx+=gap;}
  };
  const vTxt=(text:string,sx:number,sw:number,ht:number,startY:number,dir:number)=>{
    ctx.save(); ctx.translate(sx+sw/2,startY+ht/2); ctx.rotate(dir*-Math.PI/2);
    const sz=Math.round(sw*.48);
    ctx.font=`bold ${sz}px ${SAN}`; ctx.fillStyle=cfg.accentColor;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    drawSpaced(ctx,text.toUpperCase(),0,0,sz*.08);
    ctx.restore();
  };

  if (pad.top>0)    {
    drawPerfs(0,pad.top);
    if (cfg.showDate && cfg.shootDate) {
      ctx.font=`${Math.round(pad.top*.3)}px ${SAN}`; ctx.fillStyle=cfg.accentColor;
      ctx.textAlign='right'; ctx.textBaseline='middle';
      ctx.fillText(cfg.shootDate, totalW-Math.max(ox,pad.top)*.5, pad.top/2);
    }
  }
  if (pad.bottom>0) { drawPerfs(oy+imgH,pad.bottom); }
  if (pad.left>0)   vTxt(cfg.mainText||'ORIGINAL FILM',ox,pad.left,imgH,oy,-1);
  if (pad.right>0)  vTxt(
    (pad.left===0&&pad.bottom===0) ? (cfg.mainText||'ORIGINAL FILM') : (cfg.shootDate||''),
    ox+imgW,pad.right,imgH,oy,1);

  if (pad.bottom>0&&pad.left===0&&pad.right===0) {
    const stripH=pad.bottom, avH=stripH*.74, stripY=oy+imgH;
    const mainSz=Math.round(avH*.52);
    const subSz =Math.round(mainSz*.42);
    ctx.fillStyle=cfg.accentColor; ctx.textBaseline='alphabetic';
    const cx=totalW/2, rowA=stripY+stripH*.44, rowB=stripY+stripH*.76;
    drawSpaced(ctx,(cfg.mainText||'ORIGINAL FILM').toUpperCase(),cx,rowA,mainSz*.09);
    const analogDateLoc = [
      cfg.showDate && cfg.shootDate ? cfg.shootDate : '',
      cfg.showLocation && cfg.location ? `@${cfg.location}` : '',
    ].filter(Boolean).join('  ');
    if (analogDateLoc) {
      ctx.font=`${subSz}px ${SAN}`; ctx.fillStyle=cfg.subColor;
      ctx.textAlign='right'; ctx.fillText(analogDateLoc, totalW-Math.round(stripH*.12), rowB);
    }
    if (logoImg && logo) {
      const circleSize = Math.round(subSz * 1.8 * (logo.sizePct / 55));
      drawCircleLogo(ctx, logoImg, logo, Math.round(stripH*.12), rowB, circleSize, SAN, cfg.accentColor);
    } else if (cfg.showShootInfo && cfg.shootInfo) {
      const fmt=cfg.shootInfo.split(/\s+/).filter(Boolean).join(' · ');
      ctx.font=`${subSz}px ${SAN}`; ctx.fillStyle=cfg.subColor;
      ctx.textAlign='left'; ctx.fillText(fmt,Math.round(stripH*.12),rowB);
    }
  }
}

function decorateRetro(ctx: CanvasRenderingContext2D, cfg: FrameConfig,
  ox:number,oy:number,imgW:number,imgH:number,totalW:number,_totalH:number,pad:Pad,
  logoImg?: HTMLImageElement|null, logo?: LogoConfig|null) {
  hairline(ctx,ox,oy,imgW,imgH,cfg.accentColor,.15);

  if (pad.top>0) {
    const sz = Math.round(pad.top * 0.28);
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = 0.22; ctx.strokeStyle = cfg.accentColor; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox, Math.round(pad.top * 0.25)); ctx.lineTo(ox+imgW, Math.round(pad.top * 0.25));
    ctx.moveTo(ox, Math.round(pad.top * 0.75)); ctx.lineTo(ox+imgW, Math.round(pad.top * 0.75));
    ctx.stroke();
    ctx.globalAlpha = prev;
    if (cfg.showDate && cfg.shootDate) {
      ctx.font=`${sz}px ${SERIF}`; ctx.fillStyle=cfg.subColor;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(cfg.shootDate, totalW/2, pad.top/2);
    }
  }

  if (pad.bottom>0) {
    const stripY = oy+imgH, stripH = pad.bottom;
    const vPad   = Math.round(stripH * 0.14);
    const avH    = stripH - vPad * 2;
    const hMgn   = Math.round(stripH * 0.10);

    const titleSz    = Math.round(avH * 0.44);
    const subSz      = Math.round(titleSz * 0.46);
    const tinySz     = Math.round(titleSz * 0.36);
    const subTitleSz = Math.round(titleSz * 0.30);
    const titleY  = stripY + vPad + avH * 0.42;
    const subRowY = titleY + titleSz * 0.28 + subTitleSz;
    const detailY = stripY + stripH - vPad;

    const main = cfg.mainText || '';
    if (main) {
      ctx.font=`${titleSz}px ${SERIF}`; ctx.fillStyle=cfg.textColor;
      ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      ctx.fillText(main, hMgn, titleY);
      const tw  = ctx.measureText(main).width;
      const lnY = titleY + titleSz * 0.2;
      const prev = ctx.globalAlpha;
      ctx.globalAlpha=.18; ctx.strokeStyle=cfg.accentColor; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(hMgn, lnY); ctx.lineTo(hMgn + tw * 0.9, lnY); ctx.stroke();
      ctx.globalAlpha=prev;
    }
    if (cfg.subTitle) {
      ctx.font=`${subTitleSz}px ${SERIF}`; ctx.fillStyle=cfg.subColor;
      ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      ctx.fillText(cfg.subTitle, hMgn, subRowY);
    }

    const hasCamera = cfg.showCamera && cfg.cameraModel;
    const dateLoc   = [
      cfg.showDate && cfg.shootDate ? cfg.shootDate : '',
      cfg.showLocation && cfg.location ? `@${cfg.location}` : '',
    ].filter(Boolean).join('  ');
    if (hasCamera) {
      ctx.font=`${subSz}px ${SERIF}`; ctx.fillStyle=cfg.subColor;
      ctx.textAlign='right'; ctx.textBaseline='alphabetic';
      ctx.fillText(cfg.cameraModel, totalW-hMgn, titleY);
    }
    if (dateLoc) {
      ctx.font=`${tinySz}px ${SERIF}`; ctx.fillStyle=cfg.subColor;
      ctx.textAlign='right'; ctx.textBaseline='alphabetic';
      ctx.fillText(dateLoc, totalW-hMgn, hasCamera ? subRowY : titleY);
    }

    if (cfg.showShootInfo && cfg.shootInfo) {
      ctx.font=`italic ${tinySz}px ${SERIF}`; ctx.fillStyle=cfg.subColor;
      ctx.textAlign='right'; ctx.textBaseline='alphabetic';
      ctx.fillText(cfg.shootInfo, totalW-hMgn, detailY);
    }
    if (logoImg && logo) {
      const circleSize = Math.round(tinySz * 2.2 * (logo.sizePct / 55));
      drawCircleLogo(ctx, logoImg, logo, hMgn, detailY, circleSize, SERIF, cfg.subColor);
    } else if (cfg.showLens && cfg.lensName) {
      ctx.font=`${tinySz}px ${SERIF}`; ctx.fillStyle=cfg.subColor;
      ctx.textAlign='left'; ctx.textBaseline='alphabetic';
      ctx.fillText(cfg.lensName, hMgn, detailY);
    }
  }

  if (pad.right>0) {
    hairline(ctx,ox,oy,imgW,imgH,cfg.accentColor,.15);
    drawVContent(ctx,cfg,ox+imgW,pad.right,imgH,oy,SERIF);
  }
}

function decorateTech(ctx: CanvasRenderingContext2D, cfg: FrameConfig,
  ox:number,oy:number,imgW:number,imgH:number,totalW:number,_totalH:number,pad:Pad,
  logoImg?: HTMLImageElement|null, logo?: LogoConfig|null) {
  hairline(ctx,ox,oy,imgW,imgH,cfg.accentColor,.2);

  if (pad.bottom>0) {
    const barH = Math.max(1, Math.round(pad.bottom*.018));
    ctx.fillStyle=cfg.accentColor;
    ctx.fillRect(ox, oy+imgH+Math.round(pad.bottom*.08), imgW, barH);

    const r = drawHContent(ctx,cfg,oy+imgH,pad.bottom,totalW,ox,MONO,logoImg,logo);

    const bSz = Math.round(r.mainSz * 0.82);
    ctx.font=`bold ${bSz}px ${SAN}`; ctx.fillStyle=cfg.accentColor; ctx.textBaseline='alphabetic';
    const gap = bSz * 0.35;
    ctx.textAlign='right'; ctx.fillText('‹', r.cx - r.mainHalfW - gap, r.rowA);
    ctx.textAlign='left';  ctx.fillText('›', r.cx + r.mainHalfW + gap * 0.3, r.rowA);
  }

  if (pad.top>0) {
    const barH = Math.max(1, Math.round(pad.top*.018));
    ctx.fillStyle=cfg.accentColor;
    ctx.fillRect(ox, oy+pad.top-barH, imgW, barH);
    if (cfg.showShootInfo) {
      const formatted = cfg.shootInfo.split(/\s+/).filter(Boolean).join(' · ');
      if (formatted) {
        ctx.font=`${Math.round(pad.top*.35)}px ${MONO}`; ctx.fillStyle=cfg.subColor;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(formatted, totalW/2, pad.top/2);
      }
    }
  }

  if (pad.right>0) {
    const barW = Math.max(1, Math.round(pad.right*.018));
    ctx.fillStyle=cfg.accentColor;
    ctx.fillRect(ox+imgW+Math.round(pad.right*.08), oy, barW, imgH);
    drawVContent(ctx,cfg,ox+imgW,pad.right,imgH,oy,MONO);
  }
}

export function renderFrame(ctx: CanvasRenderingContext2D, ox:number,oy:number,
  imgW:number,imgH:number,totalW:number,totalH:number,pad:Pad,cfg:FrameConfig,
  logoImg?: HTMLImageElement|null, logo?: LogoConfig|null) {
  if (cfg.style==='none') return;
  ctx.textBaseline='alphabetic';
  const b=[ctx,cfg,ox,oy,imgW,imgH,totalW,totalH,pad] as const;
  switch (cfg.style) {
    case 'minimal': decorateMinimal(...b,logoImg,logo); break;
    case 'pro':     decoratePro(...b,logoImg,logo);     break;
    case 'analog':  decorateAnalog(...b,logoImg,logo);  break;
    case 'retro':   decorateRetro(...b,logoImg,logo);   break;
    case 'tech':    decorateTech(...b,logoImg,logo);    break;
  }
}

// ─── EXIF helpers ─────────────────────────────────────────────────────────────
export function fmtExp(t: number): string {
  if (t >= 1) return `${t}s`;
  return `1/${Math.round(1/t)}s`;
}
export function fmtF(f: number): string {
  return `f/${Number.isInteger(f)?f:f.toFixed(1)}`;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const today = new Date();
export const todayStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;

export const DEFAULT_FRAME: FrameConfig = {
  style:'none', pos:'bottom', bgColor:'#1c1c1c', accentColor:'#e03030',
  textColor:'#ffffff', subColor:'#999999',
  mainText:'', subTitle:'', cameraModel:'', lensName:'', shootInfo:'', shootDate:todayStr, location:'',
  showCamera:true, showLens:true, showShootInfo:true, showDate:true, showLocation:true,
};
export const DEFAULT_LOGO: LogoConfig = { src:null, sizePct:55, opacity:90, username:'' };

