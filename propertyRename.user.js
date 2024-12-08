// ==UserScript==
// @name         Torn - Property Name Editor
// @namespace    Titanic
// @version      1.0
// @description  Add a pencil icon to edit nicknames for properties.
// @match        https://www.torn.com/properties.php
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant        none
// ==/UserScript==

function saveNickname(propertyId, nickname) {
    localStorage.setItem(`propertyNickname_${propertyId}`, nickname);
}

function getNickname(propertyId) {
    return localStorage.getItem(`propertyNickname_${propertyId}`);
}

function main() {
    const propertyElements = document.querySelectorAll('.image-description');

    propertyElements.forEach(propertyElement => {
        const nameElement = propertyElement.querySelector('.title');
        const propertyIdElement = propertyElement.previousElementSibling;

        if (nameElement && propertyIdElement && !nameElement.querySelector('.edit-icon')) {
            const propertyId = propertyIdElement.getAttribute('data-id');
            const savedNickname = getNickname(propertyId);

            if (savedNickname) {
                nameElement.textContent = savedNickname;
            }

            const pencilIcon = document.createElement('span');
            pencilIcon.classList.add('edit-icon');
            pencilIcon.style.cursor = 'pointer';
            pencilIcon.style.marginLeft = '5px';
            pencilIcon.title = 'Edit nickname';
            nameElement.appendChild(pencilIcon);

            pencilIcon.addEventListener('click', () => {
                const newNickname = prompt('Enter a nickname for this property:', nameElement.textContent.replace("✏️", ""));
                if (newNickname !== null) {
                    nameElement.textContent = newNickname.replace("✏️", "");
                    saveNickname(propertyId, newNickname);
                    nameElement.appendChild(pencilIcon);
                }
            });
        }
    });
}

waitForKeyElements("p.title", main);

window.addEventListener('popstate', () => {
    main();
});
