import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Exercise,
  WorkoutSession,
  UserStats,
  WorkoutEntry,
  GoalCycle,
  GoalType,
  MuscleGroup,
  WorkoutPlan,
} from '../types';
import { normalizeExerciseName, planImportKey } from '../utils/workoutPlanCsv.ts';
import type { ParsedWorkoutPlan } from '../utils/workoutPlanCsv.ts';

export type ImportPlanMode = 'replace' | 'copy';

/** Старые сохранения/экспорты не знали недель: считаем такие планы первой неделей. */
const normalizeStoredPlans = (value: unknown): WorkoutPlan[] => {
  if (!Array.isArray(value)) return [];
  return value.map((rawPlan) => {
    const plan = rawPlan as WorkoutPlan;
    const week =
      typeof plan.week === 'number' && Number.isFinite(plan.week) && plan.week >= 1
        ? Math.round(plan.week)
        : 1;
    return { ...plan, week };
  });
};

export interface ImportPlansResult {
  imported: number;
  createdExercises: number;
}

interface WorkoutState {
  exercises: Exercise[];
  sessions: WorkoutSession[];
  plans: WorkoutPlan[];
  stats: UserStats;
  currentSession: WorkoutSession | null;
  activeGoal: GoalCycle | null;
  
  // Actions
  addExercise: (name: string, muscleGroup: MuscleGroup) => string;
  renameExercise: (id: string, newName: string) => void;
  updateExerciseGroup: (id: string, newGroup: MuscleGroup) => void;
  deleteExercise: (id: string) => void;
  startSession: () => void;
  endSession: (duration: number) => void;
  addEntryToSession: (exerciseId: string, setsCount?: number) => void;
  removeEntryFromSession: (entryId: string) => void;
  updateSet: (entryId: string, setId: string, weight: number, reps: number, completed: boolean) => void;
  addSetToEntry: (entryId: string) => void;
  removeSetFromEntry: (entryId: string, setId: string) => void;

  // Workout plans (imported from CSV)
  importPlans: (parsedPlans: ParsedWorkoutPlan[], modes?: Record<string, ImportPlanMode>) => ImportPlansResult;
  startSessionFromPlan: (planId: string) => boolean;
  updatePlan: (plan: WorkoutPlan) => void;
  deletePlan: (planId: string) => void;
  /** Удаляет все планы одной недели: «убрать неделю» одним действием. */
  deleteWeek: (week: number) => void;
  
  // Helpers
  getLastPerformance: (exerciseId: string) => { maxWeight: number; maxReps: number } | null;
  
  // Goal Management
  setGoal: (type: GoalType, startWeight: number, endDate?: string) => void;
  updateCurrentWeight: (weight: number) => void;

  // Data Management
  exportData: () => string;
  exportCsv: () => string;
  importData: (jsonData: string) => boolean;
  resetData: () => void;
  
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      exercises: [],
      sessions: [],
      plans: [],
      stats: { streak: 0, lastWorkoutDate: null, totalWorkouts: 0 },
      currentSession: null,
      activeGoal: null,
      theme: 'dark',

      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      addExercise: (name, muscleGroup) => {
        const id = crypto.randomUUID();
        set((state) => ({
          exercises: [...state.exercises, { id, name, muscleGroup }]
        }));
        return id;
      },

      renameExercise: (id, newName) => set((state) => ({
        exercises: state.exercises.map(ex => ex.id === id ? { ...ex, name: newName } : ex)
      })),

      updateExerciseGroup: (id, newGroup) => set((state) => ({
        exercises: state.exercises.map(ex => ex.id === id ? { ...ex, muscleGroup: newGroup } : ex)
      })),

      deleteExercise: (id) => set((state) => ({
        exercises: state.exercises.filter(ex => ex.id !== id)
      })),

      startSession: () => set(() => ({
        currentSession: {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          entries: [],
          durationMinutes: 0,
          isCompleted: false,
        }
      })),

