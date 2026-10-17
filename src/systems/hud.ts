const CSS = `
#hud { font-family: 'Courier New', monospace; }
#hud .cross { position:absolute; left:50%; top:50%; width:4px; height:4px; margin:-2px 0 0 -2px; background:#e8c9a0; opacity:.45; border-radius:50%; }
#hud .prompt { position:absolute; left:0; right:0; bottom:24%; text-align:center; font-size:17px; letter-spacing:1px; text-shadow:0 0 6px #000,0 0 2px #000; }
#hud .sub { position:absolute; left:12%; right:12%; bottom:11%; text-align:center; font-size:19px; font-style:italic; color:#f2e2ca; text-shadow:0 0 10px #000,0 0 3px #000; opacity:0; transition:opacity .6s; }
#hud .sub.show { opacity:1; }
#hud .fuel { position:absolute; left:28px; bottom:28px; width:200px; }
#hud .fuel .label { white-space:nowrap; }
#hud .fuel .label { font-size:11px; letter-spacing:4px; opacity:.7; margin-bottom:5px; }
#hud .fuel .bar { height:6px; background:rgba(255,255,255,.06); border:1px solid rgba(232,201,160,.3); }
#hud .fuel .fill { height:100%; width:100%; background:linear-gradient(90deg,#6a1404,#ff6a14,#ffd27a); }
#hud .fuel.low .fill { animation: hud-pulse .6s infinite alternate; }
@keyframes hud-pulse { from { opacity:1 } to { opacity:.3 } }
#hud .held { position:absolute; right:28px; bottom:28px; text-align:right; font-size:13px; line-height:1.6; opacity:.85; }
#hud .vignette { position:absolute; inset:0; opacity:0; background:radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,.6) 65%, #000 100%); }
#hud .fade { position:absolute; inset:0; background:#000; opacity:0; }
#hud .title { position:absolute; left:0; right:0; top:36%; text-align:center; opacity:0; transition:opacity 1.4s; }
#hud .title.show { opacity:1; }
#hud .title .main { font-size:36px; letter-spacing:12px; color:#ff9a4a; text-shadow:0 0 16px #ff5a0a; }
#hud .title .subt { margin-top:12px; font-size:14px; letter-spacing:6px; opacity:.8; }
#hud .dawn { position:absolute; top:24px; left:50%; width:260px; margin-left:-130px; text-align:center; display:none; }
#hud .dawn.show { display:block; }
#hud .dawn .label { font-size:11px; letter-spacing:6px; opacity:.75; margin-bottom:6px; }
#hud .dawn .bar { height:5px; background:rgba(255,255,255,.06); border:1px solid rgba(232,201,160,.3); }
#hud .dawn .fill { height:100%; width:0; background:linear-gradient(90deg,#1a2a6a,#c8603a,#ffe6a0); }
#hud .dawn.late .fill { animation: hud-pulse .5s infinite alternate; }
#hud .bars { position:absolute; left:0; right:0; height:0; background:#000; transition:height 1.2s; }
#hud .bars.top { top:0; } #hud .bars.bottom { bottom:0; }
#hud.cinematic .bars { height:10vh; }
#hud.cinematic .fuel, #hud.cinematic .held, #hud.cinematic .cross, #hud.cinematic .prompt, #hud.cinematic .dawn { display:none; }
#hud .end { position:absolute; left:0; right:0; top:62%; text-align:center; font-size:13px; letter-spacing:4px; opacity:0; transition:opacity 2s; }
#hud .end.show { opacity:.7; }
#hud .doc { position:absolute; inset:0; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.62); }
#hud .doc.show { display:flex; }
#hud .doc .paper { width:min(560px,86vw); max-height:74vh; overflow:auto; background:linear-gradient(170deg,#e2d6ba,#cbbd9b); color:#2a1e12; padding:28px 36px 22px; font-family:Georgia,'Times New Roman',serif; font-size:16px; line-height:1.6; box-shadow:0 0 50px #000, inset 0 0 40px rgba(90,60,20,.35); transform:rotate(-0.5deg); }
#hud .doc .paper h2 { font-size:13px; letter-spacing:4px; text-transform:uppercase; margin:0 0 16px; color:#5a3418; font-weight:normal; border-bottom:1px solid rgba(90,52,24,.35); padding-bottom:8px; }
#hud .doc .paper .body { white-space:pre-wrap; }
#hud .doc .hint { position:absolute; bottom:7%; left:0; right:0; text-align:center; font-size:12px; letter-spacing:4px; opacity:.75; }
#hud .choice { position:absolute; inset:0; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.55); }
#hud .choice.show { display:flex; }
#hud .choice .box { min-width:min(420px,80vw); border:1px solid rgba(255,170,90,.45); background:rgba(14,8,4,.92); padding:22px 28px; box-shadow:0 0 40px rgba(255,90,10,.25); }
#hud .choice h2 { margin:0 0 14px; font-size:13px; letter-spacing:5px; font-weight:normal; color:#ffb070; text-transform:uppercase; }
#hud .choice .opt { font-size:16px; padding:6px 0; color:#f2e2ca; }
#hud .choice .opt b { color:#ffb070; font-weight:normal; margin-right:12px; }
#hud .choice .hint { margin-top:14px; font-size:11px; letter-spacing:3px; opacity:.6; }
#hud .overlay { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,.72); }
#hud .overlay.hidden { display:none; }
#hud .overlay h1 { font-size:44px; letter-spacing:12px; color:#ff9a4a; margin:0 0 18px; font-weight:normal; text-shadow:0 0 18px #ff5a0a; }
#hud .overlay p { opacity:.75; margin:5px 0; letter-spacing:1px; }
`;

