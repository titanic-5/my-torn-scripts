// ==UserScript==
// @name         Replace Edu Timer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Convert to hours
// @author       Titanic_
// @match        *://*.torn.com/*
// @grant        none
// ==/UserScript==

function convertToHoursMinutesSeconds(timeString) {
    let totalHours = 0, totalMinutes = 0, totalSeconds = 0;

    const regex = /(\d+)\s*(weeks?|months?|days?|hours?|minutes?|seconds?)/gi;
    let match;

    while ((match = regex.exec(timeString)) !== null) {
        const value = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();

        switch (unit) {
            case 'week':
            case 'weeks':
                totalHours += value * 168; // 168 hours
                break;
            case 'month':
            case 'months':
                totalHours += value * 730; // 730 hours
                break;
            case 'day':
            case 'days':
                totalHours += value * 24; // 24 hours
                break;
            case 'hour':
            case 'hours':
                totalHours += value;
                break;
            case 'minute':
            case 'minutes':
                totalMinutes += value;
                break;
            case 'second':
            case 'seconds':
                totalSeconds += value;
                break;
        }
    }

    totalHours += Math.floor(totalMinutes / 60);
    totalMinutes = totalMinutes % 60;

    totalMinutes += Math.floor(totalSeconds / 60);
    totalSeconds = totalSeconds % 60;

    return `${totalHours} hours, ${totalMinutes} minutes, and ${totalSeconds} seconds`;
}

function checkAndUpdateTooltip() {
    const tooltipElement = document.querySelector('div[class*="tooltip_"][class*="tooltipCustomClass_"]');
    if (tooltipElement && tooltipElement.innerHTML.includes('<b>Education</b>')) {
        const timeElement = tooltipElement.querySelectorAll('p')[1];
        if (timeElement) {
            const timeString = timeElement.innerText;
            const convertedTime = convertToHoursMinutesSeconds(timeString);
            let existingConvertedTimeElement = tooltipElement.querySelector('.converted-time');

            if (existingConvertedTimeElement) existingConvertedTimeElement.innerText = `Converted Time: ${convertedTime}`;
            else {
                const newTimeElement = document.createElement('p');
                newTimeElement.classList.add('converted-time');
                newTimeElement.innerText = `Converted Time: ${convertedTime}`;

                tooltipElement.appendChild(newTimeElement);
            }
        }
    }
}

setInterval(checkAndUpdateTooltip, 500);

