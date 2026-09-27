import React, { useState } from 'react';
import {
  X,
  Focus,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Info,
  Sparkles,
  BookOpen,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  Plus,
  Pencil,
  MapPin,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  translateAnatomicalName,
  explanation,
  PEDAGOGICAL_DATABASE,
  type Concept,
  type Part,
  type SystemMeta,
  type View
} from '@/anatomy';
import type { AnatomicalLandmark, ComputedLandmark } from '@/landmarks';

interface ApexSelectionBlockProps {
  selected: Part | undefined;
  chosen: Concept | null;
  system: SystemMeta | undefined;
  selectedParts: Part[];
  view: View;
  onViewChange: (view: View) => void;
  isIsolated: boolean;
  isolateMode: 'solo' | 'ghost';
  onToggleIsolate: () => void;
  onSetIsolateMode: (mode: 'solo' | 'ghost') => void;
  isRotating: boolean;
  onToggleRotate: () => void;
  onRecenter: () => void;
  onClearSelection: () => void;
  onSelectPart: (id: string) => void;
  landmarks?: ComputedLandmark[];
  activeLandmarkId?: string | null;
  onSelectLandmark?: (id: string | null) => void;
  showLines?: boolean;
  onToggleLines?: () => void;
  onHidePart?: () => void;
  isAddingLandmark?: boolean;
  onStartAddLandmark?: () => void;
  onCancelAddLandmark?: () => void;
  onEditLandmark?: (landmark: AnatomicalLandmark) => void;
  onResetLandmarks?: () => void;
}

