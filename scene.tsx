import {useEffect,useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createExplosionLayout} from './explosion-layout';
import {decodeModelResponse} from './model-download';
import {PointerTap} from './pointer-tap';
import {SYSTEMS,translateAnatomicalName,type Atlas,type SceneState} from './anatomy';
import {computePartLandmarks,type ComputedLandmark} from './landmarks';
import {DynamicResolutionScaler} from './drs';
import {PerformanceMonitor} from './observability';
import {WebGLMemoryGuard} from './vram-guard';
import {KTX2TextureManager} from './ktx2-pipeline';
import {DeviceTierManager} from './device-tier';
import {ThermalFramePacer} from './thermal-pacer';
import {GLFallbackManager} from './gl-fallback';
import {RaycastWorkerClient} from './raycast-client';
import {type ViewerSettings, DEFAULT_VIEWER_SETTINGS} from './settings';
import {computeResolvedPartLandmarks} from './landmark-store';

interface Props {
  atlas: Atlas;
  state: SceneState;
  activeLandmarkId?: string | null;
  settings?: ViewerSettings;
  isAddingLandmark?: boolean;
  onAddPointClicked?: (pointData: {
    partId: string;
    partName: string;
    relativePos: [number, number, number];
    worldPosition: [number, number, number];
  }) => void;
  onSelect: (id: string) => void;
  onSelectLandmark?: (id: string | null) => void;
  onEditLandmarkRequest?: (landmarkId: string) => void;
  onProgress: (n: number) => void;
  onError: (s: string) => void;
}