/** DOM overlay: crosshair, interaction prompt, subtitles, fuel bar, held items, pause screen. */
export class Hud {
  private prompt: HTMLElement;
  private sub: HTMLElement;
  private fuel: HTMLElement;
  private fuelFill: HTMLElement;
  private fuelLabel: HTMLElement;
  private held: HTMLElement;
  private overlay: HTMLElement;
  private vignette: HTMLElement;
  private fadeEl: HTMLElement;
  private titleEl: HTMLElement;
  private subTimer = 0;
  private titleTimer = 0;

  constructor(private root: HTMLElement) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root.innerHTML = `
      <div class="vignette"></div>
      <div class="bars top"></div><div class="bars bottom"></div>
      <div class="fade"></div>
      <div class="end">THANK YOU FOR PLAYING &middot; PRESS R TO PLAY AGAIN</div>
      <div class="dawn"><div class="label">DAWN</div><div class="bar"><div class="fill"></div></div></div>
      <div class="title"><div class="main"></div><div class="subt"></div></div>
      <div class="cross"></div>
      <div class="choice"><div class="box"><h2></h2><div class="opts"></div><div class="hint">[1]–[9] CHOOSE &middot; [Q] STEP BACK</div></div></div>
      <div class="doc"><div class="paper"><h2></h2><div class="body"></div></div><div class="hint">[E] CLOSE</div></div>
      <div class="prompt"></div>
      <div class="sub"></div>
      <div class="fuel"><div class="label">FLAME</div><div class="bar"><div class="fill"></div></div></div>
      <div class="held"></div>
      <div class="overlay">
        <h1>THE EMBER HOUR</h1>
        <p>click to begin</p>
        <p style="margin-top:22px;font-size:12px">WASD move &middot; SHIFT run &middot; E interact &middot; ESC pause</p>
      </div>`;
    const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;
    this.prompt = q('.prompt');
    this.sub = q('.sub');
    this.fuel = q('.fuel');
    this.fuelFill = q('.fuel .fill');
    this.fuelLabel = q('.fuel .label');
    this.held = q('.held');
    this.overlay = q('.overlay');
    this.vignette = q('.vignette');
    this.fadeEl = q('.fade');
    this.titleEl = q('.title');
  }

  /** 0..1 — darkness closing in from the screen edges as the shadow nears. */
  setThreat(level: number): void {
    this.vignette.style.opacity = level.toFixed(3);
  }

  /** Fade the screen out (1) or back in (0) over `seconds`. */
  fade(to: number, seconds: number, color?: string): void {
    this.fadeEl.style.transition = `opacity ${seconds}s`;
    if (color) this.fadeEl.style.background = color;
    this.fadeEl.style.opacity = String(to);
  }

  /** Big chapter card, e.g. title('ACT II', 'THE IRONWORKS'). */
  title(main: string, sub = '', seconds = 4.5): void {
    this.titleEl.querySelector('.main')!.textContent = main;
    this.titleEl.querySelector('.subt')!.textContent = sub;
    this.titleEl.classList.add('show');
    clearTimeout(this.titleTimer);
    if (seconds > 0) this.titleTimer = window.setTimeout(() => this.titleEl.classList.remove('show'), seconds * 1000);
  }

  setPrompt(text: string | null): void {
    const value = text ? `[E] ${text}` : '';
    if (this.prompt.textContent !== value) this.prompt.textContent = value;
  }

  /** Show a subtitle / inner-thought line. */
  say(text: string, seconds = 4.5): void {
    this.sub.textContent = text;
    this.sub.classList.add('show');
    clearTimeout(this.subTimer);
    this.subTimer = window.setTimeout(() => this.sub.classList.remove('show'), seconds * 1000);
  }

  setFuelVisible(visible: boolean): void {
    this.fuel.style.display = visible ? '' : 'none';
  }

  setFuel(ratio: number): void {
    this.fuelFill.style.width = `${(ratio * 100).toFixed(1)}%`;
    const low = ratio < 0.25;
    this.fuel.classList.toggle('low', low);
    const label = 'FLAME';
    if (this.fuelLabel.textContent !== label) this.fuelLabel.textContent = label;
  }

  setHeld(names: string[]): void {
    this.held.innerHTML = names.map((n) => `&#9632; ${n}`).join('<br>');
  }

  /** Dawn meter (0..1); null hides it. */
  setDawn(ratio: number | null): void {
    const el = this.root.querySelector<HTMLElement>('.dawn')!;
    el.classList.toggle('show', ratio !== null);
    if (ratio === null) return;
    el.querySelector<HTMLElement>('.fill')!.style.width = `${(ratio * 100).toFixed(1)}%`;
    el.classList.toggle('late', ratio > 0.8);
  }

  /** Letterbox bars and no gameplay HUD. */
  setCinematic(on: boolean): void {
    this.root.classList.toggle('cinematic', on);
  }

  /** Final card: title stays up and R restarts the game from Act I. */
  endScreen(main: string, sub: string): void {
    this.title(main, sub, 0);
    setTimeout(() => this.root.querySelector('.end')!.classList.add('show'), 4000);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR') location.href = location.pathname;
    });
  }

  showChoice(title: string, labels: string[]): void {
    const el = this.root.querySelector<HTMLElement>('.choice')!;
    el.querySelector('h2')!.textContent = title;
    const opts = el.querySelector<HTMLElement>('.opts')!;
    opts.innerHTML = '';
    labels.forEach((label, i) => {
      const row = document.createElement('div');
      row.className = 'opt';
      const key = document.createElement('b');
      key.textContent = `[${i + 1}]`;
      row.append(key, document.createTextNode(label));
      opts.appendChild(row);
    });
    el.classList.add('show');
  }

  hideChoice(): void {
    this.root.querySelector('.choice')!.classList.remove('show');
  }

  showDocument(title: string, body: string): void {
    const doc = this.root.querySelector<HTMLElement>('.doc')!;
    doc.querySelector('h2')!.textContent = title;
    doc.querySelector('.body')!.textContent = body;
    doc.classList.add('show');
  }

  hideDocument(): void {
    this.root.querySelector('.doc')!.classList.remove('show');
  }

  setPaused(paused: boolean): void {
    this.overlay.classList.toggle('hidden', !paused);
  }
}
