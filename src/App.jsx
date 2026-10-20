import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Box, Upload, FolderDown, Settings, Search, Plus, ExternalLink,
  Trash2, Edit3, Eye, CheckCircle2, AlertTriangle, Folder,
  HardDrive, ShieldCheck, RefreshCw, X, Check, FileArchive,
  LogOut, Lock, Tag, Calendar, Info, CloudOff, FolderPlus, KeyRound
} from 'lucide-react';

// ============================================================================
// CONFIGURAÇÃO DO SUPABASE E GOOGLE OAUTH (Lendo variáveis da Vercel / Vite)
// ============================================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Escopos mínimos: drive.file (gerenciar arquivos/pastas criados pelo app) +
// drive.metadata.readonly (listar ZIPs existentes colocados manualmente na pasta raiz)
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly email profile';

const DEFAULT_CATEGORIES = [
  'Geral', 'Miniaturas & RPG', 'Peças Mecânicas', 'Utilidades Domésticas',
  'Cosplay & Props', 'Organizadores', 'Articulados', 'Suportes & Cases'
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
  // Autenticação Supabase
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  // Estado Google Drive OAuth
  const [googleToken, setGoogleToken] = useState(() => sessionStorage.getItem('stl_google_token') || '');
  const [googleUserEmail, setGoogleUserEmail] = useState(() => sessionStorage.getItem('stl_google_email') || '');
  const [gisReady, setGisReady] = useState(false);

  // Configurações Persistentes do Usuário
  const [settings, setSettings] = useState({
    root_folder_id: '',
    root_folder_name: '',
    organize_by_subfolders: false,
    max_upload_size_mb: 150
  });

  // Dados da Biblioteca
  const [models, setModels] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [loadingData, setLoadingData] = useState(false);

  // Navegação e Filtros
  const [activeTab, setActiveTab] = useState('catalogo');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [toast, setToast] = useState(null);

  // Modais
  const [selectedModel, setSelectedModel] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [editingModel, setEditingModel] = useState(null);
  const [deleteConfirmModel, setDeleteConfirmModel] = useState(null);
  const [deleteAlsoFromDrive, setDeleteAlsoFromDrive] = useState(false);
  const [driveStatusCheck, setDriveStatusCheck] = useState({});

  // Modal de Seleção de Pasta Raiz do Drive
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [driveFolders, setDriveFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [newFolderName, setNewFolderName] = useState('Biblioteca STL');
  const [pendingFolderSelection, setPendingFolderSelection] = useState(null);

  // Estado de Upload de Novo ZIP
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
  // Recuperação caso o ZIP suba pro Drive mas o banco falhe
  const [pendingRecovery, setPendingRecovery] = useState(null);

  // Estado de Importação do Drive
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

  // Carrega script oficial do Google Identity Services (GIS)
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGisReady(true);
    document.body.appendChild(script);
  }, []);

  // Inicializa sessão do Supabase
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

  // Carrega configurações e modelos ao autenticar
  useEffect(() => {
    if (session?.user) {
      loadUserData();
    }
  }, [session]);

  const loadUserData = async () => {
    if (!supabase || !session?.user) return;
    setLoadingData(true);
    try {
      // 1. Busca configurações
      const { data: cfg } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (cfg) {
        setSettings({
          root_folder_id: cfg.root_folder_id || '',
          root_folder_name: cfg.root_folder_name || '',
          organize_by_subfolders: cfg.organize_by_subfolders || false,
          max_upload_size_mb: cfg.max_upload_size_mb || 150
        });
      }

      // 2. Busca modelos cadastrados
      const { data: modelList, error: modelErr } = await supabase
        .from('stl_models')
        .select('*')
        .order('created_at', { ascending: false });

      if (modelErr) throw modelErr;
      setModels(modelList || []);

      // 3. Gera URLs assinadas do bucket privado para as imagens de referência
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

  // Login / Cadastro no Supabase
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

  // Conectar Conta Google via OAuth2 (Google Identity Services)
  const handleConnectGoogle = () => {
    if (!GOOGLE_CLIENT_ID) {
      showToast('VITE_GOOGLE_CLIENT_ID não configurado nas variáveis da Vercel.', 'error');
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      showToast('Aguarde o carregamento do serviço do Google...', 'error');
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
        sessionStorage.setItem('stl_google_token', token);

        // Busca e-mail do usuário conectado
        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const info = await res.json();
          if (info.email) {
            setGoogleUserEmail(info.email);
            sessionStorage.setItem('stl_google_email', info.email);
          }
        } catch {
          // ignora falha de userinfo
        }

        showToast('Conta Google conectada com sucesso!');
        if (!settings.root_folder_id) {
          openFolderPicker(token);
        }
      }
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  const handleDisconnectGoogle = () => {
    setGoogleToken('');
    setGoogleUserEmail('');
    sessionStorage.removeItem('stl_google_token');
    sessionStorage.removeItem('stl_google_email');
    showToast('Conta Google desconectada.');
  };

  // ============================================================================
  // GERENCIAMENTO DA PASTA RAIZ NO GOOGLE DRIVE API v3
  // ============================================================================
  const openFolderPicker = async (tokenOverride) => {
    const activeToken = tokenOverride || googleToken;
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
    if (!googleToken || !newFolderName.trim()) return;
    setLoadingFolders(true);
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
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
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: session.user.id,
        ...merged,
        updated_at: new Date().toISOString()
      });
    if (error) {
      showToast(`Erro ao salvar configuração: ${error.message}`, 'error');
    } else {
      showToast('Configurações atualizadas com sucesso!');
    }
  };

  // ============================================================================
  // UPLOAD DIRETO PARA O GOOGLE DRIVE + METADADOS E IMAGEM NO SUPABASE
  // ============================================================================
  const getOrCreateCategorySubfolder = async (categoryName) => {
    if (!settings.organize_by_subfolders || !categoryName) {
      return settings.root_folder_id;
    }
    const safeName = categoryName.replace(/'/g, "\\'");
    const q = encodeURIComponent(
      `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and '${settings.root_folder_id}' in parents and trashed = false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${googleToken}` } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files?.length > 0) {
        return searchData.files[0].id;
      }
    }
    // Cria a subpasta da categoria dentro da pasta raiz
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${googleToken}`,
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
    if (!googleToken) {
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
      // 1. Determina pasta destino (Raiz ou Subpasta por categoria)
      setUploadStep('Verificando pasta de destino no Google Drive...');
      const targetFolderId = await getOrCreateCategorySubfolder(uploadForm.category);

      // 2. Envia o ZIP diretamente para o Google Drive API v3 (Multipart upload)
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
          headers: { Authorization: `Bearer ${googleToken}` },
          body: formData
        }
      );

      if (!driveRes.ok) {
        throw new Error('Falha no upload para o Google Drive. Verifique sua conexão ou autorização OAuth.');
      }

      uploadedDriveData = await driveRes.json();

      // 3. Salva a imagem de referência no Supabase Storage (Bucket Privado) e os metadados no banco
      await completeDatabaseRegistration(uploadedDriveData, targetFolderId, uploadForm);

      setUploadForm({
        name: '', description: '', category: 'Geral', tags: '', notes: '', zipFile: null, imageFile: null
      });
      setPendingRecovery(null);
      showToast('Modelo enviado para o Drive e catalogado com sucesso!');
      setActiveTab('catalogo');
      loadUserData();
    } catch (err) {
      // Se o upload para o Drive concluiu, mas o salvamento dos metadados falhou:
      if (uploadedDriveData?.id) {
        setPendingRecovery({
          driveData: uploadedDriveData,
          folderId: settings.root_folder_id,
          formSnapshot: { ...uploadForm }
        });
        showToast(
          'O ZIP foi enviado ao Drive, mas houve falha ao salvar no banco. Use o botão de recuperação abaixo sem precisar reenviar o ZIP!',
          'error'
        );
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

      if (storageErr) throw new Error(`Falha ao salvar imagem no Supabase Storage: ${storageErr.message}`);
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

    if (dbErr) throw new Error(`Falha ao salvar metadados no banco: ${dbErr.message}`);
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
      showToast('Cadastro recuperado e concluído com sucesso sem reenviar o ZIP!');
      setActiveTab('catalogo');
      loadUserData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  // ============================================================================
  // IMPORTAÇÃO DE ARQUIVOS ZIP JÁ EXISTENTES NA PASTA RAIZ
  // ============================================================================
  const fetchExistingDriveZips = async () => {
    if (!googleToken || !settings.root_folder_id) return;
    setLoadingDriveZips(true);
    try {
      const q = encodeURIComponent(
        `'${settings.root_folder_id}' in parents and (mimeType = 'application/zip' or mimeType = 'application/x-zip-compressed' or name contains '.zip') and trashed = false`
      );
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,createdTime,webViewLink)&pageSize=100`,
        { headers: { Authorization: `Bearer ${googleToken}` } }
      );
      if (!res.ok) throw new Error('Erro ao listar arquivos ZIP da pasta raiz.');
      const data = await res.json();
      setDriveZipFiles(data.files || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingDriveZips(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'importar' && googleToken && settings.root_folder_id) {
      fetchExistingDriveZips();
    }
  }, [activeTab, googleToken, settings.root_folder_id]);

  const handleConfirmImport = async (e) => {
    e.preventDefault();
    if (!importingFile) return;

    // Verifica duplicidade por drive_file_id
    if (models.some((m) => m.drive_file_id === importingFile.id)) {
      showToast('Este arquivo ZIP já está cadastrado na sua Biblioteca STL.', 'error');
      return;
    }

    setUploading(true);
    try {
      await completeDatabaseRegistration(importingFile, settings.root_folder_id, importForm);
      showToast(`Arquivo "${importingFile.name}" importado para o catálogo!`);
      setImportingFile(null);
      loadUserData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
      setUploadStep('');
    }
  };

  // ============================================================================
  // VERIFICAÇÃO DE DISPONIBILIDADE, EDIÇÃO E EXCLUSÃO
  // ============================================================================
  const verifyDriveFileAvailability = async (model) => {
    if (!googleToken) return;
    setDriveStatusCheck((prev) => ({ ...prev, [model.id]: 'checking' }));
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${model.drive_file_id}?fields=id,name,trashed`,
        { headers: { Authorization: `Bearer ${googleToken}` } }
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
    if (googleToken) {
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
      // Se o usuário marcou explicitamente para excluir também do Google Drive:
      if (deleteAlsoFromDrive) {
        if (!googleToken) {
          throw new Error('Conecte sua conta Google para poder excluir o arquivo ZIP do Drive.');
        }
        const driveDel = await fetch(
          `https://www.googleapis.com/drive/v3/files/${deleteConfirmModel.drive_file_id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${googleToken}` }
          }
        );
        if (!driveDel.ok && driveDel.status !== 404) {
          throw new Error('Não foi possível excluir o arquivo no Google Drive.');
        }
      }

      // Remove imagem do Supabase Storage se existir
      if (deleteConfirmModel.image_path) {
        await supabase.storage.from('stl-images').remove([deleteConfirmModel.image_path]);
      }

      // Remove registro do catálogo
      const { error } = await supabase
        .from('stl_models')
        .delete()
        .eq('id', deleteConfirmModel.id);

      if (error) throw error;

      showToast(
        deleteAlsoFromDrive
          ? 'Registro e arquivo ZIP excluídos permanentemente.'
          : 'Removido do catálogo! O arquivo ZIP original foi preservado no seu Google Drive.'
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

  // ============================================================================
  // FILTROS DO CATÁLOGO
  // ============================================================================
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

  // ============================================================================
  // TELA DE DIAGNÓSTICO CASO AS VARIÁVEIS DA VERCEL NÃO ESTEJAM CONFIGURADAS
  // ============================================================================
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-900 border border-amber-500/40 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle className="w-7 h-7 shrink-0" />
            <h1 className="text-xl font-bold">Configuração de Variáveis Pendente</h1>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            A <strong>Biblioteca STL</strong> está no ar, mas não encontrou as variáveis de ambiente do Supabase na Vercel.
          </p>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono space-y-1 text-slate-300">
            <div>VITE_SUPABASE_URL: {SUPABASE_URL ? '✅ Configurada' : '❌ Ausente'}</div>
            <div>VITE_SUPABASE_ANON_KEY: {SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ Ausente'}</div>
            <div>VITE_GOOGLE_CLIENT_ID: {GOOGLE_CLIENT_ID ? '✅ Configurada' : '⚠️ Ausente'}</div>
          </div>
          <p className="text-xs text-slate-400">
            Acesse o painel da Vercel em <strong>Settings &rarr; Environment Variables</strong>, adicione as chaves acima e faça um <strong>Redeploy</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // ============================================================================
  // TELA DE LOGIN PESSOAL (SUPABASE AUTH + RLS)
  // ============================================================================
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Box className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Biblioteca STL</h1>
              <p className="text-xs text-slate-400">Catálogo Pessoal de Modelos 3D &bull; Google Drive + Supabase</p>
            </div>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {authError}
            </div>
          )}

          <form onSubmit={handleSupabaseAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Seu E-mail Pessoal</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition cursor-pointer"
            >
              {isSignUp ? 'Criar Conta Pessoal' : 'Entrar na Biblioteca'}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              {isSignUp ? 'Já possui conta? Clique para entrar' : 'Primeira vez aqui? Crie sua conta pessoal'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // INTERFACE PRINCIPAL DA BIBLIOTECA STL
  // ============================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Notificação Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 bg-slate-900 border-slate-700 text-sm">
          {toast.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-slate-200">{toast.message}</span>
        </div>
      )}

      {/* Cabeçalho */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight">Biblioteca STL</h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Armazenamento Principal no Google Drive &bull; Catálogo Privado
              </p>
            </div>
          </div>

          {/* Navegação */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('catalogo')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'catalogo'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Box className="w-4 h-4" />
              <span>Catálogo ({models.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Enviar ZIP</span>
            </button>

            <button
              onClick={() => setActiveTab('importar')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'importar'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FolderDown className="w-4 h-4" />
              <span>Importar do Drive</span>
            </button>

            <button
              onClick={() => setActiveTab('configuracoes')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'configuracoes'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden md:inline">Configurações</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Banner de Configuração Inicial do Google Drive */}
      {(!googleToken || !settings.root_folder_id) && (
        <div className="bg-indigo-950/60 border-b border-indigo-500/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-indigo-200">
              <HardDrive className="w-5 h-5 text-indigo-400 shrink-0" />
              {!googleToken ? (
                <span>
                  Conecte sua conta Google para enviar ou importar seus arquivos ZIP diretamente do Google Drive.
                </span>
              ) : (
                <span>
                  Selecione uma pasta existente ou crie a pasta raiz <strong>Biblioteca STL</strong> no seu Google Drive.
                </span>
              )}
            </div>
            <div>
              {!googleToken ? (
                <button
                  onClick={handleConnectGoogle}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Conectar Conta Google
                </button>
              ) : (
                <button
                  onClick={() => openFolderPicker()}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Configurar Pasta Raiz
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">
        {/* ABA 1: CATÁLOGO VISUAL */}
        {activeTab === 'catalogo' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar modelo por nome, descrição ou tag..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                {['Todas', ...DEFAULT_CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {loadingData ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
                <RefreshCw className="w-7 h-7 animate-spin text-indigo-400" />
                <span className="text-sm">Carregando seus modelos 3D...</span>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
                <FileArchive className="w-12 h-12 text-slate-600 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-white">Nenhum modelo STL encontrado</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Envie um novo arquivo ZIP diretamente para sua pasta raiz do Google Drive ou importe arquivos ZIP que já estão lá.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Enviar Novo ZIP
                  </button>
                  <button
                    onClick={() => setActiveTab('importar')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Importar do Drive
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredModels.map((model) => {
                  const imgUrl = signedUrls[model.id];
                  return (
                    <div
                      key={model.id}
                      onClick={() => handleOpenDetails(model)}
                      className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl overflow-hidden flex flex-col transition cursor-pointer shadow-lg"
                    >
                      <div className="aspect-video bg-slate-950 relative overflow-hidden flex items-center justify-center">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={model.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-600">
                            <Box className="w-10 h-10" />
                            <span className="text-[11px]">Sem imagem de referência</span>
                          </div>
                        )}
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-950/80 backdrop-blur text-indigo-300 border border-indigo-500/30">
                          {model.category}
                        </span>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h3 className="font-semibold text-white text-sm group-hover:text-indigo-400 transition line-clamp-1">
                            {model.name}
                          </h3>
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                            {model.description || 'Sem descrição cadastrada.'}
                          </p>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-800/80">
                          {model.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {model.tags.slice(0, 3).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-slate-950 text-slate-400 rounded text-[10px]"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{formatBytes(model.drive_file_size)}</span>
                            <span className="text-indigo-400 font-medium group-hover:underline">
                              Abrir detalhes &rarr;
                            </span>
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

        {/* ABA 2: UPLOAD DE NOVO ARQUIVO ZIP */}
        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Enviar Novo Modelo STL (.ZIP)</h2>
              <p className="text-xs text-slate-400 mt-1">
                O arquivo ZIP será enviado diretamente para sua pasta raiz no Google Drive (nunca para o Supabase). A imagem de referência ficará no bucket privado do Supabase.
              </p>
            </div>

            {pendingRecovery && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>Upload no Drive concluído, mas o cadastro no banco falhou!</span>
                </div>
                <p className="text-xs text-slate-300">
                  O arquivo <strong>{pendingRecovery.driveData.name}</strong> já está salvo no seu Google Drive (ID: <code>{pendingRecovery.driveData.id}</code>). Você pode concluir o salvamento dos metadados agora sem enviar o ZIP novamente:
                </p>
                <button
                  type="button"
                  onClick={handleRetryMetadataSave}
                  disabled={uploading}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-xs transition cursor-pointer"
                >
                  Recuperar e Concluir Cadastro (Sem Reenviar ZIP)
                </button>
              </div>
            )}

            <form onSubmit={handleUploadNewModel} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Nome do Modelo *</label>
                  <input
                    type="text"
                    required
                    value={uploadForm.name}
                    onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                    placeholder="Ex: Dragão Articulado V2"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Categoria</label>
                  <select
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  >
                    {DEFAULT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Detalhes das peças, escala recomendada, suporte..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Tags (separadas por vírgula)</label>
                  <input
                    type="text"
                    value={uploadForm.tags}
                    onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                    placeholder="rpg, dragao, sem-suporte"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Observações de Impressão</label>
                  <input
                    type="text"
                    value={uploadForm.notes}
                    onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                    placeholder="PLA 205°C, preenchimento 15%"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-950 border border-dashed border-slate-700 space-y-2">
                  <label className="block text-xs font-semibold text-indigo-300">
                    1. Arquivo ZIP (Vai para o Google Drive) *
                  </label>
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
                    className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-600/20 file:text-indigo-300 hover:file:bg-indigo-600/30"
                  />
                  {uploadForm.zipFile && (
                    <p className="text-[11px] text-emerald-400">
                      Selecionado: {uploadForm.zipFile.name} ({formatBytes(uploadForm.zipFile.size)})
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-dashed border-slate-700 space-y-2">
                  <label className="block text-xs font-semibold text-emerald-300">
                    2. Imagem de Referência (Supabase Privado)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadForm({ ...uploadForm, imageFile: e.target.files?.[0] || null })}
                    className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-600/20 file:text-emerald-300 hover:file:bg-emerald-600/30"
                  />
                  {uploadForm.imageFile && (
                    <p className="text-[11px] text-emerald-400">
                      Imagem: {uploadForm.imageFile.name}
                    </p>
                  )}
                </div>
              </div>

              {uploading && (
                <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/30 flex items-center gap-3 text-xs text-indigo-200">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                  <span>{uploadStep || 'Processando...'}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition cursor-pointer"
                >
                  {uploading ? 'Enviando...' : 'Enviar para o Drive e Catalogar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ABA 3: IMPORTAR ARQUIVOS ZIP JÁ EXISTENTES NO DRIVE */}
        {activeTab === 'importar' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div>
                <h2 className="text-lg font-bold text-white">Importar ZIPs Existentes na Pasta Raiz</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lista os arquivos .ZIP presentes em <strong>{settings.root_folder_name || 'sua pasta raiz'}</strong> sem movê-los ou duplicá-los.
                </p>
              </div>
              <button
                onClick={fetchExistingDriveZips}
                disabled={loadingDriveZips || !googleToken}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingDriveZips ? 'animate-spin' : ''}`} />
                <span>Atualizar Lista do Drive</span>
              </button>
            </div>

            {!googleToken || !settings.root_folder_id ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-400">
                Conecte sua conta Google e selecione a pasta raiz para listar os arquivos ZIP existentes.
              </div>
            ) : loadingDriveZips ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs">Consultando Google Drive API v3...</span>
              </div>
            ) : driveZipFiles.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-400">
                Nenhum arquivo .ZIP encontrado diretamente na pasta raiz configurada.
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-950/60">
                      <th className="py-3.5 px-4">Arquivo ZIP no Google Drive</th>
                      <th className="py-3.5 px-4">Tamanho</th>
                      <th className="py-3.5 px-4">ID Único no Drive</th>
                      <th className="py-3.5 px-4 text-right">Status / Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {driveZipFiles.map((df) => {
                      const alreadyRegistered = models.some((m) => m.drive_file_id === df.id);
                      return (
                        <tr key={df.id} className="hover:bg-slate-800/40">
                          <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2.5">
                            <FileArchive className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span>{df.name}</span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-400">
                            {formatBytes(df.size)}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                            {df.id}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {alreadyRegistered ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Check className="w-3.5 h-3.5" /> Já Cadastrado
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
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                              >
                                Importar para Biblioteca
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

        {/* ABA 4: CONFIGURAÇÕES DO APLICATIVO */}
        {activeTab === 'configuracoes' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Bloco 1: Google Drive */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-6 h-6 text-indigo-400" />
                  <div>
                    <h3 className="font-bold text-white text-base">Conexão com Google Drive (Armazenamento Principal)</h3>
                    <p className="text-xs text-slate-400">API oficial Google Drive v3 com escopo restrito</p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    googleToken
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {googleToken ? `Conectado ${googleUserEmail ? `(${googleUserEmail})` : ''}` : 'Desconectado'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Pasta Raiz Vinculada:</span>
                  <span className="font-semibold text-white">{settings.root_folder_name || 'Nenhuma pasta selecionada'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ID Único no Google Drive:</span>
                  <span className="font-mono text-indigo-300">{settings.root_folder_id || '—'}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {!googleToken ? (
                  <button
                    onClick={handleConnectGoogle}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Conectar Conta Google
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => openFolderPicker()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Selecionar Outra Pasta Raiz
                    </button>
                    {settings.root_folder_id && (
                      <a
                        href={`https://drive.google.com/drive/folders/${settings.root_folder_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition"
                      >
                        <span>Abrir Pasta no Google Drive</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={handleDisconnectGoogle}
                      className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Desconectar Conta Google
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Bloco 2: Regras de Organização e Limites */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <h3 className="font-bold text-white text-base">Preferências de Organização e Upload</h3>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">Organizar novos ZIPs em subpastas por categoria</p>
                  <p className="text-xs text-slate-400">
                    Por padrão é desativado (guarda diretamente na pasta raiz Biblioteca STL).
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.organize_by_subfolders}
                  onChange={(e) => handleSaveGeneralSettings({ organize_by_subfolders: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">Limite máximo de upload por arquivo (MB)</p>
                  <p className="text-xs text-slate-400">Protege contra envios acidentais acima do tamanho desejado.</p>
                </div>
                <input
                  type="number"
                  min={10}
                  max={2048}
                  value={settings.max_upload_size_mb}
                  onChange={(e) => handleSaveGeneralSettings({ max_upload_size_mb: Number(e.target.value) })}
                  className="w-28 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white text-right"
                />
              </div>
            </div>

            {/* Bloco 3: Status do Supabase */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                  <ShieldCheck className="w-5 h-5" />
                  <span>Supabase Conectado (RLS Ativo &bull; Bucket Privado stl-images)</span>
                </div>
                <p className="text-xs text-slate-400">
                  Autenticado como: <strong>{session.user.email}</strong>
                </p>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE DETALHES DO MODELO */}
      {selectedModel && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
            <div className="aspect-video bg-slate-950 relative flex items-center justify-center">
              {signedUrls[selectedModel.id] ? (
                <>
                  <img
                    src={signedUrls[selectedModel.id]}
                    alt={selectedModel.name}
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={() => setLightboxUrl(signedUrls[selectedModel.id])}
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-950/85 hover:bg-slate-900 text-white text-xs font-medium flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" /> Visualizar Imagem Ampliada
                  </button>
                </>
              ) : (
                <div className="text-slate-600 flex flex-col items-center gap-2">
                  <Box className="w-12 h-12" />
                  <span className="text-xs">Sem imagem de referência</span>
                </div>
              )}
              <button
                onClick={() => setSelectedModel(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-slate-950/80 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {selectedModel.category}
                  </span>
                  <h2 className="text-xl font-bold text-white mt-2">{selectedModel.name}</h2>
                </div>
                <span className="text-xs text-slate-400">{formatBytes(selectedModel.drive_file_size)}</span>
              </div>

              {driveStatusCheck[selectedModel.id] === 'missing' && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-xs text-rose-300">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                  <span>
                    Atenção: O arquivo ZIP original foi movido para a lixeira ou não está mais disponível no local esperado do Google Drive.
                  </span>
                </div>
              )}

              <p className="text-sm text-slate-300 whitespace-pre-line">
                {selectedModel.description || 'Nenhuma descrição informada.'}
              </p>

              {selectedModel.notes && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <span className="font-semibold text-slate-300">Observações / Parâmetros:</span>
                  <p className="text-slate-400">{selectedModel.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div>Arquivo Drive: <strong className="text-slate-200">{selectedModel.drive_file_name}</strong></div>
                <div>ID no Drive: <code className="text-indigo-300">{selectedModel.drive_file_id}</code></div>
                <div>Cadastro: {formatDate(selectedModel.created_at)}</div>
                <div>Atualizado: {formatDate(selectedModel.updated_at)}</div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <a
                  href={selectedModel.drive_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir ZIP no Drive</span>
                </a>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setEditingModel({
                        ...selectedModel,
                        tagsInput: (selectedModel.tags || []).join(', ')
                      })
                    }
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" /> Editar Cadastro
                  </button>
                  <button
                    onClick={() => {
                      setDeleteConfirmModel(selectedModel);
                      setDeleteAlsoFromDrive(false);
                    }}
                    className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Excluir da Biblioteca
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX DE IMAGEM AMPLIADA */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img src={lightboxUrl} alt="Referência ampliada" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE METADADOS */}
      {editingModel && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Editar Cadastro do Modelo</h3>
              <button type="button" onClick={() => setEditingModel(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Nome do Modelo</label>
              <input
                type="text"
                required
                value={editingModel.name}
                onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Categoria</label>
              <select
                value={editingModel.category}
                onChange={(e) => setEditingModel({ ...editingModel, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              >
                {DEFAULT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Descrição</label>
              <textarea
                rows={3}
                value={editingModel.description}
                onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Tags (separadas por vírgula)</label>
              <input
                type="text"
                value={editingModel.tagsInput}
                onChange={(e) => setEditingModel({ ...editingModel, tagsInput: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Observações</label>
              <input
                type="text"
                value={editingModel.notes}
                onChange={(e) => setEditingModel({ ...editingModel, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Substituir Imagem de Referência (opcional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setEditingModel({ ...editingModel, newImageFile: e.target.files?.[0] || null })}
                className="text-xs text-slate-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingModel(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteConfirmModel && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-white text-base">Excluir "{deleteConfirmModel.name}"?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Por padrão, esta ação remove apenas o registro visual do catálogo e <strong>preserva o arquivo ZIP intacto no seu Google Drive</strong>.
            </p>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteAlsoFromDrive}
                onChange={(e) => setDeleteAlsoFromDrive(e.target.checked)}
                className="mt-0.5 accent-rose-500"
              />
              <span>
                Excluir também o arquivo <strong>{deleteConfirmModel.drive_file_name}</strong> permanentemente do meu Google Drive (requer confirmação explícita).
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmModel(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteModel}
                disabled={uploading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
              >
                {deleteAlsoFromDrive ? 'Excluir do Catálogo e do Drive' : 'Remover Apenas do Catálogo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO DE ARQUIVO EXISTENTE */}
      {importingFile && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmImport}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Importar ZIP do Drive para o Catálogo</h3>
              <button type="button" onClick={() => setImportingFile(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
              Arquivo original: <strong>{importingFile.name}</strong> (ID: <code>{importingFile.id}</code>)
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Nome do Modelo *</label>
              <input
                type="text"
                required
                value={importForm.name}
                onChange={(e) => setImportForm({ ...importForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Categoria</label>
              <select
                value={importForm.category}
                onChange={(e) => setImportForm({ ...importForm, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              >
                {DEFAULT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Descrição</label>
              <textarea
                rows={2}
                value={importForm.description}
                onChange={(e) => setImportForm({ ...importForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Tags (separadas por vírgula)</label>
              <input
                type="text"
                value={importForm.tags}
                onChange={(e) => setImportForm({ ...importForm, tags: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Imagem de Referência (opcional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImportForm({ ...importForm, imageFile: e.target.files?.[0] || null })}
                className="text-xs text-slate-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImportingFile(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
              >
                Confirmar Importação
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE SELEÇÃO / CRIAÇÃO DA PASTA RAIZ DO GOOGLE DRIVE */}
      {folderPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Configurar Pasta Raiz no Google Drive</h3>
              <button onClick={() => setFolderPickerOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {settings.root_folder_id && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                <strong>Aviso sobre troca de pasta raiz:</strong> Trocar a pasta raiz não move nem exclui seus arquivos existentes automaticamente. Os modelos já cadastrados continuarão apontando para seus arquivos originais, e a mudança afetará apenas o destino dos novos uploads e a listagem de importação.
              </div>
            )}

            {/* Criar nova pasta */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Criar nova pasta raiz no seu Google Drive:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
                <button
                  type="button"
                  onClick={handleCreateRootFolder}
                  disabled={loadingFolders}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" /> Criar e Vincular
                </button>
              </div>
            </div>

            {/* Selecionar pasta existente pelo ID único */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Ou selecione uma pasta existente (identificada pelo ID único do Drive):
              </label>
              <div className="max-h-52 overflow-y-auto divide-y divide-slate-800 bg-slate-950 border border-slate-800 rounded-xl">
                {loadingFolders ? (
                  <div className="p-6 text-center text-xs text-slate-400">Buscando pastas no Drive...</div>
                ) : driveFolders.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Nenhuma pasta existente listada. Crie a pasta "Biblioteca STL" no botão acima.
                  </div>
                ) : (
                  driveFolders.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => setPendingFolderSelection(f)}
                      className={`p-3 flex items-center justify-between text-xs cursor-pointer transition ${
                        pendingFolderSelection?.id === f.id
                          ? 'bg-indigo-600/20 text-white'
                          : 'hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="font-medium">{f.name}</span>
                      </div>
                      <code className="text-[10px] text-slate-500">{f.id}</code>
                    </div>
                  ))
                )}
              </div>
            </div>

            {pendingFolderSelection && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => saveRootFolderSetting(pendingFolderSelection.id, pendingFolderSelection.name)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Confirmar Pasta "{pendingFolderSelection.name}"
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}