      endSession: (duration) => set((state) => {
        if (!state.currentSession) return state;
        
        const completedSession = {
          ...state.currentSession,
          durationMinutes: duration,
          isCompleted: true,
        };

        const today = new Date().toDateString();
        const lastDate = state.stats.lastWorkoutDate ? new Date(state.stats.lastWorkoutDate).toDateString() : null;
        
        let newStreak = state.stats.streak;
        if (lastDate !== today) {
           const yesterday = new Date();
           yesterday.setDate(yesterday.getDate() - 1);
           if (lastDate === yesterday.toDateString()) {
             newStreak += 1;
           } else {
             newStreak = 1;
           }
        }

        return {
          sessions: [...state.sessions, completedSession],
          currentSession: null,
          stats: {
            streak: newStreak,
            lastWorkoutDate: new Date().toISOString(),
            totalWorkouts: state.stats.totalWorkouts + 1,
          }
        };
      }),

      addEntryToSession: (exerciseId, setsCount = 1) => set((state) => {
        if (!state.currentSession) return state;
        
        // Find last usage of this exercise to copy previous set data
        let previousSetTemplate = { weight: 0, reps: 0 };
        for (let i = state.sessions.length - 1; i >= 0; i--) {
          const entry = state.sessions[i].entries.find(e => e.exerciseId === exerciseId);
          if (entry && entry.sets.length > 0) {
            previousSetTemplate = { weight: entry.sets[0].weight, reps: entry.sets[0].reps };
            break;
          }
        }

        // Generate N sets based on user request (or 1 by default)
        const newSets = Array.from({ length: setsCount }).map(() => ({
          id: crypto.randomUUID(),
          weight: previousSetTemplate.weight,
          reps: previousSetTemplate.reps,
          completed: false
        }));

        const newEntry: WorkoutEntry = {
          id: crypto.randomUUID(),
          exerciseId,
          sets: newSets,
        };

        return {
          currentSession: {
            ...state.currentSession,
            entries: [...state.currentSession.entries, newEntry]
          }
        };
      }),

      removeEntryFromSession: (entryId) => set((state) => {
        if (!state.currentSession) return state;
        return {
          currentSession: {
            ...state.currentSession,
            entries: state.currentSession.entries.filter(e => e.id !== entryId)
          }
        };
      }),

      addSetToEntry: (entryId) => set((state) => {
        if (!state.currentSession) return state;
        const entries = state.currentSession.entries.map(entry => {
          if (entry.id === entryId) {
            const lastSet = entry.sets[entry.sets.length - 1];
            return {
              ...entry,
              sets: [...entry.sets, { 
                id: crypto.randomUUID(), 
                weight: lastSet ? lastSet.weight : 0, 
                reps: lastSet ? lastSet.reps : 0, 
                completed: false 
              }]
            };
          }
          return entry;
        });
        return { currentSession: { ...state.currentSession, entries } };
      }),

      removeSetFromEntry: (entryId, setId) => set((state) => {
        if (!state.currentSession) return state;
        const entries = state.currentSession.entries.map(entry => {
          if (entry.id === entryId) {
            return { ...entry, sets: entry.sets.filter(s => s.id !== setId) };
          }
          return entry;
        });
        return { currentSession: { ...state.currentSession, entries } };
      }),

      updateSet: (entryId, setId, weight, reps, completed) => set((state) => {
        if (!state.currentSession) return state;
        const entries = state.currentSession.entries.map(entry => {
          if (entry.id === entryId) {
            const sets = entry.sets.map(s => s.id === setId ? { ...s, weight, reps, completed } : s);
            return { ...entry, sets };
          }
          return entry;
        });
        return { currentSession: { ...state.currentSession, entries } };
      }),

      getLastPerformance: (exerciseId) => {
        const state = get();
        for (let i = state.sessions.length - 1; i >= 0; i--) {
          const entry = state.sessions[i].entries.find(e => e.exerciseId === exerciseId);
          if (entry && entry.sets.length > 0) {
            const validSets = entry.sets.filter(s => s.completed || (s.weight > 0 && s.reps > 0));
            if (validSets.length > 0) {
              // Find the set with the highest weight. If weights are equal, prefer higher reps.
              const bestSet = validSets.reduce((best, current) => {
                if (current.weight > best.weight) return current;
                if (current.weight === best.weight && current.reps > best.reps) return current;
                return best;
              }, validSets[0]);

              return { maxWeight: bestSet.weight, maxReps: bestSet.reps };
            }
          }
        }
        return null;
      },

