(function () {
    const SETTINGS_KEYS = {
        language: 'finances_lang',
        currency: 'finances_currency'
    };
    const allowedCurrencies = new Set(['$', '€', 'Q', '£']);
    const allowedLanguages = new Set(['es', 'en', 'fr']);
    const currencySelectIds = new Set(['settingCurrency', 'currencySelect']);
    const languageSelectIds = new Set(['settingLanguage', 'langSelect']);
    const legacyTextKeys = {
        'Dashboard Principal': 'dashboardMain',
        'Presupuesto Mes a Mes': 'budgetTitle',
        'Vistas de Gastos Diariamente': 'dailyExpensesTitle',
        'Gastos Diarios': 'dailyExpensesTitle',
        'Objetivos de Ahorro': 'savingsTitle',
        'Carteras & Cuentas': 'walletsTitle',
        'Cuentas Carteras': 'walletsTitle',
        'Historial Mes a Mes': 'histPageTitle',
        'Historial': 'histPageTitle',
        'Configuración': 'settingsTitle',
        'Configuración de App': 'appSettings',
        'Ajustes': 'settingsTitle',
        'Gestión Avanzada': 'advancedManagement',
        'Versión App': 'appVersion',
        'Volver al Panel': 'backBtn',
        'Idioma / Language': 'label_idioma',
        'Moneda / Currency': 'label_moneda',
        'Aceptar y cerrar': 'settingsApply',
        'Cerrar Sesión': 'logout',
        'Módulos': 'modules',
        'Presupuesto seleccionado': 'selectedBudget',
        'Ingresos': 'totalIncome',
        'Presupuesto': 'budgetTitle',
        'Gastado': 'totalSpent',
        'Disponible': 'netBalance',
        'Balance': 'netBalance',
        'Nueva Categoría': 'createCatBtn',
        'Registrar Gasto': 'optionExpense',
        'Registrar Ingreso': 'optionIncome',
        'Mis Categorías': 'myCategories',
        'Movimientos del mes': 'txHistory',
        'Recomendaciones': 'recommendations'
    };
    const dictionaries = new Map();
    const originalText = new WeakMap();
    const scriptElement = Array.from(document.scripts).find(script =>
        script.src && new URL(script.src, document.baseURI).pathname.endsWith('/settings-global.js')
    );
    const localesUrl = scriptElement
        ? new URL('../locales/', scriptElement.src)
        : new URL('../locales/', document.baseURI);
    let currentDictionary = {};
    let languageRequestId = 0;
    let translationObserver;

    function getSettings() {
        const language = localStorage.getItem(SETTINGS_KEYS.language);
        const currency = localStorage.getItem(SETTINGS_KEYS.currency);
        return {
            language: allowedLanguages.has(language) ? language : 'es',
            currency: allowedCurrencies.has(currency) ? currency : '$'
        };
    }

    function loadDictionary(language) {
        if (!dictionaries.has(language)) {
            const request = fetch(new URL(`${language}.json`, localesUrl))
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`No se pudo cargar el idioma ${language}: ${response.status}`);
                    }
                    return response.json();
                })
                .then(dictionary => {
                    if (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary)) {
                        throw new Error(`El diccionario ${language}.json no tiene un formato válido.`);
                    }
                    return dictionary;
                })
                .catch(error => {
                    dictionaries.delete(language);
                    throw error;
                });
            dictionaries.set(language, request);
        }
        return dictionaries.get(language);
    }

    function setTranslatedText(element, translation) {
        const textNodes = Array.from(element.childNodes).filter(node =>
            node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()
        );
        if (textNodes.length) {
            const textNode = textNodes[textNodes.length - 1];
            const source = originalText.get(textNode) || textNode.nodeValue;
            if (!originalText.has(textNode)) originalText.set(textNode, source);
            const trimmed = source.trim();
            const leadingWhitespace = source.slice(0, source.indexOf(trimmed));
            const trailingWhitespace = source.slice(source.indexOf(trimmed) + trimmed.length);
            const translatedText = `${leadingWhitespace}${translation}${trailingWhitespace}`;
            if (textNode.nodeValue !== translatedText) textNode.nodeValue = translatedText;
            return;
        }
        if (element.textContent !== translation) element.textContent = translation;
    }

    function translateElements(root, dictionary) {
        const elements = [];
        if (root.nodeType === Node.ELEMENT_NODE && root.matches('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]')) {
            elements.push(root);
        }
        if (root.querySelectorAll) {
            elements.push(...root.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]'));
        }

        elements.forEach(element => {
            const key = element.dataset.i18n;
            if (key && typeof dictionary[key] === 'string' && element.textContent !== dictionary[key]) {
                setTranslatedText(element, dictionary[key]);
            }
            const placeholderKey = element.dataset.i18nPlaceholder;
            if (placeholderKey && typeof dictionary[placeholderKey] === 'string' && element.placeholder !== dictionary[placeholderKey]) {
                element.placeholder = dictionary[placeholderKey];
            }
            const titleKey = element.dataset.i18nTitle;
            if (titleKey && typeof dictionary[titleKey] === 'string' && element.title !== dictionary[titleKey]) {
                element.title = dictionary[titleKey];
            }
            const ariaLabelKey = element.dataset.i18nAriaLabel;
            if (ariaLabelKey && typeof dictionary[ariaLabelKey] === 'string' && element.getAttribute('aria-label') !== dictionary[ariaLabelKey]) {
                element.setAttribute('aria-label', dictionary[ariaLabelKey]);
            }
        });

        const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (treeWalker.nextNode()) textNodes.push(treeWalker.currentNode);
        textNodes.forEach(node => {
            if (node.parentElement?.closest('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]')) return;
            const source = originalText.get(node) || node.nodeValue;
            if (!originalText.has(node)) originalText.set(node, source);
            const trimmed = source.trim();
            const key = legacyTextKeys[trimmed];
            if (!key || typeof dictionary[key] !== 'string') return;
            const translatedText = source.replace(trimmed, dictionary[key]);
            if (node.nodeValue !== translatedText) node.nodeValue = translatedText;
        });

        const selectOptions = {
            selectTema: { claro: 'lightTheme', oscuro: 'darkTheme' },
            selectFuente: { 'f-sm': 'smallFont', 'f-base': 'normalFont', 'f-lg': 'largeFont' },
            selectorMoneda: { '$': 'dollar', '€': 'euro', Q: 'quetzal', '£': 'pound' },
            settingCurrency: { '$': 'dollar', '€': 'euro', Q: 'quetzal', '£': 'pound' },
            currencySelect: { '$': 'dollar', '€': 'euro', Q: 'quetzal', '£': 'pound' }
        };
        Object.entries(selectOptions).forEach(([selectId, options]) => {
            const select = document.getElementById(selectId);
            if (!select) return;
            Array.from(select.options).forEach(option => {
                const optionKey = options[option.value];
                if (optionKey && typeof dictionary[optionKey] === 'string' && option.textContent !== dictionary[optionKey]) {
                    option.textContent = dictionary[optionKey];
                }
            });
        });
    }

    async function applyLanguage(language) {
        if (!allowedLanguages.has(language)) {
            throw new Error(`Idioma no permitido: ${language}`);
        }
        const requestId = ++languageRequestId;
        const dictionary = await loadDictionary(language);
        if (requestId !== languageRequestId || getSettings().language !== language) {
            return currentDictionary;
        }
        currentDictionary = dictionary;
        document.documentElement.lang = language;
        const pageTitle = document.querySelector('title[data-i18n]');
        if (pageTitle && typeof dictionary[pageTitle.dataset.i18n] === 'string') {
            pageTitle.textContent = dictionary[pageTitle.dataset.i18n];
        }
        translateElements(document.body, dictionary);
        window.currentLang = language;
        return dictionary;
    }

    function applySettingsControls() {
        const settings = getSettings();
        const languageSelect = document.getElementById('selectorIdioma')
            || document.getElementById('settingLanguage')
            || document.getElementById('langSelect');
        const currencySelect = document.getElementById('selectorMoneda')
            || document.getElementById('settingCurrency')
            || document.getElementById('currencySelect');
        if (languageSelect) languageSelect.value = settings.language;
        if (currencySelect) currencySelect.value = settings.currency;
        window.currencySymbol = settings.currency;
        applyLanguage(settings.language).catch(error => {
            window.financesLogger.error('language_apply_failed', error, {
                module: 'settings',
                trigger: 'stored_settings'
            });
        });
    }

    function dispatchSettingsChanged() {
        const settings = getSettings();
        window.currencySymbol = settings.currency;
        window.currentLang = settings.language;
        window.dispatchEvent(new CustomEvent('finances-settings-changed', {
            detail: settings
        }));
        applyLanguage(settings.language).catch(error => {
            window.financesLogger.error('language_apply_failed', error, {
                module: 'settings',
                trigger: 'selection'
            });
        });
    }

    function setLanguage(language) {
        if (!allowedLanguages.has(language)) return;
        localStorage.setItem(SETTINGS_KEYS.language, language);
        dispatchSettingsChanged();
    }

    function setCurrency(currency) {
        if (!allowedCurrencies.has(currency)) return;
        localStorage.setItem(SETTINGS_KEYS.currency, currency);
        dispatchSettingsChanged();
    }

    function ensureSettingsModal() {
        if (document.getElementById('settingsModal')) return;
        const modal = document.createElement('div');
        modal.id = 'settingsModal';
        modal.className = 'hidden fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]';
        modal.innerHTML = `
            <div class="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                <div class="flex justify-between items-center border-b border-slate-700 pb-3">
                    <h3 class="font-bold text-slate-100 flex items-center gap-2"><i class="fa-solid fa-gear text-emerald-400"></i> <span data-i18n="settingsTitle">Configuración</span></h3>
                    <button type="button" onclick="closeSettingsModal()" class="text-slate-400 hover:text-white p-1" aria-label="Cerrar configuración"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="space-y-3">
                    <div>
                        <label for="settingLanguage" class="block text-xs font-semibold text-slate-400 mb-1" data-i18n="label_idioma">Idioma</label>
                        <select id="settingLanguage" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
                            <option value="es">Español</option>
                            <option value="en">English</option>
                            <option value="fr">Français</option>
                        </select>
                    </div>
                    <div>
                        <label for="settingCurrency" class="block text-xs font-semibold text-slate-400 mb-1" data-i18n="label_moneda">Moneda</label>
                        <select id="settingCurrency" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
                            <option value="$">Dólar ($)</option>
                            <option value="€">Euro (€)</option>
                            <option value="Q">Quetzal (Q)</option>
                            <option value="£">Libra (£)</option>
                        </select>
                    </div>
                </div>
                <button type="button" onclick="closeSettingsModal()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-lg" data-i18n="settingsApply">Aceptar y cerrar</button>
            </div>`;
        document.body.appendChild(modal);
    }

    window.getFinancesSettings = getSettings;
    window.getFinancesDictionary = () => currentDictionary;
    window.applyFinancesLanguage = applyLanguage;
    window.openSettingsModal = function () {
        ensureSettingsModal();
        applySettingsControls();
        document.getElementById('settingsModal')?.classList.remove('hidden');
    };
    window.closeSettingsModal = function () {
        document.getElementById('settingsModal')?.classList.add('hidden');
    };
    window.changeLanguage = setLanguage;
    window.changeCurrency = setCurrency;

    document.addEventListener('change', event => {
        const target = event.target;
        if (!target || !target.id) return;
        if (languageSelectIds.has(target.id)) {
            setLanguage(target.value);
        } else if (currencySelectIds.has(target.id)) {
            setCurrency(target.value);
        }
    });

    window.addEventListener('storage', event => {
        if (event.key === SETTINGS_KEYS.language || event.key === SETTINGS_KEYS.currency) {
            const settings = getSettings();
            window.currencySymbol = settings.currency;
            if (event.key === SETTINGS_KEYS.language) {
                applyLanguage(settings.language).catch(error => {
                    window.financesLogger.error('language_apply_failed', error, {
                        module: 'settings',
                        trigger: 'storage_event'
                    });
                });
            }
            window.dispatchEvent(new CustomEvent('finances-settings-changed', {
                detail: settings
            }));
            const languageSelect = document.getElementById('selectorIdioma')
                || document.getElementById('settingLanguage')
                || document.getElementById('langSelect');
            const currencySelect = document.getElementById('selectorMoneda')
                || document.getElementById('settingCurrency')
                || document.getElementById('currencySelect');
            if (languageSelect) languageSelect.value = settings.language;
            if (currencySelect) currencySelect.value = settings.currency;
        }
    });

    function initializeGlobalSettings() {
        ensureSettingsModal();
        applySettingsControls();
        window.dispatchEvent(new CustomEvent('finances-settings-changed', {
            detail: getSettings()
        }));
        translationObserver = new MutationObserver(records => {
            records.forEach(record => record.addedNodes.forEach(node => {
                if (!currentDictionary) return;
                const root = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
                if (root) translateElements(root, currentDictionary);
            }));
        });
        translationObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeGlobalSettings, { once: true });
    } else {
        initializeGlobalSettings();
    }
}());

