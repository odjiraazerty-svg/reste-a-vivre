/**
 * APPLICATION PRINCIPALE RAV (RESTE À VIVRE)
 * Orchestration des vues, interactions "2-Taps", jauge vivante & simulation PostgreSQL
 */

import { state } from './state.js';
import { RavEngine } from './rav-engine.js';
import { sound } from './audio.js';

class RavApp {
  constructor() {
    this.currentNumpadBuffer = '0';
    this.activeScreen = 'dash';
    this.currentHistoryFilter = 'ALL';
    this.latteDays = 3;
    this.auditSubscriptions = [
      {
        id: 'sub_gym',
        name: 'Salle de Sport (Non fréquentée)',
        monthlyCost: 39.99,
        icon: '🏋️',
        optimized: true,
        recommendation: 'Dernier passage il y a 45 jours. Résilier libère immédiatement +1.33 €/jour.',
        dailyGain: 1.33
      },
      {
        id: 'sub_stream',
        name: 'Abonnement Streaming Vidéo n°2',
        monthlyCost: 17.99,
        icon: '🎬',
        optimized: true,
        recommendation: 'Doublon avec votre 1er service. Suspendre libère +0.60 €/jour.',
        dailyGain: 0.60
      },
      {
        id: 'sub_tel',
        name: 'Forfait Mobile 200 Go surdimensionné',
        monthlyCost: 20.00,
        icon: '📱',
        optimized: true,
        recommendation: 'Consommation réelle < 15 Go. Passer à 9,99 €/m libère +0.67 €/jour.',
        dailyGain: 0.67
      },
      {
        id: 'sub_assur',
        name: 'Assurance Appareils / Doublon carte',
        monthlyCost: 14.50,
        icon: '🛡️',
        optimized: true,
        recommendation: 'Déjà couvert par votre carte bancaire. Résilier libère +0.48 €/jour.',
        dailyGain: 0.48
      }
    ];
  }