      importPlans: (parsedPlans, modes = {}) => {
        let imported = 0;
        let createdExercises = 0;

        set((state) => {
          const exercises = [...state.exercises];
          const plans = [...state.plans];

          // Упражнения ищем по нормализованному имени: опечатки регистра и
          // лишние пробелы не должны плодить дубли в истории и прогрессе.
          const resolveExerciseId = (name: string) => {
            const key = normalizeExerciseName(name);
            const existing = exercises.find(
              (exercise) => normalizeExerciseName(exercise.name) === key,
            );
            if (existing) return existing.id;

            const created: Exercise = {
              id: crypto.randomUUID(),
              name: name.trim(),
              muscleGroup: 'Своя',
            };
            exercises.push(created);
            createdExercises += 1;
            return created.id;
          };

          // Тренировка определяется парой (week, workout_name).
          const takenKeys = new Set(plans.map((plan) => planImportKey(plan.week, plan.name)));

          const uniqueCopyName = (week: number, name: string) => {
            let candidate = `${name} (копия)`;
            let counter = 2;
            while (takenKeys.has(planImportKey(week, candidate))) {
              candidate = `${name} (копия ${counter})`;
              counter += 1;
            }
            return candidate;
          };

          parsedPlans.forEach((parsed) => {
            const week = Number.isFinite(parsed.week) ? Math.max(1, Math.round(parsed.week)) : 1;

            const builtExercises = [...parsed.exercises]
              .sort((a, b) => a.order - b.order)
              .map((exercise) => ({
                id: crypto.randomUUID(),
                exerciseId: resolveExerciseId(exercise.name),
                order: exercise.order,
                sets: [...exercise.sets]
                  .sort((a, b) => a.order - b.order)
                  .map((set) => ({
                    id: crypto.randomUUID(),
                    weight: set.weight,
                    reps: set.reps,
                    order: set.order,
                    ...(set.note ? { note: set.note } : {}),
                  })),
              }));

            const key = planImportKey(week, parsed.name);
            const existingIndex = plans.findIndex(
              (plan) => plan.week === week && planImportKey(plan.week, plan.name) === key,
            );
            const mode = modes[key];

            if (mode === 'replace' && existingIndex >= 0) {
              plans[existingIndex] = {
                ...plans[existingIndex],
                week,
                name: parsed.name.trim(),
                day: parsed.day,
                exercises: builtExercises,
              };
            } else {
              let name = parsed.name.trim();
              if (takenKeys.has(planImportKey(week, name))) {
                name = uniqueCopyName(week, name);
              }
              plans.push({
                id: crypto.randomUUID(),
                week,
                name,
                day: parsed.day,
                exercises: builtExercises,
                createdAt: new Date().toISOString(),
              });
              takenKeys.add(planImportKey(week, name));
            }

            imported += 1;
          });

          return { exercises, plans };
        });

        return { imported, createdExercises };
      },

      startSessionFromPlan: (planId) => {
        const state = get();
        const plan = state.plans.find((candidate) => candidate.id === planId);
        if (!plan) return false;

        const exerciseIds = new Set(state.exercises.map((exercise) => exercise.id));
        const entries: WorkoutEntry[] = [...plan.exercises]
          .sort((a, b) => a.order - b.order)
          // Удалённое из справочника упражнение не должно ломать старт тренировки.
          .filter((exercise) => exerciseIds.has(exercise.exerciseId))
          .map((exercise) => ({
            id: crypto.randomUUID(),
            exerciseId: exercise.exerciseId,
            sets: [...exercise.sets]
              .sort((a, b) => a.order - b.order)
              .map((set) => ({
                id: crypto.randomUUID(),
                weight: set.weight,
                reps: set.reps,
                completed: false,
              })),
          }));

        if (entries.length === 0) return false;

        set({
          currentSession: {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            entries,
            durationMinutes: 0,
            isCompleted: false,
            planId: plan.id,
            planName: plan.name,
          },
        });
        return true;
      },

