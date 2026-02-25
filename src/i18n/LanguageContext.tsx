/**
 * @fileoverview Language Context — Strategy Pattern Implementation.
 *
 * This module provides a React Context that acts as the **strategy selector**
 * for the application's i18n system. The active "strategy" is the translation
 * map for the chosen language.
 *
 * ```mermaid
 * graph TD
 *     A[LanguageProvider] --> B{selectedLanguage}
 *     B -->|'en'| C[English TranslationMap]
 *     B -->|'he'| D[Hebrew TranslationMap]
 *     C --> E[t() function]
 *     D --> E
 *     E --> F[Components render translated strings]
 * ```
 *
 * Usage:
 * ```tsx
 * const { t, language, setLanguage, isRTL } = useLanguage();
 * <p>{t('nav.schedule')}</p>
 * ```
 */

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from 'react';
import translations, {
    type LanguageCode,
    LANGUAGE_DIRECTIONS,
    LANGUAGE_LABELS,
    type TranslationMap,
} from './translations';

/** Storage key for persisting language choice across sessions */
const STORAGE_KEY = 'shiftAgent_language';

/** Default language — Hebrew as per product requirements */
const DEFAULT_LANGUAGE: LanguageCode = 'he';

// ─── Context Value Type ───────────────────────────────────────────────────────

interface LanguageContextValue {
    /** Currently active language code */
    language: LanguageCode;
    /** Switch to a different language */
    setLanguage: (lang: LanguageCode) => void;
    /**
     * Translate a key into the active language string.
     * Supports simple interpolation: `t('key', { count: 5 })` replaces `{count}`.
     * Falls back to the key itself if no translation is found.
     *
     * @param key   - Dot-notation translation key (e.g. 'dashboard.title')
     * @param vars  - Optional interpolation variables
     */
    t: (key: string, vars?: Record<string, string | number>) => string;
    /** `true` when the active language is right-to-left */
    isRTL: boolean;
    /** Human-readable label for the current language */
    languageLabel: string;
    /** All available language codes */
    availableLanguages: LanguageCode[];
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface LanguageProviderProps {
    children: ReactNode;
}

/**
 * Wraps the application to provide translation capabilities.
 * Reads persisted language from `localStorage` and applies
 * the correct `dir` and `lang` attributes to `<html>`.
 *
 * @example
 * <LanguageProvider>
 *   <App />
 * </LanguageProvider>
 */
export function LanguageProvider({ children }: LanguageProviderProps) {
    const [language, setLanguageState] = useState<LanguageCode>(() => {
        const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
        return stored && stored in translations ? stored : DEFAULT_LANGUAGE;
    });

    /** Apply direction and language attributes to <html> element */
    useEffect(() => {
        const direction = LANGUAGE_DIRECTIONS[language];
        document.documentElement.setAttribute('dir', direction);
        document.documentElement.setAttribute('lang', language);
        document.documentElement.style.setProperty(
            '--text-align-start',
            direction === 'rtl' ? 'right' : 'left'
        );
    }, [language]);

    /**
     * Updates the active language and persists the choice.
     *
     * @param lang - The new language code to apply
     */
    const setLanguage = useCallback((lang: LanguageCode) => {
        setLanguageState(lang);
        localStorage.setItem(STORAGE_KEY, lang);
    }, []);

    /**
     * The core translation function — the "strategy executor".
     * Looks up a key in the active language's translation map and
     * interpolates any provided variables.
     *
     * Time complexity: O(1) for lookup, O(n) for variable interpolation
     * where n = number of interpolation variables.
     *
     * @param key  - Translation key
     * @param vars - Optional interpolation object
     * @returns Translated string or the key itself as fallback
     */
    const t = useCallback(
        (key: string, vars?: Record<string, string | number>): string => {
            const activeMap: TranslationMap = translations[language];
            let result = activeMap[key] ?? key;

            if (vars) {
                // Replace {placeholder} occurrences with actual values
                Object.entries(vars).forEach(([placeholder, value]) => {
                    result = result.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(value));
                });
            }

            return result;
        },
        [language]
    );

    const contextValue: LanguageContextValue = {
        language,
        setLanguage,
        t,
        isRTL: LANGUAGE_DIRECTIONS[language] === 'rtl',
        languageLabel: LANGUAGE_LABELS[language],
        availableLanguages: Object.keys(translations) as LanguageCode[],
    };

    return (
        <LanguageContext.Provider value={contextValue}>
            {children}
        </LanguageContext.Provider>
    );
}

// ─── Consumer Hook ────────────────────────────────────────────────────────────

/**
 * Hook to consume the language context inside any component.
 *
 * @throws Error if used outside of `<LanguageProvider>`
 *
 * @example
 * const { t, language, setLanguage, isRTL } = useLanguage();
 */
export function useLanguage(): LanguageContextValue {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
