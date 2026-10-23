import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Box, Upload, FolderDown, Settings, Search, Plus, ExternalLink,
  Trash2, Edit3, Eye, CheckCircle2, AlertTriangle, Folder,
  HardDrive, RefreshCw, X, Check, FileArchive,
  LogOut, FolderPlus, Calculator, Menu, Filter, ArrowRight,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Share2,
  Copy, Link2, Images, ListOrdered, CheckSquare, Square, ArrowUpDown,
  FileWarning
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive email profile';

const BASE_CATEGORIES = [
  'Geral',
  'Miniaturas & RPG',
  'Peças Mecânicas',
  'Utilidades Domésticas',
  'Cosplay & Props',
  'Organizadores',
  'Articulados',
  'Suportes & Cases'
];

const PRIORITY_WEIGHT = {
  Alta: 3,
  Normal: 2,
  Baixa: 1
};

function formatBytes(bytes = 0) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getModelImagePaths(model) {
  if (!model) return [];
  if (Array.isArray(model.image_paths) && model.image_paths.length > 0) {
    return model.image_paths.filter(Boolean);
  }
  if (model.image_path) {
    return [model.image_path];
  }
  return [];
}

async function loadJSZip() {
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

export default function App() {
  const [shareIdFromUrl] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('share') || null;
  });

  const [sharedCatalogData, setSharedCatalogData] = useState(null);
  const [sharedLoading, setSharedLoading] = useState(Boolean(shareIdFromUrl));
  const [sharedError, setSharedError] = useState('');
  const [visitorSearch, setVisitorSearch] = useState('');

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(!shareIdFromUrl);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [googleToken, setGoogleToken] = useState(() => localStorage.getItem('stl_google_access_token') || '');
  const [googleUserEmail, setGoogleUserEmail] = useState(() => localStorage.getItem('stl_google_email') || '');
  const [googleConnected, setGoogleConnected] = useState(false);

  const refreshTokenRef = useRef(localStorage.getItem('stl_google_refresh_token') || '');
  const refreshPromiseRef = useRef(null);
  const loadedUserIdRef = useRef(null);
  const awaitingLoadedRef = useRef(false);
  const signedPathCacheRef = useRef({});

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [settings, setSettings] = useState({
    root_folder_id: '',
    root_folder_name: '',
    organize_by_subfolders: true,
    max_upload_size_mb: 150,
    custom_categories: [],
    energy_cost_kwh: 0.95,
    default_failure_rate: 5,
    default_post_processing_pct: 15,
    labor_hourly_rate: 25.00,
    google_refresh_token: ''
  });

  const [existingSubfolders, setExistingSubfolders] = useState([]);
  const [loadingSubfolders, setLoadingSubfolders] = useState(false);

  const [addingCategoryContext, setAddingCategoryContext] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [syncingCategoryFolders, setSyncingCategoryFolders] = useState(false);

  const [materials, setMaterials] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [calcForm, setCalcForm] = useState({
    printerId: '',
    materialId: '',
    weightGrams: 100,
    printHours: 5,
    failureRate: 5,
    washed: true,
    painted: false,
    laborHours: 0.5,
    profitMarginPct: 100
  });

  const [models, setModels] = useState([]);
  const [pathUrls, setPathUrls] = useState({});
  const [loadingData, setLoadingData] = useState(false);

  const [sortBy, setSortBy] = useState('newest');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState([]);
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
  const [bulkTargetCategory, setBulkTargetCategory] = useState('Geral');
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteAlsoDrive, setBulkDeleteAlsoDrive] = useState(false);
  const [scanningGhostFiles, setScanningGhostFiles] = useState(false);
  const [onlyGhostFilter, setOnlyGhostFilter] = useState(false);

  const [sharedLinks, setSharedLinks] = useState([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareForm, setShareForm] = useState({
    title: '',
    category_filter: 'Todas',
    search_filter: '',
    tags_input: ''
  });
  const [creatingShareLink, setCreatingShareLink] = useState(false);

  const [activeTab, setActiveTab] = useState('catalogo');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [toast, setToast] = useState(null);

  const [selectedModel, setSelectedModel] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [editingModel, setEditingModel] = useState(null);
  const [deleteConfirmModel, setDeleteConfirmModel] = useState(null);
  const [deleteAlsoFromDrive, setDeleteAlsoFromDrive] = useState(false);
  const [driveStatusCheck, setDriveStatusCheck] = useState({});

  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [driveFolders, setDriveFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [newFolderName, setNewFolderName] = useState('Biblioteca STL');
  const [pendingFolderSelection, setPendingFolderSelection] = useState(null);

  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    category: 'Geral',
    tags: '',
    notes: '',
    zipFile: null,
    imageFiles: []
  });
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [pendingRecovery, setPendingRecovery] = useState(null);

  const [importPipelineIds, setImportPipelineIds] = useState({
    importacoesId: '',
    aguardandoId: '',
    importadasId: ''
  });
  const [awaitingItems, setAwaitingItems] = useState([]);
  const [loadingDriveZips, setLoadingDriveZips] = useState(false);
  const [importingFile, setImportingFile] = useState(null);
  const [importForm, setImportForm] = useState({
    name: '',
    description: '',
    category: 'Geral',
    tags: '',
    notes: '',
    imageFiles: []
  });

  const [newMaterialModal, setNewMaterialModal] = useState(false);
  const [matForm, setMatForm] = useState({ type: 'Filamento', name: '', color: 'Preto', price_per_unit: 80 });

  const [newPrinterModal, setNewPrinterModal] = useState(false);
  const [printForm, setPrintForm] = useState({ name: '', power_watts: 150, printer_value: 2000, lifespan_hours: 5000 });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim().toLowerCase());
      setCurrentPage(1);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, itemsPerPage, visitorSearch, sortBy, onlyGhostFilter]);

  const allCategories = useMemo(() => {
    const custom = Array.isArray(settings.custom_categories) ? settings.custom_categories : [];
    const fromModels = models.map((m) => m.category).filter(Boolean);
    return Array.from(new Set([...BASE_CATEGORIES, ...custom, ...fromModels]));
  }, [settings.custom_categories, models]);

  const queuedModels = useMemo(() => {
    return models
      .filter((m) => m.in_print_queue)
      .sort((a, b) => {
        const weightDiff = (PRIORITY_WEIGHT[b.queue_priority || 'Normal'] || 2) - (PRIORITY_WEIGHT[a.queue_priority || 'Normal'] || 2);
        if (weightDiff !== 0) return weightDiff;
        return new Date(a.queue_added_at || a.created_at) - new Date(b.queue_added_at || b.created_at);
      });
  }, [models]);

  const ghostCount = useMemo(() => {
    return models.filter((m) => driveStatusCheck[m.id] === 'missing').length;
  }, [models, driveStatusCheck]);

  const ensureSignedUrlsForPaths = useCallback(async (pathsList) => {
    if (!supabase || !pathsList?.length) return;
    const uniqueMissing = Array.from(
      new Set(pathsList.filter((p) => p && !signedPathCacheRef.current[p]))
    );
    if (uniqueMissing.length === 0) return;

    const { data: signedList } = await supabase.storage
      .from('stl-images')
      .createSignedUrls(uniqueMissing, 3600);

    if (signedList && Array.isArray(signedList)) {
      const added = {};
      signedList.forEach((item, idx) => {
        const path = uniqueMissing[idx];
        if (path && item?.signedUrl) {
          signedPathCacheRef.current[path] = item.signedUrl;
          added[path] = item.signedUrl;
        }
      });
      if (Object.keys(added).length > 0) {
        setPathUrls((prev) => ({ ...prev, ...added }));
      }
    }
  }, []);

  const ensureSignedUrlsForModels = useCallback(async (modelsToLoad) => {
    if (!modelsToLoad?.length) return;
    const allPaths = [];
    modelsToLoad.forEach((m) => {
      getModelImagePaths(m).forEach((p) => allPaths.push(p));
    });
    await ensureSignedUrlsForPaths(allPaths);
  }, [ensureSignedUrlsForPaths]);

  const getSignedUrlForPath = (path) => {
    if (!path) return null;
    return pathUrls[path] || signedPathCacheRef.current[path] || null;
  };

  useEffect(() => {
    if (!shareIdFromUrl || !supabase) return;
    const fetchPublicSharedCatalog = async () => {
      setSharedLoading(true);
      setSharedError('');
      try {
        const { data, error } = await supabase.rpc('get_shared_catalog', {
          p_share_id: shareIdFromUrl
        });
        if (error) throw error;
        setSharedCatalogData(data);
      } catch (err) {
        setSharedError(err.message || 'Este link compartilhado não existe ou foi desativado.');
      } finally {
        setSharedLoading(false);
      }
    };
    fetchPublicSharedCatalog();
  }, [shareIdFromUrl]);

  const saveTokenData = (accessToken, expiresInSec = 3500, newRefreshToken = null) => {
    const expiryTime = Date.now() + expiresInSec * 1000;
    setGoogleToken(accessToken);
    setGoogleConnected(true);
    localStorage.setItem('stl_google_access_token', accessToken);
    localStorage.setItem('stl_google_token_expiry', String(expiryTime));

    if (newRefreshToken) {
      refreshTokenRef.current = newRefreshToken;
      localStorage.setItem('stl_google_refresh_token', newRefreshToken);
    }
  };

  const refreshAccessTokenViaBackend = async (rtToUse) => {
    const rt = rtToUse || refreshTokenRef.current || localStorage.getItem('stl_google_refresh_token');
    if (!rt || rt === 'connected' || rt === 'active_session_token') {
      throw new Error('Clique em "Vincular Conta Google" uma única vez para ativar a conexão definitiva.');
    }

    const res = await fetch('/api/google-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new Error(data.error || 'Falha ao renovar sessão do Google Drive.');
    }

    saveTokenData(data.access_token, data.expires_in || 3500);
    return data.access_token;
  };

  const ensureValidGoogleToken = async () => {
    const storedToken = googleToken || localStorage.getItem('stl_google_access_token');
    const expiry = Number(localStorage.getItem('stl_google_token_expiry') || 0);

    if (storedToken && Date.now() < expiry - 120000) {
      return storedToken;
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      try {
        return await refreshAccessTokenViaBackend();
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  };

  const googleDriveFetch = async (url, options = {}) => {
    let token = await ensureValidGoogleToken();
    let res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      localStorage.setItem('stl_google_token_expiry', '0');
      token = await ensureValidGoogleToken();
      res = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`
        }
      });
    }

    return res;
  };

  useEffect(() => {
    if (shareIdFromUrl) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    loadJSZip().catch(() => { });
  }, [shareIdFromUrl]);

  useEffect(() => {
    if (shareIdFromUrl) return;
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        loadedUserIdRef.current = null;
        awaitingLoadedRef.current = false;
        signedPathCacheRef.current = {};
        setModels([]);
        setSession(null);
      } else if (newSession?.user?.id !== loadedUserIdRef.current) {
        setSession(newSession);
      }
    });
    return () => subscription.unsubscribe();
  }, [shareIdFromUrl]);

  useEffect(() => {
    if (shareIdFromUrl) return;
    const currentUserId = session?.user?.id;
    if (currentUserId && loadedUserIdRef.current !== currentUserId) {
      loadedUserIdRef.current = currentUserId;
      loadUserData(false);
    }
  }, [session?.user?.id, shareIdFromUrl]);

  // Função para buscar os dados do usuário autenticado no Google (como o e-mail)
  const fetchUserInfo = async (tokenToUse) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenToUse}` }
      });
      if (res.ok) {
        const info = await res.json();
        if (info?.email) {
          setGoogleUserEmail(info.email);
          localStorage.setItem('stl_google_email', info.email);
        }
      }
    } catch (err) {
      console.warn('Não foi possível obter dados do usuário Google:', err);
    }
  };

  const loadUserData = async (silent = false) => {
    if (!supabase || !session?.user) return;
    if (!silent) setLoadingData(true);
    try {
      const [cfgRes, modelsRes, matRes, printRes, linksRes] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('stl_models').select('*').order('created_at', { ascending: false }),
        supabase.from('stl_materials').select('*').order('name'),
        supabase.from('stl_printers').select('*').order('name'),
        supabase.from('shared_catalog_links').select('*').order('created_at', { ascending: false })
      ]);

      const cfg = cfgRes.data;
      const localCachedCats = JSON.parse(localStorage.getItem(`stl_cats_${session.user.id}`) || '[]');

      if (cfg) {
        const dbCats = Array.isArray(cfg.custom_categories) ? cfg.custom_categories : [];
        const mergedCats = Array.from(new Set([...dbCats, ...localCachedCats]));

        const validSavedRefreshToken =
          cfg.google_refresh_token &&
            cfg.google_refresh_token !== 'connected' &&
            cfg.google_refresh_token !== 'active_session_token'
            ? cfg.google_refresh_token
            : '';

        if (validSavedRefreshToken) {
          refreshTokenRef.current = validSavedRefreshToken;
          localStorage.setItem('stl_google_refresh_token', validSavedRefreshToken);
        }

        setSettings({
          root_folder_id: cfg.root_folder_id || '',
          root_folder_name: cfg.root_folder_name || '',
          organize_by_subfolders: cfg.organize_by_subfolders ?? true,
          max_upload_size_mb: cfg.max_upload_size_mb || 150,
          custom_categories: mergedCats,
          energy_cost_kwh: cfg.energy_cost_kwh ?? 0.95,
          default_failure_rate: cfg.default_failure_rate ?? 5,
          default_post_processing_pct: cfg.default_post_processing_pct ?? 15,
          labor_hourly_rate: cfg.labor_hourly_rate ?? 25.00,
          google_refresh_token: validSavedRefreshToken
        });

        setCalcForm((prev) => ({
          ...prev,
          failureRate: cfg.default_failure_rate ?? 5
        }));

        const cachedToken = localStorage.getItem('stl_google_access_token');
        const expiry = Number(localStorage.getItem('stl_google_token_expiry') || 0);

        if (cachedToken && Date.now() < expiry - 60000) {
          setGoogleToken(cachedToken);
          setGoogleConnected(true);
          fetchUserInfo(cachedToken);
        } else if (validSavedRefreshToken) {
          try {
            const newAccess = await refreshAccessTokenViaBackend(validSavedRefreshToken);
            fetchUserInfo(newAccess);
          } catch (err) {
            console.warn('Não foi possível renovar automaticamente:', err.message);
            setGoogleConnected(false);
          }
        }
      } else if (localCachedCats.length > 0) {
        setSettings((prev) => ({ ...prev, custom_categories: localCachedCats, organize_by_subfolders: true }));
      }

      setModels(modelsRes.data || []);
      setSharedLinks(linksRes.data || []);

      const matList = matRes.data || [];
      setMaterials(matList);
      if (matList.length > 0 && !calcForm.materialId) {
        setCalcForm((prev) => ({ ...prev, materialId: matList[0].id }));
      }

      const printList = printRes.data || [];
      setPrinters(printList);
      if (printList.length > 0 && !calcForm.printerId) {
        setCalcForm((prev) => ({ ...prev, printerId: printList[0].id }));
      }
    } catch (err) {
      showToast(`Erro ao carregar dados: ${err.message}`, 'error');
    } finally {
      if (!silent) setLoadingData(false);
    }
  };

  const handleTogglePrintQueue = async (model, e) => {
    if (e) e.stopPropagation();
    if (!supabase) return;

    const nextState = !model.in_print_queue;
    const nowIso = nextState ? new Date().toISOString() : null;

    setModels((prev) =>
      prev.map((m) =>
        m.id === model.id
          ? { ...m, in_print_queue: nextState, queue_priority: m.queue_priority || 'Normal', queue_added_at: nowIso }
          : m
      )
    );

    if (selectedModel?.id === model.id) {
      setSelectedModel((prev) => ({
        ...prev,
        in_print_queue: nextState,
        queue_priority: prev.queue_priority || 'Normal',
        queue_added_at: nowIso
      }));
    }

    const { error } = await supabase
      .from('stl_models')
      .update({
        in_print_queue: nextState,
        queue_priority: model.queue_priority || 'Normal',
        queue_added_at: nowIso
      })
      .eq('id', model.id);

    if (error) {
      showToast(`Erro ao atualizar fila: ${error.message}`, 'error');
      loadUserData(true);
    } else {
      showToast(nextState ? `"${model.name}" adicionado à Fila de Impressão!` : `"${model.name}" removido da Fila.`);
    }
  };

  const handleChangeQueuePriority = async (model, newPriority) => {
    if (!supabase) return;
    setModels((prev) =>
      prev.map((m) => (m.id === model.id ? { ...m, queue_priority: newPriority } : m))
    );
    await supabase
      .from('stl_models')
      .update({ queue_priority: newPriority })
      .eq('id', model.id);
  };

  const toggleSelectModelForBulk = (modelId, e) => {
    if (e) e.stopPropagation();
    setSelectedModelIds((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  const handleSelectAllCurrentPage = () => {
    const pageIds = paginatedModels.map((m) => m.id);
    const allSelected = pageIds.every((id) => selectedModelIds.includes(id));
    if (allSelected) {
      setSelectedModelIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedModelIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleBulkQueueChange = async (addToQueue = true) => {
    if (!supabase || selectedModelIds.length === 0) return;
    setUploading(true);
    try {
      const nowIso = addToQueue ? new Date().toISOString() : null;
      const { error } = await supabase
        .from('stl_models')
        .update({ in_print_queue: addToQueue, queue_added_at: nowIso })
        .in('id', selectedModelIds);

      if (error) throw error;

      setModels((prev) =>
        prev.map((m) =>
          selectedModelIds.includes(m.id) ? { ...m, in_print_queue: addToQueue, queue_added_at: nowIso } : m
        )
      );
      showToast(
        addToQueue
          ? `${selectedModelIds.length} modelo(s) adicionado(s) à Fila de Impressão!`
          : `${selectedModelIds.length} modelo(s) removido(s) da Fila.`
      );
      setSelectedModelIds([]);
      setBulkMode(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const ensureSpecificSubfolderInDrive = async (folderName, parentId) => {
    if (!parentId || !folderName) return parentId;
    const trimmed = folderName.trim();
    const safeName = trimmed.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = encodeURIComponent(
      `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and '${parentId}' in parents and trashed = false`
    );

    const searchRes = await googleDriveFetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files?.length > 0) {
        return searchData.files[0].id;
      }
    }

    const createRes = await googleDriveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmed,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      })
    });

    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Não foi possível criar a pasta "${trimmed}".`);
    }
    const created = await createRes.json();
    return created.id;
  };

  const ensureImportPipelineFolders = async (rootIdOverride) => {
    const rootId = rootIdOverride || settings.root_folder_id;
    if (!rootId) throw new Error('Pasta raiz não configurada.');

    if (
      importPipelineIds.importacoesId &&
      importPipelineIds.aguardandoId &&
      importPipelineIds.importadasId
    ) {
      return importPipelineIds;
    }

    const importacoesId = await ensureSpecificSubfolderInDrive('importações', rootId);
    const aguardandoId = await ensureSpecificSubfolderInDrive('Aguardando', importacoesId);
    const importadasId = await ensureSpecificSubfolderInDrive('Importadas', importacoesId);

    const ids = { importacoesId, aguardandoId, importadasId };
    setImportPipelineIds(ids);
    return ids;
  };

  // Filtro e Ordenação principal do Catálogo e da Vitrine Compartilhada
  const activeModelsSource = useMemo(() => {
    let baseList = [];

    if (shareIdFromUrl) {
      const list = sharedCatalogData?.models || [];
      const q = visitorSearch.trim().toLowerCase();
      baseList = !q
        ? [...list]
        : list.filter(
          (m) =>
            m.name?.toLowerCase().includes(q) ||
            m.description?.toLowerCase().includes(q) ||
            m.tags?.some((t) => t.toLowerCase().includes(q))
        );
    } else {
      baseList = models.filter((m) => {
        if (onlyGhostFilter && driveStatusCheck[m.id] !== 'missing') return false;
        const matchesCat = selectedCategory === 'Todas' || m.category === selectedCategory;
        if (!matchesCat) return false;
        if (!debouncedQuery) return true;
        return (
          m.name?.toLowerCase().includes(debouncedQuery) ||
          m.description?.toLowerCase().includes(debouncedQuery) ||
          m.category?.toLowerCase().includes(debouncedQuery) ||
          m.tags?.some((t) => t.toLowerCase().includes(debouncedQuery))
        );
      });
    }

    baseList.sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '', 'pt-BR', { sensitivity: 'base' });
      if (sortBy === 'size_desc') return Number(b.drive_file_size || 0) - Number(a.drive_file_size || 0);
      if (sortBy === 'size_asc') return Number(a.drive_file_size || 0) - Number(b.drive_file_size || 0);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    return baseList;
  }, [
    shareIdFromUrl,
    sharedCatalogData,
    visitorSearch,
    models,
    selectedCategory,
    debouncedQuery,
    sortBy,
    onlyGhostFilter,
    driveStatusCheck
  ]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(activeModelsSource.length / itemsPerPage));
  }, [activeModelsSource.length, itemsPerPage]);

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedModels = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return activeModelsSource.slice(startIndex, startIndex + itemsPerPage);
  }, [activeModelsSource, safeCurrentPage, itemsPerPage]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, safeCurrentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [safeCurrentPage, totalPages]);
  
  const fetchRootSubfolders = async (rootIdOverride) => {
    const rootId = rootIdOverride || settings.root_folder_id;
    if (!rootId) return [];
    setLoadingSubfolders(true);
    try {
      const q = encodeURIComponent(
        `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      );
      const res = await googleDriveFetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=100`
      );
      if (!res.ok) return [];
      const data = await res.json();
      const list = data.files || [];
      setExistingSubfolders(list);
      return list;
    } catch {
      return [];
    } finally {
      setLoadingSubfolders(false);
    }
  };

  const ensureCategorySubfolderInDrive = async (categoryName, rootIdOverride, cachedSubfolders = null) => {
    const rootId = rootIdOverride || settings.root_folder_id;
    if (!rootId || !categoryName) return rootId;

    const trimmedCategory = categoryName.trim();
    const currentList = cachedSubfolders || existingSubfolders;
    const foundCached = currentList.find(
      (f) => f.name.trim().toLowerCase() === trimmedCategory.toLowerCase()
    );
    if (foundCached?.id) {
      return foundCached.id;
    }

    const createdId = await ensureSpecificSubfolderInDrive(trimmedCategory, rootId);
    setExistingSubfolders((prev) => {
      if (prev.some((p) => p.id === createdId)) return prev;
      return [...prev, { id: createdId, name: trimmedCategory }];
    });
    return createdId;
  };

  const handleSyncAllCategorySubfolders = async (rootIdOverride, silent = false) => {
    const rootId = rootIdOverride || settings.root_folder_id;
    if (!rootId) {
      if (!silent) showToast('Selecione uma pasta raiz primeiro.', 'error');
      return;
    }

    setSyncingCategoryFolders(true);
    try {
      const currentSubs = await fetchRootSubfolders(rootId);
      let createdCount = 0;

      for (const cat of allCategories) {
        const exists = currentSubs.some(
          (f) => f.name.trim().toLowerCase() === cat.trim().toLowerCase()
        );
        if (!exists) {
          await ensureCategorySubfolderInDrive(cat, rootId, currentSubs);
          createdCount++;
        }
      }

      await ensureImportPipelineFolders(rootId);
      await fetchRootSubfolders(rootId);

      if (!silent || createdCount > 0) {
        showToast(
          createdCount > 0
            ? `${createdCount} subpasta(s) e estrutura de importações criadas com sucesso!`
            : `Todas as subpastas de categorias e a pasta importações/Aguardando estão prontas!`
        );
      }
    } catch (err) {
      if (!silent) showToast(`Erro ao montar subpastas: ${err.message}`, 'error');
    } finally {
      setSyncingCategoryFolders(false);
    }
  };

  const getTargetUploadFolderId = async (categoryName) => {
    if (!settings.organize_by_subfolders || !categoryName) {
      return settings.root_folder_id;
    }
    const subId = await ensureCategorySubfolderInDrive(categoryName, settings.root_folder_id);
    return subId || settings.root_folder_id;
  };

  const handleAddPermanentCategory = async (targetContext) => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    if (allCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Essa categoria já existe na lista!', 'error');
      return;
    }

    setSavingCategory(true);
    const updatedCustom = Array.from(new Set([...(settings.custom_categories || []), trimmed]));

    if (session?.user) {
      localStorage.setItem(`stl_cats_${session.user.id}`, JSON.stringify(updatedCustom));
    }

    setSettings((prev) => ({ ...prev, custom_categories: updatedCustom }));

    if (supabase && session?.user) {
      await supabase
        .from('user_settings')
        .upsert({
          user_id: session.user.id,
          root_folder_id: settings.root_folder_id,
          root_folder_name: settings.root_folder_name,
          organize_by_subfolders: settings.organize_by_subfolders,
          max_upload_size_mb: settings.max_upload_size_mb,
          custom_categories: updatedCustom,
          updated_at: new Date().toISOString()
        });
    }

    if (settings.organize_by_subfolders && settings.root_folder_id && googleConnected) {
      try {
        await ensureCategorySubfolderInDrive(trimmed);
      } catch (err) {
        console.warn('Erro ao criar subpasta automática:', err);
      }
    }

    if (targetContext === 'upload') {
      setUploadForm((prev) => ({ ...prev, category: trimmed }));
    } else if (targetContext === 'import') {
      setImportForm((prev) => ({ ...prev, category: trimmed }));
    } else if (targetContext === 'edit' && editingModel) {
      setEditingModel((prev) => ({ ...prev, category: trimmed }));
    } else if (targetContext === 'bulk') {
      setBulkTargetCategory(trimmed);
    }

    setNewCategoryName('');
    setAddingCategoryContext(null);
    setSavingCategory(false);
    showToast(`Categoria "${trimmed}" salva!`);
  };

  const handleConfirmBulkCategoryChange = async (e) => {
    e.preventDefault();
    if (!supabase || selectedModelIds.length === 0) return;
    setUploading(true);
    try {
      let targetFolderId = settings.root_folder_id;
      if (settings.organize_by_subfolders && googleConnected && settings.root_folder_id) {
        setUploadStep(`Garantindo subpasta "${bulkTargetCategory}" no Google Drive...`);
        targetFolderId = await getTargetUploadFolderId(bulkTargetCategory);

        const selectedModelsList = models.filter((m) => selectedModelIds.includes(m.id));
        for (let i = 0; i < selectedModelsList.length; i++) {
          const m = selectedModelsList[i];
          if (m.drive_file_id && m.drive_folder_id && m.drive_folder_id !== targetFolderId) {
            setUploadStep(`Movendo arquivo ${i + 1} de ${selectedModelsList.length} no Google Drive...`);
            await googleDriveFetch(
              `https://www.googleapis.com/drive/v3/files/${m.drive_file_id}?addParents=${targetFolderId}&removeParents=${m.drive_folder_id}&fields=id,parents`,
              { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
            ).catch(() => { });
          }
        }
      }

      const { error } = await supabase
        .from('stl_models')
        .update({
          category: bulkTargetCategory,
          drive_folder_id: targetFolderId || settings.root_folder_id,
          updated_at: new Date().toISOString()
        })
        .in('id', selectedModelIds);

      if (error) throw error;

      setModels((prev) =>
        prev.map((m) =>
          selectedModelIds.includes(m.id)
            ? { ...m, category: bulkTargetCategory, drive_folder_id: targetFolderId || m.drive_folder_id }
            : m
        )
      );

      showToast(`${selectedModelIds.length} modelo(s) movido(s) para a categoria "${bulkTargetCategory}"!`);
      setBulkCategoryModalOpen(false);
      setSelectedModelIds([]);
      setBulkMode(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (!supabase || selectedModelIds.length === 0) return;
    setUploading(true);
    try {
      const selectedModelsList = models.filter((m) => selectedModelIds.includes(m.id));

      if (bulkDeleteAlsoDrive && googleConnected) {
        for (let i = 0; i < selectedModelsList.length; i++) {
          const m = selectedModelsList[i];
          setUploadStep(`Excluindo do Google Drive (${i + 1}/${selectedModelsList.length}): ${m.name}...`);
          let delRes = await googleDriveFetch(
            `https://www.googleapis.com/drive/v3/files/${m.drive_file_id}`,
            { method: 'DELETE' }
          );
          if (!delRes.ok && delRes.status !== 404) {
            await googleDriveFetch(
              `https://www.googleapis.com/drive/v3/files/${m.drive_file_id}`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trashed: true })
              }
            ).catch(() => { });
          }
        }
      }

      const allStoragePaths = [];
      selectedModelsList.forEach((m) => {
        getModelImagePaths(m).forEach((p) => allStoragePaths.push(p));
      });

      if (allStoragePaths.length > 0) {
        await supabase.storage.from('stl-images').remove(allStoragePaths);
        allStoragePaths.forEach((p) => delete signedPathCacheRef.current[p]);
      }

      const { error } = await supabase
        .from('stl_models')
        .delete()
        .in('id', selectedModelIds);

      if (error) throw error;

      setModels((prev) => prev.filter((m) => !selectedModelIds.includes(m.id)));
      showToast(`${selectedModelsList.length} modelo(s) excluído(s) com sucesso!`);
      setBulkDeleteModalOpen(false);
      setBulkDeleteAlsoDrive(false);
      setSelectedModelIds([]);
      setBulkMode(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  const handleScanGhostFiles = async () => {
    if (!googleConnected) {
      showToast('Vincule sua conta Google primeiro para verificar os arquivos no Drive.', 'error');
      return;
    }
    if (models.length === 0) return;

    setScanningGhostFiles(true);
    let missingCount = 0;
    const statusMap = { ...driveStatusCheck };

    try {
      const chunkSize = 8;
      for (let i = 0; i < models.length; i += chunkSize) {
        const chunk = models.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (m) => {
            if (!m.drive_file_id) {
              statusMap[m.id] = 'missing';
              missingCount++;
              return;
            }
            try {
              const res = await googleDriveFetch(
                `https://www.googleapis.com/drive/v3/files/${m.drive_file_id}?fields=id,trashed`
              );
              if (!res.ok) {
                statusMap[m.id] = 'missing';
                missingCount++;
              } else {
                const data = await res.json();
                if (data.trashed) {
                  statusMap[m.id] = 'missing';
                  missingCount++;
                } else {
                  statusMap[m.id] = 'available';
                }
              }
            } catch {
              statusMap[m.id] = 'missing';
              missingCount++;
            }
          })
        );
      }

      setDriveStatusCheck(statusMap);
      if (missingCount === 0) {
        setOnlyGhostFilter(false);
        showToast(`Tudo certo! Todos os ${models.length} arquivos ZIP estão íntegros no seu Google Drive.`);
      } else {
        showToast(
          `Atenção: ${missingCount} arquivo(s) não foram encontrados ou estão na lixeira do Google Drive!`,
          'error'
        );
      }
    } catch (err) {
      showToast(`Erro ao verificar Drive: ${err.message}`, 'error');
    } finally {
      setScanningGhostFiles(false);
    }
  };

  const openShareModalWithCurrentFilters = () => {
    const defaultTitle =
      selectedCategory !== 'Todas'
        ? `Vitrine: ${selectedCategory}${searchInput ? ` (${searchInput})` : ''}`
        : searchInput
          ? `Vitrine: "${searchInput}"`
          : 'Catálogo Completo Biblioteca STL';

    setShareForm({
      title: defaultTitle,
      category_filter: selectedCategory,
      search_filter: searchInput.trim(),
      tags_input: ''
    });
    setShareModalOpen(true);
  };

  const handleCreateSharedLink = async (e) => {
    e.preventDefault();
    if (!supabase || !session?.user) return;
    setCreatingShareLink(true);
    try {
      const tagsArray = shareForm.tags_input
        ? shareForm.tags_input.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const { data: created, error } = await supabase
        .from('shared_catalog_links')
        .insert({
          user_id: session.user.id,
          title: shareForm.title.trim() || 'Catálogo Compartilhado',
          category_filter: shareForm.category_filter || 'Todas',
          search_filter: shareForm.search_filter.trim(),
          tags_filter: tagsArray,
          active: true
        })
        .select('*')
        .single();

      if (error) throw error;

      setSharedLinks((prev) => [created, ...prev]);
      const shareUrl = `${window.location.origin}/?share=${created.id}`;
      await navigator.clipboard.writeText(shareUrl).catch(() => { });
      showToast('Link da vitrine criado e copiado para a área de transferência!');
    } catch (err) {
      showToast(`Erro ao criar link: ${err.message}`, 'error');
    } finally {
      setCreatingShareLink(false);
    }
  };

  const handleDeleteSharedLink = async (id) => {
    if (!supabase) return;
    const { error } = await supabase.from('shared_catalog_links').delete().eq('id', id);
    if (!error) {
      setSharedLinks((prev) => prev.filter((l) => l.id !== id));
      showToast('Link revogado e excluído!');
    }
  };

  const copyShareUrlToClipboard = async (id) => {
    const url = `${window.location.origin}/?share=${id}`;
    await navigator.clipboard.writeText(url);
    showToast('Link copiado!');
  };

  const verifyDriveFileAvailability = async (model) => {
    if (!googleConnected || shareIdFromUrl) return;
    setDriveStatusCheck((prev) => ({ ...prev, [model.id]: 'checking' }));
    try {
      const res = await googleDriveFetch(
        `https://www.googleapis.com/drive/v3/files/${model.drive_file_id}?fields=id,name,trashed`
      );
      if (!res.ok) {
        setDriveStatusCheck((prev) => ({ ...prev, [model.id]: 'missing' }));
        return;
      }
      const data = await res.json();
      setDriveStatusCheck((prev) => ({
        ...prev,
        [model.id]: data.trashed ? 'missing' : 'available'
      }));
    } catch {
      setDriveStatusCheck((prev) => ({ ...prev, [model.id]: 'missing' }));
    }
  };

  const handleOpenDetails = (model) => {
    setSelectedModel(model);
    setActiveImageIndex(0);
    const paths = getModelImagePaths(model);
    if (paths.length > 0) {
      ensureSignedUrlsForPaths(paths);
    }
    if (googleConnected && !shareIdFromUrl) {
      verifyDriveFileAvailability(model);
    }
  };

  const handleRetryMetadataSave = async () => {
    if (!pendingRecovery) return;
    setUploading(true);
    try {
      await completeDatabaseRegistration(
        pendingRecovery.driveData,
        pendingRecovery.folderId,
        pendingRecovery.formSnapshot
      );
      setPendingRecovery(null);
      setUploadForm({
        name: '', description: '', category: 'Geral', tags: '', notes: '', zipFile: null, imageFiles: []
      });
      showToast('Cadastro recuperado e concluído com sucesso!');
      setActiveTab('catalogo');
      loadUserData(true);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  const uploadMultipleImagesToSupabase = async (filesArray) => {
    if (!filesArray || filesArray.length === 0) return [];
    const uploadedPaths = [];

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      setUploadStep(`Enviando imagem ${i + 1} de ${filesArray.length} para o Supabase...`);
      const ext = file.name.split('.').pop();
      const fileName = `${session.user.id}/${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const { error: storageErr } = await supabase.storage
        .from('stl-images')
        .upload(fileName, file, { upsert: false });

      if (storageErr) throw new Error(`Falha ao salvar imagem "${file.name}": ${storageErr.message}`);
      uploadedPaths.push(fileName);
    }

    return uploadedPaths;
  };

  const handleUploadNewModel = async (e) => {
    e.preventDefault();
    if (!settings.root_folder_id) {
      showToast('Configure a pasta raiz Biblioteca STL antes de enviar arquivos.', 'error');
      setFolderPickerOpen(true);
      return;
    }
    if (!uploadForm.zipFile) {
      showToast('Selecione um arquivo .ZIP para enviar.', 'error');
      return;
    }

    const maxBytes = (settings.max_upload_size_mb || 150) * 1024 * 1024;
    if (uploadForm.zipFile.size > maxBytes) {
      showToast(`O arquivo excede o limite configurado de ${settings.max_upload_size_mb} MB.`, 'error');
      return;
    }

    setUploading(true);
    let uploadedDriveData = null;
    let targetFolderId = settings.root_folder_id;

    try {
      setUploadStep(
        settings.organize_by_subfolders
          ? `Garantindo subpasta "${uploadForm.category}" no Google Drive...`
          : 'Verificando pasta raiz no Google Drive...'
      );
      targetFolderId = await getTargetUploadFolderId(uploadForm.category);

      setUploadStep(`Enviando arquivo ZIP para o Google Drive...`);
      const metadata = {
        name: uploadForm.zipFile.name,
        parents: [targetFolderId],
        mimeType: 'application/zip'
      };

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', uploadForm.zipFile);

      const driveRes = await googleDriveFetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink',
        {
          method: 'POST',
          body: formData
        }
      );

      if (!driveRes.ok) {
        const errBody = await driveRes.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || `Erro ${driveRes.status} ao enviar arquivo para o Google Drive.`);
      }

      uploadedDriveData = await driveRes.json();
      await completeDatabaseRegistration(uploadedDriveData, targetFolderId, uploadForm);

      setUploadForm({
        name: '', description: '', category: 'Geral', tags: '', notes: '', zipFile: null, imageFiles: []
      });
      setPendingRecovery(null);
      showToast(`Modelo enviado para o Drive e catalogado com sucesso!`);
      setActiveTab('catalogo');
      loadUserData(true);
    } catch (err) {
      if (uploadedDriveData?.id) {
        setPendingRecovery({
          driveData: uploadedDriveData,
          folderId: targetFolderId,
          formSnapshot: { ...uploadForm }
        });
        showToast('O ZIP foi enviado ao Drive, mas houve falha ao salvar no banco. Use o botão de recuperação abaixo!', 'error');
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  const completeDatabaseRegistration = async (driveData, folderId, formValues) => {
    const filesToUpload = Array.isArray(formValues.imageFiles) ? formValues.imageFiles : [];
    const uploadedPaths = await uploadMultipleImagesToSupabase(filesToUpload);
    const primaryImagePath = uploadedPaths[0] || null;

    setUploadStep('Salvando metadados e galeria no catálogo...');
    const tagsArray = formValues.tags
      ? formValues.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const { error: dbErr } = await supabase.from('stl_models').insert({
      user_id: session.user.id,
      name: formValues.name.trim() || driveData.name.replace(/\.zip$/i, ''),
      description: formValues.description.trim(),
      category: formValues.category || 'Geral',
      tags: tagsArray,
      notes: formValues.notes.trim(),
      image_path: primaryImagePath,
      image_paths: uploadedPaths,
      drive_file_id: driveData.id,
      drive_file_name: driveData.name,
      drive_file_url: driveData.webViewLink || `https://drive.google.com/file/d/${driveData.id}/view`,
      drive_file_size: Number(driveData.size || formValues.zipFile?.size || 0),
      drive_folder_id: folderId
    });

    if (dbErr) throw new Error(`Falha ao salvar metadados: ${dbErr.message}`);
  };

  const fetchAwaitingImports = async () => {
    if (!settings.root_folder_id) return;
    setLoadingDriveZips(true);
    try {
      const pipeline = await ensureImportPipelineFolders(settings.root_folder_id);
      const q = encodeURIComponent(`'${pipeline.aguardandoId}' in parents and trashed = false`);
      const res = await googleDriveFetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,createdTime,webViewLink,parents)&pageSize=100`
      );
      if (!res.ok) throw new Error('Erro ao listar itens da pasta importações/Aguardando.');
      const data = await res.json();
      setAwaitingItems(data.files || []);
      awaitingLoadedRef.current = true;
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingDriveZips(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'importar' && googleConnected && settings.root_folder_id && !awaitingLoadedRef.current) {
      fetchAwaitingImports();
    }
  }, [activeTab, googleConnected, settings.root_folder_id]);

  const addDriveFolderToZipRecursively = async (folderId, zipFolderInstance, statusPrefix = '') => {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const res = await googleDriveFetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size)&pageSize=200`
    );
    if (!res.ok) throw new Error('Falha ao ler conteúdo da pasta para compactação.');
    const data = await res.json();
    const children = data.files || [];

    let count = 0;
    for (const child of children) {
      if (child.mimeType === 'application/vnd.google-apps.folder') {
        const subZip = zipFolderInstance.folder(child.name);
        count += await addDriveFolderToZipRecursively(child.id, subZip, `${statusPrefix}${child.name}/`);
      } else if (!child.mimeType.startsWith('application/vnd.google-apps.')) {
        setUploadStep(`Baixando arquivo para compactar: ${statusPrefix}${child.name}...`);
        const fileRes = await googleDriveFetch(
          `https://www.googleapis.com/drive/v3/files/${child.id}?alt=media`
        );
        if (!fileRes.ok) {
          throw new Error(`Não foi possível ler o arquivo "${child.name}". Verifique a autorização do Google Drive.`);
        }
        const blob = await fileRes.blob();
        zipFolderInstance.file(child.name, blob);
        count++;
      }
    }
    return count;
  };

  const handleConfirmImport = async (e) => {
    e.preventDefault();
    if (!importingFile) return;

    setUploading(true);
    try {
      const pipeline = await ensureImportPipelineFolders(settings.root_folder_id);
      const targetCategoryFolderId = await getTargetUploadFolderId(importForm.category);

      let zipBlobToUpload = null;
      const baseCleanName = (importForm.name.trim() || importingFile.name).replace(/\.zip$/i, '');
      const finalZipFileName = `${baseCleanName}.zip`;

      const isFolder = importingFile.mimeType === 'application/vnd.google-apps.folder';
      const isAlreadyZip =
        !isFolder &&
        (importingFile.mimeType === 'application/zip' ||
          importingFile.mimeType === 'application/x-zip-compressed' ||
          importingFile.name.toLowerCase().endsWith('.zip'));

      if (isFolder) {
        setUploadStep(`Carregando compactador e lendo a pasta "${importingFile.name}"...`);
        const JSZip = await loadJSZip();
        const zip = new JSZip();

        const filesAdded = await addDriveFolderToZipRecursively(importingFile.id, zip);
        if (filesAdded === 0) {
          throw new Error(`A pasta "${importingFile.name}" está vazia! Coloque os arquivos STL dentro dela antes de importar.`);
        }

        setUploadStep(`Compactando ${filesAdded} arquivo(s) em "${finalZipFileName}"...`);
        zipBlobToUpload = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
      } else if (isAlreadyZip) {
        setUploadStep(`Lendo arquivo ZIP "${importingFile.name}"...`);
        const fileRes = await googleDriveFetch(
          `https://www.googleapis.com/drive/v3/files/${importingFile.id}?alt=media`
        );
        if (!fileRes.ok) throw new Error('Não foi possível ler o arquivo ZIP de Aguardando.');
        zipBlobToUpload = await fileRes.blob();
      } else {
        setUploadStep(`Compactando arquivo "${importingFile.name}" em .ZIP...`);
        const JSZip = await loadJSZip();
        const zip = new JSZip();
        const fileRes = await googleDriveFetch(
          `https://www.googleapis.com/drive/v3/files/${importingFile.id}?alt=media`
        );
        if (!fileRes.ok) throw new Error(`Não foi possível ler o arquivo "${importingFile.name}".`);
        const fileBlob = await fileRes.blob();
        zip.file(importingFile.name, fileBlob);
        zipBlobToUpload = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      }

      setUploadStep(`Salvando "${finalZipFileName}" na pasta da categoria "${importForm.category}"...`);
      const metadata = {
        name: finalZipFileName,
        parents: [targetCategoryFolderId],
        mimeType: 'application/zip'
      };
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', zipBlobToUpload, finalZipFileName);

      const uploadRes = await googleDriveFetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink',
        { method: 'POST', body: formData }
      );
      if (!uploadRes.ok) {
        throw new Error('Falha ao salvar o arquivo ZIP compactado na pasta da categoria.');
      }
      const uploadedZipData = await uploadRes.json();

      await completeDatabaseRegistration(uploadedZipData, targetCategoryFolderId, {
        ...importForm,
        zipFile: { size: zipBlobToUpload.size }
      });

      setUploadStep(`Movendo "${importingFile.name}" para importações/Importadas...`);
      const currentParent = importingFile.parents?.[0] || pipeline.aguardandoId;
      const moveRes = await googleDriveFetch(
        `https://www.googleapis.com/drive/v3/files/${importingFile.id}?addParents=${pipeline.importadasId}&removeParents=${currentParent}&fields=id,parents`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }
      );

      if (!moveRes.ok) {
        showToast(
          `ZIP salvo na categoria "${importForm.category}", mas o Google Drive não permitiu mover a pasta original automaticamente.`,
          'error'
        );
      } else {
        showToast(
          `Sucesso! Compactado em "${importForm.category}" e pasta original movida para importações/Importadas!`
        );
      }

      setAwaitingItems((prev) => prev.filter((i) => i.id !== importingFile.id));
      setImportingFile(null);
      loadUserData(true);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingModel) return;
    setUploading(true);
    try {
      const originalPaths = getModelImagePaths(editingModel.originalModel || editingModel);
      const keptPaths = Array.isArray(editingModel.keptImagePaths)
        ? editingModel.keptImagePaths
        : originalPaths;

      const removedPaths = originalPaths.filter((p) => !keptPaths.includes(p));
      if (removedPaths.length > 0) {
        await supabase.storage.from('stl-images').remove(removedPaths);
        removedPaths.forEach((p) => delete signedPathCacheRef.current[p]);
      }

      const newFiles = Array.isArray(editingModel.newImageFiles) ? editingModel.newImageFiles : [];
      const newlyUploadedPaths = await uploadMultipleImagesToSupabase(newFiles);

      const finalImagePaths = [...keptPaths, ...newlyUploadedPaths];
      const primaryImagePath = finalImagePaths[0] || null;

      const tagsArray = typeof editingModel.tagsInput === 'string'
        ? editingModel.tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
        : (editingModel.tags || []);

      const { error } = await supabase
        .from('stl_models')
        .update({
          name: editingModel.name.trim(),
          description: editingModel.description.trim(),
          category: editingModel.category,
          tags: tagsArray,
          notes: (editingModel.notes || '').trim(),
          image_path: primaryImagePath,
          image_paths: finalImagePaths,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingModel.id);

      if (error) throw error;

      if (newlyUploadedPaths.length > 0) {
        await ensureSignedUrlsForPaths(newlyUploadedPaths);
      }

      showToast('Cadastro e galeria de imagens atualizados com sucesso!');
      setEditingModel(null);
      setSelectedModel(null);
      loadUserData(true);
    } catch (err) {
      showToast(`Erro ao atualizar: ${err.message}`, 'error');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  const handleDeleteModel = async () => {
    if (!deleteConfirmModel) return;
    setUploading(true);
    try {
      if (deleteAlsoFromDrive) {
        let driveDel = await googleDriveFetch(
          `https://www.googleapis.com/drive/v3/files/${deleteConfirmModel.drive_file_id}`,
          { method: 'DELETE' }
        );

        if (!driveDel.ok && driveDel.status !== 404) {
          const trashRes = await googleDriveFetch(
            `https://www.googleapis.com/drive/v3/files/${deleteConfirmModel.drive_file_id}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trashed: true })
            }
          );

          if (!trashRes.ok) {
            const errData = await trashRes.json().catch(() => ({}));
            throw new Error(errData?.error?.message || 'Não foi possível excluir o arquivo no Drive.');
          }
        }
      }

      const allPathsToDelete = getModelImagePaths(deleteConfirmModel);
      if (allPathsToDelete.length > 0) {
        await supabase.storage.from('stl-images').remove(allPathsToDelete);
        allPathsToDelete.forEach((p) => delete signedPathCacheRef.current[p]);
      }

      const { error } = await supabase
        .from('stl_models')
        .delete()
        .eq('id', deleteConfirmModel.id);

      if (error) throw error;

      setModels((prev) => prev.filter((m) => m.id !== deleteConfirmModel.id));

      showToast(
        deleteAlsoFromDrive
          ? 'Excluído do catálogo e do Google Drive com sucesso!'
          : 'Removido do catálogo (arquivo ZIP preservado no Drive).'
      );
      setDeleteConfirmModel(null);
      setDeleteAlsoFromDrive(false);
      setSelectedModel(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    if (!supabase || !session?.user) return;
    try {
      const { error } = await supabase.from('stl_materials').insert({
        user_id: session.user.id,
        type: matForm.type,
        name: matForm.name.trim(),
        color: matForm.color.trim(),
        price_per_unit: Number(matForm.price_per_unit)
      });
      if (error) throw error;
      showToast('Material cadastrado!');
      setNewMaterialModal(false);
      setMatForm({ type: 'Filamento', name: '', color: 'Preto', price_per_unit: 80 });
      loadUserData(true);
    } catch (err) {
      showToast(`Erro: ${err.message}`, 'error');
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (!supabase) return;
    await supabase.from('stl_materials').delete().eq('id', id);
    showToast('Material excluído.');
    loadUserData(true);
  };

  const handleSavePrinter = async (e) => {
    e.preventDefault();
    if (!supabase || !session?.user) return;
    try {
      const { error } = await supabase.from('stl_printers').insert({
        user_id: session.user.id,
        name: printForm.name.trim(),
        power_watts: Number(printForm.power_watts),
        printer_value: Number(printForm.printer_value),
        lifespan_hours: Number(printForm.lifespan_hours)
      });
      if (error) throw error;
      showToast('Impressora cadastrada!');
      setNewPrinterModal(false);
      setPrintForm({ name: '', power_watts: 150, printer_value: 2000, lifespan_hours: 5000 });
      loadUserData(true);
    } catch (err) {
      showToast(`Erro: ${err.message}`, 'error');
    }
  };

  const handleDeletePrinter = async (id) => {
    if (!supabase) return;
    await supabase.from('stl_printers').delete().eq('id', id);
    showToast('Impressora excluída.');
    loadUserData(true);
  };

  const calculationResults = useMemo(() => {
    const selectedPrinter = printers.find((p) => p.id === calcForm.printerId);
    const selectedMaterial = materials.find((m) => m.id === calcForm.materialId);

    const weightG = Number(calcForm.weightGrams) || 0;
    const hours = Number(calcForm.printHours) || 0;
    const failurePct = Number(calcForm.failureRate) || 0;
    const laborH = Number(calcForm.laborHours) || 0;
    const profitPct = Number(calcForm.profitMarginPct) || 0;

    const pricePerKgOrL = selectedMaterial ? Number(selectedMaterial.price_per_unit) || 0 : 80;
    const effectiveWeightG = weightG * (1 + failurePct / 100);
    const materialCost = (effectiveWeightG / 1000) * pricePerKgOrL;

    const powerW = selectedPrinter ? Number(selectedPrinter.power_watts) || 150 : 150;
    const energyKWh = (powerW * hours) / 1000;
    const energyCost = energyKWh * Number(settings.energy_cost_kwh || 0.95);

    const printerVal = selectedPrinter ? Number(selectedPrinter.printer_value) || 0 : 2000;
    const lifespanH = selectedPrinter ? Number(selectedPrinter.lifespan_hours) || 5000 : 5000;
    const depreciationPerHour = lifespanH > 0 ? printerVal / lifespanH : 0;
    const depreciationCost = depreciationPerHour * hours;

    const subtotalDirect = materialCost + energyCost + depreciationCost;
    const postProcBasePct = Number(settings.default_post_processing_pct || 15);
    let postProcCost = subtotalDirect * (postProcBasePct / 100);
    if (calcForm.washed) postProcCost += 3.00;
    if (calcForm.painted) postProcCost += 12.00;

    const laborRate = Number(settings.labor_hourly_rate || 25.00);
    const laborCost = laborH * laborRate;

    const totalCost = subtotalDirect + postProcCost + laborCost;
    const suggestedPrice = totalCost * (1 + profitPct / 100);
    const netProfit = suggestedPrice - totalCost;

    return {
      materialCost,
      energyCost,
      depreciationCost,
      postProcCost,
      laborCost,
      totalCost,
      suggestedPrice,
      netProfit,
      effectiveWeightG
    };
  }, [calcForm, printers, materials, settings]);

  const handleConnectGoogle = () => {
    if (!GOOGLE_CLIENT_ID) {
      showToast('VITE_GOOGLE_CLIENT_ID não configurado.', 'error');
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      showToast('Aguarde o carregamento do serviço Google...', 'error');
      return;
    }

    const codeClient = window.google.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      ux_mode: 'popup',
      access_type: 'offline',
      prompt: 'consent',
      callback: async (response) => {
        if (response.error) {
          showToast(`Erro na autorização Google: ${response.error}`, 'error');
          return;
        }

        if (!response.code) return;

        try {
          const tokenRes = await fetch('/api/google-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: response.code })
          });

          const tokenData = await tokenRes.json().catch(() => ({}));
          if (!tokenRes.ok || !tokenData.access_token) {
            throw new Error(
              tokenData.error ||
              'Falha ao obter token definitivo. Verifique se GOOGLE_CLIENT_SECRET está configurado na Vercel.'
            );
          }

          const finalRefreshToken =
            tokenData.refresh_token ||
            refreshTokenRef.current ||
            settings.google_refresh_token;

          saveTokenData(tokenData.access_token, tokenData.expires_in || 3500, finalRefreshToken);

          if (supabase && session?.user && finalRefreshToken) {
            await supabase
              .from('user_settings')
              .upsert({
                user_id: session.user.id,
                google_refresh_token: finalRefreshToken,
                root_folder_id: settings.root_folder_id,
                root_folder_name: settings.root_folder_name,
                organize_by_subfolders: settings.organize_by_subfolders,
                max_upload_size_mb: settings.max_upload_size_mb,
                custom_categories: settings.custom_categories,
                updated_at: new Date().toISOString()
              });
            setSettings((prev) => ({ ...prev, google_refresh_token: finalRefreshToken }));
          }

          await fetchUserInfo(tokenData.access_token);
          showToast('Conta Google vinculada definitivamente!');
          if (!settings.root_folder_id) {
            openFolderPicker();
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });

    codeClient.requestCode();
  };

  const handleSupabaseAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!supabase) return;
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        showToast('Conta criada! Verifique seu e-mail ou faça login.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast('Bem-vindo à Biblioteca STL!');
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const renderCategorySelector = (currentValue, onSelectChange, contextKey) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-medium text-[#a39e93]">Categoria (Subpasta no Drive)</label>
        <button
          type="button"
          onClick={() => { setAddingCategoryContext(addingCategoryContext === contextKey ? null : contextKey); setNewCategoryName(''); }}
          className="text-[11px] font-semibold text-[#e4e0d7] hover:text-white flex items-center gap-1 cursor-pointer transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{addingCategoryContext === contextKey ? 'Cancelar' : 'Nova Categoria'}</span>
        </button>
      </div>

      {addingCategoryContext === contextKey ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nome da categoria..."
            autoFocus
            className="flex-1 px-3 py-2 bg-[#000000] border border-[#e4e0d7] rounded-xl text-sm text-[#e4e0d7] placeholder-[#6e6a61] focus:outline-none"
          />
          <button
            type="button"
            disabled={savingCategory}
            onClick={() => handleAddPermanentCategory(contextKey)}
            className="px-3.5 py-2 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] rounded-xl text-xs font-bold cursor-pointer shrink-0 transition"
          >
            Salvar
          </button>
        </div>
      ) : (
        <select
          value={currentValue}
          onChange={(e) => onSelectChange(e.target.value)}
          className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7] focus:outline-none focus:border-[#e4e0d7]"
        >
          {allCategories.map((c) => <option key={c} value={c} className="bg-[#0a0a0a] text-[#e4e0d7]">{c}</option>)}
        </select>
      )}
    </div>
  );

  const renderLogo = (sizeClass = 'w-10 h-10') => (
    <div className={`${sizeClass} rounded-xl overflow-hidden bg-[#e4e0d7] flex items-center justify-center border border-[#262522] shrink-0`}>
      <img
        src="/logo.png"
        alt="Logo"
        className="w-full h-full object-cover"
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.parentElement.innerHTML = '<svg class="w-5 h-5 text-[#000000]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>';
        }}
      />
    </div>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#e4e0d7] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-[#e4e0d7]" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#e4e0d7] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0a0a0a] border border-[#262522] rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3.5">
            {renderLogo('w-11 h-11')}
            <div>
              <h1 className="text-2xl font-bold text-[#e4e0d7] tracking-tight">Biblioteca STL</h1>
              <p className="text-xs text-[#a39e93]">Catálogo Pessoal &bull; Google Drive + Supabase</p>
            </div>
          </div>
          {authError && <div className="p-3 rounded-xl bg-[#b94a48]/15 border border-[#b94a48]/40 text-[#e89b99] text-xs">{authError}</div>}
          <form onSubmit={handleSupabaseAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#a39e93] mb-1">Seu E-mail Pessoal</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@exemplo.com" className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#a39e93] mb-1">Senha</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <button type="submit" className="w-full py-2.5 px-4 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] font-bold rounded-xl text-sm transition cursor-pointer">
              {isSignUp ? 'Criar Conta Pessoal' : 'Entrar na Biblioteca'}
            </button>
          </form>
          <div className="text-center pt-3 border-t border-[#1c1b19]">
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-[#a39e93] hover:text-[#e4e0d7] transition cursor-pointer">
              {isSignUp ? 'Já possui conta? Clique para entrar' : 'Primeira vez aqui? Crie sua conta pessoal'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-[#e4e0d7] flex flex-col">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-[90%] sm:max-w-md px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 bg-[#0f0f0e] border-[#e4e0d7]/30 text-sm">
          {toast.type === 'error' ? <AlertTriangle className="w-5 h-5 text-[#d96b68] shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-[#70a37f] shrink-0" />}
          <span className="text-[#e4e0d7]">{toast.message}</span>
        </div>
      )}

      {/* Cabeçalho */}
      <header className="border-b border-[#1f1e1c] bg-[#000000]/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5">
            {renderLogo('w-9 h-9')}
            <div>
              <h1 className="font-bold text-base sm:text-lg text-[#e4e0d7] leading-tight tracking-tight">Biblioteca STL</h1>
              <p className="text-[11px] text-[#8c877e] hidden lg:block">Google Drive &bull; Subpastas por Categoria</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1.5">
            <button onClick={() => setActiveTab('catalogo')} className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'catalogo' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#a39e93] hover:text-[#e4e0d7] hover:bg-[#121211]'}`}>
              <Box className="w-4 h-4" /><span>Catálogo ({models.length})</span>
            </button>
            <button onClick={() => setActiveTab('fila')} className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'fila' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#a39e93] hover:text-[#e4e0d7] hover:bg-[#121211]'}`}>
              <ListOrdered className="w-4 h-4" /><span>Fila ({queuedModels.length})</span>
            </button>
            <button onClick={() => setActiveTab('upload')} className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'upload' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#a39e93] hover:text-[#e4e0d7] hover:bg-[#121211]'}`}>
              <Upload className="w-4 h-4" /><span>Enviar</span>
            </button>
            <button onClick={() => setActiveTab('importar')} className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'importar' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#a39e93] hover:text-[#e4e0d7] hover:bg-[#121211]'}`}>
              <FolderDown className="w-4 h-4" /><span>Importar</span>
            </button>
            <button onClick={() => setActiveTab('calculadora')} className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'calculadora' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#a39e93] hover:text-[#e4e0d7] hover:bg-[#121211]'}`}>
              <Calculator className="w-4 h-4" /><span>Calculadora</span>
            </button>
            <button onClick={() => setActiveTab('configuracoes')} className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'configuracoes' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#a39e93] hover:text-[#e4e0d7] hover:bg-[#121211]'}`}>
              <Settings className="w-4 h-4" /><span>Config</span>
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              className="ml-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 bg-[#b94a48]/15 text-[#e89b99] border border-[#b94a48]/30 hover:bg-[#b94a48]/25 transition cursor-pointer"
              title="Sair da Conta"
            >
              <LogOut className="w-4 h-4" /><span>Sair</span>
            </button>
          </nav>

          <div className="md:hidden flex items-center">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-xl bg-[#0a0a0a] border border-[#262522] text-[#e4e0d7] cursor-pointer">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0a0a0a] border-b border-[#262522] px-4 py-3 space-y-2">
            <button onClick={() => { setActiveTab('catalogo'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 ${activeTab === 'catalogo' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#e4e0d7]'}`}>
              <Box className="w-4 h-4" /><span>Catálogo ({models.length})</span>
            </button>
            <button onClick={() => { setActiveTab('fila'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 ${activeTab === 'fila' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#e4e0d7]'}`}>
              <ListOrdered className="w-4 h-4" /><span>Fila de Impressão ({queuedModels.length})</span>
            </button>
            <button onClick={() => { setActiveTab('upload'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 ${activeTab === 'upload' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#e4e0d7]'}`}>
              <Upload className="w-4 h-4" /><span>Enviar ZIP</span>
            </button>
            <button onClick={() => { setActiveTab('importar'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 ${activeTab === 'importar' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#e4e0d7]'}`}>
              <FolderDown className="w-4 h-4" /><span>Importar (Aguardando)</span>
            </button>
            <button onClick={() => { setActiveTab('calculadora'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 ${activeTab === 'calculadora' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#e4e0d7]'}`}>
              <Calculator className="w-4 h-4" /><span>Calculadora de Gastos</span>
            </button>
            <button onClick={() => { setActiveTab('configuracoes'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 ${activeTab === 'configuracoes' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#e4e0d7]'}`}>
              <Settings className="w-4 h-4" /><span>Configurações</span>
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); supabase.auth.signOut(); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 bg-[#b94a48]/15 text-[#e89b99] border border-[#b94a48]/30"
            >
              <LogOut className="w-4 h-4" /><span>Sair da Conta (Logoff)</span>
            </button>
          </div>
        )}
      </header>

      {/* Banner Google Drive */}
      {(!googleConnected || !settings.root_folder_id) && (
        <div className="bg-[#12110f] border-b border-[#e4e0d7]/20">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#e4e0d7]">
              <HardDrive className="w-5 h-5 text-[#c89d66] shrink-0" />
              {!googleConnected ? (
                <span>Vincule sua conta Google uma única vez para ativar o armazenamento definitivo no Google Drive.</span>
              ) : (
                <span>Selecione ou crie a pasta raiz <strong>Biblioteca STL</strong> no seu Google Drive.</span>
              )}
            </div>
            <div className="self-end sm:self-auto">
              {!googleConnected ? (
                <button onClick={handleConnectGoogle} className="px-4 py-1.5 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] rounded-lg text-xs font-bold transition cursor-pointer">
                  Vincular Conta Google (1x)
                </button>
              ) : (
                <button onClick={() => openFolderPicker()} className="px-4 py-1.5 bg-[#c89d66] hover:bg-[#b88c56] text-[#000000] rounded-lg text-xs font-bold transition cursor-pointer">
                  Configurar Pasta Raiz
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8 flex-1">
        {activeTab === 'catalogo' && (
          <div className="space-y-5">
            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
                <div className="relative w-full lg:w-64 focus-within:lg:w-96 transition-all duration-300">
                  <Search className="w-4 h-4 text-[#8c877e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Buscar modelo por nome, descrição ou tag..."
                    className="w-full pl-10 pr-9 py-2.5 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7] placeholder-[#6e6a61] focus:outline-none focus:border-[#e4e0d7] transition-all"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => setSearchInput('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c877e] hover:text-[#e4e0d7] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 justify-end">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-[#c89d66] shrink-0" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-xs sm:text-sm text-[#e4e0d7] focus:outline-none cursor-pointer"
                    >
                      <option value="Todas">Todas Categorias ({models.length})</option>
                      {allCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="w-4 h-4 text-[#c89d66] shrink-0" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-xs sm:text-sm text-[#e4e0d7] focus:outline-none cursor-pointer"
                    >
                      <option value="newest">Mais Recentes</option>
                      <option value="oldest">Mais Antigos</option>
                      <option value="name_asc">Nome (A–Z)</option>
                      <option value="name_desc">Nome (Z–A)</option>
                      <option value="size_desc">Maior Tamanho</option>
                      <option value="size_asc">Menor Tamanho</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#8c877e]">Exibir:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="px-2.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-xs sm:text-sm text-[#e4e0d7] cursor-pointer"
                    >
                      <option value={8}>8</option>
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                      <option value={48}>48</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#1c1b19] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkMode(!bulkMode);
                      setSelectedModelIds([]);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${bulkMode
                      ? 'bg-[#e4e0d7] text-[#000000] border-[#e4e0d7]'
                      : 'bg-[#000000] text-[#a39e93] hover:text-[#e4e0d7] border-[#262522]'
                      }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{bulkMode ? 'Sair do Modo Lote' : 'Seleção em Lote'}</span>
                  </button>

                  {bulkMode && paginatedModels.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllCurrentPage}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#141413] text-[#e4e0d7] border border-[#262522] hover:bg-[#1f1e1c] cursor-pointer"
                    >
                      Selecionar/Desmarcar Página ({paginatedModels.length})
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={scanningGhostFiles}
                    onClick={handleScanGhostFiles}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#000000] hover:bg-[#141413] text-[#a39e93] hover:text-[#e4e0d7] border border-[#262522] flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <FileWarning className={`w-3.5 h-3.5 text-[#c89d66] ${scanningGhostFiles ? 'animate-spin' : ''}`} />
                    <span>{scanningGhostFiles ? 'Verificando Drive...' : 'Verificar Arquivos no Drive'}</span>
                  </button>

                  {ghostCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setOnlyGhostFilter(!onlyGhostFilter)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition ${onlyGhostFilter
                        ? 'bg-[#b94a48] text-white border-[#b94a48]'
                        : 'bg-[#b94a48]/15 text-[#e89b99] border-[#b94a48]/40'
                        }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{onlyGhostFilter ? 'Mostrando Apenas Ausentes' : `${ghostCount} Ausente(s) no Drive`}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openShareModalWithCurrentFilters}
                    className="px-3.5 py-1.5 rounded-xl bg-[#c89d66] hover:bg-[#b88c56] text-[#000000] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Compartilhar Vitrine</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => loadUserData(false)}
                    title="Sincronizar catálogo"
                    className="p-2 rounded-xl bg-[#000000] hover:bg-[#141413] text-[#a39e93] hover:text-[#e4e0d7] border border-[#262522] cursor-pointer transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin text-[#e4e0d7]' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            {bulkMode && selectedModelIds.length > 0 && (
              <div className="bg-[#141311] border border-[#c89d66] rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl sticky top-20 z-20">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#e4e0d7]">
                  <CheckSquare className="w-4 h-4 text-[#c89d66]" />
                  <span>{selectedModelIds.length} modelo(s) selecionado(s)</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkTargetCategory(allCategories[0] || 'Geral');
                      setBulkCategoryModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Mudar Categoria
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkQueueChange(true)}
                    className="px-3 py-1.5 bg-[#1f1e1c] hover:bg-[#2a2926] text-[#e4e0d7] border border-[#383632] rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    + Fila de Impressão
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkDeleteModalOpen(true)}
                    className="px-3 py-1.5 bg-[#b94a48] text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Excluir Selecionados
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedModelIds([])}
                    className="px-2.5 py-1.5 text-xs text-[#a39e93] hover:text-white cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            )}

            {loadingData ? (
              <div className="py-20 text-center text-[#a39e93] flex flex-col items-center gap-3">
                <RefreshCw className="w-7 h-7 animate-spin text-[#e4e0d7]" />
                <span className="text-sm">Carregando seus modelos 3D...</span>
              </div>
            ) : activeModelsSource.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-8 sm:p-12 text-center space-y-4">
                <FileArchive className="w-12 h-12 text-[#5e5a52] mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-[#e4e0d7]">Nenhum modelo STL encontrado</h3>
                  <p className="text-xs text-[#8c877e] max-w-md mx-auto">
                    {searchInput || selectedCategory !== 'Todas' || onlyGhostFilter
                      ? 'Nenhum modelo corresponde aos filtros aplicados.'
                      : 'Envie um novo arquivo ZIP ou importe pastas de importações/Aguardando.'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  {(searchInput || selectedCategory !== 'Todas' || onlyGhostFilter) ? (
                    <button
                      onClick={() => { setSearchInput(''); setSelectedCategory('Todas'); setOnlyGhostFilter(false); }}
                      className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Limpar Filtros
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setActiveTab('upload')} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold transition cursor-pointer">Enviar Novo ZIP</button>
                      <button onClick={() => setActiveTab('importar')} className="px-4 py-2 bg-[#141413] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold transition cursor-pointer">Importar de Aguardando</button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                  {paginatedModels.map((model) => {
                    const paths = getModelImagePaths(model);
                    const coverUrl = getSignedUrlForPath(paths[0]);
                    const isSelectedBulk = selectedModelIds.includes(model.id);
                    const isGhost = driveStatusCheck[model.id] === 'missing';

                    return (
                      <div
                        key={model.id}
                        onClick={(e) => {
                          if (bulkMode) {
                            toggleSelectModelForBulk(model.id, e);
                          } else {
                            handleOpenDetails(model);
                          }
                        }}
                        className={`group bg-[#0a0a0a] border rounded-2xl overflow-hidden flex flex-col transition cursor-pointer shadow-lg ${isSelectedBulk
                          ? 'border-[#c89d66] ring-2 ring-[#c89d66]/40'
                          : isGhost
                            ? 'border-[#b94a48]'
                            : 'border-[#262522] hover:border-[#e4e0d7]/60'
                          }`}
                      >
                        <div className="aspect-video bg-[#000000] relative overflow-hidden flex items-center justify-center border-b border-[#1a1917]">
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt={model.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-[#5e5a52]">
                              <Box className="w-10 h-10" />
                              <span className="text-[11px]">Sem imagem</span>
                            </div>
                          )}

                          {bulkMode ? (
                            <button
                              type="button"
                              onClick={(e) => toggleSelectModelForBulk(model.id, e)}
                              className="absolute top-2.5 left-2.5 p-1.5 rounded-lg bg-[#000000]/90 border border-[#e4e0d7]/40 text-[#e4e0d7]"
                            >
                              {isSelectedBulk ? (
                                <CheckSquare className="w-5 h-5 text-[#c89d66]" />
                              ) : (
                                <Square className="w-5 h-5 text-[#8c877e]" />
                              )}
                            </button>
                          ) : (
                            <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#000000]/85 backdrop-blur text-[#e4e0d7] border border-[#e4e0d7]/30">
                              {model.category}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleTogglePrintQueue(model, e)}
                            className={`absolute top-2.5 right-2.5 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 border transition cursor-pointer ${model.in_print_queue
                              ? 'bg-[#c89d66] text-[#000000] border-[#c89d66]'
                              : 'bg-[#000000]/80 text-[#a39e93] hover:text-white border-[#262522]'
                              }`}
                          >
                            <ListOrdered className="w-3 h-3" />
                            <span>{model.in_print_queue ? 'Na Fila' : '+ Fila'}</span>
                          </button>

                          {isGhost && (
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#b94a48] text-white flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Ausente no Drive
                            </span>
                          )}

                          {paths.length > 1 && (
                            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#000000]/85 text-[#c89d66] border border-[#c89d66]/40 flex items-center gap-1">
                              <Images className="w-3 h-3" /> {paths.length} fotos
                            </span>
                          )}
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <div>
                            <h3 className="font-bold text-[#e4e0d7] text-sm group-hover:text-white transition line-clamp-1">{model.name}</h3>
                            <p className="text-xs text-[#8c877e] line-clamp-2 mt-1">{model.description || 'Sem descrição.'}</p>
                          </div>
                          <div className="space-y-2 pt-2 border-t border-[#1c1b19]">
                            {model.tags?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {model.tags.slice(0, 3).map((tag, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-[#141413] text-[#a39e93] border border-[#262522] rounded text-[10px]">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center justify-between text-[11px] text-[#8c877e]">
                              <span>{formatBytes(model.drive_file_size)}</span>
                              <span className="text-[#e4e0d7] font-semibold group-hover:underline">Detalhes &rarr;</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-[#8c877e]">
                    Mostrando{' '}
                    <strong className="text-[#e4e0d7]">
                      {(safeCurrentPage - 1) * itemsPerPage + 1}
                    </strong>{' '}
                    a{' '}
                    <strong className="text-[#e4e0d7]">
                      {Math.min(safeCurrentPage * itemsPerPage, activeModelsSource.length)}
                    </strong>{' '}
                    de <strong className="text-[#e4e0d7]">{activeModelsSource.length}</strong> modelo(s)
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeCurrentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      className="p-2 rounded-xl bg-[#000000] border border-[#262522] text-[#a39e93] hover:text-[#e4e0d7] disabled:opacity-35 disabled:pointer-events-none cursor-pointer transition"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={safeCurrentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-2 rounded-xl bg-[#000000] border border-[#262522] text-[#a39e93] hover:text-[#e4e0d7] disabled:opacity-35 disabled:pointer-events-none cursor-pointer transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {pageNumbers[0] > 1 && <span className="px-2 text-xs text-[#6e6a61]">...</span>}

                    {pageNumbers.map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCurrentPage(num)}
                        className={`min-w-[36px] h-9 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${num === safeCurrentPage
                          ? 'bg-[#e4e0d7] text-[#000000] shadow-md'
                          : 'bg-[#000000] border border-[#262522] text-[#a39e93] hover:text-[#e4e0d7]'
                          }`}
                      >
                        {num}
                      </button>
                    ))}

                    {pageNumbers[pageNumbers.length - 1] < totalPages && <span className="px-2 text-xs text-[#6e6a61]">...</span>}

                    <button
                      type="button"
                      disabled={safeCurrentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="p-2 rounded-xl bg-[#000000] border border-[#262522] text-[#a39e93] hover:text-[#e4e0d7] disabled:opacity-35 disabled:pointer-events-none cursor-pointer transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={safeCurrentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="p-2 rounded-xl bg-[#000000] border border-[#262522] text-[#a39e93] hover:text-[#e4e0d7] disabled:opacity-35 disabled:pointer-events-none cursor-pointer transition"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ABA: FILA DE IMPRESSÃO */}
        {activeTab === 'fila' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#c89d66] text-[#000000]">
                  <ListOrdered className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#e4e0d7]">Fila de Impressão ({queuedModels.length})</h2>
                  <p className="text-xs text-[#8c877e]">
                    Organize suas próximas impressões por prioridade e marque como concluídas após imprimir.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('catalogo')}
                className="px-4 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold cursor-pointer"
              >
                + Adicionar Mais do Catálogo
              </button>
            </div>

            {queuedModels.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-12 text-center space-y-3">
                <ListOrdered className="w-10 h-10 text-[#5e5a52] mx-auto" />
                <p className="text-sm font-semibold text-[#e4e0d7]">Sua Fila de Impressão está vazia</p>
                <p className="text-xs text-[#8c877e] max-w-md mx-auto">
                  Clique no botão <strong>"+ Fila"</strong> no canto superior direito de qualquer card no Catálogo para planejar suas próximas impressões.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {queuedModels.map((model, index) => {
                  const paths = getModelImagePaths(model);
                  const coverUrl = getSignedUrlForPath(paths[0]);
                  const prio = model.queue_priority || 'Normal';
                  return (
                    <div
                      key={model.id}
                      className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 hover:border-[#e4e0d7]/40 transition"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-7 h-7 rounded-lg bg-[#141413] border border-[#262522] flex items-center justify-center text-xs font-bold text-[#c89d66] shrink-0">
                          #{index + 1}
                        </div>
                        <div
                          onClick={() => handleOpenDetails(model)}
                          className="w-20 h-14 rounded-xl bg-[#000000] border border-[#262522] overflow-hidden shrink-0 flex items-center justify-center cursor-pointer"
                        >
                          {coverUrl ? (
                            <img src={coverUrl} alt={model.name} className="w-full h-full object-cover" />
                          ) : (
                            <Box className="w-6 h-6 text-[#5e5a52]" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              onClick={() => handleOpenDetails(model)}
                              className="font-bold text-sm text-[#e4e0d7] hover:underline cursor-pointer"
                            >
                              {model.name}
                            </h3>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#141413] text-[#a39e93] border border-[#262522]">
                              {model.category}
                            </span>
                          </div>
                          {model.notes && (
                            <p className="text-xs text-[#c89d66]">Config: {model.notes}</p>
                          )}
                          <p className="text-[11px] text-[#8c877e]">{formatBytes(model.drive_file_size)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-[#1c1b19]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[#8c877e]">Prioridade:</span>
                          <select
                            value={prio}
                            onChange={(e) => handleChangeQueuePriority(model, e.target.value)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${prio === 'Alta'
                              ? 'bg-[#b94a48]/20 text-[#e89b99] border-[#b94a48]/40'
                              : prio === 'Baixa'
                                ? 'bg-[#141413] text-[#8c877e] border-[#262522]'
                                : 'bg-[#c89d66]/20 text-[#c89d66] border-[#c89d66]/40'
                              }`}
                          >
                            <option value="Alta" className="bg-[#0a0a0a] text-[#e4e0d7]">Alta</option>
                            <option value="Normal" className="bg-[#0a0a0a] text-[#e4e0d7]">Normal</option>
                            <option value="Baixa" className="bg-[#0a0a0a] text-[#e4e0d7]">Baixa</option>
                          </select>
                        </div>

                        <a
                          href={model.drive_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#c89d66]" />
                          <span>Baixar ZIP</span>
                        </a>

                        <button
                          type="button"
                          onClick={(e) => handleTogglePrintQueue(model, e)}
                          className="px-3.5 py-1.5 bg-[#4d7c5b] hover:bg-[#3f684b] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Concluir Impressão</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA: ENVIAR NOVO MODELO */}
        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#e4e0d7]">Enviar Novo Modelo STL (.ZIP)</h2>
              <p className="text-xs text-[#8c877e] mt-1">O arquivo ZIP será salvo dentro da subpasta correspondente no Google Drive.</p>
            </div>
            {pendingRecovery && (
              <div className="p-4 rounded-xl bg-[#c89d66]/10 border border-[#c89d66]/40 space-y-3">
                <div className="flex items-center gap-2 text-[#c89d66] text-sm font-semibold"><AlertTriangle className="w-5 h-5 shrink-0" /><span>Upload concluído, mas o salvamento falhou!</span></div>
                <button type="button" onClick={handleRetryMetadataSave} disabled={uploading} className="px-4 py-2 bg-[#c89d66] text-[#000000] font-bold rounded-lg text-xs cursor-pointer">Recuperar e Concluir Cadastro</button>
              </div>
            )}
            <form onSubmit={handleUploadNewModel} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Nome do Modelo *</label>
                  <input type="text" required value={uploadForm.name} onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })} placeholder="Ex: Dragão" className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                </div>
                {renderCategorySelector(uploadForm.category, (val) => setUploadForm({ ...uploadForm, category: val }), 'upload')}
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a39e93] mb-1">Descrição</label>
                <textarea rows={2} value={uploadForm.description} onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })} placeholder="Detalhes..." className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Tags (separadas por vírgula)</label>
                  <input type="text" value={uploadForm.tags} onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })} placeholder="rpg, stl" className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Observações de Impressão</label>
                  <input type="text" value={uploadForm.notes} onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })} placeholder="PLA 205°C" className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-[#000000] border border-dashed border-[#383632] space-y-2">
                  <label className="block text-xs font-semibold text-[#e4e0d7]">1. Arquivo ZIP *</label>
                  <input type="file" accept=".zip,application/zip" required onChange={(e) => { const file = e.target.files?.[0] || null; setUploadForm((prev) => ({ ...prev, zipFile: file, name: prev.name || (file ? file.name.replace(/\.zip$/i, '') : '') })); }} className="w-full text-xs text-[#a39e93] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#e4e0d7] file:text-[#000000] file:font-semibold" />
                  {uploadForm.zipFile && <p className="text-[11px] text-[#70a37f] truncate">{uploadForm.zipFile.name}</p>}
                </div>
                <div className="p-4 rounded-xl bg-[#000000] border border-dashed border-[#383632] space-y-2">
                  <label className="block text-xs font-semibold text-[#c89d66]">2. Imagens de Referência (Várias)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setUploadForm((prev) => ({ ...prev, imageFiles: [...prev.imageFiles, ...files] }));
                    }}
                    className="w-full text-xs text-[#a39e93] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#262522] file:text-[#e4e0d7]"
                  />
                  {uploadForm.imageFiles.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-[11px] text-[#70a37f] font-semibold">{uploadForm.imageFiles.length} imagem(ns) selecionada(s):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {uploadForm.imageFiles.map((img, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#141413] border border-[#262522] text-[10px] text-[#e4e0d7]">
                            <span className="truncate max-w-[110px]">{img.name}</span>
                            <button
                              type="button"
                              onClick={() => setUploadForm((prev) => ({
                                ...prev,
                                imageFiles: prev.imageFiles.filter((_, idx) => idx !== i)
                              }))}
                              className="text-[#d96b68] hover:text-white cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {uploading && <div className="p-3 rounded-xl bg-[#141413] border border-[#e4e0d7]/30 flex items-center gap-3 text-xs text-[#e4e0d7]"><RefreshCw className="w-4 h-4 animate-spin shrink-0" /><span>{uploadStep || 'Processando...'}</span></div>}
              <div className="flex justify-end pt-2">
                <button type="submit" disabled={uploading} className="px-6 py-2.5 bg-[#e4e0d7] hover:bg-[#d5d0c5] disabled:opacity-50 text-[#000000] font-bold rounded-xl text-sm transition cursor-pointer">
                  {uploading ? 'Enviando...' : 'Enviar para o Drive e Catalogar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ABA: IMPORTAR */}
        {activeTab === 'importar' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-5">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-[#e4e0d7]">
                  Fila de Importação (<code className="text-[#c89d66]">importações/Aguardando</code>)
                </h2>
                <p className="text-xs text-[#8c877e]">
                  Coloque suas pastas de modelos dentro de <strong className="text-[#e4e0d7]">importações/Aguardando</strong>. Ao cadastrar, o sistema compacta a pasta em <strong>.ZIP</strong>, salva na categoria escolhida e move a pasta original para <strong className="text-[#e4e0d7]">importações/Importadas</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {importPipelineIds.aguardandoId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${importPipelineIds.aguardandoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Folder className="w-3.5 h-3.5 text-[#c89d66]" />
                    <span>Abrir "Aguardando" no Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {importPipelineIds.importadasId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${importPipelineIds.importadasId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#a39e93] border border-[#262522] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <span>Ver "Importadas"</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  onClick={fetchAwaitingImports}
                  disabled={loadingDriveZips}
                  className="px-4 py-2 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingDriveZips ? 'animate-spin' : ''}`} />
                  <span>Atualizar Fila</span>
                </button>
              </div>
            </div>

            {!settings.root_folder_id ? (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-8 text-center text-sm text-[#8c877e]">
                Conecte o Google e selecione a pasta raiz.
              </div>
            ) : loadingDriveZips ? (
              <div className="py-16 text-center text-[#a39e93] flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#e4e0d7]" />
                <span className="text-xs">Verificando pastas em importações/Aguardando...</span>
              </div>
            ) : awaitingItems.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-8 text-center space-y-3">
                <Folder className="w-10 h-10 text-[#5e5a52] mx-auto" />
                <p className="text-sm text-[#e4e0d7] font-semibold">Nenhuma pasta aguardando importação</p>
                <p className="text-xs text-[#8c877e] max-w-md mx-auto">
                  Clique em <strong>"Abrir Aguardando no Drive"</strong> acima, solte suas pastas com arquivos STL lá dentro e clique em <strong>Atualizar Fila</strong>.
                </p>
              </div>
            ) : (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-[#262522] text-xs text-[#8c877e] bg-[#000000]">
                      <th className="py-3.5 px-4">Pasta / Item em Aguardando</th>
                      <th className="py-3.5 px-4">Tipo</th>
                      <th className="py-3.5 px-4">Fluxo Automático</th>
                      <th className="py-3.5 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c1b19]">
                    {awaitingItems.map((item) => {
                      const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
                      return (
                        <tr key={item.id} className="hover:bg-[#121211]">
                          <td className="py-3.5 px-4 font-medium text-[#e4e0d7] flex items-center gap-2.5">
                            {isFolder ? (
                              <Folder className="w-4 h-4 text-[#c89d66] shrink-0" />
                            ) : (
                              <FileArchive className="w-4 h-4 text-[#e4e0d7] shrink-0" />
                            )}
                            <span className="truncate max-w-xs">{item.name}</span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[#a39e93]">
                            <span className="px-2 py-0.5 rounded bg-[#141413] border border-[#262522]">
                              {isFolder ? 'Pasta de Arquivos' : `Arquivo (${formatBytes(item.size)})`}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[#8c877e]">
                            <span className="inline-flex items-center gap-1">
                              Compactar .ZIP <ArrowRight className="w-3 h-3 text-[#c89d66]" /> Salvar na Categoria <ArrowRight className="w-3 h-3 text-[#c89d66]" /> Mover p/ Importadas
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setImportingFile(item);
                                setImportForm({
                                  name: item.name.replace(/\.zip$/i, ''),
                                  description: '',
                                  category: 'Geral',
                                  tags: '',
                                  notes: '',
                                  imageFiles: []
                                });
                              }}
                              className="px-3.5 py-1.5 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] rounded-lg text-xs font-bold cursor-pointer transition"
                            >
                              Cadastrar e Compactar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA: CALCULADORA */}
        {activeTab === 'calculadora' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#e4e0d7] text-[#000000]"><Calculator className="w-6 h-6" /></div>
                  <div>
                    <h2 className="text-lg font-bold text-[#e4e0d7]">Calculadora de Gastos e Precificação</h2>
                    <p className="text-xs text-[#8c877e]">Calcule o custo exato de produção e defina seu preço de venda com lucro.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setNewMaterialModal(true)} className="px-3.5 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <Plus className="w-3.5 h-3.5 text-[#c89d66]" /><span>Novo Material</span>
                  </button>
                  <button onClick={() => setNewPrinterModal(true)} className="px-3.5 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <Plus className="w-3.5 h-3.5 text-[#c89d66]" /><span>Nova Impressora</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-[#1c1b19]">
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Impressora</label>
                  <select value={calcForm.printerId} onChange={(e) => setCalcForm({ ...calcForm, printerId: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]">
                    {printers.length === 0 && <option value="">Nenhuma impressora cadastrada</option>}
                    {printers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.power_watts}W)</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Material (Filamento / Resina)</label>
                  <select value={calcForm.materialId} onChange={(e) => setCalcForm({ ...calcForm, materialId: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]">
                    {materials.length === 0 && <option value="">Nenhum material cadastrado</option>}
                    {materials.map((m) => <option key={m.id} value={m.id}>{m.type}: {m.name} ({m.color}) - R$ {m.price_per_unit}/kg</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Peso da Peça (gramas / ml)</label>
                  <input type="number" min={1} value={calcForm.weightGrams} onChange={(e) => setCalcForm({ ...calcForm, weightGrams: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Tempo de Impressão (Horas)</label>
                  <input type="number" step="0.1" min={0.1} value={calcForm.printHours} onChange={(e) => setCalcForm({ ...calcForm, printHours: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Taxa de Falha / Desperdício (%)</label>
                  <input type="number" min={0} value={calcForm.failureRate} onChange={(e) => setCalcForm({ ...calcForm, failureRate: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Mão de Obra (Horas de Dedicação)</label>
                  <input type="number" step="0.1" min={0} value={calcForm.laborHours} onChange={(e) => setCalcForm({ ...calcForm, laborHours: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-3 border-t border-[#1c1b19]">
                <label className="flex items-center gap-2 text-xs text-[#e4e0d7] cursor-pointer">
                  <input type="checkbox" checked={calcForm.washed} onChange={(e) => setCalcForm({ ...calcForm, washed: e.target.checked })} className="w-4 h-4 accent-[#e4e0d7]" />
                  <span>Lavagem Realizada (Álcool / Insumos)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-[#e4e0d7] cursor-pointer">
                  <input type="checkbox" checked={calcForm.painted} onChange={(e) => setCalcForm({ ...calcForm, painted: e.target.checked })} className="w-4 h-4 accent-[#e4e0d7]" />
                  <span>Pintura / Primer / Acabamento Especial</span>
                </label>
              </div>

              <div className="pt-3 border-t border-[#1c1b19] flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#e4e0d7]">Margem de Lucro Desejada (Markup %)</p>
                  <p className="text-[11px] text-[#8c877e]">Percentual de lucro aplicado sobre o custo total de produção.</p>
                </div>
                <input type="number" min={0} value={calcForm.profitMarginPct} onChange={(e) => setCalcForm({ ...calcForm, profitMarginPct: e.target.value })} className="w-28 px-3 py-1.5 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7] text-right" />
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-[#e4e0d7]/30 rounded-2xl p-6 space-y-5 shadow-2xl">
              <h3 className="font-bold text-[#e4e0d7] text-base border-b border-[#1c1b19] pb-3">Detalhamento de Custos e Sugestão de Venda</h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#262522]">
                  <span className="text-[#8c877e] block">Matéria-Prima</span>
                  <strong className="text-white text-sm mt-1 block">R$ {calculationResults.materialCost.toFixed(2)}</strong>
                  <span className="text-[10px] text-[#6e6a61]">({calculationResults.effectiveWeightG.toFixed(1)}g c/ falha)</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#262522]">
                  <span className="text-[#8c877e] block">Energia Elétrica</span>
                  <strong className="text-white text-sm mt-1 block">R$ {calculationResults.energyCost.toFixed(2)}</strong>
                  <span className="text-[10px] text-[#6e6a61]">(R$ {settings.energy_cost_kwh}/kWh)</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#262522]">
                  <span className="text-[#8c877e] block">Depreciação Máquina</span>
                  <strong className="text-white text-sm mt-1 block">R$ {calculationResults.depreciationCost.toFixed(2)}</strong>
                  <span className="text-[10px] text-[#6e6a61]">Desgaste hora/máquina</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#262522]">
                  <span className="text-[#8c877e] block">Pós-Proc. & Mão de Obra</span>
                  <strong className="text-white text-sm mt-1 block">R$ {(calculationResults.postProcCost + calculationResults.laborCost).toFixed(2)}</strong>
                  <span className="text-[10px] text-[#6e6a61]">Insumos + Horas de bancada</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#121211] border border-[#c89d66]/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-xs text-[#a39e93] block">Custo Total de Produção: <strong className="text-white">R$ {calculationResults.totalCost.toFixed(2)}</strong></span>
                  <span className="text-xs text-[#70a37f] block">Lucro Líquido Estimado ({calcForm.profitMarginPct}%): <strong>R$ {calculationResults.netProfit.toFixed(2)}</strong></span>
                </div>
                <div className="text-center sm:text-right">
                  <span className="text-xs text-[#c89d66] font-semibold uppercase tracking-wider block">Preço Sugerido de Venda</span>
                  <span className="text-2xl sm:text-3xl font-black text-[#e4e0d7]">R$ {calculationResults.suggestedPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA: CONFIGURAÇÕES */}
        {activeTab === 'configuracoes' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-6 h-6 text-[#e4e0d7] shrink-0" />
                  <div>
                    <h3 className="font-bold text-[#e4e0d7] text-base">Google Drive (Armazenamento Principal)</h3>
                    <p className="text-xs text-[#8c877e]">Conexão definitiva via Refresh Token</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${googleConnected ? 'bg-[#4d7c5b]/15 text-[#70a37f] border border-[#4d7c5b]/30' : 'bg-[#c89d66]/15 text-[#c89d66]'}`}>
                  {googleConnected ? `Vinculado Definitivo ${googleUserEmail ? `(${googleUserEmail})` : ''}` : 'Não Vinculado'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#000000] border border-[#262522] space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-[#8c877e]">Pasta Raiz:</span>
                  <span className="font-semibold text-[#e4e0d7] break-all">{settings.root_folder_name || 'Nenhuma'}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-[#8c877e]">ID da Pasta Raiz:</span>
                  <span className="font-mono text-[#c89d66] break-all">{settings.root_folder_id || '—'}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {!googleConnected ? (
                  <button onClick={handleConnectGoogle} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer">
                    Vincular Conta Google (1 Única Vez)
                  </button>
                ) : (
                  <>
                    <button onClick={() => openFolderPicker()} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer">
                      Selecionar Outra Pasta Raiz
                    </button>
                    {settings.root_folder_id && (
                      <button
                        type="button"
                        disabled={syncingCategoryFolders}
                        onClick={() => handleSyncAllCategorySubfolders(settings.root_folder_id, false)}
                        className="px-4 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <FolderPlus className={`w-4 h-4 text-[#c89d66] ${syncingCategoryFolders ? 'animate-spin' : ''}`} />
                        <span>{syncingCategoryFolders ? 'Sincronizando...' : 'Sincronizar Subpastas no Drive'}</span>
                      </button>
                    )}
                    {settings.root_folder_id && (
                      <a href={`https://drive.google.com/drive/folders/${settings.root_folder_id}`} target="_blank" rel="noreferrer" className="px-4 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5">
                        <span>Abrir Pasta Raiz no Drive</span><ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={handleDisconnectGoogle} className="px-4 py-2 bg-[#b94a48]/15 text-[#e89b99] border border-[#b94a48]/30 rounded-xl text-xs font-semibold cursor-pointer">
                      Desvincular Google
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-6 space-y-4">
              <h3 className="font-bold text-[#e4e0d7] text-base">Parâmetros Padrão da Calculadora</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Custo da Energia (R$/kWh)</label>
                  <input type="number" step="0.01" value={settings.energy_cost_kwh} onChange={(e) => handleSaveGeneralSettings({ energy_cost_kwh: Number(e.target.value) })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Taxa de Mão de Obra (R$/hora)</label>
                  <input type="number" step="0.50" value={settings.labor_hourly_rate} onChange={(e) => handleSaveGeneralSettings({ labor_hourly_rate: Number(e.target.value) })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Taxa de Falha Padrão (%)</label>
                  <input type="number" value={settings.default_failure_rate} onChange={(e) => handleSaveGeneralSettings({ default_failure_rate: Number(e.target.value) })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Adicional Pós-Processamento (%)</label>
                  <input type="number" value={settings.default_post_processing_pct} onChange={(e) => handleSaveGeneralSettings({ default_post_processing_pct: Number(e.target.value) })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                </div>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-[#e4e0d7] text-base">Materiais Cadastrados ({materials.length})</h3>
                <button onClick={() => setNewMaterialModal(true)} className="px-3 py-1.5 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer">+ Adicionar Material</button>
              </div>
              <div className="space-y-2">
                {materials.map((m) => (
                  <div key={m.id} className="flex justify-between items-center p-3 rounded-xl bg-[#000000] border border-[#262522] text-xs">
                    <div><strong className="text-white">{m.type}: {m.name}</strong> ({m.color}) &bull; <span className="text-[#c89d66]">R$ {m.price_per_unit}/kg</span></div>
                    <button onClick={() => handleDeleteMaterial(m.id)} className="text-[#b94a48] hover:underline cursor-pointer">Excluir</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-[#e4e0d7] text-base">Impressoras Cadastradas ({printers.length})</h3>
                <button onClick={() => setNewPrinterModal(true)} className="px-3 py-1.5 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer">+ Adicionar Impressora</button>
              </div>
              <div className="space-y-2">
                {printers.map((p) => (
                  <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-[#000000] border border-[#262522] text-xs">
                    <div><strong className="text-white">{p.name}</strong> ({p.power_watts}W) &bull; Valor: R$ {p.printer_value} &bull; Vida Útil: {p.lifespan_hours}h</div>
                    <button onClick={() => handleDeletePrinter(p.id)} className="text-[#b94a48] hover:underline cursor-pointer">Excluir</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL MUDAR CATEGORIA EM LOTE */}
      {bulkCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3">
          <form onSubmit={handleConfirmBulkCategoryChange} className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-[#e4e0d7]">
              Mover {selectedModelIds.length} Modelo(s) de Categoria
            </h3>
            <p className="text-xs text-[#8c877e]">
              Os registros selecionados serão atualizados e seus respectivos arquivos ZIP serão movidos para a subpasta correspondente no Google Drive.
            </p>
            {renderCategorySelector(bulkTargetCategory, (val) => setBulkTargetCategory(val), 'bulk')}
            {uploading && (
              <div className="p-2.5 rounded-xl bg-[#141413] text-xs text-[#e4e0d7] flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{uploadStep || 'Movendo modelos...'}</span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" disabled={uploading} onClick={() => setBulkCategoryModalOpen(false)} className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs">
                Cancelar
              </button>
              <button type="submit" disabled={uploading} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer">
                Confirmar Mudança
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EXCLUIR EM LOTE */}
      {bulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3">
          <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-[#e4e0d7]">
              Excluir {selectedModelIds.length} modelo(s) selecionado(s)?
            </h3>
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#b94a48]/15 border border-[#b94a48]/30 text-xs text-[#e89b99] cursor-pointer">
              <input
                type="checkbox"
                checked={bulkDeleteAlsoDrive}
                onChange={(e) => setBulkDeleteAlsoDrive(e.target.checked)}
                className="mt-0.5 accent-[#b94a48]"
              />
              <span>Excluir também os arquivos ZIP correspondentes do Google Drive.</span>
            </label>
            {uploading && (
              <div className="p-2.5 rounded-xl bg-[#141413] text-xs text-[#e4e0d7] flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{uploadStep || 'Excluindo em lote...'}</span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" disabled={uploading} onClick={() => setBulkDeleteModalOpen(false)} className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs">
                Cancelar
              </button>
              <button type="button" disabled={uploading} onClick={handleConfirmBulkDelete} className="px-4 py-2 bg-[#b94a48] text-white rounded-xl text-xs font-bold cursor-pointer">
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA CRIAR E GERENCIAR LINKS COMPARTILHADOS */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-xl w-full p-6 space-y-5 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-[#e4e0d7] text-base flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-[#c89d66]" />
                  <span>Compartilhar Catálogo (Somente Visualização)</span>
                </h3>
                <p className="text-xs text-[#8c877e] mt-1">
                  A pessoa que receber o link verá <strong>apenas</strong> os modelos e fotos que corresponderem ao filtro abaixo, sem precisar logar.
                </p>
              </div>
              <button onClick={() => setShareModalOpen(false)} className="text-[#8c877e] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSharedLink} className="space-y-4 p-4 rounded-xl bg-[#000000] border border-[#262522]">
              <div>
                <label className="block text-xs font-medium text-[#a39e93] mb-1">Título da Vitrine</label>
                <input
                  type="text"
                  required
                  value={shareForm.title}
                  onChange={(e) => setShareForm({ ...shareForm, title: e.target.value })}
                  placeholder="Ex: Catálogo de Miniaturas RPG"
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Travar na Categoria:</label>
                  <select
                    value={shareForm.category_filter}
                    onChange={(e) => setShareForm({ ...shareForm, category_filter: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                  >
                    <option value="Todas">Todas as Categorias</option>
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Travar por Termo de Busca (Opcional):</label>
                  <input
                    type="text"
                    value={shareForm.search_filter}
                    onChange={(e) => setShareForm({ ...shareForm, search_filter: e.target.value })}
                    placeholder="Ex: dragao, suporte..."
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#a39e93] mb-1">Travar por Tags específicas (separadas por vírgula - Opcional):</label>
                <input
                  type="text"
                  value={shareForm.tags_input}
                  onChange={(e) => setShareForm({ ...shareForm, tags_input: e.target.value })}
                  placeholder="Ex: rpg, articulado"
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={creatingShareLink}
                  className="px-4 py-2 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Link2 className="w-4 h-4" />
                  <span>{creatingShareLink ? 'Gerando Link...' : 'Gerar e Copiar Link'}</span>
                </button>
              </div>
            </form>

            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-[#a39e93] uppercase tracking-wider">
                Links Compartilhados Criados ({sharedLinks.length})
              </h4>
              {sharedLinks.length === 0 ? (
                <p className="text-xs text-[#6e6a61] py-3 text-center">Nenhum link compartilhado gerado ainda.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {sharedLinks.map((link) => (
                    <div key={link.id} className="p-3 rounded-xl bg-[#000000] border border-[#262522] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5 truncate">
                        <strong className="text-[#e4e0d7] block truncate">{link.title}</strong>
                        <span className="text-[11px] text-[#8c877e]">
                          Categoria: <strong className="text-[#c89d66]">{link.category_filter}</strong>
                          {link.search_filter ? ` • Busca: "${link.search_filter}"` : ''}
                          {link.tags_filter?.length > 0 ? ` • Tags: ${link.tags_filter.join(', ')}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyShareUrlToClipboard(link.id)}
                          className="px-2.5 py-1.5 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copiar
                        </button>
                        <a
                          href={`/?share=${link.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 bg-[#141413] hover:bg-[#1f1e1c] text-[#c89d66] border border-[#262522] rounded-lg flex items-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Testar
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteSharedLink(link.id)}
                          className="p-1.5 bg-[#b94a48]/15 text-[#e89b99] border border-[#b94a48]/30 rounded-lg cursor-pointer"
                          title="Revogar Link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO MATERIAL */}
      {newMaterialModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3">
          <form onSubmit={handleSaveMaterial} className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-[#e4e0d7]">Cadastrar Novo Material</h3>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Tipo</label>
              <select value={matForm.type} onChange={(e) => setMatForm({ ...matForm, type: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]">
                <option value="Filamento">Filamento</option>
                <option value="Resina">Resina</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Nome / Marca</label>
              <input type="text" required value={matForm.name} onChange={(e) => setMatForm({ ...matForm, name: e.target.value })} placeholder="Ex: PLA Voolt3D" className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Cor</label>
              <input type="text" required value={matForm.color} onChange={(e) => setMatForm({ ...matForm, color: e.target.value })} placeholder="Ex: Preto" className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Preço por Kg / Litro (R$)</label>
              <input type="number" step="0.01" required value={matForm.price_per_unit} onChange={(e) => setMatForm({ ...matForm, price_per_unit: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setNewMaterialModal(false)} className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold">Salvar Material</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL NOVA IMPRESSORA */}
      {newPrinterModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3">
          <form onSubmit={handleSavePrinter} className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-[#e4e0d7]">Cadastrar Nova Impressora</h3>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Nome do Modelo</label>
              <input type="text" required value={printForm.name} onChange={(e) => setPrintForm({ ...printForm, name: e.target.value })} placeholder="Ex: Bambu Lab X1C" className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Consumo Energético (Watts)</label>
              <input type="number" required value={printForm.power_watts} onChange={(e) => setPrintForm({ ...printForm, power_watts: e.target.value })} placeholder="Ex: 350" className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Valor de Compra (R$)</label>
              <input type="number" required value={printForm.printer_value} onChange={(e) => setPrintForm({ ...printForm, printer_value: e.target.value })} placeholder="Ex: 5000" className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Vida Útil (Horas)</label>
              <input type="number" required value={printForm.lifespan_hours} onChange={(e) => setPrintForm({ ...printForm, lifespan_hours: e.target.value })} placeholder="Ex: 5000" className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setNewPrinterModal(false)} className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold">Salvar Impressora</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DETALHES DO PROPRIETÁRIO */}
      {selectedModel && (
        <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl my-auto">
            <div className="bg-[#000000] border-b border-[#1c1b19]">
              <div className="aspect-video relative flex items-center justify-center overflow-hidden">
                {getModelImagePaths(selectedModel).length > 0 && getSignedUrlForPath(getModelImagePaths(selectedModel)[activeImageIndex]) ? (
                  <>
                    <img
                      src={getSignedUrlForPath(getModelImagePaths(selectedModel)[activeImageIndex])}
                      alt={`${selectedModel.name} - Foto ${activeImageIndex + 1}`}
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(getSignedUrlForPath(getModelImagePaths(selectedModel)[activeImageIndex]))}
                      className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-[#000000]/85 text-[#e4e0d7] text-xs flex items-center gap-1.5 border border-[#e4e0d7]/30 cursor-pointer hover:bg-[#141413]"
                    >
                      <Eye className="w-4 h-4" /> Ampliar ({activeImageIndex + 1}/{getModelImagePaths(selectedModel).length})
                    </button>
                  </>
                ) : (
                  <div className="text-[#5e5a52] text-xs flex flex-col items-center gap-1">
                    <Box className="w-10 h-10" />
                    <span>Sem imagem</span>
                  </div>
                )}

                {getModelImagePaths(selectedModel).length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex((prev) => (prev - 1 + getModelImagePaths(selectedModel).length) % getModelImagePaths(selectedModel).length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-[#000000]/80 hover:bg-[#e4e0d7] text-[#e4e0d7] hover:text-[#000000] border border-[#262522] cursor-pointer transition"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex((prev) => (prev + 1) % getModelImagePaths(selectedModel).length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-[#000000]/80 hover:bg-[#e4e0d7] text-[#e4e0d7] hover:text-[#000000] border border-[#262522] cursor-pointer transition"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedModel(null)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-[#000000]/80 text-[#a39e93] hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {getModelImagePaths(selectedModel).length > 1 && (
                <div className="px-4 py-2.5 bg-[#050505] border-t border-[#141413] flex items-center gap-2 overflow-x-auto">
                  {getModelImagePaths(selectedModel).map((p, idx) => {
                    const thumbUrl = getSignedUrlForPath(p);
                    const isSelected = idx === activeImageIndex;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition cursor-pointer ${isSelected ? 'border-[#c89d66] scale-105' : 'border-[#262522] opacity-60 hover:opacity-100'
                          }`}
                      >
                        {thumbUrl ? (
                          <img src={thumbUrl} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#141413]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 space-y-4 max-h-[55vh] overflow-y-auto">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-md text-xs bg-[#e4e0d7]/15 text-[#e4e0d7]">{selectedModel.category}</span>
                    {driveStatusCheck[selectedModel.id] === 'missing' && (
                      <span className="px-2.5 py-1 rounded-md text-xs bg-[#b94a48] text-white font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Arquivo ZIP não encontrado no Google Drive
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-[#e4e0d7] mt-2">{selectedModel.name}</h2>
                </div>
                <span className="text-xs text-[#8c877e] shrink-0">{formatBytes(selectedModel.drive_file_size)}</span>
              </div>

              <p className="text-sm text-[#d5d0c5]">{selectedModel.description || 'Sem descrição.'}</p>

              {selectedModel.notes && (
                <div className="p-3 rounded-xl bg-[#000000] border border-[#262522] text-xs text-[#a39e93]">
                  <strong className="text-[#e4e0d7]">Observações:</strong> {selectedModel.notes}
                </div>
              )}

              <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-[#1c1b19]">
                <div className="flex flex-wrap gap-2">
                  <a href={selectedModel.drive_file_url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold inline-flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" /> Abrir ZIP no Drive
                  </a>
                  <button
                    type="button"
                    onClick={(e) => handleTogglePrintQueue(selectedModel, e)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${selectedModel.in_print_queue
                      ? 'bg-[#c89d66] text-[#000000] border-[#c89d66]'
                      : 'bg-[#141413] text-[#e4e0d7] border-[#262522]'
                      }`}
                  >
                    <ListOrdered className="w-4 h-4" />
                    <span>{selectedModel.in_print_queue ? 'Na Fila de Impressão' : '+ Fila de Impressão'}</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const existingPaths = getModelImagePaths(selectedModel);
                      setEditingModel({
                        ...selectedModel,
                        originalModel: selectedModel,
                        tagsInput: (selectedModel.tags || []).join(', '),
                        keptImagePaths: existingPaths,
                        newImageFiles: []
                      });
                    }}
                    className="px-3.5 py-2 bg-[#141413] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs cursor-pointer"
                  >
                    Editar / Galeria
                  </button>
                  <button onClick={() => { setDeleteConfirmModel(selectedModel); setDeleteAlsoFromDrive(false); }} className="px-3.5 py-2 bg-[#b94a48]/15 text-[#e89b99] border border-[#b94a48]/30 rounded-xl text-xs cursor-pointer">
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-3 cursor-zoom-out">
          <img src={lightboxUrl} alt="Ampliada" className="max-w-full max-h-full rounded-xl border border-[#262522]" />
        </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      {editingModel && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 overflow-y-auto">
          <form onSubmit={handleSaveEdit} className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-lg w-full p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center"><h3 className="font-bold text-[#e4e0d7]">Editar Cadastro e Galeria</h3><button type="button" onClick={() => setEditingModel(null)}><X className="w-5 h-5 text-[#8c877e]" /></button></div>
            <div><label className="block text-xs text-[#a39e93] mb-1">Nome</label><input type="text" required value={editingModel.name} onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" /></div>
            {renderCategorySelector(editingModel.category, (val) => setEditingModel({ ...editingModel, category: val }), 'edit')}
            <div><label className="block text-xs text-[#a39e93] mb-1">Descrição</label><textarea rows={2} value={editingModel.description} onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" /></div>
            <div><label className="block text-xs text-[#a39e93] mb-1">Tags (separadas por vírgula)</label><input type="text" value={editingModel.tagsInput} onChange={(e) => setEditingModel({ ...editingModel, tagsInput: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" /></div>
            <div><label className="block text-xs text-[#a39e93] mb-1">Observações de Impressão</label><input type="text" value={editingModel.notes || ''} onChange={(e) => setEditingModel({ ...editingModel, notes: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" /></div>

            {editingModel.keptImagePaths?.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#e4e0d7]">
                  Imagens Atuais ({editingModel.keptImagePaths.length}) — A primeira é a capa:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {editingModel.keptImagePaths.map((p, idx) => {
                    const url = getSignedUrlForPath(p);
                    return (
                      <div key={p} className="relative group aspect-video rounded-lg overflow-hidden border border-[#262522] bg-[#000000]">
                        {url && <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />}
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-[#000000]/80 text-[9px] font-bold text-[#c89d66]">
                            Capa
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingModel((prev) => ({
                            ...prev,
                            keptImagePaths: prev.keptImagePaths.filter((item) => item !== p)
                          }))}
                          className="absolute top-1 right-1 p-1 rounded-full bg-[#b94a48] text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-[#000000] border border-dashed border-[#383632] space-y-2">
              <label className="block text-xs font-semibold text-[#c89d66]">Adicionar Novas Imagens à Galeria</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setEditingModel((prev) => ({
                    ...prev,
                    newImageFiles: [...(prev.newImageFiles || []), ...files]
                  }));
                }}
                className="w-full text-xs text-[#a39e93] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#262522] file:text-[#e4e0d7]"
              />
              {editingModel.newImageFiles?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {editingModel.newImageFiles.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#141413] border border-[#262522] text-[10px] text-[#70a37f]">
                      <span className="truncate max-w-[120px]">+{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setEditingModel((prev) => ({
                          ...prev,
                          newImageFiles: prev.newImageFiles.filter((_, idx) => idx !== i)
                        }))}
                        className="text-[#d96b68] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {uploading && (
              <div className="p-2.5 rounded-xl bg-[#141413] text-xs text-[#e4e0d7] flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{uploadStep || 'Salvando alterações...'}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingModel(null)} className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs">Cancelar</button>
              <button type="submit" disabled={uploading} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {deleteConfirmModel && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3">
          <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-[#e4e0d7]">Excluir "{deleteConfirmModel.name}"?</h3>
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#b94a48]/15 border border-[#b94a48]/30 text-xs text-[#e89b99] cursor-pointer">
              <input type="checkbox" checked={deleteAlsoFromDrive} onChange={(e) => setDeleteAlsoFromDrive(e.target.checked)} className="mt-0.5 accent-[#b94a48]" />
              <span>Excluir também o arquivo ZIP do Google Drive.</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDeleteConfirmModel(null)} className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs">Cancelar</button>
              <button onClick={handleDeleteModel} disabled={uploading} className="px-4 py-2 bg-[#b94a48] text-white rounded-xl text-xs font-bold cursor-pointer">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO COMPLETO */}
      {importingFile && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 overflow-y-auto">
          <form onSubmit={handleConfirmImport} className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-xl w-full p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-[#e4e0d7] text-base">Cadastrar e Compactar de Aguardando</h3>
                <p className="text-[11px] text-[#8c877e]">
                  Compacta em .ZIP &rarr; Salva na Categoria &rarr; Move original para importações/Importadas
                </p>
              </div>
              <button type="button" onClick={() => setImportingFile(null)} disabled={uploading}>
                <X className="w-5 h-5 text-[#8c877e]" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#000000] border border-[#262522] text-xs text-[#a39e93] flex items-center gap-2">
              <Folder className="w-4 h-4 text-[#c89d66] shrink-0" />
              <span className="truncate">Selecionado em Aguardando: <strong className="text-[#e4e0d7]">{importingFile.name}</strong></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#a39e93] mb-1">Nome do Modelo *</label>
                <input
                  type="text"
                  required
                  value={importForm.name}
                  onChange={(e) => setImportForm({ ...importForm, name: e.target.value })}
                  placeholder="Ex: Dragão Articulado"
                  className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                />
              </div>
              {renderCategorySelector(importForm.category, (val) => setImportForm({ ...importForm, category: val }), 'import')}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#a39e93] mb-1">Descrição</label>
              <textarea
                rows={2}
                value={importForm.description}
                onChange={(e) => setImportForm({ ...importForm, description: e.target.value })}
                placeholder="Detalhes das peças, escala recomendada, suporte..."
                className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#a39e93] mb-1">Tags (separadas por vírgula)</label>
                <input
                  type="text"
                  value={importForm.tags}
                  onChange={(e) => setImportForm({ ...importForm, tags: e.target.value })}
                  placeholder="rpg, dragao, sem-suporte"
                  className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a39e93] mb-1">Observações de Impressão</label>
                <input
                  type="text"
                  value={importForm.notes}
                  onChange={(e) => setImportForm({ ...importForm, notes: e.target.value })}
                  placeholder="PLA 205°C, preenchimento 15%"
                  className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#000000] border border-dashed border-[#383632] space-y-2">
              <label className="block text-xs font-semibold text-[#c89d66]">Imagens de Referência (Pode selecionar várias fotos)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setImportForm((prev) => ({ ...prev, imageFiles: [...prev.imageFiles, ...files] }));
                }}
                className="w-full text-xs text-[#a39e93] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#262522] file:text-[#e4e0d7]"
              />
              {importForm.imageFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {importForm.imageFiles.map((img, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#141413] border border-[#262522] text-[10px] text-[#70a37f]">
                      <span className="truncate max-w-[130px]">{img.name}</span>
                      <button
                        type="button"
                        onClick={() => setImportForm((prev) => ({
                          ...prev,
                          imageFiles: prev.imageFiles.filter((_, idx) => idx !== i)
                        }))}
                        className="text-[#d96b68] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {uploading && (
              <div className="p-3 rounded-xl bg-[#141413] border border-[#e4e0d7]/30 flex items-center gap-3 text-xs text-[#e4e0d7]">
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>{uploadStep || 'Compactando e movendo pasta...'}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => setImportingFile(null)}
                className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-5 py-2 bg-[#e4e0d7] hover:bg-[#d5d0c5] disabled:opacity-50 text-[#000000] rounded-xl text-xs font-bold cursor-pointer"
              >
                {uploading ? 'Processando...' : 'Compactar ZIP, Salvar e Mover'}
              </button>
            </div>
          </form>
        </div>
      )}

      {folderPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3">
          <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex justify-between items-center"><h3 className="font-bold text-[#e4e0d7]">Pasta Raiz no Google Drive</h3><button onClick={() => setFolderPickerOpen(false)}><X className="w-5 h-5 text-[#8c877e]" /></button></div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#a39e93]">Criar nova pasta:</label>
              <div className="flex gap-2">
                <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="flex-1 px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                <button type="button" onClick={handleCreateRootFolder} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold">Criar e Vincular</button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#a39e93]">Ou selecione:</label>
              <div className="max-h-48 overflow-y-auto divide-y divide-[#1c1b19] bg-[#000000] border border-[#262522] rounded-xl">
                {driveFolders.map((f) => (
                  <div key={f.id} onClick={() => setPendingFolderSelection(f)} className={`p-3 flex justify-between text-xs cursor-pointer ${pendingFolderSelection?.id === f.id ? 'bg-[#e4e0d7]/15 text-[#e4e0d7]' : 'hover:bg-[#121211] text-[#a39e93]'}`}>
                    <span>{f.name}</span><code className="text-[10px] text-[#6e6a61]">{f.id}</code>
                  </div>
                ))}
              </div>
            </div>
            {pendingFolderSelection && (
              <div className="flex justify-end"><button type="button" onClick={() => saveRootFolderSetting(pendingFolderSelection.id, pendingFolderSelection.name)} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold">Confirmar "{pendingFolderSelection.name}"</button></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}