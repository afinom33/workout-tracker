import React, { useState, useMemo } from 'react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const ProgressCharts: React.FC = () => {
  const sessions = useWorkoutStore((state) => state.sessions);
  const exercises = useWorkoutStore((state) => state.exercises);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(exercises[0]?.id || '');
  const [metric, setMetric] = useState<'maxWeight' | 'volume'>('maxWeight');

  // Filter exercises that actually have data
  const exercisesWithData = useMemo(() => {
    const usedIds = new Set<string>();
    sessions.forEach(s => s.entries.forEach(e => usedIds.add(e.exerciseId)));
    return exercises.filter(ex => usedIds.has(ex.id));
  }, [sessions, exercises]);

  // If selected doesn't have data, select first available
  React.useEffect(() => {
    if (exercisesWithData.length > 0 && !exercisesWithData.find(e => e.id === selectedExerciseId)) {
      setSelectedExerciseId(exercisesWithData[0].id);
    }
  }, [exercisesWithData, selectedExerciseId]);

  const chartData = useMemo(() => {
    if (!selectedExerciseId) return [];

    const data: any[] = [];
    sessions.forEach(session => {
      const entry = session.entries.find(e => e.exerciseId === selectedExerciseId);
      if (entry && entry.sets.some(s => s.completed)) {
        const completedSets = entry.sets.filter(s => s.completed);
        const maxWeight = Math.max(...completedSets.map(s => s.weight));
        const volume = completedSets.reduce((acc, s) => acc + (s.weight * s.reps), 0);
        
        data.push({
          date: new Date(session.date).getTime(),
          dateStr: format(new Date(session.date), 'dd MMM', { locale: ru }),
          maxWeight,
          volume
        });
      }
    });

    return data.sort((a, b) => a.date - b.date);
  }, [sessions, selectedExerciseId]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="mt-4">
        <h2 className="text-4xl font-extrabold tracking-tight text-gradient">Прогресс</h2>
        <p className="text-textMuted mt-1">Отслеживайте свои силовые показатели</p>
      </div>

      {exercisesWithData.length === 0 ? (
        <div className="glass-panel p-8 rounded-3xl text-center">
          <p className="text-textMuted">Недостаточно данных. Завершите хотя бы одну тренировку.</p>
        </div>
      ) : (
        <>
          <div className="glass-panel p-5 rounded-3xl space-y-4">
            <div>
              <label className="block text-sm font-bold text-textMuted mb-2">Выберите упражнение:</label>
              <select 
                value={selectedExerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className="w-full bg-background border border-gray-700 rounded-xl p-3 text-textMain outline-none focus:border-primary"
              >
                {exercisesWithData.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-2 p-1 bg-background rounded-xl">
              <button 
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${metric === 'maxWeight' ? 'bg-primary text-black' : 'text-textMuted hover:text-textMain'}`}
                onClick={() => setMetric('maxWeight')}
              >
                Макс. вес
              </button>
              <button 
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${metric === 'volume' ? 'bg-primary text-black' : 'text-textMuted hover:text-textMain'}`}
                onClick={() => setMetric('volume')}
              >
                Тоннаж (Объем)
              </button>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-3xl h-[400px]">
            {chartData.length < 2 ? (
              <div className="h-full flex items-center justify-center text-textMuted text-center p-4">
                Нужно хотя бы 2 тренировки с этим упражнением для построения графика.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
                  <XAxis 
                    dataKey="dateStr" 
                    stroke="#A0A0B0" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#A0A0B0" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A1A24', border: '1px solid #333', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#39FF14', fontWeight: 'bold' }}
                    formatter={(value: number) => [value + (metric === 'maxWeight' ? ' кг' : ' кг'), metric === 'maxWeight' ? 'Макс. вес' : 'Объем']}
                    labelStyle={{ color: '#A0A0B0', marginBottom: '4px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={metric} 
                    stroke="#39FF14" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#0B0B0F', stroke: '#39FF14', strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: '#39FF14', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProgressCharts;
