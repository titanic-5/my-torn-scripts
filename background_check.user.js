// ==UserScript==
// @name         Torn Profile Quick Lookup & Fed Record
// @namespace    torndown.eu
// @version      3.3.1
// @description  Adds Quick Lookup and Discord buttons to Torn user profiles with integrated Federal Jail records.
// @author       Omanpx + Gemini
// @match        https://www.torn.com/profiles.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      api.torn.com
// @connect      api.torndown.eu
// @license      MIT
// ==/UserScript==

// Original script made by Omanpx (+ Gemini) with some changes by me 
// - removed sweetalert2 dependency (should get it working on pda)
// - button styling for [quick lookup] and [discord]
// - local caching for api calls (profile 15min, stats/fed 24h, hof 7d)
// - auto-open if cache exists
// - modal removal and reactive layout (for mobile)

(function () {
    'use strict';

    const STAT_PERIOD_DAYS = 30;
    let autoOpened = false, autoOpenTimer = null;

    function formatTimePlayed(sec) {
        const t = parseInt(sec, 10);
        if (isNaN(t)) return 'N/A';
        const pad = (n) => String(n).padStart(2, '0');
        return `${Math.floor(t / 86400)}d ${pad(Math.floor((t % 86400) / 3600))}h ${pad(Math.floor((t % 3600) / 60))}m ${pad(t % 60)}s`;
    }

    const getUserIdFromUrl = () => {
        const p = new URLSearchParams(window.location.search);
        return p.get('XID') || p.get('NID') || (window.location.href.match(/[XN]ID=(\d+)/i) || [])[1];
    };

    function getFedExpiry() {
        const d = new Date(), now = Date.now();
        if (d.getUTCHours() >= 16) d.setUTCDate(d.getUTCDate() + 1);
        d.setUTCHours(16, 0, 0, 0);
        return Math.min(now + 864e5, d.getTime());
    }

    const getCache = (uid, key) => {
        try {
            const entry = JSON.parse(GM_getValue(`ql_cache_${uid}`, '{}'))[key];
            return entry?.expires > Date.now() ? entry.data : null;
        } catch { return null; }
    };

    const setCache = (uid, key, data, expires) => {
        try {
            const store = JSON.parse(GM_getValue(`ql_cache_${uid}`, '{}'));
            store[key] = { data, expires };
            GM_setValue(`ql_cache_${uid}`, JSON.stringify(store));
        } catch {}
    };

    const fetchJson = (url) => new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET', url, headers: { Accept: 'application/json' },
            onload: (res) => {
                try { resolve(JSON.parse(res.responseText)); }
                catch { reject(new Error('Invalid JSON response')); }
            },
            onerror: reject
        });
    });

    async function fetchWithCache(uid, key, url, ttl, forceRefresh) {
        if (!forceRefresh) {
            const cached = getCache(uid, key);
            if (cached) return cached;
        }
        const data = await fetchJson(url);
        if (data?.error) throw new Error(data.error.error || data.error);

        setCache(uid, key, data, key === 'fed' ? getFedExpiry() : Date.now() + ttl);
        return data;
    }

    function smoothScrollToPanel(panel) {
        setTimeout(() => {
            const y = panel.getBoundingClientRect().top + window.pageYOffset - 20;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }, 50);
    }

    function getOrCreatePanel() {
        let panel = document.getElementById('torn-quick-lookup-panel');
        if (panel) return panel;

        const mainWrapper = document.querySelector('#profileroot div.profile-wrapper');
        if (!mainWrapper) return null;

        const dark = document.body.classList.contains('dark-mode');
        panel = document.createElement('div');
        panel.className = 'profile-wrapper m-top10';
        panel.id = 'torn-quick-lookup-panel';
        panel.style.cssText = 'display:none; opacity:0; transition:opacity 0.25s ease;';

        panel.innerHTML = `
            <style>
                #torn-quick-lookup-panel {
                    --ql-hdr: ${dark ? '#2a2a2a' : '#e6e6e6'}; --ql-row1: ${dark ? '#1e1e1e' : '#ffffff'};
                    --ql-row2: ${dark ? '#252525' : '#f8f8f8'}; --ql-border: ${dark ? '#383838' : '#dcdcdc'};
                    --ql-val: ${dark ? '#ffffff' : '#111111'}; --ql-lbl: ${dark ? '#999999' : '#666666'};
                    --ql-head: ${dark ? '#e0e0e0' : '#222222'};
                }
                #torn-quick-lookup-panel .ql-top-row { display: flex; gap: 10px; margin-bottom: 6px; }
                #torn-quick-lookup-panel .ql-col { flex: 1; min-width: 0; }
                #torn-quick-lookup-panel .ql-sec {
                    font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: .5px;
                    padding: 5px 8px; background: var(--ql-hdr); color: var(--ql-head);
                    border: 1px solid var(--ql-border); border-bottom: none; margin-top: 6px;
                }
                #torn-quick-lookup-panel .ql-sec:first-child { margin-top: 0; }
                #torn-quick-lookup-panel .ql-tbl { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 6px; border: 1px solid var(--ql-border); }
                #torn-quick-lookup-panel th { padding: 5px 6px; font-size: 10px; text-transform: uppercase; color: var(--ql-lbl); background: var(--ql-hdr); border-bottom: 1px solid var(--ql-border); text-align: left; }
                #torn-quick-lookup-panel td { padding: 5px 6px; border-bottom: 1px solid var(--ql-border); color: var(--ql-val); }
                #torn-quick-lookup-panel .ql-tbl tr:nth-child(odd) td { background: var(--ql-row1); }
                #torn-quick-lookup-panel .ql-tbl tr:nth-child(even) td { background: var(--ql-row2); }
                #torn-quick-lookup-panel tr:hover td { filter: brightness(1.08); }
                #torn-quick-lookup-panel .k { width: 38%; color: var(--ql-lbl); font-weight: 600; }
                #torn-quick-lookup-panel .v { color: var(--ql-val); font-weight: bold; }
                #torn-quick-lookup-panel .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
                #torn-quick-lookup-panel .dim { opacity: 0.6; font-weight: normal; }
                @media (max-width: 768px) {
                    #torn-quick-lookup-panel .ql-top-row { flex-direction: column; gap: 4px; }
                    #torn-quick-lookup-panel th, #torn-quick-lookup-panel td { padding: 4px 5px; font-size: 11px; }
                    .combined-lookup-group a { font-size: 10px !important; margin-left: 5px !important; }
                }
            </style>
            <div>
                <div class="title-black top-round" style="display:flex; justify-content:space-between; align-items:center;">
                    <span id="ql-panel-title">Quick Lookup</span>
                    <span style="margin-right:8px;">
                        <a href="javascript:void(0);" id="ql-key-btn" style="color:#aaa; font-size:11px; margin-right:8px; text-decoration:none;">[api key]</a>
                        <a href="javascript:void(0);" id="ql-close-btn" style="color:#aaa; font-size:11px; text-decoration:none;">[hide]</a>
                    </span>
                </div>
                <div class="cont bottom-round cont-gray" id="ql-panel-content" style="padding:8px 10px;"></div>
            </div>
        `;

        mainWrapper.insertAdjacentElement('afterend', panel);
        panel.querySelector('#ql-close-btn').onclick = () => {
            panel.style.opacity = '0';
            setTimeout(() => { panel.style.display = 'none'; }, 250);
        };
        panel.querySelector('#ql-key-btn').onclick = () => renderApiKeyManager(panel);
        return panel;
    }

    function renderApiKeyManager(panel) {
        const content = panel.querySelector('#ql-panel-content');
        const currentKey = GM_getValue('torn_api_key', '');

        content.innerHTML = `
            <div style="padding:6px; font-size:12px;">
                <b>API Key Management</b>
                <div style="margin:4px 0 8px; color:#888;">Update or remove stored API key:</div>
                <input type="password" id="ql-manage-key" value="${currentKey}" placeholder="API Key..." style="padding:4px 8px; font-size:12px; border:1px solid #555; background:#111; color:#fff; border-radius:3px; width:220px;" />
                <div style="margin-top:10px;">
                    <button id="ql-m-save" style="padding:4px 12px; background:green; color:#fff; border:1px solid #2e7d32; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold;">Save</button>
                    <button id="ql-m-del" style="margin-left:6px; padding:4px 12px; background:#8a281e; color:#fff; border:1px solid #6b1f17; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold;">Delete Key</button>
                    <button id="ql-m-back" style="margin-left:6px; padding:4px 10px; background:#444; color:#ccc; border:1px solid #555; border-radius:3px; cursor:pointer; font-size:11px;">Back</button>
                </div>
            </div>
        `;

        content.querySelector('#ql-m-save').onclick = () => {
            const val = content.querySelector('#ql-manage-key').value.trim();
            if (val) { GM_setValue('torn_api_key', val); handleQuickLookup(true, true, false); }
        };
        content.querySelector('#ql-m-del').onclick = () => {
            if (confirm('Delete stored API key?')) {
                GM_setValue('torn_api_key', '');
                content.innerHTML = '<div style="padding:6px; font-size:12px; color:#888;">API key deleted.</div>';
            }
        };
        content.querySelector('#ql-m-back').onclick = () => handleQuickLookup(true, false, false);
    }

    function checkAutoOpen() {
        if (autoOpened || !document.querySelector('#profileroot div.profile-wrapper')) return;
        const uid = getUserIdFromUrl(), key = GM_getValue('torn_api_key', '');
        if (!uid || !key) return;

        if (['profile', 'historical', 'hof', 'fed'].every(k => getCache(uid, k))) {
            autoOpened = true;
            handleQuickLookup(true, false, false);
        }
    }

    async function handleQuickLookup(forceOpen = false, forceRefresh = false, shouldScroll = true) {
        const panel = getOrCreatePanel();
        if (!panel) return;
        const content = panel.querySelector('#ql-panel-content');

        if (panel.style.display === 'block' && !forceRefresh) {
            if (shouldScroll) smoothScrollToPanel(panel);
            return;
        }

        const uid = getUserIdFromUrl();
        if (!uid) return alert('Could not determine User ID.');

        const key = GM_getValue('torn_api_key', '');
        panel.style.display = 'block';
        requestAnimationFrame(() => { panel.style.opacity = '1'; });
        if (shouldScroll) smoothScrollToPanel(panel);

        if (!key) {
            content.innerHTML = `
                <div style="padding:6px; font-size:12px;">
                    <b>API Key Required:</b> <span style="color:#888; margin-left:6px;">Enter Public access key:</span>
                    <div style="margin-top:8px;">
                        <input type="password" id="ql-k-in" placeholder="API Key..." style="padding:4px 8px; font-size:12px; border:1px solid #555; background:#111; color:#fff; border-radius:3px; width:200px;" />
                        <button id="ql-k-btn" style="margin-left:6px; padding:4px 12px; background:green; color:#fff; border:1px solid #2e7d32; border-radius:3px; cursor:pointer; font-size:11px;">Save</button>
                    </div>
                </div>
            `;
            content.querySelector('#ql-k-btn').onclick = () => {
                const val = content.querySelector('#ql-k-in').value.trim();
                if (val) { GM_setValue('torn_api_key', val); handleQuickLookup(true, true, true); }
            };
            return;
        }

        content.innerHTML = '<div style="padding:8px; font-size:12px; color:#888;">Loading profile, HOF & Federal Jail records...</div>';

        const ts = Math.floor(Date.now() / 1000) - (86400 * STAT_PERIOD_DAYS);
        const torn = (path, q = '') => `https://api.torn.com/${path}?key=${key}${q}`;

        try {
            const [u1, u2, hof, fed] = await Promise.all([
                fetchWithCache(uid, 'profile', torn(`user/${uid}`, '&selections=profile,personalstats'), 15 * 60 * 1000, forceRefresh),
                fetchWithCache(uid, 'historical', torn(`user/${uid}`, `&selections=personalstats&stat=xantaken,useractivity,refills,attackswon,alcoholused,energydrinkused,rankedwarhits,attacksassisted,statenhancersused,boostersused&timestamp=${ts}`), 864e5, forceRefresh),
                fetchWithCache(uid, 'hof', torn(`v2/user/${uid}/hof`), 7 * 864e5, forceRefresh),
                fetchWithCache(uid, 'fed', `https://api.torndown.eu/fed/${uid}?key=${encodeURIComponent(key)}`, 864e5, forceRefresh).catch(() => ({}))
            ]);

            panel.querySelector('#ql-panel-title').innerText = `${u1.name}`;
            renderPanelContent(content, u1, u2, hof, fed, uid);
        } catch (err) {
            content.innerHTML = `<div style="padding:8px; font-size:12px; color:#888;">Error: ${err.message || 'Failed to fetch data.'}</div>`;
        }
    }

    function renderPanelContent(content, u1, u2, hof, fed, uid) {
        const p = u1.personalstats || {}, h = u2.personalstats || {};
        const diff = (k) => (p[k] || 0) - (h[k] || 0);

        const dailyXan = diff('xantaken') / STAT_PERIOD_DAYS;
        const dailyRefills = diff('refills') / STAT_PERIOD_DAYS;
        const extraEnergy = (dailyXan * 250) + (dailyRefills * 150);

        const genDefs = [
            ['Name', `${u1.name} [${uid}]`],
            ['Level', u1.level],
            ['Property', u1.property],
            ['Donator', u1.donator ? 'Yes' : 'No'],
            ['Age', `${(u1.age || 0).toLocaleString()} days`],
            ['Friends / Enemies', `${u1.friends} / ${u1.enemies}`],
            ['Posts / Karma', `${(u1.forum_posts || 0).toLocaleString()} / ${(u1.karma || 0).toLocaleString()}`],
            ['Extra daily E', Math.round(extraEnergy).toLocaleString()],
            ['Working Stats', (hof.hof?.working_stats?.value || 0).toLocaleString()]
        ];
        const generalRows = genDefs.map(([l, v]) => `<tr><td class="k">${l}</td><td class="v">${v}</td></tr>`).join('');

        let fedRows = '';
        if (fed?.detail || fed?.error) {
            fedRows = `<tr><td colspan="2" style="color:#ff8888; font-style:italic;">${fed.detail || fed.error}</td></tr>`;
        } else if (!fed?.Date) {
            fedRows = '<tr><td colspan="2" style="color:var(--ql-lbl); font-style:italic;">No jail record on file.</td></tr>';
        } else {
            const fedDefs = [
                ['Date', fed.Date],
                ['Description', fed.Description],
                ['Details', fed.Details],
                ['Faction', `${fed.Faction || 'N/A'} (FID: ${fed.FID || 'N/A'})`],
                ['Level', fed.Level],
                ['BBS', fed.BBS],
                ['Played', fed.Played ? formatTimePlayed(fed.Played) : 'N/A'],
                ['Networth', fed.Networth ? parseInt(fed.Networth, 10).toLocaleString() : 'N/A'],
                ['Stats', fed.Stats ? parseInt(fed.Stats, 10).toLocaleString() : 'N/A']
            ];
            fedRows = fedDefs.map(([l, v]) => `<tr><td class="k">${l}</td><td class="v" style="word-break:break-word;">${v !== undefined && v !== null && v !== '' ? v : 'N/A'}</td></tr>`).join('');
        }

        const statDefs = [
            ['Xanax Taken', 'xantaken', 1],
            ['Energy Refills', 'refills', 1],
            ['E-cans Used', 'energydrinkused', 1],
            ['Boosters Used', 'boostersused', 1],
            ['SEs Used', 'statenhancersused', 1],
            ['Activity (hours)', 'useractivity', 3600],
            ['Attacks Won', 'attackswon', 1],
            ['Attacks Assisted', 'attacksassisted', 1],
            ['Ranked War Hits', 'rankedwarhits', 1],
            ['Alcohol Used', 'alcoholused', 1]
        ];

        const statRows = statDefs.map(([name, k, div]) => {
            const cur = (p[k] || 0) / div, delta = diff(k) / div;
            const fmt = (n) => div === 1 ? Math.round(n).toLocaleString() : n.toFixed(2);
            return `<tr><td>${name}</td><td class="num" style="font-weight:bold;">${fmt(delta)}</td><td class="num">${(delta / STAT_PERIOD_DAYS).toFixed(2)}</td><td class="num dim">${fmt(cur)}</td></tr>`;
        }).join('');

        content.innerHTML = `
            <div class="ql-top-row">
                <div class="ql-col">
                    <div class="ql-sec">General Info</div>
                    <table class="ql-tbl">${generalRows}</table>
                </div>
                <div class="ql-col">
                    <div class="ql-sec">Federal Jail Record</div>
                    <table class="ql-tbl">${fedRows}</table>
                </div>
            </div>
            <div class="ql-sec">Stats (Last ${STAT_PERIOD_DAYS} Days)</div>
            <table class="ql-tbl">
                <thead><tr><th>Stat</th><th class="num">30d</th><th class="num">Daily Avg</th><th class="num dim">Lifetime</th></tr></thead>
                <tbody>${statRows}</tbody>
            </table>
        `;
    }

    async function handleDiscordLookup() {
        const uid = getUserIdFromUrl();
        if (!uid) return alert('Could not determine User ID.');
        const key = GM_getValue('torn_api_key', '');
        if (!key) return handleQuickLookup(true, false, true);

        try {
            const user = await fetchJson(`https://api.torn.com/user/${uid}?selections=discord&key=${key}`);
            if (user.error) throw new Error(user.error.error || user.error);
            if (user.discord?.discordID) window.open(`https://discord.com/users/${user.discord.discordID}`, '_blank');
            else alert('This user has not linked their Discord account.');
        } catch (err) { alert(`Error: ${err.message}`); }
    }

    function createHeaderLink(text, onClick, color = '#aaa') {
        const a = document.createElement('a');
        a.href = 'javascript:void(0);';
        a.innerText = `[${text}]`;
        a.onclick = (e) => { e.preventDefault(); onClick(e); };
        a.style.cssText = `color:${color}; font-size:11px; margin-left:8px; text-decoration:none; cursor:pointer; transition:filter 0.15s ease;`;
        a.onmouseenter = () => { a.style.filter = 'brightness(1.35)'; };
        a.onmouseleave = () => { a.style.filter = 'none'; };
        return a;
    }

    function initButtons() {
        const header = document.querySelector('#profileroot div.profile-left-wrapper.left div.title-black.top-round');
        if (header && !header.querySelector('.combined-lookup-group')) {
            const container = document.createElement('span');
            container.className = 'combined-lookup-group';
            container.style.cssText = 'display:inline-block; float:right; margin-right:10px;';
            container.append(
                createHeaderLink('quick lookup', () => handleQuickLookup(false, false, true), '#4CAF50'),
                createHeaderLink('discord', handleDiscordLookup, '#5865F2')
            );
            header.appendChild(container);
        }

        if (!autoOpened) {
            clearTimeout(autoOpenTimer);
            autoOpenTimer = setTimeout(checkAutoOpen, 500);
        }
    }

    new MutationObserver(initButtons).observe(document.body, { childList: true, subtree: true });
    initButtons();
})();
