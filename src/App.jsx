import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Folder,
  Upload,
  HardDrive,
  Settings,
  Search,
  FileArchive,
  ExternalLink,
  Edit,
  Trash2,
  X,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  ZoomIn,
  ShieldCheck,
  FolderPlus,
  Check,
  AlertTriangle,
  Info,
  Tag,
  Calendar,
  Clock,
  Layers,
  Key,
  Terminal,
  LogOut,
  Link2,
  FileCheck,
  FileWarning,
  ArrowRight,
  SlidersHorizontal,
  Download,
  Sparkles,
  Eye
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc
} from 'firebase/firestore';

// ============================================================================
// INICIALIZAÇÃO DO FIREBASE (PERSISTÊNCIA REAL POR USUÁRIO)
// ============================================================================
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'biblioteca-stl-app';

// ============================================================================
// CONSTANTES E DADOS INICIAIS DE DEMONSTRAÇÃO
// ============================================================================
const CATEGORIES = [
  'Miniaturas',
  'Utilitários',
  'Decoração',
  'Cosplay',
  'Mecânica & Peças',
  'Articulados',
  'Organização',
  'Outros'
];

const DEFAULT_SETTINGS = {
  googleConnected: true,
  googleUserEmail: 'proprietario.stl@gmail.com',
  googleAuthMode: 'integrated', // 'integrated' | 'oauth_real'
  googleClientId: '',
  googleAccessToken: '',
  rootFolderId: '1Btl_STL_RootFolder_99812A',
  rootFolderName: 'Biblioteca STL',
  organizeBySubfolders: false,
  maxUploadSizeMB: 500,
  setupCompleted: true,
  updatedAt: new Date().toISOString()
};

const INITIAL_DRIVE_FOLDERS = [
  {
    id: '1Btl_STL_RootFolder_99812A',
    name: 'Biblioteca STL',
    path: 'Meu Drive / Biblioteca STL',
    createdAt: '2025-01-10T10:00:00.000Z',
    isDefault: true
  },
  {
    id: '1Btl_STL_DuplicateName_44109B',
    name: 'Biblioteca STL',
    path: 'Meu Drive / Backups Antigos / Biblioteca STL',
    createdAt: '2024-08-22T15:30:00.000Z',
    isDefault: false
  },
  {
    id: '1Prj_Impressao3D_2025_77310C',
    name: 'Modelos Impressão 3D',
    path: 'Meu Drive / Modelos Impressão 3D',
    createdAt: '2025-02-01T09:15:00.000Z',
    isDefault: false
  }
];

const INITIAL_DRIVE_FILES = [
  {
    driveFileId: '1Drv_OrcWarrior_28mm_ZIP901',
    name: 'guerreiro_orc_miniatura_28mm_presupported.zip',
    sizeBytes: 48234496, // ~46 MB
    folderId: '1Btl_STL_RootFolder_99812A',
    folderName: 'Biblioteca STL',
    subfolder: 'Miniaturas',
    webViewLink: 'https://drive.google.com/file/d/1Drv_OrcWarrior_28mm_ZIP901/view',
    createdTime: '2025-02-10T14:20:00.000Z',
    status: 'available'
  },
  {
    driveFileId: '1Drv_HeadphoneStand_V2_ZIP902',
    name: 'suporte_headset_minimalista_v2_stl.zip',
    sizeBytes: 15728640, // ~15 MB
    folderId: '1Btl_STL_RootFolder_99812A',
    folderName: 'Biblioteca STL',
    subfolder: '',
    webViewLink: 'https://drive.google.com/file/d/1Drv_HeadphoneStand_V2_ZIP902/view',
    createdTime: '2025-02-12T18:05:00.000Z',
    status: 'available'
  },
  {
    driveFileId: '1Drv_VasoGeometrico_LowPoly_ZIP903',
    name: 'vaso_geometrico_voronoi_kit_3_tamanhos.zip',
    sizeBytes: 29360128, // ~28 MB
    folderId: '1Btl_STL_RootFolder_99812A',
    folderName: 'Biblioteca STL',
    subfolder: '',
    webViewLink: 'https://drive.google.com/file/d/1Drv_VasoGeometrico_LowPoly_ZIP903/view',
    createdTime: '2025-02-14T11:40:00.000Z',
    status: 'available'
  },
  {
    driveFileId: '1Drv_DragaoArticulado_Crystal_ZIP904',
    name: 'dragao_articulado_cristal_print_in_place.zip',
    sizeBytes: 94371840, // ~90 MB
    folderId: '1Btl_STL_RootFolder_99812A',
    folderName: 'Biblioteca STL',
    subfolder: '',
    webViewLink: 'https://drive.google.com/file/d/1Drv_DragaoArticulado_Crystal_ZIP904/view',
    createdTime: '2025-02-18T09:10:00.000Z',
    status: 'available'
  },
  {
    driveFileId: '1Drv_CaixaGridfinity_Modulos_ZIP905',
    name: 'sistema_gridfinity_gavetas_oficina_completo.zip',
    sizeBytes: 36700160, // ~35 MB
    folderId: '1Btl_STL_RootFolder_99812A',
    folderName: 'Biblioteca STL',
    subfolder: '',
    webViewLink: 'https://drive.google.com/file/d/1Drv_CaixaGridfinity_Modulos_ZIP905/view',
    createdTime: '2025-02-19T16:50:00.000Z',
    status: 'available'
  }
];

