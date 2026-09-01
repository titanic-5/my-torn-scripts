// ==UserScript==
// @name         Mini Calendar
// @namespace    Titanic_
// @version      1.0
// @description  Adds a mini calendar to the header
// @author       Titanic_ [2968477]
// @match        https://www.torn.com/*
// @downloadURL  https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Mini%20Calendar.user.js
// @updateURL    https://github.com/titanic-5/my-torn-scripts/raw/refs/heads/main/Mini%20Calendar.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.torn.com
// ==/UserScript==

(function () {
    'use strict';

    const CACHE_KEY = 'calendar_cache';
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
    let API_KEY = GM_getValue('calendar_api_key', '');
    let isEditingApi = false;

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    function detectDarkMode() {
        return document.body.classList.contains('dark-mode') ||
            document.body.classList.contains('dark') ||
            document.documentElement.classList.contains('dark-mode') ||
            document.documentElement.classList.contains('dark') ||
            document.querySelector('.d') !== null;
    }

    let isDarkMode = detectDarkMode();

    const THEMES = {
        amber: { border: 'rgba(250,176,5,0.4)', pill: 'rgba(250,176,5,0.25)', mid: 'rgba(250,176,5,0.3)', hi: 'rgba(250,176,5,0.18)', lo: 'rgba(250,176,5,0.07)' },
        orange: { border: 'rgba(253,126,20,0.4)', pill: 'rgba(253,126,20,0.25)', mid: 'rgba(253,126,20,0.3)', hi: 'rgba(253,126,20,0.18)', lo: 'rgba(253,126,20,0.07)' },
        red: { border: 'rgba(250,82,82,0.4)', pill: 'rgba(250,82,82,0.25)', mid: 'rgba(250,82,82,0.3)', hi: 'rgba(250,82,82,0.18)', lo: 'rgba(250,82,82,0.07)' },
        pink: { border: 'rgba(230,73,128,0.4)', pill: 'rgba(230,73,128,0.25)', mid: 'rgba(230,73,128,0.3)', hi: 'rgba(230,73,128,0.18)', lo: 'rgba(230,73,128,0.07)' },
        green: { border: 'rgba(64,192,87,0.4)', pill: 'rgba(64,192,87,0.25)', mid: 'rgba(64,192,87,0.3)', hi: 'rgba(64,192,87,0.18)', lo: 'rgba(64,192,87,0.07)' },
        blue: { border: 'rgba(76,110,245,0.4)', pill: 'rgba(76,110,245,0.25)', mid: 'rgba(76,110,245,0.3)', hi: 'rgba(76,110,245,0.18)', lo: 'rgba(76,110,245,0.07)' },
        purple: { border: 'rgba(121,80,242,0.4)', pill: 'rgba(121,80,242,0.38)', mid: 'rgba(121,80,242,0.3)', hi: 'rgba(121,80,242,0.18)', lo: 'rgba(121,80,242,0.07)' }
    };

    const EVENT_DATA = {
        'Awareness Awareness Week': { t: THEMES.pink, b: 'awareness_awareness.png' },
        'Weekend Road Trip': { t: THEMES.orange, b: 'weekend_road_trip.png' },
        'Valentine\'s Day': { t: THEMES.pink, b: 'valentines_day.png' },
        'Employee Appreciation Day': { t: THEMES.blue, b: 'employee_appreciation_day.png' },
        'St Patrick\'s Day': { t: THEMES.green, b: 'st_patricks_day.png' },
        'Easter Egg Hunt': { t: THEMES.pink, b: 'easter_egg_competition.png', vb: '0 0 16 18', icon: 'M1.68,15a5.6,5.6,0,0,0,.43.41A5.72,5.72,0,0,0,3,16a4.73,4.73,0,0,0,.74.39,5.08,5.08,0,0,0,.8.3,5.35,5.35,0,0,0,.69.17,8.62,8.62,0,0,0,.87.11h.84a8.46,8.46,0,0,0,.88-.11l.69-.17a7.14,7.14,0,0,0,.81-.31q.38-.18.72-.39a6.57,6.57,0,0,0,.9-.67,5.14,5.14,0,0,0,.41-.4A6.3,6.3,0,0,0,13,10.67a8.86,8.86,0,0,0-.09-1.21c0-.31-.1-.64-.17-1s-.2-.85-.33-1.29-.3-.93-.48-1.39-.33-.81-.51-1.2-.1-.2-.19-.39-.29-.58L11,3.72c-.18-.33-.4-.69-.64-1.05s-.4-.55-.62-.82A4.41,4.41,0,0,0,6.5,0,4.41,4.41,0,0,0,3.29,1.86a9.15,9.15,0,0,0-.61.82c-.24.34-.44.68-.62,1L1.87,4l-.33.66c-.16.36-.32.72-.46,1.09S.74,6.7.61,7.16a13.14,13.14,0,0,0-.34,1.3,10,10,0,0,0-.18,1A8.47,8.47,0,0,0,0,10.67a6.29,6.29,0,0,0,.89,3.25A6.63,6.63,0,0,0,1.68,15Z' },
        '420 Day': { t: THEMES.green, b: '420_day.png' },
        'Museum Day': { t: THEMES.amber, b: 'museum_day.png' },
        'World Blood Donor Day': { t: THEMES.red, b: 'world_blood_donor_day.png' },
        'World Population Day': { t: THEMES.blue, b: 'world_population_day.png' },
        'World Tiger Day': { t: THEMES.orange, b: 'world_tiger_day.png' },
        'International Beer Day': { t: THEMES.amber, b: 'international_beer_day.png' },
        'Elimination': { t: THEMES.blue, b: 'elimination.png', isComp: true, vb: '0 0 18 18', icon: 'M13.28,15.25a7.42,7.42,0,0,0,2-2L18,16l-2,2ZM0,16,2.72,13.3a7.93,7.93,0,0,0,2,2L2,18ZM15.36,4.62a7.61,7.61,0,0,0-2-2L16,0l2,2ZM0,2,2,0,4.59,2.62a7.73,7.73,0,0,0-2,2Zm9,.56A6.36,6.36,0,0,0,6.4,14.7v1.55a1.78,1.78,0,0,0,1.13.57v-.9H8.4v1a8.15,8.15,0,0,0,1.21,0v-1h.87v.89a1.71,1.71,0,0,0,1.12-.56V14.7A6.36,6.36,0,0,0,9,2.54ZM6.22,11.28a2,2,0,1,1,2-2A2,2,0,0,1,6.22,11.28ZM7.7,12.87,9,11H9l1.35,1.85Zm4.17-1.59a2,2,0,1,1,2-2A2,2,0,0,1,11.87,11.28Z' },
        'Tourism Day': { t: THEMES.amber, b: 'tourism_day.png' },
        'CaffeineCon 2026': { t: THEMES.orange, b: 'caffeinecon_tiny.png' },
        'Trick or Treat': { t: THEMES.orange, b: 'trick_or_treat.png', vb: '0 0 16 16', icon: 'M9.48 3C8.92 2.32 7.35 0.47 7.15 0.26L6.91 0C6.91 0 6.19 0.31 6.24 0.6C6.29 0.89 7 2.15 6.78 2.49C6.69 2.63 6.57 2.82 6.48 2.98C2.87 3.14 0 5.77 0 9C0 12.23 3.05 15 6.82 15H9.18C13 15 16 12.31 16 9C16 5.69 13.11 3.12 9.48 3ZM11.48 5.56C11.7548 5.99215 11.9606 6.46448 12.09 6.96C11.6854 7.19343 11.2271 7.3175 10.76 7.32C10.1746 7.38179 9.58389 7.37508 9 7.3C9.11129 6.69947 9.31362 6.11945 9.6 5.58C9.80013 5.16169 10.0595 4.77438 10.37 4.43C10.7926 4.73028 11.1554 5.10671 11.44 5.54L11.48 5.56ZM9 9.61H7.15L8.08 8L9 9.61ZM4.51 6C4.71926 5.5561 5.0396 5.17376 5.44 4.89C5.79826 5.21134 6.10516 5.58568 6.35 6C6.58453 6.4391 6.77223 6.90164 6.91 7.38C6.48709 7.53075 6.04702 7.62817 5.6 7.67C5.04092 7.71535 4.47908 7.71535 3.92 7.67C3.99978 7.0787 4.20063 6.51019 4.51 6Z' },
        'World Diabetes Day': { t: THEMES.red, b: 'world_diabetes_day.png' },
        'Torn Anniversary': { t: THEMES.purple, b: 'torns_birthday.png' },
        'Black Friday': { t: THEMES.pink, b: 'black_friday.png' },
        'Slash Wednesday': { t: THEMES.purple, b: 'slash_wednesday.png' },
        'Christmas town': { t: THEMES.green, b: 'christmas_town.png', isComp: true, vb: '0 0 20 20', icon: 'M19.55 10.58L15.01 11.85L11.71 10L15.01 8.15L19.55 9.42L20 7.81L17.06 6.99L19.67 5.53L18.85 4.07L16.25 5.54L17.06 2.61L15.46 2.16L14.19 6.7L10.83 8.58V5.34L14.17 2.01L12.99 0.83L10.83 2.99V0H9.17V2.99L7.01 0.83L5.83 2.01L9.17 5.34V8.58L5.81 6.7L4.54 2.16L2.94 2.61L3.75 5.54L1.15 4.07L0.33 5.53L2.94 6.99L0 7.81L0.45 9.42L4.99 8.15L8.29 10L4.99 11.85L0.45 10.58L0 12.19L2.94 13.01L0.33 14.47L1.15 15.93L3.75 14.46L2.94 17.39L4.54 17.84L5.81 13.3L9.17 11.42V14.65L5.83 17.99L7.01 19.17L9.17 17.01V20H10.83V17.01L12.99 19.17L14.17 17.99L10.83 14.65V11.42L14.19 13.3L15.46 17.84L17.07 17.39L16.25 14.46L18.85 15.93L19.67 14.47L17.06 13.01L20 12.19L19.55 10.58Z' },
        'Christmas Town': { t: THEMES.green, b: 'christmas_town.png', isComp: true, vb: '0 0 20 20', icon: 'M19.55 10.58L15.01 11.85L11.71 10L15.01 8.15L19.55 9.42L20 7.81L17.06 6.99L19.67 5.53L18.85 4.07L16.25 5.54L17.06 2.61L15.46 2.16L14.19 6.7L10.83 8.58V5.34L14.17 2.01L12.99 0.83L10.83 2.99V0H9.17V2.99L7.01 0.83L5.83 2.01L9.17 5.34V8.58L5.81 6.7L4.54 2.16L2.94 2.61L3.75 5.54L1.15 4.07L0.33 5.53L2.94 6.99L0 7.81L0.45 9.42L4.99 8.15L8.29 10L4.99 11.85L0.45 10.58L0 12.19L2.94 13.01L0.33 14.47L1.15 15.93L3.75 14.46L2.94 17.39L4.54 17.84L5.81 13.3L9.17 11.42V14.65L5.83 17.99L7.01 19.17L9.17 17.01V20H10.83V17.01L12.99 19.17L14.17 17.99L10.83 14.65V11.42L14.19 13.3L15.46 17.84L17.07 17.39L16.25 14.46L18.85 15.93L19.67 14.47L17.06 13.01L20 12.19L19.55 10.58Z' }
    };

    const getTCT = () => {
        const n = new Date();
        return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), n.getUTCHours(), n.getUTCMinutes(), n.getUTCSeconds()));
    };

    let activeYear = getTCT().getUTCFullYear();
    let activeMonth = getTCT().getUTCMonth();
    let userStartTime = "Requires a Minimal Key";
    let calendarData = null;
    let currentTooltipId = null;
    let isTooltipPinned = false;
    let pinnedTooltipId = null;

    const style = document.createElement('style');
    style.id = 'tmc-custom-styles';
    style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Fjalla+One&display=swap');
        .header-menu.left, .leftMenu___xf2UJ { width: auto !important; max-width: 400px !important; }
        .header-navigation.right, .header-buttons-wrapper, .toolbar { width: 450px !important; }
        .find-wrapper, .find.searchFormWrapper___U9wla, .find.searchFormWrapper___U9wla form { width: 270px !important; }
        .searchWrapper___eoOfn, .searchInput___nchKe, .torn-react-autocomplete___lFgkV, .autocomplete-wrapper___bf3RT { width: 130px !important; }
        .searchTypeWrapper___J70At, .userSearchType___Hxda6, .react-dropdown-default { width: 130px !important; }
        li.tc-calendar { display: list-item; position: relative; width: 34px; height: 34.6px; float: left; list-style: none; }
        li.tc-calendar .top_header_button.button { width: 34px; height: 32px; margin-top: 2px; padding: 3px; border: 0; background: transparent; cursor: pointer; }
        li.tc-calendar .top_header_button svg { width: 25px; height: 28px; fill: url(#top_header_svg_gradient__regular); filter: drop-shadow(0px 2px 4px #0009); transition: fill .15s; }
        li.tc-calendar .top_header_button:hover svg { fill: url(#top_header_svg_gradient__regular___hover) !important; }
        #cal-modal { position: absolute; background: #ffffff; color: #222222; border: 1px solid #cccccc; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25); border-radius: 4px; z-index: 99999999; display: none; user-select: none; padding: 0 6px; box-sizing: border-box; }
        .dark-mode #cal-modal, .dark #cal-modal, body.dark-mode #cal-modal { background: #333333; color: #ffffff; border: 1px solid #444444; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); }
        #cal-modal * { box-sizing: border-box; font-family: "Fjalla One", sans-serif; }
        .calendar-row { display: flex; justify-content: space-between; color: #222222; }
        .dark-mode .calendar-row, .dark .calendar-row { color: #ffffff; }
        .calendar-event-hdr { display: flex; align-items: center; gap: 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 110px; color: inherit; }
        .calendar-event-hdr svg { fill: currentColor; flex-shrink: 0; }
        .calendar-weekdays { display: flex; width: 175px; height: 22px; line-height: 14px; padding: 4px 0; border-bottom: .8px solid #dddddd; }
        .dark-mode .calendar-weekdays, .dark .calendar-weekdays { border-bottom: .8px solid #444444; }
        .calendar-weekday { width: 25px; font-size: 11px; color: #777777; text-align: center; }
        .dark-mode .calendar-weekday, .dark .calendar-weekday { color: #999999; }
        .calendar-grid { display: flex; flex-wrap: wrap; width: 175px; }
        .calendar-day { position: relative; width: 25px; height: 25px; font-size: 11px; color: #222222; cursor: pointer; }
        .dark-mode .calendar-day, .dark .calendar-day { color: #ffffff; }
        .calendar-day.inactive { color: #bbbbbb !important; cursor: default; }
        .dark-mode .calendar-day.inactive, .dark .calendar-day.inactive { color: #666666 !important; }
        .calendar-day.current-day .calendar-num { background: #666666 !important; color: #ffffff !important; border-radius: 100%; }
        .dark-mode .calendar-day.current-day .calendar-num, .dark .calendar-day.current-day .calendar-num { background: #888888 !important; color: #ffffff !important; }
        .calendar-num { position: relative; line-height: 25px; text-align: center; z-index: 5; }
        .calendar-comp-border { position: absolute; inset: 0; z-index: 2; }
        .calendar-t { border-top: .8px solid var(--cb, #0005); }
        .calendar-b { border-bottom: .8px solid var(--cb, #0005); }
        .calendar-l { border-left: .8px solid var(--cb, #0005); }
        .calendar-r { border-right: .8px solid var(--cb, #0005); }
        .calendar-single-base { position: absolute; inset: 0; background: var(--sb); z-index: 1; }
        .calendar-single-pill { position: absolute; top: 1px; left: 1px; width: 23px; height: 23px; border-radius: 100%; background: var(--pb, #ffffff); border: .8px solid var(--pbr, #cccccc); z-index: 3; }
        .dark-mode .calendar-single-pill, .dark .calendar-single-pill { background: var(--pb, #333333); border: .8px solid var(--pbr, #000000bb); }
        .calendar-grad-l, .calendar-grad-r { position: absolute; top: 0; bottom: 0; width: 12px; height: 25px; z-index: 1; }
        .calendar-grad-l { right: 0; background: var(--gl); }
        .calendar-grad-r { left: 0; background: var(--gr); }
        .calendar-tooltip { display: none; position: absolute; width: 316px; background: #ffffff; color: #222222; border: 1px solid #cccccc; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25); padding: 0 0 10px; z-index: 9999999999; pointer-events: none; border-radius: 4px; box-sizing: border-box; }
        .dark-mode .calendar-tooltip, .dark .calendar-tooltip { background: #444444; color: #cccccc; border: 1px solid #555555; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); }
        .calendar-tooltip * { font-family: "Fjalla One", sans-serif !important; box-sizing: border-box; }
        .calendar-tooltip img { width: 312px; height: 69px; display: block; border-radius: 3px 3px 0 0; margin: 2px auto 0; }
        .calendar-tooltip-inner { padding: 0 10px; }
        .calendar-tooltip-title { color: #111111; font-size: 13px; font-weight: 400; margin: 8px 0 3px; line-height: normal; }
        .dark-mode .calendar-tooltip-title, .dark .calendar-tooltip-title { color: #ffffff; }
        .calendar-tooltip-duration { color: #666666; font-size: 12px; margin: 0 0 2px; line-height: normal; }
        .dark-mode .calendar-tooltip-duration, .dark .calendar-tooltip-duration { color: #cccccc; }
        .calendar-tooltip-desc { color: #333333; font-size: 12px; line-height: 16px; margin: 0; }
        .dark-mode .calendar-tooltip-desc, .dark .calendar-tooltip-desc { color: #ffffff; }
        .calendar-footer { border-top: 1px solid #dddddd; margin-top: 6px; padding-top: 4px; display: flex; align-items: center; justify-content: space-between; min-height: 22px; }
        .dark-mode .calendar-footer, .dark .calendar-footer { border-top: 1px solid #444444; }
        .calendar-btn { cursor: pointer; color: #666666; font-size: 13px; padding: 1px 3px; }
        .dark-mode .calendar-btn, .dark .calendar-btn { color: #888888; }
        .calendar-btn:hover { color: #111111; }
        .dark-mode .calendar-btn:hover, .dark .calendar-btn:hover { color: #ffffff; }
        .calendar-api-btn { background: none; border: none; color: #666666; font-size: 10px; cursor: pointer; text-decoration: underline; padding: 0; }
        .dark-mode .calendar-api-btn, .dark .calendar-api-btn { color: #888888; }
        .calendar-api-btn:hover { color: #111111; }
        .dark-mode .calendar-api-btn:hover, .dark .calendar-api-btn:hover { color: #ffffff; }
        .calendar-input { flex: 1; background: #ffffff; border: 1px solid #cccccc; border-radius: 3px; color: #222222; font-size: 10px; padding: 2px 4px; }
        .dark-mode .calendar-input, .dark .calendar-input { background: #222222; border: 1px solid #444444; color: #ffffff; }
        .calendar-save { background: #3b82f6; border: none; border-radius: 3px; color: #fff; font-size: 10px; cursor: pointer; padding: 2px 6px; }
    `;
    document.head.appendChild(style);

    const themeObserver = new MutationObserver(() => {
        const dark = detectDarkMode();
        if (dark !== isDarkMode) {
            isDarkMode = dark;
            renderCalendar();
        }
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const tooltip = document.createElement('div');
    tooltip.className = 'calendar-tooltip';
    document.body.appendChild(tooltip);

    function showTooltip(el, data) {
        tooltip.innerHTML = `
            <img src="${data.img}">
            <div class="calendar-tooltip-inner">
                <div class="calendar-tooltip-title">${data.title}</div>
                <div class="calendar-tooltip-duration">${data.dur}</div>
                <div class="calendar-tooltip-desc">${data.desc}</div>
            </div>
        `;
        const modal = document.getElementById('cal-modal');
        const mR = modal.getBoundingClientRect(), cR = el.getBoundingClientRect();
        tooltip.style.left = `${Math.max(10, mR.left - 324)}px`;
        tooltip.style.top = `${Math.max(window.scrollY + 10, window.scrollY + cR.top - 45)}px`;
        tooltip.style.display = 'block';
    }

    function hideTooltip(force = false) {
        if (force || !isTooltipPinned) {
            tooltip.style.display = 'none';
            currentTooltipId = null;
            if (force) {
                isTooltipPinned = false;
                pinnedTooltipId = null;
            }
        }
    }

    async function loadCalendarData(force = false) {
        if (!API_KEY) return;
        const cached = localStorage.getItem(CACHE_KEY);

        if (!force && cached) {
            try {
                const { timestamp, data, startTime } = JSON.parse(cached);
                const cachedYear = new Date(timestamp).getUTCFullYear();
                const currentTCTYear = getTCT().getUTCFullYear();
                if (cachedYear === currentTCTYear && (Date.now() - timestamp < CACHE_TTL)) {
                    calendarData = data;
                    userStartTime = startTime || userStartTime;
                    return renderCalendar();
                } else {
                    localStorage.removeItem(CACHE_KEY);
                }
            } catch (e) {
                localStorage.removeItem(CACHE_KEY);
            }
        }

        try {
            const [tornRes, userRes] = await Promise.all([
                fetch(`https://api.torn.com/v2/torn/calendar?key=${API_KEY}`).then(r => r.json()),
                fetch(`https://api.torn.com/v2/user/calendar?key=${API_KEY}`).then(r => r.json())
            ]);

            if (tornRes?.calendar) {
                calendarData = tornRes.calendar;
                userStartTime = userRes?.calendar?.start_time || "Requires a Minimal Key";
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    data: calendarData,
                    startTime: userStartTime
                }));
                renderCalendar();
            }
        } catch (e) {
            console.error('Calendar Fetch Error:', e);
        }
    }

    function formatDuration(event) {
        const pad = n => String(n).padStart(2, '0');
        const fmt = d => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${String(d.getUTCFullYear()).slice(-2)}`;
        const s = new Date(event.start * 1000), e = new Date(event.end * 1000);

        let startTimeStr = userStartTime;
        if (startTimeStr !== "Requires a Minimal Key") {
            startTimeStr = startTimeStr.replace(' TCT', '') + ':00';
        }

        const time = event.fixed_start_time ? `${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}:${pad(s.getUTCSeconds())}` : startTimeStr;
        return `${time} - ${fmt(s)} until ${time} - ${fmt(e)}`;
    }

    function renderCalendar() {
        const modal = document.getElementById('cal-modal');
        if (!modal) return;

        const isDark = detectDarkMode();
        const allEvents = [
            ...(calendarData?.competitions || []).map((c, i) => ({ ...c, isCompetition: true, eventId: `c_${i}` })),
            ...(calendarData?.events || []).map((e, i) => ({ ...e, isCompetition: false, eventId: `e_${i}` }))
        ];

        const tctNow = getTCT(), nowStamp = Math.floor(tctNow.getTime() / 1000);
        const mStart = Date.UTC(activeYear, activeMonth, 1) / 1000;
        const mEnd = Date.UTC(activeYear, activeMonth + 1, 0, 23, 59, 59) / 1000;
        const headerEvt = allEvents.find(e => e.start <= mEnd && e.end >= mStart && (e.isCompetition || (e.end - e.start) > 86400));
        const activeMeta = EVENT_DATA[headerEvt?.title];

        let html = `
            <div class="calendar-row">
                ${headerEvt ? `<div class="calendar-event-hdr"><svg width="13" height="13" viewBox="${activeMeta?.vb || '0 0 18 18'}"><path d="${activeMeta?.icon || EVENT_DATA['Elimination'].icon}"></path></svg><span>${headerEvt.title}</span></div>` : '<div></div>'}
                <div style="line-height:30px; letter-spacing:0.5px;">${MONTHS[activeMonth]}</div>
            </div>
            <div class="calendar-weekdays">${DAYS.map(d => `<div class="calendar-weekday">${d}</div>`).join('')}</div>
            <div class="calendar-grid">
        `;

        const startOffset = (new Date(Date.UTC(activeYear, activeMonth, 1)).getUTCDay() + 6) % 7;
        const daysInMonth = new Date(Date.UTC(activeYear, activeMonth + 1, 0)).getUTCDate();
        const daysInPrev = new Date(Date.UTC(activeYear, activeMonth, 0)).getUTCDate();

        for (let i = 0; i < 42; i++) {
            let day = i - startOffset + 1, inMonth = day > 0 && day <= daysInMonth;
            let dNum = inMonth ? day : (day <= 0 ? daysInPrev + day : day - daysInMonth);
            let cMonth = inMonth ? activeMonth : (day <= 0 ? activeMonth - 1 : activeMonth + 1);
            let cStart = Date.UTC(activeYear, cMonth, dNum, 0, 0, 0) / 1000;
            let cEnd = Date.UTC(activeYear, cMonth, dNum, 23, 59, 59) / 1000;

            const isToday = inMonth && activeYear === tctNow.getUTCFullYear() && activeMonth === tctNow.getUTCMonth() && dNum === tctNow.getUTCDate();
            const evt = allEvents.find(e => e.start <= cEnd && e.end >= cStart);
            const prevEvt = allEvents.find(e => !e.fixed_start_time && (e.end - e.start) <= 172800 && e.start <= cEnd + 86400 && e.end >= cStart + 86400);
            const nextEvt = allEvents.find(e => !e.fixed_start_time && (e.end - e.start) <= 172800 && e.start <= cEnd - 86400 && e.end >= cStart - 86400);
            const evtRef = evt || prevEvt || nextEvt;

            let layers = '', compStyle = '';
            if (evt) {
                const isMulti = (evt.end - evt.start) > 172800, isPast = evt.end < nowStamp;
                const pal = EVENT_DATA[evt.title]?.t || THEMES.amber;

                if (isMulti) {
                    const compBg = isPast ? (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.06)') : (isDark ? 'rgba(76,110,245,0.05)' : 'rgba(76,110,245,0.12)');
                    const compBorder = isPast ? (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)') : 'rgba(76,110,245,0.4)';
                    compStyle = `background: ${compBg}; --cb: ${compBorder}`;
                    const l = (i % 7 === 0) || (cStart <= evt.start && evt.start <= cEnd);
                    const r = (i % 7 === 6) || (cStart <= evt.end && evt.end <= cEnd);
                    layers = `<div class="calendar-comp-border calendar-t calendar-b ${l ? 'calendar-l' : ''} ${r ? 'calendar-r' : ''}"></div>`;
                } else if (Math.abs(evt.start - cStart) < 86400) {
                    const gMid = isPast ? (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)') : pal.mid;
                    const gHi = isPast ? (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)') : pal.hi;
                    const pillBg = isPast ? (isDark ? '#333333' : '#e0e0e0') : pal.pill;
                    const pillBorder = isPast ? (isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.2)') : pal.border;

                    layers = `<div class="calendar-single-base" style="--sb: linear-gradient(90deg, ${gHi} 0%, ${gMid} 50%, ${gHi} 100%);"></div>
                             <div class="calendar-single-pill" style="--pb: ${pillBg}; --pbr: ${pillBorder};"></div>`;
                }
            } else if (prevEvt && !evt) {
                const pal = EVENT_DATA[prevEvt.title]?.t || THEMES.amber;
                layers = `<div class="calendar-grad-l" style="--gl: linear-gradient(90deg, ${pal.lo} 0%, ${pal.hi} 100%);"></div>`;
            } else if (nextEvt && !evt) {
                const pal = EVENT_DATA[nextEvt.title]?.t || THEMES.amber;
                layers = `<div class="calendar-grad-r" style="--gr: linear-gradient(90deg, ${pal.hi} 0%, ${pal.lo} 100%);"></div>`;
            }

            const evtPayload = evtRef ? encodeURIComponent(JSON.stringify({
                id: evtRef.eventId, title: evtRef.title, dur: formatDuration(evtRef), desc: evtRef.description,
                img: `/images/v2/calendar/${EVENT_DATA[evtRef.title]?.isComp ? 'competitions' : 'events'}/${EVENT_DATA[evtRef.title]?.b || 'tourism_day.png'}`
            })) : '';

            html += `<div class="calendar-day ${!inMonth ? 'inactive' : ''} ${isToday ? 'current-day' : ''}" style="${compStyle}" ${evtPayload ? `data-e="${evtPayload}"` : ''}>
                ${layers}<div class="calendar-num">${dNum}</div>
            </div>`;
        }

        html += `</div><div class="calendar-footer">
            ${!isEditingApi ? `
                <div style="display:flex; gap:6px;"><span class="calendar-btn" id="calendar-p">&lt;</span><span class="calendar-btn" id="calendar-n">&gt;</span></div>
                <button class="calendar-api-btn" id="calendar-api-m">Manage API</button>
            ` : `
                <div style="display:flex; gap:4px; width:100%;">
                    <input type="password" class="calendar-input" id="calendar-key" placeholder="Paste API Key" value="${API_KEY}">
                    <button class="calendar-save" id="calendar-save">Save</button>
                </div>
            `}
        </div>`;

        modal.innerHTML = html;
        modal.querySelectorAll('.calendar-day[data-e]').forEach(el => {
            el.onmouseenter = () => {
                if (isTooltipPinned) return;
                const data = JSON.parse(decodeURIComponent(el.getAttribute('data-e')));
                if (currentTooltipId === data.id && tooltip.style.display === 'block') return;
                currentTooltipId = data.id;
                showTooltip(el, data);
            };

            el.onclick = (e) => {
                e.stopPropagation();
                const data = JSON.parse(decodeURIComponent(el.getAttribute('data-e')));

                if (isTooltipPinned && pinnedTooltipId === data.id) {
                    hideTooltip(true);
                } else {
                    isTooltipPinned = true;
                    pinnedTooltipId = data.id;
                    currentTooltipId = data.id;
                    showTooltip(el, data);
                }
            };
        });

        modal.querySelector('.calendar-grid').onmouseleave = () => {
            hideTooltip(false);
        };

        const pBtn = document.getElementById('calendar-p'), nBtn = document.getElementById('calendar-n');
        if (pBtn) pBtn.onclick = (e) => {
            e.stopPropagation();
            hideTooltip(true);
            if (--activeMonth < 0) { activeMonth = 11; activeYear--; }
            renderCalendar();
        };
        if (nBtn) nBtn.onclick = (e) => {
            e.stopPropagation();
            hideTooltip(true);
            if (++activeMonth > 11) { activeMonth = 0; activeYear++; }
            renderCalendar();
        };

        const apiM = document.getElementById('calendar-api-m');
        if (apiM) apiM.onclick = (e) => { e.stopPropagation(); hideTooltip(true); isEditingApi = true; renderCalendar(); };

        const apiS = document.getElementById('calendar-save');
        if (apiS) apiS.onclick = (e) => {
            e.stopPropagation();
            hideTooltip(true);
            API_KEY = document.getElementById('calendar-key').value.trim();
            GM_setValue('calendar_api_key', API_KEY);
            isEditingApi = false;
            loadCalendarData(true);
        };
    }

    function init() {
        const toolbar = document.querySelector('.header-buttons-wrapper .toolbar');
        const clock = toolbar?.querySelector('li.tc-clock');
        const avatar = toolbar?.querySelector('li.avatar');
        if (!toolbar || !clock || !avatar) return setTimeout(init, 250);
        if (document.querySelector('.tc-calendar')) return;

        let modal = document.getElementById('cal-modal') || document.createElement('div');
        modal.id = 'cal-modal';
        document.body.appendChild(modal);

        const li = clock.cloneNode(true);
        li.className = 'tc-calendar';
        const btn = li.querySelector('button');
        btn.className = 'top_header_button button tc_calendar';
        btn.setAttribute('aria-label', 'Open calendar');
        btn.innerHTML = `<svg viewBox="-3 -4 25 28"><path d="M16.5,2H14V0.75A0.75,0.75,0,0,0,12.5,0.75V2H5.5V0.75A0.75,0.75,0,0,0,4,0.75V2H1.5A1.5,1.5,0,0,0,0,3.5v13A1.5,1.5,0,0,0,1.5,18h15a1.5,1.5,0,0,0,1.5-1.5v-13A1.5,1.5,0,0,0,16.5,2ZM16,16H2V6.5H16ZM4,8.5h2v2H4Zm4,0h2v2H8Zm4,0h2v2H12Zm-8,4h2v2H4Zm4,0h2v2H8Zm4,0h2v2H12Z"></path></svg>`;

        toolbar.insertBefore(li, avatar);

        btn.onclick = (e) => {
            e.stopPropagation();
            const isOpen = modal.style.display === 'block';
            if (!isOpen) {
                const rect = btn.getBoundingClientRect();
                modal.style.top = `${window.scrollY + rect.bottom + 6}px`;
                modal.style.left = `${Math.min(window.innerWidth - 210, rect.left - 155)}px`;
                modal.style.display = 'block';
                const tct = getTCT();
                activeYear = tct.getUTCFullYear();
                activeMonth = tct.getUTCMonth();
                isEditingApi = false;
                hideTooltip(true);
                renderCalendar();
            } else {
                modal.style.display = 'none';
                hideTooltip(true);
            }
        };

        document.addEventListener('click', (e) => {
            if (!modal.contains(e.target) && !btn.contains(e.target)) {
                modal.style.display = 'none';
                hideTooltip(true);
            } else if (modal.contains(e.target) && !e.target.closest('.calendar-day[data-e]')) {
                hideTooltip(true);
            }
        });

        loadCalendarData();
    }

    init();
})();