import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Plus, Trash2, Clock } from 'lucide-react';

export default function TimersView({ supabase, session }) {
    const [timers, setTimers] = useState([]);
    const [newName, setNewName] = useState('');
    const [newMinutes, setNewMinutes] = useState(5);
    const [loading, setLoading] = useState(false);

    // Carrega os timers do Supabase e calcula o tempo restante real com base na hora atual
    useEffect(() => {
        if (!supabase || !session?.user) return;

        const fetchTimers = async () => {
            const { data, error } = await supabase
                .from('stl_timers')
                .select('*')
                .order('updated_at', { ascending: false });

            if (!error && data) {
                const now = Date.now();
                const updatedList = data.map((timer) => {
                    if (timer.is_running && timer.target_time) {
                        const diffSeconds = Math.round((new Date(timer.target_time).getTime() - now) / 1000);
                        const timeLeft = Math.max(0, diffSeconds);
                        return {
                            ...timer,
                            time_left: timeLeft,
                            is_running: timeLeft > 0 ? true : false
                        };
                    }
                    return timer;
                });
                setTimers(updatedList);
            }
        };

        fetchTimers();

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

    // Atualiza a tela a cada 1 segundo comparando com a hora real atual
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setTimers((prevTimers) =>
                prevTimers.map((timer) => {
                    if (!timer.is_running || !timer.target_time) return timer;
                    const diffSeconds = Math.round((new Date(timer.target_time).getTime() - now) / 1000);
                    const nextTime = Math.max(0, diffSeconds);

                    return {
                        ...timer,
                        time_left: nextTime,
                        is_running: nextTime > 0 ? true : false
                    };
                })
            );
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleAddTimer = async (e) => {
        e.preventDefault();
        if (!newName.trim() || !supabase || !session?.user) return;
        const totalSeconds = Math.max(1, parseInt(newMinutes, 10) || 1) * 60;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('stl_timers')
                .insert({
                    user_id: session.user.id,
                    name: newName.trim(),
                    total_seconds: totalSeconds,
                    time_left: totalSeconds,
                    is_running: false,
                    target_time: null
                })
                .select('*')
                .single();

            if (error) throw error;

            setTimers((prev) => [data, ...prev]);
            setNewName('');
            setNewMinutes(5);
        } catch (err) {
            console.error('Erro ao criar timer:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleRun = async (timer) => {
        if (!supabase) return;
        const nextState = !timer.is_running;
        let newTargetTime = null;

        if (nextState) {
            // Se for retomar/iniciar, calcula a hora exata de término somando os segundos que faltam
            newTargetTime = new Date(Date.now() + timer.time_left * 1000).toISOString();
        }

        setTimers((prev) =>
            prev.map((t) => (t.id === timer.id ? { ...t, is_running: nextState, target_time: newTargetTime } : t))
        );

        await supabase
            .from('stl_timers')
            .update({
                is_running: nextState,
                target_time: newTargetTime,
                updated_at: new Date().toISOString()
            })
            .eq('id', timer.id);
    };

    const handleReset = async (timer) => {
        if (!supabase) return;

        setTimers((prev) =>
            prev.map((t) => (t.id === timer.id ? { ...t, time_left: t.total_seconds, is_running: false, target_time: null } : t))
        );

        await supabase
            .from('stl_timers')
            .update({
                time_left: timer.total_seconds,
                is_running: false,
                target_time: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', timer.id);
    };

    const handleDelete = async (id) => {
        if (!supabase) return;
        setTimers((prev) => prev.filter((t) => t.id !== id));
        await supabase.from('stl_timers').delete().eq('id', id);
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
                        <h2 className="text-lg font-bold text-[#e4e0d7]">Timers em Segundo Plano</h2>
                        <p className="text-xs text-[#8c877e]">Eles continuam contando mesmo se você fechar a aba ou mudar de página.</p>
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
                    <p className="text-xs text-[#8c877e]">Adicione um cronômetro acima para começar.</p>
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
                                {timer.is_running && timer.target_time && (
                                    <p className="text-xs text-[#c89d66] font-medium">
                                        Término às {new Date(timer.target_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}

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