export const ApexSelectionBlock: React.FC<ApexSelectionBlockProps> = ({
  selected,
  chosen,
  system,
  isIsolated,
  onToggleIsolate,
  isRotating,
  onToggleRotate,
  onClearSelection,
  landmarks = [],
  activeLandmarkId = null,
  onSelectLandmark,
  showLines = true,
  onToggleLines,
  onHidePart,
  isAddingLandmark = false,
  onStartAddLandmark,
  onCancelAddLandmark,
  onEditLandmark,
  onResetLandmarks
}) => {
  const [showSheet, setShowSheet] = useState(false);

  if (!selected && !chosen) return null;

  const displayName = chosen
    ? translateAnatomicalName(chosen.name)
    : selected
    ? translateAnatomicalName(selected.name)
    : '';
  const originalName = chosen?.name ?? selected?.name ?? '';

  const pedagogicalInfo = React.useMemo(() => {
    if (!originalName) return null;
    const key = originalName.toLowerCase().trim();
    if (PEDAGOGICAL_DATABASE[key]) return PEDAGOGICAL_DATABASE[key];
    for (const [k, v] of Object.entries(PEDAGOGICAL_DATABASE)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
    return null;
  }, [originalName]);

  const activeIndex = landmarks.findIndex(l => l.id === activeLandmarkId);
  const activeLandmark = activeIndex >= 0 ? landmarks[activeIndex] : (landmarks[0] ?? null);

  // Stepper handlers
  const handleNextLandmark = () => {
    if (landmarks.length === 0) return;
    const currentIdx = activeIndex >= 0 ? activeIndex : 0;
    const nextIdx = (currentIdx + 1) % landmarks.length;
    onSelectLandmark?.(landmarks[nextIdx].id);
  };

  const handlePrevLandmark = () => {
    if (landmarks.length === 0) return;
    const currentIdx = activeIndex >= 0 ? activeIndex : 0;
    const prevIdx = (currentIdx - 1 + landmarks.length) % landmarks.length;
    onSelectLandmark?.(landmarks[prevIdx].id);
  };

  return (
    <aside
      id="apex-selection-block"
      className="apex-compact-dock pointer-events-auto"
      role="region"
      aria-label="Controle da estrutura anatômica selecionada"
    >
      <div className="compact-bar glass">
        {/* Top Section: Full structure identification & close action */}
        <div className="compact-header-row">
          <div className="compact-left">
            <span
              className="compact-dot"
              style={{ background: system?.color || '#ef4444' }}
              title={system?.name}
            />
            <div className="compact-titles">
              <span className="compact-name" title={displayName}>
                {displayName}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {originalName && originalName !== displayName && (
                  <span className="compact-sub" title={originalName}>
                    {originalName}
                  </span>
                )}
                {system?.name && (
                  <span className="compact-system-badge" style={{ color: system.color }}>
                    {system.name}
                  </span>
                )}
                {landmarks.length > 0 && (
                  <span className="compact-tag">
                    {landmarks.length} acidentes 3D
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="compact-close"
            onClick={onClearSelection}
            title="Desmarcar (ESC)"
            aria-label="Desmarcar estrutura"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Adding Landmark Active Banner */}
        {isAddingLandmark && (
          <div className="compact-adding-landmark-banner">
            <div className="flex items-center gap-2">
              <span className="adding-pulse-dot" />
              <span className="adding-text">Clique sobre a peça 3D para posicionar</span>
            </div>
            <button
              type="button"
              className="adding-cancel-btn"
              onClick={onCancelAddLandmark}
              title="Cancelar criação de acidente"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Center: Clean landmark navigator / stepper with direct indicator */}
        {landmarks.length > 0 ? (
          <div className="compact-landmark-stepper" role="group" aria-label="Navegador de acidentes anatômicos">
            <button
              type="button"
              className="stepper-arrow"
              onClick={handlePrevLandmark}
              title="Acidente anterior"
              aria-label="Acidente anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              className="stepper-current"
              onClick={() => {
                if (!activeLandmark && landmarks.length > 0) {
                  onSelectLandmark?.(landmarks[0].id);
                } else {
                  handleNextLandmark();
                }
              }}
              title="Clique para alternar entre os acidentes"
            >
              <span className="stepper-number">
                {(activeIndex >= 0 ? activeIndex : 0) + 1}/{landmarks.length}
              </span>
              <span className="stepper-label">
                {activeLandmark?.name ?? 'Ver Acidente'}
              </span>
              {activeLandmark && (
                <span className="stepper-cat-badge">
                  {activeLandmark.categoryLabel}
                </span>
              )}
            </button>

            <button
              type="button"
              className="stepper-arrow"
              onClick={handleNextLandmark}
              title="Próximo acidente"
              aria-label="Próximo acidente"
            >
              <ChevronRight size={16} />
            </button>

            {activeLandmark && onEditLandmark && (
              <button
                type="button"
                className="stepper-action-btn"
                onClick={() => onEditLandmark(activeLandmark)}
                title="Editar descrição e detalhes deste acidente anatômico"
              >
                <Pencil size={13} />
                <span className="desktop-only text-[11px]">Editar</span>
              </button>
            )}

            {onStartAddLandmark && (
              <button
                type="button"
                className={`stepper-action-btn ${isAddingLandmark ? 'active-adding' : ''}`}
                onClick={isAddingLandmark ? onCancelAddLandmark : onStartAddLandmark}
                title="Marcar novo acidente nesta peça clicando no modelo 3D"
              >
                <Plus size={13} />
                <span className="desktop-only text-[11px]">+ Acidente</span>
              </button>
            )}
          </div>
        ) : (
          <div className="compact-empty-landmarks-bar">
            <span className="empty-landmarks-text">Nenhum acidente cadastrado nesta estrutura</span>
            {onStartAddLandmark && (
              <button
                type="button"
                className={`btn-add-first-landmark ${isAddingLandmark ? 'active-adding' : ''}`}
                onClick={isAddingLandmark ? onCancelAddLandmark : onStartAddLandmark}
                title="Marcar novo acidente clicando sobre o modelo 3D"
              >
                <Plus size={13} />
                <span>{isAddingLandmark ? 'Aguardando clique 3D...' : 'Criar Acidente 3D'}</span>
              </button>
            )}
          </div>
        )}

        {/* Bottom Section: Quick actions */}
        <div className="compact-actions">
          <div className="compact-actions-group">
            <Button
              variant="ghost"
              size="sm"
              className="compact-btn"
              onClick={() => window.dispatchEvent(new CustomEvent('apex:zoom', { detail: { direction: 'in' } }))}
              title="Aproximar zoom (+)"
              aria-label="Aproximar zoom (+)"
            >
              <ZoomIn size={14} />
              <span className="compact-btn-text">Zoom +</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="compact-btn"
              onClick={() => window.dispatchEvent(new CustomEvent('apex:zoom', { detail: { direction: 'out' } }))}
              title="Afastar zoom (-)"
              aria-label="Afastar zoom (-)"
            >
              <ZoomOut size={14} />
              <span className="compact-btn-text">Zoom -</span>
            </Button>

            {landmarks.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className={`compact-btn ${showLines ? 'active-lines' : ''}`}
                onClick={onToggleLines}
                title={showLines ? 'Ocultar linhas e marcadores 3D' : 'Exibir linhas e marcadores 3D'}
                aria-label={showLines ? 'Ocultar linhas 3D' : 'Exibir linhas 3D'}
              >
                {showLines ? <Eye size={14} /> : <EyeOff size={14} />}
                <span className="compact-btn-text">Linhas</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className={`compact-btn ${isIsolated ? 'active-isolate' : ''}`}
              onClick={onToggleIsolate}
              title={isIsolated ? 'Ver no corpo completo (I)' : 'Isolar estrutura no espaço 3D (I)'}
            >
              <Focus size={14} />
              <span className="compact-btn-text">{isIsolated ? 'Corpo' : 'Isolar'}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`compact-btn ${isRotating ? 'active-rotate' : ''}`}
              onClick={onToggleRotate}
              title={isRotating ? 'Pausar rotação' : 'Girar estrutura 360°'}
              aria-label="Girar 360°"
            >
              <RotateCw size={14} />
              <span className="compact-btn-text">Girar</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`compact-btn ${showSheet ? 'active-info' : ''}`}
              onClick={() => setShowSheet(!showSheet)}
              title="Informações anatômicas e clínicas"
              aria-label="Informações detalhadas"
            >
              <Info size={14} />
              <span className="compact-btn-text">Info</span>
            </Button>

            {onHidePart && (
              <Button
                variant="ghost"
                size="sm"
                className="compact-btn hover:text-red-400 hover:bg-red-500/15 text-neutral-300"
                onClick={onHidePart}
                title="Apagar / Ocultar apenas esta peça (H ou Delete)"
                aria-label="Apagar somente esta peça"
              >
                <EyeOff size={14} className="text-red-400" />
                <span className="compact-btn-text text-red-300">Apagar</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Clinical & Educational Details Popover */}
      {showSheet && (
        <div className="compact-details-popover glass">
          <div className="details-popover-header">
            <div className="flex items-center gap-2 min-w-0">
              <span className="popover-dot" style={{ background: system?.color || '#ef4444' }} />
              <h4 className="truncate">{displayName}</h4>
              <span className="text-xs text-neutral-400 italic truncate">({originalName})</span>
            </div>
            <button
              type="button"
              onClick={() => setShowSheet(false)}
              className="popover-close"
              aria-label="Fechar informações"
            >
              <X size={15} />
            </button>
          </div>

          <div className="details-popover-body">
            {pedagogicalInfo && (
              <div className="pedagogical-highlight-card mb-3">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                  {pedagogicalInfo.domain}
                </div>
                <div className="text-xs text-neutral-200 leading-relaxed mb-2">
                  <strong className="text-amber-300">Papel Funcional:</strong> {pedagogicalInfo.functionalRole}
                </div>
                <div className="teaching-box mb-2">
                  <strong>Eixo Neuropsicológico & Fisiologia:</strong> {pedagogicalInfo.neurobiologyPsychophysiology}
                </div>
                <div className="clinical-box">
                  <strong>Sintopia & Relações:</strong> {pedagogicalInfo.topographicalRelations}
                </div>
              </div>
            )}

            {activeLandmark ? (
              <div className="landmark-detail-focus">
                <div className="landmark-title-row">
                  <span className="landmark-badge">Acidente 3D #{activeIndex + 1} de {landmarks.length}</span>
                  <span className="landmark-cat">{activeLandmark.categoryLabel}</span>
                  {activeLandmark.isCustom && (
                    <span className="landmark-custom-tag">Personalizado</span>
                  )}
                </div>
                <h5 className="landmark-heading">{activeLandmark.name}</h5>
                {activeLandmark.latinName && (
                  <span className="landmark-latin">Terminologia Anatômica: {activeLandmark.latinName}</span>
                )}
                <p className="landmark-desc">{activeLandmark.description}</p>
                {activeLandmark.teachingNotes && (
                  <div className="teaching-box">
                    <strong>Morfologia Funcional:</strong> {activeLandmark.teachingNotes}
                  </div>
                )}
                {activeLandmark.clinicalRelevance && (
                  <div className="clinical-box">
                    <strong>Importância Clínica:</strong> {activeLandmark.clinicalRelevance}
                  </div>
                )}
                {onEditLandmark && (
                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/10">
                    <button
                      type="button"
                      className="btn-edit-landmark-popover"
                      onClick={() => onEditLandmark(activeLandmark)}
                    >
                      <Pencil size={13} />
                      <span>Editar Acidente</span>
                    </button>
                    {onStartAddLandmark && (
                      <button
                        type="button"
                        className="btn-add-landmark-popover"
                        onClick={onStartAddLandmark}
                      >
                        <Plus size={13} />
                        <span>+ Novo Ponto</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : !pedagogicalInfo ? (
              <div className="structure-general-info">
                <p className="details-popover-text">
                  {originalName && selected ? explanation(originalName, selected.system) : ''}
                </p>
                <div className="teaching-box mt-2">
                  <strong>Sistema:</strong> {system?.name ?? 'Sistema Anatômico'} · Peça anatômica mapeada em 3D.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </aside>
  );
};
