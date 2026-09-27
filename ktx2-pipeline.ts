import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

export interface TextureCompressionSupport {
  astc: boolean;
  etc2: boolean;
  bc: boolean;
  supportedFormat: string;
}

/**
 * KTX2TextureManager
 * Gerencia o carregamento assíncrono de texturas KTX2 / Basis Universal
 * com transcodificação em tempo de execução para formatos nativos da GPU:
 * - iOS: ASTC 6x6 (alta compressão sem perda perceptível) ou ASTC 4x4
 * - Android: ASTC (moderno) ou ETC2 (universal)
 * - Desktop: BCn (DDS/DirectX/OpenGL)
 */
export class KTX2TextureManager {
  private loader: KTX2Loader;
  private textureCache = new Map<string, THREE.CompressedTexture>();
  private renderer: THREE.WebGLRenderer;
  private support: TextureCompressionSupport;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    const baseUrl = import.meta.env.BASE_URL || './';
    const transcoderPath = `${baseUrl.replace(/\/$/, '')}/basis/`;

    this.loader = new KTX2Loader()
      .setTranscoderPath(transcoderPath)
      .detectSupport(renderer);

    this.support = this.detectFormats();
  }

  private detectFormats(): TextureCompressionSupport {
    const gl = this.renderer.getContext();
    const astc = !!(
      gl.getExtension('WEBGL_compressed_texture_astc') ||
      gl.getExtension('WEBKIT_WEBGL_compressed_texture_astc')
    );
    const etc2 = !!(
      gl.getExtension('WEBGL_compressed_texture_etc') ||
      gl.getExtension('WEBGL_compressed_texture_etc1')
    );
    const bc = !!(
      gl.getExtension('WEBGL_compressed_texture_s3tc') ||
      gl.getExtension('WEBKIT_WEBGL_compressed_texture_s3tc')
    );

    let supportedFormat = 'RGBA8_FALLBACK';
    if (astc) supportedFormat = 'ASTC';
    else if (etc2) supportedFormat = 'ETC2';
    else if (bc) supportedFormat = 'BCn';

    return { astc, etc2, bc, supportedFormat };
  }

  public getSupport(): TextureCompressionSupport {
    return this.support;
  }

  /**
   * Carrega uma textura KTX2 comprimida de bloco.
   * Se já estiver em cache, retorna a instância preservando VRAM.
   */
  public async load(url: string): Promise<THREE.CompressedTexture> {
    const cached = this.textureCache.get(url);
    if (cached) return cached;

    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (texture) => {
          // Mipmaps já vêm embutidos no contêiner KTX2 (sem geração de CPU/GPU em runtime)
          texture.generateMipmaps = false;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.needsUpdate = true;

          this.textureCache.set(url, texture);
          resolve(texture);
        },
        undefined,
        (err) => {
          console.error(`[KTX2] Falha ao transcodificar textura ${url}:`, err);
          reject(err);
        }
      );
    });
  }

  /**
   * Libera todas as texturas KTX2 da memória de vídeo e destrói o transcoder WASM
   */
  public dispose(): void {
    this.textureCache.forEach((tex) => tex.dispose());
    this.textureCache.clear();
    this.loader.dispose();
  }
}
