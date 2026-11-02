import React, { useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '../utils/workoutPlanCsv';
import type { PlannedSet, Weekday, WorkoutPlan } from '../types';

interface PlanEditorProps {
  plan: WorkoutPlan;
  onClose: () => void;
}

/** Редактирование шаблона: название, день, состав упражнений и плановые подходы. */
const PlanEditor: React.FC<PlanEditorProps> = ({ plan, onClose }) => {
  const exercises = useWorkoutStore((state) => state.exercises);
  const updatePlan = useWorkoutStore((state) => state.updatePlan);

  const [draft, setDraft] = useState<WorkoutPlan>(() => JSON.parse(JSON.stringify(plan)) as WorkoutPlan);
  const [newExerciseId, setNewExerciseId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const exerciseName = (exerciseId: string) =>
    exercises.find((exercise) => exercise.id === exerciseId)?.name ?? 'Удалённое упражнение';

  const patchSet = (exerciseId: string, setId: string, patch: Partial<PlannedSet>) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
            }
          : exercise,
      ),
    }));
  };

  const addSet = (exerciseId: string) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        const lastSet = exercise.sets[exercise.sets.length - 1];
        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              id: crypto.randomUUID(),
              weight: lastSet ? lastSet.weight : 0,
              reps: lastSet ? lastSet.reps : 10,
              order: exercise.sets.length + 1,
            },
          ],
        };
      }),
    }));
  };

  const removeSet = (exerciseId: string, setId: string) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }
          : exercise,
      ),
    }));
  };

  const removeExercise = (exerciseId: string) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId),
    }));
  };

  const addExercise = () => {
    const exercise = exercises.find((candidate) => candidate.id === newExerciseId);
    if (!exercise) return;
    setDraft((current) => ({
      ...current,
      exercises: [
        ...current.exercises,
        {
          id: crypto.randomUUID(),
          exerciseId: exercise.id,
          order: current.exercises.length + 1,
          sets: [{ id: crypto.randomUUID(), weight: 0, reps: 10, order: 1 }],
        },
      ],
    }));
    setNewExerciseId('');
  };

  const handleSave = () => {
    const name = draft.name.trim();
    if (name === '') {
      setError('Название тренировки не может быть пустым.');
      return;
    }
    if (draft.exercises.length === 0) {
      setError('В тренировке должно остаться хотя бы одно упражнение.');
      return;
    }
    if (draft.exercises.some((exercise) => exercise.sets.length === 0)) {
      setError('В каждом упражнении должен остаться хотя бы один подход.');
      return;
    }

    updatePlan({
      ...draft,
      name,
      exercises: draft.exercises.map((exercise, exerciseIndex) => ({
        ...exercise,
        order: exerciseIndex + 1,
        sets: exercise.sets.map((set, setIndex) => ({
          ...set,
          weight: Number.isFinite(set.weight) ? Math.max(0, set.weight) : 0,
          reps: Number.isFinite(set.reps) ? Math.max(1, Math.round(set.reps)) : 1,
          order: setIndex + 1,
        })),
      })),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="glass-panel w-full max-w-lg rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Редактировать тренировку</h3>
            <p className="text-xs text-textMuted mt-1">
              Изменения затронут только шаблон, история тренировок останется прежней.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-element text-textMuted hover:text-textMain transition-colors"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-textMuted">Название</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              className="mt-1 w-full bg-background border border-panelBorder rounded-xl px-3 py-2 text-textMain outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="text-xs text-textMuted">День недели</span>
            <select
              value={draft.day}
              onChange={(event) =>
                setDraft((current) => ({ ...current, day: event.target.value as Weekday }))
              }
              className="mt-1 w-full bg-background border border-panelBorder rounded-xl px-3 py-2 text-textMain outline-none focus:border-primary"
            >
              {WEEKDAY_ORDER.map((day) => (
                <option key={day} value={day}>
                  {WEEKDAY_LABELS[day]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-3">
          {draft.exercises.map((exercise, exerciseIndex) => (
            <div key={exercise.id} className="bg-element rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm">
                  {exerciseIndex + 1}. {exerciseName(exercise.exerciseId)}
                </p>
                <button
                  onClick={() => removeExercise(exercise.id)}
                  className="p-1.5 rounded-lg text-textMuted hover:text-dangerText transition-colors"
                  aria-label="Удалить упражнение"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-1.5">
                {exercise.sets.map((set, setIndex) => (
                  <div key={set.id} className="flex items-center gap-2">
                    <span className="text-xs text-textMuted w-4">{setIndex + 1}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      value={set.weight}
                      onChange={(event) =>
                        patchSet(exercise.id, set.id, { weight: Number(event.target.value) })
                      }
                      className="w-20 bg-background border border-panelBorder rounded-lg px-2 py-1 text-sm text-textMain outline-none focus:border-primary"
                      aria-label="Вес, кг"
                    />
                    <span className="text-xs text-textMuted">кг ×</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={set.reps}
                      onChange={(event) =>
                        patchSet(exercise.id, set.id, { reps: Number(event.target.value) })
                      }
                      className="w-16 bg-background border border-panelBorder rounded-lg px-2 py-1 text-sm text-textMain outline-none focus:border-primary"
                      aria-label="Повторы"
                    />
                    <button
                      onClick={() => removeSet(exercise.id, set.id)}
                      className="ml-auto p-1 text-textMuted hover:text-dangerText transition-colors"
                      aria-label="Удалить подход"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addSet(exercise.id)}
                className="text-xs text-primary font-semibold flex items-center gap-1"
              >
                <Plus size={14} /> Добавить подход
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <select
            value={newExerciseId}
            onChange={(event) => setNewExerciseId(event.target.value)}
            className="flex-1 bg-background border border-panelBorder rounded-xl px-3 py-2 text-sm text-textMain outline-none focus:border-primary"
          >
            <option value="">Добавить упражнение…</option>
            {exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
          <button
            onClick={addExercise}
            disabled={!newExerciseId}
            className="px-3 rounded-xl bg-element hover:bg-elementHover text-textMain font-bold disabled:opacity-50"
            aria-label="Добавить упражнение"
          >
            <Plus size={18} />
          </button>
        </div>

        {error && <p className="text-sm text-dangerText">{error}</p>}

        <button
          onClick={handleSave}
          className="w-full bg-primary text-primaryText font-bold py-3 rounded-xl flex items-center justify-center gap-2"
        >
          <Check size={20} /> Сохранить
        </button>
      </div>
    </div>
  );
};

export default PlanEditor;
