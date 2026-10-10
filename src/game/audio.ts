export type SfxName =
  | 'jump'
  | 'land'
  | 'shoot'
  | 'dry'
  | 'dash'
  | 'hurt'
  | 'die'
  | 'break'
  | 'metal'
  | 'pickup'
  | 'gem'
  | 'chest'
  | 'boss'
  | 'hit'
  | 'win'
  | 'ui'
  | 'reload'
  | 'slide'

export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private music: GainNode | null = null
  private next = 0
  private step = 0
  muted = false

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.22
    this.master.connect(this.ctx.destination)
    this.music = this.ctx.createGain()
    this.music.gain.value = 0.18
    this.music.connect(this.master)
    this.next = this.ctx.currentTime + 0.05
  }

  play(name: SfxName): void {
    if (this.muted || !this.ctx || !this.master) return
    const t = this.ctx.currentTime
    if (name === 'shoot') this.noise(t, 0.06, 0.18, 900)
    else if (name === 'dry') this.tone(t, 180, 0.05, 'square', 0.04)
    else if (name === 'jump') this.tone(t, 420, 0.09, 'square', 0.06, 680)
    else if (name === 'land') this.noise(t, 0.05, 0.08, 200)
    else if (name === 'dash') this.tone(t, 220, 0.12, 'sawtooth', 0.05, 640)
    else if (name === 'slide') this.noise(t, 0.1, 0.06, 300)
    else if (name === 'hurt') this.tone(t, 140, 0.16, 'sawtooth', 0.08, 60)
    else if (name === 'die') this.tone(t, 220, 0.4, 'triangle', 0.08, 50)
    else if (name === 'break') this.noise(t, 0.12, 0.16, 500)
    else if (name === 'metal') this.tone(t, 880, 0.05, 'square', 0.04, 440)
    else if (name === 'hit') this.tone(t, 240, 0.05, 'square', 0.05)
    else if (name === 'pickup') this.arpeggio(t, [660, 880])
    else if (name === 'gem') this.arpeggio(t, [740, 988])
    else if (name === 'chest' || name === 'win') this.arpeggio(t, [523, 659, 784, 1046])
    else if (name === 'boss') this.noise(t, 0.18, 0.16, 120)
    else if (name === 'reload') this.tone(t, 520, 0.07, 'square', 0.05, 700)
    else if (name === 'ui') this.tone(t, 660, 0.04, 'square', 0.04)
  }

  update(): void {
    if (this.muted || !this.ctx || !this.music) return
    const beat = 60 / 112 / 2
    while (this.next < this.ctx.currentTime + 0.12) {
      this.schedule(this.step, this.next)
      this.step = (this.step + 1) % 16
      this.next += beat
    }
  }

  private schedule(step: number, time: number): void {
    const bass = [110, 110, 131, 110, 98, 98, 110, 87]
    if (step % 2 === 0) this.tone(time, bass[(step / 2) % bass.length], 0.16, 'triangle', 0.05, undefined, this.music)
    if (step % 4 === 0) this.noise(time, 0.04, 0.05, 180, this.music)
    if (step % 2 === 1) this.noise(time, 0.02, 0.03, 2400, this.music)
    if (step === 4 || step === 12) this.tone(time, 440, 0.08, 'square', 0.02, 660, this.music)
  }

  private tone(
    time: number,
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slide?: number,
    dest?: AudioNode | null,
  ): void {
    if (!this.ctx || !this.master) return
    const osc = this.ctx.createOscillator()
    const amp = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, time)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), time + dur)
    amp.gain.setValueAtTime(gain, time)
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    osc.connect(amp)
    amp.connect(dest ?? this.master)
    osc.start(time)
    osc.stop(time + dur + 0.02)
  }

  private noise(time: number, dur: number, gain: number, freq: number, dest?: AudioNode | null): void {
    if (!this.ctx || !this.master) return
    const length = Math.floor(this.ctx.sampleRate * dur)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq
    const amp = this.ctx.createGain()
    amp.gain.setValueAtTime(gain, time)
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    src.connect(filter)
    filter.connect(amp)
    amp.connect(dest ?? this.master)
    src.start(time)
    src.stop(time + dur + 0.02)
  }

  private arpeggio(time: number, notes: number[]): void {
    notes.forEach((note, i) => this.tone(time + i * 0.07, note, 0.12, 'square', 0.05))
  }
}
