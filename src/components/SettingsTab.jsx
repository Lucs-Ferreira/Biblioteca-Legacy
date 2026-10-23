import React from 'react';
import { HardDrive, ExternalLink, FolderPlus } from 'lucide-react';

export default function SettingsTab({
    googleConnected,
    googleUserEmail,
    settings,
    handleConnectGoogle,
    openFolderPicker,
    syncingCategoryFolders,
    handleSyncAllCategorySubfolders,
    handleDisconnectGoogle,
    handleSaveGeneralSettings,
    materials,
    printers,
    setNewMaterialModal,
    setNewPrinterModal,
    handleDeleteMaterial,
    handleDeletePrinter
}) {
    return (
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
    );
}