import React, { useState } from 'react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { Play, Flame, Trophy, Target, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { GoalType } from '../types';

interface DashboardProps {
  onStartWorkout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onStartWorkout }) => {
  const stats = useWorkoutStore((state) => state.stats);
  const sessions = useWorkoutStore((state) => state.sessions);
  const currentSession = useWorkoutStore((state) => state.currentSession);
  const startSession = useWorkoutStore((state) => state.startSession);
  const activeGoal = useWorkoutStore((state) => state.activeGoal);
  const setGoal = useWorkoutStore((state) => state.setGoal);
  const updateCurrentWeight = useWorkoutStore((state) => state.updateCurrentWeight);

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>('Набор массы');
  const [startWeight, setStartWeight] = useState<number>(75);
  
  const [weightInput, setWeightInput] = useState<string>('');
  
  const handleStart = () => {
    if (!currentSession) {
      startSession();
    }
    onStartWorkout();
  };

  const handleSetGoal = () => {
    setGoal(goalType, startWeight);
    setShowGoalForm(false);
  };

  const handleUpdateWeight = () => {
    const w = parseFloat(weightInput);
    if (!isNaN(w)) {
      updateCurrentWeight(w);
      setWeightInput('');
    }
  };

  const [selectedSession, setSelectedSession] = useState<typeof sessions[0] | null>(null);

  const recentSessions = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      <div className="flex justify-between items-center mt-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Привет, <span className="text-gradient">Атлет</span>!</h1>
          <p className="text-textMuted mt-1">Готов стать сильнее сегодня?</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel flex flex-col items-center justify-center p-5 rounded-3xl">
          <Flame size={32} className="text-orange-500 mb-2" />
          <span className="text-2xl font-bold">{stats.streak}</span>
          <span className="text-xs text-textMuted uppercase tracking-wider">Дней подряд</span>
        </div>
        <div className="glass-panel flex flex-col items-center justify-center p-5 rounded-3xl">
          <Trophy size={32} className="text-yellow-400 mb-2" />
          <span className="text-2xl font-bold">{stats.totalWorkouts}</span>
          <span className="text-xs text-textMuted uppercase tracking-wider">Тренировок</span>
        </div>
      </div>

      {/* Goal Cycle Tracker */}
      <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
        <div className="absolute -top-10 -right-10 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity duration-500 transform group-hover:scale-110">
          <Target size={150} />
        </div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Target size={20} className="text-secondary" />
          Текущая цель
        </h2>

        {!activeGoal && !showGoalForm ? (
          <div className="text-center">
            <p className="text-sm text-textMuted mb-4">Установите цикл (сушка/масса), чтобы отслеживать свой вес.</p>
            <button 
              onClick={() => setShowGoalForm(true)}
              className="bg-element hover:bg-elementHover text-textMain px-4 py-2 rounded-xl text-sm font-bold w-full transition-colors"
            >
              Выбрать цель
            </button>
          </div>
        ) : showGoalForm ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button 
                onClick={() => setGoalType('Набор массы')}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${goalType === 'Набор массы' ? 'bg-primary text-primaryText' : 'bg-element hover:bg-elementHover text-textMain'}`}
              >
                Масса
              </button>
              <button 
                onClick={() => setGoalType('Сушка')}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${goalType === 'Сушка' ? 'bg-primary text-primaryText' : 'bg-element hover:bg-elementHover text-textMain'}`}
              >
                Сушка
              </button>
              <button 
                onClick={() => setGoalType('Поддержание')}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${goalType === 'Поддержание' ? 'bg-primary text-primaryText' : 'bg-element hover:bg-elementHover text-textMain'}`}
              >
                Баланс
              </button>
            </div>
            <div>
              <label className="block text-xs text-textMuted mb-1">Текущий вес (кг)</label>
              <input 
                type="number" 
                value={startWeight}
                onChange={(e) => setStartWeight(parseFloat(e.target.value) || 0)}
                className="w-full bg-background border border-panelBorder rounded-xl p-3 focus:border-primary outline-none text-textMain"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowGoalForm(false)} className="flex-1 bg-element hover:bg-elementHover text-textMain py-3 rounded-xl font-bold transition-colors">Отмена</button>
              <button onClick={handleSetGoal} className="flex-1 bg-primary text-primaryText py-3 rounded-xl font-bold transition-colors">Начать цикл</button>
            </div>
          </div>
        ) : activeGoal && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-element p-4 rounded-2xl">
              <div>
                <div className="text-sm font-bold text-primary flex items-center gap-1">
                  {activeGoal.type === 'Набор массы' ? <TrendingUp size={16}/> : activeGoal.type === 'Сушка' ? <TrendingDown size={16}/> : <Scale size={16}/>}
                  {activeGoal.type}
                </div>
                <div className="text-xs text-textMuted mt-1">
                  В процессе: {differenceInDays(new Date(), new Date(activeGoal.startDate))} дней
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-textMuted">Старт: {activeGoal.startWeight} кг</div>
                <div className="text-xl font-bold">{activeGoal.currentWeight || activeGoal.startWeight} кг</div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <input 
                type="number" 
                placeholder="Новый вес..."
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="flex-1 bg-background border border-gray-700 rounded-xl px-3 py-2 text-sm focus:border-primary outline-none"
              />
              <button 
                onClick={handleUpdateWeight}
                disabled={!weightInput}
                className="bg-secondary text-black px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50"
              >
                Обновить
              </button>
            </div>
            <button onClick={() => setShowGoalForm(true)} className="w-full text-xs text-textMuted pt-2 hover:text-white">Изменить цель / Начать заново</button>
          </div>
        )}
      </div>

      <button 
        onClick={handleStart}
        className="w-full bg-primary text-primaryText font-extrabold text-xl py-6 rounded-3xl shadow-[0_0_20px_rgba(57,255,20,0.4)] hover:animate-glow flex items-center justify-center gap-3 active:scale-95 transition-all duration-300 transform hover:-translate-y-1"
      >
        <Play fill="currentColor" size={24} />
        {currentSession ? 'Продолжить тренировку' : 'Начать тренировку'}
      </button>

      {/* Recent Activity */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Последняя активность</h2>
        {recentSessions.length === 0 ? (
          <div className="glass-panel p-6 rounded-3xl text-center text-textMuted">
            Здесь будет история ваших тренировок. Самое время начать первую!
          </div>
        ) : (
          <div className="space-y-4">
            {recentSessions.map(session => (
              <button 
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className="w-full text-left glass-panel p-5 rounded-3xl flex justify-between items-center transition-transform hover:scale-[1.02] hover:bg-white/5"
              >
                <div>
                  <div className="font-bold text-lg text-textMain">Тренировка</div>
                  <div className="text-sm text-textMuted">
                    {formatDistanceToNow(new Date(session.date), { addSuffix: true, locale: ru })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">{session.entries.length} упр.</div>
                  <div className="text-sm text-textMuted">{session.durationMinutes} мин</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-background border border-panelBorder w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl overflow-hidden slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="p-5 border-b border-panelBorder flex justify-between items-center sticky top-0 bg-background/95 backdrop-blur z-10">
              <div>
                <h3 className="font-bold text-xl text-textMain">Детали тренировки</h3>
                <div className="text-xs text-textMuted mt-0.5">
                  {new Date(selectedSession.date).toLocaleString('ru-RU')} • {selectedSession.durationMinutes} мин
                </div>
              </div>
              <button onClick={() => setSelectedSession(null)} className="p-2 bg-element hover:bg-elementHover rounded-full transition-colors text-textMuted">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-6">
              {selectedSession.entries.length === 0 ? (
                <div className="text-center text-textMuted py-8">Нет данных об упражнениях</div>
              ) : (
                selectedSession.entries.map((entry, idx) => {
                  const ex = useWorkoutStore.getState().exercises.find(e => e.id === entry.exerciseId);
                  const validSets = entry.sets.filter(s => s.completed || (s.weight > 0 && s.reps > 0));
                  
                  return (
                    <div key={entry.id} className="bg-element/50 rounded-2xl p-4">
                      <div className="font-bold text-primary mb-3 text-lg flex items-center gap-2">
                        <span className="text-textMuted text-sm">{idx + 1}.</span> 
                        {ex?.name || 'Удаленное упражнение'}
                      </div>
                      
                      {validSets.length === 0 ? (
                        <div className="text-sm text-textMuted">Нет завершенных подходов</div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-[30px_1fr_1fr] text-xs text-textMuted uppercase tracking-wider font-bold text-center mb-1">
                            <span>#</span>
                            <span>Вес</span>
                            <span>Повт</span>
                          </div>
                          {validSets.map((set, sIdx) => (
                            <div key={set.id} className="grid grid-cols-[30px_1fr_1fr] text-sm font-medium items-center text-center py-1.5 bg-background rounded-lg">
                              <span className="text-textMuted">{sIdx + 1}</span>
                              <span className="text-textMain">{set.weight} кг</span>
                              <span className="text-textMain">{set.reps}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
