import React from 'react';
import {
  Box, ListOrdered, ExternalLink, Check, AlertTriangle,
  Folder, FileArchive, ArrowRight
} from 'lucide-react';
import { formatBytes, getModelImagePaths } from '../utils/helpers';
import CalculadoraTab from './CalculadoraTab';
import SettingsTab from './SettingsTab';

export default function SecondaryTabs({
  activeTab,
  setActiveTab,
  queuedModels,
  getSignedUrlForPath,
  handleOpenDetails,
  handleChangeQueuePriority,
  handleTogglePrintQueue,
  pendingRecovery,
  handleRetryMetadataSave,
  uploading,
  uploadStep,
  handleUploadNewModel,
  uploadForm,
  setUploadForm,
  renderCategorySelector,
  importPipelineIds,
  fetchAwaitingImports,
  loadingDriveZips,
  settings,
  awaitingItems,
  setImportingFile,
  setImportForm,
  setNewMaterialModal,
  setNewPrinterModal,
  calcForm,
  setCalcForm,
  printers,
  materials,
  calculationResults,
  googleConnected,
  googleUserEmail,
  handleConnectGoogle,
  openFolderPicker,
  syncingCategoryFolders,
  handleSyncAllCategorySubfolders,
  handleDisconnectGoogle,
  handleSaveGeneralSettings,
  handleDeleteMaterial,
  handleDeletePrinter
}) {
  return (
    <>
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
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                            prio === 'Alta'
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
        <CalculadoraTab
          calcForm={calcForm}
          setCalcForm={setCalcForm}
          printers={printers}
          materials={materials}
          settings={settings}
          calculationResults={calculationResults}
          setNewMaterialModal={setNewMaterialModal}
          setNewPrinterModal={setNewPrinterModal}
          handleDeleteMaterial={handleDeleteMaterial}
          handleDeletePrinter={handleDeletePrinter}
        />
      )}

      {/* ABA: CONFIGURAÇÕES */}
      {activeTab === 'configuracoes' && (
        <SettingsTab
          googleConnected={googleConnected}
          googleUserEmail={googleUserEmail}
          settings={settings}
          handleConnectGoogle={handleConnectGoogle}
          openFolderPicker={openFolderPicker}
          syncingCategoryFolders={syncingCategoryFolders}
          handleSyncAllCategorySubfolders={handleSyncAllCategorySubfolders}
          handleDisconnectGoogle={handleDisconnectGoogle}
          handleSaveGeneralSettings={handleSaveGeneralSettings}
          materials={materials}
          printers={printers}
          setNewMaterialModal={setNewMaterialModal}
          setNewPrinterModal={setNewPrinterModal}
          handleDeleteMaterial={handleDeleteMaterial}
          handleDeletePrinter={handleDeletePrinter}
        />
      )}
    </>
  );
}