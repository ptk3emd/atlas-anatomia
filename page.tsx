import {flushSync} from 'react-dom';
import {registerAtlasTools} from './agent-tools';
import {useEffect,useMemo,useRef,useState} from 'react';
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  Crosshair,
  Focus,
  Info,
  Layers3,
  Minus,
  Pause,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Sliders,
  X,
  ZoomIn,
  ZoomOut,
  Sparkles,
  HelpCircle,
  Eye,
  EyeOff,
  MapPin
} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from '@/components/ui/combobox';
import AnatomyScene from './scene';
import { ApexSelectionBlock } from '@/components/ApexSelectionBlock';
import { AnatomySearchModal } from '@/components/AnatomySearchModal';
import { SettingsModal } from '@/components/SettingsModal';
import { LandmarkEditModal } from '@/components/LandmarkEditModal';
import { type ViewerSettings, loadViewerSettings, saveViewerSettings } from './settings';
import {
  computeResolvedPartLandmarks,
  saveLandmark,
  deleteLandmark,
  resetLandmarksForPart
} from '@/landmark-store';
import { type AnatomicalLandmark, type ComputedLandmark } from '@/landmarks';
import {
  DEFAULT_VISIBLE,
  SYSTEMS,
  EXPLANATIONS,
  explanation,
  translateAnatomicalName,
  type Atlas,
  type Concept,
  type Part,
  type SceneState,
  type SystemId,
  type View
} from './anatomy';

const initial: SceneState = {
  explode: 0,
  visible: DEFAULT_VISIBLE,
  selected: [],
  isolate: false,
  showLandmarks: true,
  view: 'three-quarter',
  rotate: false,
  reset: 0
};

