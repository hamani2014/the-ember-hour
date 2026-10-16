const CSS = `
#hud { font-family: 'Courier New', monospace; }
#hud .cross { position:absolute; left:50%; top:50%; width:4px; height:4px; margin:-2px 0 0 -2px; background:#e8c9a0; opacity:.45; border-radius:50%; }
#hud .prompt { position:absolute; left:0; right:0; bottom:24%; text-align:center; font-size:17px; letter-spacing:1px; text-shadow:0 0 6px #000,0 0 2px #000; }
#hud .sub { position:absolute; left:12%; right:12%; bottom:11%; text-align:center; font-size:19px; font-style:italic; color:#f2e2ca; text-shadow:0 0 10px #000,0 0 3px #000; opacity:0; transition:opacity .6s; }
#hud .sub.show { opacity:1; }
#hud .fuel { position:absolute; left:28px; bottom:28px; width:200px; }
#hud .fuel .label { font-size:11px; letter-spacing:4px; opacity:.7; margin-bottom:5px; }
#hud .fuel .bar { height:6px; background:rgba(255,255,255,.06); border:1px solid rgba(232,201,160,.3); }
#hud .fuel .fill { height:100%; width:100%; background:linear-gradient(90deg,#6a1404,#ff6a14,#ffd27a); }
#hud .fuel.low .fill { animation: hud-pulse .6s infinite alternate; }
@keyframes hud-pulse { from { opacity:1 } to { opacity:.3 } }
#hud .held { position:absolute; right:28px; bottom:28px; text-align:right; font-size:13px; line-height:1.6; opacity:.85; }
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
  private held: HTMLElement;
  private overlay: HTMLElement;
  private subTimer = 0;

  constructor(root: HTMLElement) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root.innerHTML = `
      <div class="cross"></div>
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
    this.held = q('.held');
    this.overlay = q('.overlay');
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

  setFuel(ratio: number): void {
    this.fuelFill.style.width = `${(ratio * 100).toFixed(1)}%`;
    this.fuel.classList.toggle('low', ratio < 0.2);
  }

  setHeld(names: string[]): void {
    this.held.innerHTML = names.map((n) => `&#9632; ${n}`).join('<br>');
  }

  setPaused(paused: boolean): void {
    this.overlay.classList.toggle('hidden', !paused);
  }
}
