import * as THREE from 'three';

export type DeviceTierLevel = 'low' | 'mid' | 'high';

export interface TierConfig {
  tier: DeviceTierLevel;
  maxDPR: number;
  maxTextureSize: number;
  usePBR: boolean;
  materialType: 'lambert' | 'standard';
  roughness: number;
  metalness: number;
  enableDRS: boolean;
}

/**
 * DeviceTierManager
 * Avalia o perfil de computação gráfica da GPU em mobile e desktop,
 * atribuindo um preset de qualidade balanceado para prevenir engasgos e thermal throttling.
 */
export class DeviceTierManager {
  private static cachedConfig: TierConfig | null = null;

  public static evaluate(renderer: THREE.WebGLRenderer): TierConfig {
    if (this.cachedConfig) return this.cachedConfig;

    const gl = renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererString = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase()
      : '';

    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const memory =
      typeof navigator !== 'undefined'
        ? (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4
        : 4;

    const isApple =
      rendererString.includes('apple') ||
      (!debugInfo && typeof navigator !== 'undefined' && /iphone|ipad/i.test(navigator.userAgent));
    const isMali = rendererString.includes('mali');
    const isAdreno = rendererString.includes('adreno');

    let tier: DeviceTierLevel = 'mid';

    if (isApple) {
      // GPUs Apple Metal (A12+ ou série M) possuem alto rendimento
      tier = 'high';
    } else if (isAdreno) {
      const match = rendererString.match(/adreno\s*\(?tm\)?\s*(\d+)/);
      const model = match ? parseInt(match[1], 10) : 0;
      tier = model >= 640 ? 'high' : model >= 610 ? 'mid' : 'low';
    } else if (isMali) {
      tier = /g7[0-9]|g6[0-9]|g9[0-9]/i.test(rendererString) ? 'mid' : 'low';
    } else if (memory < 3 || cores < 4) {
      tier = 'low';
    }

    this.cachedConfig = this.getConfigForTier(tier);
    console.info(`[DeviceTier] Dispositivo classificado como "${tier.toUpperCase()}" (Cores: ${cores}, Mem: ${memory}GB, Renderer: ${rendererString || 'genérico'})`);
    return this.cachedConfig;
  }

  public static getConfigForTier(tier: DeviceTierLevel): TierConfig {
    switch (tier) {
      case 'low':
        return {
          tier: 'low',
          maxDPR: 1.0,
          maxTextureSize: 1024,
          usePBR: false,
          materialType: 'lambert',
          roughness: 0.5,
          metalness: 0.0,
          enableDRS: false,
        };
      case 'mid':
        return {
          tier: 'mid',
          maxDPR: 1.5,
          maxTextureSize: 1024,
          usePBR: true,
          materialType: 'standard',
          roughness: 0.56,
          metalness: 0.06,
          enableDRS: true,
        };
      case 'high':
        return {
          tier: 'high',
          maxDPR: 2.0,
          maxTextureSize: 2048,
          usePBR: true,
          materialType: 'standard',
          roughness: 0.56,
          metalness: 0.06,
          enableDRS: true,
        };
    }
  }

  public static clearCache(): void {
    this.cachedConfig = null;
  }
}
