// ==UserScript==
// @name         Attack Log Highlighter
// @namespace    Titanic_
// @version      1.3
// @description  Highlight special events in attack logs
// @author       Titanic_
// @match        https://www.torn.com/loader.php?sid=attackLog*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/log_highlighter.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/log_highlighter.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const ignoreClasses = [
        'attacking-events-grenade-use',
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

    function processElements(elements) {
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
                if (message) {
                    let width = parseFloat(window.getComputedStyle(message).width) - (box.offsetWidth + 5);
                    message.style.width = width + "px";
                }
            }
        });
    }

    const initialElements = document.querySelectorAll("span[class*='attacking-events-']");
    processElements(initialElements);

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(async node => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('jscroll-added')) {
                        await delay(500)
                        const newElements = node.querySelectorAll("span[class*='attacking-events-']");
                        processElements(newElements);
                    }
                });
            }
        });
    });

    const logContainer = document.querySelector(".jscroll-inner");
    if (logContainer) {
        observer.observe(logContainer, { childList: true });
    }
})();