export default function AnatomyScene({
  atlas,
  state,
  activeLandmarkId,
  settings,
  isAddingLandmark,
  onAddPointClicked,
  onSelect,
  onSelectLandmark,
  onEditLandmarkRequest,
  onProgress,
  onError
}: Props) {
 const host=useRef<HTMLDivElement>(null),latest=useRef(state),select=useRef(onSelect);
 const latestLandmarkId=useRef(activeLandmarkId),selectLandmark=useRef(onSelectLandmark);
 const latestSettings=useRef(settings || DEFAULT_VIEWER_SETTINGS);
 const latestAddingLandmark=useRef(isAddingLandmark);
 const latestOnAddPoint=useRef(onAddPointClicked);
 const latestOnEditRequest=useRef(onEditLandmarkRequest);
 latest.current=state;select.current=onSelect;
 latestLandmarkId.current=activeLandmarkId;
 selectLandmark.current=onSelectLandmark;
 latestSettings.current=settings || DEFAULT_VIEWER_SETTINGS;
 latestAddingLandmark.current=isAddingLandmark;
 latestOnAddPoint.current=onAddPointClicked;
 latestOnEditRequest.current=onEditLandmarkRequest;
 useEffect(()=>{
  const el=host.current!;let disposed=false,frame=0,dirty=true,ready=false,lastView='',lastReset=-1,lastIsolate='',layoutKey='',amount=0;
  let lastState:SceneState|null=null;
  const abort=new AbortController();
  let renderer:T.WebGLRenderer;
  // Dynamic Resolution Scaling (DRS) para garantir 60 FPS estáveis mesmo em telas Retina e GPUs móveis
  const initialMaxDPR = innerWidth < 768 ? 1.5 : 2.0;
  const drs = new DynamicResolutionScaler(Math.min(devicePixelRatio, initialMaxDPR), 1.0, initialMaxDPR);
  try{
    const initRes = GLFallbackManager.createRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      stencil: false,
      depth: true
    });
    renderer = initRes.renderer;
  }catch(e){
    onError(e instanceof Error ? e.message : 'Não foi possível iniciar o visualizador 3D neste navegador. Por favor, utilize um navegador compatível com WebGL.');
    return;
  }

  // Avaliação de Hardware Mobile e Desktop por Tiers
  const tierConfig = DeviceTierManager.evaluate(renderer);
  drs.reset(Math.min(devicePixelRatio, tierConfig.maxDPR), 1.0, tierConfig.maxDPR);

  // Otimização para TBDR (Tile-Based Deferred Rendering - Apple GPU, Adreno, Mali):
  // 1. sortObjects = true garante ordenação front-to-back para opacos, permitindo HSR/Early-Z descartar fragmentos
  // 2. autoClear unificado com stencil desligado evita múltiplos flushes do tile buffer on-chip para DRAM
  renderer.sortObjects = true;
  renderer.autoClear = true;
  renderer.autoClearColor = true;
  renderer.autoClearDepth = true;
  renderer.autoClearStencil = false;

  renderer.setPixelRatio(drs.getPixelRatio());renderer.setClearColor('#31302e');renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;el.appendChild(renderer.domElement);
  const perfMonitor = new PerformanceMonitor(renderer);
  (window as unknown as { __APEX_3D_PERF__?: PerformanceMonitor }).__APEX_3D_PERF__ = perfMonitor;
  const memoryGuard = new WebGLMemoryGuard(renderer, {
    onContextLost: () => {
      dirty = false;
      perfMonitor.getTelemetry().recordContextLost();
    },
    onContextRestored: () => {
      layoutKey = '';
      lastState = null;
      dirty = true;
      perfMonitor.getTelemetry().recordContextRestored();
    }
  });
  const ktx2Manager = new KTX2TextureManager(renderer);
  (window as unknown as { __APEX_KTX2__?: KTX2TextureManager }).__APEX_KTX2__ = ktx2Manager;
  renderer.domElement.setAttribute('aria-label','Anatomia humana 3D interativa. Arraste para orbitar, role ou use pinça para dar zoom, e clique em qualquer estrutura para inspecioná-la.');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.005,100),controls=new OrbitControls(camera,renderer.domElement);
  camera.position.set(1.4,1.05,3.6);controls.target.set(0,.85,0);controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=.01;controls.maxDistance=60;controls.maxPolarAngle=Math.PI*.96;controls.addEventListener('change',()=>{dirty=true;});controls.addEventListener('start',()=>{isAnimatingCam=false;});
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xfff5ea,0x1e1d1b,1.25));
  const key=new T.DirectionalLight(0xfff7ed,2.4);key.position.set(-2,4,3);scene.add(key);
  const rim=new T.DirectionalLight(0xdf9696,1.4);rim.position.set(2,2,-3);scene.add(rim);
  const ground=new T.Mesh(new T.CircleGeometry(30,96),new T.MeshStandardMaterial({color:0x1e1d1b,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.019;scene.add(ground);
  const platform=new T.Mesh(new T.CylinderGeometry(.68,.7,.028,100),new T.MeshStandardMaterial({color:0x272522,metalness:.12,roughness:.75}));platform.position.y=-.016;scene.add(platform);
  const ring=new T.Mesh(new T.RingGeometry(.63,.632,128),new T.MeshBasicMaterial({color:0xa43939,transparent:true,opacity:.5,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.001;scene.add(ring);
  const innerRing=new T.Mesh(new T.RingGeometry(.55,.551,128),new T.MeshBasicMaterial({color:0xdf9696,transparent:true,opacity:.2,side:T.DoubleSide}));innerRing.rotation.x=-Math.PI/2;innerRing.position.y=.001;scene.add(innerRing);
  const preferredDataType = GLFallbackManager.getPreferredDataTextureType();
  const width=T.MathUtils.ceilPowerOfTwo(atlas.parts.length),data=new Float32Array(width*4),partTexture=new T.DataTexture(data,width,1,T.RGBAFormat,preferredDataType);partTexture.needsUpdate=true;
  const selectedData=new Uint8Array(width*4),selectionTexture=new T.DataTexture(selectedData,width,1);selectionTexture.needsUpdate=true;
  const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[],pickers:(T.Mesh|undefined)[]=[],centers=atlas.parts.map(p=>new T.Vector3().fromArray(p.bounds[0]).add(new T.Vector3().fromArray(p.bounds[1])).multiplyScalar(.5));
  const offsets:T.Vector3[]=[],bounds=atlas.parts.map(p=>new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1])));
  const raycastClient = new RaycastWorkerClient();
  raycastClient.initParts(atlas.parts, bounds, centers);
  let packingWidth=1,packingHeight=1;
  const markerPositions=new Float32Array(atlas.parts.length*3),markerGeometry=new T.BufferGeometry();markerGeometry.setAttribute('position',new T.BufferAttribute(markerPositions,3));
  const markerMaterial=new T.PointsMaterial({color:0xdf9696,size:5,sizeAttenuation:false,transparent:true,opacity:.8,depthTest:false});
  markerMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;');};
  const markers=new T.Points(markerGeometry,markerMaterial);markers.frustumCulled=false;markers.renderOrder=10;markers.visible=false;scene.add(markers);

  // 3D visual markers for anatomical landmarks: lines + simple 3D text cards
  const landmarkGroup = new T.Group();
  scene.add(landmarkGroup);

  const cardTextureCache = new Map<string, T.CanvasTexture>();
  const badgeTextureCache = new Map<string, T.CanvasTexture>();

  // 3D Solid Cylinder Leader Line (unit length along +Z)
  const lineCylinderGeo = new T.CylinderGeometry(0.0012, 0.0012, 1, 8);
  lineCylinderGeo.translate(0, 0.5, 0);
  lineCylinderGeo.rotateX(Math.PI / 2);

  const lineCylinderMat = new T.MeshBasicMaterial({
    color: 0xef4444,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: 0.95
  });

  const lineInactiveMat = new T.MeshBasicMaterial({
    color: 0xf59e0b,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: 0.75
  });

  // Target contact sphere on the bone surface
  const targetPinGeo = new T.SphereGeometry(0.0034, 14, 14);
  const targetPinMat = new T.MeshBasicMaterial({
    color: 0xef4444,
    depthTest: true
  });

  const targetPinInactiveMat = new T.MeshBasicMaterial({
    color: 0xf59e0b,
    depthTest: true
  });

  // Target concentric ring on the bone surface
  const targetRingGeo = new T.RingGeometry(0.0044, 0.0064, 22);
  const targetRingMat = new T.MeshBasicMaterial({
    color: 0xfbbf24,
    side: T.DoubleSide,
    depthTest: true
  });

  const getBadgeTexture = (l: ComputedLandmark, index: number): T.CanvasTexture => {
    const isHC = latestSettings.current.highContrastLabels;
    const key = `${l.id}:${index}:${isHC ? 'hc' : 'std'}`;
    const cached = badgeTextureCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Circle background
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = isHC ? '#000000' : 'rgba(22, 20, 18, 0.94)';
    ctx.fill();

    ctx.strokeStyle = isHC ? '#facc15' : '#f59e0b';
    ctx.lineWidth = isHC ? 6 : 4;
    ctx.stroke();

    // Inner number
    ctx.fillStyle = isHC ? '#facc15' : '#fbbf24';
    ctx.font = isHC ? '900 30px system-ui, -apple-system, sans-serif' : 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${index + 1}`, 32, 33);

    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.minFilter = T.LinearFilter;
    badgeTextureCache.set(key, tex);
    return tex;
  };

  const getCardTexture = (l: ComputedLandmark, total: number, index: number): T.CanvasTexture => {
    const isHC = latestSettings.current.highContrastLabels;
    const key = `${l.id}:${l.name}:${l.category}:${index}:${isHC ? 'hc' : 'std'}`;
    const cached = cardTextureCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 140;
    const ctx = canvas.getContext('2d')!;

    // Rounded rectangle card
    const r = 18;
    const w = 506;
    const h = 134;
    const x = 3;
    const y = 3;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    // Background fill with high contrast dark glass or solid pitch black
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = isHC ? 16 : 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = isHC ? '#000000' : 'rgba(10, 9, 8, 0.96)';
    ctx.fill();

    // Glowing border (Ultra visible gold/amber on dark)
    ctx.strokeStyle = isHC ? '#facc15' : '#fbbf24';
    ctx.lineWidth = isHC ? 6 : 4;
    ctx.stroke();

    // Reset shadow for crisp text
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    // Number badge on left e.g. "7/10"
    const badgeW = 72;
    const badgeH = 34;
    const badgeX = 18;
    const badgeY = 20;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    } else {
      ctx.rect(badgeX, badgeY, badgeW, badgeH);
    }
    ctx.fillStyle = isHC ? '#facc15' : '#ef4444';
    ctx.fill();

    ctx.fillStyle = isHC ? '#000000' : '#ffffff';
    ctx.font = isHC ? '900 18px system-ui, -apple-system, sans-serif' : '800 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${index + 1}/${total}`, badgeX + badgeW / 2, badgeY + badgeH / 2);

    // Title (WCAG AAA contrast)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.font = isHC ? '900 28px system-ui, -apple-system, sans-serif' : '800 27px system-ui, -apple-system, sans-serif';
    let title = l.name;
    if (ctx.measureText(title).width > 380) {
      while (title.length > 5 && ctx.measureText(title + '…').width > 380) {
        title = title.slice(0, -1);
      }
      title += '…';
    }
    ctx.fillText(title, 102, 46);

    // Subtitle (Category and Latin in luminous gold)
    ctx.fillStyle = isHC ? '#fef08a' : '#fde047';
    ctx.font = isHC ? '700 20px system-ui, -apple-system, sans-serif' : '600 19px system-ui, -apple-system, sans-serif';
    const sub = l.categoryLabel + (l.latinName ? ` · ${l.latinName}` : '');
    let subText = sub;
    if (ctx.measureText(subText).width > 470) {
      while (subText.length > 5 && ctx.measureText(subText + '…').width > 470) {
        subText = subText.slice(0, -1);
      }
      subText += '…';
    }
    ctx.fillText(subText, 20, 96);

    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.minFilter = T.LinearFilter;
    cardTextureCache.set(key, texture);
    return texture;
  };

  const hover=document.createElement('div');hover.className='part-hover';hover.setAttribute('role','tooltip');hover.hidden=true;el.appendChild(hover);
  type Target={index:number;x:number;y:number;left:number;right:number;top:number;bottom:number};let targets:Target[]=[];
  const projected=new T.Vector3();
  const findTarget=(x:number,y:number,radius:number)=>{
   let best=-1,score=Infinity;
   for(const t of targets){const dx=Math.max(t.left-x,0,x-t.right),dy=Math.max(t.top-y,0,y-t.bottom),distance=Math.hypot(dx,dy);if(distance>radius)continue;const candidate=distance+Math.hypot(t.x-x,t.y-y)*.025;if(candidate<score){score=candidate;best=t.index;}}
   return best;
  };
  const materialFor=(system:string)=>{
   const isSkin = system === 'integumentary';
   const sysColor = SYSTEMS.find(s=>s.id===system)?.color??'#aebbb8';
   const m = tierConfig.materialType === 'lambert'
     ? new T.MeshLambertMaterial({
         color: sysColor,
         side: T.DoubleSide,
         transparent: isSkin,
         opacity: isSkin ? 0.45 : 1.0,
         depthWrite: true
       })
     : new T.MeshStandardMaterial({
         color: sysColor,
         metalness: tierConfig.metalness,
         roughness: tierConfig.roughness,
         side: T.DoubleSide,
         transparent: isSkin,
         opacity: isSkin ? 0.45 : 1.0,
         depthWrite: true
       });
   m.onBeforeCompile=shader=>{
    shader.uniforms.partState={value:partTexture};
    shader.uniforms.selectionState={value:selectionTexture};
    shader.uniforms.stateWidth={value:width};
    shader.vertexShader='attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected; varying vec3 vViewDir; varying vec3 vNormalDir;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); transformed += state.xyz; partVisible = state.w; partSelected = texture2D(selectionState, stateUv).r;\nvViewDir = -(modelViewMatrix * vec4(transformed, 1.0)).xyz;\nvNormalDir = normalMatrix * normal;');
    
    // Injeção de Dithered Transparency (Bayer Matrix 4x4) e tonalização Ghost
    shader.fragmentShader='varying float partVisible; varying float partSelected; varying vec3 vViewDir; varying vec3 vNormalDir;\n'+
      'const float bayer4x4[16] = float[16](\n'+
      '  0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,\n'+
      ' 12.0/16.0,  4.0/16.0, 14.0/16.0,  6.0/16.0,\n'+
      '  3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,\n'+
      ' 15.0/16.0,  7.0/16.0, 13.0/16.0,  5.0/16.0\n'+
      ');\n'+shader.fragmentShader;
    
    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\n'+
      'if (partVisible < 0.08) discard;\n'+
      'if (partVisible < 0.95) {\n'+
      '  int bx = int(mod(gl_FragCoord.x, 4.0));\n'+
      '  int by = int(mod(gl_FragCoord.y, 4.0));\n'+
      '  float threshold = bayer4x4[by * 4 + bx];\n'+
      '  if (partVisible < threshold) discard;\n'+
      '}'
    );

    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n'+
      'if (partVisible < 0.95) {\n'+
      '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.28, 0.34, 0.40), 0.75);\n'+
      '} else if (partSelected > 0.5) {\n'+
      '  vec3 nDir = normalize(vNormalDir);\n'+
      '  vec3 vDir = normalize(vViewDir);\n'+
      '  float ndotv = abs(dot(nDir, vDir));\n'+
      '  float rim = 1.0 - clamp(ndotv, 0.0, 1.0);\n'+
      '  float outlineEdge = smoothstep(0.45, 0.90, rim);\n'+
      '  vec3 brandCrimson = vec3(0.96, 0.18, 0.14);\n'+
      '  vec3 radiantGold = vec3(1.0, 0.85, 0.18);\n'+
      '  diffuseColor.rgb = mix(brandCrimson, radiantGold, outlineEdge);\n'+
      '}'
    );

    shader.fragmentShader=shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n'+
      'if (partSelected > 0.5) {\n'+
      '  vec3 nDir = normalize(vNormalDir);\n'+
      '  vec3 vDir = normalize(vViewDir);\n'+
      '  float ndotv = abs(dot(nDir, vDir));\n'+
      '  float rim = 1.0 - clamp(ndotv, 0.0, 1.0);\n'+
      '  float rimGlow = pow(rim, 1.8);\n'+
      '  float outlineEdge = smoothstep(0.40, 0.94, rim);\n'+
      '  vec3 emissiveCrimson = vec3(0.88, 0.12, 0.08);\n'+
      '  vec3 emissiveGold = vec3(1.0, 0.88, 0.25);\n'+
      '  totalEmissiveRadiance += mix(emissiveCrimson * 0.92, emissiveGold * 2.4, outlineEdge) + emissiveGold * (rimGlow * 1.8);\n'+
      '}'
    );
   };materials.push(m);return m;
  };
  const mats=new Map(SYSTEMS.map(s=>[s.id,materialFor(s.id)]));
  const pickerMat = new T.MeshBasicMaterial({ side: T.DoubleSide, visible: false });
  materials.push(pickerMat);
  let loaded=0;
  const loadChunk=async(ci:number)=>{
   const chunk=atlas.chunks[ci],compressed=!!chunk.gzip&&typeof DecompressionStream!=='undefined';
   const rawUrl = compressed ? chunk.gzip! : chunk.url;
   const baseUrl = import.meta.env.BASE_URL || './';
   const fetchUrl = rawUrl.startsWith('/') ? `${baseUrl.replace(/\/$/, '')}/${rawUrl.replace(/^\//, '')}` : rawUrl;
   const response=await fetch(fetchUrl,{signal:abort.signal});const buffer=await decodeModelResponse(response,chunk.bytes,compressed);if(disposed)return;
   const groups=new Map<string,T.BufferGeometry[]>();
   atlas.parts.forEach((p,i)=>{
    if(p.chunk!==ci)return;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,p.positions,p.vertexCount*3),3));
    // GPU normalized signed-short normals keep the complete atlas compact in memory.
    g.setAttribute('normal',new T.BufferAttribute(new Int16Array(buffer,p.normals,p.vertexCount*3),3,true));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,p.indices,p.indexCount),1));
    g.boundingBox=bounds[i].clone().expandByScalar(0.015);
    g.computeBoundingSphere();
    if (g.boundingSphere) g.boundingSphere.radius += 0.015;
    const pick=new T.Mesh(g, pickerMat);
    pick.matrixAutoUpdate=false;
    pick.updateMatrix();
    pick.updateMatrixWorld(true);
    pickers[i]=pick;
    geometries.push(g);
    g.setAttribute('partIndex',new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i),1));
    const list=groups.get(p.system)??[];list.push(g);groups.set(p.system,list);
   });
   groups.forEach((gs,system)=>{
     const geometry=mergeGeometries(gs,false);
     if(!geometry)throw new Error('Não foi possível compilar a geometria anatômica.');
     geometries.push(geometry);
     // Note: we intentionally do NOT dispose gs here so pickers[i] retain valid geometry buffers for precision raycast
     const mesh=new T.Mesh(geometry,mats.get(system as never));
     mesh.frustumCulled=false;
     scene.add(mesh);
   });
   lastState=null;loaded++;onProgress(Math.round(loaded/atlas.chunks.length*100));dirty=true;
  };
  (async()=>{try{let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<atlas.chunks.length){const i=cursor++;await loadChunk(i);}}));if(!disposed){ready=true;dirty=true;}}catch(e){if(!disposed)onError(e instanceof Error?e.message:'Não foi possível carregar as estruturas anatômicas.');}})();
  const fit=(view:string,extent=0,smooth=true)=>{
   const mobile=el.clientWidth<768;
   const normalDistance=mobile?Math.max(4.2,1.8*el.clientHeight/Math.max(160,el.clientHeight-300)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))):3.8;
   const reservedHeight=mobile?260:200;
   const availableAspect=Math.max(.35,(el.clientWidth-(mobile?20:120))/Math.max(160,el.clientHeight-reservedHeight));
   const atlasDistance=Math.max(packingHeight,packingWidth/availableAspect)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*(el.clientHeight/Math.max(160,el.clientHeight-reservedHeight))*1.05;
   const fullBodyDistance=T.MathUtils.lerp(normalDistance,Math.max(.2,atlasDistance),extent);
   const direction=view==='front'?new T.Vector3(0,.02,1):view==='back'?new T.Vector3(0,.02,-1):view==='side'?new T.Vector3(1,.02,0):new T.Vector3(.35,.06,1).normalize();

   let targetX=extent>.1&&el.clientWidth>767?-packingWidth*.12:0;
   let targetY=extent>.1||mobile?.85:.72;
   let targetZ=0;
   let targetDistance=fullBodyDistance;

   if(latest.current.selected.length>0){
     const selBox=new T.Box3();
     atlas.parts.forEach((p,i)=>{
       if(latest.current.selected.includes(p.id)){
         selBox.union(bounds[i].clone().translate(new T.Vector3(data[i*4],data[i*4+1],data[i*4+2])));
       }
     });
     if(!selBox.isEmpty()){
       const center=selBox.getCenter(new T.Vector3());
       const size=selBox.getSize(new T.Vector3());
       targetX=center.x;
       targetY=center.y;
       targetZ=center.z;
       const maxDim=Math.max(size.x,size.y,size.z,0.06);
       const fitDist=Math.max(0.24,(maxDim*(mobile?2.3:1.9))/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))));
       targetDistance=Math.min(fitDist,fullBodyDistance);
     }
   }
   const targetLook=new T.Vector3(targetX,targetY,targetZ);
   const targetPos=targetLook.clone().addScaledVector(direction,targetDistance);

   if(smooth && latestSettings.current.enableAnimations){
     camTargetLook.copy(targetLook);
     camTargetPos.copy(targetPos);
     isAnimatingCam=true;
   }else{
     controls.target.copy(targetLook);
     camera.position.copy(targetPos);
     controls.update();
     isAnimatingCam=false;
   }
   dirty=true;
  };
  const resize=()=>{
    layoutKey='';
    lastState=null;
    const maxDPR = Math.min(tierConfig.maxDPR, el.clientWidth < 768 || el.clientHeight < 600 ? 1.5 : 2.0);
    drs.reset(Math.min(devicePixelRatio, maxDPR), 1.0, maxDPR);
    renderer.setPixelRatio(drs.getPixelRatio());
    camera.aspect=el.clientWidth/el.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(el.clientWidth,el.clientHeight);
    fit(latest.current.view,amount,false);
  };const observer=new ResizeObserver(resize);observer.observe(el);
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),tap=new PointerTap();
  raycaster.params.Mesh = { threshold: 0 };

  const findPartAt = (screenX: number, screenY: number, maxDist = 22, isClick = false): number => {
    const hiddenSet = new Set(latest.current.hiddenParts || []);
    const selectedIds = new Set(latest.current.selected || []);
    const hasSolid = atlas.parts.some((p, i) => p.system !== 'integumentary' && data[i * 4 + 3] > 0.5);

    // 1. Gather all truly visible candidate meshes
    const candidates: T.Mesh[] = [];
    for (let i = 0; i < atlas.parts.length; i++) {
      const p = atlas.parts[i];
      if (hiddenSet.has(p.id)) continue;
      const vis = data[i * 4 + 3];
      if (vis < 0.08) continue;
      const m = pickers[i];
      if (m && m.visible) {
        candidates.push(m);
      }
    }

    if (candidates.length === 0) return -1;

    // 2. Direct Primary Raycast at cursor (screenX, screenY)
    pointer.set((screenX / el.clientWidth) * 2 - 1, -(screenY / el.clientHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const primaryHits = raycaster.intersectObjects(candidates, false);

    if (primaryHits.length > 0) {
      let targetIndex = -1;
      let targetHit: T.Intersection | null = null;

      for (const h of primaryHits) {
        const idx = pickers.indexOf(h.object as T.Mesh);
        if (idx < 0) continue;
        const part = atlas.parts[idx];

        // Drill through transparent skin if solid structures are behind it
        if (hasSolid && part.system === 'integumentary') {
          if (targetIndex < 0) {
            targetIndex = idx;
            targetHit = h;
          }
          continue;
        }

        // If clicking and the front-most part is ALREADY selected, drill down to the next deeper layer
        if (isClick && selectedIds.has(part.id) && primaryHits.length > 1) {
          continue;
        }

        targetIndex = idx;
        targetHit = h;
        break;
      }

      if (targetIndex >= 0 && targetHit) {
        // Check if there is a fine foreground structure (e.g. thin nerve, artery, or strip muscle)
        // floating in front of targetHit within a tight 2-3 pixel tolerance
        const tightOffsets: [number, number][] = [
          [-2, 0], [2, 0], [0, -2], [0, 2],
          [-3, -3], [3, 3]
        ];

        for (const [ox, oy] of tightOffsets) {
          const sx = screenX + ox;
          const sy = screenY + oy;
          if (sx < 0 || sx > el.clientWidth || sy < 0 || sy > el.clientHeight) continue;
          pointer.set((sx / el.clientWidth) * 2 - 1, -(sy / el.clientHeight) * 2 + 1);
          raycaster.setFromCamera(pointer, camera);
          const offHits = raycaster.intersectObjects(candidates, false);
          if (offHits.length > 0) {
            const topHit = offHits[0];
            const idx = pickers.indexOf(topHit.object as T.Mesh);
            if (idx >= 0 && idx !== targetIndex) {
              const part = atlas.parts[idx];
              const isForeground = part.system === 'nervous' || part.system === 'arterial' || part.system === 'venous';
              // Only override if the foreground structure is significantly closer to camera than what was hit directly
              if (isForeground && (targetHit.distance - topHit.distance) > 0.04) {
                return idx;
              }
            }
          }
        }

        return targetIndex;
      }
    }

    // 3. Fallback: Multi-sample raycast if primary ray hit empty space (near edge/contour of a muscle/bone)
    const sampleOffsets: [number, number][] = isClick
      ? [
          [-3, 0], [3, 0], [0, -3], [0, 3],
          [-5, -5], [5, -5], [-5, 5], [5, 5],
          [-8, 0], [8, 0], [0, -8], [0, 8]
        ]
      : [
          [-3, 0], [3, 0], [0, -3], [0, 3],
          [-5, -5], [5, 5]
        ];

    let bestSampleIndex = -1;
    let bestSampleScore = Infinity;

    for (const [ox, oy] of sampleOffsets) {
      const sx = screenX + ox;
      const sy = screenY + oy;
      if (sx < 0 || sx > el.clientWidth || sy < 0 || sy > el.clientHeight) continue;

      pointer.set((sx / el.clientWidth) * 2 - 1, -(sy / el.clientHeight) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(candidates, false);
      if (hits.length > 0) {
        for (const h of hits) {
          const idx = pickers.indexOf(h.object as T.Mesh);
          if (idx < 0) continue;
          const p = atlas.parts[idx];
          if (hasSolid && p.system === 'integumentary') continue;
          if (isClick && selectedIds.has(p.id) && hits.length > 1) continue;

          const score = h.distance * 10.0 + Math.hypot(ox, oy);
          if (score < bestSampleScore) {
            bestSampleScore = score;
            bestSampleIndex = idx;
          }
          break;
        }
      }
    }

    if (bestSampleIndex >= 0) {
      return bestSampleIndex;
    }

    // 4. 3D Box3 Proximity Tolerance (Crucial for curved/long strip muscles like Sartorius, Gracilis, Plantaris)
    pointer.set((screenX / el.clientWidth) * 2 - 1, -(screenY / el.clientHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const ray = raycaster.ray;
    const boxHitVec = new T.Vector3();
    let bestBoxIndex = -1;
    let bestBoxDist = Infinity;

    for (let i = 0; i < atlas.parts.length; i++) {
      const p = atlas.parts[i];
      if (hiddenSet.has(p.id)) continue;
      const vis = data[i * 4 + 3];
      if (vis < 0.08) continue;
      if (hasSolid && p.system === 'integumentary') continue;

      const dx = data[i * 4], dy = data[i * 4 + 1], dz = data[i * 4 + 2];
      const partBox = bounds[i].clone().translate(new T.Vector3(dx, dy, dz)).expandByScalar(0.025);
      if (ray.intersectBox(partBox, boxHitVec)) {
        const dist = ray.origin.distanceTo(boxHitVec);
        if (dist < bestBoxDist) {
          bestBoxDist = dist;
          bestBoxIndex = i;
        }
      }
    }

    if (bestBoxIndex >= 0) {
      return bestBoxIndex;
    }

    // 5. Screen-Space 2D Proximity Snap for small or isolated parts
    const viewProj = new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const m = viewProj.elements;
    let bestIndex = -1;
    let bestDist = maxDist;
    const w = el.clientWidth;
    const h = el.clientHeight;

    for (let i = 0; i < atlas.parts.length; i++) {
      const p = atlas.parts[i];
      if (hiddenSet.has(p.id)) continue;
      const vis = data[i * 4 + 3];
      if (vis < 0.08) continue;
      if (hasSolid && p.system === 'integumentary') continue;

      const c = centers[i];
      const wx = c.x + data[i * 4];
      const wy = c.y + data[i * 4 + 1];
      const wz = c.z + data[i * 4 + 2];

      const clipX = m[0] * wx + m[4] * wy + m[8] * wz + m[12];
      const clipY = m[1] * wx + m[5] * wy + m[9] * wz + m[13];
      const clipZ = m[2] * wx + m[6] * wy + m[10] * wz + m[14];
      const clipW = m[3] * wx + m[7] * wy + m[11] * wz + m[15];

      if (clipW <= 0) continue;
      const ndcZ = clipZ / clipW;
      if (ndcZ < -1 || ndcZ > 1) continue;

      const sx = ((clipX / clipW) + 1.0) * w * 0.5;
      const sy = (1.0 - (clipY / clipW)) * h * 0.5;

      const dist = Math.hypot(screenX - sx, screenY - sy);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }

    return bestIndex;
  };

  const down=(e:PointerEvent)=>{isAnimatingCam=false;hover.hidden=true;tap.down(e.pointerId,e.clientX,e.clientY,e.pointerType==='touch'?32:18);};
  const move=(e:PointerEvent)=>{
    tap.move(e.pointerId,e.clientX,e.clientY);
    if(e.buttons||e.pointerType==='touch'){hover.hidden=true;return;}
    const rect=el.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    let index=-1;

    // Check hover on 3D landmark pins or text cards first
    if(landmarkGroup.visible && landmarkGroup.children.length > 0){
      pointer.set((x/rect.width)*2-1,-(y/rect.height)*2+1);
      raycaster.setFromCamera(pointer,camera);
      const hitLandmarks = raycaster.intersectObjects(landmarkGroup.children, true);
      const hitObj = hitLandmarks.find(h => h.object.userData?.name);
      if(hitObj && hitObj.object.userData?.name){
        hover.hidden = false;
        hover.innerHTML = `
          <div class="part-hover-inner">
            <div class="part-hover-header">
              <span class="part-hover-dot" style="background:#fbbf24"></span>
              <span class="part-hover-system" style="color:#fbbf24">Acidente Anatômico 3D</span>
            </div>
            <div class="part-hover-title">${hitObj.object.userData.name}</div>
          </div>
        `;
        hover.style.left = `${Math.max(8,Math.min(x+14,el.clientWidth-290))}px`;
        hover.style.top = `${Math.max(8,Math.min(y+18,el.clientHeight-65))}px`;
        renderer.domElement.style.cursor = 'pointer';
        return;
      }
    }

    index = findPartAt(x, y, 16);
    hover.hidden=index<0;
    renderer.domElement.style.cursor=latestAddingLandmark.current?'crosshair':(index<0?'grab':'pointer');
    if(index>=0){
      const isHC = latestSettings.current.highContrastLabels;
      hover.className = `part-hover ${isHC ? 'high-contrast' : ''} ${latestAddingLandmark.current ? 'adding-mode-hover' : ''}`;
      const p = atlas.parts[index];
      const sys = SYSTEMS.find(s => s.id === p.system);
      const sysColor = isHC ? '#facc15' : (sys?.color || '#ef4444');
      const sysName = sys?.name || 'Anatomia';
      const ptName = translateAnatomicalName(p.name);
      if (latestAddingLandmark.current) {
        hover.innerHTML = `
          <div class="part-hover-inner">
            <div class="part-hover-header">
              <span class="part-hover-badge" style="background:#f59e0b;color:#000;font-weight:900;padding:1px 6px;border-radius:4px;font-size:10px;">🎯 NOVO ACIDENTE</span>
            </div>
            <div class="part-hover-title">Clique para marcar em: ${ptName}</div>
          </div>
        `;
      } else {
        hover.innerHTML = `
          <div class="part-hover-inner">
            <div class="part-hover-header">
              <span class="part-hover-dot" style="background:${sysColor}"></span>
              <span class="part-hover-system">${sysName}</span>
            </div>
            <div class="part-hover-title">${ptName}</div>
          </div>
        `;
      }
      hover.style.left=`${Math.max(8,Math.min(x+14,el.clientWidth-290))}px`;
      hover.style.top=`${Math.max(8,Math.min(y+18,el.clientHeight-65))}px`;
    }
  };
  const onZoomEvent = (e: Event) => {
    isAnimatingCam = false;
    const detail = (e as CustomEvent<{ direction?: 'in' | 'out'; action?: 'fit' }>).detail;
    const factor = latestSettings.current.cameraSpeed || 1.0;
    const inScale = Math.max(0.40, 1.0 - 0.30 * factor);
    const outScale = Math.min(1.80, 1.0 + 0.35 * factor);
    if (detail?.direction === 'in') {
      const offset = camera.position.clone().sub(controls.target);
      if (offset.length() > controls.minDistance + 0.002) {
        offset.multiplyScalar(inScale);
        camera.position.copy(controls.target).add(offset);
        controls.update();
        dirty = true;
      }
    } else if (detail?.direction === 'out') {
      const offset = camera.position.clone().sub(controls.target);
      if (offset.length() < controls.maxDistance - 0.5) {
        offset.multiplyScalar(outScale);
        camera.position.copy(controls.target).add(offset);
        controls.update();
        dirty = true;
      }
    } else if (detail?.action === 'fit') {
      fit(latest.current.view, amount, latestSettings.current.enableAnimations);
    }
  };
  window.addEventListener('apex:zoom', onZoomEvent);
  const onLandmarksChanged = () => {
    cardTextureCache.forEach(t => t.dispose());
    cardTextureCache.clear();
    badgeTextureCache.forEach(t => t.dispose());
    badgeTextureCache.clear();
    dirty = true;
  };
  window.addEventListener('apex:landmarks-changed', onLandmarksChanged);

  // Dedicated multi-touch pinch-to-zoom engine for mobile devices
  let pinchStartDistance = 0;
  let pinchStartCameraDistance = 0;
  let isPinching = false;

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      isPinching = true;
      isAnimatingCam = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistance = Math.hypot(dx, dy);
      pinchStartCameraDistance = camera.position.distanceTo(controls.target);
    } else {
      isPinching = false;
      pinchStartDistance = 0;
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && isPinching && pinchStartDistance > 5) {
      if (e.cancelable) e.preventDefault();
      isAnimatingCam = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDist = Math.hypot(dx, dy);
      if (currentDist > 5) {
        const ratio = pinchStartDistance / currentDist;
        const newDist = Math.max(
          controls.minDistance + 0.002,
          Math.min(controls.maxDistance, pinchStartCameraDistance * ratio)
        );
        const dir = camera.position.clone().sub(controls.target);
        if (dir.lengthSq() > 0.000001) {
          dir.normalize();
          camera.position.copy(controls.target).addScaledVector(dir, newDist);
          controls.update();
          dirty = true;
        }
      }
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      if (isPinching) {
        isPinching = false;
        pinchStartDistance = 0;
        dirty = true;
      }
    }
  };

  renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
  renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
  renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: true });
  renderer.domElement.addEventListener('touchcancel', onTouchEnd, { passive: true });

  const onDblClick = (e: MouseEvent) => {
    isAnimatingCam = false;
    const offset = camera.position.clone().sub(controls.target);
    if (offset.length() > controls.minDistance + 0.01) {
      offset.multiplyScalar(0.65);
      camera.position.copy(controls.target).add(offset);
      controls.update();
      dirty = true;
    }
  };
  renderer.domElement.addEventListener('dblclick', onDblClick);

  let lastTouchTapTime = 0;
  let lastTouchTapX = 0;
  let lastTouchTapY = 0;
  const cancel = (e: PointerEvent) => tap.cancel(e.pointerId);
  const up = (e: PointerEvent) => {
    const validTap = tap.up(e.pointerId, e.clientX, e.clientY);
    if (!validTap || !ready) return;

    // Double-tap zoom gesture on mobile touch screens
    if (e.pointerType === 'touch') {
      const now = performance.now();
      const distFromLastTap = Math.hypot(e.clientX - lastTouchTapX, e.clientY - lastTouchTapY);
      if (now - lastTouchTapTime < 340 && distFromLastTap < 45) {
        isAnimatingCam = false;
        const offset = camera.position.clone().sub(controls.target);
        if (offset.length() > controls.minDistance + 0.01) {
          offset.multiplyScalar(0.65);
          camera.position.copy(controls.target).add(offset);
          controls.update();
          dirty = true;
        }
        lastTouchTapTime = 0;
        return;
      }
      lastTouchTapTime = now;
      lastTouchTapX = e.clientX;
      lastTouchTapY = e.clientY;
    }

   const rect=renderer.domElement.getBoundingClientRect();
   pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
   raycaster.setFromCamera(pointer,camera);

   // Check if user tapped directly on a 3D landmark pin or card
   if(!latestAddingLandmark.current && landmarkGroup.visible && landmarkGroup.children.length > 0){
     const hitLandmarks = raycaster.intersectObjects(landmarkGroup.children, true);
     const hitObj = hitLandmarks.find(h => h.object.userData?.landmarkId);
     if(hitObj && hitObj.object.userData?.landmarkId){
       hover.hidden = true;
       selectLandmark.current?.(hitObj.object.userData.landmarkId);
       return;
     }
   }

   // Handle Raycast for adding a new landmark point on 3D piece surface
   if (latestAddingLandmark.current) {
     const hiddenSet = new Set(latest.current.hiddenParts || []);
     const candidatePickers: T.Mesh[] = [];
     const selIdx = atlas.parts.findIndex(p => latest.current.selected.includes(p.id));
     if (selIdx >= 0 && pickers[selIdx] && pickers[selIdx]!.visible) {
       candidatePickers.push(pickers[selIdx]!);
     }
     for (let idx = 0; idx < atlas.parts.length; idx++) {
       if (idx === selIdx) continue;
       const p = atlas.parts[idx];
       if (hiddenSet.has(p.id)) continue;
       if (data[idx * 4 + 3] < 0.08) continue;
       const m = pickers[idx];
       if (m && m.visible) {
         candidatePickers.push(m);
       }
     }

     const lmOffsets: [number, number][] = [
       [0, 0],
       [-2, 0], [2, 0], [0, -2], [0, 2],
       [-4, -4], [4, -4], [-4, 4], [4, 4]
     ];

     let bestHit: T.Intersection | null = null;
     let bestHitIndex = -1;
     let bestDepth = Infinity;

     for (const [ox, oy] of lmOffsets) {
       const sx = (e.clientX - rect.left) + ox;
       const sy = (e.clientY - rect.top) + oy;
       pointer.set((sx / rect.width) * 2 - 1, -(sy / rect.height) * 2 + 1);
       raycaster.setFromCamera(pointer, camera);

       const hits = raycaster.intersectObjects(candidatePickers, false);
       if (hits.length > 0) {
         const selHit = selIdx >= 0 ? hits.find(h => pickers.indexOf(h.object as T.Mesh) === selIdx) : null;
         const chosenHit = selHit || hits[0];
         const hitIdx = pickers.indexOf(chosenHit.object as T.Mesh);

         if (hitIdx >= 0) {
           const part = atlas.parts[hitIdx];
           const isThin = part.system === 'nervous' || part.system === 'arterial' || part.system === 'venous' || part.system === 'sensory';
           const depth = chosenHit.distance - (isThin ? 0.04 : 0);

           if (depth < bestDepth) {
             bestDepth = depth;
             bestHit = chosenHit;
             bestHitIndex = hitIdx;
           }
         }
       }
     }

     if (bestHit && bestHitIndex >= 0) {
       const part = atlas.parts[bestHitIndex];
       const dx = data[bestHitIndex * 4], dy = data[bestHitIndex * 4 + 1], dz = data[bestHitIndex * 4 + 2];
       const localPoint = bestHit.point.clone().sub(new T.Vector3(dx, dy, dz));
       const [min, max] = part.bounds;
       const sizeX = max[0] - min[0] || 0.001;
       const sizeY = max[1] - min[1] || 0.001;
       const sizeZ = max[2] - min[2] || 0.001;
       const isRight = part.name.toLowerCase().startsWith('right');
       const u_raw = Math.max(0, Math.min(1, (localPoint.x - min[0]) / sizeX));
       const v_raw = Math.max(0, Math.min(1, (localPoint.y - min[1]) / sizeY));
       const w_raw = Math.max(0, Math.min(1, (localPoint.z - min[2]) / sizeZ));
       const storedU = isRight ? 1 - u_raw : u_raw;

       hover.hidden = true;
       latestOnAddPoint.current?.({
         partId: part.id,
         partName: part.name,
         relativePos: [Number(storedU.toFixed(3)), Number(v_raw.toFixed(3)), Number(w_raw.toFixed(3))],
         worldPosition: [bestHit.point.x, bestHit.point.y, bestHit.point.z]
       });
       return;
     }
   }

   const clickX=e.clientX-rect.left,clickY=e.clientY-rect.top;
   const bestDist=e.pointerType==='touch'?34:22;

   const hitIndex = findPartAt(clickX, clickY, bestDist, true);
   if (hitIndex >= 0) {
     const partId = atlas.parts[hitIndex].id;
     if (!(latest.current.hiddenParts || []).includes(partId)) {
       hover.hidden = true;
       select.current(partId);
     }
   }
  };
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);
  const clock=new T.Clock();let lastExtent=-1;
  const camTargetPos=new T.Vector3(),camTargetLook=new T.Vector3();let isAnimatingCam=false;
  const thermalPacer = new ThermalFramePacer();
  const animate=()=>{
   if(disposed)return;frame=requestAnimationFrame(animate);
   const now = performance.now();
   if (!thermalPacer.shouldRender(now)) return;
   const dt=Math.min(clock.getDelta(),.05),s=latest.current;
   const userSettings = latestSettings.current;
   controls.enableDamping = userSettings.enableAnimations;
   controls.rotateSpeed = userSettings.cameraSpeed;
   controls.zoomSpeed = userSettings.cameraSpeed * 1.45;
   controls.panSpeed = userSettings.cameraSpeed;
   controls.autoRotateSpeed = (s.isolate ? 1.1 : .65) * userSettings.cameraSpeed;

   const changed=lastState?.visible!==s.visible||lastState?.selected!==s.selected||lastState?.isolate!==s.isolate||lastState?.isolateMode!==s.isolateMode||lastState?.hiddenParts!==s.hiddenParts;
   const moving=Math.abs(amount-s.explode)>.0001;
   if(moving){
     if(userSettings.enableAnimations){
       amount=T.MathUtils.damp(amount,s.explode,8,dt);
     }else{
       amount=s.explode;
     }
     dirty=true;
   }
   if(changed||moving||lastExtent<0){
    const visible=new Set(s.visible),selection=new Set(s.selected),hidden=new Set(s.hiddenParts||[]);
    const visibleParts=atlas.parts.filter(p=>!hidden.has(p.id)&&(s.isolate?(selection.has(p.id)||(s.isolateMode==='ghost'&&(visible.has(p.system)||p.system==='skeletal'))):visible.has(p.system)||selection.has(p.id)));
    const nextLayoutKey=visibleParts.map(p=>p.id).join(',')+':'+camera.aspect.toFixed(3);
    if(nextLayoutKey!==layoutKey){const layout=createExplosionLayout(visibleParts,camera.aspect);packingWidth=layout.width;packingHeight=layout.height;atlas.parts.forEach((p,i)=>{const cell=layout.cells.get(p.id);offsets[i]=cell?new T.Vector3(cell.x,cell.y+.85,0):centers[i].clone();});layoutKey=nextLayoutKey;if(amount>.05&&!s.isolate)fit(s.view,Math.max(0,(amount-.3)/.7));}

    atlas.parts.forEach((p,i)=>{
     const c=centers[i],destination=offsets[i];let dx=0,dy=0,dz=0;
     if(amount<=.45){const t=amount/.45;const group=SYSTEMS.findIndex(sys=>sys.id===p.system);const angle=group/SYSTEMS.length*Math.PI*2;dx=Math.sin(angle)*t*.48;dy=(c.y-.85)*t*.28;dz=Math.cos(angle)*t*.48;}
     else {const t=(amount-.45)/.55,group=SYSTEMS.findIndex(sys=>sys.id===p.system),angle=group/SYSTEMS.length*Math.PI*2;dx=T.MathUtils.lerp(Math.sin(angle)*.48,destination.x-c.x,t);dy=T.MathUtils.lerp((c.y-.85)*.28,destination.y-c.y,t);dz=T.MathUtils.lerp(Math.cos(angle)*.48,-c.z,t);}
     const selected=selection.has(p.id);
     let vis=0;
     if(hidden.has(p.id)){
       vis=0;
     }else if(s.isolate){
       if(selected){vis=1;}
       else if(s.isolateMode==='ghost'&&(visible.has(p.system)||p.system==='skeletal')){vis=0.22;}
       else{vis=0;}
     }else{
       vis=(visible.has(p.system)||selected)?1:0;
     }
     data.set([dx,dy,dz,vis],i*4);selectedData[i*4]=(selected&&!hidden.has(p.id))?255:0;
     markerPositions.set((data[i*4+3]>.5&&!hidden.has(p.id))?[c.x+dx,c.y+dy,c.z+dz]:[10000,10000,10000],i*3);const mesh=pickers[i];if(mesh){mesh.visible=!hidden.has(p.id);mesh.position.set(dx,dy,dz);mesh.updateMatrix();mesh.updateMatrixWorld(true);}
    });partTexture.needsUpdate=true;selectionTexture.needsUpdate=true;markerGeometry.attributes.position.needsUpdate=true;lastState=s;lastExtent=amount;dirty=true;
   }
   if(s.view!==lastView||s.reset!==lastReset){fit(s.view,amount,true);lastView=s.view;lastReset=s.reset;}
   if(moving&&!s.isolate)fit(s.view,Math.max(0,(amount-.3)/.7),false);
   const isolateKey=s.isolate?s.selected.join(',')+':'+s.isolateMode+':'+s.reset+':'+s.inspectorOpen+':'+camera.aspect:'';
   if(isolateKey!==lastIsolate||(s.isolate&&moving)){
    if(s.isolate){const box=new T.Box3();atlas.parts.forEach((p,i)=>{if(s.selected.includes(p.id))box.union(bounds[i].clone().translate(new T.Vector3(data[i*4],data[i*4+1],data[i*4+2])));});
     if(!box.isEmpty()){const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());const w=el.clientWidth,h=el.clientHeight,mobile=w<768,landscape=w>h&&h<=600;let left=20,right=w-20,top=mobile?150:90,bottom=mobile?h-190:h-110;const availableWidth=Math.max(150,right-left),availableHeight=Math.max(40,bottom-top);camera.setViewOffset(w,h,w/2-(left+right)/2,h/2-(top+bottom)/2,w,h);const maxDimension=Math.max(size.y*h/availableHeight,size.x*w/availableWidth/camera.aspect,size.z);const distance=Math.max(.08,maxDimension/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*1.32);controls.maxDistance=Math.max(40,distance*2.5);camTargetLook.copy(center);camTargetPos.copy(center).add(new T.Vector3(.22,.12,1).normalize().multiplyScalar(distance));isAnimatingCam=true;dirty=true;}
    }else if(lastIsolate){camera.clearViewOffset();fit(s.view,amount,true);}
    lastIsolate=isolateKey;
   }
   if(isAnimatingCam){
     if(!userSettings.enableAnimations){
       controls.target.copy(camTargetLook);
       camera.position.copy(camTargetPos);
       isAnimatingCam=false;
       controls.update();
       dirty=true;
     } else {
       controls.target.lerp(camTargetLook,.16);
       camera.position.lerp(camTargetPos,.16);
       controls.update();
       dirty=true;
       if(controls.target.distanceTo(camTargetLook)<.001&&camera.position.distanceTo(camTargetPos)<.002){
         controls.target.copy(camTargetLook);
         camera.position.copy(camTargetPos);
         isAnimatingCam=false;
       }
     }
   }
   
   // Orbit & Navigation: Always allow full 3D rotation, pinch-zoom, and pan
   controls.enableRotate=true;
   controls.enableZoom=true;
   controls.enablePan=true;
   controls.mouseButtons.LEFT=T.MOUSE.ROTATE;
   controls.mouseButtons.RIGHT=T.MOUSE.PAN;
   controls.touches.ONE=T.TOUCH.ROTATE;
   controls.touches.TWO=T.TOUCH.DOLLY_PAN;
   ground.visible=platform.visible=ring.visible=innerRing.visible=amount<.5&&!s.isolate;
   markers.visible=amount>.75;
   controls.autoRotate=s.rotate && userSettings.enableAnimations;
   controls.update();
   if(controls.autoRotate)dirty=true;

   // 3D Anatomical Landmarks update and projection (Oriented outward into free space)
   let currentLandmarks: ComputedLandmark[] = [];
   const showLandmarks = s.showLandmarks !== false;
   if(s.selected.length > 0 && showLandmarks){
     const selIdx = atlas.parts.findIndex(p => s.selected.includes(p.id));
     if(selIdx >= 0){
       const selPart = atlas.parts[selIdx];
       currentLandmarks = computeResolvedPartLandmarks(selPart.id, selPart.name, selPart.bounds);
     }
   }

   while(landmarkGroup.children.length > currentLandmarks.length){
     const obj = landmarkGroup.children.pop();
     if(obj){
       landmarkGroup.remove(obj);
       obj.traverse(o => {
         if (o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Sprite) {
           o.geometry?.dispose();
         }
       });
     }
   }

   if(currentLandmarks.length > 0 && s.selected.length > 0 && showLandmarks){
     const selIdx = atlas.parts.findIndex(p => s.selected.includes(p.id));
     const dx = data[selIdx * 4], dy = data[selIdx * 4 + 1], dz = data[selIdx * 4 + 2];
     let activeId = latestLandmarkId.current;
     if (!activeId || !currentLandmarks.some(l => l.id === activeId)) {
       activeId = currentLandmarks[0].id;
     }
     const boneCenter = centers[selIdx].clone().add(new T.Vector3(dx, dy, dz));

     currentLandmarks.forEach((l, li) => {
       let itemGroup = landmarkGroup.children[li] as T.Group | undefined;
       if (!itemGroup) {
         itemGroup = new T.Group();
         landmarkGroup.add(itemGroup);
       }

       const isActive = l.id === activeId;
       const wx = l.worldPosition[0] + dx, wy = l.worldPosition[1] + dy, wz = l.worldPosition[2] + dz;
       const surfPos = new T.Vector3(wx, wy, wz);

       // Vector from bone center to landmark contact point
       const radial = surfPos.clone().sub(boneCenter);
       const normal = radial.clone();
       if (normal.lengthSq() < 0.0001) normal.set(0, 1, 0);
       normal.normalize();

       // Direction from landmark to camera
       const toCamera = camera.position.clone().sub(surfPos).normalize();
       const dotCam = normal.dot(toCamera);
       const isFacingCamera = dotCam > -0.22;

       // Position pin slightly off the surface to avoid z-fighting
       const pinPos = surfPos.clone().addScaledVector(normal, 0.0028);

       if (isActive) {
         // Clean inactive elements
         const inactivePin = itemGroup.children.find(c => c.name === 'inactive-pin');
         if (inactivePin) itemGroup.remove(inactivePin);
         const inactiveLine = itemGroup.children.find(c => c.name === 'inactive-line');
         if (inactiveLine) itemGroup.remove(inactiveLine);
         const inactiveBadge = itemGroup.children.find(c => c.name === 'inactive-badge');
         if (inactiveBadge) itemGroup.remove(inactiveBadge);

         let pinMesh = itemGroup.children.find(c => c.name === 'active-pin') as T.Mesh | undefined;
         let ringMesh = itemGroup.children.find(c => c.name === 'active-ring') as T.Mesh | undefined;
         let lineMesh = itemGroup.children.find(c => c.name === 'active-line') as T.Mesh | undefined;
         let cardSprite = itemGroup.children.find(c => c.name === 'active-card') as T.Sprite | undefined;

         if (!pinMesh) {
           pinMesh = new T.Mesh(targetPinGeo, targetPinMat);
           pinMesh.name = 'active-pin';
           itemGroup.add(pinMesh);
         }
         if (!ringMesh) {
           ringMesh = new T.Mesh(targetRingGeo, targetRingMat);
           ringMesh.name = 'active-ring';
           itemGroup.add(ringMesh);
         }
         if (!lineMesh) {
           lineMesh = new T.Mesh(lineCylinderGeo, lineCylinderMat);
           lineMesh.name = 'active-line';
           itemGroup.add(lineMesh);
         }
         if (!cardSprite) {
           cardSprite = new T.Sprite(new T.SpriteMaterial({
             transparent: true,
             depthTest: false,
             depthWrite: false
           }));
           cardSprite.name = 'active-card';
           cardSprite.renderOrder = 999;
           itemGroup.add(cardSprite);
         }

         // Camera basis in the plane perpendicular to view direction
         const camRight = new T.Vector3().crossVectors(toCamera, camera.up).normalize();
         const camUp = new T.Vector3().crossVectors(camRight, toCamera).normalize();

         // Project displacement from bone center onto screen axes
         const screenX = radial.dot(camRight);
         const screenY = radial.dot(camUp);

         // Lead outward into the screen plane AWAY from the 3D piece into empty space
         const sideSign = screenX >= 0 ? 1 : -1;
         const vertSign = screenY >= 0 ? 0.38 : -0.38;

         const outwardDir = new T.Vector3()
           .addScaledVector(camRight, sideSign * 0.94)
           .addScaledVector(camUp, vertSign)
           .addScaledVector(toCamera, 0.08)
           .normalize();

         const lineDist = 0.085;
         const cardPos = pinPos.clone().addScaledVector(outwardDir, lineDist);

         // Position pin and ring on surface
         pinMesh.position.copy(pinPos);
         ringMesh.position.copy(pinPos);
         ringMesh.lookAt(camera.position);

         // Orient solid line from pin outward to card in empty space
         lineMesh.position.copy(pinPos);
         lineMesh.lookAt(cardPos);
         lineMesh.scale.set(1.0, 1.0, pinPos.distanceTo(cardPos));

         // Card sprite
         const tex = getCardTexture(l, currentLandmarks.length, li);
         (cardSprite.material as T.SpriteMaterial).map = tex;
         (cardSprite.material as T.SpriteMaterial).needsUpdate = true;
         cardSprite.position.copy(cardPos);
         const cardW = 0.112;
         cardSprite.scale.set(cardW, cardW * (140 / 512), 1);

         lineMesh.visible = isFacingCamera;
         cardSprite.visible = isFacingCamera;
         ringMesh.visible = isFacingCamera;
         pinMesh.visible = true;

         pinMesh.userData = { landmarkId: l.id, name: l.name, index: li };
         ringMesh.userData = { landmarkId: l.id, name: l.name, index: li };
         lineMesh.userData = { landmarkId: l.id, name: l.name, index: li };
         cardSprite.userData = { landmarkId: l.id, name: l.name, index: li };
       } else {
         // Inactive landmark: ONLY a neat surface pin and a small circular numbered beacon
         // NO LEADER LINES! That prevents ANY lines from crossing or overlapping the 3D piece!
         const activeChildren = itemGroup.children.filter(c => c.name.startsWith('active-'));
         activeChildren.forEach(c => itemGroup!.remove(c));
         const oldLine = itemGroup.children.find(c => c.name === 'inactive-line');
         if (oldLine) itemGroup.remove(oldLine);

         let inPinMesh = itemGroup.children.find(c => c.name === 'inactive-pin') as T.Mesh | undefined;
         let inBadgeSprite = itemGroup.children.find(c => c.name === 'inactive-badge') as T.Sprite | undefined;

         if (!inPinMesh) {
           inPinMesh = new T.Mesh(targetPinGeo, targetPinInactiveMat);
           inPinMesh.name = 'inactive-pin';
           itemGroup.add(inPinMesh);
         }
         if (!inBadgeSprite) {
           inBadgeSprite = new T.Sprite(new T.SpriteMaterial({
             transparent: true,
             depthTest: true,
             depthWrite: false
           }));
           inBadgeSprite.name = 'inactive-badge';
           inBadgeSprite.renderOrder = 980;
           itemGroup.add(inBadgeSprite);
         }

         inPinMesh.position.copy(pinPos);

         const bTex = getBadgeTexture(l, li);
         if ((inBadgeSprite.material as T.SpriteMaterial).map !== bTex) {
           (inBadgeSprite.material as T.SpriteMaterial).map = bTex;
           (inBadgeSprite.material as T.SpriteMaterial).needsUpdate = true;
         }
         inBadgeSprite.position.copy(pinPos).addScaledVector(toCamera, 0.005);
         const badgeW = 0.016;
         inBadgeSprite.scale.set(badgeW, badgeW, 1);

         inPinMesh.visible = isFacingCamera;
         inBadgeSprite.visible = isFacingCamera;

         inPinMesh.userData = { landmarkId: l.id, name: l.name, index: li };
         inBadgeSprite.userData = { landmarkId: l.id, name: l.name, index: li };
       }
     });
     landmarkGroup.visible = true;
   }else{
     landmarkGroup.visible = false;
   }
   if(dirty && memoryGuard.isReadyToRender()){
      perfMonitor.beginFrame();
      const renderStart = performance.now();
      renderer.render(scene,camera);
      const renderDuration = performance.now() - renderStart;
      perfMonitor.endFrame(renderDuration);
      thermalPacer.evaluateFrameTiming(renderDuration);
      if (drs.update(renderDuration)) {
        renderer.setPixelRatio(drs.getPixelRatio());
        dirty = true;
      }
      targets=[];if(amount>.45){const hasSolid=atlas.parts.some((p,i)=>p.system!=='integumentary'&&data[i*4+3]>.5);atlas.parts.forEach((p,i)=>{if(data[i*4+3]<.5||(hasSolid&&p.system==='integumentary'))return;let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(let corner=0;corner<8;corner++){projected.set(p.bounds[(corner&1)?1:0][0]+data[i*4],p.bounds[(corner&2)?1:0][1]+data[i*4+1],p.bounds[(corner&4)?1:0][2]+data[i*4+2]).project(camera);const x=(projected.x+1)*el.clientWidth/2,y=(1-projected.y)*el.clientHeight/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}projected.copy(centers[i]).add(new T.Vector3(data[i*4],data[i*4+1],data[i*4+2])).project(camera);if(projected.z< -1||projected.z>1)return;targets.push({index:i,x:(projected.x+1)*el.clientWidth/2,y:(1-projected.y)*el.clientHeight/2,left,right,top,bottom});});}dirty=false;}

  };animate();
  return()=>{
    disposed=true;
    abort.abort();
    cancelAnimationFrame(frame);
    observer.disconnect();
    controls.dispose();
    window.removeEventListener('apex:zoom', onZoomEvent);
    window.removeEventListener('apex:landmarks-changed', onLandmarksChanged);
    renderer.domElement.removeEventListener('touchstart', onTouchStart);
    renderer.domElement.removeEventListener('touchmove', onTouchMove);
    renderer.domElement.removeEventListener('touchend', onTouchEnd);
    renderer.domElement.removeEventListener('touchcancel', onTouchEnd);
    renderer.domElement.removeEventListener('dblclick', onDblClick);
    lineCylinderGeo.dispose();
    lineCylinderMat.dispose();
    lineInactiveMat.dispose();
    targetPinGeo.dispose();
    targetPinMat.dispose();
    targetPinInactiveMat.dispose();
    targetRingGeo.dispose();
    targetRingMat.dispose();
    cardTextureCache.forEach(t=>t.dispose());
    cardTextureCache.clear();
    badgeTextureCache.forEach(t=>t.dispose());
    badgeTextureCache.clear();
    landmarkGroup.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.Sprite){o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();}});
    geometries.forEach(g=>g.dispose());
    materials.forEach(m=>m.dispose());
    scene.traverse(o=>{if(o instanceof T.Mesh&&!geometries.includes(o.geometry)){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});
    env.dispose();
    partTexture.dispose();
    selectionTexture.dispose();
    markerGeometry.dispose();
    markerMaterial.dispose();
    hover.remove();
    raycastClient.dispose();
    memoryGuard.dispose();
    thermalPacer.dispose();
    ktx2Manager.dispose();
    delete (window as unknown as { __APEX_KTX2__?: KTX2TextureManager }).__APEX_KTX2__;
    perfMonitor.dispose();
    delete (window as unknown as { __APEX_3D_PERF__?: PerformanceMonitor }).__APEX_3D_PERF__;
    renderer.dispose();
    renderer.domElement.remove();
  };
 },[atlas]);
 return <div className="scene" ref={host}/>;
}
