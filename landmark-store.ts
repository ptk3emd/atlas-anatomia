import {
  type AnatomicalLandmark,
  type ComputedLandmark,
  LANDMARK_TEMPLATES,
  getLandmarkKeyForPart
} from './landmarks';

const STORAGE_KEY = 'apexmed_custom_landmarks_v2';

export interface StoredLandmarkData {
  // Keyed by partId or fallback part landmark key
  [partKey: string]: {
    custom: AnatomicalLandmark[];
    // modified built-ins: key is landmark id, value is overridden fields
    overrides?: Record<string, Partial<AnatomicalLandmark>>;
    deletedIds?: string[];
  };
}

export function loadStoredLandmarks(): StoredLandmarkData {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveStoredLandmarks(data: StoredLandmarkData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[LandmarkStore] Failed to save landmarks to localStorage:', err);
  }
}

// Generate a primary storage lookup key for a given part
export function getStorageKey(partId: string, partName: string): string {
  const templateKey = getLandmarkKeyForPart(partName);
  if (templateKey) return `tpl_${templateKey}`;
  return `part_${partId || partName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

// Get all effective anatomical landmarks for a specific part (combining built-ins + custom + overrides)
export function getLandmarksForPart(partId: string, partName: string): AnatomicalLandmark[] {
  const store = loadStoredLandmarks();
  const key = getStorageKey(partId, partName);
  const partData = store[key] || { custom: [] };
  const deletedSet = new Set(partData.deletedIds || []);

  const templateKey = getLandmarkKeyForPart(partName);
  const baseTemplates: AnatomicalLandmark[] = templateKey && LANDMARK_TEMPLATES[templateKey]
    ? LANDMARK_TEMPLATES[templateKey]
    : [];

  // 1. Process base templates with any user overrides, excluding deleted ones
  const resolvedBase = baseTemplates
    .filter(t => !deletedSet.has(t.id))
    .map(t => {
      const override = partData.overrides?.[t.id];
      if (override) {
        return { ...t, ...override };
      }
      return t;
    });

  // 2. Append custom user-created landmarks
  const customList = (partData.custom || []).filter(c => !deletedSet.has(c.id));

  return [...resolvedBase, ...customList];
}

// Compute 3D world coordinates for the resolved landmarks of a part
export function computeResolvedPartLandmarks(
  partId: string,
  partName: string,
  bounds: [number[], number[]]
): ComputedLandmark[] {
  const landmarks = getLandmarksForPart(partId, partName);
  if (landmarks.length === 0) return [];

  const [min, max] = bounds;
  const isRight = partName.toLowerCase().startsWith('right');
  const sizeX = max[0] - min[0] || 0.001;
  const sizeY = max[1] - min[1] || 0.001;
  const sizeZ = max[2] - min[2] || 0.001;

  return landmarks.map(t => {
    // Mirror u coordinate if right-sided piece
    const u = isRight ? 1 - t.relativePos[0] : t.relativePos[0];
    const v = t.relativePos[1];
    const w = t.relativePos[2];

    const worldX = min[0] + u * sizeX;
    const worldY = min[1] + v * sizeY;
    const worldZ = min[2] + w * sizeZ;

    let leaderAngle = t.leaderAngle;
    if (isRight && leaderAngle) {
      if (leaderAngle.startsWith('left')) {
        leaderAngle = leaderAngle.replace('left', 'right') as any;
      } else if (leaderAngle.startsWith('right')) {
        leaderAngle = leaderAngle.replace('right', 'left') as any;
      }
    }

    return {
      ...t,
      leaderAngle,
      worldPosition: [worldX, worldY, worldZ],
      isRightSide: isRight
    };
  });
}

// Save or update a landmark (new or edited)
export function saveLandmark(
  partId: string,
  partName: string,
  landmark: AnatomicalLandmark
): void {
  const store = loadStoredLandmarks();
  const key = getStorageKey(partId, partName);
  if (!store[key]) {
    store[key] = { custom: [] };
  }

  const templateKey = getLandmarkKeyForPart(partName);
  const isBuiltIn = templateKey && LANDMARK_TEMPLATES[templateKey]?.some(t => t.id === landmark.id);

  if (isBuiltIn) {
    if (!store[key].overrides) store[key].overrides = {};
    store[key].overrides![landmark.id] = landmark;
    // ensure not in deleted
    if (store[key].deletedIds) {
      store[key].deletedIds = store[key].deletedIds!.filter(id => id !== landmark.id);
    }
  } else {
    // Custom landmark
    const list = store[key].custom || [];
    const idx = list.findIndex(c => c.id === landmark.id);
    if (idx >= 0) {
      list[idx] = { ...landmark, isCustom: true };
    } else {
      list.push({ ...landmark, isCustom: true });
    }
    store[key].custom = list;
    if (store[key].deletedIds) {
      store[key].deletedIds = store[key].deletedIds!.filter(id => id !== landmark.id);
    }
  }

  saveStoredLandmarks(store);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('apex:landmarks-changed', { detail: { partId, partName } }));
  }
}

// Delete a landmark (either custom or built-in)
export function deleteLandmark(
  partId: string,
  partName: string,
  landmarkId: string
): void {
  const store = loadStoredLandmarks();
  const key = getStorageKey(partId, partName);
  if (!store[key]) {
    store[key] = { custom: [] };
  }

  // Remove from custom list if present
  if (store[key].custom) {
    store[key].custom = store[key].custom.filter(c => c.id !== landmarkId);
  }
  // Remove from overrides if present
  if (store[key].overrides && store[key].overrides[landmarkId]) {
    delete store[key].overrides[landmarkId];
  }
  // Add to deletedIds
  if (!store[key].deletedIds) {
    store[key].deletedIds = [];
  }
  if (!store[key].deletedIds!.includes(landmarkId)) {
    store[key].deletedIds!.push(landmarkId);
  }

  saveStoredLandmarks(store);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('apex:landmarks-changed', { detail: { partId, partName } }));
  }
}

// Reset all landmarks for a part back to defaults
export function resetLandmarksForPart(partId: string, partName: string): void {
  const store = loadStoredLandmarks();
  const key = getStorageKey(partId, partName);
  if (store[key]) {
    delete store[key];
    saveStoredLandmarks(store);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('apex:landmarks-changed', { detail: { partId, partName } }));
    }
  }
}
