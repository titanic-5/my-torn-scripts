// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      2025-02-01
// @description  try to take over the world!
// @author       Titanic
// @match        https://www.torn.com/loader.php?sid=crimes*
// @require      https://jpillora.com/xhook/dist/xhook.min.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    xhook.after(async (req, res) => {
        try {
            if (req.url.includes("?sid=crimesData&step=crimesList")) {
                const data = await res.clone().json();
                processCrimesData(data?.DB);
            }
        } catch (error) {
            console.error("Error:", error, "Req:", req);
        }
    });

    function processCrimesData(db) {
        // example for forgery projects

        if(!db) return
        if(!db.crimesByType) return
        if(!db.crimesByType.projects) return

        console.log( db.crimesByType.projects )
    }
})();
