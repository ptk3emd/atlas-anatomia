/**
 * raycast.worker.ts
 * Web Worker isolado para testes de colisão AABB (Slab Method), projeção de centros
 * e raycasting de alta performance sem sobrecarregar a thread principal da UI.
 * 
 * Permite latência de toque (touch input latency) < 1ms em dispositivos móveis Android e iOS.
 * Utiliza buffers transferíveis (Transferable ArrayBuffers) para tráfego zero-copy.
 */

interface PartBoundingData {
  partCount: number;
  // bounds: Float32Array [minX, minY, minZ, maxX, maxY, maxZ] * partCount
  bounds: Float32Array;
  // centers: Float32Array [cx, cy, cz] * partCount
  centers: Float32Array;
  // isSkin: Uint8Array (1 = sistema tegumentar/pele, 0 = demais órgãos)
  isSkin: Uint8Array;
}

let staticData: PartBoundingData | null = null;

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    const { partCount, boundsBuffer, centersBuffer, isSkinBuffer } = payload;
    staticData = {
      partCount,
      bounds: new Float32Array(boundsBuffer),
      centers: new Float32Array(centersBuffer),
      isSkin: new Uint8Array(isSkinBuffer)
    };
    self.postMessage({ type: 'INIT_OK' });
    return;
  }

  if (type === 'QUERY_RAYCAST') {
    if (!staticData) {
      self.postMessage({
        type: 'RAYCAST_RESULT',
        payload: {
          id: payload.id,
          foundIndex: -1,
          hitDistance: Infinity,
          matchType: 'none'
        }
      });
      return;
    }

    const {
      id,
      rayOrigin,         // [ox, oy, oz]
      rayDirection,      // [dx, dy, dz]
      viewProjMatrix,    // Float32Array(16)
      offsetsAndVis,     // Float32Array(partCount * 4): [dx, dy, dz, vis]
      screenWidth,
      screenHeight,
      screenX,
      screenY,
      maxScreenDist,
      hasSolid
    } = payload;

    const { partCount, bounds, centers, isSkin } = staticData;

    // 1. Ray vs AABB Intersection (Slab method otimizado)
    const ox = rayOrigin[0], oy = rayOrigin[1], oz = rayOrigin[2];
    const rdx = rayDirection[0], rdy = rayDirection[1], rdz = rayDirection[2];
    
    // Evita divisão por zero
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

      // Slab test
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

    // 2. Se nenhum AABB atingido diretamente pelo raio, testa proximidade à projeção de tela
    let bestScreenIndex = -1;
    let bestScreenDist = maxScreenDist;

    if (bestAABBIndex < 0 && viewProjMatrix) {
      const m = viewProjMatrix;
      for (let i = 0; i < partCount; i++) {
        const vis = offsetsAndVis[i * 4 + 3];
        if (vis < 0.08) continue;
        if (hasSolid && isSkin[i] === 1) continue;

        const cIndex = i * 3;
        const wx = centers[cIndex] + offsetsAndVis[i * 4];
        const wy = centers[cIndex + 1] + offsetsAndVis[i * 4 + 1];
        const wz = centers[cIndex + 2] + offsetsAndVis[i * 4 + 2];

        // Multiplicação vetor por matriz 4x4 coluna-maior
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
    }

    const finalIndex = bestAABBIndex >= 0 ? bestAABBIndex : bestScreenIndex;
    const matchType = bestAABBIndex >= 0 ? 'aabb' : (bestScreenIndex >= 0 ? 'screen' : 'none');

    self.postMessage({
      type: 'RAYCAST_RESULT',
      payload: {
        id,
        foundIndex: finalIndex,
        hitDistance: bestAABBIndex >= 0 ? nearestAABBDist : bestScreenDist,
        matchType
      }
    });
  }
};
