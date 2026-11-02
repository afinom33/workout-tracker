import assert from 'node:assert/strict';
import test from 'node:test';

// zustand/persist при создании стора обращается к localStorage — в Node его нет.
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
  key: (index) => Array.from(memory.keys())[index] ?? null,
  get length() {
    return memory.size;
  },
};
// zustand/persist читает именно window.localStorage.
globalThis.window = globalThis;

const { useWorkoutStore } = await import('./useWorkoutStore.ts');

const resetStore = () => {
  useWorkoutStore.setState({
    exercises: [],
    sessions: [],
    plans: [],
    currentSession: null,
    activeGoal: null,
    stats: { streak: 0, lastWorkoutDate: null, totalWorkouts: 0 },
  });
};

const parsedPlan = (overrides = {}) => ({
  name: 'Ноги',
  day: 'mon',
  exercises: [
    {
      order: 1,
      name: 'Приседания',
      sets: [
        { order: 1, weight: 60, reps: 10 },
        { order: 2, weight: 65, reps: 8, note: 'тяжело' },
      ],
    },
    { order: 2, name: 'Выпады', sets: [{ order: 1, weight: 16, reps: 12 }] },
  ],
  ...overrides,
});

test('importPlans: создаёт план, упражнения в правильном порядке и переиспользует существующие', () => {
  resetStore();
  const store = useWorkoutStore.getState();
  const existingId = store.addExercise('  приседания  ', 'Ноги');

  const result = store.importPlans([parsedPlan()]);

  const state = useWorkoutStore.getState();
  assert.deepEqual(result, { imported: 1, createdExercises: 1 });
  assert.equal(state.plans.length, 1);

  const plan = state.plans[0];
  assert.equal(plan.name, 'Ноги');
  assert.equal(plan.day, 'mon');
  assert.deepEqual(
    plan.exercises.map((exercise) => exercise.order),
    [1, 2],
  );
  assert.equal(plan.exercises[0].exerciseId, existingId, 'имя сравнивается без регистра и пробелов');
  assert.deepEqual(
    plan.exercises[0].sets.map((set) => [set.order, set.weight, set.reps, set.note]),
    [
      [1, 60, 10, undefined],
      [2, 65, 8, 'тяжело'],
    ],
  );

  const created = state.exercises.find((exercise) => exercise.name === 'Выпады');
  assert.ok(created, 'новое упражнение добавлено в справочник');
  assert.equal(created.muscleGroup, 'Своя');
});

test('importPlans: повторный импорт с mode=replace заменяет план, сохраняя id', () => {
  resetStore();
  const store = useWorkoutStore.getState();
  store.importPlans([parsedPlan()]);
  const original = useWorkoutStore.getState().plans[0];

  const result = store.importPlans(
    [parsedPlan({ day: 'tue', exercises: [parsedPlan().exercises[1]] })],
    { ноги: 'replace' },
  );

  const state = useWorkoutStore.getState();
  assert.equal(result.imported, 1);
  assert.equal(state.plans.length, 1);
  assert.equal(state.plans[0].id, original.id);
  assert.equal(state.plans[0].createdAt, original.createdAt);
  assert.equal(state.plans[0].day, 'tue');
  assert.equal(state.plans[0].exercises.length, 1);
});

test('importPlans: без mode конфликтующее имя сохраняется как копия', () => {
  resetStore();
  const store = useWorkoutStore.getState();
  store.importPlans([parsedPlan()]);
  store.importPlans([parsedPlan()]);
  store.importPlans([parsedPlan()]);

  const names = useWorkoutStore.getState().plans.map((plan) => plan.name);
  assert.deepEqual(names, ['Ноги', 'Ноги (копия)', 'Ноги (копия 2)']);
});

test('startSessionFromPlan: сессия предзаполнена подходами и ссылкой на план', () => {
  resetStore();
  const store = useWorkoutStore.getState();
  store.importPlans([parsedPlan()]);
  const plan = useWorkoutStore.getState().plans[0];

  const started = useWorkoutStore.getState().startSessionFromPlan(plan.id);
  const session = useWorkoutStore.getState().currentSession;

  assert.equal(started, true);
  assert.ok(session);
  assert.equal(session.planId, plan.id);
  assert.equal(session.planName, 'Ноги');
  assert.equal(session.isCompleted, false);
  assert.deepEqual(
    session.entries.map((entry) => entry.sets.length),
    [2, 1],
  );
  assert.deepEqual(
    session.entries[0].sets.map((set) => [set.weight, set.reps, set.completed]),
    [
      [60, 10, false],
      [65, 8, false],
    ],
  );
});

test('startSessionFromPlan: удалённые упражнения пропускаются, пустой план не стартует', () => {
  resetStore();
  const store = useWorkoutStore.getState();
  store.importPlans([parsedPlan()]);
  const plan = useWorkoutStore.getState().plans[0];

  const firstExerciseId = plan.exercises[0].exerciseId;
  const secondExerciseId = plan.exercises[1].exerciseId;
  useWorkoutStore.getState().deleteExercise(firstExerciseId);

  assert.equal(useWorkoutStore.getState().startSessionFromPlan(plan.id), true);
  const session = useWorkoutStore.getState().currentSession;
  assert.deepEqual(
    session.entries.map((entry) => entry.exerciseId),
    [secondExerciseId],
  );

  useWorkoutStore.getState().deleteExercise(secondExerciseId);
  assert.equal(useWorkoutStore.getState().startSessionFromPlan(plan.id), false);
});

test('JSON-экспорт содержит планы, старый экспорт без планов читается', () => {
  resetStore();
  useWorkoutStore.getState().importPlans([parsedPlan()]);

  const exported = JSON.parse(useWorkoutStore.getState().exportData());
  assert.equal(exported.plans.length, 1);

  const legacy = JSON.stringify({
    exercises: [{ id: 'e1', name: 'Жим', muscleGroup: 'Грудь' }],
    sessions: [],
    stats: { streak: 0, lastWorkoutDate: null, totalWorkouts: 0 },
    activeGoal: null,
  });

  assert.equal(useWorkoutStore.getState().importData(legacy), true);
  assert.deepEqual(useWorkoutStore.getState().plans, []);
});
