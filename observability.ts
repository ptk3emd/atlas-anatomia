import * as THREE from 'three';

/**
 * Snapshot de métricas em tempo real para observabilidade 3D
 */
export interface TelemetrySnapshot {
  fps: number;
  cpuFrameTimeMs: number;
  gpuRenderTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometriesInVRAM: number;
  texturesInVRAM: number;
  pixelRatio: number;
  isThrottling: boolean;
  timestamp: number;
}

/**
 * GPUTimer baseado em EXT_disjoint_timer_query_webgl2
 * Mede o tempo real de execução dos comandos na GPU sem bloquear o thread principal da CPU.
 */
export class GPUTimer {
  private gl: WebGL2RenderingContext | null = null;
  private ext: any = null;
  private activeQuery: WebGLQuery | null = null;
  private pendingQuery: WebGLQuery | null = null;
  private lastGpuTimeMs = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    const gl = renderer.getContext();
    if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
      this.gl = gl;
      this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') || gl.getExtension('EXT_disjoint_timer_query');
    }
  }

  public isSupported(): boolean {
    return this.gl !== null && this.ext !== null;
  }

  /**
   * Inicia a medição de tempo da GPU antes da chamada de render
   */
  public begin(): void {
    if (!this.gl || !this.ext || this.activeQuery) return;
    this.activeQuery = this.gl.createQuery();
    if (this.activeQuery) {
      this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.activeQuery);
    }
  }

  /**
   * Finaliza a gravação de comandos da GPU e agenda a coleta assíncrona
   */
  public end(): void {
    if (!this.gl || !this.ext || !this.activeQuery) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pendingQuery = this.activeQuery;
    this.activeQuery = null;
    this.pollPendingQuery();
  }

  /**
   * Coleta o resultado da GPU sem causar stalls no pipeline (não bloqueante)
   */
  private pollPendingQuery(): void {
    if (!this.gl || !this.ext || !this.pendingQuery) return;

    // Se a GPU sofreu disjoint (ex.: troca de contexto ou throttling térmico agressivo), descarta
    const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    if (disjoint) {
      this.gl.deleteQuery(this.pendingQuery);
      this.pendingQuery = null;
      return;
    }

    const available = this.gl.getQueryParameter(this.pendingQuery, this.gl.QUERY_RESULT_AVAILABLE);
    if (available) {
      const timeElapsedNs = this.gl.getQueryParameter(this.pendingQuery, this.gl.QUERY_RESULT);
      this.lastGpuTimeMs = timeElapsedNs / 1_000_000.0;
      this.gl.deleteQuery(this.pendingQuery);
      this.pendingQuery = null;
    }
  }

  public getLastGpuTimeMs(): number {
    return this.lastGpuTimeMs;
  }

  public dispose(): void {
    if (!this.gl) return;
    if (this.activeQuery) {
      this.gl.deleteQuery(this.activeQuery);
      this.activeQuery = null;
    }
    if (this.pendingQuery) {
      this.gl.deleteQuery(this.pendingQuery);
      this.pendingQuery = null;
    }
  }
}

/**
 * Consolidated RUM (Real User Monitoring) Telemetry Report
 */
export interface RUMReport {
  sessionId: string;
  appVersion: string;
  deviceTier: 'low' | 'mid' | 'high';
  hardwareContext: {
    deviceMemoryGB?: number;
    concurrency?: number;
    pixelRatio: number;
    viewport: string;
    userAgent: string;
    gpuRenderer?: string;
  };
  metrics: {
    p50FrameTimeMs: number;
    p95FrameTimeMs: number;
    p50Fps: number;
    p95Fps: number;
    minFps: number;
    maxFps: number;
    averageFps: number;
    sampleCount: number;
    geometriesInVRAM: number;
    texturesInVRAM: number;
    drawCallsAvg: number;
    trianglesAvg: number;
    contextLossEvents: number;
    contextRestoredEvents: number;
    thermalThrottlingIncidents: number;
  };
  anomalies: Array<{
    type: 'thermal_throttling' | 'fps_regression' | 'vram_overflow' | 'context_lost';
    message: string;
    timestamp: number;
  }>;
  timestamp: number;
  durationSeconds: number;
}

/**
 * ProductionTelemetry
 * Agregador de telemetria RUM de campo de ultra-baixo impacto (<0.05% CPU/frame).
 * Utiliza buffers circulares O(1) e despacha lotes consolidados via navigator.sendBeacon.
 */
export class ProductionTelemetry {
  private static instance: ProductionTelemetry | null = null;
  private sessionId = Math.random().toString(36).substring(2, 11);
  private endpointUrl: string;
  private deviceTier: 'low' | 'mid' | 'high' = 'high';
  private frameSamples = new Float32Array(300); // 300 frames (~5s @ 60fps)
  private sampleIdx = 0;
  private totalSamples = 0;
  private lastFlushTime = performance.now();
  private contextLossEvents = 0;
  private contextRestoredEvents = 0;
  private thermalIncidents = 0;
  private consecutiveSlowFrames = 0;
  private anomalies: RUMReport['anomalies'] = [];
  private isFlushScheduled = false;

