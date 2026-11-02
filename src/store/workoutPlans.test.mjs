import test from 'node:test';
import assert from 'node:assert/strict';

// Store использует persist/localStorage; в Node подменяем окружение до импорта.
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
};
globalThis.window = {
  addEventListener() {},
  matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  localStorage: globalThis.localStorage,
};

const { useWorkoutStore } = await import('./useWorkoutStore.ts');
const { planImportKey } = await import('../utils/workoutPlanCsv.ts');

const reset = () => {
  useWorkoutStore.setState({
    exercises: [],
    plans: [],
    sessions: [],
    currentSession: null,
    activeGoal: null,
  });
};

const exercise = (id, name) => ({ id, name, muscleGroup: 'Своя' });

const parsedPlan = (week, name, day, exercises) => ({
  week,
  name,
  day,
  exercises: exercises.map((item, index) => ({
    order: item.order ?? index + 1,
    name: item.name,
    sets: item.sets.map(([weight, reps], setIndex) => ({
      order: setIndex + 1,
      weight,
      reps,
    })),
  })),
});

const legs = (week = 1) =>
  parsedPlan(week, 'Ноги', 'mon', [
    { name: 'Приседания', sets: [[60, 8], [65, 6]] },
    { name: 'Выпады', sets: [[20, 10]] },
  ]);

test('импорт плана переиспользует существующее упражнение и сохраняет неделю', () => {
  reset();
  useWorkoutStore.setState({ exercises: [exercise('ex-1', '  приседания ')] });

  const result = useWorkoutStore.getState().importPlans([legs(2)]);

  assert.deepEqual(result, { imported: 1, createdExercises: 1 });
  const [plan] = useWorkoutStore.getState().plans;
  assert.equal(plan.week, 2);
  assert.equal(plan.name, 'Ноги');
  assert.equal(plan.exercises[0].exerciseId, 'ex-1');
  assert.equal(plan.exercises[0].sets.length, 2);
  assert.deepEqual(
    plan.exercises[0].sets.map((set) => [set.weight, set.reps, set.order]),
    [
      [60, 8, 1],
      [65, 6, 2],
    ],
  );
});

test('replace заменяет план той же недели, сохраняя id и createdAt', () => {
  reset();
  useWorkoutStore.getState().importPlans([legs(1)]);
  const before = useWorkoutStore.getState().plans[0];

  const updated = parsedPlan(1, 'Ноги', 'mon', [
    { name: 'Приседания', sets: [[80, 5]] },
  ]);
  const result = useWorkoutStore.getState().importPlans([updated], {
    [planImportKey(1, 'Ноги')]: 'replace',
  });

  assert.equal(result.imported, 1);
  const plans = useWorkoutStore.getState().plans;
  assert.equal(plans.length, 1);
  assert.equal(plans[0].id, before.id);
  assert.equal(plans[0].createdAt, before.createdAt);
  assert.deepEqual(
    plans[0].exercises[0].sets.map((set) => [set.weight, set.reps]),
    [[80, 5]],
  );
});

test('одно имя в разных неделях — разные тренировки, без копий', () => {
  reset();
  useWorkoutStore.getState().importPlans([legs(1), legs(2)]);

  const plans = useWorkoutStore.getState().plans;
  assert.equal(plans.length, 2);
  assert.deepEqual(
    plans.map((plan) => [plan.week, plan.name]),
    [
      [1, 'Ноги'],
      [2, 'Ноги'],
    ],
  );
});

test('«оставить оба» даёт имена (копия) и (копия 2)', () => {
  reset();
  useWorkoutStore.getState().importPlans([legs(1)]);

  const modeKey = planImportKey(1, 'Ноги');
  useWorkoutStore.getState().importPlans([legs(1)], { [modeKey]: 'copy' });
  useWorkoutStore.getState().importPlans([legs(1)], { [modeKey]: 'copy' });

  assert.deepEqual(
    useWorkoutStore.getState().plans.map((plan) => plan.name),
    ['Ноги', 'Ноги (копия)', 'Ноги (копия 2)'],
  );
});

test('старт по плану создаёт сессию с planId, planName и порядком из плана', () => {
  reset();
  const parsed = parsedPlan(3, 'Ноги', 'mon', [
    { order: 2, name: 'Выпады', sets: [[20, 10], [22, 8]] },
    { order: 1, name: 'Приседания', sets: [[60, 8]] },
  ]);
  useWorkoutStore.getState().importPlans([parsed]);
  const plan = useWorkoutStore.getState().plans[0];

  const started = useWorkoutStore.getState().startSessionFromPlan(plan.id);

  assert.equal(started, true);
  const session = useWorkoutStore.getState().currentSession;
  assert.ok(session);
  assert.equal(session.planId, plan.id);
  assert.equal(session.planName, 'Ноги');
  assert.equal(session.entries.length, 2);
  assert.equal(session.entries[0].exerciseId, plan.exercises[0].exerciseId);
  assert.equal(session.entries[0].sets.length, 1);
  assert.equal(session.entries[1].sets.length, 2);
  assert.deepEqual(
    session.entries[1].sets.map((set) => [set.weight, set.reps, set.completed]),
    [
      [20, 10, false],
      [22, 8, false],
    ],
  );
});

test('удалённые из справочника упражнения пропускаются, пустой план не стартует', () => {
  reset();
  useWorkoutStore.getState().importPlans([legs(1)]);
  const plan = useWorkoutStore.getState().plans[0];
  useWorkoutStore.setState({ exercises: [] });

  assert.equal(useWorkoutStore.getState().startSessionFromPlan(plan.id), false);
  assert.equal(useWorkoutStore.getState().currentSession, null);
});

test('deleteWeek удаляет только выбранную неделю', () => {
  reset();
  useWorkoutStore.getState().importPlans([legs(1), legs(2), legs(2)]);

  useWorkoutStore.getState().deleteWeek(2);

  assert.deepEqual(
    useWorkoutStore.getState().plans.map((plan) => plan.week),
    [1],
  );
});

test('JSON-экспорт содержит недели, старый экспорт без планов читается', () => {
  reset();
  useWorkoutStore.getState().importPlans([legs(2)]);

  const exported = JSON.parse(useWorkoutStore.getState().exportData());
  assert.equal(exported.plans[0].week, 2);

  const legacy = { ...exported };
  delete legacy.plans;
  assert.equal(useWorkoutStore.getState().importData(JSON.stringify(legacy)), true);
  assert.deepEqual(useWorkoutStore.getState().plans, []);
});

test('план из старого JSON без week считается первой неделей', () => {
  reset();
  const legacyPlan = {
    id: 'plan-legacy',
    name: 'Старая',
    day: 'tue',
    exercises: [],
    createdAt: '2025-01-01T00:00:00.000Z',
  };

  const ok = useWorkoutStore.getState().importData(
    JSON.stringify({
      exercises: [exercise('ex-1', 'Жим')],
      sessions: [],
      plans: [legacyPlan],
    }),
  );

  assert.equal(ok, true);
  const [plan] = useWorkoutStore.getState().plans;
  assert.equal(plan.id, 'plan-legacy');
  assert.equal(plan.week, 1);
});
