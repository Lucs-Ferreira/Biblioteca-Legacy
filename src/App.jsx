import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Box, Upload, FolderDown, Settings, Search, Plus, ExternalLink,
  Trash2, Edit3, Eye, CheckCircle2, AlertTriangle, Folder,
  HardDrive, ShieldCheck, RefreshCw, X, Check, FileArchive,
  LogOut, FolderPlus, Tag, Calculator, Menu
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly email profile';

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

function formatBytes(bytes = 0) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(isoString) {
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

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [googleToken, setGoogleToken] = useState(() => localStorage.getItem('stl_google_access_token') || '');
  const [googleUserEmail, setGoogleUserEmail] = useState(() => localStorage.getItem('stl_google_email') || '');
  const [googleConnected, setGoogleConnected] = useState(false);
  const tokenClientRef = useRef(null);
  const autoSyncedRef = useRef(false);

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
    labor_hourly_rate: 25.00
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
  const [signedUrls, setSignedUrls] = useState({});
  const [loadingData, setLoadingData] = useState(false);

  const [activeTab, setActiveTab] = useState('catalogo');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [toast, setToast] = useState(null);

  const [selectedModel, setSelectedModel] = useState(null);
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
    imageFile: null
  });
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [pendingRecovery, setPendingRecovery] = useState(null);

  const [driveZipFiles, setDriveZipFiles] = useState([]);
  const [loadingDriveZips, setLoadingDriveZips] = useState(false);
  const [importingFile, setImportingFile] = useState(null);
  const [importForm, setImportForm] = useState({
    name: '',
    description: '',
    category: 'Geral',
    tags: '',
    notes: '',
    imageFile: null
  });

  const [newMaterialModal, setNewMaterialModal] = useState(false);
  const [matForm, setMatForm] = useState({ type: 'Filamento', name: '', color: 'Preto', price_per_unit: 80 });

  const [newPrinterModal, setNewPrinterModal] = useState(false);
  const [printForm, setPrintForm] = useState({ name: '', power_watts: 150, printer_value: 2000, lifespan_hours: 5000 });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  };

  const allCategories = useMemo(() => {
    const custom = Array.isArray(settings.custom_categories) ? settings.custom_categories : [];
    const fromModels = models.map((m) => m.category).filter(Boolean);
    return Array.from(new Set([...BASE_CATEGORIES, ...custom, ...fromModels]));
  }, [settings.custom_categories, models]);

  const saveTokenData = (token, expiresInSec = 3500) => {
    const expiryTime = Date.now() + expiresInSec * 1000;
    setGoogleToken(token);
    setGoogleConnected(true);
    localStorage.setItem('stl_google_access_token', token);
    localStorage.setItem('stl_google_token_expiry', String(expiryTime));
  };

  const ensureValidGoogleToken = async () => {
    const storedToken = googleToken || localStorage.getItem('stl_google_access_token');
    const expiry = Number(localStorage.getItem('stl_google_token_expiry') || 0);

    if (storedToken && Date.now() < expiry - 120000) {
      return storedToken;
    }

    if (!window.google?.accounts?.oauth2 || !GOOGLE_CLIENT_ID) {
      throw new Error('Serviço de autenticação do Google não disponível.');
    }

    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        prompt: '',
        hint: googleUserEmail || localStorage.getItem('stl_google_email') || undefined,
        callback: (response) => {
          if (response.error) {
            setGoogleConnected(false);
            reject(new Error('Sua sessão do Google expirou. Conecte novamente.'));
            return;
          }
          saveTokenData(response.access_token, response.expires_in || 3500);
          resolve(response.access_token);
        }
      });
      client.requestAccessToken({ prompt: '' });
    });
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
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadUserData();
    }
  }, [session]);

  const loadUserData = async () => {
    if (!supabase || !session?.user) return;
    setLoadingData(true);
    try {
      const { data: cfg } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const localCachedCats = JSON.parse(localStorage.getItem(`stl_cats_${session.user.id}`) || '[]');

      if (cfg) {
        const dbCats = Array.isArray(cfg.custom_categories) ? cfg.custom_categories : [];
        const mergedCats = Array.from(new Set([...dbCats, ...localCachedCats]));

        const migrationDone = localStorage.getItem(`stl_subfolders_migrated_${session.user.id}`);
        let shouldUseSubfolders = cfg.organize_by_subfolders ?? true;
        if (!migrationDone) {
          shouldUseSubfolders = true;
          localStorage.setItem(`stl_subfolders_migrated_${session.user.id}`, 'true');
          await supabase
            .from('user_settings')
            .update({ organize_by_subfolders: true })
            .eq('user_id', session.user.id);
        }

        setSettings({
          root_folder_id: cfg.root_folder_id || '',
          root_folder_name: cfg.root_folder_name || '',
          organize_by_subfolders: shouldUseSubfolders,
          max_upload_size_mb: cfg.max_upload_size_mb || 150,
          custom_categories: mergedCats,
          energy_cost_kwh: cfg.energy_cost_kwh ?? 0.95,
          default_failure_rate: cfg.default_failure_rate ?? 5,
          default_post_processing_pct: cfg.default_post_processing_pct ?? 15,
          labor_hourly_rate: cfg.labor_hourly_rate ?? 25.00
        });

        setCalcForm((prev) => ({
          ...prev,
          failureRate: cfg.default_failure_rate ?? 5
        }));

        const cachedToken = localStorage.getItem('stl_google_access_token');
        const expiry = Number(localStorage.getItem('stl_google_token_expiry') || 0);
        if (cachedToken && Date.now() < expiry) {
          setGoogleToken(cachedToken);
          setGoogleConnected(true);
          fetchUserInfo(cachedToken);
        } else if (cfg.google_refresh_token) {
          setGoogleConnected(true);
        }
      } else if (localCachedCats.length > 0) {
        setSettings((prev) => ({ ...prev, custom_categories: localCachedCats, organize_by_subfolders: true }));
      }

      const { data: modelList } = await supabase
        .from('stl_models')
        .select('*')
        .order('created_at', { ascending: false });
      setModels(modelList || []);

      const { data: matList } = await supabase
        .from('stl_materials')
        .select('*')
        .order('name');
      setMaterials(matList || []);
      if (matList?.length > 0 && !calcForm.materialId) {
        setCalcForm((prev) => ({ ...prev, materialId: matList[0].id }));
      }

      const { data: printList } = await supabase
        .from('stl_printers')
        .select('*')
        .order('name');
      setPrinters(printList || []);
      if (printList?.length > 0 && !calcForm.printerId) {
        setCalcForm((prev) => ({ ...prev, printerId: printList[0].id }));
      }

      const urls = {};
      for (const m of (modelList || [])) {
        if (m.image_path) {
          const { data: signed } = await supabase
            .storage
            .from('stl-images')
            .createSignedUrl(m.image_path, 3600);
          if (signed?.signedUrl) {
            urls[m.id] = signed.signedUrl;
          }
        }
      }
      setSignedUrls(urls);
    } catch (err) {
      showToast(`Erro ao carregar dados: ${err.message}`, 'error');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (googleConnected && settings.root_folder_id && settings.organize_by_subfolders && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
      handleSyncAllCategorySubfolders(settings.root_folder_id, true);
    } else if (googleConnected && settings.root_folder_id) {
      fetchRootSubfolders(settings.root_folder_id);
    }
  }, [googleConnected, settings.root_folder_id, settings.organize_by_subfolders]);

  const fetchUserInfo = async (token) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const info = await res.json();
        if (info.email) {
          setGoogleUserEmail(info.email);
          localStorage.setItem('stl_google_email', info.email);
        }
      }
    } catch {
      // ignora
    }
  };

  const handleConnectGoogle = () => {
    if (!GOOGLE_CLIENT_ID) {
      showToast('VITE_GOOGLE_CLIENT_ID não configurado.', 'error');
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      showToast('Aguarde o carregamento do serviço Google...', 'error');
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: async (response) => {
        if (response.error) {
          showToast(`Erro na autorização Google: ${response.error}`, 'error');
          return;
        }

        const token = response.access_token;
        saveTokenData(token, response.expires_in || 3500);

        if (supabase && session?.user) {
          await supabase
            .from('user_settings')
            .upsert({
              user_id: session.user.id,
              google_refresh_token: 'connected',
              root_folder_id: settings.root_folder_id,
              root_folder_name: settings.root_folder_name,
              organize_by_subfolders: settings.organize_by_subfolders,
              max_upload_size_mb: settings.max_upload_size_mb,
              custom_categories: settings.custom_categories,
              updated_at: new Date().toISOString()
            });
        }

        await fetchUserInfo(token);
        showToast('Conta Google conectada com sucesso!');
        if (!settings.root_folder_id) {
          openFolderPicker();
        }
      }
    });

    tokenClientRef.current = tokenClient;
    tokenClient.requestAccessToken({ prompt: '' });
  };

  const handleDisconnectGoogle = async () => {
    setGoogleToken('');
    setGoogleUserEmail('');
    setGoogleConnected(false);
    localStorage.removeItem('stl_google_access_token');
    localStorage.removeItem('stl_google_token_expiry');
    localStorage.removeItem('stl_google_email');

    if (supabase && session?.user) {
      await supabase
        .from('user_settings')
        .upsert({
          user_id: session.user.id,
          google_refresh_token: null,
          updated_at: new Date().toISOString()
        });
    }
    showToast('Conta Google desconectada.');
  };

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

    const safeName = trimmedCategory.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = encodeURIComponent(
      `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and '${rootId}' in parents and trashed = false`
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
        name: trimmedCategory,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootId]
      })
    });

    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));
      throw new Error(
        errBody?.error?.message || `Não foi possível criar a subpasta "${trimmedCategory}" no Google Drive.`
      );
    }
    const created = await createRes.json();
    setExistingSubfolders((prev) => [...prev, created]);
    return created.id;
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

      await fetchRootSubfolders(rootId);
      if (!silent || createdCount > 0) {
        showToast(
          createdCount > 0
            ? `${createdCount} subpasta(s) de categoria criada(s) com sucesso!`
            : `Todas as subpastas de categorias estão montadas no Google Drive!`
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
        await fetchRootSubfolders(settings.root_folder_id);
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
    }

    setNewCategoryName('');
    setAddingCategoryContext(null);
    setSavingCategory(false);
    showToast(`Categoria "${trimmed}" salva e subpasta montada no Google Drive!`);
  };

  const handleRemoveCustomCategory = async (catToRemove) => {
    const updatedCustom = (settings.custom_categories || []).filter((c) => c !== catToRemove);
    setSettings((prev) => ({ ...prev, custom_categories: updatedCustom }));
    if (session?.user) {
      localStorage.setItem(`stl_cats_${session.user.id}`, JSON.stringify(updatedCustom));
    }
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
    showToast(`Categoria "${catToRemove}" removida da lista.`);
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

  const openFolderPicker = async () => {
    setFolderPickerOpen(true);
    setLoadingFolders(true);
    setPendingFolderSelection(null);
    try {
      const q = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and trashed = false");
      const res = await googleDriveFetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime)&pageSize=50`
      );
      if (!res.ok) throw new Error('Falha ao listar pastas do Google Drive.');
      const data = await res.json();
      setDriveFolders(data.files || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleCreateRootFolder = async () => {
    if (!newFolderName.trim()) return;
    setLoadingFolders(true);
    try {
      const res = await googleDriveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      if (!res.ok) throw new Error('Não foi possível criar a pasta no Google Drive.');
      const created = await res.json();
      await saveRootFolderSetting(created.id, created.name);
      setFolderPickerOpen(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingFolders(false);
    }
  };

  const saveRootFolderSetting = async (folderId, folderName) => {
    if (!supabase || !session?.user) return;
    const updated = {
      ...settings,
      root_folder_id: folderId,
      root_folder_name: folderName,
      organize_by_subfolders: true
    };
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: session.user.id,
        root_folder_id: folderId,
        root_folder_name: folderName,
        organize_by_subfolders: true,
        max_upload_size_mb: updated.max_upload_size_mb,
        updated_at: new Date().toISOString()
      });

    if (error) {
      showToast(`Erro ao salvar pasta raiz: ${error.message}`, 'error');
      return;
    }
    setSettings(updated);
    setPendingFolderSelection(null);
    setFolderPickerOpen(false);
    showToast(`Pasta raiz "${folderName}" vinculada! Montando subpastas...`);

    await handleSyncAllCategorySubfolders(folderId, false);
  };

  const handleSaveGeneralSettings = async (newPartial) => {
    const merged = { ...settings, ...newPartial };
    setSettings(merged);
    if (!supabase || !session?.user) return;
    await supabase
      .from('user_settings')
      .upsert({
        user_id: session.user.id,
        root_folder_id: merged.root_folder_id,
        root_folder_name: merged.root_folder_name,
        organize_by_subfolders: merged.organize_by_subfolders,
        max_upload_size_mb: merged.max_upload_size_mb,
        energy_cost_kwh: merged.energy_cost_kwh,
        default_failure_rate: merged.default_failure_rate,
        default_post_processing_pct: merged.default_post_processing_pct,
        labor_hourly_rate: merged.labor_hourly_rate,
        updated_at: new Date().toISOString()
      });
    showToast('Configurações atualizadas!');

    if (newPartial.organize_by_subfolders === true && merged.root_folder_id) {
      await handleSyncAllCategorySubfolders(merged.root_folder_id, false);
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
        name: '', description: '', category: 'Geral', tags: '', notes: '', zipFile: null, imageFile: null
      });
      setPendingRecovery(null);
      showToast(`Modelo enviado para o Drive e catalogado com sucesso!`);
      setActiveTab('catalogo');
      loadUserData();
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
    let imagePath = null;

    if (formValues.imageFile) {
      setUploadStep('Enviando imagem de referência ao bucket privado do Supabase...');
      const ext = formValues.imageFile.name.split('.').pop();
      const fileName = `${session.user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const { error: storageErr } = await supabase.storage
        .from('stl-images')
        .upload(fileName, formValues.imageFile, { upsert: false });

      if (storageErr) throw new Error(`Falha ao salvar imagem no Supabase: ${storageErr.message}`);
      imagePath = fileName;
    }

    setUploadStep('Salvando metadados no catálogo...');
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
      image_path: imagePath,
      drive_file_id: driveData.id,
      drive_file_name: driveData.name,
      drive_file_url: driveData.webViewLink || `https://drive.google.com/file/d/${driveData.id}/view`,
      drive_file_size: Number(driveData.size || formValues.zipFile?.size || 0),
      drive_folder_id: folderId
    });

    if (dbErr) throw new Error(`Falha ao salvar metadados: ${dbErr.message}`);
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
        name: '', description: '', category: 'Geral', tags: '', notes: '', zipFile: null, imageFile: null
      });
      showToast('Cadastro recuperado e concluído com sucesso!');
      setActiveTab('catalogo');
      loadUserData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  const fetchExistingDriveZips = async () => {
    if (!settings.root_folder_id) return;
    setLoadingDriveZips(true);
    try {
      const subFolders = await fetchRootSubfolders(settings.root_folder_id);

      const folderMap = { [settings.root_folder_id]: 'Pasta Raiz' };
      subFolders.forEach((sf) => {
        folderMap[sf.id] = sf.name;
      });

      const allParentIds = [settings.root_folder_id, ...subFolders.map((f) => f.id)];
      const parentsCondition = allParentIds.map((id) => `'${id}' in parents`).join(' or ');

      const zipsQ = encodeURIComponent(
        `(${parentsCondition}) and (mimeType = 'application/zip' or mimeType = 'application/x-zip-compressed' or name contains '.zip') and trashed = false`
      );
      const res = await googleDriveFetch(
        `https://www.googleapis.com/drive/v3/files?q=${zipsQ}&fields=files(id,name,size,createdTime,webViewLink,parents)&pageSize=100`
      );
      if (!res.ok) throw new Error('Erro ao listar arquivos ZIP do Google Drive.');
      const data = await res.json();

      const enrichedFiles = (data.files || []).map((file) => {
        const parentId = file.parents?.[0] || settings.root_folder_id;
        const folderLabel = folderMap[parentId] || 'Pasta Raiz';
        return {
          ...file,
          detectedFolderId: parentId,
          detectedCategory: folderLabel !== 'Pasta Raiz' ? folderLabel : 'Geral',
          folderLabel
        };
      });

      setDriveZipFiles(enrichedFiles);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingDriveZips(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'importar' && googleConnected && settings.root_folder_id) {
      fetchExistingDriveZips();
    }
  }, [activeTab, googleConnected, settings.root_folder_id]);

  const handleConfirmImport = async (e) => {
    e.preventDefault();
    if (!importingFile) return;

    if (models.some((m) => m.drive_file_id === importingFile.id)) {
      showToast('Este arquivo ZIP já está cadastrado.', 'error');
      return;
    }

    setUploading(true);
    try {
      const targetFolderId = importingFile.detectedFolderId || settings.root_folder_id;
      await completeDatabaseRegistration(importingFile, targetFolderId, importForm);
      showToast(`Arquivo "${importingFile.name}" importado!`);
      setImportingFile(null);
      loadUserData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  const verifyDriveFileAvailability = async (model) => {
    if (!googleConnected) return;
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
    if (googleConnected) {
      verifyDriveFileAvailability(model);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingModel) return;
    setUploading(true);
    try {
      let imagePath = editingModel.image_path;
      if (editingModel.newImageFile) {
        const ext = editingModel.newImageFile.name.split('.').pop();
        const fileName = `${session.user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        
        const { error: upErr } = await supabase.storage
          .from('stl-images')
          .upload(fileName, editingModel.newImageFile);
        if (upErr) throw upErr;

        if (editingModel.image_path) {
          await supabase.storage.from('stl-images').remove([editingModel.image_path]);
        }

        imagePath = fileName;
      }

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
          notes: editingModel.notes.trim(),
          image_path: imagePath,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingModel.id);

      if (error) throw error;
      showToast('Cadastro e imagem atualizados com sucesso!');
      setEditingModel(null);
      setSelectedModel(null);
      loadUserData();
    } catch (err) {
      showToast(`Erro ao atualizar: ${err.message}`, 'error');
    } finally {
      setUploading(false);
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
            throw new Error(
              errData?.error?.message ||
                'O escopo drive.file permite excluir pelo app apenas arquivos enviados pelo próprio app.'
            );
          }
        }
      }

      if (deleteConfirmModel.image_path) {
        await supabase.storage.from('stl-images').remove([deleteConfirmModel.image_path]);
      }

      const { error } = await supabase
        .from('stl_models')
        .delete()
        .eq('id', deleteConfirmModel.id);

      if (error) throw error;

      showToast(
        deleteAlsoFromDrive
          ? 'Excluído do catálogo e do Google Drive com sucesso!'
          : 'Removido do catálogo (arquivo ZIP preservado no Drive).'
      );
      setDeleteConfirmModel(null);
      setDeleteAlsoFromDrive(false);
      setSelectedModel(null);
      loadUserData();
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
      loadUserData();
    } catch (err) {
      showToast(`Erro: ${err.message}`, 'error');
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (!supabase) return;
    await supabase.from('stl_materials').delete().eq('id', id);
    showToast('Material excluído.');
    loadUserData();
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
      loadUserData();
    } catch (err) {
      showToast(`Erro: ${err.message}`, 'error');
    }
  };

  const handleDeletePrinter = async (id) => {
    if (!supabase) return;
    await supabase.from('stl_printers').delete().eq('id', id);
    showToast('Impressora excluída.');
    loadUserData();
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

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchesCat = selectedCategory === 'Todas' || m.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesQuery = !q || m.name?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q) || m.tags?.some((t) => t.toLowerCase().includes(q));
      return matchesCat && matchesQuery;
    });
  }, [models, selectedCategory, searchQuery]);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#e4e0d7] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#0a0a0a] border border-[#c89d66]/40 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-[#c89d66]">
            <AlertTriangle className="w-7 h-7 shrink-0" />
            <h1 className="text-xl font-bold">Configuração Pendente</h1>
          </div>
          <p className="text-sm text-[#a39e93]">Configure as variáveis do Supabase na Vercel.</p>
        </div>
      </div>
    );
  }

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
              <p className="text-[11px] text-[#8c877e] hidden md:block">Google Drive &bull; Subpastas por Categoria</p>
            </div>
          </div>

          {/* Navegação Desktop */}
          <nav className="hidden md:flex items-center gap-2">
            <button onClick={() => setActiveTab('catalogo')} className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer ${activeTab === 'catalogo' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#a39e93] hover:text-[#e4e0d7] hover:bg-[#121211]'}`}>
              <Box className="w-4 h-4" /><span>Catálogo ({models.length})</span>
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
              <Settings className="w-4 h-4" /><span>Configurações</span>
            </button>

            {/* BOTÃO DE LOGOFF NO HEADER DESKTOP */}
            <button
              onClick={() => supabase.auth.signOut()}
              className="ml-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 bg-[#b94a48]/15 text-[#e89b99] border border-[#b94a48]/30 hover:bg-[#b94a48]/25 transition cursor-pointer"
              title="Sair da Conta"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </nav>

          {/* Botão Hambúrguer Mobile */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-xl bg-[#0a0a0a] border border-[#262522] text-[#e4e0d7] cursor-pointer">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Menu Suspenso Mobile (Incluindo Logoff) */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0a0a0a] border-b border-[#262522] px-4 py-3 space-y-2">
            <button onClick={() => { setActiveTab('catalogo'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 ${activeTab === 'catalogo' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#e4e0d7]'}`}>
              <Box className="w-4 h-4" /><span>Catálogo ({models.length})</span>
            </button>
            <button onClick={() => { setActiveTab('upload'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 ${activeTab === 'upload' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#e4e0d7]'}`}>
              <Upload className="w-4 h-4" /><span>Enviar ZIP</span>
            </button>
            <button onClick={() => { setActiveTab('importar'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 ${activeTab === 'importar' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#e4e0d7]'}`}>
              <FolderDown className="w-4 h-4" /><span>Importar do Drive</span>
            </button>
            <button onClick={() => { setActiveTab('calculadora'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 ${activeTab === 'calculadora' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#e4e0d7]'}`}>
              <Calculator className="w-4 h-4" /><span>Calculadora de Gastos</span>
            </button>
            <button onClick={() => { setActiveTab('configuracoes'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 ${activeTab === 'configuracoes' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#e4e0d7]'}`}>
              <Settings className="w-4 h-4" /><span>Configurações</span>
            </button>

            {/* BOTÃO DE LOGOFF NO MENU MOBILE */}
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
              {!googleConnected ? <span>Conecte sua conta Google para gerenciar seus arquivos e pastas no Google Drive.</span> : <span>Selecione ou crie a pasta raiz <strong>Biblioteca STL</strong> no seu Google Drive.</span>}
            </div>
            <div className="self-end sm:self-auto">
              {!googleConnected ? (
                <button onClick={handleConnectGoogle} className="px-4 py-1.5 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] rounded-lg text-xs font-bold transition cursor-pointer">Conectar Conta Google</button>
              ) : (
                <button onClick={() => openFolderPicker()} className="px-4 py-1.5 bg-[#c89d66] hover:bg-[#b88c56] text-[#000000] rounded-lg text-xs font-bold transition cursor-pointer">Configurar Pasta Raiz</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8 flex-1">
        {activeTab === 'catalogo' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8c877e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar modelo por nome, descrição ou tag..." className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-[#262522] rounded-xl text-sm text-[#e4e0d7] placeholder-[#6e6a61] focus:outline-none focus:border-[#e4e0d7]" />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                {['Todas', ...allCategories].map((cat) => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${selectedCategory === cat ? 'bg-[#e4e0d7] text-[#000000]' : 'bg-[#0a0a0a] text-[#a39e93] hover:text-[#e4e0d7] border border-[#262522]'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {loadingData ? (
              <div className="py-20 text-center text-[#a39e93] flex flex-col items-center gap-3"><RefreshCw className="w-7 h-7 animate-spin text-[#e4e0d7]" /><span className="text-sm">Carregando seus modelos 3D...</span></div>
            ) : filteredModels.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-8 sm:p-12 text-center space-y-4">
                <FileArchive className="w-12 h-12 text-[#5e5a52] mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-[#e4e0d7]">Nenhum modelo STL encontrado</h3>
                  <p className="text-xs text-[#8c877e] max-w-md mx-auto">Envie um novo arquivo ZIP ou importe arquivos já existentes.</p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button onClick={() => setActiveTab('upload')} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold transition cursor-pointer">Enviar Novo ZIP</button>
                  <button onClick={() => setActiveTab('importar')} className="px-4 py-2 bg-[#141413] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold transition cursor-pointer">Importar do Drive</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {filteredModels.map((model) => {
                  const imgUrl = signedUrls[model.id];
                  return (
                    <div key={model.id} onClick={() => handleOpenDetails(model)} className="group bg-[#0a0a0a] border border-[#262522] hover:border-[#e4e0d7]/60 rounded-2xl overflow-hidden flex flex-col transition cursor-pointer shadow-lg">
                      <div className="aspect-video bg-[#000000] relative overflow-hidden flex items-center justify-center border-b border-[#1a1917]">
                        {imgUrl ? <img src={imgUrl} alt={model.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" /> : <div className="flex flex-col items-center gap-1 text-[#5e5a52]"><Box className="w-10 h-10" /><span className="text-[11px]">Sem imagem</span></div>}
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#000000]/85 backdrop-blur text-[#e4e0d7] border border-[#e4e0d7]/30">{model.category}</span>
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h3 className="font-bold text-[#e4e0d7] text-sm group-hover:text-white transition line-clamp-1">{model.name}</h3>
                          <p className="text-xs text-[#8c877e] line-clamp-2 mt-1">{model.description || 'Sem descrição.'}</p>
                        </div>
                        <div className="space-y-2 pt-2 border-t border-[#1c1b19]">
                          {model.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1">{model.tags.slice(0, 3).map((tag, idx) => <span key={idx} className="px-2 py-0.5 bg-[#141413] text-[#a39e93] border border-[#262522] rounded text-[10px]">#{tag}</span>)}</div>
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
            )}
          </div>
        )}

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
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Tags (vírgula)</label>
                  <input type="text" value={uploadForm.tags} onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })} placeholder="rpg, stl" className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Observações</label>
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
                  <label className="block text-xs font-semibold text-[#c89d66]">2. Imagem de Referência</label>
                  <input type="file" accept="image/*" onChange={(e) => setUploadForm({ ...uploadForm, imageFile: e.target.files?.[0] || null })} className="w-full text-xs text-[#a39e93] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#262522] file:text-[#e4e0d7]" />
                  {uploadForm.imageFile && <p className="text-[11px] text-[#70a37f] truncate">{uploadForm.imageFile.name}</p>}
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

        {activeTab === 'importar' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#e4e0d7]">Importar ZIPs Existentes</h2>
                <p className="text-xs text-[#8c877e] mt-0.5">Reconhece arquivos .ZIP na pasta raiz e subpastas.</p>
              </div>
              <button onClick={fetchExistingDriveZips} disabled={loadingDriveZips} className="px-4 py-2 bg-[#141413] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer">
                <RefreshCw className={`w-4 h-4 ${loadingDriveZips ? 'animate-spin' : ''}`} /><span>Atualizar Lista</span>
              </button>
            </div>
            {!settings.root_folder_id ? (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-8 text-center text-sm text-[#8c877e]">Conecte o Google e selecione a pasta raiz.</div>
            ) : loadingDriveZips ? (
              <div className="py-16 text-center text-[#a39e93] flex flex-col items-center gap-2"><RefreshCw className="w-6 h-6 animate-spin text-[#e4e0d7]" /><span className="text-xs">Buscando no Drive...</span></div>
            ) : driveZipFiles.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-8 text-center text-sm text-[#8c877e]">Nenhum arquivo .ZIP encontrado.</div>
            ) : (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-[#262522] text-xs text-[#8c877e] bg-[#000000]">
                      <th className="py-3.5 px-4">Arquivo ZIP</th>
                      <th className="py-3.5 px-4">Local</th>
                      <th className="py-3.5 px-4">Tamanho</th>
                      <th className="py-3.5 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c1b19]">
                    {driveZipFiles.map((df) => {
                      const alreadyRegistered = models.some((m) => m.drive_file_id === df.id);
                      return (
                        <tr key={df.id} className="hover:bg-[#121211]">
                          <td className="py-3.5 px-4 font-medium text-[#e4e0d7] flex items-center gap-2.5"><FileArchive className="w-4 h-4 text-[#c89d66] shrink-0" /><span className="truncate max-w-xs">{df.name}</span></td>
                          <td className="py-3.5 px-4 text-xs text-[#a39e93]"><span className="px-2 py-0.5 rounded bg-[#141413] border border-[#262522]">{df.folderLabel}</span></td>
                          <td className="py-3.5 px-4 text-xs text-[#8c877e]">{formatBytes(df.size)}</td>
                          <td className="py-3.5 px-4 text-right">
                            {alreadyRegistered ? (
                              <span className="text-xs text-[#70a37f]">Cadastrado</span>
                            ) : (
                              <button
                                onClick={() => {
                                  setImportingFile(df);
                                  setImportForm({
                                    name: df.name.replace(/\.zip$/i, ''),
                                    description: '',
                                    category: df.detectedCategory || 'Geral',
                                    tags: '',
                                    notes: '',
                                    imageFile: null
                                  });
                                }}
                                className="px-3.5 py-1.5 bg-[#e4e0d7] text-[#000000] rounded-lg text-xs font-bold cursor-pointer"
                              >
                                Importar
                              </button>
                            )}
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

        {/* CALCULADORA DE GASTOS */}
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

        {activeTab === 'configuracoes' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-6 h-6 text-[#e4e0d7] shrink-0" />
                  <div>
                    <h3 className="font-bold text-[#e4e0d7] text-base">Google Drive (Armazenamento Principal)</h3>
                    <p className="text-xs text-[#8c877e]">Renovação automática de sessão ativa</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${googleConnected ? 'bg-[#4d7c5b]/15 text-[#70a37f] border border-[#4d7c5b]/30' : 'bg-[#c89d66]/15 text-[#c89d66]'}`}>
                  {googleConnected ? 'Conectado Definitivo' : 'Desconectado'}
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
                <button onClick={handleConnectGoogle} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer">
                  {googleConnected ? 'Renovar Autorização Google' : 'Conectar Conta Google'}
                </button>
                {googleConnected && (
                  <>
                    <button onClick={() => openFolderPicker()} className="px-4 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold cursor-pointer">
                      Selecionar Outra Pasta Raiz
                    </button>
                    {settings.root_folder_id && (
                      <a href={`https://drive.google.com/drive/folders/${settings.root_folder_id}`} target="_blank" rel="noreferrer" className="px-4 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5">
                        <span>Abrir Pasta Raiz no Drive</span><ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={handleDisconnectGoogle} className="px-4 py-2 bg-[#b94a48]/15 text-[#e89b99] border border-[#b94a48]/30 rounded-xl text-xs font-semibold cursor-pointer">
                      Desconectar Google
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

      {/* MODAL DETALHES */}
      {selectedModel && (
        <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl my-auto">
            <div className="aspect-video bg-[#000000] relative flex items-center justify-center border-b border-[#1c1b19]">
              {signedUrls[selectedModel.id] ? <img src={signedUrls[selectedModel.id]} alt={selectedModel.name} className="w-full h-full object-contain" /> : <div className="text-[#5e5a52] text-xs">Sem imagem</div>}
              <button onClick={() => setSelectedModel(null)} className="absolute top-3 right-3 p-2 rounded-full bg-[#000000]/80 text-[#a39e93] cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="flex justify-between items-start">
                <div><span className="px-2.5 py-1 rounded-md text-xs bg-[#e4e0d7]/15 text-[#e4e0d7]">{selectedModel.category}</span><h2 className="text-lg font-bold text-[#e4e0d7] mt-2">{selectedModel.name}</h2></div>
                <span className="text-xs text-[#8c877e]">{formatBytes(selectedModel.drive_file_size)}</span>
              </div>
              <p className="text-sm text-[#d5d0c5]">{selectedModel.description || 'Sem descrição.'}</p>
              <div className="flex justify-between pt-2 border-t border-[#1c1b19]">
                <a href={selectedModel.drive_file_url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold inline-flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Abrir ZIP no Drive</a>
                <div className="flex gap-2">
                  <button onClick={() => setEditingModel({ ...selectedModel, tagsInput: (selectedModel.tags || []).join(', ') })} className="px-3.5 py-2 bg-[#141413] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs cursor-pointer">Editar</button>
                  <button onClick={() => { setDeleteConfirmModel(selectedModel); setDeleteAlsoFromDrive(false); }} className="px-3.5 py-2 bg-[#b94a48]/15 text-[#e89b99] border border-[#b94a48]/30 rounded-xl text-xs cursor-pointer">Excluir</button>
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

      {editingModel && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 overflow-y-auto">
          <form onSubmit={handleSaveEdit} className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-lg w-full p-6 space-y-4 my-auto">
            <div className="flex justify-between items-center"><h3 className="font-bold text-[#e4e0d7]">Editar Cadastro</h3><button type="button" onClick={() => setEditingModel(null)}><X className="w-5 h-5 text-[#8c877e]" /></button></div>
            <div><label className="block text-xs text-[#a39e93] mb-1">Nome</label><input type="text" required value={editingModel.name} onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" /></div>
            {renderCategorySelector(editingModel.category, (val) => setEditingModel({ ...editingModel, category: val }), 'edit')}
            <div><label className="block text-xs text-[#a39e93] mb-1">Descrição</label><textarea rows={2} value={editingModel.description} onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" /></div>
            <div><label className="block text-xs text-[#a39e93] mb-1">Tags</label><input type="text" value={editingModel.tagsInput} onChange={(e) => setEditingModel({ ...editingModel, tagsInput: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" /></div>
            <div>
              <label className="block text-xs font-semibold text-[#c89d66] mb-1">Alterar Imagem</label>
              <input type="file" accept="image/*" onChange={(e) => setEditingModel({ ...editingModel, newImageFile: e.target.files?.[0] || null })} className="w-full text-xs text-[#a39e93]" />
            </div>
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

      {importingFile && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 overflow-y-auto">
          <form onSubmit={handleConfirmImport} className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-lg w-full p-6 space-y-4 my-auto">
            <div className="flex justify-between items-center"><h3 className="font-bold text-[#e4e0d7]">Importar ZIP</h3><button type="button" onClick={() => setImportingFile(null)}><X className="w-5 h-5 text-[#8c877e]" /></button></div>
            <div><label className="block text-xs text-[#a39e93] mb-1">Nome</label><input type="text" required value={importForm.name} onChange={(e) => setImportForm({ ...importForm, name: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" /></div>
            {renderCategorySelector(importForm.category, (val) => setImportForm({ ...importForm, category: val }), 'import')}
            <div><label className="block text-xs text-[#a39e93] mb-1">Descrição</label><textarea rows={2} value={importForm.description} onChange={(e) => setImportForm({ ...importForm, description: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" /></div>
            <div>
              <label className="block text-xs font-semibold text-[#c89d66] mb-1">Imagem de Referência (Opcional)</label>
              <input type="file" accept="image/*" onChange={(e) => setImportForm({ ...importForm, imageFile: e.target.files?.[0] || null })} className="w-full text-xs text-[#a39e93]" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setImportingFile(null)} className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs">Cancelar</button>
              <button type="submit" disabled={uploading} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer">Importar</button>
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