function suggestionBox() {
    if (document.getElementById('suggestionBox')) return;

    const modal = document.createElement('div');
    modal.id = 'suggestionBox';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]';
    modal.innerHTML = `
        <section class="settings-card bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-5 md:p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg relative">
            <button onclick="document.getElementById('suggestionBox').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <h2 class="text-md md:text-lg font-bold mb-4 flex items-center gap-2">
                <i class="fa-solid fa-paper-plane text-emerald-400"></i>
                <span data-i18n="label_feedback">Enviar comentarios</span>
            </h2>
            <form id="feedbackForm" onsubmit="event.preventDefault(); alert('Enviado (aquí va tu lógica de Firebase)'); document.getElementById('suggestionBox').remove();">
                <label for="feedbackText" class="sr-only" data-i18n="label_feedback_input">Tu sugerencia</label>
                <textarea id="feedbackText" required maxlength="2000" data-i18n-placeholder="ph_feedback" placeholder="¿Tienes alguna idea?" class="settings-control w-full border border-slate-300 dark:border-slate-700 bg-transparent p-4 rounded-xl h-28 md:h-32 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"></textarea>
                <p class="text-xs text-slate-400 mt-2" data-i18n="feedback_note">La sugerencia se guardará en tu perfil de Firebase.</p>
                <div id="feedbackStatus" class="hidden mt-3 rounded-lg p-3 text-sm" role="status" aria-live="polite"></div>
                <div class="flex justify-end gap-2 mt-4">
                    <button type="button" onclick="document.getElementById('suggestionBox').remove()" class="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancelar</button>
                    <button id="feedbackSubmit" type="submit" class="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/10">
                        <i class="fa-solid fa-paper-plane mr-2"></i><span data-i18n="btn_feedback">Enviar sugerencia</span>
                    </button>
                </div>
            </form>
        </section>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
        if (event.target === modal) modal.remove();
    });
}