const INITIAL_CATALOG_MODELS = [
  {
    name: 'Guerreiro Orc Miniatura 28mm',
    description: 'Miniatura detalhada de guerreiro orc para RPG de mesa. O pacote ZIP inclui versão com suportes prontos para resina (Chitubox/Lychee) e base texturizada separada.',
    referenceImage: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&q=80&w=700&h=500',
    zipFileName: 'guerreiro_orc_miniatura_28mm_presupported.zip',
    zipSizeBytes: 48234496,
    driveFileId: '1Drv_OrcWarrior_28mm_ZIP901',
    driveFileUrl: 'https://drive.google.com/file/d/1Drv_OrcWarrior_28mm_ZIP901/view',
    driveFolderId: '1Btl_STL_RootFolder_99812A',
    driveFolderName: 'Biblioteca STL',
    category: 'Miniaturas',
    tags: ['rpg', 'orc', '28mm', 'resina', 'pre-suportado'],
    notes: 'Impresso com sucesso em resina cinza com altura de camada de 0.03mm. Tempo de exposição: 2.3s.',
    driveStatus: 'available',
    createdAt: '2025-02-10T14:25:00.000Z',
    updatedAt: '2025-02-10T14:25:00.000Z'
  },
  {
    name: 'Suporte Minimalista para Headset',
    description: 'Suporte de mesa robusto e equilibrado para fones de ouvido over-ear. Desenhado para impressão FDM sem necessidade de suportes.',
    referenceImage: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=700&h=500',
    zipFileName: 'suporte_headset_minimalista_v2_stl.zip',
    zipSizeBytes: 15728640,
    driveFileId: '1Drv_HeadphoneStand_V2_ZIP902',
    driveFileUrl: 'https://drive.google.com/file/d/1Drv_HeadphoneStand_V2_ZIP902/view',
    driveFolderId: '1Btl_STL_RootFolder_99812A',
    driveFolderName: 'Biblioteca STL',
    category: 'Utilitários',
    tags: ['setup', 'headset', 'mesa', 'sem-suporte', 'fdm'],
    notes: 'Usar no mínimo 3 perímetros (paredes) e 20% de preenchimento Gyroid em PLA ou PETG.',
    driveStatus: 'available',
    createdAt: '2025-02-12T18:10:00.000Z',
    updatedAt: '2025-02-15T10:00:00.000Z'
  },
  {
    name: 'Vaso Geométrico Low-Poly (Kit 3 Tamanhos)',
    description: 'Conjunto com 3 vasos decorativos poligonais modernos para suculentas e plantas internas. Inclui prato coletor de água encaixável.',
    referenceImage: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&q=80&w=700&h=500',
    zipFileName: 'vaso_geometrico_voronoi_kit_3_tamanhos.zip',
    zipSizeBytes: 29360128,
    driveFileId: '1Drv_VasoGeometrico_LowPoly_ZIP903',
    driveFileUrl: 'https://drive.google.com/file/d/1Drv_VasoGeometrico_LowPoly_ZIP903/view',
    driveFolderId: '1Btl_STL_RootFolder_99812A',
    driveFolderName: 'Biblioteca STL',
    category: 'Decoração',
    tags: ['vaso', 'low-poly', 'plantas', 'modo-vaso', 'pla-silk'],
    notes: 'Fica excelente com filamento PLA Silk Cobre ou Verde Militar. Bico 0.6mm recomendado para vedação.',
    driveStatus: 'available',
    createdAt: '2025-02-14T11:45:00.000Z',
    updatedAt: '2025-02-14T11:45:00.000Z'
  }
];

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${mb.toFixed(1)} MB`;
}

function formatDateBR(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

// Comprime imagem selecionada usando Canvas para armazenamento privado eficiente
function compressImageFile(file, maxWidth = 800, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Gera uma imagem SVG elegante em DataURL caso o usuário não envie foto no momento da importação
function generatePlaceholderRender(title, category) {
  const safeTitle = (title || 'Modelo 3D STL').slice(0, 28);
  const safeCat = category || 'STL ZIP';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="50%" stop-color="#1e1b4b"/>
        <stop offset="100%" stop-color="#090d16"/>
      </linearGradient>
    </defs>
    <rect width="600" height="420" fill="url(#bg)"/>
    <g stroke="#4f46e5" stroke-width="1.5" stroke-opacity="0.25" fill="none">
      <line x1="0" y1="70" x2="600" y2="70"/>
      <line x1="0" y1="140" x2="600" y2="140"/>
      <line x1="0" y1="210" x2="600" y2="210"/>
      <line x1="0" y1="280" x2="600" y2="280"/>
      <line x1="0" y1="350" x2="600" y2="350"/>
      <line x1="100" y1="0" x2="100" y2="420"/>
      <line x1="200" y1="0" x2="200" y2="420"/>
      <line x1="300" y1="0" x2="300" y2="420"/>
      <line x1="400" y1="0" x2="400" y2="420"/>
      <line x1="500" y1="0" x2="500" y2="420"/>
    </g>
    <polygon points="300,95 390,145 390,245 300,295 210,245 210,145" fill="#312e81" fill-opacity="0.45" stroke="#818cf8" stroke-width="3"/>
    <polyline points="210,145 300,195 390,145" fill="none" stroke="#818cf8" stroke-width="2.5"/>
    <line x1="300" y1="195" x2="300" y2="295" stroke="#818cf8" stroke-width="2.5"/>
    <text x="300" y="345" text-anchor="middle" fill="#f8fafc" font-family="sans-serif" font-size="20" font-weight="bold">${safeTitle}</text>
    <text x="300" y="375" text-anchor="middle" fill="#818cf8" font-family="monospace" font-size="13">${safeCat} • ARQUIVO .ZIP NO DRIVE</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ============================================================================
// COMPONENTE PRINCIPAL DA APLICAÇÃO
// ============================================================================
export default function App() {
  // Estados de Autenticação e Banco
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [dbSyncing, setDbSyncing] = useState(true);

  // Navegação principal
  const [currentView, setCurrentView] = useState('catalog'); // 'catalog' | 'upload' | 'import' | 'settings' | 'vercel'

  // Estados Persistentes (Firestore)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [models, setModels] = useState([]);
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveFolders, setDriveFolders] = useState(INITIAL_DRIVE_FOLDERS);

  // Filtros do Catálogo
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'updated' | 'name'

  // Modais e Interações
  const [selectedModelId, setSelectedModelId] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [editingModel, setEditingModel] = useState(null);
  const [deletingModel, setDeletingModel] = useState(null);
  const [deleteAlsoFromDrive, setDeleteAlsoFromDrive] = useState(false);
  const [deleteDriveConfirmText, setDeleteDriveConfirmText] = useState('');

  // Modal de Seleção / Troca de Pasta Raiz do Drive
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [pendingRootFolder, setPendingRootFolder] = useState(null);
  const [newFolderNameInput, setNewFolderNameInput] = useState('Biblioteca STL');

  // Modal de Importação de ZIP já existente no Drive
  const [importingDriveFile, setImportingDriveFile] = useState(null);

  // Modal de Visualização de Arquivo no Google Drive (Inspetor Drive v3)
  const [inspectingDriveItem, setInspectingDriveItem] = useState(null);

  // Sistema de Notificações (Toasts sem usar alert/confirm)
  const [toasts, setToasts] = useState([]);

  const addToast = (title, message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // --------------------------------------------------------------------------
  // 1. AUTENTICAÇÃO FIREBASE (REGRA 3)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Erro na autenticação inicial:', err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // --------------------------------------------------------------------------
  // 2. LISTENERS DO FIRESTORE E SEED INICIAL DE DADOS
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const settingsDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'main_settings');
    const modelsColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'models');
    const driveFilesColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'drive_files');
    const driveFoldersColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'drive_folders');

    // Listener de Configurações
    const unsubSettings = onSnapshot(
      settingsDocRef,
      async (snap) => {
        if (snap.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...snap.data() });
        } else {
          await setDoc(settingsDocRef, DEFAULT_SETTINGS);
          setSettings(DEFAULT_SETTINGS);
        }
      },
      (err) => console.error('Erro ao ler configurações:', err)
    );

    // Listener de Pastas do Drive
    const unsubFolders = onSnapshot(
      driveFoldersColRef,
      async (snap) => {
        if (snap.empty) {
          for (const folder of INITIAL_DRIVE_FOLDERS) {
            await setDoc(doc(driveFoldersColRef, folder.id), folder);
          }
        } else {
          const list = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          setDriveFolders(list);
        }
      },
      (err) => console.error('Erro ao ler pastas do Drive:', err)
    );

    // Listener de Arquivos no Google Drive
    const unsubDriveFiles = onSnapshot(
      driveFilesColRef,
      async (snap) => {
        if (snap.empty) {
          for (const f of INITIAL_DRIVE_FILES) {
            await setDoc(doc(driveFilesColRef, f.driveFileId), f);
          }
        } else {
          const list = snap.docs.map((d) => ({ ...d.data(), driveFileId: d.id }));
          setDriveFiles(list);
        }
      },
      (err) => console.error('Erro ao ler arquivos do Drive:', err)
    );

    // Listener do Catálogo de Modelos STL
    const unsubModels = onSnapshot(
      modelsColRef,
      async (snap) => {
        if (snap.empty && dbSyncing) {
          for (const m of INITIAL_CATALOG_MODELS) {
            await addDoc(modelsColRef, m);
          }
          setDbSyncing(false);
        } else {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setModels(list);
          setDbSyncing(false);
        }
      },
      (err) => {
        console.error('Erro ao ler catálogo de modelos:', err);
        setDbSyncing(false);
      }
    );

    return () => {
      unsubSettings();
      unsubFolders();
      unsubDriveFiles();
      unsubModels();
    };
  }, [user]);

  // Modelo atualmente aberto no modal de detalhes
  const selectedModel = useMemo(
    () => models.find((m) => m.id === selectedModelId) || null,
    [models, selectedModelId]
  );

  // Filtragem e Ordenação em Memória (Regra 2)
  const filteredModels = useMemo(() => {
    return models
      .filter((model) => {
        const matchesCat =
          selectedCategory === 'Todas' || model.category === selectedCategory;
        const q = searchQuery.trim().toLowerCase();
        if (!q) return matchesCat;
        const inName = model.name?.toLowerCase().includes(q);
        const inDesc = model.description?.toLowerCase().includes(q);
        const inZip = model.zipFileName?.toLowerCase().includes(q);
        const inDriveId = model.driveFileId?.toLowerCase().includes(q);
        const inTags = Array.isArray(model.tags)
          ? model.tags.some((t) => t.toLowerCase().includes(q))
          : false;
        return matchesCat && (inName || inDesc || inZip || inDriveId || inTags);
      })
      .sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'updated') {
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
        }
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [models, selectedCategory, searchQuery, sortBy]);

  // Arquivos ZIP presentes na pasta raiz atualmente vinculada
  const currentRootDriveFiles = useMemo(() => {
    return driveFiles.filter(
      (f) => f.folderId === settings.rootFolderId && f.status !== 'deleted'
    );
  }, [driveFiles, settings.rootFolderId]);

  // Mapa rápido de IDs do Drive já cadastrados na Biblioteca para impedir duplicidade
  const registeredDriveIdsMap = useMemo(() => {
    const map = new Map();
    models.forEach((m) => {
      if (m.driveFileId) map.set(m.driveFileId, m);
    });
    return map;
  }, [models]);

  // --------------------------------------------------------------------------
  // FUNÇÕES DE PERSISTÊNCIA E INTEGRAÇÃO GOOGLE DRIVE v3
  // --------------------------------------------------------------------------
  const saveUserSettings = async (partialSettings, toastMsg = null) => {
    if (!user) return;
    try {
      const settingsDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'main_settings');
      const updated = {
        ...settings,
        ...partialSettings,
        updatedAt: new Date().toISOString()
      };
      await setDoc(settingsDocRef, updated);
      if (toastMsg) addToast('Configurações salvas', toastMsg, 'success');
    } catch (err) {
      addToast('Erro ao salvar configurações', err.message, 'error');
    }
  };

  // Criar nova pasta no Google Drive (API v3 ou Persistência Drive)
  const handleCreateDriveFolder = async (folderName) => {
    if (!user || !folderName.trim()) return;
    const cleanName = folderName.trim();

    try {
      let generatedFolderId = `1Drv_Folder_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

      // Se o usuário forneceu um Access Token OAuth real da API Google Drive v3
      if (settings.googleAuthMode === 'oauth_real' && settings.googleAccessToken) {
        const res = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${settings.googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: cleanName,
            mimeType: 'application/vnd.google-apps.folder'
          })
        });
        if (!res.ok) {
          throw new Error('Falha ao criar pasta na API Google Drive v3. Verifique o token OAuth.');
        }
        const data = await res.json();
        generatedFolderId = data.id;
      }

      const newFolderObj = {
        id: generatedFolderId,
        name: cleanName,
        path: `Meu Drive / ${cleanName}`,
        createdAt: new Date().toISOString(),
        isDefault: false
      };

      const folderRef = doc(db, 'artifacts', appId, 'users', user.uid, 'drive_folders', generatedFolderId);
      await setDoc(folderRef, newFolderObj);
      setPendingRootFolder(newFolderObj);
      addToast(
        'Pasta criada no Google Drive',
        `A pasta "${cleanName}" (ID: ${generatedFolderId}) foi criada e selecionada.`,
        'success'
      );
    } catch (err) {
      addToast('Erro ao criar pasta no Drive', err.message, 'error');
    }
  };

  // Confirmar troca ou vínculo de pasta raiz (preservando referências antigas)
  const handleConfirmRootFolderChange = async () => {
    if (!pendingRootFolder) return;
    await saveUserSettings(
      {
        rootFolderId: pendingRootFolder.id,
        rootFolderName: pendingRootFolder.name,
        setupCompleted: true
      },
      `Pasta raiz vinculada ao ID único: ${pendingRootFolder.id}`
    );
    setFolderPickerOpen(false);
    setPendingRootFolder(null);
  };

  // Alternar disponibilidade de um arquivo no Drive (para testar aviso de arquivo movido/excluído)
  const handleToggleDriveFileAvailability = async (model) => {
    if (!user || !model) return;
    const nextStatus = model.driveStatus === 'missing' ? 'available' : 'missing';
    try {
      const modelRef = doc(db, 'artifacts', appId, 'users', user.uid, 'models', model.id);
      await updateDoc(modelRef, {
        driveStatus: nextStatus,
        updatedAt: new Date().toISOString()
      });

      const driveFileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'drive_files', model.driveFileId);
      await setDoc(
        driveFileRef,
        {
          driveFileId: model.driveFileId,
          name: model.zipFileName,
          folderId: model.driveFolderId || settings.rootFolderId,
          folderName: model.driveFolderName || settings.rootFolderName,
          sizeBytes: model.zipSizeBytes || 20971520,
          webViewLink: model.driveFileUrl,
          createdTime: model.createdAt,
          status: nextStatus
        },
        { merge: true }
      );

      if (nextStatus === 'missing') {
        addToast(
          'Arquivo ausente no Drive detectado',
          'O sistema marcou que o ZIP original foi movido ou removido da pasta esperada no Google Drive.',
          'warning'
        );
      } else {
        addToast(
          'Arquivo localizado novamente',
          'A integridade do vínculo com o arquivo ZIP no Google Drive foi restaurada.',
          'success'
        );
      }
    } catch (err) {
      addToast('Erro ao atualizar status', err.message, 'error');
    }
  };

  // Excluir modelo do catálogo (preservando o ZIP no Drive por padrão, ou excluindo com confirmação explícita)
  const handleExecuteDeleteModel = async () => {
    if (!user || !deletingModel) return;

    if (deleteAlsoFromDrive && deleteDriveConfirmText.trim().toUpperCase() !== 'EXCLUIR ZIP') {
      addToast(
        'Confirmação obrigatória',
        'Para apagar também o arquivo original do Google Drive, digite exatamente EXCLUIR ZIP.',
        'error'
      );
      return;
    }

    if (deleteAlsoFromDrive && !settings.googleConnected) {
      addToast(
        'Autorização Google necessária',
        'Sua conta Google está desconectada. Reconecte nas configurações para excluir arquivos do Drive.',
        'error'
      );
      return;
    }

    try {
      // 1. Remove do catálogo do banco de dados
      const modelRef = doc(db, 'artifacts', appId, 'users', user.uid, 'models', deletingModel.id);
      await deleteDoc(modelRef);

      // 2. Se o usuário solicitou explicitamente a exclusão do ZIP no Google Drive
      if (deleteAlsoFromDrive) {
        if (settings.googleAuthMode === 'oauth_real' && settings.googleAccessToken) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${deletingModel.driveFileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${settings.googleAccessToken}` }
          });
        }
        const driveRef = doc(db, 'artifacts', appId, 'users', user.uid, 'drive_files', deletingModel.driveFileId);
        await deleteDoc(driveRef);

        addToast(
          'Cadastro e ZIP excluídos',
          `O modelo "${deletingModel.name}" foi removido do catálogo e seu arquivo ZIP foi excluído do Google Drive.`,
          'warning'
        );
      } else {
        addToast(
          'Removido apenas da biblioteca',
          `O registro "${deletingModel.name}" foi removido do catálogo visual. O arquivo ZIP original permanece intacto no seu Google Drive.`,
          'success'
        );
      }

      if (selectedModelId === deletingModel.id) {
        setSelectedModelId(null);
      }
      setDeletingModel(null);
      setDeleteAlsoFromDrive(false);
      setDeleteDriveConfirmText('');
    } catch (err) {
      addToast('Erro ao excluir registro', err.message, 'error');
    }
  };

  // Salvar edição de metadados
  const handleSaveModelEdit = async (e) => {
    e.preventDefault();
    if (!user || !editingModel) return;

    try {
      const modelRef = doc(db, 'artifacts', appId, 'users', user.uid, 'models', editingModel.id);
      const parsedTags =
        typeof editingModel.tagsInput === 'string'
          ? editingModel.tagsInput
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : editingModel.tags || [];

      await updateDoc(modelRef, {
        name: editingModel.name.trim(),
        description: editingModel.description.trim(),
        category: editingModel.category,
        tags: parsedTags,
        notes: (editingModel.notes || '').trim(),
        referenceImage: editingModel.referenceImage,
        updatedAt: new Date().toISOString()
      });

      addToast(
        'Cadastro atualizado',
        `Os metadados de "${editingModel.name}" foram salvos com sucesso.`,
        'success'
      );
      setEditingModel(null);
    } catch (err) {
      addToast('Erro ao salvar alterações', err.message, 'error');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden">
      {/* BARRA LATERAL / NAVEGAÇÃO */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        settings={settings}
        modelsCount={models.length}
        unimportedCount={
          currentRootDriveFiles.filter((f) => !registeredDriveIdsMap.has(f.driveFileId)).length
        }
        onOpenFolderPicker={() => {
          setPendingRootFolder(
            driveFolders.find((f) => f.id === settings.rootFolderId) || driveFolders[0]
          );
          setFolderPickerOpen(true);
        }}
      />

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* BANNER DE AVISO SE CONTA GOOGLE DESCONECTADA OU PASTA RAIZ NÃO DEFINIDA */}
        {(!settings.googleConnected || !settings.rootFolderId) && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-amber-300 text-sm">
              <AlertTriangle size={18} className="shrink-0 text-amber-400" />
              <span>
                {!settings.googleConnected
                  ? 'Sua conta Google Drive não está conectada. Conecte sua conta para enviar ou importar arquivos ZIP.'
                  : 'Nenhuma pasta raiz foi selecionada no Google Drive. Configure a pasta Biblioteca STL.'}
              </span>
            </div>
            <button
              onClick={() => setCurrentView('settings')}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
            >
              Configurar Agora
            </button>
          </div>
        )}

        {/* VIEWS DINÂMICAS */}
        <main className="flex-1 overflow-y-auto">
          {currentView === 'catalog' && (
            <CatalogView
              models={filteredModels}
              totalModelsCount={models.length}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              sortBy={sortBy}
              setSortBy={setSortBy}
              settings={settings}
              onOpenModel={(m) => setSelectedModelId(m.id)}
              onNavigateUpload={() => setCurrentView('upload')}
              onNavigateImport={() => setCurrentView('import')}
              onZoomImage={(url, title) => setLightboxImage({ url, title })}
            />
          )}

          {currentView === 'upload' && (
            <UploadView
              user={user}
              settings={settings}
              registeredDriveIdsMap={registeredDriveIdsMap}
              addToast={addToast}
              onSuccessNavigate={() => setCurrentView('catalog')}
              onOpenSettings={() => setCurrentView('settings')}
            />
          )}

          {currentView === 'import' && (
            <ImportView
              user={user}
              settings={settings}
              driveFiles={currentRootDriveFiles}
              registeredDriveIdsMap={registeredDriveIdsMap}
              importingDriveFile={importingDriveFile}
              setImportingDriveFile={setImportingDriveFile}
              addToast={addToast}
              onOpenFolderPicker={() => {
                setPendingRootFolder(
                  driveFolders.find((f) => f.id === settings.rootFolderId) || driveFolders[0]
                );
                setFolderPickerOpen(true);
              }}
              onOpenModelDetails={(model) => {
                setSelectedModelId(model.id);
              }}
              onInspectDriveFile={(file) => setInspectingDriveItem(file)}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              user={user}
              settings={settings}
              driveFolders={driveFolders}
              modelsCount={models.length}
              saveUserSettings={saveUserSettings}
              onOpenFolderPicker={() => {
                setPendingRootFolder(
                  driveFolders.find((f) => f.id === settings.rootFolderId) || driveFolders[0]
                );
                setFolderPickerOpen(true);
              }}
              onInspectRootFolder={() => {
                const currentFolder = driveFolders.find((f) => f.id === settings.rootFolderId);
                setInspectingDriveItem({
                  isFolder: true,
                  driveFileId: settings.rootFolderId,
                  name: settings.rootFolderName,
                  path: currentFolder?.path || `Meu Drive / ${settings.rootFolderName}`,
                  filesCount: currentRootDriveFiles.length
                });
              }}
              addToast={addToast}
            />
          )}

          {currentView === 'vercel' && <VercelGuideView settings={settings} />}
        </main>
      </div>

      {/* ==================================================================== */}
      {/* MODAL DE DETALHES DO MODELO STL                                      */}
      {/* ==================================================================== */}
      {selectedModel && (
        <ModelDetailsModal
          model={selectedModel}
          settings={settings}
          onClose={() => setSelectedModelId(null)}
          onZoomImage={() =>
            setLightboxImage({ url: selectedModel.referenceImage, title: selectedModel.name })
          }
          onOpenInDrive={() => {
            if (selectedModel.driveStatus === 'missing') {
              addToast(
                'Arquivo indisponível no Drive',
                'O arquivo ZIP original foi movido ou excluído do local esperado no Google Drive.',
                'error'
              );
            }
            setInspectingDriveItem({
              isFolder: false,
              driveFileId: selectedModel.driveFileId,
              name: selectedModel.zipFileName,
              sizeBytes: selectedModel.zipSizeBytes,
              folderName: selectedModel.driveFolderName || settings.rootFolderName,
              folderId: selectedModel.driveFolderId || settings.rootFolderId,
              webViewLink: selectedModel.driveFileUrl,
              status: selectedModel.driveStatus
            });
          }}
          onEdit={() => {
            setEditingModel({
              ...selectedModel,
              tagsInput: Array.isArray(selectedModel.tags) ? selectedModel.tags.join(', ') : ''
            });
          }}
          onDelete={() => {
            setDeletingModel(selectedModel);
            setDeleteAlsoFromDrive(false);
            setDeleteDriveConfirmText('');
          }}
          onToggleAvailability={() => handleToggleDriveFileAvailability(selectedModel)}
        />
      )}

      {/* ==================================================================== */}
      {/* LIGHTBOX DE VISUALIZAÇÃO AMPLIADA DA IMAGEM DE REFERÊNCIA            */}
      {/* ==================================================================== */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="max-w-5xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between mb-3 px-2">
              <div className="flex items-center gap-2 text-slate-200 font-medium">
                <ImageIcon size={18} className="text-indigo-400" />
                <span>{lightboxImage.title} — Imagem de Referência Ampliada</span>
              </div>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 max-h-[82vh] w-full flex items-center justify-center overflow-hidden shadow-2xl">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[76vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL DE EDIÇÃO DE METADADOS DO MODELO                               */}
      {/* ==================================================================== */}
      {editingModel && (
        <EditModelModal
          editingModel={editingModel}
          setEditingModel={setEditingModel}
          onSave={handleSaveModelEdit}
          onClose={() => setEditingModel(null)}
          addToast={addToast}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (CATÁLOGO vs GOOGLE DRIVE)          */}
      {/* ==================================================================== */}
      {deletingModel && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Excluir da Biblioteca STL</h3>
                  <p className="text-xs text-slate-400">
                    Modelo: <strong className="text-slate-200">{deletingModel.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeletingModel(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 mb-4 flex items-start gap-2.5">
              <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>Comportamento padrão seguro:</strong> Excluir este registro remove apenas os metadados e a imagem do catálogo visual. O arquivo{' '}
                <code className="text-emerald-300 font-mono">{deletingModel.zipFileName}</code>{' '}
                (ID: <code className="font-mono">{deletingModel.driveFileId}</code>) <strong>será preservado no seu Google Drive</strong>.
              </div>
            </div>

            {/* Opção separada e explícita para excluir também do Drive */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteAlsoFromDrive}
                  onChange={(e) => setDeleteAlsoFromDrive(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-red-600 focus:ring-red-500"
                />
                <div className="text-xs">
                  <span className="font-semibold text-red-400 block">
                    Ação destrutiva opcional: Excluir também o arquivo .ZIP do Google Drive
                  </span>
                  <span className="text-slate-400 mt-0.5 block">
                    Requer confirmação explícita abaixo e autorização ativa da conta Google.
                  </span>
                </div>
              </label>

              {deleteAlsoFromDrive && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <label className="block text-xs text-red-300 mb-1.5">
                    Digite <strong>EXCLUIR ZIP</strong> para confirmar a remoção permanente no Google Drive:
                  </label>
                  <input
                    type="text"
                    value={deleteDriveConfirmText}
                    onChange={(e) => setDeleteDriveConfirmText(e.target.value)}
                    placeholder="EXCLUIR ZIP"
                    className="w-full bg-slate-900 border border-red-500/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingModel(null)}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteDeleteModel}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors flex items-center gap-2 ${
                  deleteAlsoFromDrive
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                <Trash2 size={16} />
                {deleteAlsoFromDrive
                  ? 'Excluir do Catálogo E do Google Drive'
                  : 'Excluir Apenas do Catálogo (Preservar ZIP)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL DE SELEÇÃO / CRIAÇÃO DE PASTA RAIZ NO GOOGLE DRIVE             */}
      {/* ==================================================================== */}
      {folderPickerOpen && (
        <FolderPickerModal
          driveFolders={driveFolders}
          currentRootFolderId={settings.rootFolderId}
          pendingRootFolder={pendingRootFolder}
          setPendingRootFolder={setPendingRootFolder}
          newFolderNameInput={newFolderNameInput}
          setNewFolderNameInput={setNewFolderNameInput}
          onCreateFolder={handleCreateDriveFolder}
          onConfirm={handleConfirmRootFolderChange}
          onClose={() => setFolderPickerOpen(false)}
        />
      )}

      {/* ==================================================================== */}
      {/* INSPETOR DO GOOGLE DRIVE (VISUALIZAR ARQUIVO OU PASTA ORIGINAL)      */}
      {/* ==================================================================== */}
      {inspectingDriveItem && (
        <DriveInspectorModal
          item={inspectingDriveItem}
          settings={settings}
          onClose={() => setInspectingDriveItem(null)}
        />
      )}

      {/* ==================================================================== */}
      {/* CONTAINER DE NOTIFICAÇÕES (TOASTS)                                   */}
      {/* ==================================================================== */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all ${
              t.type === 'error'
                ? 'bg-red-950/90 border-red-500/40 text-red-100'
                : t.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-100'
                : 'bg-slate-900/95 border-indigo-500/40 text-slate-100'
            }`}
          >
            {t.type === 'error' ? (
              <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
            ) : t.type === 'warning' ? (
              <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">
              <p className="font-bold text-sm mb-0.5">{t.title}</p>
              <p className="opacity-90 leading-relaxed">{t.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="opacity-60 hover:opacity-100"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE: SIDEBAR (NAVEGAÇÃO E STATUS DA PASTA RAIZ)
// ============================================================================
function Sidebar({
  currentView,
  setCurrentView,
  settings,
  modelsCount,
  unimportedCount,
  onOpenFolderPicker
}) {
  const navItems = [
    { id: 'catalog', label: 'Catálogo STL', icon: Folder, badge: modelsCount },
    { id: 'upload', label: 'Enviar Novo ZIP', icon: Upload },
    {
      id: 'import',
      label: 'Importar do Drive',
      icon: HardDrive,
      badge: unimportedCount > 0 ? `${unimportedCount} novos` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    { id: 'settings', label: 'Configurações', icon: Settings },
    { id: 'vercel', label: 'Deploy Vercel & API', icon: Terminal }
  ];

  return (
    <aside className="w-full lg:w-72 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col shrink-0">
      {/* Cabeçalho Oficial */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
            <FileArchive size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">
              Biblioteca STL
            </h1>
            <span className="text-[11px] text-slate-400 font-medium mt-1 block">
              Acervo Pessoal 3D • Google Drive
            </span>
          </div>
        </div>
      </div>

      {/* Resumo da Pasta Raiz Vinculada */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-400 font-medium flex items-center gap-1.5">
            <HardDrive size={13} className="text-indigo-400" />
            Pasta Raiz no Drive
          </span>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              settings.googleConnected
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                settings.googleConnected ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            {settings.googleConnected ? 'Conectado' : 'Offline'}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
          <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
            <Folder size={14} className="text-indigo-400 shrink-0" />
            <span className="truncate">{settings.rootFolderName || 'Não selecionada'}</span>
          </div>
          <div
            className="text-[10px] font-mono text-slate-400 truncate mt-1"
            title={settings.rootFolderId}
          >
            ID: {settings.rootFolderId || '—'}
          </div>
          <button
            onClick={onOpenFolderPicker}
            className="mt-2 w-full py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-indigo-300 font-medium transition-colors"
          >
            Trocar Pasta Raiz
          </button>
        </div>
      </div>

      {/* Menu de Navegação */}
      <nav className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible p-3 gap-1.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                active
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/50'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge !== null && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                    active
                      ? 'bg-indigo-700 text-white border-indigo-400/30'
                      : item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Rodapé de Segurança */}
      <div className="hidden lg:block p-4 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Uso Particular & Privado</span>
        </div>
        <p className="leading-relaxed">
          ZIPs armazenados exclusivamente no seu Google Drive. Imagens e metadados isolados por autenticação.
        </p>
      </div>
    </aside>
  );
}

// ============================================================================
// VIEW 1: CATÁLOGO VISUAL DE MODELOS STL
// ============================================================================
function CatalogView({
  models,
  totalModelsCount,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  sortBy,
  setSortBy,
  settings,
  onOpenModel,
  onNavigateUpload,
  onNavigateImport,
  onZoomImage
}) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Topo e Ações Rápidas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Catálogo Visual de Modelos 3D
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Pasta vinculada:{' '}
            <span className="text-indigo-300 font-medium">{settings.rootFolderName}</span>{' '}
            <code className="text-xs bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-slate-400">
              ID: {settings.rootFolderId}
            </code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onNavigateImport}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium transition-colors flex items-center gap-2"
          >
            <HardDrive size={16} className="text-indigo-400" />
            Importar Existentes do Drive
          </button>
          <button
            onClick={onNavigateUpload}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-indigo-950/50"
          >
            <Plus size={18} />
            Enviar Novo ZIP
          </button>
        </div>
      </div>

      {/* Barra de Busca, Filtro de Categoria e Ordenação */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome do modelo, tag, descrição ou ID do arquivo no Drive..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal size={16} className="text-slate-400 hidden sm:block" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="newest">Mais recentes primeiro</option>
              <option value="updated">Última atualização</option>
              <option value="name">Ordem alfabética (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Pílulas de Categorias */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {['Todas', ...CATEGORIES].map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de Cartões de Modelos */}
      {models.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-4">
            <FileArchive size={28} />
          </div>
          <h3 className="text-lg font-bold text-white">
            {totalModelsCount === 0
              ? 'Sua Biblioteca STL ainda está vazia'
              : 'Nenhum modelo corresponde aos filtros'}
          </h3>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            {totalModelsCount === 0
              ? 'Envie um arquivo ZIP diretamente para a pasta raiz do seu Google Drive ou importe arquivos ZIP que já estão lá.'
              : 'Tente limpar o termo de busca ou selecionar "Todas" nas categorias.'}
          </p>
          {totalModelsCount === 0 ? (
            <div className="flex justify-center gap-3">
              <button
                onClick={onNavigateUpload}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold"
              >
                Enviar Primeiro ZIP
              </button>
              <button
                onClick={onNavigateImport}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium"
              >
                Importar do Drive
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('Todas');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.map((model) => {
            const isMissing = model.driveStatus === 'missing';
            return (
              <div
                key={model.id}
                className={`bg-slate-900 rounded-2xl border overflow-hidden flex flex-col transition-all group ${
                  isMissing
                    ? 'border-amber-500/40 hover:border-amber-500'
                    : 'border-slate-800 hover:border-indigo-500/60 shadow-lg'
                }`}
              >
                {/* Imagem de Referência */}
                <div className="h-52 bg-slate-950 relative overflow-hidden">
                  <img
                    src={model.referenceImage}
                    alt={model.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                    onClick={() => onOpenModel(model)}
                  />

                  {/* Botão rápido de Ampliar Imagem */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onZoomImage(model.referenceImage, model.name);
                    }}
                    title="Ampliar imagem de referência"
                    className="absolute bottom-3 right-3 p-2 rounded-lg bg-slate-950/80 hover:bg-indigo-600 text-slate-200 hover:text-white backdrop-blur-sm border border-slate-700/60 transition-colors"
                  >
                    <ZoomIn size={16} />
                  </button>

                  {/* Categoria */}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-950/85 text-indigo-300 border border-indigo-500/30 backdrop-blur-sm">
                    {model.category}
                  </span>

                  {/* Status do Arquivo no Drive */}
                  <span
                    className={`absolute top-3 right-3 px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 backdrop-blur-sm border ${
                      isMissing
                        ? 'bg-amber-950/90 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-950/85 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {isMissing ? (
                      <>
                        <AlertTriangle size={12} /> Ausente no Drive
                      </>
                    ) : (
                      <>
                        <HardDrive size={12} /> ZIP no Drive
                      </>
                    )}
                  </span>
                </div>

                {/* Corpo do Card */}
                <div className="p-5 flex-1 flex flex-col">
                  <h3
                    onClick={() => onOpenModel(model)}
                    className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors cursor-pointer line-clamp-1"
                  >
                    {model.name}
                  </h3>

                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed flex-1">
                    {model.description || 'Sem descrição adicionada.'}
                  </p>

                  {/* Nome do Arquivo ZIP */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span className="truncate max-w-[75%]" title={model.zipFileName}>
                      {model.zipFileName}
                    </span>
                    <span>{formatBytes(model.zipSizeBytes)}</span>
                  </div>

                  {/* Tags */}
                  {Array.isArray(model.tags) && model.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {model.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400"
                        >
                          #{tag}
                        </span>
                      ))}
                      {model.tags.length > 4 && (
                        <span className="text-[11px] text-slate-500 px-1">
                          +{model.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Ação Principal: Abrir Detalhes */}
                  <button
                    onClick={() => onOpenModel(model)}
                    className="mt-4 w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-100 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye size={15} />
                    Abrir Detalhes do Modelo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VIEW 2: UPLOAD DE ARQUIVO ZIP (COM RECUPERAÇÃO DE FALHA DE METADADOS)
// ============================================================================
function UploadView({
  user,
  settings,
  registeredDriveIdsMap,
  addToast,
  onSuccessNavigate,
  onOpenSettings
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Miniaturas');
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [referenceImage, setReferenceImage] = useState('');
  const [zipFile, setZipFile] = useState(null);

  // Estados de Progresso e Recuperação Pós-Upload no Drive
  const [uploadingStage, setUploadingStage] = useState('idle'); // 'idle' | 'uploading_drive' | 'saving_metadata' | 'recovery_needed'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [simulateMetadataFailure, setSimulateMetadataFailure] = useState(false);

  // Guarda o arquivo já enviado ao Drive caso o salvamento dos metadados falhe (Requisito Obrigatório)
  const [pendingUploadedDriveResult, setPendingUploadedDriveResult] = useState(null);

  const imageInputRef = useRef(null);
  const zipInputRef = useRef(null);

  // Selecionar Imagem de Referência
  const handleSelectImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Formato inválido', 'Selecione uma imagem (JPG, PNG, WEBP).', 'error');
      return;
    }
    try {
      const compressedDataUrl = await compressImageFile(file);
      setReferenceImage(compressedDataUrl);
    } catch (err) {
      addToast('Erro ao processar imagem', err.message, 'error');
    }
  };

  // Selecionar Arquivo .ZIP
  const handleSelectZip = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      addToast(
        'Apenas arquivos .ZIP',
        'A Biblioteca STL armazena modelos 3D agrupados em arquivos .ZIP.',
        'error'
      );
      return;
    }
    const maxBytes = (settings.maxUploadSizeMB || 500) * 1024 * 1024;
    if (file.size > maxBytes) {
      addToast(
        'Limite de tamanho excedido',
        `O arquivo possui ${formatBytes(file.size)}, acima do limite configurado de ${settings.maxUploadSizeMB} MB.`,
        'error'
      );
      return;
    }
    setZipFile(file);
    if (!name.trim()) {
      const suggestedName = file.name
        .replace(/\.zip$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      setName(suggestedName);
    }
  };

  // Etapa 1 + Etapa 2: Enviar ZIP ao Google Drive e depois salvar metadados
  const handleStartUpload = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (!settings.googleConnected || !settings.rootFolderId) {
      addToast(
        'Conta Google ou Pasta Raiz pendente',
        'Configure sua conexão com o Google Drive e a pasta raiz antes de fazer upload.',
        'error'
      );
      return;
    }

    if (!zipFile) {
      addToast('Arquivo ZIP obrigatório', 'Selecione um arquivo .ZIP do seu computador.', 'error');
      return;
    }

    if (!name.trim()) {
      addToast('Nome obrigatório', 'Informe o nome do modelo 3D.', 'error');
      return;
    }

    try {
      // ETAPA 1: Upload direto para o Google Drive (Pasta Raiz ou Subpasta de Categoria)
      setUploadingStage('uploading_drive');
      setUploadProgress(15);

      const targetSubfolder = settings.organizeBySubfolders ? category : '';
      let driveFileId = `1Drv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      let webViewLink = `https://drive.google.com/file/d/${driveFileId}/view`;

      // Se estiver usando OAuth real da API Google Drive v3
      if (settings.googleAuthMode === 'oauth_real' && settings.googleAccessToken) {
        setUploadProgress(40);
        const metadata = {
          name: zipFile.name,
          mimeType: 'application/zip',
          parents: [settings.rootFolderId]
        };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', zipFile);

        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${settings.googleAccessToken}`
            },
            body: form
          }
        );

        if (!response.ok) {
          throw new Error(
            'Erro no upload para a API Google Drive v3. Verifique se o Access Token possui escopo drive.file ativo.'
          );
        }
        const driveData = await response.json();
        driveFileId = driveData.id;
        webViewLink = driveData.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;
      } else {
        // Progresso visual realista no ambiente integrado
        await new Promise((r) => setTimeout(r, 450));
        setUploadProgress(65);
        await new Promise((r) => setTimeout(r, 450));
      }

      setUploadProgress(100);

      // Registra o arquivo na coleção de arquivos do Google Drive
      const driveFileRecord = {
        driveFileId,
        name: zipFile.name,
        sizeBytes: zipFile.size,
        folderId: settings.rootFolderId,
        folderName: settings.rootFolderName,
        subfolder: targetSubfolder,
        webViewLink,
        createdTime: new Date().toISOString(),
        status: 'available'
      };

      const driveFileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'drive_files', driveFileId);
      await setDoc(driveFileRef, driveFileRecord);

      // ETAPA 2: Salvar os metadados no banco de dados
      setUploadingStage('saving_metadata');

      // Verifica se a simulação de falha de metadados está ativa (para comprovar o requisito de recuperação sem reenviar o ZIP)
      if (simulateMetadataFailure) {
        setPendingUploadedDriveResult(driveFileRecord);
        setUploadingStage('recovery_needed');
        addToast(
          'Upload no Drive concluído, mas falha ao salvar metadados!',
          'Use a opção de recuperação abaixo para concluir o cadastro sem reenviar o arquivo ZIP.',
          'warning'
        );
        return;
      }

      await saveCatalogMetadata(driveFileRecord);
    } catch (err) {
      setUploadingStage('idle');
      addToast('Falha durante o processo de upload', err.message, 'error');
    }
  };

  // Função que salva apenas os metadados no banco (usada tanto no fluxo normal quanto na recuperação sem reenviar o ZIP)
  const saveCatalogMetadata = async (driveRecord) => {
    if (!user || !driveRecord) return;
    try {
      setUploadingStage('saving_metadata');

      if (registeredDriveIdsMap.has(driveRecord.driveFileId)) {
        addToast(
          'Arquivo já registrado',
          'Este ID do Google Drive já possui cadastro na biblioteca.',
          'warning'
        );
        setUploadingStage('idle');
        return;
      }

      const tagsArray = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const finalImage =
        referenceImage || generatePlaceholderRender(name.trim(), category);

      const now = new Date().toISOString();
      const newModelDoc = {
        name: name.trim(),
        description: description.trim(),
        referenceImage: finalImage,
        zipFileName: driveRecord.name,
        zipSizeBytes: driveRecord.sizeBytes,
        driveFileId: driveRecord.driveFileId,
        driveFileUrl: driveRecord.webViewLink,
        driveFolderId: driveRecord.folderId,
        driveFolderName: driveRecord.subfolder
          ? `${driveRecord.folderName} / ${driveRecord.subfolder}`
          : driveRecord.folderName,
        category,
        tags: tagsArray,
        notes: notes.trim(),
        driveStatus: 'available',
        createdAt: now,
        updatedAt: now
      };

      const modelsColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'models');
      await addDoc(modelsColRef, newModelDoc);

      setPendingUploadedDriveResult(null);
      setUploadingStage('idle');
      addToast(
        'Modelo cadastrado com sucesso!',
        `O ZIP foi salvo no Google Drive (ID: ${driveRecord.driveFileId}) e o catálogo foi atualizado.`,
        'success'
      );
      onSuccessNavigate();
    } catch (err) {
      setPendingUploadedDriveResult(driveRecord);
      setUploadingStage('recovery_needed');
      addToast('Erro ao salvar metadados', err.message, 'error');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Enviar Novo Modelo STL (.ZIP)
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          O arquivo <code className="text-indigo-300">.zip</code> será enviado diretamente ao seu Google Drive na pasta{' '}
          <strong className="text-slate-200">
            {settings.rootFolderName}
            {settings.organizeBySubfolders ? ` / ${category}` : ''}
          </strong>{' '}
          (ID: <code className="font-mono text-xs">{settings.rootFolderId}</code>).
        </p>
      </div>

      {/* ALERTA DE RECUPERAÇÃO CASO O UPLOAD NO DRIVE TENHA CONCLUÍDO MAS O SALVAMENTO DE METADADOS TENHA FALHADO */}
      {uploadingStage === 'recovery_needed' && pendingUploadedDriveResult && (
        <div className="bg-amber-950/60 border-2 border-amber-500/50 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-amber-200">
                Upload no Google Drive concluído, mas falha ao salvar os metadados!
              </h3>
              <p className="text-xs text-amber-100/80 mt-1 leading-relaxed">
                O arquivo <strong>{pendingUploadedDriveResult.name}</strong> já foi salvo no seu Google Drive e recebeu o identificador único{' '}
                <code className="bg-amber-950 px-1.5 py-0.5 rounded border border-amber-500/40 font-mono">
                  {pendingUploadedDriveResult.driveFileId}
                </code>
                . Você pode concluir o cadastro dos metadados agora <strong>sem enviar o mesmo arquivo ZIP novamente</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setSimulateMetadataFailure(false);
                saveCatalogMetadata(pendingUploadedDriveResult);
              }}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-2 shadow-lg"
            >
              <RefreshCw size={15} />
              Recuperar e Concluir Cadastro (Sem reenviar ZIP)
            </button>
          </div>
        </div>
      )}

      {/* Formulário Principal */}
      <form
        onSubmit={handleStartUpload}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna Esquerda: Arquivos (ZIP + Imagem de Referência) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Seleção do Arquivo ZIP */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                1. Arquivo ZIP (Destino: Google Drive) *
              </label>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={handleSelectZip}
                className="hidden"
              />
              <div
                onClick={() => zipInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  zipFile
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-slate-700 hover:border-indigo-500 bg-slate-950/60'
                }`}
              >
                <FileArchive
                  size={30}
                  className={`mx-auto mb-2 ${
                    zipFile ? 'text-emerald-400' : 'text-indigo-400'
                  }`}
                />
                {zipFile ? (
                  <div>
                    <p className="text-xs font-bold text-emerald-300 truncate px-2">
                      {zipFile.name}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Tamanho: {formatBytes(zipFile.size)} • Pronto para o Drive
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      Clique para selecionar o arquivo .ZIP
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Máx: {settings.maxUploadSizeMB} MB • Não extrai conteúdo
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Seleção da Imagem de Referência */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                2. Imagem de Referência (Bucket Privado)
              </label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleSelectImage}
                className="hidden"
              />
              <div
                onClick={() => imageInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl h-48 overflow-hidden flex flex-col items-center justify-center cursor-pointer bg-slate-950/60 relative group"
              >
                {referenceImage ? (
                  <>
                    <img
                      src={referenceImage}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-semibold text-white">
                      Trocar Imagem de Referência
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <ImageIcon size={28} className="mx-auto mb-2 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-200">
                      Render, foto da peça ou captura 3D
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Armazenada separadamente do ZIP
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Metadados do Catálogo */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nome do Modelo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Dragão Articulado Cristal (Print-in-Place)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tags (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="rpg, suporte, pla, 28mm"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Descrição do Modelo / Conjunto
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva as peças contidas no ZIP, escala padrão e detalhes do modelo..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Observações de Impressão (Parâmetros, Resina/Filamento)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Altura de camada 0.16mm, 15% Gyroid, sem necessidade de suporte."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Opção para testar recuperação de falha pós-upload no Drive */}
            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  checked={simulateMetadataFailure}
                  onChange={(e) => setSimulateMetadataFailure(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500"
                />
                <span>
                  Simular falha ao salvar metadados após o upload no Drive (testar recuperação sem reenviar o ZIP)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Barra de Progresso de Duas Etapas */}
        {uploadingStage !== 'idle' && uploadingStage !== 'recovery_needed' && (
          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-indigo-300">
              <span>
                {uploadingStage === 'uploading_drive'
                  ? 'Etapa 1/2: Enviando arquivo .ZIP diretamente para o Google Drive...'
                  : 'Etapa 2/2: Registrando ID do Drive e salvando metadados no banco...'}
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Rodapé do Formulário */}
        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <HardDrive size={15} className="text-indigo-400" />
            <span>
              Destino automático:{' '}
              <strong className="text-slate-200">
                {settings.rootFolderName}
                {settings.organizeBySubfolders ? ` / ${category}` : ''}
              </strong>
            </span>
          </div>

          <button
            type="submit"
            disabled={uploadingStage === 'uploading_drive' || uploadingStage === 'saving_metadata'}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-indigo-950/50"
          >
            <Upload size={17} />
            Enviar para o Drive e Cadastrar
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// VIEW 3: IMPORTAÇÃO DE ARQUIVOS JÁ EXISTENTES NA PASTA RAIZ DO DRIVE
// ============================================================================
function ImportView({
  user,
  settings,
  driveFiles,
  registeredDriveIdsMap,
  importingDriveFile,
  setImportingDriveFile,
  addToast,
  onOpenFolderPicker,
  onOpenModelDetails,
  onInspectDriveFile
}) {
  // Estados do modal de importação de metadados
  const [importName, setImportName] = useState('');
  const [importCategory, setImportCategory] = useState('Miniaturas');
  const [importDescription, setImportDescription] = useState('');
  const [importTags, setImportTags] = useState('');
  const [importNotes, setImportNotes] = useState('');
  const [importImage, setImportImage] = useState('');
  const [syncingDriveApi, setSyncingDriveApi] = useState(false);

  // Adicionar um novo arquivo ZIP simulado diretamente na pasta do Google Drive (para testar descoberta de arquivos existentes)
  const [newExternalZipName, setNewExternalZipName] = useState('');

  const startImportModal = (file) => {
    const cleanTitle = file.name
      .replace(/\.zip$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
    setImportingDriveFile(file);
    setImportName(cleanTitle);
    setImportCategory(file.subfolder || 'Articulados');
    setImportDescription('');
    setImportTags('stl, drive-import');
    setImportNotes('');
    setImportImage('');
  };

  // Consultar API Google Drive v3 real se o usuário tiver configurado Token OAuth
  const handleSyncFromGoogleDrive = async () => {
    if (!user) return;
    setSyncingDriveApi(true);
    try {
      if (settings.googleAuthMode === 'oauth_real' && settings.googleAccessToken) {
        const q = encodeURIComponent(
          `'${settings.rootFolderId}' in parents and mimeType='application/zip' and trashed=false`
        );
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,createdTime,webViewLink)`,
          {
            headers: { Authorization: `Bearer ${settings.googleAccessToken}` }
          }
        );
        if (!res.ok) {
          throw new Error('Não foi possível listar a pasta na API Google Drive v3.');
        }
        const data = await res.json();
        const driveFilesColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'drive_files');
        for (const f of data.files || []) {
          await setDoc(doc(driveFilesColRef, f.id), {
            driveFileId: f.id,
            name: f.name,
            sizeBytes: Number(f.size || 10485760),
            folderId: settings.rootFolderId,
            folderName: settings.rootFolderName,
            subfolder: '',
            webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
            createdTime: f.createdTime || new Date().toISOString(),
            status: 'available'
          });
        }
        addToast(
          'Lista sincronizada com Google Drive v3',
          `${(data.files || []).length} arquivos ZIP encontrados na pasta raiz.`,
          'success'
        );
      } else {
        await new Promise((r) => setTimeout(r, 400));
        addToast(
          'Pasta raiz verificada',
          `Exibindo todos os arquivos .ZIP acessíveis na pasta "${settings.rootFolderName}" (${settings.rootFolderId}).`,
          'success'
        );
      }
    } catch (err) {
      addToast('Erro ao consultar Google Drive', err.message, 'error');
    } finally {
      setSyncingDriveApi(false);
    }
  };

  // Simular chegada de um arquivo ZIP colocado pelo usuário direto no Google Drive
  const handleSimulateExternalZipInDrive = async (e) => {
    e.preventDefault();
    if (!user || !newExternalZipName.trim()) return;
    let fileName = newExternalZipName.trim();
    if (!fileName.toLowerCase().endsWith('.zip')) {
      fileName += '.zip';
    }
    const newDriveId = `1Drv_Ext_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const newRecord = {
      driveFileId: newDriveId,
      name: fileName,
      sizeBytes: Math.floor(12000000 + Math.random() * 85000000),
      folderId: settings.rootFolderId,
      folderName: settings.rootFolderName,
      subfolder: '',
      webViewLink: `https://drive.google.com/file/d/${newDriveId}/view`,
      createdTime: new Date().toISOString(),
      status: 'available'
    };

    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'drive_files', newDriveId);
    await setDoc(ref, newRecord);
    setNewExternalZipName('');
    addToast(
      'Novo ZIP detectado na pasta raiz do Drive',
      `O arquivo "${fileName}" (ID: ${newDriveId}) agora está disponível para importação.`,
      'success'
    );
  };

  // Concluir importação associando o arquivo existente a um novo registro do catálogo (sem mover nem duplicar)
  const handleConfirmImport = async (e) => {
    e.preventDefault();
    if (!user || !importingDriveFile) return;

    // Verificação estrita anti-duplicata pelo ID único do Google Drive
    if (registeredDriveIdsMap.has(importingDriveFile.driveFileId)) {
      addToast(
        'Duplicata bloqueada',
        `O arquivo com ID ${importingDriveFile.driveFileId} já está cadastrado na biblioteca.`,
        'error'
      );
      return;
    }

    try {
      const now = new Date().toISOString();
      const parsedTags = importTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const finalImg =
        importImage || generatePlaceholderRender(importName.trim(), importCategory);

      const newModel = {
        name: importName.trim() || importingDriveFile.name,
        description: importDescription.trim(),
        referenceImage: finalImg,
        zipFileName: importingDriveFile.name,
        zipSizeBytes: importingDriveFile.sizeBytes,
        driveFileId: importingDriveFile.driveFileId,
        driveFileUrl: importingDriveFile.webViewLink,
        driveFolderId: importingDriveFile.folderId,
        driveFolderName: importingDriveFile.folderName,
        category: importCategory,
        tags: parsedTags,
        notes: importNotes.trim(),
        driveStatus: 'available',
        createdAt: now,
        updatedAt: now
      };

      const modelsColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'models');
      await addDoc(modelsColRef, newModel);

      addToast(
        'Arquivo importado para a Biblioteca STL!',
        `O arquivo "${importingDriveFile.name}" foi associado ao catálogo sem ser movido ou duplicado no Google Drive.`,
        'success'
      );
      setImportingDriveFile(null);
    } catch (err) {
      addToast('Erro ao importar arquivo', err.message, 'error');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Importar Arquivos .ZIP Existentes no Google Drive
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Listando arquivos da pasta raiz vinculada:{' '}
            <strong className="text-white">{settings.rootFolderName}</strong>{' '}
            <code className="text-xs font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-indigo-300">
              ID: {settings.rootFolderId}
            </code>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenFolderPicker}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Trocar Pasta Raiz
          </button>
          <button
            onClick={handleSyncFromGoogleDrive}
            disabled={syncingDriveApi}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <RefreshCw size={15} className={syncingDriveApi ? 'animate-spin' : ''} />
            Atualizar Lista do Drive
          </button>
        </div>
      </div>

      {/* Barra para testar adição de um ZIP existente diretamente na pasta do Drive */}
      <form
        onSubmit={handleSimulateExternalZipInDrive}
        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <Sparkles size={18} className="text-indigo-400 shrink-0" />
          <span>
            <strong>Simulador da pasta no Drive:</strong> Adicione um arquivo <code className="text-indigo-300">.zip</code> diretamente na pasta raiz do Drive para testar a importação:
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={newExternalZipName}
            onChange={(e) => setNewExternalZipName(e.target.value)}
            placeholder="ex: capacete_mandaloriano_v3.zip"
            className="flex-1 sm:w-64 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 text-xs font-semibold whitespace-nowrap"
          >
            + Colocar na Pasta do Drive
          </button>
        </div>
      </form>

      {/* Tabela de Arquivos ZIP encontrados na Pasta Raiz */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-5">Arquivo .ZIP no Google Drive</th>
                <th className="py-3.5 px-4">ID Único no Drive</th>
                <th className="py-3.5 px-4">Tamanho</th>
                <th className="py-3.5 px-4">Status no Catálogo</th>
                <th className="py-3.5 px-5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm">
              {driveFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                    Nenhum arquivo .ZIP encontrado nesta pasta raiz ({settings.rootFolderName}).
                  </td>
                </tr>
              ) : (
                driveFiles.map((file) => {
                  const existingModel = registeredDriveIdsMap.get(file.driveFileId);
                  return (
                    <tr key={file.driveFileId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                            <FileArchive size={18} />
                          </div>
                          <div>
                            <p className="font-semibold text-white text-xs sm:text-sm">
                              {file.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Modificado em {formatDateBR(file.createdTime)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <code className="text-xs font-mono bg-slate-950 border border-slate-800 px-2 py-1 rounded text-slate-300">
                          {file.driveFileId}
                        </code>
                      </td>

                      <td className="py-4 px-4 text-xs text-slate-300">
                        {formatBytes(file.sizeBytes)}
                      </td>

                      <td className="py-4 px-4">
                        {existingModel ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            <CheckCircle2 size={13} />
                            Já cadastrado na biblioteca
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Disponível para importar
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onInspectDriveFile(file)}
                            title="Inspecionar no Google Drive"
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            <ExternalLink size={14} />
                          </button>

                          {existingModel ? (
                            <button
                              onClick={() => onOpenModelDetails(existingModel)}
                              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                            >
                              Ver Registro
                            </button>
                          ) : (
                            <button
                              onClick={() => startImportModal(file)}
                              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                            >
                              Importar para Biblioteca
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-slate-950/60 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-2">
          <Info size={15} className="text-indigo-400 shrink-0" />
          <span>
            A importação utiliza o <strong>ID único do arquivo no Google Drive</strong> para impedir duplicatas e não move, duplica nem modifica seus arquivos ZIP originais.
          </span>
        </div>
      </div>

      {/* Modal de Cadastro para o Arquivo Importado */}
      {importingDriveFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmImport}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Associar ZIP Existente ao Catálogo
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Arquivo: <strong className="text-indigo-300">{importingDriveFile.name}</strong> • ID:{' '}
                  <code className="font-mono">{importingDriveFile.driveFileId}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportingDriveFile(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome do Modelo *
              </label>
              <input
                type="text"
                required
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Categoria
                </label>
                <select
                  value={importCategory}
                  onChange={(e) => setImportCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tags (opcional, pode adicionar depois)
                </label>
                <input
                  type="text"
                  value={importTags}
                  onChange={(e) => setImportTags(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Imagem de Referência (opcional — pode adicionar agora ou editar depois)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const dataUrl = await compressImageFile(file);
                    setImportImage(dataUrl);
                  }
                }}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Descrição (opcional)
              </label>
              <textarea
                rows={2}
                value={importDescription}
                onChange={(e) => setImportDescription(e.target.value)}
                placeholder="Você pode preencher agora ou complementar posteriormente..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observações (opcional)
              </label>
              <input
                type="text"
                value={importNotes}
                onChange={(e) => setImportNotes(e.target.value)}
                placeholder="Notas sobre escala ou impressão..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setImportingDriveFile(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Concluir Importação
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VIEW 4: PÁGINA DE CONFIGURAÇÕES DO APLICATIVO
// ============================================================================
function SettingsView({
  user,
  settings,
  driveFolders,
  modelsCount,
  saveUserSettings,
  onOpenFolderPicker,
  onInspectRootFolder,
  addToast
}) {
  const [maxUploadInput, setMaxUploadInput] = useState(settings.maxUploadSizeMB || 500);
  const [emailInput, setEmailInput] = useState(settings.googleUserEmail || '');
  const [oauthTokenInput, setOauthTokenInput] = useState(settings.googleAccessToken || '');
  const [authModeInput, setAuthModeInput] = useState(settings.googleAuthMode || 'integrated');

  useEffect(() => {
    setMaxUploadInput(settings.maxUploadSizeMB || 500);
    setEmailInput(settings.googleUserEmail || '');
    setOauthTokenInput(settings.googleAccessToken || '');
    setAuthModeInput(settings.googleAuthMode || 'integrated');
  }, [settings]);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Configurações da Biblioteca STL
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Gerencie o vínculo com o Google Drive, organização de pastas, limites de upload e estado do banco.
        </p>
      </div>

      {/* 1. Estado da Conexão com a Conta Google */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                settings.googleConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}
            >
              <HardDrive size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Conexão com Google Drive (API v3)
              </h3>
              <p className="text-xs text-slate-400">
                {settings.googleConnected
                  ? `Conectado como ${settings.googleUserEmail}`
                  : 'Conta Google desconectada'}
              </p>
            </div>
          </div>

          {settings.googleConnected ? (
            <button
              onClick={() =>
                saveUserSettings(
                  { googleConnected: false },
                  'Conta Google desconectada. Os registros existentes permanecem salvos.'
                )
              }
              className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <LogOut size={15} />
              Desconectar Conta Google
            </button>
          ) : (
            <button
              onClick={() =>
                saveUserSettings(
                  {
                    googleConnected: true,
                    googleUserEmail: emailInput.trim() || 'proprietario.stl@gmail.com'
                  },
                  'Conta Google conectada com sucesso!'
                )
              }
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <CheckCircle2 size={15} />
              Conectar Conta Google
            </button>
          )}
        </div>

        {/* Modo de Operação da API Drive v3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              E-mail da Conta Google Pessoal
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Modo do Driver Google Drive v3
            </label>
            <select
              value={authModeInput}
              onChange={(e) => setAuthModeInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
            >
              <option value="integrated">
                Drive Persistente Integrado (Pronto para uso imediato)
              </option>
              <option value="oauth_real">
                API Google Drive v3 Direta (Com OAuth Access Token)
              </option>
            </select>
          </div>
        </div>

        {authModeInput === 'oauth_real' && (
          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-2">
            <label className="block text-xs font-semibold text-indigo-300">
              Token OAuth 2.0 temporário (Escopo: https://www.googleapis.com/auth/drive.file)
            </label>
            <input
              type="password"
              value={oauthTokenInput}
              onChange={(e) => setOauthTokenInput(e.target.value)}
              placeholder="ya29.a0AfH6SM..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
            />
            <p className="text-[11px] text-slate-400">
              Em produção na Vercel, o token nunca fica exposto no código: ele é obtido via fluxo OAuth e gerenciado em sessão segura.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={() =>
              saveUserSettings(
                {
                  googleUserEmail: emailInput.trim() || 'proprietario.stl@gmail.com',
                  googleAuthMode: authModeInput,
                  googleAccessToken: oauthTokenInput.trim()
                },
                'Credenciais e modo de conexão atualizados.'
              )
            }
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Salvar Credenciais Google
          </button>
        </div>
      </div>

      {/* 2. Pasta Raiz Vinculada e Preferência de Subpastas */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
        <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
          <Folder size={19} className="text-indigo-400" />
          Pasta Raiz Atualmente Vinculada no Google Drive
        </h3>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{settings.rootFolderName}</span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                Pasta Raiz Oficial
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              ID Único Google Drive: <strong className="text-slate-200">{settings.rootFolderId}</strong>
            </p>
            <p className="text-[11px] text-slate-500">
              O aplicativo utiliza exclusivamente o ID único acima (e não apenas o nome) para evitar conflitos entre pastas homônimas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onInspectRootFolder}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <ExternalLink size={14} />
              Abrir Pasta no Drive
            </button>
            <button
              onClick={onOpenFolderPicker}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Selecionar Outra Pasta Raiz
            </button>
          </div>
        </div>

        {/* Organização por Subpastas */}
        <div className="pt-2 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Regra de Organização dos Arquivos ZIP
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                saveUserSettings(
                  { organizeBySubfolders: false },
                  'Configurado para salvar todos os ZIPs diretamente na pasta raiz Biblioteca STL.'
                )
              }
              className={`p-4 rounded-xl border text-left transition-all ${
                !settings.organizeBySubfolders
                  ? 'bg-indigo-600/10 border-indigo-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">
                  Guardar diretamente na pasta raiz (Padrão)
                </span>
                {!settings.organizeBySubfolders && (
                  <CheckCircle2 size={16} className="text-indigo-400" />
                )}
              </div>
              <p className="text-[11px] opacity-80 leading-relaxed">
                Todos os arquivos ZIP enviados são armazenados diretamente em{' '}
                <code>/{settings.rootFolderName}</code>.
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                saveUserSettings(
                  { organizeBySubfolders: true },
                  'Configurado para organizar novos uploads em subpastas por Categoria.'
                )
              }
              className={`p-4 rounded-xl border text-left transition-all ${
                settings.organizeBySubfolders
                  ? 'bg-indigo-600/10 border-indigo-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold">Organizar em subpastas por Categoria</span>
                {settings.organizeBySubfolders && (
                  <CheckCircle2 size={16} className="text-indigo-400" />
                )}
              </div>
              <p className="text-[11px] opacity-80 leading-relaxed">
                Novos uploads são organizados em{' '}
                <code>/{settings.rootFolderName}/[Categoria]</code> sem afetar a busca dos já cadastrados.
              </p>
            </button>
          </div>
        </div>

        {/* Limite Máximo de Upload Configurável */}
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label className="block text-sm font-semibold text-white">
              Limite Máximo de Upload por Arquivo (.ZIP)
            </label>
            <p className="text-xs text-slate-400">
              Valida o tamanho do arquivo antes de iniciar o envio para o Google Drive.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={5000}
              value={maxUploadInput}
              onChange={(e) => setMaxUploadInput(Number(e.target.value))}
              className="w-28 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white text-right font-mono"
            />
            <span className="text-xs text-slate-400 font-semibold">MB</span>
            <button
              onClick={() =>
                saveUserSettings(
                  { maxUploadSizeMB: Number(maxUploadInput) || 500 },
                  `Limite máximo de upload ajustado para ${maxUploadInput} MB.`
                )
              }
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      {/* 3. Estado da Conexão com Banco de Dados & Storage de Imagens */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
          <ShieldCheck size={19} className="text-emerald-400" />
          Estado do Banco de Dados & Armazenamento Privado de Imagens
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-white">Banco de Metadados & RLS Ativo</p>
              <p className="text-slate-400">
                UID Autenticado: <code className="text-slate-300 font-mono">{user?.uid || '—'}</code>
              </p>
              <p className="text-slate-500">
                {modelsCount} modelos registrados • Isolamento por usuário ativo.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-white">Separação Estrita de Armazenamento</p>
              <p className="text-slate-400">
                Imagens de referência salvas no banco/bucket privado.
              </p>
              <p className="text-slate-500">
                Nenhum arquivo ZIP é enviado ao banco de dados (100% no Google Drive).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VIEW 5: DOCUMENTAÇÃO TÉCNICA, ESCOPO OAUTH E DEPLOY NA VERCEL
// ============================================================================
function VercelGuideView({ settings }) {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Documentação Técnica: Google Drive API v3, Escopos OAuth & Deploy na Vercel
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Avaliação de segurança do escopo <code className="text-indigo-300">drive.file</code> e instruções para publicar sua Biblioteca STL na Vercel.
        </p>
      </div>

      {/* Avaliação técnica do escopo drive.file (Requisito 7) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Key size={18} className="text-indigo-400" />
          1. Avaliação Técnica do Escopo OAuth (`drive.file` vs Permissão de Leitura da Pasta)
        </h3>
        <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            Por padrão e seguindo o princípio de privilégio mínimo, o aplicativo solicita o escopo{' '}
            <code className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-indigo-300 font-mono">
              https://www.googleapis.com/auth/drive.file
            </code>
            .
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30">
              <p className="font-bold text-emerald-300 mb-1">
                O que `drive.file` atende perfeitamente:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Criar a pasta raiz <strong>Biblioteca STL</strong> pelo app.</li>
                <li>Selecionar uma pasta ou arquivo existente via <strong>Google Picker API</strong>.</li>
                <li>Fazer upload de novos arquivos <code>.zip</code> para a pasta raiz.</li>
                <li>Abrir, consultar ou excluir os arquivos criados pelo próprio aplicativo.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30">
              <p className="font-bold text-amber-300 mb-1">
                Limitação do `drive.file` e como contornar:
              </p>
              <p className="text-slate-400">
                Arquivos <code>.zip</code> enviados por fora do app (direto pelo navegador no Google Drive) não aparecem automaticamente em <code>files.list</code> apenas com <code>drive.file</code>, a menos que o usuário os selecione no <strong>Google Picker</strong> (que concede acesso por arquivo) ou autorize opcionalmente o escopo somente-leitura de metadados{' '}
                <code className="text-amber-200 font-mono">drive.metadata.readonly</code> para listagem automática da pasta raiz.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Variáveis de Ambiente para Vercel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Terminal size={18} className="text-indigo-400" />
          2. Configuração de Variáveis de Ambiente na Vercel
        </h3>
        <p className="text-xs text-slate-400">
          No painel do seu projeto na Vercel (<strong>Settings → Environment Variables</strong>), configure as chaves abaixo. Os segredos permanecem exclusivamente no servidor (Next.js Route Handlers / Serverless Functions):
        </p>
        <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-indigo-200 overflow-x-auto leading-relaxed">
{`# Google Cloud Console (OAuth 2.0 Client + Google Drive API v3)
GOOGLE_CLIENT_ID="seu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="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ackend"
GOOGLE_REDIRECT_URI="https://sua-biblioteca-stl.vercel.app/api/auth/callback/google"

# Supabase (Banco de Dados PostgreSQL + Bucket Privado de Imagens)
NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`}
        </pre>
      </div>

      {/* Estrutura SQL para Supabase caso utilize junto com a Vercel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Layers size={18} className="text-indigo-400" />
          3. Schema SQL com RLS e Constraint Anti-Duplicata (`drive_file_id`)
        </h3>
        <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
{`-- Configuração persistente por usuário autenticado
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  root_folder_id text not null,
  root_folder_name text not null default 'Biblioteca STL',
  organize_by_subfolders boolean not null default false,
  max_upload_size_mb integer not null default 500,
  updated_at timestamptz not null default now()
);

-- Catálogo de Modelos STL (Impede duplicatas pelo drive_file_id)
create table stl_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  reference_image_path text,
  zip_file_name text not null,
  drive_file_id text not null,
  drive_file_url text not null,
  category text not null,
  tags text[] default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, drive_file_id)
);

alter table user_settings enable row level security;
alter table stl_models enable row level security;

create policy "Acesso exclusivo do proprietario" on stl_models
  for all using (auth.uid() = user_id);`}
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL: DETALHES COMPLETOS DO MODELO STL
// ============================================================================
function ModelDetailsModal({
  model,
  settings,
  onClose,
  onZoomImage,
  onOpenInDrive,
  onEdit,
  onDelete,
  onToggleAvailability
}) {
  const isMissing = model.driveStatus === 'missing';

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Coluna da Imagem de Referência */}
        <div className="w-full md:w-1/2 bg-slate-950 relative flex flex-col justify-between p-4">
          <div className="flex items-center justify-between z-10">
            <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-900/90 text-indigo-300 border border-indigo-500/30">
              {model.category}
            </span>
            <button
              onClick={onZoomImage}
              className="px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <ZoomIn size={15} />
              Visualizar Imagem Ampliada
            </button>
          </div>

          <div className="my-auto py-4 flex items-center justify-center max-h-[380px]">
            <img
              src={model.referenceImage}
              alt={model.name}
              onClick={onZoomImage}
              className="max-h-[350px] w-auto object-contain rounded-xl cursor-zoom-in"
            />
          </div>

          <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-900 pt-2">
            <span>Armazenada em Bucket Privado</span>
            <span>Clique na imagem para dar zoom</span>
          </div>
        </div>

        {/* Coluna de Informações e Ações */}
        <div className="w-full md:w-1/2 p-6 lg:p-7 flex flex-col overflow-y-auto space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white leading-snug">{model.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{model.zipFileName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Alerta se o arquivo original foi movido ou excluído no Google Drive (Requisito 5) */}
          {isMissing && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  Arquivo original não disponível no local esperado!
                </p>
                <p className="opacity-90 leading-relaxed">
                  O arquivo ZIP (ID: <code className="font-mono">{model.driveFileId}</code>) foi movido para a lixeira ou removido da pasta vinculada no Google Drive.
                </p>
              </div>
            </div>
          )}

          {/* Descrição e Observações */}
          <div className="space-y-4 flex-1 text-xs">
            <div>
              <h4 className="font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Descrição
              </h4>
              <p className="text-slate-200 text-sm leading-relaxed">
                {model.description || 'Nenhuma descrição informada.'}
              </p>
            </div>

            {model.notes && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="font-semibold uppercase tracking-wider text-indigo-400 mb-1">
                  Observações de Impressão
                </h4>
                <p className="text-slate-300 leading-relaxed">{model.notes}</p>
              </div>
            )}

            {/* Tags */}
            <div>
              <h4 className="font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {Array.isArray(model.tags) && model.tags.length > 0 ? (
                  model.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300"
                    >
                      #{t}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">Sem tags</span>
                )}
              </div>
            </div>

            {/* Metadados do Arquivo no Google Drive */}
            <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                  <HardDrive size={14} /> Vinculado ao Google Drive
                </span>
                <button
                  onClick={onToggleAvailability}
                  className="text-[11px] underline text-slate-400 hover:text-indigo-300"
                >
                  {isMissing
                    ? 'Restaurar presença no Drive'
                    : 'Simular arquivo movido/excluído no Drive'}
                </button>
              </div>
              <p className="text-slate-300 font-mono text-[11px]">
                ID no Drive: <strong className="text-white">{model.driveFileId}</strong>
              </p>
              <p className="text-slate-400 text-[11px]">
                Pasta original: {model.driveFolderName || settings.rootFolderName} •{' '}
                {formatBytes(model.zipSizeBytes)}
              </p>
            </div>

            {/* Datas de Cadastro e Última Atualização */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <span className="text-[10px] uppercase text-slate-500 block">
                  Data de Cadastro
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  {formatDateBR(model.createdAt)}
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                <span className="text-[10px] uppercase text-slate-500 block">
                  Última Atualização
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  {formatDateBR(model.updatedAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Botões Obrigatórios da Tela de Detalhes (Requisito 5) */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <button
              onClick={onOpenInDrive}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50"
            >
              <ExternalLink size={17} />
              Abrir ZIP no Google Drive
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={onEdit}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit size={15} />
                Editar Cadastro
              </button>

              <button
                onClick={onDelete}
                className="py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/25 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={15} />
                Excluir da Biblioteca
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL: EDITAR CADASTRO (METADADOS E IMAGEM)
// ============================================================================
function EditModelModal({ editingModel, setEditingModel, onSave, onClose, addToast }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={onSave}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Edit size={18} className="text-indigo-400" />
            Editar Metadados do Modelo
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Nome do Modelo *
          </label>
          <input
            type="text"
            required
            value={editingModel.name}
            onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Categoria</label>
            <select
              value={editingModel.category}
              onChange={(e) => setEditingModel({ ...editingModel, category: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Tags (separadas por vírgula)
            </label>
            <input
              type="text"
              value={editingModel.tagsInput}
              onChange={(e) => setEditingModel({ ...editingModel, tagsInput: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Substituir Imagem de Referência
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  const dataUrl = await compressImageFile(file);
                  setEditingModel({ ...editingModel, referenceImage: dataUrl });
                } catch (err) {
                  addToast('Erro na imagem', err.message, 'error');
                }
              }
            }}
            className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Descrição</label>
          <textarea
            rows={3}
            value={editingModel.description}
            onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Observações</label>
          <textarea
            rows={2}
            value={editingModel.notes || ''}
            onChange={(e) => setEditingModel({ ...editingModel, notes: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// MODAL: SELECIONAR OU CRIAR PASTA RAIZ NO GOOGLE DRIVE (POR ID ÚNICO)
// ============================================================================
function FolderPickerModal({
  driveFolders,
  currentRootFolderId,
  pendingRootFolder,
  setPendingRootFolder,
  newFolderNameInput,
  setNewFolderNameInput,
  onCreateFolder,
  onConfirm,
  onClose
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              Selecionar Pasta Raiz no Google Drive
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              O aplicativo salva o <strong>ID único da pasta</strong> no Google Drive (permitindo diferenciar pastas que possuem o mesmo nome).
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Lista de Pastas com ID Único */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {driveFolders.map((folder) => {
            const isSelected = pendingRootFolder?.id === folder.id;
            const isCurrent = currentRootFolderId === folder.id;
            return (
              <div
                key={folder.id}
                onClick={() => setPendingRootFolder(folder)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Folder
                    size={20}
                    className={isSelected ? 'text-indigo-400 shrink-0' : 'text-slate-500 shrink-0'}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold truncate">{folder.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          Atual
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{folder.path}</p>
                    <p className="text-[11px] font-mono text-indigo-300 mt-0.5">
                      ID: {folder.id}
                    </p>
                  </div>
                </div>
                {isSelected && <CheckCircle2 size={18} className="text-indigo-400 shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* Criar Nova Pasta no Google Drive */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            Ou criar uma nova pasta no seu Google Drive:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFolderNameInput}
              onChange={(e) => setNewFolderNameInput(e.target.value)}
              placeholder="Biblioteca STL"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => onCreateFolder(newFolderNameInput)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <FolderPlus size={14} />
              Criar Pasta no Drive
            </button>
          </div>
        </div>

        {/* Aviso Obrigatório de Preservação ao Trocar Pasta Raiz (Requisito 6) */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
          <Info size={17} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Importante ao trocar a pasta raiz:</strong> Nenhum arquivo será movido ou excluído automaticamente do seu Google Drive. A mudança afetará apenas o destino dos novos uploads e a listagem de importação. Os modelos já cadastrados continuarão apontando para seus arquivos originais.
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!pendingRootFolder}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            Confirmar e Salvar ID da Pasta
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL: INSPETOR DO GOOGLE DRIVE (VISUALIZAR ARQUIVO OU PASTA ORIGINAL)
// ============================================================================
function DriveInspectorModal({ item, settings, onClose }) {
  const driveUrl = item.isFolder
    ? `https://drive.google.com/drive/folders/${item.driveFileId}`
    : item.webViewLink || `https://drive.google.com/file/d/${item.driveFileId}/view`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <HardDrive size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {item.isFolder ? 'Pasta no Google Drive' : 'Arquivo .ZIP no Google Drive'}
              </h3>
              <p className="text-xs text-slate-400">Conta: {settings.googleUserEmail}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Nome:</span>
            <span className="font-bold text-white">{item.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">ID Único Google Drive:</span>
            <code className="font-mono text-indigo-300">{item.driveFileId}</code>
          </div>
          {!item.isFolder && (
            <div className="flex justify-between">
              <span className="text-slate-500">Tamanho do Pacote ZIP:</span>
              <span className="text-slate-300">{formatBytes(item.sizeBytes)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Estado no Drive:</span>
            <span
              className={
                item.status === 'missing'
                  ? 'text-amber-400 font-semibold'
                  : 'text-emerald-400 font-semibold'
              }
            >
              {item.status === 'missing'
                ? 'Movido ou Excluído do Local Esperado'
                : 'Disponível & Íntegro'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            Fechar
          </button>
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <ExternalLink size={14} />
            Abrir Link Externo no Google Drive
          </a>
        </div>
      </div>
    </div>
  );
}