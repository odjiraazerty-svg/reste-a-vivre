import { randomUUID } from 'crypto';
import { RavFormulas, RavPockets } from './packages/engine/src';

const API_BASE = 'http://localhost:4000';

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 LANCEMENT DU TEST COMPLET BUDGÉO (ENGINE + API) 🧪');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(title: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // SECTION 1 : TESTS DU MOTEUR MATHÉMATIQUE (@rav/engine)
  // ----------------------------------------------------
  console.log('--- 1. Tests Unitaires : Moteur Métier Pure Math ---');

  // Test 1.1: Calcul RAV Mensuel Initial
  const ravm = RavFormulas.calculateInitialRavM(2500, 840, 200);
  assert('Calcul RAVm Initial : 2500 - (840 + 200) = 1460€', ravm === 1460, `Obtenu: ${ravm}`);

  // Test 1.2: Metrics de Cycle
  const metrics = RavFormulas.computeCycleMetrics(28, new Date('2026-11-20'));
  assert('Cycle métriques : jours restants valides (> 0)', metrics.remainingDays > 0, `Jours restants: ${metrics.remainingDays}`);

  // Test 1.3: Calcul RAV Quotidien Dynamique
  const dailyWeekday = RavFormulas.calculateDailyRav({
    initialRavM: 1460,
    totalSpentPriorInCycle: 0,
    remainingDays: 10,
    strategy: 'DYNAMIC_WEIGHT',
    isWeekendToday: false
  });
  assert('Calcul RAV/j jour ouvré supérieur à 0', dailyWeekday > 0, `Budget: ${dailyWeekday}€`);

  const dailyWeekend = RavFormulas.calculateDailyRav({
    initialRavM: 1460,
    totalSpentPriorInCycle: 0,
    remainingDays: 10,
    strategy: 'DYNAMIC_WEIGHT',
    isWeekendToday: true
  });
  assert('Calcul RAV/j week-end avec pondération 2.0x supérieur au jour ouvré', dailyWeekend > dailyWeekday, `Week-end: ${dailyWeekend}€ vs Semaine: ${dailyWeekday}€`);

  // Test 1.4: Distribution des Poches
  const defaultPockets = RavPockets.getDefaultPockets();
  assert('Poches par défaut au nombre de 4 (Alimentation, Plaisir, Transport, Imprévu)', defaultPockets.length === 4);
  const distributed = RavPockets.distributeDynamic(100, defaultPockets);
  const totalDistributed = distributed.reduce((sum, p) => sum + p.allocatedAmount, 0);
  assert('Distribution des 4 poches égale à 100% de la somme allouée (100€)', Math.abs(totalDistributed - 100) < 0.01, `Total: ${totalDistributed}`);

  // ----------------------------------------------------
  // SECTION 2 : TESTS DE L'API REST FASTIFY & POSTGRESQL
  // ----------------------------------------------------
  console.log('\n--- 2. Tests d\'Intégration : API Fastify & PostgreSQL ---');

  // Test 2.1: Healthcheck
  const healthRes = await fetch(`${API_BASE}/health`);
  const health = await healthRes.json();
  assert('Healthcheck : HTTP 200 et service Budgéo', healthRes.status === 200 && health.service.includes('Budgéo'), `Service: ${health.service}`);

  // Test 2.2: Création de compte (Register)
  const testId = `test_user_${Date.now()}`;
  const regRes = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testId, password: 'StrongPassword123!' })
  });
  const regData = await regRes.json();
  assert('Création de compte avec pseudo sans email (HTTP 200 + Token)', regRes.status === 200 && !!regData.token, JSON.stringify(regData));
  const token = regData.token;

  // Test 2.3: Connexion (Login)
  const loginRes = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testId, password: 'StrongPassword123!' })
  });
  const loginData = await loginRes.json();
  assert('Connexion avec les identifiants créés (HTTP 200 + Token)', loginRes.status === 200 && !!loginData.token);

  // Test 2.4: Calibration d'un cycle financier
  const calibRes = await fetch(`${API_BASE}/api/v1/cycles/calibrate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      payDayOfMonth: 28,
      declaredNetIncome: 2800,
      sanctuarySavings: 300,
      weekendStrategy: 'DYNAMIC_WEIGHT',
      fixedCharges: [
        { label: 'Loyer & Charges', amount: 850, category: 'LOGEMENT' },
        { label: 'Électricité / Eau', amount: 120, category: 'ENERGIE' },
        { label: 'Abonnements Télécom', amount: 45, category: 'TELECOM' }
      ]
    })
  });
  const calibData = await calibRes.json();
  assert('Calibration du Cycle budgétaire (Revenus: 2800€, Charges: 1015€, Épargne: 300€)', calibRes.status === 200 && !!calibData.cycle, JSON.stringify(calibData));

  // Test 2.5: Récupération du cycle actuel
  const cycleRes = await fetch(`${API_BASE}/api/v1/cycles/current`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const cycleData = await cycleRes.json();
  const activeRavM = Number(cycleData.cycle?.initialRavM ?? cycleData.cycle?.initial_rav_m);
  assert('Lecture du cycle actif : RAVm calculé = 1485€ (2800 - 1015 - 300)', cycleRes.status === 200 && activeRavM === 1485, `Initial RAVm: ${activeRavM}, Données: ${JSON.stringify(cycleData)}`);

  // Test 2.6: Enregistrement d'une dépense 2-Taps
  const expenseRes = await fetch(`${API_BASE}/api/v1/expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      amount: 42.50,
      pocketKey: 'Déjeuner',
      label: 'Courses Marché Frais',
      clientSyncId: randomUUID()
    })
  });
  const expenseData = await expenseRes.json();
  assert('Ajout instantané d\'une dépense (42.50€ dans Déjeuner)', expenseRes.status === 200 && !!expenseData.expense);

  // Test 2.7: Synchronisation par lot hors-ligne (Offline-First sync)
  const batchRes = await fetch(`${API_BASE}/api/v1/expenses/batch-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      expenses: [
        { clientSyncId: randomUUID(), pocketKey: 'Mobilité', amount: 15.00, label: 'Ticket Métro' },
        { clientSyncId: randomUUID(), pocketKey: 'Plaisirs', amount: 9.80, label: 'Café & Pâtisserie' }
      ]
    })
  });
  const batchData = await batchRes.json();
  assert('Synchronisation par lot Offline-First (2 dépenses locales intégrées)', batchRes.status === 200 && batchData.insertedCount === 2, JSON.stringify(batchData));

  // Test 2.8: Récupération du Nudge IA du jour
  const nudgeRes = await fetch(`${API_BASE}/api/v1/ai/nudge-of-the-day`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const nudgeData = await nudgeRes.json();
  const nudge = nudgeData.nudge;
  assert('Génération du conseil comportemental Nudge IA', nudgeRes.status === 200 && !!nudge?.title && !!nudge?.message, JSON.stringify(nudge));

  // ----------------------------------------------------
  // SYNTHÈSE
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 RÉSULTAT : ${passed} TESTS RÉUSSIS, ${failed} ÉCHECS`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Erreur critique pendant la suite de tests:', err);
  process.exit(1);
});
