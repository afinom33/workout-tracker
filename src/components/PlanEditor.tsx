import React, { useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  parseWeekday,
} from '../utils/workoutPlanCsv';
import type { PlannedExercise, PlannedSet, Weekday, WorkoutPlan } from '../types';

interface PlanEditorProps {
  plan: WorkoutPlan;
  onClose: () => void;
}

interface DraftSet {
  id: string;
  weight: string;
  reps: string;
  note?: string;
}

interface DraftExercise {
  id: string;
  exerciseId: string;
  sets: DraftSet[];
}

const newId = () => crypto.randomUUID();

const toDraftSets = (sets: PlannedSet[]): DraftSet[] =>
  [...sets]
    .sort((a, b) => a.order - b.order)
    .map((set) => ({
      id: newId(),
      weight: String(set.weight),
      reps: String(set.reps),
      ...(set.note ? { note: set.note } : {}),
    }));

const toDraftExercises = (plan: WorkoutPlan): DraftExercise[] =>
  [...plan.exercises]
    .sort((a, b) => a.order - b.order)
    .map((exercise) => ({
      id: newId(),
      exerciseId: exercise.exerciseId,
      sets: toDraftSets(exercise.sets),
    }));

const parseNumber = (value: string) => Number(value.trim().replace(',', '.'));

