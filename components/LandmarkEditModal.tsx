import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Sparkles,
  Trash2,
  Save,
  Sliders,
  ChevronDown,
  Info,
  CheckCircle,
  HelpCircle,
  Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { translateAnatomicalName, type Part } from '@/anatomy';
import { type AnatomicalLandmark } from '@/landmarks';

export const LANDMARK_CATEGORIES: Array<{
  id: AnatomicalLandmark['category'];
  label: string;
  badge: string;
  hint: string;
}> = [
  {
    id: 'proeminencia',
    label: 'Proeminência / Saliência',
    badge: 'Proeminência',
    hint: 'Tubérculo, trocanter, crista, espinha, epicôndilo, processo ou linha'
  },
  {
    id: 'articular',
    label: 'Superfície Articular',
    badge: 'Articular',
    hint: 'Cabeça articular, côndilo, tróclea, faceta ou fóvea de encaixe'
  },
  {
    id: 'depressao',
    label: 'Depressão / Fossa / Forame',
    badge: 'Depressão',
    hint: 'Fossa, sulco, forame, canal, fissura, meato ou incisura'
  },
  {
    id: 'insercao',
    label: 'Ponto de Inserção',
    badge: 'Inserção',
    hint: 'Fixação muscular, tendínea, aponeurótica ou ligamentar'
  },
  {
    id: 'vascular_neural',
    label: 'Estrutura Neurovascular',
    badge: 'Neurovascular',
    hint: 'Passagem ou trajeto de artéria, veia ou feixe nervoso'
  },
  {
    id: 'outros',
    label: 'Morfologia Geral',
    badge: 'Geral',
    hint: 'Ápice, base, margem, bordo, lóbulo ou parede'
  }
];

interface LandmarkEditModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  part: Part | undefined;
  landmarkToEdit?: AnatomicalLandmark | null;
  initialRelativePos?: [number, number, number];
  onSave: (landmark: AnatomicalLandmark) => void;
  onDelete?: (landmarkId: string) => void;
  onClose: () => void;
}

