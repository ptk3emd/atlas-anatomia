import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Sparkles,
  ChevronRight,
  Bone,
  Heart,
  Activity,
  Filter
} from 'lucide-react';
import {
  SYSTEMS,
  translateAnatomicalName,
  type Atlas,
  type Concept,
  type Part,
  type SystemId
} from '@/anatomy';
import { computeResolvedPartLandmarks } from '@/landmark-store';

interface AnatomySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  atlas: Atlas;
  onSelectConcept: (concept: Concept) => void;
  onSelectPart: (partId: string) => void;
}

export const AnatomySearchModal: React.FC<AnatomySearchModalProps> = ({
  isOpen,
  onClose,
  atlas,
  onSelectConcept,
  onSelectPart
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSystem, setSelectedSystem] = useState<string>('all');

  // Pre-calculate landmark availability for quick filtering
  const partsWithLandmarks = useMemo(() => {
    const set = new Set<string>();
    atlas.parts.forEach(p => {
      const landmarks = computeResolvedPartLandmarks(p.id, p.name, p.bounds);
      if (landmarks.length > 0) {
        set.add(p.id);
      }
    });
    return set;
  }, [atlas]);

  // Aggregate structures from atlas concepts and parts
  const searchableItems = useMemo(() => {
    const list: Array<{
      id: string;
      conceptId?: string;
      partId?: string;
      namePt: string;
      nameLat: string;
      system: SystemId;
      systemName: string;
      systemColor: string;
      hasLandmarks: boolean;
      landmarkCount: number;
      elementsCount: number;
    }> = [];

    // Map through unique parts for fine-grained selection
    atlas.parts.forEach(part => {
      const landmarks = computeResolvedPartLandmarks(part.id, part.name, part.bounds);
      const sys = SYSTEMS.find(s => s.id === part.system);
      list.push({
        id: part.id,
        partId: part.id,
        conceptId: part.conceptId,
        namePt: translateAnatomicalName(part.name),
        nameLat: part.name,
        system: part.system as SystemId,
        systemName: sys?.name ?? 'Anatomia',
        systemColor: sys?.color ?? '#aebbb8',
        hasLandmarks: landmarks.length > 0,
        landmarkCount: landmarks.length,
        elementsCount: 1
      });
    });

    return list;
  }, [atlas]);

  // Filter items based on search query and system filter
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return searchableItems.filter(item => {
      // System filter
      if (selectedSystem === 'landmarks-only') {
        if (!item.hasLandmarks) return false;
      } else if (selectedSystem !== 'all' && item.system !== selectedSystem) {
        return false;
      }

      // Text search
      if (!term) return true;

      const ptMatch = item.namePt.toLowerCase().includes(term);
      const latMatch = item.nameLat.toLowerCase().includes(term);
      const sysMatch = item.systemName.toLowerCase().includes(term);

      return ptMatch || latMatch || sysMatch;
    }).slice(0, 100); // Limit to top 100 results for fast DOM rendering
  }, [searchableItems, searchTerm, selectedSystem]);

  if (!isOpen) return null;

  return (
    <div
      className="search-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Catálogo e busca de estruturas anatômicas"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-modal-container glass">
        {/* Header with Search Input */}
        <div className="search-modal-header">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Pesquisar osso, órgão, músculo ou acidente anatômico…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchTerm('')}
                aria-label="Limpar pesquisa"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            type="button"
            className="search-modal-close"
            onClick={onClose}
            aria-label="Fechar busca (ESC)"
          >
            <X size={20} />
          </button>
        </div>

        {/* System & Category Filter Chips */}
        <div className="search-filters-bar">
          <button
            type="button"
            className={`search-filter-chip ${selectedSystem === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedSystem('all')}
          >
            Todas ({searchableItems.length})
          </button>
          <button
            type="button"
            className={`search-filter-chip highlight-chip ${selectedSystem === 'landmarks-only' ? 'active' : ''}`}
            onClick={() => setSelectedSystem('landmarks-only')}
          >
            <Sparkles size={12} className="text-amber-400" />
            Com Acidentes 3D ({searchableItems.filter(i => i.hasLandmarks).length})
          </button>
          {SYSTEMS.map(sys => {
            const count = searchableItems.filter(i => i.system === sys.id).length;
            if (count === 0) return null;
            return (
              <button
                key={sys.id}
                type="button"
                className={`search-filter-chip ${selectedSystem === sys.id ? 'active' : ''}`}
                onClick={() => setSelectedSystem(sys.id)}
              >
                <span className="chip-dot" style={{ background: sys.color }} />
                {sys.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div className="search-results-container">
          <div className="search-results-meta">
            <span>
              {filteredItems.length} {filteredItems.length === 1 ? 'estrutura encontrada' : 'estruturas encontradas'}
            </span>
            {searchTerm && (
              <span className="search-term-indicator">
                Filtro: &ldquo;{searchTerm}&rdquo;
              </span>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div className="search-empty-state">
              <Search size={32} className="text-neutral-500 mb-2" />
              <p className="text-sm font-medium text-neutral-300">Nenhuma estrutura anatômica encontrada</p>
              <p className="text-xs text-neutral-500 mt-1">
                Tente buscar por outro termo ou selecione &ldquo;Todas&rdquo; nos filtros acima.
              </p>
            </div>
          ) : (
            <div className="search-items-list" role="list">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className="search-item-card"
                  role="listitem"
                  onClick={() => {
                    if (item.partId) {
                      onSelectPart(item.partId);
                    }
                    onClose();
                  }}
                >
                  <div className="item-card-left">
                    <span
                      className="item-system-dot"
                      style={{ background: item.systemColor }}
                      title={item.systemName}
                    />
                    <div className="item-titles">
                      <span className="item-title-pt">{item.namePt}</span>
                      <span className="item-title-lat">{item.nameLat}</span>
                    </div>
                  </div>

                  <div className="item-card-right">
                    <span className="item-system-badge" style={{ borderColor: `${item.systemColor}40` }}>
                      {item.systemName}
                    </span>
                    {item.hasLandmarks && (
                      <span className="item-landmarks-badge" title="Possui acidentes anatômicos 3D mapeados">
                        <Sparkles size={11} className="text-amber-400" />
                        {item.landmarkCount} acidentes
                      </span>
                    )}
                    <ChevronRight size={16} className="item-arrow" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer Note */}
        <div className="search-modal-footer">
          <span>Clique em qualquer estrutura para localizá-la e focar a câmera 3D imediatamente</span>
          <span className="desktop-only text-neutral-400 text-xs">Pressione ESC para fechar</span>
        </div>
      </div>
    </div>
  );
};