const PlanEditor: React.FC<PlanEditorProps> = ({ plan, onClose }) => {
  const exercises = useWorkoutStore((state) => state.exercises);
  const updatePlan = useWorkoutStore((state) => state.updatePlan);

  const [name, setName] = useState(plan.name);
  const [week, setWeek] = useState(String(plan.week));
  const [day, setDay] = useState<Weekday>(plan.day);
  const [draft, setDraft] = useState<DraftExercise[]>(() => toDraftExercises(plan));
  const [error, setError] = useState<string | null>(null);

  const addExercise = (exerciseId: string) => {
    setDraft((current) => [
      ...current,
      { id: newId(), exerciseId, sets: [{ id: newId(), weight: '0', reps: '10' }] },
    ]);
  };

  const removeExercise = (id: string) => {
    setDraft((current) => current.filter((exercise) => exercise.id !== id));
  };

  const addSet = (exerciseId: string) => {
    setDraft((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: [...exercise.sets, { id: newId(), weight: '0', reps: '10' }],
            }
          : exercise,
      ),
    );
  };

  const removeSet = (exerciseId: string, setId: string) => {
    setDraft((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }
          : exercise,
      ),
    );
  };

  const updateSet = (exerciseId: string, setId: string, patch: Partial<DraftSet>) => {
    setDraft((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId ? { ...set, ...patch } : set,
              ),
            }
          : exercise,
      ),
    );
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const weekNumber = Number(week);

    if (!trimmedName) {
      setError('Укажите название тренировки.');
      return;
    }
    if (!Number.isInteger(weekNumber) || weekNumber < 1) {
      setError('Номер недели должен быть целым числом от 1.');
      return;
    }
    if (!parseWeekday(day)) {
      setError('Выберите день недели.');
      return;
    }
    if (draft.length === 0) {
      setError('Добавьте хотя бы одно упражнение.');
      return;
    }
    if (draft.some((exercise) => exercise.sets.length === 0)) {
      setError('У каждого упражнения должен быть хотя бы один подход.');
      return;
    }

    const result: PlannedExercise[] = [];

    for (const [exerciseIndex, exercise] of draft.entries()) {
      const sets: PlannedSet[] = [];

      for (const [setIndex, set] of exercise.sets.entries()) {
        const weight = parseNumber(set.weight);
        const reps = Number(set.reps.trim());

        if (!Number.isFinite(weight) || weight < 0) {
          setError('Вес должен быть числом не меньше 0.');
          return;
        }
        if (!Number.isInteger(reps) || reps < 1) {
          setError('Количество повторений должно быть целым числом от 1.');
          return;
        }

        sets.push({
          id: newId(),
          weight,
          reps,
          order: setIndex + 1,
          ...(set.note ? { note: set.note } : {}),
        });
      }

      result.push({
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        order: exerciseIndex + 1,
        sets,
      });
    }

    updatePlan({
      ...plan,
      name: trimmedName,
      week: weekNumber,
      day,
      exercises: result,
    });
    onClose();
  };

  const availableExercises = exercises.filter(
    (exercise) => !draft.some((item) => item.exerciseId === exercise.id),
  );

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="glass-panel w-full max-w-lg rounded-3xl p-5 space-y-4 max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Редактировать тренировку</h3>
            <p className="text-xs text-textMuted mt-1">
              Изменения затронут только шаблон, история останется прежней.
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

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 col-span-2">
            <span className="text-xs text-textMuted">Название</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full bg-background border border-panelBorder rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Например, Ноги"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-textMuted">Неделя</span>
            <input
              type="number"
              min={1}
              step={1}
              value={week}
              onChange={(event) => setWeek(event.target.value)}
              className="w-full bg-background border border-panelBorder rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-textMuted">День</span>
            <select
              value={day}
              onChange={(event) => setDay(event.target.value as Weekday)}
              className="w-full bg-background border border-panelBorder rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {WEEKDAY_ORDER.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {WEEKDAY_LABELS[weekday]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-3 overflow-y-auto pr-1">
          {draft.length === 0 && (
            <p className="text-sm text-textMuted text-center py-4">
              Добавьте упражнения из справочника.
            </p>
          )}

          {draft.map((exercise, exerciseIndex) => {
            const exerciseName =
              exercises.find((item) => item.id === exercise.exerciseId)?.name ??
              'Удалённое упражнение';

            return (
              <div key={exercise.id} className="bg-element rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {exerciseIndex + 1}. {exerciseName}
                  </p>
                  <button
                    onClick={() => removeExercise(exercise.id)}
                    className="p-1.5 rounded-full text-textMuted hover:text-dangerText transition-colors"
                    aria-label="Удалить упражнение"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {exercise.sets.map((set, setIndex) => (
                    <div key={set.id} className="flex items-center gap-2">
                      <span className="text-[11px] text-textMuted w-5 text-center">
                        {setIndex + 1}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        inputMode="decimal"
                        value={set.weight}
                        onChange={(event) =>
                          updateSet(exercise.id, set.id, { weight: event.target.value })
                        }
                        className="w-20 bg-background border border-panelBorder rounded-lg px-2 py-1.5 text-sm outline-none focus:border-primary"
                        aria-label="Вес"
                      />
                      <span className="text-xs text-textMuted">кг ×</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={set.reps}
                        onChange={(event) =>
                          updateSet(exercise.id, set.id, { reps: event.target.value })
                        }
                        className="w-16 bg-background border border-panelBorder rounded-lg px-2 py-1.5 text-sm outline-none focus:border-primary"
                        aria-label="Повторы"
                      />
                      <span className="text-xs text-textMuted">раз</span>
                      <button
                        onClick={() => removeSet(exercise.id, set.id)}
                        className="p-1 rounded-full text-textMuted hover:text-dangerText transition-colors ml-auto"
                        aria-label="Удалить подход"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => addSet(exercise.id)}
                  className="text-xs font-semibold text-primary flex items-center gap-1 hover:opacity-80"
                >
                  <Plus size={14} /> Добавить подход
                </button>
              </div>
            );
          })}

          <div className="space-y-1">
            <span className="text-xs text-textMuted">Добавить упражнение</span>
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) addExercise(event.target.value);
              }}
              className="w-full bg-background border border-panelBorder rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Выберите упражнение…</option>
              {availableExercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name} ({exercise.muscleGroup})
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="text-sm text-dangerText bg-dangerText/10 border border-dangerText/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          className="w-full bg-primary text-primaryText font-bold py-3 rounded-xl flex items-center justify-center gap-2"
        >
          <Save size={20} /> Сохранить
        </button>
      </div>
    </div>
  );
};

export default PlanEditor;
