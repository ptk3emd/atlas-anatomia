export interface ViewerSettings {
  cameraSpeed: number; // 0.4 to 2.5 (1.0 = padrão)
  enableAnimations: boolean; // false = sem inércia/interpolação (prevenção de cinetose)
  highContrastLabels: boolean; // true = alto contraste com fundo preto sólido e borda âmbar
}

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  cameraSpeed: 1.0,
  enableAnimations: true,
  highContrastLabels: false,
};

const STORAGE_KEY = 'apexmed_viewer_settings_v1';

export function loadViewerSettings(): ViewerSettings {
  if (typeof window === 'undefined') return DEFAULT_VIEWER_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VIEWER_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      cameraSpeed:
        typeof parsed.cameraSpeed === 'number' &&
        parsed.cameraSpeed >= 0.3 &&
        parsed.cameraSpeed <= 3.0
          ? parsed.cameraSpeed
          : DEFAULT_VIEWER_SETTINGS.cameraSpeed,
      enableAnimations:
        typeof parsed.enableAnimations === 'boolean'
          ? parsed.enableAnimations
          : DEFAULT_VIEWER_SETTINGS.enableAnimations,
      highContrastLabels:
        typeof parsed.highContrastLabels === 'boolean'
          ? parsed.highContrastLabels
          : DEFAULT_VIEWER_SETTINGS.highContrastLabels,
    };
  } catch {
    return DEFAULT_VIEWER_SETTINGS;
  }
}

export function saveViewerSettings(settings: ViewerSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore local storage errors in private browsing
  }
}
