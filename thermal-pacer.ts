/**
 * ThermalFramePacer
 * Gerenciador de cadência de quadros (Frame Pacing) e proteção anti-aquecimento.
 * 
 * Regula a taxa de renderização entre 60 FPS e 30 FPS:
 * 1. Reduz para 30 FPS após 8s de inatividade do usuário para resfriar a GPU.
 * 2. Reduz para 30 FPS se a GPU sofrer lentidão contínua (> 22ms por mais de 3s).
 * 3. Restaura para 60 FPS imediatamente ao menor toque ou interação do usuário.
 */
export class ThermalFramePacer {
  private targetFps = 60;
  private frameIntervalMs = 1000 / 60;
  private lastFrameTimestamp = 0;
  private consecutiveSlowFrames = 0;
  private isThrottled = false;
  private lastUserInteraction = performance.now();
  private boundInteraction: () => void;

  constructor(private onPacingChange?: (targetFps: number) => void) {
    this.boundInteraction = this.handleUserInteraction.bind(this);
    this.bindEvents();
  }

  private bindEvents(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('pointerdown', this.boundInteraction, { passive: true });
    window.addEventListener('pointermove', this.boundInteraction, { passive: true });
    window.addEventListener('touchstart', this.boundInteraction, { passive: true });
    window.addEventListener('wheel', this.boundInteraction, { passive: true });
  }

  private handleUserInteraction(): void {
    this.lastUserInteraction = performance.now();
    // Se estava em repouso por inatividade e não está sob throttling térmico severo, volta para 60 FPS
    if (this.targetFps !== 60 && !this.isThrottled) {
      this.setTargetFps(60);
    }
  }

  /**
   * Monitora a duração real da rasterização por frame e ativa clamp adaptativo
   */
  public evaluateFrameTiming(renderDurationMs: number): void {
    if (renderDurationMs > 22.0) {
      this.consecutiveSlowFrames++;
    } else {
      this.consecutiveSlowFrames = Math.max(0, this.consecutiveSlowFrames - 1);
    }

    // Se mais de 90 frames sofrerem lentidão contínua (>22ms por ~3s), ativa o clamp térmico
    if (this.consecutiveSlowFrames > 90 && !this.isThrottled) {
      this.isThrottled = true;
      this.setTargetFps(30);
      console.warn('[ThermalPacer] Sobrecarga contínua na GPU detectada (>22ms por 3s). Limitando a 30 FPS para evitar throttling do SO.');
    }

    // Se o usuário estiver inativo por mais de 8 segundos, reduz suavemente para 30 FPS
    const idleDuration = performance.now() - this.lastUserInteraction;
    if (idleDuration > 8000 && this.targetFps === 60) {
      this.setTargetFps(30);
    }
  }

  /**
   * Verifica se o intervalo de tempo transcorrido autoriza a emissão de um novo frame
   */
  public shouldRender(now: number): boolean {
    const elapsed = now - this.lastFrameTimestamp;
    if (elapsed >= this.frameIntervalMs - 1.0) {
      this.lastFrameTimestamp = now;
      return true;
    }
    return false;
  }

  private setTargetFps(fps: number): void {
    if (this.targetFps === fps) return;
    this.targetFps = fps;
    this.frameIntervalMs = 1000 / fps;
    this.onPacingChange?.(fps);
  }

  public getTargetFps(): number {
    return this.targetFps;
  }

  public dispose(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointerdown', this.boundInteraction);
    window.removeEventListener('pointermove', this.boundInteraction);
    window.removeEventListener('touchstart', this.boundInteraction);
    window.removeEventListener('wheel', this.boundInteraction);
  }
}
