import React, { useEffect } from 'react';
import {
  X,
  Sliders,
  Gauge,
  Eye,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Contrast
} from 'lucide-react';
import {
  type ViewerSettings,
  DEFAULT_VIEWER_SETTINGS
} from '@/settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ViewerSettings;
  onUpdateSettings: (updater: (prev: ViewerSettings) => ViewerSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings
}) => {
  // Close on Escape key
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

  const handleResetDefaults = () => {
    onUpdateSettings(() => DEFAULT_VIEWER_SETTINGS);
  };

  const getSpeedLabel = (speed: number) => {
    if (speed <= 0.6) return 'Suave / Precisa';
    if (speed <= 0.9) return 'Moderada';
    if (speed <= 1.2) return 'Padrão (1.0x)';
    if (speed <= 1.6) return 'Ágil';
    return 'Rápida';
  };

  return (
    <div
      className="settings-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="settings-modal-container glass"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="settings-modal-header">
          <div className="flex items-center gap-2.5">
            <div className="settings-icon-wrapper">
              <Sliders size={18} className="text-amber-400" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="settings-modal-title">
                Configurações & Acessibilidade
              </h2>
              <p className="settings-modal-subtitle">
                Calibre a câmera 3D, controle de movimento e contraste de leitura
              </p>
            </div>
          </div>
          <button
            type="button"
            className="settings-close-btn"
            onClick={onClose}
            aria-label="Fechar configurações"
            title="Fechar (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body / Sections */}
        <div className="settings-modal-body">
          {/* Section 1: Camera Speed */}
          <div className="settings-section">
            <div className="settings-section-header">
              <div className="flex items-center gap-2">
                <Gauge size={16} className="text-amber-400" />
                <h3 className="settings-section-title">Velocidade da Câmera</h3>
              </div>
              <span className="settings-badge-value">
                {settings.cameraSpeed.toFixed(1)}x · {getSpeedLabel(settings.cameraSpeed)}
              </span>
            </div>

            <p className="settings-section-description">
              Ajusta a sensibilidade de órbita 3D, rotação angular e velocidade de aproximação do zoom.
            </p>

            {/* Slider */}
            <div className="settings-slider-wrapper">
              <span className="slider-label-min">0.4x</span>
              <input
                type="range"
                min="0.4"
                max="2.2"
                step="0.1"
                value={settings.cameraSpeed}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  onUpdateSettings(prev => ({ ...prev, cameraSpeed: val }));
                }}
                className="settings-range-slider"
                aria-label="Velocidade da câmera 3D"
              />
              <span className="slider-label-max">2.2x</span>
            </div>

            {/* Preset Buttons */}
            <div className="settings-presets-group" role="group" aria-label="Predefinições de velocidade">
              {[
                { label: 'Suave', val: 0.6 },
                { label: 'Padrão (1.0x)', val: 1.0 },
                { label: 'Ágil', val: 1.6 }
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  className={`settings-preset-btn ${
                    Math.abs(settings.cameraSpeed - preset.val) < 0.05 ? 'active' : ''
                  }`}
                  onClick={() => onUpdateSettings(prev => ({ ...prev, cameraSpeed: preset.val }))}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Motion Sickness Prevention / Animation Toggle */}
          <div className="settings-section">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <div className="settings-mini-icon">
                  <ShieldCheck size={16} className={settings.enableAnimations ? 'text-emerald-400' : 'text-amber-400'} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="settings-section-title">Animações & Prevenção de Cinetose</h3>
                    {!settings.enableAnimations && (
                      <span className="settings-tag-safe">Modo Estável</span>
                    )}
                  </div>
                  <p className="settings-section-description mt-1">
                    {settings.enableAnimations
                      ? 'Animações fluidas ativas, com aceleração inercial e sobrevoo suave da câmera.'
                      : 'Cinetose prevenida: a inércia e o drift foram desativados. A câmera responde com paradas imediatas sem flutuações, eliminando tonturas ou náuseas.'}
                  </p>
                </div>
              </div>

              {/* Accessible Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={settings.enableAnimations}
                onClick={() => onUpdateSettings(prev => ({ ...prev, enableAnimations: !prev.enableAnimations }))}
                className={`settings-switch ${settings.enableAnimations ? 'checked' : 'unchecked'}`}
                title={settings.enableAnimations ? 'Clique para desativar animações (prevenir cinetose)' : 'Clique para reativar animações suaves'}
                aria-label="Alternar animações e inércia"
              >
                <span className="settings-switch-thumb" />
              </button>
            </div>
          </div>

          {/* Section 3: High Contrast Labels (WCAG AAA) */}
          <div className="settings-section">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <div className="settings-mini-icon">
                  <Contrast size={16} className={settings.highContrastLabels ? 'text-amber-400' : 'text-neutral-400'} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="settings-section-title">Alto Contraste Dinâmico para Rótulos</h3>
                    {settings.highContrastLabels && (
                      <span className="settings-tag-contrast">WCAG AAA</span>
                    )}
                  </div>
                  <p className="settings-section-description mt-1">
                    {settings.highContrastLabels
                      ? 'Rótulos e cartões utilizam fundo preto absoluto (#000) e contorno radiante em ouro para legibilidade máxima sobre malhas anatômicas densas.'
                      : 'Rótulos utilizam vidro cirúrgico fosco com desfoque profundo (backdrop-blur) e contraste balanceado.'}
                  </p>
                </div>
              </div>

              {/* Accessible Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={settings.highContrastLabels}
                onClick={() => onUpdateSettings(prev => ({ ...prev, highContrastLabels: !prev.highContrastLabels }))}
                className={`settings-switch ${settings.highContrastLabels ? 'checked' : 'unchecked'}`}
                title={settings.highContrastLabels ? 'Clique para voltar ao vidro cirúrgico fosco' : 'Clique para ativar alto contraste dinâmico (#000)'}
                aria-label="Alternar alto contraste dinâmico de rótulos"
              >
                <span className="settings-switch-thumb" />
              </button>
            </div>

            {/* Live Visual Comparison Pill */}
            <div className="settings-contrast-preview mt-3">
              <span className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider">
                Exemplo de Rótulo no Modo Atual:
              </span>
              <div
                className={`preview-label-box ${
                  settings.highContrastLabels ? 'high-contrast' : 'standard'
                }`}
              >
                <span className="preview-dot" />
                <span className="preview-title">Músculo Deltoide</span>
                <span className="preview-tag">Sistema Muscular</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="settings-modal-footer">
          <button
            type="button"
            className="settings-reset-btn"
            onClick={handleResetDefaults}
            title="Restaurar todas as opções para os valores padrão"
          >
            <RotateCcw size={13} />
            <span>Restaurar Padrões</span>
          </button>

          <button
            type="button"
            className="settings-save-btn"
            onClick={onClose}
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
