import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Box, Upload, FolderDown, Settings, Search, Plus,
  CheckCircle2, AlertTriangle, HardDrive, RefreshCw, X, FileArchive,
  LogOut, Calculator, Menu, Filter, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Share2, Images, ListOrdered,
  CheckSquare, Square, ArrowUpDown, FileWarning
} from 'lucide-react';

import {
  GOOGLE_SCOPES,
  BASE_CATEGORIES,
  PRIORITY_WEIGHT,
  formatBytes,
  getModelImagePaths,
  loadJSZip
} from './utils/helpers';
import CatalogModals, { ImageCarouselModalHeader } from './components/CatalogModals';
import SecondaryTabs from './components/SecondaryTabs';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Função auxiliar para renderizar o logotipo do sistema de forma segura
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

  useEffect(() => {
    if (paginatedModels.length > 0) {
      ensureSignedUrlsForModels(paginatedModels);
    }
  }, [paginatedModels, ensureSignedUrlsForModels]);

  useEffect(() => {
    if (activeTab === 'fila' && queuedModels.length > 0) {
      ensureSignedUrlsForModels(queuedModels);
    }
  }, [activeTab, queuedModels, ensureSignedUrlsForModels]);

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#e4e0d7] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-[#e4e0d7]" />
      </div>
    );
  }

  // Função para conectar a conta Google de forma definitiva via Refresh Token
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

  // Função que abre o modal de compartilhamento com os filtros atuais da tela
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

  // Função que abre o modal de detalhes e verifica o status do arquivo no Drive
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

  const handleUploadNewModel = async (e) => {
    e.preventDefault();
    if (!settings.root_folder_id) {
      showToast('Configure a pasta raiz Biblioteca STL antes de enviar arquivos.', 'error');
      setFolderPickerOpen(true);
      return;
    }
    if (!uploadForm.zipFile) {
      showToast('SeIecione um arquivo .ZIP para enviar.', 'error');
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

        {/* ABAS SECUNDÁRIAS */}
        <SecondaryTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          queuedModels={queuedModels}
          getSignedUrlForPath={getSignedUrlForPath}
          handleOpenDetails={handleOpenDetails}
          handleChangeQueuePriority={handleChangeQueuePriority}
          handleTogglePrintQueue={handleTogglePrintQueue}
          pendingRecovery={pendingRecovery}
          handleRetryMetadataSave={handleRetryMetadataSave}
          uploading={uploading}
          uploadStep={uploadStep}
          handleUploadNewModel={handleUploadNewModel}
          uploadForm={uploadForm}
          setUploadForm={setUploadForm}
          renderCategorySelector={renderCategorySelector}
          importPipelineIds={importPipelineIds}
          fetchAwaitingImports={fetchAwaitingImports}
          loadingDriveZips={loadingDriveZips}
          settings={settings}
          awaitingItems={awaitingItems}
          setImportingFile={setImportingFile}
          setImportForm={setImportForm}
          setNewMaterialModal={setNewMaterialModal}
          setNewPrinterModal={setNewPrinterModal}
          calcForm={calcForm}
          setCalcForm={setCalcForm}
          printers={printers}
          materials={materials}
          calculationResults={calculationResults}
          googleConnected={googleConnected}
          googleUserEmail={googleUserEmail}
          handleConnectGoogle={handleConnectGoogle}
          openFolderPicker={openFolderPicker}
          syncingCategoryFolders={syncingCategoryFolders}
          handleSyncAllCategorySubfolders={handleSyncAllCategorySubfolders}
          handleDisconnectGoogle={handleDisconnectGoogle}
          handleSaveGeneralSettings={handleSaveGeneralSettings}
          handleDeleteMaterial={handleDeleteMaterial}
          handleDeletePrinter={handleDeletePrinter}
        />
      </main>

      {/* MODAIS */}
      <CatalogModals
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        activeImageIndex={activeImageIndex}
        setActiveImageIndex={setActiveImageIndex}
        getSignedUrlForPath={getSignedUrlForPath}
        setLightboxUrl={setLightboxUrl}
        lightboxUrl={lightboxUrl}
        driveStatusCheck={driveStatusCheck}
        handleTogglePrintQueue={handleTogglePrintQueue}
        setEditingModel={setEditingModel}
        editingModel={editingModel}
        handleSaveEdit={handleSaveEdit}
        renderCategorySelector={renderCategorySelector}
        uploading={uploading}
        uploadStep={uploadStep}
        deleteConfirmModel={deleteConfirmModel}
        setDeleteConfirmModel={setDeleteConfirmModel}
        deleteAlsoFromDrive={deleteAlsoFromDrive}
        setDeleteAlsoFromDrive={setDeleteAlsoFromDrive}
        handleDeleteModel={handleDeleteModel}
        importingFile={importingFile}
        setImportingFile={setImportingFile}
        importForm={importForm}
        setImportForm={setImportForm}
        handleConfirmImport={handleConfirmImport}
        folderPickerOpen={folderPickerOpen}
        setFolderPickerOpen={setFolderPickerOpen}
        newFolderName={newFolderName}
        setNewFolderName={newFolderName}
        handleCreateRootFolder={handleCreateRootFolder}
        driveFolders={driveFolders}
        pendingFolderSelection={pendingFolderSelection}
        setPendingFolderSelection={setPendingFolderSelection}
        saveRootFolderSetting={saveRootFolderSetting}
        bulkCategoryModalOpen={bulkCategoryModalOpen}
        setBulkCategoryModalOpen={setBulkCategoryModalOpen}
        selectedModelIds={selectedModelIds}
        bulkTargetCategory={bulkTargetCategory}
        setBulkTargetCategory={setBulkTargetCategory}
        handleConfirmBulkCategoryChange={handleConfirmBulkCategoryChange}
        bulkDeleteModalOpen={bulkDeleteModalOpen}
        setBulkDeleteModalOpen={setBulkDeleteModalOpen}
        bulkDeleteAlsoDrive={bulkDeleteAlsoDrive}
        setBulkDeleteAlsoDrive={setBulkDeleteAlsoDrive}
        handleConfirmBulkDelete={handleConfirmBulkDelete}
        shareModalOpen={shareModalOpen}
        setShareModalOpen={setShareModalOpen}
        shareForm={shareForm}
        setShareForm={setShareForm}
        allCategories={allCategories}
        handleCreateSharedLink={handleCreateSharedLink}
        creatingShareLink={creatingShareLink}
        sharedLinks={sharedLinks}
        copyShareUrlToClipboard={copyShareUrlToClipboard}
        handleDeleteSharedLink={handleDeleteSharedLink}
        newMaterialModal={newMaterialModal}
        setNewMaterialModal={setNewMaterialModal}
        matForm={matForm}
        setMatForm={setMatForm}
        handleSaveMaterial={handleSaveMaterial}
        newPrinterModal={newPrinterModal}
        setNewPrinterModal={setNewPrinterModal}
        printForm={printForm}
        setPrintForm={setPrintForm}
        handleSavePrinter={handleSavePrinter}
      />
    </div>
  );
}