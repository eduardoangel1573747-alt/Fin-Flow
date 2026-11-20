// v2.0 - Refactorizado y limpio
import { auth, db, dbMethods } from '../config/firebase.js';

const settingsKeys = {
    language: 'finances_lang',
    currency: 'finances_currency',
    theme: 'finances_theme',
    fontSize: 'finances_font_size'
};

const allowedLanguages = new Set(['es', 'en', 'fr']);
const allowedCurrencies = new Set(['$', '€', 'Q', '£']);
const allowedThemes = new Set(['claro', 'oscuro']);
const allowedFontSizes = new Set(['f-sm', 'f-base', 'f-lg']);

let currentDictionary = {};

function getStoredValue(key, allowedValues, fallback) {
    const value = localStorage.getItem(key);
    return allowedValues.has(value) ? value : fallback;
}

async function applyLanguage(language) {
    currentDictionary = await window.applyFinancesLanguage(language);

    const status = document.getElementById('feedbackStatus');
    if (status?.dataset.messageKey && currentDictionary[status.dataset.messageKey]) {
        status.textContent = currentDictionary[status.dataset.messageKey];
    }
}

function applyTheme(theme) {
    const isLight = theme === 'claro';
    document.body.classList.toggle('theme-light', isLight);
    document.documentElement.classList.toggle('dark', !isLight);
}

function applyFontSize(size) {
    const fontSizes = { 'f-sm': '14px', 'f-base': '16px', 'f-lg': '18px' };
    document.documentElement.style.fontSize = fontSizes[size];
}

function showFeedbackStatus(messageKey, type) {
    const status = document.getElementById('feedbackStatus');
    status.dataset.messageKey = messageKey;
    status.textContent = currentDictionary[messageKey];
    status.className = `mt-3 rounded-lg border p-3 text-sm ${
        type === 'success'
            ? 'border-emerald-700 bg-emerald-950/60 text-emerald-300'
            : 'border-rose-700 bg-rose-950/60 text-rose-300'
    }`;
}

function updateSetting(key, value, allowedValues) {
    if (!allowedValues.has(value)) return;
    if (key === settingsKeys.language && typeof window.changeLanguage === 'function') {
        window.changeLanguage(value);
        return;
    }
    if (key === settingsKeys.currency && typeof window.changeCurrency === 'function') {
        window.changeCurrency(value);
        return;
    }
    localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent('finances-settings-changed', {
        detail: {
            language: getStoredValue(settingsKeys.language, allowedLanguages, 'es'),
            currency: getStoredValue(settingsKeys.currency, allowedCurrencies, '$')
        }
    }));
}

async function initializeSettings() {
    const language = getStoredValue(settingsKeys.language, allowedLanguages, 'es');
    const currency = getStoredValue(settingsKeys.currency, allowedCurrencies, '$');
    const theme = getStoredValue(settingsKeys.theme, allowedThemes, 'oscuro');
    const fontSize = getStoredValue(settingsKeys.fontSize, allowedFontSizes, 'f-base');

    document.getElementById('selectorIdioma').value = language;
    document.getElementById('selectorMoneda').value = currency;
    document.getElementById('selectTema').value = theme;
    document.getElementById('selectFuente').value = fontSize;

    await applyLanguage(language);
    applyTheme(theme);
    applyFontSize(fontSize);

    // Event Listeners
    document.getElementById('selectorIdioma').addEventListener('change', async event => {
        if (!allowedLanguages.has(event.target.value)) return;
        updateSetting(settingsKeys.language, event.target.value, allowedLanguages);
        try {
            await applyLanguage(event.target.value);
        } catch (error) {
            window.financesLogger.error('language_apply_failed', error, {
                module: 'settings',
                trigger: 'selection'
            });
        }
    });

    document.getElementById('selectorMoneda').addEventListener('change', event => {
        updateSetting(settingsKeys.currency, event.target.value, allowedCurrencies);
    });

    document.getElementById('selectTema').addEventListener('change', event => {
        if (!allowedThemes.has(event.target.value)) return;
        updateSetting(settingsKeys.theme, event.target.value, allowedThemes);
        applyTheme(event.target.value);
    });

    document.getElementById('selectFuente').addEventListener('change', event => {
        if (!allowedFontSizes.has(event.target.value)) return;
        updateSetting(settingsKeys.fontSize, event.target.value, allowedFontSizes);
        applyFontSize(event.target.value);
    });

    document.getElementById('feedbackForm').addEventListener('submit', submitFeedback);
}

