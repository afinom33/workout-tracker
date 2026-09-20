export type MuscleGroup = 'Грудь' | 'Спина' | 'Ноги' | 'Плечи' | 'Руки' | 'Пресс' | 'Кардио' | 'Своя';

export type GoalType = 'Сушка' | 'Набор массы' | 'Поддержание';

export interface GoalCycle {
  id: string;
  type: GoalType;
  startDate: string;
  endDate?: string;
  startWeight: number;
  currentWeight?: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
}

export interface WorkoutSet {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface WorkoutEntry {
  id: string;
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  date: string; // ISO string
  entries: WorkoutEntry[];
  durationMinutes: number;
  isCompleted: boolean;
}

export interface UserStats {
  streak: number;
  lastWorkoutDate: string | null;
  totalWorkouts: number;
}
