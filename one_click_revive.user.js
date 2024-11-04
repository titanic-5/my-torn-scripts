// ==UserScript==
// @name         Torn - One Click Revive
// @namespace    Titanic_
// @version      1.0
// @description  title
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/hospitalview.php*
// @grant        none
// ==/UserScript==

function replaceReviveUrl() {
   document.querySelectorAll("a.revive:not(.reviveNotAvailable)").forEach((el) => {
       console.log("Replacing", el)
       let playerid = new URL(el.href).searchParams.get("ID");
       let url = `revive.php?action=revive&step=revive&ID=${playerid}&rfcv=${getRFC()}`;
       el.href = url;
   });
}

function getRFC() {
    var rfc = $.cookie('rfc_v');
    if (!rfc) {
        var cookies = document.cookie.split('; ');
        for (var i in cookies) {
            var cookie = cookies[i].split('=');
            if (cookie[0] == 'rfc_v') {
                return cookie[1];
            }
        }
    }
    return rfc;
}

const observer = new MutationObserver((mutations, obs) => {
	if (document.querySelector('li.last')) {
        console.log("Summoned");
		replaceReviveUrl();
		obs.disconnect();
	}
});

observer.observe(document.body, {
	childList: true,
	subtree: true
});
