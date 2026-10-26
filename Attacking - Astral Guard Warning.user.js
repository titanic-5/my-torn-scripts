// ==UserScript==
// @name         Attacking - Astral Guard Warning
// @namespace    titanic-5.uk
// @version      1.3
// @description  If Astral Guard effect is active, shows warning (minion/maol invulnerability)
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/page.php?sid=attack*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Attacking%20-%20Astral%20Guard%20Warning.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Attacking%20-%20Astral%20Guard%20Warning.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const warningElementId = 'astral-guard-invulnerable-warning';

    function getOrCreateWarning() {
        let warning = document.getElementById(warningElementId);
        if (!warning) {
            warning = document.createElement('div');
            warning.id = warningElementId;
            warning.textContent = "Don't Attack Yet, Invulnerable";

            Object.assign(warning.style, {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                padding: '20px 40px',
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                color: 'red',
                fontSize: '2rem',
                zIndex: '99999',
                border: '3px solid red',
                textAlign: 'center',
                pointerEvents: 'none',
                display: 'none'
            });

            document.body.appendChild(warning);
        }
        return warning;
    }

    function checkAstralGuard() {
        const defender = document.getElementById('defender_Primary')?.closest('[class^="player___"]');
        const hasAstralGuard = defender?.querySelector('img[alt*="astral_guard"]');
        
        const warning = getOrCreateWarning();
        warning.style.display = hasAstralGuard ? 'block' : 'none';
    }

    setInterval(checkAstralGuard, 100);
})();