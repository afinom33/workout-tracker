export type MuscleGroup = 'Грудь' | 'Спина' | 'Ноги' | 'Плечи' | 'Руки' | 'Пресс' | 'Кардио' | 'Своя';

export type GoalType = 'Сушка' | 'Набор массы' | 'Поддержание';

/** День недели плана: фиксированные латинские значения, как в CSV. */
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

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
  /** План, по которому начата тренировка (если она начата не с нуля). */
  planId?: string;
  /** Название плана на момент старта: остаётся в истории, даже если план удалён. */
  planName?: string;
}

/** Плановый подход внутри шаблона тренировки. */
export interface PlannedSet {
  id: string;
  weight: number;
  reps: number;
  order: number;
  note?: string;
}

/** Упражнение шаблона тренировки вместе с плановыми подходами. */
export interface PlannedExercise {
  id: string;
  exerciseId: string;
  order: number;
  sets: PlannedSet[];
}

/** Шаблон (план) тренировки: например «Ноги» по понедельникам. */
export interface WorkoutPlan {
  id: string;
  name: string;
  day: Weekday;
  exercises: PlannedExercise[];
  createdAt: string;
}

export interface UserStats {
  streak: number;
  lastWorkoutDate: string | null;
  totalWorkouts: number;
}