  constructor(options?: {
    endpointUrl?: string;
    deviceTier?: 'low' | 'mid' | 'high';
  }) {
    this.endpointUrl = options?.endpointUrl || '/api/telemetry';
    this.deviceTier = options?.deviceTier || this.detectDeviceTier();
    this.initLifecycleListeners();
  }

  public static getInstance(options?: { endpointUrl?: string; deviceTier?: 'low' | 'mid' | 'high' }): ProductionTelemetry {
    if (!ProductionTelemetry.instance) {
      ProductionTelemetry.instance = new ProductionTelemetry(options);
    }
    return ProductionTelemetry.instance;
  }

  private detectDeviceTier(): 'low' | 'mid' | 'high' {
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    const cores = navigator.hardwareConcurrency;
    if (typeof memory === 'number' && memory < 4) return 'low';
    if (typeof cores === 'number' && cores < 4) return 'low';
    if (typeof memory === 'number' && memory < 8) return 'mid';
    if (typeof cores === 'number' && cores < 6) return 'mid';
    return 'high';
  }

  /**
   * Registra tempo de frame com custo O(1) (~0.001ms)
   */
  public recordFrame(frameDurationMs: number, snapshot?: TelemetrySnapshot): void {
    const idx = this.sampleIdx % 300;
    this.frameSamples[idx] = frameDurationMs;
    this.sampleIdx++;
    this.totalSamples++;

    // Detecção de anomalia térmica / queda de quadros por tier
    const slowThresholdMs = this.deviceTier === 'low' ? 40 : this.deviceTier === 'mid' ? 28 : 20;
    if (frameDurationMs > slowThresholdMs) {
      this.consecutiveSlowFrames++;
      if (this.consecutiveSlowFrames === 15) { // ~250-500ms de travamento contínuo
        this.thermalIncidents++;
        this.anomalies.push({
          type: 'thermal_throttling',
          message: `Throttling térmico / CPU bound no Tier [${this.deviceTier}]: ${frameDurationMs.toFixed(1)}ms consecutivos.`,
          timestamp: Date.now()
        });
      }
    } else {
      this.consecutiveSlowFrames = 0;
    }

    // Auto flush periódico a cada 20 segundos
    const now = performance.now();
    if (now - this.lastFlushTime > 20000 && !this.isFlushScheduled) {
      this.scheduleFlush(snapshot);
    }
  }

  public recordContextLost(): void {
    this.contextLossEvents++;
    this.anomalies.push({
      type: 'context_lost',
      message: 'Perda de contexto WebGL detectada no dispositivo.',
      timestamp: Date.now()
    });
  }

  public recordContextRestored(): void {
    this.contextRestoredEvents++;
  }

