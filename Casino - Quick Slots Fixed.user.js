// ==UserScript==
// @name         Casino - Quick Slots (Fixed)
// @namespace    https://www.github.com/TravisTheTechie
// @version      1.2
// @description  Original by Travis Smith. Fixed to not long spin when spam clicking.
// @author       Travis Smith + Titanic_
// @match        https://www.torn.com/page.php?sid=slots
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    $.ajaxSetup({
        dataFilter: ajaxFilter
    });

    function ajaxFilter(data) {
        if (!data) return data;

        try {
            const obj = JSON.parse(data);

            if (obj?.barrelsAnimationSpeed) {
                obj.barrelsAnimationSpeed = Math.max(
                    75,
                    Math.floor(obj.barrelsAnimationSpeed / 10)
                );

                return JSON.stringify(obj);
            }
        } catch (e) {}

        return data;
    }
})();