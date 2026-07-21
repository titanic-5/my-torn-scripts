// ==UserScript==
// @name         Attack Log Highlighter
// @namespace    titanic-5.uk
// @version      1.5
// @description  Highlight special events in attack logs
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/page.php?sid=attackLog*
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
        'attacking-events-leave',
    ];

    const critClasses = [
        'attacking-events-powerful',
        'attacking-events-critical-hit',
    ];

    function processElements(elements) {
        elements.forEach(element => {
            if (element.dataset.highlighted) return;
            element.dataset.highlighted = 'true';

            const classList = Array.from(element.classList);
            const attackingClass = classList.find(cls => cls.startsWith('attacking-events-'));

            if (!attackingClass || ignoreClasses.includes(attackingClass)) {
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
            box.style.fontWeight = 'bold';
            box.style.padding = '2px 6px';
            box.style.borderRadius = '4px';
            box.style.marginRight = '6px';
            box.style.verticalAlign = 'middle';
            box.style.whiteSpace = 'nowrap';

            const iconWrap = element.closest("[class*='iconWrap']") || element.parentNode;
            if (iconWrap && iconWrap.parentNode) {
                iconWrap.parentNode.insertBefore(box, iconWrap.nextSibling);
            } else {
                element.parentNode.insertBefore(box, element.nextSibling);
            }
        });
    }

    function scanAndProcess() {
        const elements = document.querySelectorAll("span[class*='attacking-events-']");
        processElements(elements);
    }

    scanAndProcess();

    const observer = new MutationObserver(mutations => {
        let shouldScan = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldScan = true;
                break;
            }
        }
        if (shouldScan) {
            scanAndProcess();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();