  private scheduleFlush(snapshot?: TelemetrySnapshot): void {
    this.isFlushScheduled = true;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
        this.flush(snapshot);
      });
    } else {
      setTimeout(() => this.flush(snapshot), 100);
    }
  }

  /**
   * Consolida os percentis e despacha o relatório RUM via sendBeacon
   */
  public flush(snapshot?: TelemetrySnapshot): RUMReport | null {
    this.isFlushScheduled = false;
    const count = Math.min(this.totalSamples, 300);
    if (count === 0) return null;

    const currentDurationSec = (performance.now() - this.lastFlushTime) / 1000;
    this.lastFlushTime = performance.now();

    // Cálculo eficiente de percentis
    const slice = Array.from(this.frameSamples.subarray(0, count)).sort((a, b) => a - b);
    const p50FrameTime = slice[Math.floor(count * 0.50)] || 16.6;
    const p95FrameTime = slice[Math.floor(count * 0.95)] || 33.3;
    const minFrameTime = slice[0] || 16.6;
    const maxFrameTime = slice[count - 1] || 16.6;
    const avgFrameTime = slice.reduce((sum, v) => sum + v, 0) / count;

    const p50Fps = Math.round(1000 / Math.max(1, p50FrameTime));
    const p95Fps = Math.round(1000 / Math.max(1, p95FrameTime));
    const maxFps = Math.round(1000 / Math.max(1, minFrameTime));
    const minFps = Math.round(1000 / Math.max(1, maxFrameTime));
    const averageFps = Math.round(1000 / Math.max(1, avgFrameTime));

    const report: RUMReport = {
      sessionId: this.sessionId,
      appVersion: '1.0.0',
      deviceTier: this.deviceTier,
      hardwareContext: {
        deviceMemoryGB: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
        concurrency: navigator.hardwareConcurrency,
        pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
        viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
      },
      metrics: {
        p50FrameTimeMs: parseFloat(p50FrameTime.toFixed(2)),
        p95FrameTimeMs: parseFloat(p95FrameTime.toFixed(2)),
        p50Fps,
        p95Fps,
        minFps,
        maxFps,
        averageFps,
        sampleCount: count,
        geometriesInVRAM: snapshot?.geometriesInVRAM ?? 0,
        texturesInVRAM: snapshot?.texturesInVRAM ?? 0,
        drawCallsAvg: snapshot?.drawCalls ?? 0,
        trianglesAvg: snapshot?.triangles ?? 0,
        contextLossEvents: this.contextLossEvents,
        contextRestoredEvents: this.contextRestoredEvents,
        thermalThrottlingIncidents: this.thermalIncidents
      },
      anomalies: [...this.anomalies],
      timestamp: Date.now(),
      durationSeconds: parseFloat(currentDurationSec.toFixed(1))
    };

    // Limpa anomalias após consolidar
    this.anomalies = [];
    this.sampleIdx = 0;
    this.totalSamples = 0;

    // Despacho assíncrono via sendBeacon (com fallback para keepalive fetch)
    this.dispatch(report);

    // Salva localmente para diagnóstico offline / GitHub Pages
    this.storeDiagnosticLocally(report);

    return report;
  }

  private dispatch(report: RUMReport): void {
    if (typeof window === 'undefined') return;

    // Emite CustomEvent para analytics externos (Sentry/GA/Datadog)
    window.dispatchEvent(new CustomEvent('apex:telemetry', { detail: report }));

    const payload = JSON.stringify(report);

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(this.endpointUrl, blob);
      if (sent) return;
    }

    // Fallback se sendBeacon falhar ou não estiver disponível
    if (typeof fetch !== 'undefined') {
      fetch(this.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {
        // Silêncio em modo estático/GitHub Pages sem backend
      });
    }
  }

  private storeDiagnosticLocally(report: RUMReport): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const key = 'APEX_RUM_METRICS';
        const existing = JSON.parse(sessionStorage.getItem(key) || '[]');
        existing.push(report);
        if (existing.length > 10) existing.shift();
        sessionStorage.setItem(key, JSON.stringify(existing));
      }
    } catch {
      // Ignora restrições de armazenamento
    }
  }

  private initLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    window.addEventListener('pagehide', () => this.flush(), { passive: true });
  }
}

/**
 * PerformanceMonitor
 * Consolida métricas de renderização, acúmulo de VRAM e dispara alertas de anomalia.
 */
export class PerformanceMonitor {
  private gpuTimer: GPUTimer;
  private frameCount = 0;
  private lastTime = performance.now();
  private currentFps = 60;
  private telemetry: ProductionTelemetry;
  private onRegressionAlert?: (message: string, snapshot: TelemetrySnapshot) => void;

  constructor(
    private renderer: THREE.WebGLRenderer,
    options?: {
      onRegressionAlert?: (message: string, snapshot: TelemetrySnapshot) => void;
      telemetryEndpoint?: string;
    }
  ) {
    this.gpuTimer = new GPUTimer(renderer);
    this.onRegressionAlert = options?.onRegressionAlert;
    this.telemetry = ProductionTelemetry.getInstance({
      endpointUrl: options?.telemetryEndpoint
    });
  }

  public beginFrame(): void {
    this.gpuTimer.begin();
  }

  public endFrame(cpuDurationMs: number): TelemetrySnapshot {
    this.gpuTimer.end();
    this.frameCount++;

    const now = performance.now();
    const delta = now - this.lastTime;

    if (delta >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / delta);
      this.frameCount = 0;
      this.lastTime = now;
    }

    const info = this.renderer.info;
    const snapshot: TelemetrySnapshot = {
      fps: this.currentFps,
      cpuFrameTimeMs: parseFloat(cpuDurationMs.toFixed(2)),
      gpuRenderTimeMs: parseFloat(this.gpuTimer.getLastGpuTimeMs().toFixed(2)),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometriesInVRAM: info.memory.geometries,
      texturesInVRAM: info.memory.textures,
      pixelRatio: this.renderer.getPixelRatio(),
      isThrottling: this.currentFps < 30 || cpuDurationMs > 33.3,
      timestamp: now
    };

    // Gravação O(1) de telemetria RUM
    this.telemetry.recordFrame(cpuDurationMs, snapshot);

    // Alerta de regressão: Queda súbita de FPS ou tempo excessivo de frame
    if (snapshot.isThrottling && this.onRegressionAlert) {
      this.onRegressionAlert(
        `Alerta de degradação térmica ou CPU bound detectado: ${snapshot.fps} FPS, ${snapshot.cpuFrameTimeMs}ms CPU`,
        snapshot
      );
    }

    return snapshot;
  }

  public getTelemetry(): ProductionTelemetry {
    return this.telemetry;
  }

  public getGpuTimer(): GPUTimer {
    return this.gpuTimer;
  }

  public dispose(): void {
    this.gpuTimer.dispose();
  }
}
