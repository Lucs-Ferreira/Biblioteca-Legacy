import React, { useState, useEffect, useMemo } from 'react';
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

  const [googleToken, setGoogleToken] = useState('');
  const [googleUserEmail, setGoogleUserEmail] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);

  const [settings, setSettings] = useState({
    root_folder_id: '',
    root_folder_name: '',
    organize_by_subfolders: false,
    max_upload_size_mb: 150,
    custom_categories: [],
    google_refresh_token: ''
  });

  const [addingCategoryContext, setAddingCategoryContext] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

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
    setTimeout(() => setToast(null), 5000);
  };

  const allCategories = useMemo(() => {
    const custom = Array.isArray(settings.custom_categories) ? settings.custom_categories : [];
    const fromModels = models.map((m) => m.category).filter(Boolean);
    return Array.from(new Set([...BASE_CATEGORIES, ...custom, ...fromModels]));
  }, [settings.custom_categories, models]);

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

        setSettings({
          root_folder_id: cfg.root_folder_id || '',
          root_folder_name: cfg.root_folder_name || '',
          organize_by_subfolders: cfg.organize_by_subfolders || false,
          max_upload_size_mb: cfg.max_upload_size_mb || 150,
          custom_categories: mergedCats,
          google_refresh_token: cfg.google_refresh_token || ''
        });

        if (cfg.google_refresh_token || localStorage.getItem('stl_permanent_google_token')) {
          setGoogleConnected(true);
          const cachedToken = localStorage.getItem('stl_permanent_google_token');
          if (cachedToken) {
            setGoogleToken(cachedToken);
            fetchUserInfo(cachedToken);
          }
        }
      } else if (localCachedCats.length > 0) {
        setSettings((prev) => ({ ...prev, custom_categories: localCachedCats }));
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

  const fetchUserInfo = async (token) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const info = await res.json();
      if (info.email) setGoogleUserEmail(info.email);
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
        setGoogleToken(token);
        setGoogleConnected(true);
        localStorage.setItem('stl_permanent_google_token', token);

        if (supabase && session?.user) {
          await supabase
            .from('user_settings')
            .upsert({
              user_id: session.user.id,
              google_refresh_token: 'active_session_token',
              root_folder_id: settings.root_folder_id,
              root_folder_name: settings.root_folder_name,
              organize_by_subfolders: settings.organize_by_subfolders,
              max_upload_size_mb: settings.max_upload_size_mb,
              custom_categories: settings.custom_categories,
              updated_at: new Date().toISOString()
            });
        }

        await fetchUserInfo(token);
        showToast('Conta Google conectada permanentemente!');
        if (!settings.root_folder_id) {
          openFolderPicker(token);
        }
      }
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  const handleDisconnectGoogle = async () => {
    setGoogleToken('');
    setGoogleUserEmail('');
    setGoogleConnected(false);
    localStorage.removeItem('stl_permanent_google_token');

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
    showToast(`Categoria "${trimmed}" adicionada permanentemente!`);
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
    showToast(`Categoria "${catToRemove}" removida.`);
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

  const openFolderPicker = async (tokenOverride) => {
    const activeToken = tokenOverride || googleToken || localStorage.getItem('stl_permanent_google_token');
    if (!activeToken) {
      showToast('Conecte sua conta Google primeiro.', 'error');
      return;
    }
    setFolderPickerOpen(true);
    setLoadingFolders(true);
    setPendingFolderSelection(null);
    try {
      const q = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and trashed = false");
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime)&pageSize=50`,
        { headers: { Authorization: `Bearer ${activeToken}` } }
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
    const activeToken = googleToken || localStorage.getItem('stl_permanent_google_token');
    if (!activeToken || !newFolderName.trim()) return;
    setLoadingFolders(true);
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
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
      root_folder_name: folderName
    };
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: session.user.id,
        root_folder_id: folderId,
        root_folder_name: folderName,
        organize_by_subfolders: updated.organize_by_subfolders,
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
    showToast(`Pasta raiz vinculada: ${folderName} (ID: ${folderId})`);
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
  };

  const getOrCreateCategorySubfolder = async (categoryName) => {
    const activeToken = googleToken || localStorage.getItem('stl_permanent_google_token');
    if (!settings.organize_by_subfolders || !categoryName) {
      return settings.root_folder_id;
    }
    const safeName = categoryName.replace(/'/g, "\\'");
    const q = encodeURIComponent(
      `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and '${settings.root_folder_id}' in parents and trashed = false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${activeToken}` } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files?.length > 0) {
        return searchData.files[0].id;
      }
    }
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: categoryName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [settings.root_folder_id]
      })
    });
    if (!createRes.ok) return settings.root_folder_id;
    const created = await createRes.json();
    return created.id;
  };

  const handleUploadNewModel = async (e) => {
    e.preventDefault();
    const activeToken = googleToken || localStorage.getItem('stl_permanent_google_token');
    if (!activeToken) {
      showToast('Conecte sua conta Google antes de enviar arquivos.', 'error');
      return;
    }
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

    try {
      setUploadStep('Verificando pasta de destino no Google Drive...');
      const targetFolderId = await getOrCreateCategorySubfolder(uploadForm.category);

      setUploadStep('Enviando arquivo ZIP diretamente para o Google Drive...');
      const metadata = {
        name: uploadForm.zipFile.name,
        parents: [targetFolderId],
        mimeType: 'application/zip'
      };

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', uploadForm.zipFile);

      const driveRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${activeToken}` },
          body: formData
        }
      );

      if (!driveRes.ok) throw new Error('Falha no upload para o Google Drive.');
      uploadedDriveData = await driveRes.json();

      await completeDatabaseRegistration(uploadedDriveData, targetFolderId, uploadForm);

      setUploadForm({
        name: '', description: '', category: 'Geral', tags: '', notes: '', zipFile: null, imageFile: null
      });
      setPendingRecovery(null);
      showToast('Modelo enviado para o Drive e catalogado com sucesso!');
      setActiveTab('catalogo');
      loadUserData();
    } catch (err) {
      if (uploadedDriveData?.id) {
        setPendingRecovery({
          driveData: uploadedDriveData,
          folderId: settings.root_folder_id,
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
    const activeToken = googleToken || localStorage.getItem('stl_permanent_google_token');
    if (!activeToken || !settings.root_folder_id) return;
    setLoadingDriveZips(true);
    try {
      const q = encodeURIComponent(
        `'${settings.root_folder_id}' in parents and (mimeType = 'application/zip' or mimeType = 'application/x-zip-compressed' or name contains '.zip') and trashed = false`
      );
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,createdTime,webViewLink)&pageSize=100`,
        { headers: { Authorization: `Bearer ${activeToken}` } }
      );
      if (!res.ok) throw new Error('Erro ao listar arquivos ZIP.');
      const data = await res.json();
      setDriveZipFiles(data.files || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingDriveZips(false);
    }
  };

  useEffect(() => {
    const activeToken = googleToken || localStorage.getItem('stl_permanent_google_token');
    if (activeTab === 'importar' && activeToken && settings.root_folder_id) {
      fetchExistingDriveZips();
    }
  }, [activeTab, googleToken, settings.root_folder_id]);

  const handleConfirmImport = async (e) => {
    e.preventDefault();
    if (!importingFile) return;

    if (models.some((m) => m.drive_file_id === importingFile.id)) {
      showToast('Este arquivo ZIP já está cadastrado.', 'error');
      return;
    }

    setUploading(true);
    try {
      await completeDatabaseRegistration(importingFile, settings.root_folder_id, importForm);
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
    const activeToken = googleToken || localStorage.getItem('stl_permanent_google_token');
    if (!activeToken) return;
    setDriveStatusCheck((prev) => ({ ...prev, [model.id]: 'checking' }));
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${model.drive_file_id}?fields=id,name,trashed`,
        { headers: { Authorization: `Bearer ${activeToken}` } }
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
    const activeToken = googleToken || localStorage.getItem('stl_permanent_google_token');
    if (activeToken) {
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
        const fileName = `${session.user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('stl-images')
          .upload(fileName, editingModel.newImageFile);
        if (upErr) throw upErr;
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
      showToast('Cadastro atualizado com sucesso!');
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
        const activeToken = googleToken || localStorage.getItem('stl_permanent_google_token');
        if (!activeToken) {
          throw new Error('Conecte sua conta Google para excluir o arquivo.');
        }
        const driveDel = await fetch(
          `https://www.googleapis.com/drive/v3/files/${deleteConfirmModel.drive_file_id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${activeToken}` }
          }
        );
        if (!driveDel.ok && driveDel.status !== 404) {
          throw new Error('Não foi possível excluir o arquivo no Google Drive.');
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

      showToast(deleteAlsoFromDrive ? 'Excluído do catálogo e do Drive.' : 'Removido do catálogo (ZIP preservado).');
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

  const renderCategorySelector = (currentValue, onSelectChange, contextKey) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-medium text-[#a39e93]">Categoria</label>
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
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#e4e0d7] flex items-center justify-center border border-[#262522]">
              <img
                src="/logo.png"
                alt="Biblioteca STL Logo"
                className="w-full h-full object-cover"
              />
            </div>
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
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#e4e0d7] flex items-center justify-center border border-[#262522]">
              <img
                src="/logo.png"
                alt="Biblioteca STL Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg text-[#e4e0d7] leading-tight tracking-tight">Biblioteca STL</h1>
              <p className="text-[11px] text-[#8c877e] hidden md:block">Google Drive &bull; Catálogo Pessoal</p>
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
                <span>Conecte sua conta Google para gerenciar seus arquivos no Google Drive de forma definitiva.</span>
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
                    Envie um novo arquivo ZIP diretamente para sua pasta raiz do Google Drive ou importe arquivos já existentes.
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
              <p className="text-xs text-[#8c877e] mt-1">O arquivo ZIP será enviado diretamente para sua pasta raiz no Google Drive.</p>
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
                <h2 className="text-base sm:text-lg font-bold text-[#e4e0d7]">Importar ZIPs Existentes</h2>
                <p className="text-xs text-[#8c877e] mt-0.5">Lista arquivos na pasta <strong className="text-[#e4e0d7]">{settings.root_folder_name || 'raiz'}</strong> sem duplicá-los.</p>
              </div>
              <button
                onClick={fetchExistingDriveZips}
                disabled={loadingDriveZips || !googleConnected}
                className="px-4 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#e4e0d7] border border-[#262522] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingDriveZips ? 'animate-spin' : ''}`} />
                <span>Atualizar Lista</span>
              </button>
            </div>

            {!googleConnected || !settings.root_folder_id ? (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-8 text-center text-sm text-[#8c877e]">
                Conecte o Google e selecione a pasta raiz.
              </div>
            ) : loadingDriveZips ? (
              <div className="py-16 text-center text-[#a39e93] flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#e4e0d7]" />
                <span className="text-xs">Consultando Google Drive...</span>
              </div>
            ) : driveZipFiles.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-8 text-center text-sm text-[#8c877e]">
                Nenhum arquivo .ZIP encontrado na pasta raiz.
              </div>
            ) : (
              <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[#262522] text-xs text-[#8c877e] bg-[#000000]">
                      <th className="py-3.5 px-4">Arquivo ZIP</th>
                      <th className="py-3.5 px-4">Tamanho</th>
                      <th className="py-3.5 px-4">ID no Drive</th>
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
                          <td className="py-3.5 px-4 text-xs text-[#8c877e]">{formatBytes(df.size)}</td>
                          <td className="py-3.5 px-4 text-xs font-mono text-[#6e6a61]">{df.id}</td>
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
                                    category: 'Geral',
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
                    <p className="text-xs text-[#8c877e]">Sessão persistente ativa</p>
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
                  <span className="text-[#8c877e]">ID da Pasta:</span>
                  <span className="font-mono text-[#c89d66] break-all">{settings.root_folder_id || '—'}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {!googleConnected ? (
                  <button
                    onClick={handleConnectGoogle}
                    className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Conectar Conta Google
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => openFolderPicker()}
                      className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Selecionar Outra Pasta Raiz
                    </button>
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

            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <Tag className="w-5 h-5 text-[#e4e0d7]" />
                <div>
                  <h3 className="font-bold text-[#e4e0d7] text-base">Categorias da Biblioteca</h3>
                  <p className="text-xs text-[#8c877e]">Categorias base + personalizadas permanentes.</p>
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
                  Adicionar
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

      {/* Modais */}
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

      {editingModel && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3">
          <form onSubmit={handleSaveEdit} className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-[#e4e0d7]">Editar Cadastro</h3>
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
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingModel(null)} className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold">Salvar</button>
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
              <button onClick={handleDeleteModel} className="px-4 py-2 bg-[#b94a48] text-white rounded-xl text-xs font-bold">Confirmar Exclusão</button>
            </div>
          </div>
        </div>
      )}

      {importingFile && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3">
          <form onSubmit={handleConfirmImport} className="bg-[#0a0a0a] border border-[#262522] rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-[#e4e0d7]">Importar ZIP do Drive</h3>
              <button type="button" onClick={() => setImportingFile(null)}><X className="w-5 h-5 text-[#8c877e]" /></button>
            </div>
            <div>
              <label className="block text-xs text-[#a39e93] mb-1">Nome do Modelo</label>
              <input type="text" required value={importForm.name} onChange={(e) => setImportForm({ ...importForm, name: e.target.value })} className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]" />
            </div>
            {renderCategorySelector(importForm.category, (val) => setImportForm({ ...importForm, category: val }), 'import')}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setImportingFile(null)} className="px-4 py-2 bg-[#141413] text-[#a39e93] rounded-xl text-xs">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-[#e4e0d7] text-[#000000] rounded-xl text-xs font-bold">Importar</button>
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