export const LandmarkEditModal: React.FC<LandmarkEditModalProps> = ({
  isOpen,
  mode,
  part,
  landmarkToEdit,
  initialRelativePos = [0.5, 0.5, 0.5],
  onSave,
  onDelete,
  onClose
}) => {
  const [name, setName] = useState('');
  const [latinName, setLatinName] = useState('');
  const [category, setCategory] = useState<AnatomicalLandmark['category']>('proeminencia');
  const [description, setDescription] = useState('');
  const [teachingNotes, setTeachingNotes] = useState('');
  const [clinicalRelevance, setClinicalRelevance] = useState('');
  const [leaderAngle, setLeaderAngle] = useState<AnatomicalLandmark['leaderAngle']>('right-up');
  const [relativePos, setRelativePos] = useState<[number, number, number]>(initialRelativePos);
  const [showAdvancedPos, setShowAdvancedPos] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pre-fill form when editing or opening
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && landmarkToEdit) {
        setName(landmarkToEdit.name || '');
        setLatinName(landmarkToEdit.latinName || '');
        setCategory(landmarkToEdit.category || 'proeminencia');
        setDescription(landmarkToEdit.description || '');
        setTeachingNotes(landmarkToEdit.teachingNotes || '');
        setClinicalRelevance(landmarkToEdit.clinicalRelevance || '');
        setLeaderAngle(landmarkToEdit.leaderAngle || 'right-up');
        setRelativePos(landmarkToEdit.relativePos || [0.5, 0.5, 0.5]);
      } else {
        // Create new
        setName('');
        setLatinName('');
        setCategory('proeminencia');
        setDescription('');
        setTeachingNotes('');
        setClinicalRelevance('');
        setLeaderAngle('right-up');
        setRelativePos(initialRelativePos);
      }
      setErrorMsg('');
      setShowAdvancedPos(false);
    }
  }, [isOpen, mode, landmarkToEdit, initialRelativePos]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentCatObj = LANDMARK_CATEGORIES.find(c => c.id === category) || LANDMARK_CATEGORIES[0];
  const partDisplayName = part ? translateAnatomicalName(part.name) : 'Peça Anatômica';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome do acidente anatômico.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Por favor, descreva o que é este acidente anatômico.');
      return;
    }

    const landmarkId = mode === 'edit' && landmarkToEdit?.id
      ? landmarkToEdit.id
      : `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const savedLandmark: AnatomicalLandmark = {
      id: landmarkId,
      name: name.trim(),
      latinName: latinName.trim() || undefined,
      category,
      categoryLabel: currentCatObj.label,
      relativePos: [
        Number(relativePos[0].toFixed(3)),
        Number(relativePos[1].toFixed(3)),
        Number(relativePos[2].toFixed(3))
      ],
      leaderAngle,
      description: description.trim(),
      teachingNotes: teachingNotes.trim() || undefined,
      clinicalRelevance: clinicalRelevance.trim() || undefined,
      isCustom: true
    };

    onSave(savedLandmark);
  };

  const handleDelete = () => {
    if (landmarkToEdit?.id && onDelete) {
      if (window.confirm(`Tem certeza que deseja excluir o acidente "${landmarkToEdit.name}"?`)) {
        onDelete(landmarkToEdit.id);
      }
    }
  };

  return (
    <div
      className="landmark-edit-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="landmark-edit-title"
    >
      <div
        className="landmark-edit-container glass"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="landmark-edit-header">
          <div className="flex items-center gap-3">
            <div className="landmark-edit-icon-wrap">
              <MapPin size={20} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="landmark-edit-title" className="landmark-edit-title">
                  {mode === 'create' ? 'Novo Acidente Anatômico' : 'Editar Acidente'}
                </h3>
                <span className="landmark-part-badge">
                  {partDisplayName}
                </span>
              </div>
              <p className="landmark-edit-sub">
                {mode === 'create'
                  ? 'Ponto capturado na peça 3D. Descreva a morfologia e as relações anatômicas.'
                  : 'Atualize os dados descritivos ou calibre a posição deste acidente.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="landmark-close-btn"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="landmark-edit-form">
          {errorMsg && (
            <div className="landmark-error-alert" role="alert">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Name & Latin Name */}
          <div className="landmark-form-grid">
            <div className="form-group flex-1">
              <label htmlFor="landmark-name" className="form-label">
                Nome do Acidente <span className="text-amber-400">*</span>
              </label>
              <input
                id="landmark-name"
                type="text"
                className="form-input"
                placeholder="Ex: Tubérculo Adutor, Sulco Intertubercular, Fóvea..."
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                autoFocus
              />
            </div>

            <div className="form-group flex-1">
              <label htmlFor="landmark-latin" className="form-label">
                Terminologia Anatômica / Latim <span className="text-neutral-500 font-normal">(Opcional)</span>
              </label>
              <input
                id="landmark-latin"
                type="text"
                className="form-input italic"
                placeholder="Ex: Tuberculum adductorium, Sulcus intertubercularis..."
                value={latinName}
                onChange={e => setLatinName(e.target.value)}
              />
            </div>
          </div>

          {/* Category Selector */}
          <div className="form-group">
            <label className="form-label">
              Classificação Morfofuncional <span className="text-amber-400">*</span>
            </label>
            <div className="landmark-category-grid" role="radiogroup">
              {LANDMARK_CATEGORIES.map(cat => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`category-pill-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => setCategory(cat.id)}
                    title={cat.hint}
                  >
                    <span className="cat-badge">{cat.badge}</span>
                    <span className="cat-label">{cat.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="form-hint mt-1.5">
              {currentCatObj.hint}
            </p>
          </div>

          {/* Main Description */}
          <div className="form-group">
            <label htmlFor="landmark-desc" className="form-label">
              Descrição Anatômica <span className="text-amber-400">*</span>
            </label>
            <textarea
              id="landmark-desc"
              rows={3}
              className="form-textarea"
              placeholder="Descreva o que é esta estrutura, sua forma, limites anatômicos e função..."
              value={description}
              onChange={e => {
                setDescription(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
            />
          </div>

          {/* Teaching Notes & Clinical Relevance Accordion / Fields */}
          <div className="landmark-form-grid">
            <div className="form-group flex-1">
              <label htmlFor="landmark-notes" className="form-label">
                Morfologia & Inserções <span className="text-neutral-500 font-normal">(Opcional)</span>
              </label>
              <textarea
                id="landmark-notes"
                rows={2}
                className="form-textarea"
                placeholder="Músculos fixados, ligamentos ou feixes que passam no local..."
                value={teachingNotes}
                onChange={e => setTeachingNotes(e.target.value)}
              />
            </div>

            <div className="form-group flex-1">
              <label htmlFor="landmark-clinical" className="form-label">
                Importância Clínica & Cirúrgica <span className="text-neutral-500 font-normal">(Opcional)</span>
              </label>
              <textarea
                id="landmark-clinical"
                rows={2}
                className="form-textarea"
                placeholder="Sítio de fraturas, palpação, acessos cirúrgicos ou patologias comuns..."
                value={clinicalRelevance}
                onChange={e => setClinicalRelevance(e.target.value)}
              />
            </div>
          </div>

          {/* Advanced Position Tuning Toggle */}
          <div className="form-advanced-section">
            <button
              type="button"
              className="advanced-toggle-btn"
              onClick={() => setShowAdvancedPos(!showAdvancedPos)}
            >
              <Sliders size={14} className="text-amber-400" />
              <span>Ajuste Fino de Posição 3D e Ângulo do Rótulo</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showAdvancedPos ? 'rotate-180' : ''}`}
              />
            </button>

            {showAdvancedPos && (
              <div className="advanced-pos-controls">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-neutral-300 block mb-1">
                      Ângulo do Rótulo (Linha de Chamada)
                    </label>
                    <select
                      className="form-select"
                      value={leaderAngle || 'right-up'}
                      onChange={e => setLeaderAngle(e.target.value as any)}
                    >
                      <option value="right-up">Direita para Cima ↗</option>
                      <option value="right-down">Direita para Baixo ↘</option>
                      <option value="left-up">Esquerda para Cima ↖</option>
                      <option value="left-down">Esquerda para Baixo ↙</option>
                      <option value="up">Superior ↑</option>
                      <option value="down">Inferior ↓</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="text-[10px] text-neutral-400 font-bold block">
                      Eixo X (U): {relativePos[0].toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={relativePos[0]}
                      onChange={e => setRelativePos([parseFloat(e.target.value), relativePos[1], relativePos[2]])}
                      className="form-range"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 font-bold block">
                      Eixo Y (V): {relativePos[1].toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={relativePos[1]}
                      onChange={e => setRelativePos([relativePos[0], parseFloat(e.target.value), relativePos[2]])}
                      className="form-range"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 font-bold block">
                      Eixo Z (W): {relativePos[2].toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={relativePos[2]}
                      onChange={e => setRelativePos([relativePos[0], relativePos[1], parseFloat(e.target.value)])}
                      className="form-range"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="landmark-edit-footer">
            {mode === 'edit' && onDelete ? (
              <button
                type="button"
                className="btn-danger-delete"
                onClick={handleDelete}
                title="Excluir este acidente anatômico"
              >
                <Trash2 size={14} />
                <span>Excluir</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-save-landmark"
              >
                <Save size={15} />
                <span>{mode === 'create' ? 'Salvar Acidente 3D' : 'Atualizar'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
