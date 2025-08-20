// ==UserScript==
// @name         Torn.gg
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Dark mode toggle
// @author       You
// @license      MIT
// @match        https://torn.gg/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const themeKey = 'tornGGTheme';

    const style = document.createElement('style');
    style.textContent = `
       .dark .bg-red-50 { background-color: transparent }
       .dark .text-red-800 { color: #ea1b00 }
       .dark .bg-green-50 { background-color: transparent }
       .dark .text-gray-600 { color: #a0a0a0 }
       .dark .text-gray-700 { color: #a0a0a0 }
       .dark .text-gray-900 { color: white }
       .dark .bg-gray-50 { background-color: transparent }
       .dark .bg-white { background-color: var(--primary-foreground) }

       #theme-toggle-button {
           display: flex; position: fixed;
           bottom: 20px; right: 20px;
           width: 50px; height: 50px;
           border: 1px solid #555; border-radius: 50%;
           background-color: #333;
           font-size: larger;
           cursor: pointer;
           align-items: center; justify-content: center;
           transition: background-color 0.2s, transform 0.2s;
       }
       #theme-toggle-button:hover {
           background-color: #444;
           transform: scale(1.1);
       }
    `;
    document.documentElement.append(style);

    const updateButton = (btn) => {
        const isDark = document.documentElement.classList.contains('dark');
        btn.textContent = isDark ? '☀️' : '🌙';
        btn.title = `Switch to ${isDark ? 'Light' : 'Dark'} Mode`;
    };

    const currentTheme = localStorage.getItem(themeKey) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', currentTheme === 'dark');

    window.addEventListener('DOMContentLoaded', () => {
        const toggleButton = document.body.appendChild(document.createElement('button'));
        toggleButton.id = 'theme-toggle-button';
        updateButton(toggleButton);

        toggleButton.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            localStorage.setItem(themeKey, document.documentElement.classList.contains('dark') ? 'dark' : 'light');
            updateButton(toggleButton);
        });
    });
})();
