import React from 'react';
import {
  Box, Eye, ChevronLeft, ChevronRight, X, ExternalLink, AlertTriangle,
  ListOrdered, RefreshCw, Folder, Share2, Link2, Copy, Trash2
} from 'lucide-react';
import { formatBytes, getModelImagePaths } from '../utils/helpers';

export function ImageCarouselModalHeader({
  model,
  activeImageIndex,
  setActiveImageIndex,
  getSignedUrlForPath,
  setLightboxUrl,
  onClose
}) {
  const paths = getModelImagePaths(model);
  const total = paths.length;
  const safeIdx = total > 0 ? Math.min(activeImageIndex, total - 1) : 0;
  const currentUrl = total > 0 ? getSignedUrlForPath(paths[safeIdx]) : null;

  return (
    <div className="bg-[#000000] border-b border-[#1c1b19]">
      <div className="aspect-video relative flex items-center justify-center overflow-hidden">
        {currentUrl ? (
          <>
            <img
              src={currentUrl}
              alt={`${model.name} - Foto ${safeIdx + 1}`}
              className="w-full h-full object-contain"
            />
            <button
              type="button"
              onClick={() => setLightboxUrl(currentUrl)}
              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-[#000000]/85 text-[#e4e0d7] text-xs flex items-center gap-1.5 border border-[#e4e0d7]/30 cursor-pointer hover:bg-[#141413]"
            >
              <Eye className="w-4 h-4" /> Ampliar ({safeIdx + 1}/{total})
            </button>
          </>
        ) : (
          <div className="text-[#5e5a52] text-xs flex flex-col items-center gap-1">
            <Box className="w-10 h-10" />
            <span>Sem imagem</span>
          </div>
        )}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActiveImageIndex((prev) => (prev - 1 + total) % total)}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-[#000000]/80 hover:bg-[#e4e0d7] text-[#e4e0d7] hover:text-[#000000] border border-[#262522] cursor-pointer transition"
              title="Foto Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveImageIndex((prev) => (prev + 1) % total)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-[#000000]/80 hover:bg-[#e4e0d7] text-[#e4e0d7] hover:text-[#000000] border border-[#262522] cursor-pointer transition"
              title="Próxima Foto"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full bg-[#000000]/80 text-[#a39e93] hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {total > 1 && (
        <div className="px-4 py-2.5 bg-[#050505] border-t border-[#141413] flex items-center gap-2 overflow-x-auto">
          {paths.map((p, idx) => {
            const thumbUrl = getSignedUrlForPath(p);
            const isSelected = idx === safeIdx;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setActiveImageIndex(idx)}
                className={`w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition cursor-pointer ${
                  isSelected ? 'border-[#c89d66] scale-105' : 'border-[#262522] opacity-60 hover:opacity-100'
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
  );
}

export default function CatalogModals({
  selectedModel,
  setSelectedModel,
  activeImageIndex,
  setActiveImageIndex,
  getSignedUrlForPath,
  setLightboxUrl,
  lightboxUrl,
  driveStatusCheck,
  handleTogglePrintQueue,
  setEditingModel,
  editingModel,
  handleSaveEdit,
  renderCategorySelector,
  uploading,
  uploadStep,
  deleteConfirmModel,
  setDeleteConfirmModel,
  deleteAlsoFromDrive,
  setDeleteAlsoFromDrive,
  handleDeleteModel,
  importingFile,
  setImportingFile,
  importForm,
  setImportForm,
  handleConfirmImport,
  folderPickerOpen,
  setFolderPickerOpen,
  newFolderName,
  setNewFolderName,
  handleCreateRootFolder,
  driveFolders,
  pendingFolderSelection,
  setPendingFolderSelection,
  saveRootFolderSetting,
  bulkCategoryModalOpen,
  setBulkCategoryModalOpen,
  selectedModelIds,
  bulkTargetCategory,
  setBulkTargetCategory,
  handleConfirmBulkCategoryChange,
  bulkDeleteModalOpen,
  setBulkDeleteModalOpen,
  bulkDeleteAlsoDrive,
  setBulkDeleteAlsoDrive,
  handleConfirmBulkDelete,
  shareModalOpen,
  setShareModalOpen,
  shareForm,
  setShareForm,
  allCategories,
  handleCreateSharedLink,
  creatingShareLink,
  sharedLinks,
  copyShareUrlToClipboard,
  handleDeleteSharedLink,
  newMaterialModal,
  setNewMaterialModal,
  matForm,
  setMatForm,
  handleSaveMaterial,
  newPrinterModal,
  setNewPrinterModal,
  printForm,
  setPrintForm,
  handleSavePrinter
}) {
  return (
    <>
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
            <ImageCarouselModalHeader
              model={selectedModel}
              activeImageIndex={activeImageIndex}
              setActiveImageIndex={setActiveImageIndex}
              getSignedUrlForPath={getSignedUrlForPath}
              setLightboxUrl={setLightboxUrl}
              onClose={() => setSelectedModel(null)}
            />
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
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                      selectedModel.in_print_queue
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
                          title="Remover esta imagem"
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

      {/* MODAL DE EXCLUSÃO INDIVIDUAL */}
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

      {/* MODAL SELETOR DE PASTA RAIZ */}
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
    </>
  );
}