import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Exercise, WorkoutSession, UserStats, WorkoutEntry, GoalCycle, GoalType, MuscleGroup } from '../types';

interface WorkoutState {
  exercises: Exercise[];
  sessions: WorkoutSession[];
  stats: UserStats;
  currentSession: WorkoutSession | null;
  activeGoal: GoalCycle | null;
  
  // Actions
  addExercise: (name: string, muscleGroup: MuscleGroup) => string;
  startSession: () => void;
  endSession: (duration: number) => void;
  addEntryToSession: (exerciseId: string, setsCount?: number) => void;
  updateSet: (entryId: string, setId: string, weight: number, reps: number, completed: boolean) => void;
  addSetToEntry: (entryId: string) => void;
  removeSetFromEntry: (entryId: string, setId: string) => void;
  
  // Goal Management
  setGoal: (type: GoalType, startWeight: number, endDate?: string) => void;
  updateCurrentWeight: (weight: number) => void;

  // Data Management
  exportData: () => string;
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
          stats: state.stats,
          activeGoal: state.activeGoal
        };
        return JSON.stringify(data, null, 2);
      },

      importData: (jsonData: string) => {
        try {
          const data = JSON.parse(jsonData);
          if (data && data.exercises && data.sessions) {
            set({
              exercises: data.exercises,
              sessions: data.sessions,
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
        stats: { streak: 0, lastWorkoutDate: null, totalWorkouts: 0 },
        currentSession: null,
        activeGoal: null
      })
    }),
    {
      name: 'workout-storage', 
    }
  )
);
