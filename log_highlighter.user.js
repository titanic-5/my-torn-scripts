// ==UserScript==
// @name         Attack Log Highlighter
// @namespace    Titanic_
// @version      1.1
// @description  Try to highlight special events in attack logs
// @author       Titanic_
// @match        https://www.torn.com/loader.php?sid=attackLog*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const ignoreClasses = [
        'attacking-events-grenade-use',
        'attacking-events-assault',
        'attacking-events-miss',
        'attacking-events-attack-join',
        'attacking-events-reloading',
        'attacking-events-standart-damage',
        'attacking-events-attack-win',
        'attacking-events-leave'
    ];

    const critClasses = [
        'attacking-events-powerful',
        'attacking-events-critical-hit',
    ];

    const elements = document.querySelectorAll("ul.log-list.overview span[class*='attacking-events-']");
    elements.forEach(element => {
        const classList = Array.from(element.classList);
        const attackingClass = classList.find(cls => cls.startsWith('attacking-events-'));

        if (attackingClass) {
            if (ignoreClasses.includes(attackingClass)) {
                return;
            }

            const box = document.createElement('span');

            if (critClasses.includes(attackingClass)) {
                box.style.backgroundColor = 'red';
                box.textContent = 'crit';
            } else {
                const className = attackingClass.replace('attacking-events-', '');
                box.style.backgroundColor = '#20a5e2';
                box.textContent = className;
            }

            box.style.display = 'inline-block';
            box.style.color = 'white';
            box.style.fontSize = '10px';
            box.style.padding = '5px';
            box.style.borderRadius = '5px';
            box.style.marginLeft = '5px';
            box.style.verticalAlign = 'middle';
            box.style.whiteSpace = 'nowrap';

            element.parentNode.insertBefore(box, element.nextSibling);

            const message = element.parentNode.querySelector(".message");
            if(message) {
                let width = parseFloat(window.getComputedStyle(message).width) - (box.offsetWidth + 5)
                message.style.width = width + "px";
            }

        }
    });
})();
