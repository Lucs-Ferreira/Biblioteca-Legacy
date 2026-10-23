export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive email profile';

export const BASE_CATEGORIES = [
  'Geral',
  'Miniaturas & RPG',
  'Peças Mecânicas',
  'Utilidades Domésticas',
  'Cosplay & Props',
  'Organizadores',
  'Articulados',
  'Suportes & Cases'
];

export const PRIORITY_WEIGHT = {
  Alta: 3,
  Normal: 2,
  Baixa: 1
};

export function formatBytes(bytes = 0) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

export function getModelImagePaths(model) {
  if (!model) return [];
  if (Array.isArray(model.image_paths) && model.image_paths.length > 0) {
    return model.image_paths.filter(Boolean);
  }
  if (model.image_path) {
    return [model.image_path];
  }
  return [];
}

export async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.async = true;
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error('Não foi possível carregar o compactador JSZip.'));
    document.body.appendChild(script);
  });
}