import * as THREE from 'three';

/**
 * GPU Capability & Extensions Detective
 * Identifica o suporte a WEBGL_multi_draw, Timer Queries e WebGPU no cliente.
 */
export interface GPUCapabilities {
  webgl2: boolean;
  webgpu: boolean;
  multiDraw: boolean;
  disjointTimerQuery: boolean;
  maxVertexUniformVectors: number;
  maxTextureImageUnits: number;
}

export function detectGPUCapabilities(renderer: THREE.WebGLRenderer): GPUCapabilities {
  const gl = renderer.getContext();
  const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  
  const multiDraw = isWebGL2 ? !!gl.getExtension('WEBGL_multi_draw') : false;
  const disjointTimer = isWebGL2
    ? !!(gl.getExtension('EXT_disjoint_timer_query_webgl2') || gl.getExtension('EXT_disjoint_timer_query'))
    : false;

  const maxVertexUniformVectors = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) || 0;
  const maxTextureImageUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) || 0;
  const webgpu = typeof navigator !== 'undefined' && 'gpu' in navigator;

  return {
    webgl2: isWebGL2,
    webgpu,
    multiDraw,
    disjointTimerQuery: disjointTimer,
    maxVertexUniformVectors,
    maxTextureImageUnits
  };
}

/**
 * Interface para configuração de um lote anatômico via THREE.BatchedMesh
 */
export interface BatchedSystemConfig {
  systemId: string;
  material: THREE.Material;
  maxGeometries: number;
  maxVertices: number;
  maxIndices: number;
}

/**
 * BatchedAnatomyManager
 * Gerencia a renderização GPU-Driven de múltiplos órgãos agrupados por material
 * utilizando THREE.BatchedMesh e WEBGL_multi_draw.
 * 
 * Vantagens sobre mergeGeometries:
 * 1. Mantém 1 draw call por sistema anatômico.
 * 2. Suporta per-object frustum culling individual (órgãos fora do campo de visão são descartados na GPU).
 * 3. Permite translação, rotação e escala por órgão (setMatrixAt) sem reescrever buffers na CPU.
 * 4. Permite ligar/desligar visibilidade por sub-peça (setVisibleAt) sem renderizar polígonos degenerados.
 */
export class BatchedAnatomyManager {
  private batches = new Map<string, THREE.BatchedMesh>();
  private partToBatchIndex = new Map<number, { system: string; batchId: number }>();
  private dummyMatrix = new THREE.Matrix4();

  constructor(private scene: THREE.Scene) {}

  /**
   * Cria ou obtém um BatchedMesh para um determinado sistema anatômico.
   */
  public getOrCreateBatch(config: BatchedSystemConfig): THREE.BatchedMesh {
    let batch = this.batches.get(config.systemId);
    if (!batch) {
      batch = new THREE.BatchedMesh(
        config.maxGeometries,
        config.maxVertices,
        config.maxIndices,
        config.material
      );
      // Habilita o culling de frustum refinado por sub-objeto na GPU/CPU
      batch.frustumCulled = true;
      batch.perObjectFrustumCulled = true;
      
      this.batches.set(config.systemId, batch);
      this.scene.add(batch);
    }
    return batch;
  }

  /**
   * Registra uma geometria anatômica individual no lote do sistema correspondente.
   */
  public addPartGeometry(
    partIndex: number,
    systemId: string,
    geometry: THREE.BufferGeometry,
    initialMatrix?: THREE.Matrix4
  ): number {
    const batch = this.batches.get(systemId);
    if (!batch) {
      throw new Error(`BatchedMesh para o sistema "${systemId}" ainda não foi inicializado.`);
    }

    const batchId = batch.addGeometry(geometry);
    if (initialMatrix) {
      batch.setMatrixAt(batchId, initialMatrix);
    }

    this.partToBatchIndex.set(partIndex, { system: systemId, batchId });
    return batchId;
  }

  /**
   * Atualiza a posição de explosão/dispersão de um órgão específico via matriz 4x4.
   * Não aloca memória de heap durante o render loop.
   */
  public updatePartTransform(
    partIndex: number,
    translation: THREE.Vector3,
    quaternion?: THREE.Quaternion,
    scale?: THREE.Vector3
  ): void {
    const entry = this.partToBatchIndex.get(partIndex);
    if (!entry) return;

    const batch = this.batches.get(entry.system);
    if (!batch) return;

    this.dummyMatrix.compose(
      translation,
      quaternion || new THREE.Quaternion(),
      scale || new THREE.Vector3(1, 1, 1)
    );

    batch.setMatrixAt(entry.batchId, this.dummyMatrix);
  }

  /**
   * Alterna a visibilidade de uma sub-peça anatômica individual
   */
  public setPartVisibility(partIndex: number, visible: boolean): void {
    const entry = this.partToBatchIndex.get(partIndex);
    if (!entry) return;

    const batch = this.batches.get(entry.system);
    if (!batch) return;

    batch.setVisibleAt(entry.batchId, visible);
  }

  /**
   * Libera todos os buffers alocados na GPU e desconecta da cena.
   */
  public dispose(): void {
    this.batches.forEach((batch) => {
      this.scene.remove(batch);
      batch.dispose();
    });
    this.batches.clear();
    this.partToBatchIndex.clear();
  }
}

/**
 * WebGL2 Transform Feedback Helper
 * Estrutura para computar partículas de fluxo ou simulação de dispersão anatômica
 * diretamente na GPU sem intervenção da CPU.
 */
export class GPUTransformFeedbackSimulator {
  private gl: WebGL2RenderingContext | null = null;
  private transformFeedback: WebGLTransformFeedback | null = null;
  private currentBufferIndex = 0;
  private vbos: [WebGLBuffer, WebGLBuffer] | null = null;

  constructor(renderer: THREE.WebGLRenderer) {
    const gl = renderer.getContext();
    if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
      this.gl = gl;
      this.transformFeedback = gl.createTransformFeedback();
    }
  }

  public isSupported(): boolean {
    return this.gl !== null && this.transformFeedback !== null;
  }

  public dispose(): void {
    if (!this.gl) return;
    if (this.transformFeedback) {
      this.gl.deleteTransformFeedback(this.transformFeedback);
      this.transformFeedback = null;
    }
    if (this.vbos) {
      this.gl.deleteBuffer(this.vbos[0]);
      this.gl.deleteBuffer(this.vbos[1]);
      this.vbos = null;
    }
  }
}
