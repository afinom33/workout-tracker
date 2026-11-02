import React, { useState } from 'react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { Edit3, Trash2, Check, X, Search, Dumbbell } from 'lucide-react';
import clsx from 'clsx';
import { MuscleGroup } from '../types';

const MUSCLE_GROUPS: MuscleGroup[] = ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Пресс', 'Кардио', 'Своя'];

const ExerciseList: React.FC = () => {
  const exercises = useWorkoutStore((state) => state.exercises);
  const sessions = useWorkoutStore((state) => state.sessions);
  const renameExercise = useWorkoutStore((state) => state.renameExercise);
  const updateExerciseGroup = useWorkoutStore((state) => state.updateExerciseGroup);
  const deleteExercise = useWorkoutStore((state) => state.deleteExercise);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState<MuscleGroup>('Грудь');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<MuscleGroup | 'Все'>('Все');

  const startEdit = (id: string, name: string, group: MuscleGroup) => {
    setEditingId(id);
    setEditName(name);
    setEditGroup(group);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      renameExercise(editingId, editName.trim());
      updateExerciseGroup(editingId, editGroup);
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleDelete = (id: string, name: string) => {
    const usedInSessions = sessions.some(s => s.entries.some(e => e.exerciseId === id));
    const msg = usedInSessions
      ? `Упражнение "${name}" используется в истории тренировок. При удалении оно пропадет из статистики. Удалить?`
      : `Удалить упражнение "${name}"?`;
    if (window.confirm(msg)) {
      deleteExercise(id);
    }
  };

  // Count how many sessions include this exercise
  const getUsageCount = (exId: string) => {
    return sessions.filter(s => s.entries.some(e => e.exerciseId === exId)).length;
  };

  // Get last performance
  const getLastPerf = (exId: string) => {
    return useWorkoutStore.getState().getLastPerformance(exId);
  };

  const filtered = exercises
    .filter(ex => filterGroup === 'Все' || ex.muscleGroup === filterGroup)
    .filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="mt-4">
        <h2 className="text-4xl font-extrabold tracking-tight text-gradient">Упражнения</h2>
        <p className="text-textMuted mt-1">Управление списком упражнений ({exercises.length})</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск упражнений..."
          className="w-full bg-background border border-panelBorder rounded-2xl pl-11 pr-4 py-3 focus:border-primary outline-none text-textMain"
        />
      </div>

      {/* Filter by group */}
      <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
        <button
          className={clsx("px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors", filterGroup === 'Все' ? "bg-primary text-primaryText" : "bg-element text-textMain hover:bg-elementHover")}
          onClick={() => setFilterGroup('Все')}
        >
          Все
        </button>
        {MUSCLE_GROUPS.map(mg => (
          <button
            key={mg}
            className={clsx("px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors", filterGroup === mg ? "bg-primary text-primaryText" : "bg-element text-textMain hover:bg-elementHover")}
            onClick={() => setFilterGroup(mg)}
          >
            {mg}
          </button>
        ))}
      </div>

      {/* Exercise cards */}
      {filtered.length === 0 ? (
        <div className="glass-panel p-8 rounded-3xl text-center">
          <Dumbbell size={48} className="mx-auto text-textMuted mb-4 opacity-40" />
          <p className="text-textMuted">
            {exercises.length === 0
              ? 'Список пуст. Добавьте упражнения во время тренировки!'
              : 'Ничего не найдено по вашему запросу.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ex => {
            const usageCount = getUsageCount(ex.id);
            const lastPerf = getLastPerf(ex.id);
            const isEditing = editingId === ex.id;

            return (
              <div key={ex.id} className="glass-panel rounded-2xl overflow-hidden">
                {isEditing ? (
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-xs text-textMuted mb-1">Название</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-background border border-panelBorder rounded-xl p-3 focus:border-primary outline-none text-textMain"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-textMuted mb-1">Категория</label>
                      <select
                        value={editGroup}
                        onChange={(e) => setEditGroup(e.target.value as MuscleGroup)}
                        className="w-full bg-background border border-panelBorder rounded-xl p-3 focus:border-primary outline-none text-textMain"
                      >
                        {MUSCLE_GROUPS.map(mg => (
                          <option key={mg} value={mg}>{mg}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={cancelEdit} className="flex-1 bg-element hover:bg-elementHover text-textMain font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 transition-colors">
                        <X size={16} /> Отмена
                      </button>
                      <button onClick={saveEdit} disabled={!editName.trim()} className="flex-1 bg-primary text-primaryText font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 disabled:opacity-50 transition-colors">
                        <Check size={16} /> Сохранить
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-textMain truncate">{ex.name}</span>
                        <span className="text-xs text-secondary bg-secondary/10 px-2 py-0.5 rounded-md flex-shrink-0">{ex.muscleGroup}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-textMuted">
                        <span>{usageCount} {usageCount === 1 ? 'тренировка' : usageCount < 5 ? 'тренировки' : 'тренировок'}</span>
                        {lastPerf && (
                          <span>• Макс: {lastPerf.maxWeight} кг × {lastPerf.maxReps}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEdit(ex.id, ex.name, ex.muscleGroup)}
                        className="p-2.5 rounded-xl bg-element hover:bg-elementHover text-textMuted hover:text-primary transition-colors"
                        title="Редактировать"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(ex.id, ex.name)}
                        className="p-2.5 rounded-xl bg-element hover:bg-danger text-textMuted hover:text-dangerText transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExerciseList;
