import React from 'react';
import { Calculator, Plus, Trash2 } from 'lucide-react';

export default function CalculadoraTab({
    calcForm,
    setCalcForm,
    printers,
    materials,
    settings,
    calculationResults,
    setNewMaterialModal,
    setNewPrinterModal,
    handleDeleteMaterial,
    handleDeletePrinter
}) {
    return (
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
    );
}