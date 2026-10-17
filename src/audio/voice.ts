import * as THREE from 'three';

/**
 * Julian's recorded lines. Files live in src/assets/audio/voice/<ID>.mp3 (IDs from the dialogue doc);
 * a subtitle whose text matches a line here is spoken with it. Lines without a file stay subtitle-only.
 */
const LINES: Record<string, string> = {
  'P-01': 'No. No, no, no — not here.',
  'P-02': 'Ashen Vale. Population zero. Perfect.',
  'P-03': 'Click. Nothing. It’s dead.',
  'P-04': 'Freezing… and so quiet.',
  'P-05': 'Come on, come on…',
  'P-06': 'Dead. Of course it’s dead.',
  'P-07': 'Fire. At least fire still works.',
  'L-01': '…What? No. No, I was outside. It was morning. I heard birds.',
  'L-02': 'The sign. The radio. The engine… I’ve been here before.',
  'L-03': 'How many times have I been here before?',
  'A1-01': 'Ashen Vale… the car’s dead. This torch is all I’ve got.',
  'A1-02': 'Boarded shut.',
  'A1-03': 'Arthur Vance… Vance. Why does that name sit so heavy?',
  'A1-04': 'Something moved behind me.',
  'A1-05': 'Still takes a flame.',
  'A1-06': 'The boards… they’re burning away with it.',
  'A1-07': 'The ice is weeping… come on…',
  'A1-08': 'Evacuation orders. He tried to get them all out.',
  'A1-09': 'The frost on the far door — it’s cracking!',
  'A1-10': 'The floor— it’s falling away—',
  'A2-01': 'Fifty years back… the ironworks. Still burning.',
  'A2-02': 'It followed me. Even here. Even now.',
  'A2-03': 'Eleven warnings. Nobody listened.',
  'A2-04': 'The furnace roars — the gear door, it’s rolling open.',
  'A2-05': 'The pressure blew them all out. And that noise… it heard.',
  'A2-06': 'The pressure’s dropping…',
  'A2-07': 'Hale’s watch. Stopped at 3:17 — same as the flyer.',
  'A2-08': 'The hydraulics— the gate is lifting.',
  'A2-09': 'It’s burning… and the air above it is tearing open.',
  'A2-10': 'Forward— it’s pulling me forward—',
  'A3-01': 'The future… what’s left of it. The sky is bleeding.',
  'A3-02': 'It’s bigger now. It’s learning how to put me out.',
  'A3-03': 'The lens caught the flame.',
  'A3-04': 'It cracked— there’s something inside. A recording?',
  'A3-05': 'The planets stopped… and the debris — it’s forming a path.',
  'A3-10': 'RUN.',
  'A4-01': 'A church. The doors sealed shut behind me.',
  'A4-02': 'The flyer again. Warm, like it never finished burning.',
  'A4-03': '3:17. It’s always 3:17.',
  'A4-04': 'The voice inside is quiet now. Waiting.',
  'A4-05': 'Burn what you were, before the light finds what you are.',
  'A4-06': 'And it’s here. All of it.',
  'A4-07': 'My last flask of oil. Make it count.',
  'EA-01': 'It’s… breaking apart.',
  'EA-02': 'Morning. Birds… I made it. I actually—',
  'EB-01': 'The sun… it isn’t killing it. It’s turning it to stone.',
  'EB-01b': 'No— that was wrong— the light, it’s coming in—',
  'EB-02': 'Daylight. It’s over… isn’t it?',
  'EB-03': 'Someone’s down there. A torch. Just arriving…',
  'EB-04': '…That’s me.',
  'G-01': 'The flame is getting weak…',
  'G-02': 'It’s almost out.',
  'G-03': 'The flame is out…',
  'G-04': '…It let me go. For now.',
  'G-05': 'The warmth steadies my hands. The flame is strong again.',
  'G-06': 'Warm. For a moment, safe.',
  'G-07': 'Scalding—',
};

const FILES = import.meta.glob<string>('../assets/audio/voice/*.mp3', { eager: true, query: '?url', import: 'default' });

/** Compare lines by their words only, so quote marks / dashes / ellipses don't matter. */
const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const BY_TEXT = new Map(Object.entries(LINES).map(([id, text]) => [norm(text), id]));

export class Voice {
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private current?: THREE.Audio;

  constructor(private listener: THREE.AudioListener) {
    // Decode every line up front so a subtitle and its voice can start on the same frame.
    for (const id of Object.keys(LINES)) void this.load(id);
  }

  private load(id: string): Promise<AudioBuffer | null> {
    const url = FILES[`../assets/audio/voice/${id}.mp3`];
    if (!url) return Promise.resolve(null);
    let p = this.loading.get(id);
    if (!p) {
      p = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => this.listener.context.decodeAudioData(data))
        .then((buffer) => (this.buffers.set(id, buffer), buffer))
        .catch(() => (console.warn(`Could not load voice line ${id}`), null));
      this.loading.set(id, p);
    }
    return p;
  }

  /**
   * If `text` is a recorded line, play it and call `start(duration)` at the same moment; returns false
   * for lines with no recording (the caller shows them as plain subtitles).
   */
  speak(text: string, start: (duration: number) => void): boolean {
    const id = BY_TEXT.get(norm(text));
    if (!id || !FILES[`../assets/audio/voice/${id}.mp3`]) return false;
    const go = (buffer: AudioBuffer | null) => {
      if (!buffer) return start(0);
      if (this.current?.isPlaying) this.current.stop();
      const sound = new THREE.Audio(this.listener);
      sound.setBuffer(buffer);
      sound.setVolume(1.1);
      sound.play();
      this.current = sound;
      start(buffer.duration);
    };
    const ready = this.buffers.get(id);
    if (ready) go(ready);
    else void this.load(id).then(go);
    return true;
  }

  stop(): void {
    if (this.current?.isPlaying) this.current.stop();
  }
}
