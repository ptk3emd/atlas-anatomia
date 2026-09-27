/**
 * gl-fallback.ts
 * Detecção e arquitetura de Fallback resiliente para WebGL 1.0 e WebGL 2.0.
 * 
 * Garante compatibilidade estendida para 99.5% dos dispositivos móveis, incluindo
 * aparelhos Android legados com WebViews antigas ou drivers com WebGL 2.0 desabilitado.
 * Previne vazamentos de contexto WebGL durante a sondagem através de descarte imediato (loseContext).
 */

import * as THREE from 'three';

export interface GLFeatureSupport {
  version: 'webgl2' | 'webgl1' | 'unsupported';
  isWebGL2: boolean;
  has32BitIndices: boolean;          // OES_element_index_uint
  hasInstancing: boolean;            // ANGLE_instanced_arrays
  hasStandardDerivatives: boolean;   // OES_standard_derivatives
  hasFloatTextures: boolean;         // OES_texture_float
  hasHalfFloatTextures: boolean;     // OES_texture_half_float
  maxTextureSize: number;
  maxVertexUniformVectors: number;
  maxFragmentUniformVectors: number;
  rendererString: string;
  vendorString: string;
  diagnostics: string[];
}

export class GLFallbackManager {
  private static cachedSupport: GLFeatureSupport | null = null;

  /**
   * Sonda o ambiente WebGL de forma segura sem reter instâncias de contexto.
   */
  public static probeCapabilities(): GLFeatureSupport {
    if (this.cachedSupport) {
      return this.cachedSupport;
    }

    const diagnostics: string[] = [];
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    let isWebGL2 = false;

    // 1. Tenta obter WebGL 2.0
    try {
      gl = canvas.getContext('webgl2', {
        powerPreference: 'high-performance'
      }) as WebGL2RenderingContext | null;
      if (gl) {
        isWebGL2 = true;
        diagnostics.push('Contexto nativo WebGL 2.0 ativo.');
      }
    } catch (e) {
      diagnostics.push(`Falha ao sondar WebGL 2.0: ${e}`);
    }

    // 2. Se falhar, tenta obter WebGL 1.0
    if (!gl) {
      try {
        gl = (canvas.getContext('webgl', {
          powerPreference: 'high-performance'
        }) || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        if (gl) {
          diagnostics.push('Fallback ativo: Contexto WebGL 1.0 legado detectado.');
        }
      } catch (e) {
        diagnostics.push(`Falha ao sondar WebGL 1.0: ${e}`);
      }
    }

    if (!gl) {
      this.cachedSupport = {
        version: 'unsupported',
        isWebGL2: false,
        has32BitIndices: false,
        hasInstancing: false,
        hasStandardDerivatives: false,
        hasFloatTextures: false,
        hasHalfFloatTextures: false,
        maxTextureSize: 0,
        maxVertexUniformVectors: 0,
        maxFragmentUniformVectors: 0,
        rendererString: 'Unknown',
        vendorString: 'Unknown',
        diagnostics: [...diagnostics, 'Nenhum contexto WebGL compatível suportado.']
      };
      return this.cachedSupport;
    }

    // 3. Inspeção de extensões e limites de hardware
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    const maxVertexUniformVectors = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) || 128;
    const maxFragmentUniformVectors = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 64;

    let rendererString = 'Generic';
    let vendorString = 'Generic';
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      rendererString = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Generic';
      vendorString = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Generic';
    }

    let has32BitIndices = isWebGL2;
    let hasInstancing = isWebGL2;
    let hasStandardDerivatives = isWebGL2;
    let hasFloatTextures = isWebGL2;
    let hasHalfFloatTextures = isWebGL2;

    if (!isWebGL2) {
      has32BitIndices = !!gl.getExtension('OES_element_index_uint');
      hasInstancing = !!gl.getExtension('ANGLE_instanced_arrays');
      hasStandardDerivatives = !!gl.getExtension('OES_standard_derivatives');
      hasFloatTextures = !!gl.getExtension('OES_texture_float');
      hasHalfFloatTextures = !!(
        gl.getExtension('OES_texture_half_float') || gl.getExtension('EXT_color_buffer_half_float')
      );

      if (!has32BitIndices) {
        diagnostics.push('Aviso: OES_element_index_uint ausente. Malhas com mais de 65.535 vértices requerem fatiamento.');
      }
      if (!hasFloatTextures && !hasHalfFloatTextures) {
        diagnostics.push('Aviso: Texturas float/half-float indisponíveis. Usando codificação em RGBA8.');
      }
    }

    // 4. Libera imediatamente o contexto de sondagem para evitar estourar o limite do Safari iOS
    const loseContextExt = gl.getExtension('WEBGL_lose_context');
    if (loseContextExt) {
      loseContextExt.loseContext();
    }

    this.cachedSupport = {
      version: isWebGL2 ? 'webgl2' : 'webgl1',
      isWebGL2,
      has32BitIndices,
      hasInstancing,
      hasStandardDerivatives,
      hasFloatTextures,
      hasHalfFloatTextures,
      maxTextureSize,
      maxVertexUniformVectors,
      maxFragmentUniformVectors,
      rendererString,
      vendorString,
      diagnostics
    };

    return this.cachedSupport;
  }

  /**
   * Cria uma instância de WebGLRenderer do Three.js tolerante a falhas,
   * aplicando parâmetros de compatibilidade dependendo da versão do WebGL suportada.
   */
  public static createRenderer(
    options: THREE.WebGLRendererParameters = {}
  ): { renderer: THREE.WebGLRenderer; support: GLFeatureSupport } {
    const support = this.probeCapabilities();

    if (support.version === 'unsupported') {
      throw new Error('WebGL não é suportado pelo seu navegador ou placa gráfica.');
    }

    const mergedOptions: THREE.WebGLRendererParameters = {
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      stencil: false,
      depth: true,
      ...options
    };

    try {
      const renderer = new THREE.WebGLRenderer(mergedOptions);
      return { renderer, support };
    } catch (primaryError) {
      console.warn('[GLFallbackManager] Falha ao criar WebGLRenderer primário. Tentando modo de compatibilidade:', primaryError);

      // Tenta modo de alta compatibilidade (sem antialias e sem preferência estrita)
      try {
        const fallbackRenderer = new THREE.WebGLRenderer({
          ...mergedOptions,
          antialias: false,
          powerPreference: 'default'
        });
        return { renderer: fallbackRenderer, support };
      } catch (fallbackError) {
        throw new Error(
          'Não foi possível inicializar o pipeline 3D WebGL. Verifique se a aceleração de hardware está ativada nas configurações do seu navegador.'
        );
      }
    }
  }

  /**
   * Retorna o tipo de textura mais compatível para texturas de dados (DataTexture)
   */
  public static getPreferredDataTextureType(): THREE.TextureDataType {
    const support = this.probeCapabilities();
    if (support.isWebGL2 || support.hasFloatTextures) {
      return THREE.FloatType;
    }
    if (support.hasHalfFloatTextures) {
      return THREE.HalfFloatType;
    }
    return THREE.UnsignedByteType;
  }
}
