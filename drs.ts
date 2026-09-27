/**
 * Gerenciador de Resolução Dinâmica (Dynamic Resolution Scaling - DRS)
 * Monitora o delta de tempo dos frames de renderização e ajusta suavemente o pixelRatio
 * do WebGLRenderer entre um limite inferior e superior para preservar 60 FPS estáveis
 * em dispositivos móveis e desktops com telas de alta densidade de pixels (Retina / OLED).
 */
export class DynamicResolutionScaler {
  private frameTimes: number[] = [];
  private currentDPR: number;
  private minDPR: number;
  private maxDPR: number;
  private lastAdjustmentTime = 0;

  constructor(initialDPR: number, minDPR = 1.0, maxDPR = 2.0) {
    this.currentDPR = Math.max(minDPR, Math.min(initialDPR, maxDPR));
    this.minDPR = minDPR;
    this.maxDPR = maxDPR;
  }

  public getPixelRatio(): number {
    return this.currentDPR;
  }

  /**
   * Registra a duração do frame em milissegundos e ajusta o pixel ratio se necessário.
   * Retorna true se houve modificação de resolução (exigindo resize/dirty).
   */
  public update(frameDeltaMs: number): boolean {
    this.frameTimes.push(frameDeltaMs);
    if (this.frameTimes.length > 24) {
      this.frameTimes.shift();
    }

    const now = performance.now();
    // Limita as mudanças de escala para no máximo uma a cada 400ms para evitar flickering
    if (now - this.lastAdjustmentTime < 400 || this.frameTimes.length < 12) {
      return false;
    }

    const avgMs = this.frameTimes.reduce((acc, v) => acc + v, 0) / this.frameTimes.length;

    // Se a média do frame exceder 18.5ms (~< 54 FPS), degradação suave
    if (avgMs > 18.5 && this.currentDPR > this.minDPR) {
      const nextDPR = Math.max(this.minDPR, +(this.currentDPR - 0.15).toFixed(2));
      if (nextDPR !== this.currentDPR) {
        this.currentDPR = nextDPR;
        this.lastAdjustmentTime = now;
        return true;
      }
    } 
    // Se a média estiver confortável (< 14.5ms, > 68 FPS de headroom), recupera nitidez
    else if (avgMs < 14.5 && this.currentDPR < this.maxDPR) {
      const nextDPR = Math.min(this.maxDPR, +(this.currentDPR + 0.1).toFixed(2));
      if (nextDPR !== this.currentDPR) {
        this.currentDPR = nextDPR;
        this.lastAdjustmentTime = now;
        return true;
      }
    }

    return false;
  }

  public reset(baseDPR: number, minDPR = 1.0, maxDPR = 2.0) {
    this.minDPR = minDPR;
    this.maxDPR = maxDPR;
    this.currentDPR = Math.max(minDPR, Math.min(baseDPR, maxDPR));
    this.frameTimes = [];
  }
}