async function submitFeedback(event) {
    event.preventDefault();
    const language = getStoredValue(settingsKeys.language, allowedLanguages, 'es');
    const submitButton = document.getElementById('feedbackSubmit');
    const feedbackText = document.getElementById('feedbackText');
    const message = feedbackText.value.trim();

    if (message.length > 2000) {
        feedbackText.setCustomValidity(currentDictionary.feedbackTooLong);
        feedbackText.reportValidity();
        return;
    }
    if (!message) {
        feedbackText.setCustomValidity(currentDictionary.feedbackRequired);
        feedbackText.reportValidity();
        return;
    }
    feedbackText.setCustomValidity('');

    submitButton.disabled = true;
    showFeedbackStatus('feedbackSending', 'success');

    try {
        const user = auth.currentUser || await new Promise((resolve, reject) => {
            let unsubscribe = () => {};
            unsubscribe = dbMethods.onAuthStateChanged(auth, currentUser => {
                unsubscribe();
                resolve(currentUser);
            }, error => {
                unsubscribe();
                reject(error);
            });
        });

        if (!user) {
            showFeedbackStatus('feedbackSignIn', 'error');
            return;
        }

        const userDocument = dbMethods.doc(db, 'users', user.uid);
        await dbMethods.setDoc(userDocument, {
            feedback: dbMethods.arrayUnion({
                message,
                language,
                createdAt: new Date().toISOString()
            })
        }, { merge: true });

        document.getElementById('feedbackForm').reset();
        showFeedbackStatus('feedbackSent', 'success');
    } catch (error) {
        window.financesLogger.error('feedback_save_failed', error, {
            module: 'settings',
            operation: 'setDoc'
        });
        showFeedbackStatus('feedbackFailed', 'error');
    } finally {
        submitButton.disabled = false;
    }
}

// Escuchar cambios de almacenamiento en otras pestañas
window.addEventListener('storage', async event => {
    if (event.key === settingsKeys.language) {
        const language = getStoredValue(settingsKeys.language, allowedLanguages, 'es');
        document.getElementById('selectorIdioma').value = language;
        try {
            await applyLanguage(language);
        } catch (error) {
            window.financesLogger.error('language_apply_failed', error, {
                module: 'settings',
                trigger: 'storage_event'
            });
        }
    } else if (event.key === settingsKeys.currency) {
        document.getElementById('selectorMoneda').value = getStoredValue(settingsKeys.currency, allowedCurrencies, '$');
    } else if (event.key === settingsKeys.theme) {
        const theme = getStoredValue(settingsKeys.theme, allowedThemes, 'oscuro');
        document.getElementById('selectTema').value = theme;
        applyTheme(theme);
    } else if (event.key === settingsKeys.fontSize) {
        const fontSize = getStoredValue(settingsKeys.fontSize, allowedFontSizes, 'f-base');
        document.getElementById('selectFuente').value = fontSize;
        applyFontSize(fontSize);
    }
});

// Botón de volver atrás genérico
document.addEventListener('click', function(event) {
    const backBtn = event.target.closest('#backBtn');
    if (backBtn) {
        event.preventDefault();
        window.history.back();
    }
});

// Inicializar módulo
initializeSettings().catch(error => {
    window.financesLogger.error('settings_initialization_failed', error, {
        module: 'settings'
    });
});