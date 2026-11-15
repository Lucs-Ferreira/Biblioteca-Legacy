import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Plus, Trash2, Clock } from 'lucide-react';

export default function TimersView({ supabase, session }) {
    const [timers, setTimers] = useState([]);
    const [newName, setNewName] = useState('');
    const [newMinutes, setNewMinutes] = useState(5);
    const [loading, setLoading] = useState(false);

    // Carrega os timers do Supabase ao abrir
    useEffect(() => {
        if (!supabase || !session?.user) return;

        const fetchTimers = async () => {
            const { data, error } = await supabase
                .from('stl_timers')
                .select('*')
                .order('updated_at', { ascending: false });

            if (!error && data) {
                setTimers(data);
            }
        };

        fetchTimers();

        // Opcional: Atualiza em tempo real se mexer em outro dispositivo
        const channel = supabase
            .channel('public:stl_timers')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stl_timers', filter: `user_id=eq.${session.user.id}` }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setTimers((prev) => [payload.new, ...prev.filter(t => t.id !== payload.new.id)]);
                } else if (payload.eventType === 'UPDATE') {
                    setTimers((prev) => prev.map((t) => t.id === payload.new.id ? payload.new : t));
                } else if (payload.eventType === 'DELETE') {
                    setTimers((prev) => prev.filter((t) => t.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, session]);

    // Contagem regressiva local (rodando os timers que estão is_running = true)
    useEffect(() => {
        const interval = setInterval(() => {
            setTimers((prevTimers) =>
                prevTimers.map((timer) => {
                    if (!timer.is_running || timer.time_left <= 0) return timer;
                    const nextTime = timer.time_left - 1;
                    const updated = {
                        ...timer,
                        time_left: nextTime,
                        is_running: nextTime > 0 ? true : false
                    };

                    // Atualiza de forma silenciosa no banco quando o tempo muda (a cada segundo para o que estiver rodando)
                    if (supabase && session?.user) {
                        supabase
                            .from('stl_timers')
                            .update({ time_left: updated.time_left, is_running: updated.is_running })
                            .eq('id', timer.id)
                            .then(() => { });
                    }

                    return updated;
                })
            );
        }, 1000);
        return () => clearInterval(interval);
    }, [supabase, session]);

    const handleAddTimer = async (e) => {
        e.preventDefault();

        // 1. Valida se o nome foi preenchido
        if (!newName.trim()) {
            alert('Por favor, digite o nome do timer.');
            return;
        }

        // 2. Valida se o cliente Supabase está ativo
        if (!supabase) {
            alert('Erro: O cliente do Supabase não foi inicializado.');
            return;
        }

        // 3. Tenta pegar a sessão atual direto do Supabase caso a prop venha vazia
        let currentUserId = session?.user?.id;
        if (!currentUserId) {
            const { data: { session: activeSession } } = await supabase.auth.getSession();
            currentUserId = activeSession?.user?.id;
        }

        if (!currentUserId) {
            alert('Sessão expirada ou usuário não logado. Por favor, faça login novamente.');
            return;
        }

        const totalSeconds = Math.max(1, parseInt(newMinutes, 10) || 1) * 60;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('stl_timers')
                .insert({
                    user_id: currentUserId,
                    name: newName.trim(),
                    total_seconds: totalSeconds,
                    time_left: totalSeconds,
                    is_running: false
                })
                .select('*')
                .single();

            if (error) throw error;

            setTimers((prev) => [data, ...prev]);
            setNewName('');
            setNewMinutes(5);
        } catch (err) {
            console.error('Erro detalhado ao criar timer:', err);
            alert(`Erro ao adicionar timer: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleRun = async (timer) => {
        if (!supabase) return;
        const nextState = !timer.is_running;

        setTimers((prev) =>
            prev.map((t) => (t.id === timer.id ? { ...t, is_running: nextState } : t))
        );

        await supabase
            .from('stl_timers')
            .update({ is_running: nextState, updated_at: new Date().toISOString() })
            .eq('id', timer.id);
    };

    const handleReset = async (timer) => {
        if (!supabase) return;

        setTimers((prev) =>
            prev.map((t) => (t.id === timer.id ? { ...t, time_left: t.total_seconds, is_running: false } : t))
        );

        await supabase
            .from('stl_timers')
            .update({ time_left: timer.total_seconds, is_running: false, updated_at: new Date().toISOString() })
            .eq('id', timer.id);
    };

    const handleDelete = async (id) => {
        if (!supabase) return;

        setTimers((prev) => prev.filter((t) => t.id !== id));

        await supabase
            .from('stl_timers')
            .delete()
            .eq('id', id);
    };

    const formatTime = (totalSecs) => {
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#c89d66] text-[#000000]">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-[#e4e0d7]">Timers Sincronizados</h2>
                        <p className="text-xs text-[#8c877e]">Os cronômetros aparecem iguais em todos os seus dispositivos conectados.</p>
                    </div>
                </div>

                <form onSubmit={handleAddTimer} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                        <label className="block text-xs text-[#a39e93] mb-1">Nome do Timer *</label>
                        <input
                            type="text"
                            required
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Ex: Impressão Peça A"
                            className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-[#a39e93] mb-1">Tempo (Minutos)</label>
                        <input
                            type="number"
                            min="1"
                            required
                            value={newMinutes}
                            onChange={(e) => setNewMinutes(e.target.value)}
                            className="w-full px-3 py-2 bg-[#000000] border border-[#262522] rounded-xl text-sm text-[#e4e0d7]"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 px-4 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                        >
                            <Plus className="w-4 h-4" />
                            <span>{loading ? 'Adicionando...' : 'Adicionar Timer'}</span>
                        </button>
                    </div>
                </form>
            </div>

            {timers.length === 0 ? (
                <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-12 text-center space-y-3">
                    <Clock className="w-10 h-10 text-[#5e5a52] mx-auto" />
                    <p className="text-sm font-semibold text-[#e4e0d7]">Nenhum timer ativo</p>
                    <p className="text-xs text-[#8c877e]">Adicione um cronômetro acima para começar a sincronizar.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {timers.map((timer) => {
                        const isFinished = timer.time_left === 0;
                        const progressPct = ((timer.total_seconds - timer.time_left) / timer.total_seconds) * 100;

                        return (
                            <div
                                key={timer.id}
                                className={`bg-[#0a0a0a] border rounded-2xl p-5 space-y-4 relative overflow-hidden transition ${isFinished ? 'border-[#b94a48] bg-[#b94a48]/5' : timer.is_running ? 'border-[#c89d66]' : 'border-[#262522]'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="font-bold text-base text-[#e4e0d7]">{timer.name}</h3>
                                        <span className="text-[11px] text-[#8c877e]">
                                            {isFinished ? 'Tempo Encerrado!' : timer.is_running ? 'Rodando...' : 'Pausado'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(timer.id)}
                                        className="text-[#b94a48] hover:text-white cursor-pointer p-1"
                                        title="Excluir Timer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="text-center py-2">
                                    <span className={`text-4xl sm:text-5xl font-mono font-black tracking-wider ${isFinished ? 'text-[#d96b68] animate-pulse' : 'text-white'}`}>
                                        {formatTime(timer.time_left)}
                                    </span>
                                </div>

                                <div className="w-full h-1.5 bg-[#141413] rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ${isFinished ? 'bg-[#b94a48]' : 'bg-[#c89d66]'}`}
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>

                                <div className="flex items-center justify-center gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => toggleRun(timer)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${timer.is_running
                                            ? 'bg-[#141413] text-[#e4e0d7] border border-[#262522]'
                                            : 'bg-[#e4e0d7] text-[#000000]'
                                            }`}
                                    >
                                        {timer.is_running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                        <span>{timer.is_running ? 'Pausar' : 'Iniciar'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleReset(timer)}
                                        className="px-3.5 py-2 bg-[#141413] hover:bg-[#1f1e1c] text-[#a39e93] border border-[#262522] rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Zerar</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}