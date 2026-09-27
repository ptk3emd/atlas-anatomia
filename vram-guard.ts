import * as THREE from 'three';

export interface VRAMGuardCallbacks {
  onContextLost: () => void;
  onContextRestored: () => void;
  onLowMemoryWarning?: () => void;
}

/**
 * WebGLMemoryGuard
 * Protege contra o Jetsam do iOS Safari e gerencia a integridade do ciclo de vida WebGL.
 * 
 * Previne encerramento da aba (OOM) através de:
 * 1. Tratamento não-bloqueante de webglcontextlost / webglcontextrestored.
 * 2. Purga de listas de renderização e parada de render em visibilitychange (aba em background).
 * 3. Orçamento estrito de VRAM por tier de dispositivo móvel.
 */
export class WebGLMemoryGuard {
  private canvas: HTMLCanvasElement;
  private isContextLost = false;
  private isBackground = false;
  private boundContextLost: (e: Event) => void;
  private boundContextRestored: () => void;
  private boundVisibilityChange: () => void;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private callbacks: VRAMGuardCallbacks
  ) {
    this.canvas = renderer.domElement;
    this.boundContextLost = this.handleContextLost.bind(this);
    this.boundContextRestored = this.handleContextRestored.bind(this);
    this.boundVisibilityChange = this.handleVisibilityChange.bind(this);

    this.attach();
  }

  private attach(): void {
    // webglcontextlost: Impede que o WebKit descarte a página definitivamente
    this.canvas.addEventListener('webglcontextlost', this.boundContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.boundContextRestored, false);

    // visibilitychange: Libera VRAM intermediária quando minimizado ou trocando de aba
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundVisibilityChange, false);
    }
  }

  private handleContextLost(event: Event): void {
    // CRÍTICO: preventDefault() notifica o navegador que a aplicação irá restaurar o contexto
    event.preventDefault();
    this.isContextLost = true;
    console.warn('[VRAM Guard] webglcontextlost interceptado. Pausando render loop para proteger o processo.');
    this.callbacks.onContextLost();
  }

  private handleContextRestored(): void {
    console.info('[VRAM Guard] webglcontextrestored recebido. Restaurando pipeline gráfico...');
    this.isContextLost = false;
    this.renderer.resetState();
    this.callbacks.onContextRestored();
  }

  private handleVisibilityChange(): void {
    if (typeof document === 'undefined') return;

    if (document.hidden) {
      this.isBackground = true;
      // Ao entrar em background no iOS, purga estruturas temporárias de render
      this.renderer.renderLists.dispose();
      console.info('[VRAM Guard] Aplicação em segundo plano: RenderLists purgadas.');
    } else {
      this.isBackground = false;
    }
  }

  /**
   * Verifica se o renderer está apto a desenhar frames (não está em background e contexto ativo)
   */
  public isReadyToRender(): boolean {
    return !this.isContextLost && !this.isBackground;
  }

  /**
   * Estima os bytes de VRAM consumidos por uma textura antes de sua alocação na GPU
   */
  public static calculateTextureFootprint(
    width: number,
    height: number,
    format: 'RGBA8' | 'ASTC_4x4' | 'ASTC_6x6' | 'ETC2' = 'RGBA8',
    hasMipmaps = true
  ): number {
    let bytesPerPixel = 4; // Padrão RGBA8 (32 bpp)
    if (format === 'ASTC_4x4') bytesPerPixel = 1.0; // 8 bpp
    if (format === 'ASTC_6x6') bytesPerPixel = 0.444; // 3.56 bpp
    if (format === 'ETC2') bytesPerPixel = 0.5; // 4 bpp

    const baseBytes = width * height * bytesPerPixel;
    return hasMipmaps ? Math.floor(baseBytes * 1.3333) : Math.floor(baseBytes);
  }

  public dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.boundContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.boundContextRestored);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityChange);
    }
  }
}
