import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Plus, Trash2, Clock } from 'lucide-react';

export default function TimersView() {
  const [timers, setTimers] = useState([]);
  const [newName, setNewName] = useState('');
  const [newMinutes, setNewMinutes] = useState(5);

  // Atualiza a contagem regressiva a cada 1 segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prevTimers) =>
        prevTimers.map((timer) => {
          if (!timer.isRunning || timer.timeLeft <= 0) return timer;
          const nextTime = timer.timeLeft - 1;
          return {
            ...timer,
            timeLeft: nextTime,
            isRunning: nextTime > 0 ? true : false
          };
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAddTimer = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const totalSeconds = Math.max(1, parseInt(newMinutes, 10) || 1) * 60;

    const newTimer = {
      id: Date.now().toString(),
      name: newName.trim(),
      totalSeconds,
      timeLeft: totalSeconds,
      isRunning: false
    };

    setTimers((prev) => [newTimer, ...prev]);
    setNewName('');
    setNewMinutes(5);
  };

  const toggleRun = (id) => {
    setTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isRunning: !t.isRunning } : t))
    );
  };

  const handleReset = (id) => {
    setTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t.id, timeLeft: t.totalSeconds, isRunning: false } : t))
    );
  };

  const handleDelete = (id) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
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
            <h2 className="text-lg font-bold text-[#e4e0d7]">Controle de Timers Simultâneos</h2>
            <p className="text-xs text-[#8c877e]">Adicione quantos cronômetros precisar para acompanhar suas impressões 3D ou processos.</p>
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
              className="w-full py-2 px-4 bg-[#e4e0d7] hover:bg-[#d5d0c5] text-[#000000] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Timer</span>
            </button>
          </div>
        </form>
      </div>

      {timers.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-[#262522] rounded-2xl p-12 text-center space-y-3">
          <Clock className="w-10 h-10 text-[#5e5a52] mx-auto" />
          <p className="text-sm font-semibold text-[#e4e0d7]">Nenhum timer ativo no momento</p>
          <p className="text-xs text-[#8c877e]">Preencha os campos acima para criar o seu primeiro cronômetro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {timers.map((timer) => {
            const isFinished = timer.timeLeft === 0;
            const progressPct = ((timer.totalSeconds - timer.timeLeft) / timer.totalSeconds) * 100;

            return (
              <div
                key={timer.id}
                className={`bg-[#0a0a0a] border rounded-2xl p-5 space-y-4 relative overflow-hidden transition ${
                  isFinished ? 'border-[#b94a48] bg-[#b94a48]/5' : timer.isRunning ? 'border-[#c89d66]' : 'border-[#262522]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-[#e4e0d7]">{timer.name}</h3>
                    <span className="text-[11px] text-[#8c877e]">
                      {isFinished ? 'Tempo Encerrado!' : timer.isRunning ? 'Rodando...' : 'Pausado'}
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
                    {formatTime(timer.timeLeft)}
                  </span>
                </div>

                {/* Barra de progresso */}
                <div className="w-full h-1.5 bg-[#141413] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${isFinished ? 'bg-[#b94a48]' : 'bg-[#c89d66]'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => toggleRun(timer.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                      timer.isRunning
                        ? 'bg-[#141413] text-[#e4e0d7] border border-[#262522]'
                        : 'bg-[#e4e0d7] text-[#000000]'
                    }`}
                  >
                    {timer.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{timer.isRunning ? 'Pausar' : 'Iniciar'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReset(timer.id)}
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