// ==UserScript==
// @name         Astral Guard Warning
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  If Astral Guard effect is active, shows warning (minion/maol invulnerability)
// @author       Titanic_
// @match        https://www.torn.com/loader.php?sid=attack*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const warningElementId = 'astral-guard-invulnerable-warning';

    function checkAstralGuard() {
        const astralGuardIcon = document.querySelector('.player___wiE8R:nth-of-type(2) img[alt="effect icon astral_guard"]');

        let warningElement = document.getElementById(warningElementId);

        if (astralGuardIcon) {
            if (!warningElement) {
                warningElement = document.createElement('div');
                warningElement.id = warningElementId;
                warningElement.textContent = "Don't Attack Yet, Invulnerable";

                Object.assign(warningElement.style, {
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
                    pointerEvents: 'none'
                });

                document.body.appendChild(warningElement);
            }
        }
        else if (warningElement) warningElement.remove();
    }

    setInterval(checkAstralGuard, 100);
    console.log("Astral guard checker script is active");
})();
