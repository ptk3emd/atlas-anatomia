import * as THREE from 'three';

export interface RaycastWorkerResult {
  foundIndex: number;
  hitDistance: number;
  matchType: 'aabb' | 'screen' | 'none';
}

export class RaycastWorkerClient {
  private worker: Worker | null = null;
  private isInitialized = false;
  private queryCounter = 0;
  private pendingCallbacks = new Map<number, (res: RaycastWorkerResult) => void>();
  private fallbackData: {
    partCount: number;
    bounds: Float32Array;
    centers: Float32Array;
    isSkin: Uint8Array;
  } | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      if (typeof Worker !== 'undefined') {
        this.worker = new Worker(new URL('./raycast.worker.ts', import.meta.url), {
          type: 'module'
        });

        this.worker.onmessage = (e: MessageEvent) => {
          const { type, payload } = e.data;
          if (type === 'INIT_OK') {
            this.isInitialized = true;
          } else if (type === 'RAYCAST_RESULT') {
            const cb = this.pendingCallbacks.get(payload.id);
            if (cb) {
              this.pendingCallbacks.delete(payload.id);
              cb({
                foundIndex: payload.foundIndex,
                hitDistance: payload.hitDistance,
                matchType: payload.matchType
              });
            }
          }
        };

        this.worker.onerror = (err) => {
          console.warn('[RaycastWorker] Worker error, utilizing main-thread fallback:', err);
          this.worker = null;
          this.isInitialized = false;
        };
      }
    } catch (err) {
      console.warn('[RaycastWorker] Worker instantiation unavailable, using fallback:', err);
      this.worker = null;
    }
  }

  public initParts(
    parts: Array<{ system: string }>,
    boundsList: THREE.Box3[],
    centersList: THREE.Vector3[]
  ) {
    const partCount = parts.length;
    const bounds = new Float32Array(partCount * 6);
    const centers = new Float32Array(partCount * 3);
    const isSkin = new Uint8Array(partCount);

    for (let i = 0; i < partCount; i++) {
      const b = boundsList[i];
      bounds[i * 6] = b.min.x;
      bounds[i * 6 + 1] = b.min.y;
      bounds[i * 6 + 2] = b.min.z;
      bounds[i * 6 + 3] = b.max.x;
      bounds[i * 6 + 4] = b.max.y;
      bounds[i * 6 + 5] = b.max.z;

      const c = centersList[i];
      centers[i * 3] = c.x;
      centers[i * 3 + 1] = c.y;
      centers[i * 3 + 2] = c.z;

      isSkin[i] = parts[i].system === 'integumentary' ? 1 : 0;
    }

    this.fallbackData = {
      partCount,
      bounds,
      centers,
      isSkin
    };

    if (this.worker) {
      // Clona buffers para envio Transferable
      const bBuf = bounds.buffer.slice(0);
      const cBuf = centers.buffer.slice(0);
      const sBuf = isSkin.buffer.slice(0);

      this.worker.postMessage(
        {
          type: 'INIT',
          payload: {
            partCount,
            boundsBuffer: bBuf,
            centersBuffer: cBuf,
            isSkinBuffer: sBuf
          }
        },
        [bBuf, cBuf, sBuf]
      );
    }
  }

  /**
   * Executa consulta de Raycasting & AABB no Worker de forma assíncrona.
   * Evita completamente bloqueio da thread principal da interface.
   */
  public query(params: {
    ray: THREE.Ray;
    camera: THREE.Camera;
    offsetsAndVis: Float32Array;
    screenWidth: number;
    screenHeight: number;
    screenX: number;
    screenY: number;
    maxScreenDist: number;
    hasSolid: boolean;
  }): Promise<RaycastWorkerResult> {
    const id = ++this.queryCounter;

    if (!this.worker || !this.isInitialized) {
      return Promise.resolve(this.querySyncFallback(params));
    }

    const {
      ray,
      camera,
      offsetsAndVis,
      screenWidth,
      screenHeight,
      screenX,
      screenY,
      maxScreenDist,
      hasSolid
    } = params;

    // Constrói matriz View-Projection
    const viewProj = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );

    return new Promise<RaycastWorkerResult>((resolve) => {
      this.pendingCallbacks.set(id, resolve);

      // Copia buffer de offsets e visibilidade (ou passa cópia rápida para não bloquear o render loop)
      const offsetsCopy = new Float32Array(offsetsAndVis);

      this.worker!.postMessage(
        {
          type: 'QUERY_RAYCAST',
          payload: {
            id,
            rayOrigin: [ray.origin.x, ray.origin.y, ray.origin.z],
            rayDirection: [ray.direction.x, ray.direction.y, ray.direction.z],
            viewProjMatrix: viewProj.elements,
            offsetsAndVis: offsetsCopy,
            screenWidth,
            screenHeight,
            screenX,
            screenY,
            maxScreenDist,
            hasSolid
          }
        },
        [offsetsCopy.buffer]
      );
    });
  }

  /**
   * Fallback síncrono rápido se Web Workers não estiverem disponíveis
   */
  public querySyncFallback(params: {
    ray: THREE.Ray;
    camera: THREE.Camera;
    offsetsAndVis: Float32Array;
    screenWidth: number;
    screenHeight: number;
    screenX: number;
    screenY: number;
    maxScreenDist: number;
    hasSolid: boolean;
  }): RaycastWorkerResult {
    if (!this.fallbackData) {
      return { foundIndex: -1, hitDistance: Infinity, matchType: 'none' };
    }

    const { partCount, bounds, centers, isSkin } = this.fallbackData;
    const {
      ray,
      camera,
      offsetsAndVis,
      screenWidth,
      screenHeight,
      screenX,
      screenY,
      maxScreenDist,
      hasSolid
    } = params;

    const ox = ray.origin.x, oy = ray.origin.y, oz = ray.origin.z;
    const rdx = ray.direction.x, rdy = ray.direction.y, rdz = ray.direction.z;
    const invDirX = 1.0 / (Math.abs(rdx) < 1e-7 ? (rdx < 0 ? -1e-7 : 1e-7) : rdx);
    const invDirY = 1.0 / (Math.abs(rdy) < 1e-7 ? (rdy < 0 ? -1e-7 : 1e-7) : rdy);
    const invDirZ = 1.0 / (Math.abs(rdz) < 1e-7 ? (rdz < 0 ? -1e-7 : 1e-7) : rdz);

    let nearestAABBDist = Infinity;
    let bestAABBIndex = -1;

    for (let i = 0; i < partCount; i++) {
      const vis = offsetsAndVis[i * 4 + 3];
      if (vis < 0.08) continue;
      if (hasSolid && isSkin[i] === 1) continue;

      const offX = offsetsAndVis[i * 4];
      const offY = offsetsAndVis[i * 4 + 1];
      const offZ = offsetsAndVis[i * 4 + 2];

      const bIndex = i * 6;
      const minX = bounds[bIndex] + offX;
      const minY = bounds[bIndex + 1] + offY;
      const minZ = bounds[bIndex + 2] + offZ;
      const maxX = bounds[bIndex + 3] + offX;
      const maxY = bounds[bIndex + 4] + offY;
      const maxZ = bounds[bIndex + 5] + offZ;

      const t1x = (minX - ox) * invDirX;
      const t2x = (maxX - ox) * invDirX;
      const tMinX = Math.min(t1x, t2x);
      const tMaxX = Math.max(t1x, t2x);

      const t1y = (minY - oy) * invDirY;
      const t2y = (maxY - oy) * invDirY;
      const tMinY = Math.max(tMinX, Math.min(t1y, t2y));
      const tMaxY = Math.min(tMaxX, Math.max(t1y, t2y));

      if (tMaxY < tMinY) continue;

      const t1z = (minZ - oz) * invDirZ;
      const t2z = (maxZ - oz) * invDirZ;
      const tMin = Math.max(tMinY, Math.min(t1z, t2z));
      const tMax = Math.min(tMaxY, Math.max(t1z, t2z));

      if (tMax < tMin || tMax < 0) continue;

      const dist = tMin > 0 ? tMin : tMax;
      if (dist < nearestAABBDist) {
        nearestAABBDist = dist;
        bestAABBIndex = i;
      }
    }

    if (bestAABBIndex >= 0) {
      return { foundIndex: bestAABBIndex, hitDistance: nearestAABBDist, matchType: 'aabb' };
    }

    // Projeção em tela
    const viewProj = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    const m = viewProj.elements;
    let bestScreenIndex = -1;
    let bestScreenDist = maxScreenDist;

    for (let i = 0; i < partCount; i++) {
      const vis = offsetsAndVis[i * 4 + 3];
      if (vis < 0.08) continue;
      if (hasSolid && isSkin[i] === 1) continue;

      const cIndex = i * 3;
      const wx = centers[cIndex] + offsetsAndVis[i * 4];
      const wy = centers[cIndex + 1] + offsetsAndVis[i * 4 + 1];
      const wz = centers[cIndex + 2] + offsetsAndVis[i * 4 + 2];

      const clipX = m[0] * wx + m[4] * wy + m[8] * wz + m[12];
      const clipY = m[1] * wx + m[5] * wy + m[9] * wz + m[13];
      const clipZ = m[2] * wx + m[6] * wy + m[10] * wz + m[14];
      const clipW = m[3] * wx + m[7] * wy + m[11] * wz + m[15];

      if (clipW <= 0) continue;

      const ndcX = clipX / clipW;
      const ndcY = clipY / clipW;
      const ndcZ = clipZ / clipW;

      if (ndcZ < -1 || ndcZ > 1) continue;

      const sx = (ndcX + 1.0) * screenWidth * 0.5;
      const sy = (1.0 - ndcY) * screenHeight * 0.5;

      const dist = Math.hypot(screenX - sx, screenY - sy);
      if (dist < bestScreenDist) {
        bestScreenDist = dist;
        bestScreenIndex = i;
      }
    }

    if (bestScreenIndex >= 0) {
      return { foundIndex: bestScreenIndex, hitDistance: bestScreenDist, matchType: 'screen' };
    }

    return { foundIndex: -1, hitDistance: Infinity, matchType: 'none' };
  }

  public dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingCallbacks.clear();
    this.fallbackData = null;
  }
}