export default function Home() {
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [state, setState] = useState(initial);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<'layers' | 'search' | null>(null);
  const [details, setDetails] = useState(false);
  const [about, setAbout] = useState(false);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Concept | null>(null);
  const [activeLandmarkId, setActiveLandmarkId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ViewerSettings>(loadViewerSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Landmark creation and editing mode
  const [landmarksRevision, setLandmarksRevision] = useState(0);
  const [isAddingLandmark, setIsAddingLandmark] = useState(false);
  const [landmarkModal, setLandmarkModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    part?: Part;
    landmarkToEdit?: AnatomicalLandmark | null;
    initialRelativePos?: [number, number, number];
  }>({
    isOpen: false,
    mode: 'create'
  });

  const selectedPart = useMemo(() => {
    if (!atlas || state.selected.length === 0) return null;
    return atlas.parts.find(p => state.selected.includes(p.id)) || null;
  }, [atlas, state.selected]);

  const currentLandmarks = useMemo(() => {
    if (!selectedPart) return [];
    return computeResolvedPartLandmarks(selectedPart.id, selectedPart.name, selectedPart.bounds);
  }, [selectedPart, landmarksRevision]);

  useEffect(() => {
    const onLandmarksUpdated = () => setLandmarksRevision(r => r + 1);
    window.addEventListener('apex:landmarks-changed', onLandmarksUpdated);
    return () => window.removeEventListener('apex:landmarks-changed', onLandmarksUpdated);
  }, []);

  useEffect(() => {
    if (currentLandmarks.length > 0) {
      setActiveLandmarkId(currentLandmarks[0].id);
    } else {
      setActiveLandmarkId(null);
    }
  }, [selectedPart?.id]);

  useEffect(() => {
    const abort = new AbortController();
    setProgress(0);
    setError('');
    setAtlas(null);
    setChosen(null);
    setDetails(false);
    setState({ ...initial, visible: DEFAULT_VISIBLE });

    const baseUrl = (import.meta.env.BASE_URL || './').replace(/\/$/, '');
    const atlasUrl = `${baseUrl}/models/atlas.json`;

    fetch(atlasUrl, { signal: abort.signal })
      .then(r => {
        if (!r.ok) throw new Error('O catálogo de anatomia não pôde ser carregado.');
        return r.json();
      })
      .then(data => setAtlas(data as Atlas))
      .catch(e => {
        if (e.name !== 'AbortError') setError(e.message);
      });

    return () => abort.abort();
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '/') {
        e.preventDefault();
        setPanel('search');
        setDetails(false);
      } else if (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'f') {
        if (state.selected.length > 0) {
          e.preventDefault();
          setState(s => ({ ...s, isolate: !s.isolate, explode: 0 }));
        }
      } else if (e.key.toLowerCase() === 'h' || e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selected.length > 0) {
          e.preventDefault();
          handleHideSelectedPart();
        }
      } else if (e.key === 'Escape') {
        if (isAddingLandmark) {
          e.preventDefault();
          setIsAddingLandmark(false);
        } else if (state.isolate) {
          e.preventDefault();
          setState(s => ({ ...s, isolate: false }));
        } else if (state.selected.length > 0) {
          e.preventDefault();
          setState(s => ({ ...s, selected: [], isolate: false }));
          setChosen(null);
        } else if (panel) {
          e.preventDefault();
          setPanel(null);
        } else if (details) {
          e.preventDefault();
          setDetails(false);
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [state.selected, state.isolate, panel, details, isAddingLandmark]);

  const handleStartAddLandmark = () => {
    setIsAddingLandmark(true);
    setDetails(false);
    setPanel(null);
  };

  const handleCancelAddLandmark = () => {
    setIsAddingLandmark(false);
  };

  const handleAddPointClicked = (pointData: {
    partId: string;
    partName: string;
    relativePos: [number, number, number];
    worldPosition: [number, number, number];
  }) => {
    setIsAddingLandmark(false);
    const targetPart = atlas?.parts.find(p => p.id === pointData.partId) || selectedPart;
    if (!targetPart) return;

    if (!state.selected.includes(targetPart.id)) {
      setState(s => ({ ...s, selected: [targetPart.id], isolate: false, rotate: false }));
      setChosen({ id: targetPart.conceptId, name: targetPart.name, elements: [targetPart.id] });
    }

    setLandmarkModal({
      isOpen: true,
      mode: 'create',
      part: targetPart,
      initialRelativePos: pointData.relativePos
    });
  };

  const handleEditLandmark = (landmark: AnatomicalLandmark) => {
    if (!selectedPart) return;
    setLandmarkModal({
      isOpen: true,
      mode: 'edit',
      part: selectedPart,
      landmarkToEdit: landmark,
      initialRelativePos: landmark.relativePos
    });
  };

  const handleSaveLandmark = (saved: AnatomicalLandmark) => {
    const targetPart = landmarkModal.part || selectedPart;
    if (!targetPart) return;
    saveLandmark(targetPart.id, targetPart.name, saved);
    setLandmarksRevision(r => r + 1);
    setActiveLandmarkId(saved.id);
    setLandmarkModal(m => ({ ...m, isOpen: false }));
  };

  const handleDeleteLandmark = (landmarkId: string) => {
    const targetPart = landmarkModal.part || selectedPart;
    if (!targetPart) return;
    deleteLandmark(targetPart.id, targetPart.name, landmarkId);
    setLandmarksRevision(r => r + 1);
    if (activeLandmarkId === landmarkId) {
      setActiveLandmarkId(null);
    }
    setLandmarkModal(m => ({ ...m, isOpen: false }));
  };

  const handleResetLandmarks = () => {
    if (!selectedPart) return;
    if (window.confirm(`Deseja restaurar os acidentes originais de "${translateAnatomicalName(selectedPart.name)}"?`)) {
      resetLandmarksForPart(selectedPart.id, selectedPart.name);
      setLandmarksRevision(r => r + 1);
      setActiveLandmarkId(null);
    }
  };

  const parts = useMemo(() => new Map(atlas?.parts.map(p => [p.id, p])), [atlas]);
  const counts = useMemo(
    () => Object.fromEntries(SYSTEMS.map(s => [s.id, atlas?.parts.filter(p => p.system === s.id).length ?? 0])),
    [atlas]
  );
  const activeSystems = SYSTEMS.filter(s => counts[s.id] > 0);

  const selectedParts = state.selected.map(id => parts.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
  const selected = selectedParts[0];
  const system = SYSTEMS.find(s => s.id === selected?.system);

  const visibleCount =
    atlas?.parts.filter(p =>
      state.isolate
        ? state.selected.includes(p.id)
        : state.visible.includes(p.system) || state.selected.includes(p.id)
    ).length ?? 0;

  const results = useMemo(() => {
    if (!atlas) return [];
    const term = query.toLowerCase().trim();
    if (!term) {
      return ['heart', 'brain', 'liver', 'stomach', 'lung', 'kidney', 'femur', 'spleen', 'pancreas', 'aorta', 'trachea', 'urinary bladder']
        .map(name => atlas.concepts.find(c => c.name.toLowerCase() === name))
        .filter((x): x is Concept => !!x);
    }
    return atlas.concepts
      .filter(c => {
        const ptName = translateAnatomicalName(c.name).toLowerCase();
        return c.name.toLowerCase().includes(term) || ptName.includes(term) || c.id.toLowerCase().includes(term);
      })
      .sort((a, b) => a.name.length - b.name.length)
      .slice(0, 80);
  }, [atlas, query]);

  const handleHideSelectedPart = (idToHide?: string) => {
    const targetId = idToHide || state.selected[0];
    if (!targetId) return;
    setState(s => {
      const currentHidden = s.hiddenParts || [];
      const updatedHidden = currentHidden.includes(targetId) ? currentHidden : [...currentHidden, targetId];
      return {
        ...s,
        hiddenParts: updatedHidden,
        selected: s.selected.filter(id => id !== targetId),
        isolate: false
      };
    });
    setChosen(null);
  };

  const handleRestoreHiddenParts = () => {
    setState(s => ({
      ...s,
      hiddenParts: []
    }));
  };

  const choose = (c: Concept) => {
    setChosen(c);
    // Maintain exact camera position and orientation when selecting
    setState(s => ({ ...s, selected: c.elements, isolate: false, rotate: false }));
    setPanel(null);
  };

  useEffect(() => {
    if (!atlas) return;
    return registerAtlasTools(atlas, c => flushSync(() => choose(c)));
  }, [atlas]);

  const choosePart = (id: string) => {
    const p = parts.get(id);
    if (!p) return;
    setChosen({ id: p.conceptId, name: p.name, elements: [id] });
    // Maintain exact current 3D camera angle without snapping to the front!
    setState(s => ({ ...s, selected: [id], isolate: false, rotate: false }));
    setPanel(null);
  };

  const toggle = (id: SystemId) => {
    setDetails(false);
    setState(s => ({
      ...s,
      selected: [],
      isolate: false,
      visible: s.visible.includes(id) ? s.visible.filter(x => x !== id) : [...s.visible, id]
    }));
  };

  const reset = () => {
    setState(s => ({ ...initial, visible: DEFAULT_VISIBLE, reset: s.reset + 1 }));
    setChosen(null);
    setDetails(false);
    setPanel(null);
  };

  const openPanel = (next: 'layers' | 'search') => {
    setDetails(false);
    setPanel(p => (p === next ? null : next));
  };

  const handleZoom = (direction: 'in' | 'out') => {
    window.dispatchEvent(new CustomEvent('apex:zoom', { detail: { direction } }));
  };

  return (
    <main
      className={`studio ${settings.highContrastLabels ? 'high-contrast-labels' : ''} ${
        !settings.enableAnimations ? 'motion-reduced' : ''
      }`}
      id="apexmed-atlas"
    >
      {atlas && (
        <AnatomyScene
          atlas={atlas}
          state={{ ...state, inspectorOpen: details && selectedParts.length > 0 }}
          activeLandmarkId={activeLandmarkId}
          settings={settings}
          isAddingLandmark={isAddingLandmark}
          onAddPointClicked={handleAddPointClicked}
          onSelect={choosePart}
          onSelectLandmark={setActiveLandmarkId}
          onEditLandmarkRequest={landmarkId => {
            const found = currentLandmarks.find(l => l.id === landmarkId);
            if (found) handleEditLandmark(found);
          }}
          onProgress={n => {
            setProgress(n);
            if (n === 100) setError('');
          }}
          onError={setError}
        />
      )}

      {/* Floating Guidance Banner when Landmark Placement Mode is Active */}
      {isAddingLandmark && (
        <div className="landmark-placement-floating-banner glass" role="status">
          <div className="flex items-center gap-2.5">
            <span className="adding-pulse-dot" />
            <div className="text-left">
              <strong className="block text-xs text-amber-300 font-semibold">
                Modo de Marcação 3D Ativo
              </strong>
              <span className="text-[11px] text-neutral-200">
                Clique com o cursor sobre qualquer ponto da peça para definir o acidente anatômico
              </span>
            </div>
          </div>
          <button
            type="button"
            className="landmark-placement-cancel-btn"
            onClick={handleCancelAddLandmark}
            title="Cancelar modo de criação"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="vignette" />

      {/* Identity Brand Header */}
      <header className="identity" id="main-header">
        <h1>
          ApexMed
          <span className="edition">3D</span>
        </h1>
      </header>

      {/* Top Bar Actions */}
      <nav className="top-actions" aria-label="Painéis do atlas" id="top-nav">
        <button
          id="btn-search-toggle"
          type="button"
          className="search-top-pill glass"
          onClick={() => openPanel('search')}
          aria-label="Buscar estruturas anatômicas (/)"
          title="Buscar estruturas anatômicas (/)"
        >
          <Search size={14} className="text-amber-400 flex-shrink-0" />
          <span className="search-pill-label">Buscar estruturas</span>
          <span className="search-pill-kbd desktop-only">/</span>
        </button>
        <Button
          id="btn-open-layers"
          variant="ghost"
          className={panel === 'layers' ? 'active icon-button' : 'icon-button'}
          onClick={() => openPanel('layers')}
          aria-label="Sistemas anatômicos"
          title="Sistemas e Camadas"
        >
          <Layers3 size={16} />
        </Button>
        <Button
          id="btn-landmark-mode-toggle"
          variant="ghost"
          className={isAddingLandmark ? 'active icon-button adding-active-btn' : 'icon-button'}
          onClick={() => {
            if (isAddingLandmark) {
              handleCancelAddLandmark();
            } else {
              handleStartAddLandmark();
            }
          }}
          aria-label={isAddingLandmark ? 'Cancelar modo de marcação de acidente' : 'Criar acidente anatômico clicando na peça (3D)'}
          title={isAddingLandmark ? 'Cancelar modo de marcação' : 'Criar acidente anatômico clicando na peça (3D)'}
        >
          <MapPin size={16} className={isAddingLandmark ? 'text-amber-400 animate-pulse' : ''} />
        </Button>
        <Button
          id="btn-settings-toggle"
          variant="ghost"
          className={settingsOpen ? 'active icon-button' : 'icon-button'}
          onClick={() => {
            setDetails(false);
            setPanel(null);
            setSettingsOpen(true);
          }}
          aria-label="Configurações e acessibilidade"
          title="Configurações (Câmera, Animações e Contraste)"
        >
          <Sliders size={16} />
        </Button>
        <Button
          id="btn-about-toggle"
          variant="ghost"
          className="icon-button"
          aria-label="Sobre o atlas"
          onClick={() => {
            setDetails(false);
            setPanel(null);
            setAbout(true);
          }}
          title="Sobre"
        >
          <Info size={16} />
        </Button>
      </nav>

      {/* Backdrop for layers panel on mobile and tablet */}
      {panel === 'layers' && (
        <div
          className="panel-backdrop"
          onClick={() => setPanel(null)}
          aria-hidden="true"
        />
      )}

      {/* Layers / Systems Panel */}
      <section
        id="panel-systems"
        className={`layers-panel glass ${panel === 'layers' ? 'open' : ''}`}
        aria-label="Sistemas anatômicos"
      >
        <div className="panel-heading">
          <span>Sistemas Anatômicos</span>
          <Button
            id="btn-close-systems"
            variant="ghost"
            className="icon-button close-panel-btn"
            onClick={() => setPanel(null)}
            aria-label="Fechar sistemas"
          >
            <X size={16} />
          </Button>
          <Badge variant="secondary" className="desktop-only small-number">
            {activeSystems.length}
          </Badge>
        </div>

        <div className="layer-presets" id="system-presets">
          <Button
            id="btn-preset-all"
            variant="ghost"
            aria-pressed={activeSystems.every(x => state.visible.includes(x.id))}
            onClick={() => setState(s => ({ ...s, selected: [], isolate: false, visible: activeSystems.map(x => x.id) }))}
          >
            Todos
          </Button>
          <Button
            id="btn-preset-skeleton"
            variant="ghost"
            aria-pressed={state.visible.length === 1 && state.visible[0] === 'skeletal'}
            onClick={() => setState(s => ({ ...s, selected: [], isolate: false, visible: ['skeletal'] }))}
          >
            Esqueleto
          </Button>
          <Button
            id="btn-preset-organs"
            variant="ghost"
            aria-pressed={
              state.visible.length === 6 &&
              ['cardiac', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive'].every(id =>
                state.visible.includes(id as SystemId)
              )
            }
            onClick={() =>
              setState(s => ({
                ...s,
                selected: [],
                isolate: false,
                visible: ['cardiac', 'respiratory', 'digestive', 'urinary', 'endocrine', 'reproductive']
              }))
            }
          >
            Órgãos
          </Button>
        </div>

        <div className="system-list" id="system-items-list">
          {activeSystems.map(s => (
            <div className={`system-row ${state.visible.includes(s.id) ? 'enabled' : ''}`} key={s.id}>
              <Button
                id={`btn-system-${s.id}`}
                variant="ghost"
                className="system-name"
                title={`Exibir apenas ${s.name.toLowerCase()}`}
                onClick={() => setState(v => ({ ...v, visible: [s.id], isolate: false, selected: [] }))}
              >
                <span className="system-dot" style={{ background: s.color }} />
                <span>{s.name}</span>
                <span className="system-count">{counts[s.id]}</span>
              </Button>
              <Switch
                id={`switch-${s.id}`}
                checked={state.visible.includes(s.id)}
                onCheckedChange={() => toggle(s.id)}
                aria-label={`Alternar ${s.name}`}
              />
            </div>
          ))}
        </div>

        <div className="panel-foot">
          <span>{visibleCount.toLocaleString('pt-BR')} peças ativas</span>
          <div className="flex items-center gap-1.5">
            {(state.hiddenParts?.length || 0) > 0 && (
              <Button
                variant="ghost"
                className="text-red-300 hover:text-red-200 text-xs px-2"
                onClick={handleRestoreHiddenParts}
                title="Restaurar todas as peças anatômicas apagadas"
              >
                Restaurar ({state.hiddenParts?.length})
              </Button>
            )}
            <Button
              id="btn-hide-all-systems"
              variant="ghost"
              onClick={() => setState(s => ({ ...s, visible: [], selected: [], isolate: false }))}
            >
              Ocultar todos
            </Button>
          </div>
        </div>
      </section>

      {/* Search & Anatomical Structure Catalog Modal */}
      {atlas && (
        <AnatomySearchModal
          isOpen={panel === 'search'}
          onClose={() => setPanel(null)}
          atlas={atlas}
          onSelectConcept={choose}
          onSelectPart={choosePart}
        />
      )}

      {/* Settings & Accessibility Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updater => {
          setSettings(prev => {
            const next = updater(prev);
            saveViewerSettings(next);
            return next;
          });
        }}
      />

      {/* Landmark Creation & Editing Modal */}
      <LandmarkEditModal
        isOpen={landmarkModal.isOpen}
        mode={landmarkModal.mode}
        part={landmarkModal.part}
        landmarkToEdit={landmarkModal.landmarkToEdit}
        initialRelativePos={landmarkModal.initialRelativePos}
        onSave={handleSaveLandmark}
        onDelete={handleDeleteLandmark}
        onClose={() => setLandmarkModal(m => ({ ...m, isOpen: false }))}
      />

      {/* Pedagogical Study Pathways & Neuropsychology Guide Modal */}
      {/* Unified Camera & View Controls Rail (All devices: Desktop, Tablet, Mobile) */}
      <nav id="camera-controls-rail" className="camera-controls-rail glass" aria-label="Controles de visualização e câmera">
        <div className="camera-view-angles" role="group" aria-label="Ângulos de visão">
          {(['three-quarter', 'front', 'side', 'back'] as View[]).map((v, i) => (
            <Button
              id={`btn-view-${v}`}
              variant="ghost"
              key={v}
              className={`camera-btn ${state.view === v ? 'active' : ''}`}
              aria-pressed={state.view === v}
              disabled={state.explode > 0.8 && v !== 'front'}
              onClick={() => setState(s => ({ ...s, view: v, reset: s.reset + 1, rotate: false }))}
              title={`Visão ${['Três quartos', 'Frontal', 'Lateral', 'Posterior'][i]}`}
              aria-label={`Visão ${['Três quartos', 'Frontal', 'Lateral', 'Posterior'][i]}`}
            >
              <span>{['¾', 'F', 'L', 'P'][i]}</span>
            </Button>
          ))}
        </div>
        <div className="camera-rail-divider" />
        <Button
          id="btn-zoom-in"
          variant="ghost"
          className="camera-btn"
          aria-label="Aproximar zoom (+)"
          title="Aproximar zoom (+)"
          onClick={() => handleZoom('in')}
        >
          <Plus size={16} />
        </Button>
        <Button
          id="btn-zoom-out"
          variant="ghost"
          className="camera-btn"
          aria-label="Afastar zoom (-)"
          title="Afastar zoom (-)"
          onClick={() => handleZoom('out')}
        >
          <Minus size={16} />
        </Button>
        <Button
          id="btn-fit-model"
          variant="ghost"
          className="camera-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('apex:zoom', { detail: { action: 'fit' } }))}
          aria-label="Centralizar e enquadrar modelo"
          title="Enquadrar modelo"
        >
          <Crosshair size={15} />
        </Button>
        <div className="camera-rail-divider" />
        <Button
          id="btn-toggle-rotate"
          variant="ghost"
          className={`camera-btn ${state.rotate ? 'active' : ''}`}
          disabled={state.explode >= 0.4}
          aria-label={state.rotate ? 'Pausar rotação' : 'Girar modelo 360°'}
          title="Rotação automática"
          onClick={() => setState(s => ({ ...s, rotate: !s.rotate }))}
        >
          {state.rotate ? <Pause size={15} /> : <RotateCw size={15} />}
        </Button>
        <Button
          id="btn-reset-camera"
          variant="ghost"
          className="camera-btn"
          aria-label="Redefinir visualização e camadas"
          title="Redefinir"
          onClick={reset}
        >
          <RotateCcw size={15} />
        </Button>
        {state.selected.length > 0 && (
          <>
            <div className="camera-rail-divider" />
            <Button
              id="btn-quick-isolate"
              variant="ghost"
              className={`camera-btn ${state.isolate ? 'active isolate-active-btn' : ''}`}
              aria-label={state.isolate ? 'Restaurar corpo completo (I)' : 'Isolar estrutura 3D (I)'}
              title={state.isolate ? 'Restaurar corpo completo (I)' : 'Isolar estrutura selecionada (I)'}
              onClick={() => setState(s => ({ ...s, isolate: !s.isolate, explode: 0 }))}
            >
              <Focus size={15} />
            </Button>
          </>
        )}
      </nav>

      {/* Apex Clinical Structure Selection & Body View Selector Block */}
      {state.selected.length > 0 && (
        <ApexSelectionBlock
          selected={selected}
          chosen={chosen}
          system={system}
          selectedParts={selectedParts}
          view={state.view}
          onViewChange={v => setState(s => ({ ...s, view: v, reset: s.reset + 1, rotate: false }))}
          isIsolated={state.isolate}
          isolateMode={state.isolateMode ?? 'solo'}
          onToggleIsolate={() => setState(s => ({ ...s, isolate: !s.isolate, explode: 0 }))}
          onSetIsolateMode={mode => setState(s => ({ ...s, isolateMode: mode }))}
          isRotating={state.rotate}
          onToggleRotate={() => setState(s => ({ ...s, rotate: !s.rotate }))}
          onRecenter={() => setState(s => ({ ...s, reset: s.reset + 1 }))}
          onClearSelection={() => {
            setState(s => ({ ...s, selected: [], isolate: false }));
            setChosen(null);
            setActiveLandmarkId(null);
          }}
          onSelectPart={choosePart}
          landmarks={currentLandmarks}
          activeLandmarkId={activeLandmarkId}
          onSelectLandmark={setActiveLandmarkId}
          showLines={state.showLandmarks !== false}
          onToggleLines={() => setState(s => ({ ...s, showLandmarks: s.showLandmarks === false ? true : false }))}
          onHidePart={() => handleHideSelectedPart()}
          isAddingLandmark={isAddingLandmark}
          onStartAddLandmark={handleStartAddLandmark}
          onCancelAddLandmark={handleCancelAddLandmark}
          onEditLandmark={handleEditLandmark}
          onResetLandmarks={handleResetLandmarks}
        />
      )}

      {/* Scene Caption */}
      <div className="scene-caption" id="scene-caption">
        <span className="caption-line" />
        <span>
          {state.isolate
            ? translateAnatomicalName(chosen?.name ?? 'ESTRUTURA SELECIONADA')
            : state.explode > 0.95
            ? 'DISPERSÃO ANATÔMICA COMPLETA · EXPLORE E CLIQUE EM QUALQUER PEÇA'
            : state.explode > 0.05
            ? 'ESTRUTURAS EM DISPERSÃO 3D'
            : 'ADULTO · REFERÊNCIA ANATÔMICA MASCULINA'}
        </span>
        <span className="caption-line" />
      </div>

      {/* Quick System Explorer Dock (When no part is selected) */}
      {state.selected.length === 0 && (
        <aside className="bottom-educational-dock glass" id="bottom-edu-dock" aria-label="Exploração anatômica">
          <div className="edu-dock-header">
            <div className="edu-dock-tag">
              <Activity size={13} className="text-amber-400" />
              <span>Atlas Anatômico Interativo</span>
            </div>
            <button
              id="btn-open-search-edu"
              type="button"
              className="edu-search-btn"
              onClick={() => openPanel('search')}
              title="Buscar estrutura anatômica (Pressione /)"
              aria-label="Buscar estrutura"
            >
              <Search size={14} />
              <span>Buscar estrutura</span>
              <kbd className="desktop-only text-[10px] bg-white/10 px-1 rounded">/</kbd>
            </button>
          </div>

          <div className="edu-dock-systems" role="group" aria-label="Acesso rápido aos sistemas">
            {(state.hiddenParts?.length || 0) > 0 && (
              <button
                type="button"
                className="edu-system-pill bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30"
                onClick={handleRestoreHiddenParts}
                title="Restaurar todas as peças anatômicas apagadas"
              >
                <RotateCcw size={12} />
                <span>Restaurar ({state.hiddenParts?.length} apagadas)</span>
              </button>
            )}
            <button
              type="button"
              className={`edu-system-pill ${isAddingLandmark ? 'active bg-amber-500/20 border-amber-400 text-amber-300' : ''}`}
              onClick={isAddingLandmark ? handleCancelAddLandmark : handleStartAddLandmark}
              title="Marcar novo acidente anatômico clicando na peça (3D)"
            >
              <MapPin size={12} className={isAddingLandmark ? 'text-amber-400 animate-pulse' : 'text-amber-400'} />
              <span>{isAddingLandmark ? 'Clique na peça 3D...' : '+ Criar Acidente'}</span>
            </button>
            <button
              type="button"
              className="edu-system-pill"
              onClick={() => openPanel('layers')}
              title="Abrir painel completo de sistemas e camadas"
            >
              <Layers3 size={13} />
              <span>Sistemas ({activeSystems.length})</span>
            </button>
            <button
              type="button"
              className={`edu-system-pill ${state.visible.length === 1 && state.visible[0] === 'skeletal' ? 'active' : ''}`}
              onClick={() => setState(s => ({ ...s, selected: [], isolate: false, visible: ['skeletal'] }))}
            >
              <span className="w-2 h-2 rounded-full bg-[#fde047]" />
              <span>Esquelético</span>
            </button>
            <button
              type="button"
              className={`edu-system-pill ${state.visible.length === 1 && state.visible[0] === 'muscular' ? 'active' : ''}`}
              onClick={() => setState(s => ({ ...s, selected: [], isolate: false, visible: ['muscular'] }))}
            >
              <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
              <span>Muscular</span>
            </button>
            <button
              type="button"
              className={`edu-system-pill ${state.visible.length === 1 && state.visible[0] === 'cardiac' ? 'active' : ''}`}
              onClick={() => setState(s => ({ ...s, selected: [], isolate: false, visible: ['cardiac'] }))}
            >
              <span className="w-2 h-2 rounded-full bg-[#dc2626]" />
              <span>Cardiovascular</span>
            </button>
            <button
              type="button"
              className={`edu-system-pill ${state.visible.length === 1 && state.visible[0] === 'nervous' ? 'active' : ''}`}
              onClick={() => setState(s => ({ ...s, selected: [], isolate: false, visible: ['nervous'] }))}
            >
              <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
              <span>Nervoso</span>
            </button>
          </div>
        </aside>
      )}

      {/* Footer info */}
      <footer className="studio-footer" id="main-footer">
        <span>
          {state.explode > 0.8 ? 'Arraste para mover' : 'Arraste para orbitar'} <b>·</b> Pinça ou scroll para zoom{' '}
          <b>·</b> Clique para inspecionar
        </span>
        <Button
          id="btn-source-credits"
          variant="ghost"
          onClick={() => {
            setDetails(false);
            setPanel(null);
            setAbout(true);
          }}
        >
          Fonte & Créditos <ArrowUpRight size={12} />
        </Button>
      </footer>

      {/* Loading bar */}
      {progress < 100 && !error && (
        <div className="loading glass" role="status" id="loading-indicator">
          <Activity size={20} className="animate-spin" />
          <div>
            <strong>Preparando o atlas anatômico...</strong>
            <span>
              {progress}% · Carregando {atlas?.parts.length.toLocaleString('pt-BR') ?? '2.234'} estruturas 3D
            </span>
            <div className="loading-track">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="loading glass error" role="alert" id="error-alert">
          <p>{error}</p>
          <Button id="btn-reload-page" variant="ghost" onClick={() => location.reload()}>
            Recarregar visualizador
          </Button>
        </div>
      )}

      {/* About Sheet */}
      <Sheet open={about} onOpenChange={setAbout}>
        <SheetContent className="about-sheet glass" id="sheet-about">
          <div className="eyebrow">FONTE & ESCOPO ACADÊMICO</div>
          <SheetTitle className="structure-title">O corpo humano, revelado em dados.</SheetTitle>
          <SheetDescription>
            Explore o atlas anatômico 3D de referência do projeto BodyParts3D com a precisão e a linguagem clínica ApexMed.
          </SheetDescription>
          <div className="about-copy">
            <p>
              <strong>Modelo Adulto · BodyParts3D</strong>
              <br />
              2.234 malhas poligonais e 3.432 conceitos anatômicos catalogados a partir de varreduras por ressonância
              magnética e dados de referência do sexo masculino.
            </p>
            <p>
              Esta reconstrução oferece visualização estrutural e correlação morfofuncional interativa. Cada órgão e
              tecido é mapeado em seu sistema orgânico correspondente, permitindo o estudo segmentado ou a dissecação
              por explosão tridimensional.
            </p>
            <p>
              A paleta de cores e o contraste do cockpit médico ApexMed foram calibrados para máxima distinção
              cognitiva em sessões prolongadas de estudo e revisão médica.
            </p>
            <h3>Direitos e Fontes de Dados</h3>
            <p>
              BodyParts3D, © The Database Center for Life Science, disponibilizado sob licença Creative Commons
              Attribution 4.0 International (CC BY 4.0).
            </p>
            <a
              id="link-license-dataset"
              href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
              target="_blank"
              rel="noreferrer"
            >
              Licença da base de dados <ArrowUpRight size={14} />
            </a>
            <a
              id="link-dataset-download"
              href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html"
              target="_blank"
              rel="noreferrer"
            >
              Geometrias originais e metadados <ArrowUpRight size={14} />
            </a>
            <a
              id="link-scientific-pub"
              href="https://academic.oup.com/nar/article/37/suppl_1/D782/1000752"
              target="_blank"
              rel="noreferrer"
            >
              Publicação científica no Nucleic Acids Res. <ArrowUpRight size={14} />
            </a>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