  init() {
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    // Navigation inférieure (Dock tabs)
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetScreen = btn.dataset.screen;
        if (targetScreen) {
          this.switchScreen(targetScreen);
        }
      });
    });

    // Filtres d'historique par poche
    document.querySelectorAll('.filter-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentHistoryFilter = btn.dataset.filter;
        sound.playKeyClick();
        this.renderHistory();
      });
    });

    // Basculeur Plein Écran / Mode Téléphone
    const toggleFrameBtn = document.getElementById('btnToggleFrame');
    if (toggleFrameBtn) {
      toggleFrameBtn.addEventListener('click', () => {
        document.body.classList.toggle('fullscreen-mode');
        const isFull = document.body.classList.contains('fullscreen-mode');
        toggleFrameBtn.innerHTML = isFull ? '📱 Mode Téléphone' : '⛶ Plein Écran';
      });
    }

    // Basculeur Thème (Fond Blanc / Mode Nuit)
    const btnTheme = document.getElementById('btnThemeToggle');
    const savedTheme = localStorage.getItem('rav_theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
      if (btnTheme) btnTheme.innerHTML = '🌙 Nuit';
    }

    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-theme');
        localStorage.setItem('rav_theme', isLight ? 'light' : 'dark');
        btnTheme.innerHTML = isLight ? '🌙 Nuit' : '☀️ Blanc';
      });
    }

    // Basculeur Zoom Compact (pour ordinateurs portables & petits écrans)
    const btnCompact = document.getElementById('btnCompactToggle');
    const phoneContainer = document.getElementById('phoneContainer');
    if (btnCompact && phoneContainer) {
      btnCompact.addEventListener('click', () => {
        phoneContainer.classList.toggle('compact-mode');
        const isCompact = phoneContainer.classList.contains('compact-mode');
        btnCompact.classList.toggle('active', isCompact);
        btnCompact.innerHTML = isCompact ? '🔍 Zoom 100%' : '🔍 Zoom 88%';
      });
    }

    // Défilement automatique au clic sur l'indicateur flottant
    const scrollHint = document.getElementById('scrollDownHint');
    const viewport = document.getElementById('appViewport');
    if (scrollHint && viewport) {
      scrollHint.addEventListener('click', () => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      });

      viewport.addEventListener('scroll', () => {
        if (this.activeScreen === 'dash') {
          if (viewport.scrollTop > 40) {
            scrollHint.style.opacity = '0';
            scrollHint.style.pointerEvents = 'none';
          } else {
            scrollHint.style.opacity = '1';
            scrollHint.style.pointerEvents = 'auto';
          }
        }
      }, { passive: true });
    }

    // Défilement fluide de la vue lorsque la molette survole le dock inférieur
    const bottomDock = document.querySelector('.bottom-dock-nav');
    if (bottomDock && viewport) {
      bottomDock.addEventListener('wheel', (e) => {
        viewport.scrollTop += e.deltaY;
      }, { passive: true });
    }

    // Déclencheur du Clavier Express "2-Taps"
    const openNumpadBtn = document.getElementById('btnTrigger2Taps');
    if (openNumpadBtn) {
      openNumpadBtn.addEventListener('click', () => {
        this.openNumpad();
      });
    }

    // Fermeture du Clavier Express
    const closeNumpadBtn = document.getElementById('btnCloseNumpad');
    if (closeNumpadBtn) {
      closeNumpadBtn.addEventListener('click', () => {
        this.closeNumpad();
      });
    }

    // Touches du pavé numérique
    document.querySelectorAll('.numpad-key').forEach(key => {
      key.addEventListener('click', () => {
        const val = key.dataset.val;
        const action = key.dataset.action;
        this.handleNumpadInput(val, action);
      });
    });

    // Puces de raccourcis rapides (+1.50, +8.50, etc.)
    document.querySelectorAll('.quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const quickVal = chip.dataset.amount;
        if (quickVal) {
          this.currentNumpadBuffer = quickVal;
          sound.playKeyClick();
          this.updateNumpadDisplay();
        }
      });
    });

    // Le 2ème Tap : Clic sur une poche pour enregistrement instantané !
    document.querySelectorAll('.pocket-direct-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pocketId = btn.dataset.pocket;
        this.submitExpenseWithPocket(pocketId);
      });
    });

    // Gestion de l'Authentification (Pseudo & Email)
    this.bindAuthEvents();

    // Curseur et Inputs Onboarding
    this.bindOnboardingControls();

    // Sélecteur de Devise
    const currencySelectBtn = document.getElementById('currencySelectBtn');
    if (currencySelectBtn) {
      currencySelectBtn.addEventListener('click', () => {
        this.cycleCurrency();
      });
    }

    // Déclencheur du Bilan de 20h30 (Clôture du Soir)
    const openEveningBtn = document.getElementById('btnTriggerEveningRitual');
    if (openEveningBtn) {
      openEveningBtn.addEventListener('click', () => {
        this.openEveningRitual();
      });
    }

    // Fermeture de la Clôture du Soir
    const closeEveningBtn = document.getElementById('btnCloseEvening');
    if (closeEveningBtn) {
      closeEveningBtn.addEventListener('click', () => {
        this.closeEveningRitual();
      });
    }

    // Boutons d'ajustement rapide du soir (-5, -1, +1, +5)
    document.querySelectorAll('.evening-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pocket = btn.dataset.pocket;
        const delta = parseFloat(btn.dataset.delta) || 0;
        this.adjustEveningPocket(pocket, delta);
      });
    });

    // Transfert vers le Pack Week-end
    const btnEveningWeekend = document.getElementById('btnEveningTransferWeekend');
    if (btnEveningWeekend) {
      btnEveningWeekend.addEventListener('click', () => {
        this.transferEveningSurplusToWeekend();
      });
    }

    // Validation standard de clôture
    const btnEveningConfirm = document.getElementById('btnEveningConfirm');
    if (btnEveningConfirm) {
      btnEveningConfirm.addEventListener('click', () => {
        this.confirmEveningRitual();
      });
    }

    // Curseur Effet Latte
    const latteSlider = document.getElementById('latteSlider');
    if (latteSlider) {
      latteSlider.addEventListener('input', () => {
        this.latteDays = Number(latteSlider.value);
        this.renderAuditScreen();
      });
    }

    // Bouton Application Directe des Optimisations au RAV
    const btnApplyOptimizations = document.getElementById('btnApplyOptimizations');
    if (btnApplyOptimizations) {
      btnApplyOptimizations.addEventListener('click', () => {
        this.applyOptimizationsToRav();
      });
    }

    // Modal de Gestion des Poches Dynamiques
    this.bindPocketsManagerEvents();
  }

  bindPocketsManagerEvents() {
    const modal = document.getElementById('pocketsManagerModal');
    const btnOpen = document.getElementById('btnOpenPocketsManager');
    const btnClose = document.getElementById('btnClosePocketsManager');
    const btnAutoRebalance = document.getElementById('btnAutoRebalancePockets');
    const btnCreate = document.getElementById('btnSubmitCreatePocket');
    const newNameInput = document.getElementById('newPocketNameInput');
    const newPctSlider = document.getElementById('newPocketPctSlider');
    const newPctDisplay = document.getElementById('newPocketPctDisplay');

    let selectedEmoji = '🛒';

    if (btnOpen && modal) {
      btnOpen.addEventListener('click', () => {
        this.renderPocketsManager();
        modal.classList.add('open');
        sound.playKeyClick();
      });
    }

    if (btnClose && modal) {
      btnClose.addEventListener('click', () => {
        modal.classList.remove('open');
        sound.playKeyClick();
        this.render();
      });
    }

    // Sélecteur emoji
    document.querySelectorAll('.emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedEmoji = btn.dataset.emoji || '🛒';
        sound.playKeyClick();
      });
    });

    if (newPctSlider && newPctDisplay) {
      newPctSlider.addEventListener('input', () => {
        newPctDisplay.textContent = `${newPctSlider.value}%`;
      });
    }

    // Création d'une nouvelle poche
    if (btnCreate && newNameInput && newPctSlider) {
      btnCreate.addEventListener('click', () => {
        const nameVal = newNameInput.value.trim();
        if (!nameVal) {
          this.showToast('Veuillez donner un nom à votre poche');
          return;
        }

        const pctVal = Number(newPctSlider.value) / 100;
        const newPocket = {
          id: `pocket_custom_${Date.now()}`,
          name: nameVal,
          icon: selectedEmoji,
          colorHex: '#10B981',
          targetPercentage: pctVal,
          displayOrder: (state.data.pockets || []).length + 1
        };

        if (!state.data.pockets) state.data.pockets = [];
        state.data.pockets.push(newPocket);
        state.saveState();

        newNameInput.value = '';
        sound.playSuccessChime();
        this.showToast(`✨ Poche "${nameVal}" créée avec succès !`);
        this.renderPocketsManager();
        this.render();
      });
    }

    // Rééquilibrage automatique avec le Coussin
    if (btnAutoRebalance) {
      btnAutoRebalance.addEventListener('click', () => {
        const pockets = state.data.pockets || [];
        const nonCushionTotal = pockets
          .filter(p => !p.isCushion && p.id !== 'pocket_cushion')
          .reduce((sum, p) => sum + p.targetPercentage, 0);

        const remainder = Math.max(0.05, Number((1.0 - nonCushionTotal).toFixed(2)));
        const cushion = pockets.find(p => p.isCushion || p.id === 'pocket_cushion');

        if (cushion) {
          cushion.targetPercentage = remainder;
          state.saveState();
          sound.playSuccessChime();
          this.showToast(`⚖️ Rééquilibré : Coussin ajusté à ${Math.round(remainder * 100)}% (Total = 100%)`);
          this.renderPocketsManager();
          this.render();
        } else {
          this.showToast('Aucune poche coussin trouvée pour équilibrer');
        }
      });
    }
  }

  renderPocketsManager() {
    const pockets = state.data.pockets || [];
    const listContainer = document.getElementById('pocketsConfigList');
    const totalValEl = document.getElementById('pocketsTotalPctDisplay');
    const progressBar = document.getElementById('pocketsTotalProgressBar');
    const totalCard = document.getElementById('pocketsTotalCard');
    const statusMsg = document.getElementById('pocketsTotalStatusMsg');

    const totalPct = Math.round(pockets.reduce((sum, p) => sum + (p.targetPercentage || 0), 0) * 100);

    if (totalValEl) totalValEl.textContent = `${totalPct}%`;
    if (progressBar) progressBar.style.width = `${Math.min(100, totalPct)}%`;

    if (totalPct === 100) {
      if (totalCard) totalCard.classList.remove('invalid');
      if (statusMsg) statusMsg.textContent = 'Parfait ! 100% de votre RAV est réparti.';
    } else if (totalPct < 100) {
      if (totalCard) totalCard.classList.add('invalid');
      if (statusMsg) statusMsg.textContent = `Attention : il reste ${100 - totalPct}% non alloués (utilisez le bouton ci-dessous).`;
    } else {
      if (totalCard) totalCard.classList.add('invalid');
      if (statusMsg) statusMsg.textContent = `Dépassement : +${totalPct - 100}% au-delà des 100%. Réduisez vos poches.`;
    }

    if (!listContainer) return;

    listContainer.innerHTML = pockets.map(p => {
      const pctDisplay = Math.round(p.targetPercentage * 100);
      return `
        <div class="pocket-config-row">
          <div class="pocket-config-left">
            <div class="pocket-config-icon">${p.icon}</div>
            <div>
              <div class="pocket-config-name">${p.name}</div>
              <div class="pocket-config-pct-badge">${pctDisplay}% alloué</div>
            </div>
          </div>
          <div class="pocket-config-controls">
            <button type="button" class="pocket-btn-step" data-action="minus" data-id="${p.id}">- 5%</button>
            <button type="button" class="pocket-btn-step" data-action="plus" data-id="${p.id}">+ 5%</button>
            ${!p.isCushion && p.id !== 'pocket_cushion' ? `<button type="button" class="pocket-btn-delete" data-id="${p.id}" title="Supprimer">🗑️</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Écouteurs de pas (+/- 5%)
    listContainer.querySelectorAll('.pocket-btn-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        const target = pockets.find(p => p.id === id);
        if (target) {
          if (action === 'plus') {
            target.targetPercentage = Math.min(0.90, Number((target.targetPercentage + 0.05).toFixed(2)));
          } else {
            target.targetPercentage = Math.max(0.05, Number((target.targetPercentage - 0.05).toFixed(2)));
          }
          state.saveState();
          sound.playKeyClick();
          this.renderPocketsManager();
          this.render();
        }
      });
    });

    // Suppression de poche
    listContainer.querySelectorAll('.pocket-btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        state.data.pockets = state.data.pockets.filter(p => p.id !== id);
        state.saveState();
        sound.playKeyClick();
        this.showToast('🗑️ Poche supprimée');
        this.renderPocketsManager();
        this.render();
      });
    });
  }

  cycleCurrency() {
    const currencies = ['€', 'FCFA', 'CHF', '$'];
    const current = state.data.user.currency;
    const nextIdx = (currencies.indexOf(current) + 1) % currencies.length;
    state.data.user.currency = currencies[nextIdx];
    state.saveState();
    sound.playKeyClick();
    this.showToast(`Devise modifiée : ${state.data.user.currency}`);
    this.render();
  }

  bindOnboardingControls() {
    const rangeIncome = document.getElementById('rangeIncome');
    const inputIncome = document.getElementById('inputIncome');
    const rangeFixed = document.getElementById('rangeFixed');
    const inputFixed = document.getElementById('inputFixed');
    const rangeSavings = document.getElementById('rangeSavings');
    const inputSavings = document.getElementById('inputSavings');
    const inputPayDay = document.getElementById('inputPayDay');
    const btnSaveOnboarding = document.getElementById('btnSaveOnboarding');

    const updatePreview = () => {
      const income = Number(rangeIncome?.value || 2400);
      const fixed = Number(rangeFixed?.value || 1250);
      const savings = Number(rangeSavings?.value || 200);
      const payDay = Number(inputPayDay?.value || 28);

      if (inputIncome) inputIncome.value = income;
      if (inputFixed) inputFixed.value = fixed;
      if (inputSavings) inputSavings.value = savings;

      const ravm = RavEngine.calculateInitialRavM(income, fixed, savings);
      const metrics = RavEngine.getCycleMetrics(payDay);
      const ravq = (ravm / metrics.totalDays).toFixed(2);

      const previewM = document.getElementById('previewRavM');
      const previewQ = document.getElementById('previewRavQ');
      const curr = state.data.user.currency;
      if (previewM) previewM.textContent = `${ravm.toLocaleString()} ${curr}`;
      if (previewQ) previewQ.textContent = `${ravq} ${curr}/j`;
    };

    [rangeIncome, rangeFixed, rangeSavings, inputPayDay].forEach(el => {
      if (el) el.addEventListener('input', updatePreview);
    });

    if (inputIncome && rangeIncome) {
      inputIncome.addEventListener('input', () => {
        rangeIncome.value = inputIncome.value;
        updatePreview();
      });
    }

    // Stratégies Week-end (Radios personnalisés)
    document.querySelectorAll('.strategy-radio-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.strategy-radio-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.data.user.weekendStrategy = card.dataset.strategy;
        sound.playKeyClick();
      });
    });

    if (btnSaveOnboarding) {
      btnSaveOnboarding.addEventListener('click', () => {
        const income = Number(rangeIncome?.value || 2400);
        const fixed = Number(rangeFixed?.value || 1250);
        const savings = Number(rangeSavings?.value || 200);
        const payDay = Number(inputPayDay?.value || 28);

        state.updateSettings({
          netIncome: income,
          fixedChargesTotal: fixed,
          sanctuarySavings: savings,
          payDayOfMonth: payDay,
          weekendStrategy: state.data.user.weekendStrategy
        });

        sound.playSuccessChime();
        this.showToast('✨ Vos flux et cycles ont été calibrés !');
        this.switchScreen('dash');
      });
    }
  }

  switchScreen(screenName) {
    this.activeScreen = screenName;
    document.querySelectorAll('.screen').forEach(scr => scr.classList.remove('active'));
    document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('active'));

    const targetEl = document.getElementById(`screen_${screenName}`);
    const targetNav = document.querySelector(`.nav-tab-btn[data-screen="${screenName}"]`);

    if (targetEl) targetEl.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    // Réinitialisation du défilement
    const viewport = document.getElementById('appViewport');
    if (viewport) viewport.scrollTo({ top: 0, behavior: 'instant' });

    // Gestion de l'indicateur de défilement
    const scrollHint = document.getElementById('scrollDownHint');
    if (scrollHint) {
      scrollHint.style.display = screenName === 'dash' ? 'flex' : 'none';
      scrollHint.style.opacity = '1';
      scrollHint.style.pointerEvents = 'auto';
    }

    sound.playKeyClick();
    this.render();
  }

  openEveningRitual() {
    sound.playKeyClick();
    const todayExpenses = state.getTodayExpenses();

    // Récupération des dépenses existantes aujourd'hui
    this.eveningAdjustments = {
      pocket_food: 0,
      pocket_transport: 0,
      pocket_pleasure: 0,
      pocket_cushion: 0
    };

    todayExpenses.forEach(e => {
      if (this.eveningAdjustments[e.pocketId] !== undefined) {
        this.eveningAdjustments[e.pocketId] += e.amount;
      }
    });

    // Mise à jour de l'affichage des quotas et des valeurs
    const pockets = RavEngine.distributePockets(this.currentAllocatedDaily || 51.10);
    const curr = state.data.user.currency;

    const allocFoodEl = document.getElementById('adjAllocFood');
    const allocTransportEl = document.getElementById('adjAllocTransport');
    const allocPleasureEl = document.getElementById('adjAllocPleasure');
    const allocCushionEl = document.getElementById('adjAllocCushion');

    if (allocFoodEl) allocFoodEl.textContent = `${pockets.food.allocated.toFixed(2)} ${curr}`;
    if (allocTransportEl) allocTransportEl.textContent = `${pockets.transport.allocated.toFixed(2)} ${curr}`;
    if (allocPleasureEl) allocPleasureEl.textContent = `${pockets.pleasure.allocated.toFixed(2)} ${curr}`;
    if (allocCushionEl) allocCushionEl.textContent = `${pockets.cushion.allocated.toFixed(2)} ${curr}`;

    Object.keys(this.eveningAdjustments).forEach(pKey => {
      const displayEl = document.getElementById(`adjVal_${pKey}`);
      if (displayEl) {
        displayEl.textContent = `${this.eveningAdjustments[pKey].toFixed(2)} ${curr}`;
      }
    });

    this.updateEveningOutcomeUI();

    const modal = document.getElementById('eveningRitualModal');
    if (modal) {
      modal.classList.add('open');
    }
  }

  closeEveningRitual() {
    sound.playKeyClick();
    const modal = document.getElementById('eveningRitualModal');
    if (modal) {
      modal.classList.remove('open');
    }
  }

  adjustEveningPocket(pocketId, delta) {
    sound.playKeyClick();
    if (this.eveningAdjustments[pocketId] === undefined) return;

    this.eveningAdjustments[pocketId] = Math.max(0, Number((this.eveningAdjustments[pocketId] + delta).toFixed(2)));

    const displayEl = document.getElementById(`adjVal_${pocketId}`);
    if (displayEl) {
      displayEl.textContent = `${this.eveningAdjustments[pocketId].toFixed(2)} ${state.data.user.currency}`;
    }

    this.updateEveningOutcomeUI();
  }

  updateEveningOutcomeUI() {
    const totalAdjusted = Object.values(this.eveningAdjustments).reduce((sum, v) => sum + v, 0);
    const allocated = this.currentAllocatedDaily || 51.10;
    const diff = Number((allocated - totalAdjusted).toFixed(2));
    const curr = state.data.user.currency;

    const box = document.getElementById('eveningOutcomeBox');
    const titleEl = document.getElementById('eveningOutcomeTitle');
    const amtEl = document.getElementById('eveningOutcomeAmount');
    const descEl = document.getElementById('eveningOutcomeDesc');
    const btnWeekend = document.getElementById('btnEveningTransferWeekend');

    if (diff >= 0) {
      if (box) box.className = 'evening-outcome-box';
      if (titleEl) titleEl.textContent = 'Bravo ! Économies Réalisées ✨';
      if (amtEl) amtEl.textContent = `+${diff.toFixed(2)} ${curr}`;
      if (descEl) descEl.textContent = `Excellente maîtrise aujourd'hui ! Vous terminez la journée avec ${diff.toFixed(2)} ${curr} d'avance. Vous pouvez les envoyer directement dans votre Pack Week-end.`;
      if (btnWeekend) {
        btnWeekend.style.display = 'block';
        btnWeekend.textContent = `🏖️ Transférer mes +${diff.toFixed(2)} ${curr} au Pack Week-end`;
      }
    } else {
      const deficit = Math.abs(diff).toFixed(2);
      if (box) box.className = 'evening-outcome-box deficit';
      if (titleEl) titleEl.textContent = 'Amortissement Automatique 🛡️';
      if (amtEl) amtEl.textContent = `-${deficit} ${curr}`;
      if (descEl) descEl.textContent = `Dépassement doux de ${deficit} ${curr} absorbé par le système. Cet écart est étalé sur les jours restants (~${(Math.abs(diff) / 18).toFixed(2)} ${curr}/j). Vos charges fixes restent 100% sanctuarisées.`;
      if (btnWeekend) {
        btnWeekend.style.display = 'none';
      }
    }
  }

  transferEveningSurplusToWeekend() {
    const totalAdjusted = Object.values(this.eveningAdjustments).reduce((sum, v) => sum + v, 0);
    const allocated = this.currentAllocatedDaily || 51.10;
    const surplus = Math.max(0, Number((allocated - totalAdjusted).toFixed(2)));

    this.applyEveningChanges();

    if (surplus > 0) {
      state.data.user.weekendPackBalance = Number((state.data.user.weekendPackBalance + surplus).toFixed(2));
      state.saveState();
    }

    sound.playSuccessChime();
    this.showToast(`🏖️ +${surplus.toFixed(2)} ${state.data.user.currency} versés au Pack Week-end ! Bravo !`);
    this.closeEveningRitual();
    this.render();
  }

  confirmEveningRitual() {
    this.applyEveningChanges();
    sound.playSuccessChime();
    this.showToast('✨ Journée clôturée avec succès ! Passez une excellente soirée !');
    this.closeEveningRitual();
    this.render();
  }

  applyEveningChanges() {
    // Remplacer les dépenses du jour par les montants ajustés
    const todayStr = new Date().toISOString().split('T')[0];

    // Supprimer les dépenses existantes d'aujourd'hui
    state.data.expenses = state.data.expenses.filter(e => e.date !== todayStr);

    // Réinsérer les dépenses ajustées si > 0
    Object.keys(this.eveningAdjustments).forEach(pKey => {
      const amt = this.eveningAdjustments[pKey];
      if (amt > 0) {
        state.addExpense({
          pocketId: pKey,
          amount: amt,
          label: `Ajustement Clôture du Soir`
        });
      }
    });

    state.saveState();
  }

  openNumpad(selectedPocketId = null) {
    this.currentNumpadBuffer = '0';
    this.updateNumpadDisplay();
    const modal = document.getElementById('numpadModal');
    if (modal) {
      modal.classList.add('open');
      sound.playKeyClick();

      document.querySelectorAll('#numpadPocketsContainer .pocket-direct-btn').forEach(btn => {
        if (selectedPocketId && btn.dataset.pocket === selectedPocketId) {
          btn.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.6)';
          btn.style.borderColor = 'var(--emerald)';
          btn.style.transform = 'scale(1.05)';
        } else {
          btn.style.boxShadow = 'none';
          btn.style.transform = 'none';
        }
      });
    }
  }

  closeNumpad() {
    const modal = document.getElementById('numpadModal');
    if (modal) {
      modal.classList.remove('open');
      sound.playKeyClick();
    }
  }

  handleNumpadInput(val, action) {
    sound.playKeyClick();
    sound.triggerHaptic();

    if (action === 'clear') {
      this.currentNumpadBuffer = '0';
    } else if (action === 'backspace') {
      if (this.currentNumpadBuffer.length > 1) {
        this.currentNumpadBuffer = this.currentNumpadBuffer.slice(0, -1);
      } else {
        this.currentNumpadBuffer = '0';
      }
    } else if (val) {
      if (val === '.') {
        if (!this.currentNumpadBuffer.includes('.')) {
          this.currentNumpadBuffer += '.';
        }
      } else {
        if (this.currentNumpadBuffer === '0') {
          this.currentNumpadBuffer = val;
        } else {
          // Limiter à 2 décimales si point présent
          const parts = this.currentNumpadBuffer.split('.');
          if (parts.length > 1 && parts[1].length >= 2) {
            return; // Déjà 2 décimales
          }
          if (this.currentNumpadBuffer.length < 8) {
            this.currentNumpadBuffer += val;
          }
        }
      }
    }

    this.updateNumpadDisplay();
  }

  updateNumpadDisplay() {
    const visual = document.getElementById('numpadAmountDisplay');
    const curr = state.data.user.currency;
    const currLabel = document.getElementById('numpadCurrencyLabel');
    if (currLabel) currLabel.textContent = curr;
    if (visual) {
      visual.textContent = this.currentNumpadBuffer;
    }
  }

  submitExpenseWithPocket(pocketId) {
    const amountNum = parseFloat(this.currentNumpadBuffer);
    if (isNaN(amountNum) || amountNum <= 0) {
      this.showToast('Veuillez saisir un montant supérieur à 0');
      return;
    }

    // Enregistrement express en un tap
    const expense = state.addExpense({
      pocketId,
      amount: amountNum
    });

    sound.playSuccessChime();
    sound.triggerHaptic();

    const pocketNames = {
      pocket_food: 'Repas',
      pocket_transport: 'Transport',
      pocket_pleasure: 'Plaisirs',
      pocket_cushion: 'Coussin'
    };

    const pName = pocketNames[pocketId] || 'Poche';
    this.showToast(`✅ +${amountNum.toFixed(2)} ${state.data.user.currency} enregistré dans ${pName} (< 2s) !`);
    this.closeNumpad();
    this.render();
  }

  showToast(message) {
    const toast = document.getElementById('appToast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3200);
    }
  }

  render() {
    const user = state.data.user;
    const curr = user.currency;

    // Mise à jour de la salutation utilisateur
    const userGreetingEl = document.getElementById('userGreetingSub');
    if (userGreetingEl) {
      const displayName = user.username ? `@${user.username}` : (user.email ? user.email.split('@')[0] : '');
      userGreetingEl.textContent = displayName ? `Bonjour ${displayName} 👋` : 'Bonjour 👋';
    }

    // 1. Calculs Mathématiques via RavEngine
    const initialRavM = RavEngine.calculateInitialRavM(
      user.netIncome,
      user.fixedChargesTotal,
      user.sanctuarySavings
    );

    const metrics = RavEngine.getCycleMetrics(user.payDayOfMonth);
    const totalSpentInCycle = state.getTotalSpentInCurrentCycle();
    const todayExpenses = state.getTodayExpenses();
    const spentToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

    const isWeekend = [0, 6].includes(new Date().getDay());

    const allocatedDailyRav = RavEngine.calculateDailyRav({
      ravM: initialRavM,
      totalSpentInCycle: totalSpentInCycle - spentToday, // RAVq calculé en début de journée
      remainingDays: metrics.remainingDays,
      strategy: user.weekendStrategy,
      isWeekendToday: isWeekend,
      weekendPackBalance: user.weekendPackBalance
    });

    this.currentAllocatedDaily = allocatedDailyRav;

    const currentRemainingToday = Math.max(0, allocatedDailyRav - spentToday);

    // 2. Mettre à jour l'en-tête et les badges
    const cycleDaysLeftEl = document.getElementById('cycleDaysLeft');
    if (cycleDaysLeftEl) {
      cycleDaysLeftEl.innerHTML = `Jour <strong>${metrics.elapsedDays} / ${metrics.totalDays}</strong> • Reste <strong>${metrics.remainingDays}j</strong>`;
    }

    const cycleModePill = document.getElementById('cycleModePill');
    if (cycleModePill) {
      const modeLabels = {
        DYNAMIC_WEIGHT: 'Pondéré Week-end (w=2.0)',
        WEEKEND_PACK: 'Pack Week-end Dédié',
        ROLLOVER: 'Rollover Économies'
      };
      cycleModePill.textContent = modeLabels[user.weekendStrategy] || 'Standard';
    }

    const currencySelectBtn = document.getElementById('currencySelectBtn');
    if (currencySelectBtn) {
      currencySelectBtn.textContent = curr;
    }

    // 3. Jauge Circulaire Animée (RAVq)
    const gaugeAmountEl = document.getElementById('gaugeAmount');
    const gaugeCurrencyEl = document.getElementById('gaugeCurrency');
    const gaugeFillCircle = document.getElementById('gaugeFillCircle');
    const gaugeStatusChip = document.getElementById('gaugeStatusChip');
    const gaugeSpentTodayEl = document.getElementById('gaugeSpentToday');
    const gaugeTotalDailyEl = document.getElementById('gaugeTotalDaily');

    if (gaugeAmountEl) gaugeAmountEl.textContent = currentRemainingToday.toFixed(2);
    if (gaugeCurrencyEl) gaugeCurrencyEl.textContent = curr;
    if (gaugeSpentTodayEl) gaugeSpentTodayEl.textContent = `${spentToday.toFixed(2)} ${curr}`;
    if (gaugeTotalDailyEl) gaugeTotalDailyEl.textContent = `${allocatedDailyRav.toFixed(2)} ${curr}`;

    // Animation SVG
    const circumference = 628; // 2 * PI * 100
    const ratio = allocatedDailyRav > 0 ? (currentRemainingToday / allocatedDailyRav) : 0;
    const offset = circumference * (1 - Math.min(1, Math.max(0, ratio)));
    if (gaugeFillCircle) {
      gaugeFillCircle.style.strokeDashoffset = offset;

      if (ratio > 0.4) {
        gaugeFillCircle.style.stroke = 'url(#emeraldCyanGrad)';
        if (gaugeStatusChip) {
          gaugeStatusChip.className = 'gauge-status-chip';
          gaugeStatusChip.innerHTML = '● Dans le vert pour aujourd\'hui';
        }
      } else if (ratio > 0.15) {
        gaugeFillCircle.style.stroke = '#F59E0B';
        if (gaugeStatusChip) {
          gaugeStatusChip.className = 'gauge-status-chip warning';
          gaugeStatusChip.innerHTML = '● Attention au rythme de dépense';
        }
      } else {
        gaugeFillCircle.style.stroke = '#F43F5E';
        if (gaugeStatusChip) {
          gaugeStatusChip.className = 'gauge-status-chip critical';
          gaugeStatusChip.innerHTML = '● Seuil quotidien atteint (Amorti)';
        }
      }
    }

    // 4. Les Poches Budgétaires Dynamiques
    const spentByPocket = {};
    todayExpenses.forEach(e => {
      spentByPocket[e.pocketId] = (spentByPocket[e.pocketId] || 0) + e.amount;
    });

    const userPockets = state.data.pockets || [
      { id: 'pocket_food', name: 'Déjeuner & Repas', icon: '🥗', colorHex: '#10B981', targetPercentage: 0.40, displayOrder: 1 },
      { id: 'pocket_transport', name: 'Mobilité & Trajets', icon: '🚗', colorHex: '#06B6D4', targetPercentage: 0.20, displayOrder: 2 },
      { id: 'pocket_pleasure', name: 'Plaisirs & Cafés', icon: '☕', colorHex: '#8B5CF6', targetPercentage: 0.25, displayOrder: 3 },
      { id: 'pocket_cushion', name: 'Coussin Sécurité', icon: '🛡️', colorHex: '#F59E0B', targetPercentage: 0.15, displayOrder: 4, isCushion: true }
    ];

    const distributedPockets = RavEngine.distributeDynamicPockets(allocatedDailyRav, userPockets, spentByPocket);
    this.renderPockets(distributedPockets, curr);
    this.renderNumpadPockets(userPockets);

    // 5. Nudge IA
    const nudge = RavEngine.generateNudge(todayExpenses, allocatedDailyRav, curr);
    const nudgeCard = document.getElementById('aiNudgeCard');
    if (nudgeCard) {
      const nudgeTitle = document.getElementById('nudgeTitle');
      const nudgeText = document.getElementById('nudgeText');
      const nudgeGain = document.getElementById('nudgeGain');
      if (nudgeTitle) nudgeTitle.textContent = nudge.title;
      if (nudgeText) nudgeText.textContent = nudge.text;
      if (nudgeGain) nudgeGain.textContent = nudge.gainDaily;
    }

    // 6. Rendu de l'écran Calibration & Flux
    this.renderCalibrationLabels(curr);

    // 7. Rendu de l'écran Historique & Activité
    this.renderHistory();

    // 8. Rendu de l'écran Audit IA & Effet Latte
    this.renderAuditScreen();
  }

  renderCalibrationLabels(curr) {
    document.querySelectorAll('.calibration-curr-label').forEach(el => {
      el.textContent = curr;
    });

    const rangeIncome = document.getElementById('rangeIncome');
    const rangeFixed = document.getElementById('rangeFixed');
    const rangeSavings = document.getElementById('rangeSavings');
    const inputPayDay = document.getElementById('inputPayDay');

    const income = Number(rangeIncome?.value || 2400);
    const fixed = Number(rangeFixed?.value || 1250);
    const savings = Number(rangeSavings?.value || 200);
    const payDay = Number(inputPayDay?.value || 28);

    const ravm = RavEngine.calculateInitialRavM(income, fixed, savings);
    const metrics = RavEngine.getCycleMetrics(payDay);
    const ravq = (ravm / metrics.totalDays).toFixed(2);

    const previewM = document.getElementById('previewRavM');
    const previewQ = document.getElementById('previewRavQ');
    if (previewM) previewM.textContent = `${ravm.toLocaleString()} ${curr}`;
    if (previewQ) previewQ.textContent = `${ravq} ${curr}/j`;
  }

  renderPockets(distributedPockets, curr) {
    const container = document.getElementById('pocketsGridContainer');
    const titleEl = document.getElementById('pocketsSectionTitle');
    if (titleEl) {
      titleEl.textContent = `📁 Vos ${distributedPockets.length} Poches du Jour`;
    }
    if (!container) return;

    container.innerHTML = distributedPockets.map(p => {
      const pct = p.allocated > 0 ? (p.spent / p.allocated) * 100 : 0;
      const displayPct = Math.round(p.percentage * 100);
      return `
        <div class="pocket-card" data-pocket-id="${p.id}" style="border-left: 3px solid ${p.colorHex}; cursor: pointer;">
          <div class="pocket-top-row">
            <span class="pocket-icon">${p.icon}</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="pocket-quota" style="color: ${p.colorHex};">${displayPct}%</span>
              <span style="font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 6px; border: 1px solid ${p.colorHex}; color: ${p.colorHex}; background: rgba(255, 255, 255, 0.04);">+ Saisir</span>
            </div>
          </div>
          <div class="pocket-title">${p.name}</div>
          <div class="pocket-balance">${p.remaining.toFixed(2)} ${curr} <small>/ ${p.allocated.toFixed(2)} ${curr}</small></div>
          <div class="pocket-progress-track">
            <div class="pocket-progress-fill" style="width: ${Math.min(100, pct)}%; background: ${p.colorHex};"></div>
          </div>
        </div>
      `;
    }).join('');

    // Écouteur de clic sur chaque poche pour saisie directe
    pocketsContainer.querySelectorAll('.pocket-card').forEach(card => {
      card.addEventListener('click', () => {
        const pocketId = card.dataset.pocketId;
        this.openNumpad(pocketId);
      });
    });
  }

  renderNumpadPockets(userPockets) {
    const container = document.getElementById('numpadPocketsContainer');
    if (!container) return;

    container.innerHTML = userPockets.map(p => `
      <button class="pocket-direct-btn" data-pocket="${p.id}" title="Valider dans ${p.name}" style="border-left: 2px solid ${p.colorHex || '#10B981'};">
        <span class="btn-pocket-icon">${p.icon}</span>
        <span class="btn-pocket-label">${p.name.split(' ')[0]}</span>
      </button>
    `).join('');

    // Réattacher les écouteurs de clic sur les poches du pavé numérique
    container.querySelectorAll('.pocket-direct-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pocketId = btn.dataset.pocket;
        this.submitExpenseWithPocket(pocketId);
      });
    });
  }

  renderHistory() {
    const user = state.data.user;
    const curr = user.currency;
    const allExpenses = state.data.expenses;
    const totalSpentInCycle = state.getTotalSpentInCurrentCycle();
    const todayExpenses = state.getTodayExpenses();
    const spentToday = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

    const histKpiCycle = document.getElementById('histKpiCycle');
    const histKpiToday = document.getElementById('histKpiToday');
    if (histKpiCycle) histKpiCycle.textContent = `${totalSpentInCycle.toFixed(2)} ${curr}`;
    if (histKpiToday) histKpiToday.textContent = `${spentToday.toFixed(2)} ${curr}`;

    const container = document.getElementById('historyListContainer');
    if (!container) return;

    let filtered = allExpenses;
    if (this.currentHistoryFilter !== 'ALL') {
      filtered = allExpenses.filter(e => e.pocketId === this.currentHistoryFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🌱</div>
          <div style="font-size: 14px; font-weight: 700; color: var(--text-secondary);">Aucune dépense dans cette poche</div>
          <div style="font-size: 12px; margin-top: 4px;">Tapez sur « 2-Taps » pour ajouter un achat !</div>
        </div>
      `;
      return;
    }

    const pocketDetails = {
      pocket_food: { icon: '🥗', name: 'Repas', color: 'var(--pocket-food)' },
      pocket_transport: { icon: '🚗', name: 'Mobilité', color: 'var(--pocket-transport)' },
      pocket_pleasure: { icon: '☕', name: 'Plaisirs', color: 'var(--pocket-pleasure)' },
      pocket_cushion: { icon: '🛡️', name: 'Coussin', color: 'var(--pocket-cushion)' }
    };

    container.innerHTML = filtered.map(exp => {
      const p = pocketDetails[exp.pocketId] || { icon: '⚡', name: 'Dépense', color: 'var(--accent-emerald)' };
      return `
        <div class="expense-item-row" data-id="${exp.id}">
          <div class="expense-item-left">
            <div class="expense-pocket-icon-badge" style="border-left: 3px solid ${p.color};">
              <span>${p.icon}</span>
            </div>
            <div class="expense-info-col">
              <span class="expense-label-text">${exp.label || p.name}</span>
              <span class="expense-meta-text">${exp.timestamp || ''} • <strong style="color: ${p.color}">${p.name}</strong></span>
            </div>
          </div>
          <div class="expense-item-right">
            <span class="expense-amount-val">-${exp.amount.toFixed(2)} ${curr}</span>
            <button class="btn-delete-expense" data-id="${exp.id}" title="Annuler cette saisie">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Écouteur suppression de dépense
    container.querySelectorAll('.btn-delete-expense').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        state.deleteExpense(id);
        sound.playKeyClick();
        this.showToast('🗑️ Dépense supprimée et RAV recalculé');
        this.render();
      });
    });
  }

  renderAuditScreen() {
    const curr = state.data.user.currency;
    const optimizedItems = this.auditSubscriptions.filter(s => s.optimized);
    const totalDailyGain = optimizedItems.reduce((sum, s) => sum + s.dailyGain, 0);
    const totalAnnualGain = totalDailyGain * 365;

    const heroDailyEl = document.getElementById('auditHeroDailyGain');
    const heroAnnualEl = document.getElementById('auditHeroAnnualGain');
    const btnGainEl = document.getElementById('auditBtnGain');

    if (heroDailyEl) heroDailyEl.textContent = `+${totalDailyGain.toFixed(2)} ${curr}`;
    if (heroAnnualEl) heroAnnualEl.textContent = `+${Math.round(totalAnnualGain).toLocaleString()} ${curr} / an`;
    if (btnGainEl) btnGainEl.textContent = `${totalDailyGain.toFixed(2)}`;

    // Rendu des Cartes d'Abonnements
    const subsContainer = document.getElementById('auditSubsListContainer');
    if (subsContainer) {
      subsContainer.innerHTML = this.auditSubscriptions.map(sub => `
        <div class="audit-sub-card ${sub.optimized ? 'optimized' : ''}">
          <div class="audit-sub-top">
            <div class="audit-sub-left">
              <span class="audit-sub-icon">${sub.icon}</span>
              <div>
                <div class="audit-sub-name">${sub.name}</div>
                <div class="audit-sub-cost">${sub.monthlyCost.toFixed(2)} ${curr} / mois</div>
              </div>
            </div>
            <button class="btn-toggle-optimize" data-id="${sub.id}">
              ${sub.optimized ? '✓ Optimisé' : 'Optimiser'}
            </button>
          </div>
          <div class="audit-sub-recommendation">${sub.recommendation}</div>
          <div class="audit-gain-tag">
            <span>⚡ Gain : +${sub.dailyGain.toFixed(2)} ${curr} / jour de liberté</span>
          </div>
        </div>
      `).join('');

      // Écouteur sur chaque bouton de bascule
      subsContainer.querySelectorAll('.btn-toggle-optimize').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const target = this.auditSubscriptions.find(s => s.id === id);
          if (target) {
            target.optimized = !target.optimized;
            sound.playKeyClick();
            this.renderAuditScreen();
          }
        });
      });
    }

    // Effet Latte
    const latteDaysVal = document.getElementById('latteDaysVal');
    const latteGainDisplay = document.getElementById('latteGainDisplay');
    const latteSlider = document.getElementById('latteSlider');

    if (latteSlider) latteSlider.value = this.latteDays;
    if (latteDaysVal) latteDaysVal.textContent = this.latteDays;

    // Calcul de l'économie Latte : 2.20€ * jours * 4.33 semaines
    const monthlyLatte = Number((this.latteDays * 2.20 * 4.333).toFixed(2));
    if (latteGainDisplay) {
      latteGainDisplay.textContent = `+${monthlyLatte.toFixed(2)} ${curr} / mois`;
    }
  }

  applyOptimizationsToRav() {
    const optimizedItems = this.auditSubscriptions.filter(s => s.optimized);
    if (optimizedItems.length === 0) {
      this.showToast('Sélectionnez au moins une optimisation');
      return;
    }

    const totalMonthlyOptimized = optimizedItems.reduce((sum, s) => sum + s.monthlyCost, 0);
    const latteMonthly = Number((this.latteDays * 2.20 * 4.333).toFixed(2));

    // 1. Réduire les charges fixes dans l'état utilisateur
    const previousFixed = state.data.user.fixedChargesTotal;
    state.data.user.fixedChargesTotal = Math.max(200, Number((previousFixed - totalMonthlyOptimized).toFixed(2)));

    // 2. Transférer le gain Latte au Pack Week-end
    if (latteMonthly > 0) {
      state.data.user.weekendPackBalance = Number((state.data.user.weekendPackBalance + latteMonthly).toFixed(2));
    }

    state.saveState();
    sound.playSuccessChime();

    const curr = state.data.user.currency;
    this.showToast(`🎉 Charges réduites de -${totalMonthlyOptimized.toFixed(2)} ${curr}/m ! Votre RAV quotidien augmente immédiatement !`);

    // Basculer vers l'écran d'accueil pour admirer le nouveau RAVq
    this.switchScreen('dash');
  }

  bindAuthEvents() {
    const authModal = document.getElementById('authModal');
    const tabLogin = document.getElementById('tabAuthLogin');
    const tabRegister = document.getElementById('tabAuthRegister');
    const currencyGroup = document.getElementById('authCurrencyGroup');
    const identifierLabel = document.getElementById('authIdentifierLabel');
    const identifierInput = document.getElementById('authIdentifierInput');
    const passwordInput = document.getElementById('authPasswordInput');
    const btnSubmit = document.getElementById('btnAuthSubmit');
    const errorBox = document.getElementById('authErrorBox');
    const errorText = document.getElementById('authErrorText');
    const btnLogout = document.getElementById('btnLogoutSimulator');
    const userGreeting = document.getElementById('userGreetingSub');

    let isLogin = true;
    let selectedCurrency = 'EUR';

    // 4 Poches initiales proposées à l'inscription
    let authPockets = [
      { key: 'food', name: 'Déjeuner & Repas', icon: '🥗', colorHex: '#10B981', targetPercentage: 0.40, displayOrder: 1, isSystemDefault: false },
      { key: 'transport', name: 'Mobilité & Trajets', icon: '🚗', colorHex: '#06B6D4', targetPercentage: 0.20, displayOrder: 2, isSystemDefault: false },
      { key: 'pleasure', name: 'Plaisirs & Cafés', icon: '☕', colorHex: '#8B5CF6', targetPercentage: 0.25, displayOrder: 3, isSystemDefault: false },
      { key: 'cushion', name: 'Coussin Sécurité', icon: '🛡️', colorHex: '#F59E0B', targetPercentage: 0.15, displayOrder: 4, isSystemDefault: true }
    ];

    const pocketsListContainer = document.getElementById('authPocketsList');
    const pocketsTotalBadge = document.getElementById('authPocketsTotalBadge');
    const btnAutoRebalance = document.getElementById('btnAuthAutoRebalance');

    const renderAuthPockets = () => {
      if (!pocketsListContainer) return;
      const total = Math.round(authPockets.reduce((sum, p) => sum + p.targetPercentage, 0) * 100);
      if (pocketsTotalBadge) {
        pocketsTotalBadge.textContent = `${total}% ${total === 100 ? '✅' : '⚠️'}`;
        pocketsTotalBadge.style.color = total === 100 ? '#10B981' : '#F59E0B';
        pocketsTotalBadge.style.background = total === 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)';
      }

      pocketsListContainer.innerHTML = authPockets.map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);padding:8px 12px;border-radius:8px;margin-bottom:6px;border:1px solid rgba(255,255,255,0.06);">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:16px;">${p.icon}</span>
            <span style="font-size:13px;font-weight:600;color:var(--text);">${p.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button type="button" class="btn-pocket-adjust" data-key="${p.key}" data-delta="-0.05" style="width:28px;height:28px;border-radius:6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);color:var(--text);cursor:pointer;font-weight:bold;">-</button>
            <span style="font-size:13px;font-weight:700;color:#10B981;min-width:38px;text-align:center;">${Math.round(p.targetPercentage * 100)}%</span>
            <button type="button" class="btn-pocket-adjust" data-key="${p.key}" data-delta="0.05" style="width:28px;height:28px;border-radius:6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);color:var(--text);cursor:pointer;font-weight:bold;">+</button>
          </div>
        </div>
      `).join('');

      pocketsListContainer.querySelectorAll('.btn-pocket-adjust').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.key;
          const delta = parseFloat(btn.dataset.delta);
          const pocket = authPockets.find(p => p.key === key);
          if (pocket) {
            pocket.targetPercentage = Math.max(0.05, Math.min(0.80, Number((pocket.targetPercentage + delta).toFixed(2))));
            renderAuthPockets();
          }
        });
      });
    };

    if (btnAutoRebalance) {
      btnAutoRebalance.addEventListener('click', () => {
        const nonCushionTotal = authPockets
          .filter(p => p.key !== 'cushion')
          .reduce((sum, p) => sum + p.targetPercentage, 0);
        const remainder = Math.max(0.05, Number((1.0 - nonCushionTotal).toFixed(2)));
        const cushion = authPockets.find(p => p.key === 'cushion');
        if (cushion) {
          cushion.targetPercentage = remainder;
          renderAuthPockets();
        }
      });
    }

    renderAuthPockets();

    // Raccourcis Démo
    const btnDemoPseudo = document.getElementById('btnDemoPseudo');
    const btnDemoEmail = document.getElementById('btnDemoEmail');

    if (btnDemoPseudo && identifierInput && passwordInput) {
      btnDemoPseudo.addEventListener('click', () => {
        identifierInput.value = 'alexandre';
        passwordInput.value = 'password123';
        if (errorBox) errorBox.style.display = 'none';
      });
    }

    if (btnDemoEmail && identifierInput && passwordInput) {
      btnDemoEmail.addEventListener('click', () => {
        identifierInput.value = 'alexandre.dupont@entreprise.fr';
        passwordInput.value = 'password123';
        if (errorBox) errorBox.style.display = 'none';
      });
    }

    // Bascule Onglets
    if (tabLogin && tabRegister && currencyGroup && btnSubmit) {
      tabLogin.addEventListener('click', () => {
        isLogin = true;
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        currencyGroup.style.display = 'none';
        identifierLabel.textContent = 'Pseudo ou Email';
        btnSubmit.textContent = 'Se Connecter ⚡';
        if (errorBox) errorBox.style.display = 'none';
      });

      tabRegister.addEventListener('click', () => {
        isLogin = false;
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        currencyGroup.style.display = 'block';
        identifierLabel.textContent = 'Votre Pseudo (ou Email)';
        btnSubmit.textContent = 'Créer mon Espace RAV ✨';
        if (errorBox) errorBox.style.display = 'none';
      });
    }

    // Sélection devise
    document.querySelectorAll('.auth-curr-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.auth-curr-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCurrency = btn.dataset.curr || 'EUR';
      });
    });

    // Soumission formulaire
    if (btnSubmit && identifierInput && passwordInput && authModal) {
      btnSubmit.addEventListener('click', async () => {
        const idVal = identifierInput.value.trim();
        const pwdVal = passwordInput.value.trim();

        if (!idVal || !pwdVal) {
          if (errorBox && errorText) {
            errorText.textContent = 'Veuillez saisir votre identifiant et mot de passe';
            errorBox.style.display = 'block';
          }
          return;
        }

        if (!isLogin) {
          const totalPct = Math.round(authPockets.reduce((sum, p) => sum + p.targetPercentage, 0) * 100);
          if (totalPct !== 100) {
            if (errorBox && errorText) {
              errorText.textContent = `Le total de vos poches fait ${totalPct}%. Ajustez pour atteindre 100% (ou cliquez sur "Équilibrer").`;
              errorBox.style.display = 'block';
            }
            return;
          }
        }

        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Vérification...';

        try {
          const endpoint = isLogin ? 'http://localhost:4000/api/v1/auth/login' : 'http://localhost:4000/api/v1/auth/register';
          const payload = isLogin
            ? { identifier: idVal, password: pwdVal }
            : { identifier: idVal, password: pwdVal, currency: selectedCurrency, initialPockets: authPockets };

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Identifiants incorrects');
          }

          // Connexion ou Inscription réussie !
          sound.playSuccessChime();
          authModal.style.display = 'none';

          const currMap = { EUR: '€', FCFA: 'FCFA', USD: '$', CHF: 'CHF' };
          const resolvedCurrency = data.user.currency ? (currMap[data.user.currency] || data.user.currency) : 'FCFA';

          if (!isLogin) {
            // Nouveau compte : 0 flux renseigné = 0 FCFA disponible tant que non calibré !
            state.data.user = {
              id: data.user.id,
              username: data.user.username,
              email: data.user.email || '',
              currency: resolvedCurrency,
              subscriptionTier: data.user.subscriptionTier || 'FREE',
              weekendStrategy: data.user.weekendStrategy || 'DYNAMIC_WEIGHT',
              payDayOfMonth: 28,
              netIncome: 0,
              fixedChargesTotal: 0,
              sanctuarySavings: 0,
              weekendPackBalance: 0
            };
            state.data.expenses = [];
            state.data.fixedChargesList = [];
            state.saveState();

            // Mettre à jour les inputs de l'écran Calibration
            const inputIncome = document.getElementById('inputIncome');
            const rangeIncome = document.getElementById('rangeIncome');
            const inputFixed = document.getElementById('inputFixed');
            const rangeFixed = document.getElementById('rangeFixed');
            const inputSavings = document.getElementById('inputSavings');
            const rangeSavings = document.getElementById('rangeSavings');
            if (inputIncome) inputIncome.value = 0;
            if (rangeIncome) rangeIncome.value = 0;
            if (inputFixed) inputFixed.value = 0;
            if (rangeFixed) rangeFixed.value = 0;
            if (inputSavings) inputSavings.value = 0;
            if (rangeSavings) rangeSavings.value = 0;
          } else {
            // Utilisateur existant
            state.data.user.id = data.user.id;
            state.data.user.username = data.user.username;
            state.data.user.email = data.user.email || '';
            state.data.user.currency = resolvedCurrency;
            state.saveState();
          }

          const displayName = data.user.username || data.user.email?.split('@')[0] || idVal;
          if (userGreeting) {
            userGreeting.textContent = `Bonjour @${displayName} 👋`;
          }

          this.render();
          if (!isLogin) {
            this.showToast(`✨ Bienvenue @${displayName} ! Configurez vos flux dans « Flux » pour démarrer.`);
          } else {
            this.showToast(`✨ Bienvenue @${displayName} ! Session active`);
          }
        } catch (err) {
          if (errorBox && errorText) {
            errorText.textContent = `⚠️ ${err.message}`;
            errorBox.style.display = 'block';
          }
        } finally {
          btnSubmit.disabled = false;
          btnSubmit.textContent = isLogin ? 'Se Connecter ⚡' : 'Créer mon Espace RAV ✨';
        }
      });
    }

    // Déconnexion & Purge locale
    if (btnLogout && authModal) {
      btnLogout.addEventListener('click', () => {
        state.resetAll();
        authModal.style.display = 'flex';
        this.showToast('Session fermée et données locales réinitialisées');
      });
    }
  }
}

// Initialisation dès chargement du DOM ou immédiate si déjà chargé
function initApp() {
  const app = new RavApp();
  app.init();
  window.ravApp = app;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
