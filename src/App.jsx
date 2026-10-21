import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Box, Upload, FolderDown, Settings, Search, Plus, ExternalLink,
  Trash2, Edit3, Eye, CheckCircle2, AlertTriangle, Folder,
  HardDrive, ShieldCheck, RefreshCw, X, Check, FileArchive,
  LogOut, FolderPlus, Tag
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

  const [settings, setSettings] = useState({
    root_folder_id: '',
    root_folder_name: '',
    organize_by_subfolders: true,
    max_upload_size_mb: 150,
    custom_categories: []
  });

  const [existingSubfolders, setExistingSubfolders] = useState([]);
  const [loadingSubfolders, setLoadingSubfolders] = useState(false);

  const [addingCategoryContext, setAddingCategoryContext] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [syncingCategoryFolders, setSyncingCategoryFolders] = useState(false);

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
          custom_categories: mergedCats
        });

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

      const { data: modelList, error: modelErr } = await supabase
        .from('stl_models')
        .select('*')
        .order('created_at', { ascending: false });

      if (modelErr) throw modelErr;
      setModels(modelList || []);

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
        } else if (settings.organize_by_subfolders) {
          handleSyncAllCategorySubfolders(settings.root_folder_id, false);
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
        throw new Error(errBody?.error?.message || `Erro ao enviar arquivo para o Google Drive.`);
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
      showToast(`Arquivo "${importingFile.name}" importado com sucesso!`);
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

  // ============================================================================
  // EDIÇÃO COM SUPORTE A ALTERAÇÃO DE IMAGEM DE REFERÊNCIA
  // ============================================================================
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingModel) return;
    setUploading(true);
    try {
      let imagePath = editingModel.image_path;

      // Se o usuário selecionou uma nova imagem para substituir a anterior:
      if (editingModel.newImageFile) {
        const ext = editingModel.newImageFile.name.split('.').pop();
        const fileName = `${session.user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from('stl-images')
          .upload(fileName, editingModel.newImageFile);
        if (upErr) throw upErr;

        // Se já existia uma imagem antiga, remove do bucket privado para não acumular lixo
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

  const renderLogo = (sizeClass = 'w-10 h-10') => (
    <div className={`${sizeClass} rounded-xl overflow-hidden bg-[#e4e0d7] flex items-center justify-center border border-[#262522] shrink-0`}>
      <img
        src="/logo.png"
        alt="Biblioteca STL Logo"
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
          onClick={() => {
            setAddingCategoryContext(addingCategoryContext === contextKey ? null : contextKey);
            setNewCategoryName('');
          }}
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
          {allCategories.map((c) => (
            <option key={c} value={c} className="bg-[#0a0a0a] text-[#e4e0d7]">{c}</option>
          ))}
        </select>
      )}
    </div>
  );

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchesCat = selectedCategory === 'Todas' || m.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        !q ||
        m.name?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.tags?.some((t) => t.toLowerCase().includes(q));
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

          {authError && (
            <div className="p-3 rounded-xl bg-[#b94a48]/15 border border-[#b94a48]/40 text-[#e89b99] text-xs">
              {authError}
            </div>
          )}

          <form onSubmit={handleSupabaseAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#a39e93] mb-1">Seu E-mail Pessoal</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#a39e93] mb-1">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] font-bold rounded-xl text-sm transition cursor-pointer"
            >
              {isSignUp ? 'Criar Conta Pessoal' : 'Entrar na Biblioteca'}
            </button>
          </form>

          <div className="text-center pt-3 border-t border-[#1c1b19]">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-[#a39e93] hover:text-[#e4e0d7] transition cursor-pointer"
            >
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
          {toast.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-[#d96b68] shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-[#70a37f] shrink-0" />
          )}
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

          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1">
            <button
              onClick={() => setActiveTab('catalogo')}
              className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${activeTab === 'catalogo' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#a39e93] hover:text-[#e4e0d7] hover:bg-[#121211]'
                }`}
            >
              <Box className="w-4 h-4" />
              <span>Catálogo ({models.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${activeTab === 'upload' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#a39e93] hover:text-[#e4e0d7] hover:bg-[#121211]'
                }`}
            >
              <Upload className="w-4 h-4" />
              <span>Enviar</span>
            </button>

            <button
              onClick={() => setActiveTab('importar')}
              className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${activeTab === 'importar' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#a39e93] hover:text-[#e4e0d7] hover:bg-[#121211]'
                }`}
            >
              <FolderDown className="w-4 h-4" />
              <span>Importar</span>
            </button>

            <button
              onClick={() => setActiveTab('configuracoes')}
              className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${activeTab === 'configuracoes' ? 'bg-[#e4e0d7] text-[#000000]' : 'text-[#a39e93] hover:text-[#e4e0d7] hover:bg-[#121211]'
                }`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden lg:inline">Configurações</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Banner Google Drive */}
      {(!googleConnected || !settings.root_folder_id) && (
        <div className="bg-[#12110f] border-b border-[#e4e0d7]/20">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#e4e0d7]">
              <HardDrive className="w-5 h-5 text-[#c89d66] shrink-0" />
              {!googleConnected ? (
                <span>Conecte sua conta Google para gerenciar seus arquivos e pastas por categoria no Google Drive.</span>
              ) : (
                <span>Selecione ou crie a pasta raiz <strong>Biblioteca STL</strong> no seu Google Drive.</span>
              )}
            </div>
            <div className="self-end sm:self-auto">
              {!googleConnected ? (
                <button
                  onClick={handleConnectGoogle}
                  className="px-4 py-1.5 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Conectar Conta Google
                </button>
              ) : (
                <button
                  onClick={() => openFolderPicker()}
                  className="px-4 py-1.5 bg-[#c89d66] hover:bg-[#b88c56] text-[#000000] rounded-lg text-xs font-bold transition cursor-pointer"
                >
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
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8c877e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar modelo por nome, descrição ou tag..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-[#262522] rounded-xl text-sm text-[#e4e0d7] placeholder-[#6e6a61] focus:outline-none focus:border-[#e4e0d7]"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                {['Todas', ...allCategories].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${selectedCategory === cat ? 'bg-[#e4e0d7] text-[#000000]' : 'bg-[#0a0a0a] text-[#a39e93] hover:text-[#e4e0d7] border border-[#262522]'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {loadingData ? (
              <div className="py-20 text-center text-[#a39e93] flex flex-col items-center gap-3">
                <RefreshCw className="w-7 h-7 animate-spin text-[#e4e0d7]" />
                <span className="text-sm">Carregando seus modelos 3D...</span>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-8 sm:p-12 text-center space-y-4">
                <FileArchive className="w-12 h-12 text-[#5e5a52] mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-[#e4e0d7]">Nenhum modelo STL encontrado</h3>
                  <p className="text-xs text-[#8c877e] max-w-md mx-auto">
                    Envie um novo arquivo ZIP (que será salvo automaticamente na subpasta da categoria no seu Google Drive) ou importe arquivos já existentes.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Enviar Novo ZIP
                  </button>
                  <button
                    onClick={() => setActiveTab('importar')}
                    className="px-4 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Importar do Drive
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {filteredModels.map((model) => {
                  const imgUrl = signedUrls[model.id];
                  return (
                    <div
                      key={model.id}
                      onClick={() => handleOpenDetails(model)}
                      className="group bg-[#0a0a0a] border border-[#262522] hover:border-[#e4e0d7]/60 rounded-2xl overflow-hidden flex flex-col transition cursor-pointer shadow-lg"
                    >
                      <div className="aspect-video bg-[#000000] relative overflow-hidden flex items-center justify-center border-b border-[#1a1917]">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={model.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-[#5e5a52]">
                            <Box className="w-10 h-10" />
                            <span className="text-[11px]">Sem imagem</span>
                          </div>
                        )}
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#000000]/85 backdrop-blur text-[#e4e0d7] border border-[#e4e0d7]/30">
                          {model.category}
                        </span>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h3 className="font-bold text-[#e4e0d7] text-sm group-hover:text-white transition line-clamp-1">
                            {model.name}
                          </h3>
                          <p className="text-xs text-[#8c877e] line-clamp-2 mt-1">
                            {model.description || 'Sem descrição.'}
                          </p>
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
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#e4e0d7]">Enviar Novo Modelo STL (.ZIP)</h2>
              <p className="text-xs text-[#8c877e] mt-1">
                {settings.organize_by_subfolders
                  ? `O arquivo ZIP será salvo dentro da subpasta "${uploadForm.category}" na sua pasta raiz "${settings.root_folder_name || 'Biblioteca STL'}".`
                  : `O arquivo ZIP será enviado diretamente para a pasta raiz "${settings.root_folder_name || 'Biblioteca STL'}".`}
              </p>
            </div>

            {pendingRecovery && (
              <div className="p-4 rounded-xl bg-[#c89d66]/10 border border-[#c89d66]/40 space-y-3">
                <div className="flex items-center gap-2 text-[#c89d66] text-sm font-semibold">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>Upload no Drive concluído, mas o salvamento falhou!</span>
                </div>
                <button
                  type="button"
                  onClick={handleRetryMetadataSave}
                  disabled={uploading}
                  className="w-full sm:w-auto px-4 py-2 bg-[#c89d66] text-[#000000] font-bold rounded-lg text-xs cursor-pointer"
                >
                  Recuperar e Concluir Cadastro
                </button>
              </div>
            )}

            <form onSubmit={handleUploadNewModel} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Nome do Modelo *</label>
                  <input
                    type="text"
                    required
                    value={uploadForm.name}
                    onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                    placeholder="Ex: Dragão Articulado"
                    className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                  />
                </div>
                {renderCategorySelector(uploadForm.category, (val) => setUploadForm({ ...uploadForm, category: val }), 'upload')}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#a39e93] mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Detalhes..."
                  className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Tags (separadas por vírgula)</label>
                  <input
                    type="text"
                    value={uploadForm.tags}
                    onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                    placeholder="rpg, dragao"
                    className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#a39e93] mb-1">Observações de Impressão</label>
                  <input
                    type="text"
                    value={uploadForm.notes}
                    onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                    placeholder="PLA 205°C"
                    className="w-full px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-[#000000] border border-dashed border-[#383632] space-y-2">
                  <label className="block text-xs font-semibold text-[#e4e0d7]">1. Arquivo ZIP (Google Drive) *</label>
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    required
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setUploadForm((prev) => ({
                        ...prev,
                        zipFile: file,
                        name: prev.name || (file ? file.name.replace(/\.zip$/i, '') : '')
                      }));
                    }}
                    className="w-full text-xs text-[#a39e93] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#e4e0d7] file:text-[#000000] file:font-semibold"
                  />
                  {uploadForm.zipFile && <p className="text-[11px] text-[#70a37f] truncate">{uploadForm.zipFile.name}</p>}
                </div>

                <div className="p-4 rounded-xl bg-[#000000] border border-dashed border-[#383632] space-y-2">
                  <label className="block text-xs font-semibold text-[#c89d66]">2. Imagem de Referência (Supabase)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadForm({ ...uploadForm, imageFile: e.target.files?.[0] || null })}
                    className="w-full text-xs text-[#a39e93] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#262522] file:text-[#e4e0d7]"
                  />
                  {uploadForm.imageFile && <p className="text-[11px] text-[#70a37f] truncate">{uploadForm.imageFile.name}</p>}
                </div>
              </div>

              {uploading && (
                <div className="p-3 rounded-xl bg-[#141413] border border-[#e4e0d7]/30 flex items-center gap-3 text-xs text-[#e4e0d7]">
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span>{uploadStep || 'Processando...'}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[#e4e0d7] hover:bg-[#d5d0c5] disabled:opacity-50 text-[#000000] font-bold rounded-xl text-sm transition cursor-pointer"
                >
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
                <h2 className="text-base sm:text-lg font-bold text-[#e4e0d7]">Importar ZIPs da Pasta Raiz e Subpastas</h2>
                <p className="text-xs text-[#8c877e] mt-0.5">
                  Reconhece arquivos .ZIP na pasta <strong className="text-[#e4e0d7]">{settings.root_folder_name || 'raiz'}</strong> e em todas as subpastas de categorias.
                </p>
              </div>
              <button
                onClick={fetchExistingDriveZips}
                disabled={loadingDriveZips}
                className="px-4 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingDriveZips ? 'animate-spin' : ''}`} />
                <span>Atualizar Lista</span>
              </button>
            </div>

            {!settings.root_folder_id ? (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-8 text-center text-sm text-[#8c877e]">
                Conecte o Google e selecione a pasta raiz.
              </div>
            ) : loadingDriveZips ? (
              <div className="py-16 text-center text-[#a39e93] flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#e4e0d7]" />
                <span className="text-xs">Consultando pasta raiz e subpastas de categorias no Google Drive...</span>
              </div>
            ) : driveZipFiles.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-8 text-center text-sm text-[#8c877e]">
                Nenhum arquivo .ZIP encontrado na pasta raiz ou subpastas.
              </div>
            ) : (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-[#262522] text-xs text-[#8c877e] bg-[#000000]">
                      <th className="py-3.5 px-4">Arquivo ZIP</th>
                      <th className="py-3.5 px-4">Local / Subpasta</th>
                      <th className="py-3.5 px-4">Tamanho</th>
                      <th className="py-3.5 px-4 text-right">Status / Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c1b19]">
                    {driveZipFiles.map((df) => {
                      const alreadyRegistered = models.some((m) => m.drive_file_id === df.id);
                      return (
                        <tr key={df.id} className="hover:bg-[#121211]">
                          <td className="py-3.5 px-4 font-medium text-[#e4e0d7] flex items-center gap-2.5">
                            <FileArchive className="w-4 h-4 text-[#c89d66] shrink-0" />
                            <span className="truncate max-w-[200px] sm:max-w-xs">{df.name}</span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[#a39e93]">
                            <span className="px-2 py-0.5 rounded bg-[#141413] border border-[#262522]">
                              {df.folderLabel}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[#8c877e]">{formatBytes(df.size)}</td>
                          <td className="py-3.5 px-4 text-right">
                            {alreadyRegistered ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-[#4d7c5b]/15 text-[#70a37f] border border-[#4d7c5b]/30">
                                <Check className="w-3.5 h-3.5" /> Cadastrado
                              </span>
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
                                className="px-3 py-1.5 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] rounded-lg text-xs font-bold transition cursor-pointer"
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
                <button
                  onClick={handleConnectGoogle}
                  className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer"
                >
                  {googleConnected ? 'Renovar Autorização Google' : 'Conectar Conta Google'}
                </button>
                {googleConnected && (
                  <>
                    <button
                      onClick={() => openFolderPicker()}
                      className="px-4 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Selecionar Outra Pasta Raiz
                    </button>
                    {settings.root_folder_id && (
                      <a
                        href={`https://drive.google.com/drive/folders/${settings.root_folder_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <span>Abrir Pasta Raiz no Drive</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={handleDisconnectGoogle}
                      className="px-4 py-2 bg-[#b94a48]/15 text-[#e89b99] border border-[#b94a48]/30 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Desconectar Google
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* PAINEL VISUAL DE SUBPASTAS NO GOOGLE DRIVE */}
            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[#e4e0d7] text-base">Subpastas por Categoria no Google Drive</h3>
                  <p className="text-xs text-[#8c877e]">
                    Pastas criadas automaticamente dentro de <strong>{settings.root_folder_name || 'sua pasta raiz'}</strong>
                  </p>
                </div>
                {settings.root_folder_id && (
                  <button
                    type="button"
                    disabled={syncingCategoryFolders}
                    onClick={() => handleSyncAllCategorySubfolders(settings.root_folder_id, false)}
                    className="px-4 py-2 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <FolderPlus className={`w-4 h-4 ${syncingCategoryFolders ? 'animate-spin' : ''}`} />
                    <span>{syncingCategoryFolders ? 'Montando Subpastas...' : 'Montar Todas as Subpastas Agora'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[#000000] border border-[#262522]">
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-[#e4e0d7]">Salvar novos ZIPs dentro das subpastas de categoria</p>
                  <p className="text-[11px] text-[#8c877e]">
                    Quando marcado, cada upload vai para a pasta da sua respectiva categoria.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.organize_by_subfolders}
                  onChange={(e) => handleSaveGeneralSettings({ organize_by_subfolders: e.target.checked })}
                  className="w-5 h-5 accent-[#e4e0d7] cursor-pointer shrink-0"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#8c877e]">
                  <span>Subpastas detectadas na pasta raiz ({existingSubfolders.length}):</span>
                  <button
                    type="button"
                    onClick={() => fetchRootSubfolders(settings.root_folder_id)}
                    className="text-[#e4e0d7] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingSubfolders ? 'animate-spin' : ''}`} /> Atualizar
                  </button>
                </div>

                {existingSubfolders.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#000000] border border-[#262522] text-xs text-[#8c877e] text-center">
                    Nenhuma subpasta montada ainda. Clique no botão <strong>"Montar Todas as Subpastas Agora"</strong> acima para criá-las no seu Google Drive!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {existingSubfolders.map((sf) => (
                      <a
                        key={sf.id}
                        href={`https://drive.google.com/drive/folders/${sf.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-xl bg-[#000000] hover:bg-[#141413] border border-[#262522] flex items-center justify-between text-xs transition"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Folder className="w-4 h-4 text-[#c89d66] shrink-0" />
                          <span className="text-[#e4e0d7] font-medium truncate">{sf.name}</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-[#8c877e] shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <Tag className="w-5 h-5 text-[#e4e0d7]" />
                <div>
                  <h3 className="font-bold text-[#e4e0d7] text-base">Categorias da Biblioteca</h3>
                  <p className="text-xs text-[#8c877e]">
                    Ao adicionar uma nova categoria, a subpasta correspondente também é criada dentro da pasta raiz no Drive.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {BASE_CATEGORIES.map((cat) => (
                  <span key={cat} className="px-2.5 py-1 rounded-lg text-xs bg-[#000000] text-[#a39e93] border border-[#262522]">
                    {cat}
                  </span>
                ))}
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-[#e4e0d7]">Personalizadas:</span>
                <div className="flex flex-wrap gap-2">
                  {(settings.custom_categories || []).map((cat) => (
                    <span key={cat} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-[#e4e0d7]/15 text-[#e4e0d7] border border-[#e4e0d7]/30">
                      <span>{cat}</span>
                      <button type="button" onClick={() => handleRemoveCustomCategory(cat)} className="cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <input
                  type="text"
                  value={addingCategoryContext === 'settings' ? newCategoryName : ''}
                  onFocus={() => setAddingCategoryContext('settings')}
                  onChange={(e) => {
                    setAddingCategoryContext('settings');
                    setNewCategoryName(e.target.value);
                  }}
                  placeholder="Nova categoria permanente..."
                  className="flex-1 px-3.5 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                />
                <button
                  type="button"
                  onClick={() => handleAddPermanentCategory('settings')}
                  className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer"
                >
                  Adicionar e Criar Pasta
                </button>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#70a37f] text-sm font-semibold">
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <span>Supabase Conectado</span>
                </div>
                <p className="text-xs text-[#8c877e]">Conta: <strong className="text-[#e4e0d7]">{session.user.email}</strong></p>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="px-4 py-2 bg-[#141413] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE DETALHES */}
      {selectedModel && (
        <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl my-auto">
            <div className="aspect-video bg-[#000000] relative flex items-center justify-center border-b border-[#1c1b19]">
              {signedUrls[selectedModel.id] ? (
                <>
                  <img src={signedUrls[selectedModel.id]} alt={selectedModel.name} className="w-full h-full object-contain" />
                  <button
                    onClick={() => setLightboxUrl(signedUrls[selectedModel.id])}
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-[#000000]/85 text-[#e4e0d7] text-xs flex items-center gap-1.5 border border-[#e4e0d7]/30 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" /> Ampliar
                  </button>
                </>
              ) : (
                <div className="text-[#5e5a52] text-xs">Sem imagem</div>
              )}
              <button onClick={() => setSelectedModel(null)} className="absolute top-3 right-3 p-2 rounded-full bg-[#000000]/80 text-[#a39e93] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="flex justify-between items-start">
                <div>
                  <span className="px-2.5 py-1 rounded-md text-xs bg-[#e4e0d7]/15 text-[#e4e0d7]">{selectedModel.category}</span>
                  <h2 className="text-lg font-bold text-[#e4e0d7] mt-2">{selectedModel.name}</h2>
                </div>
                <span className="text-xs text-[#8c877e]">{formatBytes(selectedModel.drive_file_size)}</span>
              </div>
              <p className="text-sm text-[#d5d0c5]">{selectedModel.description || 'Sem descrição.'}</p>
              <div className="flex justify-between pt-2 border-t border-[#1c1b19]">
                <a
                  href={selectedModel.drive_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> Abrir ZIP no Drive
                </a>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingModel({ ...selectedModel, tagsInput: (selectedModel.tags || []).join(', ') })}
                    className="px-3.5 py-2 bg-[#141413] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => { setDeleteConfirmModel(selectedModel); setDeleteAlsoFromDrive(false); }}
                    className="px-3.5 py-2 bg-[#b94a48]/15 text-[#e89b99] border border-[#b94a48]/30 rounded-xl text-xs cursor-pointer"
                  >
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

      {/* MODAL DE EDIÇÃO (COM TROCA DE IMAGEM) */}
      {editingModel && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 overflow-y-auto">
          <form onSubmit={handleSaveEdit} className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-lg w-full p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-[#e4e0d7]">Editar Cadastro e Imagem</h3>
              <button type="button" onClick={() => setEditingModel(null)}><X className="w-5 h-5 text-[#8c877e]" /></button>
            </div>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Nome</label>
              <input type="text" required value={editingModel.name} onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            {renderCategorySelector(editingModel.category, (val) => setEditingModel({ ...editingModel, category: val }), 'edit')}
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Descrição</label>
              <textarea rows={2} value={editingModel.description} onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Tags (separadas por vírgula)</label>
              <input type="text" value={editingModel.tagsInput} onChange={(e) => setEditingModel({ ...editingModel, tagsInput: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Observações</label>
              <input type="text" value={editingModel.notes} onChange={(e) => setEditingModel({ ...editingModel, notes: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#c89d66] mb-1">Alterar Imagem de Referência (Opcional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setEditingModel({ ...editingModel, newImageFile: e.target.files?.[0] || null })}
                className="w-full text-xs text-[#a39e93] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#262522] file:text-[#e4e0d7]"
              />
              {editingModel.newImageFile && <p className="text-[11px] text-[#70a37f] mt-1">Nova imagem: {editingModel.newImageFile.name}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingModel(null)} className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs">Cancelar</button>
              <button type="submit" disabled={uploading} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer">
                {uploading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
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
              <span>Excluir também o arquivo ZIP permanentemente do Google Drive.</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDeleteConfirmModel(null)} className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs">Cancelar</button>
              <button onClick={handleDeleteModel} disabled={uploading} className="px-4 py-2 bg-[#b94a48] text-white rounded-xl text-xs font-bold cursor-pointer">
                {uploading ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO (COM SUPORTE A IMAGEM DE REFERÊNCIA) */}
      {importingFile && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 overflow-y-auto">
          <form onSubmit={handleConfirmImport} className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-lg w-full p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-[#e4e0d7]">Importar ZIP do Drive</h3>
              <button type="button" onClick={() => setImportingFile(null)}><X className="w-5 h-5 text-[#8c877e]" /></button>
            </div>
            <div className="p-2.5 rounded-xl bg-[#000000] border border-[#262522] text-xs text-[#a39e93] truncate">
              Arquivo: <strong className="text-[#e4e0d7]">{importingFile.name}</strong>
            </div>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Nome do Modelo</label>
              <input type="text" required value={importForm.name} onChange={(e) => setImportForm({ ...importForm, name: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            {renderCategorySelector(importForm.category, (val) => setImportForm({ ...importForm, category: val }), 'import')}
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Descrição</label>
              <textarea rows={2} value={importForm.description} onChange={(e) => setImportForm({ ...importForm, description: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Tags (separadas por vírgula)</label>
              <input type="text" value={importForm.tags} onChange={(e) => setImportForm({ ...importForm, tags: e.target.value })} placeholder="rpg, stl" className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#c89d66] mb-1">Imagem de Referência (Opcional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImportForm({ ...importForm, imageFile: e.target.files?.[0] || null })}
                className="w-full text-xs text-[#a39e93] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#262522] file:text-[#e4e0d7]"
              />
              {importForm.imageFile && <p className="text-[11px] text-[#70a37f] mt-1">Selecionada: {importForm.imageFile.name}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setImportingFile(null)} className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs">Cancelar</button>
              <button type="submit" disabled={uploading} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer">
                {uploading ? 'Importando...' : 'Confirmar Importação'}
              </button>
            </div>
          </form>
        </div>
      )}

      {folderPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3">
          <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-[#e4e0d7]">Configurar Pasta Raiz no Google Drive</h3>
              <button onClick={() => setFolderPickerOpen(false)}><X className="w-5 h-5 text-[#8c877e]" /></button>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#a39e93]">Criar nova pasta:</label>
              <div className="flex gap-2">
                <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="flex-1 px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
                <button type="button" onClick={handleCreateRootFolder} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold">Criar e Vincular</button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#a39e93]">Ou selecione uma pasta existente:</label>
              <div className="max-h-48 overflow-y-auto divide-y divide-[#1c1b19] bg-[#000000] border border-[#262522] rounded-xl">
                {driveFolders.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setPendingFolderSelection(f)}
                    className={`p-3 flex justify-between text-xs cursor-pointer ${pendingFolderSelection?.id === f.id ? 'bg-[#e4e0d7]/15 text-[#e4e0d7]' : 'hover:bg-[#121211] text-[#a39e93]'}`}
                  >
                    <span>{f.name}</span>
                    <code className="text-[10px] text-[#6e6a61]">{f.id}</code>
                  </div>
                ))}
              </div>
            </div>
            {pendingFolderSelection && (
              <div className="flex justify-end">
                <button type="button" onClick={() => saveRootFolderSetting(pendingFolderSelection.id, pendingFolderSelection.name)} className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold">
                  Confirmar "{pendingFolderSelection.name}"
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}