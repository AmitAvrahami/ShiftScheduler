/**
 * @fileoverview LanguageSelector component.
 *
 * A clean dropdown that lets the user switch between supported languages.
 * It consumes the `useLanguage()` hook and delegates all state management
 * to the LanguageProvider.
 *
 * @example
 * <LanguageSelector />
 */

import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { LANGUAGE_LABELS, type LanguageCode } from './translations';

/** Flag emoji per language code */
const LANGUAGE_FLAGS: Record<LanguageCode, string> = {
    en: '🇺🇸',
    he: '🇮🇱',
};

/**
 * Renders a compact language-switcher button with a dropdown menu.
 * Clicking the globe icon opens the menu; clicking outside or selecting
 * a language closes it.
 */
export function LanguageSelector() {
    const { language, setLanguage, availableLanguages, t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    /** Close dropdown when clicking outside */
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    /**
     * Handles language selection from the dropdown.
     * @param lang - The chosen language code
     */
    const handleSelectLanguage = (lang: LanguageCode) => {
        setLanguage(lang);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative" id="language-selector">
            <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all duration-150 select-none"
                aria-label={t('language.select')}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                id="language-selector-button"
            >
                <Globe className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{LANGUAGE_FLAGS[language]}</span>
                <span className="hidden sm:inline text-xs">{LANGUAGE_LABELS[language]}</span>
            </button>

            {isOpen && (
                <div
                    className="absolute z-50 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                    style={{ [language === 'he' ? 'left' : 'right']: 0 }}
                    role="listbox"
                    aria-label={t('language.select')}
                >
                    {availableLanguages.map((lang) => (
                        <button
                            key={lang}
                            role="option"
                            aria-selected={lang === language}
                            onClick={() => handleSelectLanguage(lang)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${lang === language
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            id={`language-option-${lang}`}
                        >
                            <span>{LANGUAGE_FLAGS[lang]}</span>
                            <span>{LANGUAGE_LABELS[lang]}</span>
                            {lang === language && (
                                <span className="ms-auto w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