      updatePlan: (plan) => set((state) => ({
        plans: state.plans.map((candidate) => candidate.id === plan.id ? plan : candidate)
      })),

      deletePlan: (planId) => set((state) => ({
        plans: state.plans.filter((plan) => plan.id !== planId)
      })),

      deleteWeek: (week) => set((state) => ({
        plans: state.plans.filter((plan) => plan.week !== week)
      })),

      setGoal: (type, startWeight, endDate) => set(() => ({
        activeGoal: {
          id: crypto.randomUUID(),
          type,
          startWeight,
          currentWeight: startWeight,
          startDate: new Date().toISOString(),
          endDate
        }
      })),

      updateCurrentWeight: (weight) => set((state) => {
        if (!state.activeGoal) return state;
        return {
          activeGoal: {
            ...state.activeGoal,
            currentWeight: weight
          }
        };
      }),

      exportData: () => {
        const state = get();
        const data = {
          exercises: state.exercises,
          sessions: state.sessions,
          plans: state.plans,
          stats: state.stats,
          activeGoal: state.activeGoal
        };
        return JSON.stringify(data, null, 2);
      },

      exportCsv: () => {
        const state = get();
        const exerciseNames = new Map(state.exercises.map((ex) => [ex.id, ex.name]));
        const exerciseGroups = new Map(state.exercises.map((ex) => [ex.id, ex.muscleGroup]));

        const header = [
          'Дата',
          'Время',
          'Длительность (мин)',
          'Упражнение',
          'Группа мышц',
          'Подход',
          'Вес (кг)',
          'Повторы',
          'Выполнен',
          'Объём (кг)',
        ];

        const escapeCell = (value: string) =>
          /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

        // Русская локаль Excel ждёт запятую в дробных числах (иначе число станет текстом).
        const num = (value: number) => String(value).replace('.', ',');

        const rows: string[][] = [header];

        const sortedSessions = [...state.sessions].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        sortedSessions.forEach((session) => {
          const sessionDate = new Date(session.date);
          const dateStr = sessionDate.toLocaleDateString('ru-RU');
          const timeStr = sessionDate.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          });

          session.entries.forEach((entry) => {
            entry.sets.forEach((set, index) => {
              rows.push([
                dateStr,
                timeStr,
                String(session.durationMinutes),
                exerciseNames.get(entry.exerciseId) ?? 'Удалённое упражнение',
                exerciseGroups.get(entry.exerciseId) ?? '',
                String(index + 1),
                num(set.weight),
                String(set.reps),
                set.completed ? 'Да' : 'Нет',
                num(Math.round(set.weight * set.reps)),
              ]);
            });
          });
        });

        // BOM + точка с запятой, чтобы Excel с русской локалью открыл файл корректно.
        return '\uFEFF' + rows.map((row) => row.map(escapeCell).join(';')).join('\r\n');
      },

      importData: (jsonData: string) => {
        try {
          const data = JSON.parse(jsonData);
          if (data && data.exercises && data.sessions) {
            set({
              exercises: data.exercises,
              sessions: data.sessions,
              // Старые экспорты без планов остаются валидными, а планы без
              // недели из экспорта версии 1 считаются первой неделей.
              plans: normalizeStoredPlans(data.plans),
              stats: data.stats || { streak: 0, lastWorkoutDate: null, totalWorkouts: 0 },
              activeGoal: data.activeGoal || null
            });
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      },
      
      resetData: () => set({
        exercises: [],
        sessions: [],
        plans: [],
        stats: { streak: 0, lastWorkoutDate: null, totalWorkouts: 0 },
        currentSession: null,
        activeGoal: null
      })
    }),
    {
      name: 'workout-storage',
      version: 2,
      // v1 добавила планы, v2 — номер недели у плана. Старые планы относятся к неделе 1.
      migrate: (persistedState) => {
        const state = persistedState as Partial<WorkoutState>;
        return {
          ...state,
          plans: normalizeStoredPlans(state.plans),
        } as WorkoutState;
      },
    }
  )
);
