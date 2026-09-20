import React, { useState } from 'react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { Check, Plus, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { MuscleGroup } from '../types';

interface WorkoutLoggerProps {
  onFinish: () => void;
}

const MUSCLE_GROUPS: MuscleGroup[] = ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Пресс', 'Кардио', 'Своя'];

const WorkoutLogger: React.FC<WorkoutLoggerProps> = ({ onFinish }) => {
  const currentSession = useWorkoutStore((state) => state.currentSession);
  const endSession = useWorkoutStore((state) => state.endSession);
  const exercises = useWorkoutStore((state) => state.exercises);
  const addEntryToSession = useWorkoutStore((state) => state.addEntryToSession);
  const addExercise = useWorkoutStore((state) => state.addExercise);
  
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [activeMuscleGroup, setActiveMuscleGroup] = useState<MuscleGroup | 'Все'>('Все');
  
  // Custom Exercise State
  const [showNewExerciseForm, setShowNewExerciseForm] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState<MuscleGroup>('Грудь');
  const [newExSets, setNewExSets] = useState<number>(3); // Default sets

  const [startTime] = useState(Date.now()); 

  if (!currentSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-20">
        <p className="text-textMuted mb-4">Тренировка не начата</p>
        <button onClick={onFinish} className="bg-primary text-black px-6 py-2 rounded-xl font-bold">
          Вернуться на главную
        </button>
      </div>
    );
  }

  const handleFinish = () => {
    if (window.confirm('Завершить тренировку?')) {
      const duration = Math.round((Date.now() - startTime) / 60000);
      endSession(duration);
      onFinish();
    }
  };

  const filteredExercises = activeMuscleGroup === 'Все' 
    ? exercises 
    : exercises.filter(e => e.muscleGroup === activeMuscleGroup);

  const handleCreateExercise = () => {
    if (newExName.trim() === '') return;
    const newId = addExercise(newExName, newExGroup);
    addEntryToSession(newId, newExSets);
    setShowNewExerciseForm(false);
    setShowExerciseSelector(false);
    setNewExName('');
  };

  const handleSelectExisting = (exId: string) => {
    addEntryToSession(exId, newExSets);
    setShowExerciseSelector(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-2xl font-bold">Тренировка</h2>
        <button 
          onClick={handleFinish}
          className="text-dangerText font-bold border border-danger/50 bg-danger/20 px-4 py-2 rounded-xl hover:bg-danger/40 transition-colors"
        >
          Завершить
        </button>
      </div>

      {currentSession.entries.length === 0 ? (
        <div className="text-center text-textMuted py-10 glass-panel rounded-3xl">
          Вы еще не добавили ни одного упражнения.
        </div>
      ) : (
        <div className="space-y-6">
          {currentSession.entries.map((entry, index) => (
            <ExerciseEntry key={entry.id} entryId={entry.id} exerciseId={entry.exerciseId} index={index + 1} />
          ))}
        </div>
      )}

      {!showExerciseSelector ? (
        <button 
          onClick={() => setShowExerciseSelector(true)}
          className="w-full glass-panel text-textMain font-bold py-5 rounded-3xl flex items-center justify-center gap-2 hover:bg-white/5 transition-all duration-300 transform hover:-translate-y-1"
        >
          <Plus size={24} className="text-primary" />
          Добавить упражнение
        </button>
      ) : (
        <div className="glass-panel p-5 rounded-3xl slide-in-from-top-4 animate-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Выбор упражнения</h3>
            <button onClick={() => setShowExerciseSelector(false)} className="text-textMuted hover:text-white transition-colors"><X size={24} /></button>
          </div>
          
          {/* Sets count configuration before picking exercise */}
          <div className="mb-4 bg-element p-3 rounded-2xl flex items-center justify-between">
            <span className="text-sm font-medium text-textMain">Кол-во подходов:</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setNewExSets(Math.max(1, newExSets - 1))} className="bg-background h-8 w-8 rounded-lg font-bold text-textMain hover:bg-elementHover">-</button>
              <span className="font-bold w-4 text-center text-textMain">{newExSets}</span>
              <button onClick={() => setNewExSets(newExSets + 1)} className="bg-background h-8 w-8 rounded-lg font-bold text-textMain hover:bg-elementHover">+</button>
            </div>
          </div>
          
          {!showNewExerciseForm ? (
            <>
              <div className="flex overflow-x-auto pb-2 mb-4 gap-2 no-scrollbar">
                <button 
                  className={clsx("px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors", activeMuscleGroup === 'Все' ? "bg-primary text-primaryText" : "bg-element text-textMain hover:bg-elementHover")}
                  onClick={() => setActiveMuscleGroup('Все')}
                >
                  Все
                </button>
                {MUSCLE_GROUPS.map(mg => (
                  <button 
                    key={mg}
                    className={clsx("px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors", activeMuscleGroup === mg ? "bg-primary text-primaryText" : "bg-element text-textMain hover:bg-elementHover")}
                    onClick={() => setActiveMuscleGroup(mg)}
                  >
                    {mg}
                  </button>
                ))}
              </div>

              {exercises.length === 0 ? (
                <div className="text-center py-6 text-textMuted text-sm">
                  Список пуст. Добавьте свое первое упражнение!
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mb-4">
                  {filteredExercises.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => handleSelectExisting(ex.id)}
                      className="w-full text-left bg-element p-3 rounded-xl hover:bg-elementHover flex justify-between items-center transition-colors border border-transparent hover:border-primary/50 text-textMain"
                    >
                      <span className="font-medium">{ex.name}</span>
                      <span className="text-xs text-secondary bg-secondary/10 px-2 py-1 rounded-md">{ex.muscleGroup}</span>
                    </button>
                  ))}
                </div>
              )}
              
              <button 
                onClick={() => setShowNewExerciseForm(true)}
                className="w-full bg-primary/10 text-primary border border-primary/30 font-bold py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Создать новое упражнение
              </button>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="block text-xs text-textMuted mb-1">Название упражнения</label>
                <input 
                  type="text" 
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  placeholder="Например: Жим лежа"
                  className="w-full bg-background border border-panelBorder rounded-xl p-3 focus:border-primary outline-none text-textMain"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-xs text-textMuted mb-1">Категория мышц</label>
                <select 
                  value={newExGroup}
                  onChange={(e) => setNewExGroup(e.target.value as MuscleGroup)}
                  className="w-full bg-background border border-panelBorder rounded-xl p-3 focus:border-primary outline-none text-textMain"
                >
                  {MUSCLE_GROUPS.map(mg => (
                    <option key={mg} value={mg}>{mg}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setShowNewExerciseForm(false)}
                  className="flex-1 bg-element text-textMain hover:bg-elementHover font-bold py-3 rounded-xl"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleCreateExercise}
                  disabled={!newExName.trim()}
                  className="flex-1 bg-primary text-primaryText font-bold py-3 rounded-xl disabled:opacity-50"
                >
                  Сохранить
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ExerciseEntry: React.FC<{ entryId: string, exerciseId: string, index: number }> = ({ entryId, exerciseId, index }) => {
  const exercises = useWorkoutStore((state) => state.exercises);
  const currentSession = useWorkoutStore((state) => state.currentSession);
  const addSetToEntry = useWorkoutStore((state) => state.addSetToEntry);
  const updateSet = useWorkoutStore((state) => state.updateSet);
  const removeSetFromEntry = useWorkoutStore((state) => state.removeSetFromEntry);
  
  const exercise = exercises.find(e => e.id === exerciseId);
  const entry = currentSession?.entries.find(e => e.id === entryId);

  if (!exercise || !entry) return null;

  return (
    <div className="glass-panel rounded-3xl overflow-hidden mb-6">
      <div className="p-5 border-b border-white/5 bg-white/5 flex justify-between items-center">
        <h3 className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">{index}. {exercise.name}</h3>
        <span className="text-xs text-textMuted font-bold uppercase tracking-wider">{exercise.muscleGroup}</span>
      </div>
      
      <div className="p-5">
        <div className="grid grid-cols-[30px_1fr_1fr_40px_30px] gap-2 mb-2 text-xs font-bold text-textMuted uppercase tracking-wider text-center">
          <span>Сет</span>
          <span>Вес (кг)</span>
          <span>Повт.</span>
          <span></span>
          <span></span>
        </div>
        
        <div className="space-y-3">
          {entry.sets.map((set, setIndex) => (
            <div key={set.id} className={clsx("grid grid-cols-[30px_1fr_1fr_40px_30px] gap-2 items-center transition-opacity duration-300", set.completed ? "opacity-60" : "opacity-100")}>
              <div className="text-center font-bold text-textMuted">{setIndex + 1}</div>
              
              <input 
                type="number" 
                value={set.weight || ''}
                onChange={(e) => updateSet(entryId, set.id, parseFloat(e.target.value) || 0, set.reps, set.completed)}
                disabled={set.completed}
                className="bg-element border border-transparent rounded-lg p-2 text-center text-lg font-bold w-full focus:border-primary outline-none transition-colors disabled:bg-transparent disabled:border-transparent text-textMain"
                placeholder="0"
              />
              
              <input 
                type="number" 
                value={set.reps || ''}
                onChange={(e) => updateSet(entryId, set.id, set.weight, parseInt(e.target.value) || 0, set.completed)}
                disabled={set.completed}
                className="bg-element border border-transparent rounded-lg p-2 text-center text-lg font-bold w-full focus:border-primary outline-none transition-colors disabled:bg-transparent disabled:border-transparent text-textMain"
                placeholder="0"
              />

              <button 
                onClick={() => updateSet(entryId, set.id, set.weight, set.reps, !set.completed)}
                className={clsx("h-10 w-10 rounded-xl flex items-center justify-center transition-colors mx-auto", 
                  set.completed ? "bg-primary text-primaryText" : "bg-element text-textMuted hover:bg-elementHover"
                )}
              >
                <Check size={20} strokeWidth={3} />
              </button>

              <button 
                onClick={() => removeSetFromEntry(entryId, set.id)}
                className="text-textMuted hover:text-red-400 transition-colors mx-auto flex items-center justify-center h-full w-full"
                disabled={set.completed}
              >
                {!set.completed && <Trash2 size={18} />}
              </button>
            </div>
          ))}
        </div>
        
        <button 
          onClick={() => addSetToEntry(entryId)}
          className="mt-4 w-full py-2 text-sm text-textMuted hover:text-textMain font-medium flex justify-center items-center gap-1 transition-colors"
        >
          <Plus size={16} /> Добавить подход
        </button>
      </div>
    </div>
  );
};

export default WorkoutLogger;
