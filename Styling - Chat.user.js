// ==UserScript==
// @name         Styling - Chat
// @namespace    http://tampermonkey.net/
// @version      1.2
// @license      MIT
// @description  Get rid of the ugly ass box shadow. Reverted to chat 2.0
// @author       Titanic_
// @match        *://*.torn.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const css = `
        #chatRoot [id*="_button"] { box-shadow: none !important; }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
})();
