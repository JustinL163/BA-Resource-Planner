let data;
let events_data, event_data;
let saveTime = 0;

let event_config, charlist, event_misc;
let enabledBonusUnits = [];
let currencyBonuses = {};
let currencyNeededPre = {};
let currencyNeeded = {};
let energyAvailable = 0;

let shopPurchaseModified = false;
let eventLoading = false;

let failureReason = "";

let current_event = "", current_currency = "";
let stage_runs = {};
let event_point_target = 0;

let lessonPreRuns = [];
let lessonPostRuns = {};
let maxEventPoints = 0;

let targetedMaterials = {}, targetedCurrency = "";
let optimisationType = "";

let displayIncluded = {};

let initialClearRewards = {};
let initialClearCost = 0;

let cafeDefault = 7;

let shopItemTippies = [];

function loadResources() {

    $.getJSON('json/events.json?9').done(function (json) {
        event_config = json;
        checkResources();
    });

    $.getJSON('json/event_misc.json?1').done(function (json) {
        event_misc = json;
        checkResources();
    });

    $.getJSON('json/charlist.json?21').done(function (json) {
        charlist = json;
        checkResources();
    });
}

function checkResources() {

    if (event_config && event_misc && charlist) {

        data = tryParseJSON(localStorage.getItem('save-data'));

        if (data) {
            events_data = data.events_data ?? {};
        }
        else {
            events_data = {};
        }

        init();
    }
}

function init() {

    if (data == null) {
        data = { exportVersion: exportDataVersion, characters: [], disabled_characters: [], owned_materials: {}, groups: defaultGroups, language: "EN", level_cap: lvlMAX };
        localStorage.setItem("save-data", JSON.stringify(data));
    }

    if (data.page_theme != undefined) {
        setTheme(data.page_theme);
    }

    GenerateEventsList();

    setInterval(() => {
        if (saveTime != 0) {
            if (Date.now() > saveTime) {
                shopPurchaseModified = false;
                if (current_event) {
                    events_data[current_event] = event_data;
                }
                data.events_data = events_data;
                saveToLocalStorage(true);
            }
        }
    }, 300);

    InitKeyTracking();

    InitTippies();

    document.getElementById('include-shop-purchases').checked = false;
    document.getElementById('include-point-rewards').checked = false;
    document.getElementById('include-box-rewards').checked = false;
    document.getElementById('include-lesson-rewards').checked = false;

    //TEMP
    // LoadEvent('neverland-rerun');
    // EventTabClicked('Targets');
}

async function saveToLocalStorage(notify) {

    saveTime = 0;

    localStorage.setItem("save-data", JSON.stringify(data));

    if (notify && !document.documentElement.classList.contains('swal2-shown')) {
        Swal.fire({
            toast: true,
            position: 'top-start',
            title: 'Data saved',
            showConfirmButton: false,
            timer: 1500
        })
    }
}

function handleKeydown(e, keyPressed) {

}

function GenerateEventsList() {

    let events_list = document.getElementById("events-list");

    for (let i = 0; i < event_config.event_order.length; i++) {
        let eventDiv = document.createElement("div");
        let eventImg = document.createElement("img");
        let eventLabel = document.createElement('p');

        let eventName = event_config.event_order[i];
        let eventDisabled = false;
        if (eventName.substring(0, 1) == "|") {
            eventName = eventName.substring(1);
            eventDisabled = true;
        }

        let eventInfo = event_config.events[eventName];

        eventImg.src = "icons/EventIcon/" + eventInfo.icon;
        eventImg.className = "event-icon";

        if (eventInfo.display_name) {
            eventLabel.innerText = eventInfo.display_name;
        }

        eventDiv.appendChild(eventImg);
        eventDiv.appendChild(eventLabel);
        eventDiv.id = event_config.event_order[i];
        eventDiv.className = "listed-event";

        if (!eventDisabled) {

            eventDiv.style.cursor = "pointer";

            eventDiv.addEventListener('click', (event) => {
                LoadEvent(event.currentTarget.id);
            })
        }
        else {
            eventDiv.classList.add("disabled-event");
        }

        events_list.appendChild(eventDiv);
    }
}

function InitTippies() {

    let tippieIds = ['#tab-Targets', '#tab-Energy', '#tab-Bonus', '#tab-Shop', '#tab-Stages', '#tab-Points', '#tab-Boxes', '#energy-source-natural',
        '#energy-source-dailies', '#energy-source-club', '#energy-source-weeklies', '#energy-source-arona', '#energy-source-pyro', '#energy-source-pvp',
        '#energy-source-cafe', '#energy-source-pack', '#energy-sources-total', '#label-shop-purchases', '#label-point-rewards', '#label-box-rewards',
        '#label-lesson-rewards', '#tab-opti-Shop', '#tab-opti-Materials', '#tab-opti-Currency', '#tab-opti-Manual']

    let tippieMsgs = ['Set optimisation targets', 'Adjust available energy', 'Toggle bonus currency characters', 'Pick shop purchases',
        'See calculated optimal runs, or set manually', 'View event point reward tiers', 'View event gacha box contents', 'Natural energy regen (10/h)',
        'Energy from daily tasks (150/d)', 'Open club energy (10/d)', 'Energy from weekly tasks', 'Arona 10 day login cycle', 'Set daily pyro refills',
        'Set daily pvp refills', 'Set cafe level', 'Using bi-weekly energy pack', 'Available energy for event', 'Display rewards purchased from shops',
        'Display rewards from event point tiers', 'Display rewards from event gacha boxes', 'Display rewards from event lessons',
        'Use minimum energy possible to clear picked shop purchases and event point tiers',
        'Select stage drop material(s) to target, equally weighted. (Makes sure to at least clear picked shops and point tiers)',
        'Farm as many of a specific event currency as possible. (Makes sure to at least clear picked shops and point tiers)',
        "Sets the inputs in Stages tab to editable for manual input."]

    //let tippieTimeouts = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 10, 10, 10]

    for (let i = 0; i < tippieIds.length; i++) {
        tippy(tippieIds[i], {
            content: tippieMsgs[i],
            theme: 'light'//,
            // onShow(instance) {
            //     setTimeout(() => {
            //         instance.hide();
            //     }, tippieTimeouts[i] * 1000);
            // }
        })
    }

    tippy('#info-event-bonus-maximise', {
        content: `<b>TLDR: Beat stages you need to farm with the highest bonus per token. This may take several runs.</b><br><br>
        
        An event stage saves your highest bonus multiplier for each token. You may need several runs to maximize this, usually focusing one token at a time due to team limitations. 
        You cannot forfeit or be defeated on teams with these characters, otherwise it removes their bonus. It’s fine if the bonus chars die.<br><br>
        
        For example, to set up a stage with 3 currencies:<br>
        - Beat it with the highest bonus for token A<br>
        - Beat it with the highest bonus for token B<br>
        - Beat it with the highest bonus for token C<br>
        - Now you have the maximum bonus multipliers for tokens A, B, and C. You can sweep away.<br> 
        - Repeat for every stage you need to farm.`,
        theme: 'light',
        allowHTML: true
    });
}

function LoadEvent(eventId) {

    if (!current_event) {
        document.getElementById("info-select-event").style.display = "none";
    }

    if (current_event == eventId) {
        document.getElementById('events-list').classList.add('event-selected');
        document.getElementById('event-content-container').classList.add('event-selected');
        return;
    }

    document.getElementById('event-list-button-label').innerText = "Event List - " + event_config.events[eventId].display_name;

    eventLoading = true;

    document.getElementById('events-list').classList.add('event-selected');
    document.getElementById('event-content-container').classList.add('event-selected');

    if (current_event) {
        document.getElementById(current_event).classList.remove('selected');
    }
    document.getElementById(eventId).classList.add('selected');

    current_event = eventId;
    current_currency = "";
    targetedCurrency = "";
    currencyNeeded = {};
    targetedMaterials = {};
    optimisationType = "";
    stage_runs = {};
    lessonPreRuns = [];
    lessonPostRuns = {};
    failureReason = "";

    if (events_data[current_event]) {
        event_data = events_data[current_event];
        enabledBonusUnits = event_data.enabled_bonus_units ?? [];
        currencyNeededPre = event_data.currency_needed ?? {};
        lessonPreRuns = event_data.lesson_pre_runs ?? [];
        lessonPostRuns = event_data.lesson_post_runs ?? {};
    }
    else {
        event_data = {};
        enabledBonusUnits = [];
        event_data.shop_purchases = {};
        event_data.currency_needed = {};
        event_data.cafe_rank = cafeDefault;
    }

    if (Object.keys(event_data.shop_purchases).length == 0) {
        event_data.shop_purchases = InitMaxShopPurchases();
    }

    if (event_data.point_target) {
        event_point_target = event_data.point_target;
    }
    else if (event_config.events[current_event].event_point_target) {
        event_point_target = event_config.events[current_event].event_point_target;
    }
    else {
        event_point_target = 0;
    }

    let available_targets = event_config.events[current_event].available_targets;
    if (available_targets) {

        let buttons = document.getElementsByClassName("optimise-approach-button");

        for (let i = 0; i < buttons.length; i++) {

            if (available_targets.includes(buttons[i].id.substring(9))) {
                buttons[i].style.display = '';
            }
            else {
                buttons[i].style.display = 'none';
            }
        }
    }

    ClearRewards();
    GenerateBonusTab();
    CalculateBonuses();
    UpdateBonuses();
    GenerateShopTabs();
    GenerateBoxesTabs();
    CalculateInitalClear();
    CalculateEnergyAvailable();
    CalculateNeededFinal();
    InitTargetsTab();
    GenerateStagesTable();
    GeneratePointsTable();
    GenerateLessonsTab();
    LoadFirstShop();
    UpdateNotifications();

    eventLoading = false;
}

function EventTabClicked(tab) {

    if (!current_event || eventLoading) {
        return;
    }

    let tabs = document.getElementsByClassName('event-tab-button');

    for (let i = 0; i < tabs.length; i++) {
        if (tabs[i].id == "tab-" + tab) {
            tabs[i].classList.add('selected')
        }
        else {
            tabs[i].classList.remove('selected')
        }
    }

    if (tab == "Stages") {
        GenerateStagesTable();
    }
    else if (tab == "Lessons") {
        GenerateLessonsTab();
    }

    SwitchTab(tab);

    UpdateNotifications();
}

function InitTargetsTab() {

    let optType = event_data["optimisation_type"];
    let optOptions = event_data["optimisation_options"];

    if (optType) {

        SetOptimise(optType);

        if (optType == "Currency" && optOptions) {
            OptimiseCurrency("currency-target-" + optOptions);
        }
        else if (optType == "Materials" && optOptions) {
            let materials = Object.keys(optOptions);

            for (let i = 0; i < materials.length; i++) {

                if (optOptions[materials[i]]) {
                    ToggleTargetMat("opt-select-" + materials[i]);
                }
            }
        }
        else if (optType == "Manual" && optOptions) {

            stage_runs = optOptions;
        }
    }
    else {

        let tabs = document.getElementsByClassName('optimise-approach-button');

        for (let i = 0; i < tabs.length; i++) {

            tabs[i].classList.remove('selected');
        }

        let optContainer = document.getElementById('optimisation-settings-container');

        while (optContainer.children.length > 0) {
            optContainer.children[0].remove();
        }
    }

    RefreshDropsDisplay();
}

function GenerateBonusTab() {

    let currencies = event_config.events[current_event].currencies;
    let currencyNames = Object.keys(currencies);

    let bonusCharsList = [];
    let elCurrencyBonuses = document.getElementById('currency-bonuses');

    while (elCurrencyBonuses.children.length > 0) {
        elCurrencyBonuses.children[0].remove();
    }

    for (let i = 0; i < currencyNames.length; i++) {

        if (currencies[currencyNames[i]].source == "BoxPull") {
            continue;
        }

        let bonus_units = currencies[currencyNames[i]].bonus_units;

        for (let ii = 0; ii < bonus_units.length; ii++) {

            if (!bonusCharsList.includes(bonus_units[ii].id)) {

                bonusCharsList.push(bonus_units[ii].id);
            }
        }

        let currencyDiv = document.createElement('div');
        currencyDiv.className = "currency-box";

        let currencyImg = document.createElement('img');
        currencyImg.src = "icons/EventIcon/CurrencyIcon/" + currencies[currencyNames[i]].icon;

        let currencyP = document.createElement('p');
        currencyP.id = "currency-" + currencyNames[i];
        currencyP.innerText = "+0%";

        currencyDiv.appendChild(currencyImg);
        currencyDiv.appendChild(currencyP);
        elCurrencyBonuses.appendChild(currencyDiv);
    }

    let charsContainer = document.getElementById('bonus-chars-container');

    while (charsContainer.children.length > 0) {
        charsContainer.children[0].remove();
    }

    for (let i = 0; i < bonusCharsList.length; i++) {

        let charDiv = document.createElement('div');
        charDiv.id = "char_" + bonusCharsList[i];
        charDiv.className = "bonus-char-box";
        if (enabledBonusUnits.includes(bonusCharsList[i])) {
            charDiv.classList.add('enabled');
        }

        let charImg = document.createElement('img');

        charImg.src = "icons/Portrait/Icon_" + bonusCharsList[i] + ".png";

        charDiv.appendChild(charImg);
        charsContainer.appendChild(charDiv);

        charDiv.addEventListener('click', (event) => {
            ToggleBonusChar(event.currentTarget.id);
        })
    }

}

function LoadFirstShop() {

    let currencyShopTabs = document.getElementById("currency-shop-tabs");
    if (currencyShopTabs.children) {
        currencyShopTabs.children[0].click();
    }
}

function ToggleBonusChar(id) {

    let charId = id.substring(5);

    if (enabledBonusUnits.includes(charId)) {
        enabledBonusUnits.splice(enabledBonusUnits.indexOf(charId), 1);

        document.getElementById(id).classList.remove("enabled");
    }
    else {
        enabledBonusUnits.push(charId);

        document.getElementById(id).classList.add("enabled");
    }

    event_data.enabled_bonus_units = enabledBonusUnits;

    saveTime = Date.now() + (1000 * 5);

    CalculateBonuses();
    UpdateBonuses();
    UpdateNotifications();
    RefreshDropsDisplay();
}

function CalculateBonuses() {

    currencyBonuses = {};

    let currencies = event_config.events[current_event].currencies;
    let currencyNames = Object.keys(currencies);

    for (let i = 0; i < currencyNames.length; i++) {

        let strikersUsed = 0, specialsUsed = 0;
        let currencyBonus = 0;

        let bonus_units = currencies[currencyNames[i]].bonus_units;
        for (let ii = 0; ii < bonus_units.length; ii++) {

            if (!enabledBonusUnits.includes(bonus_units[ii].id)) {
                continue;
            }

            let type = charlist[bonus_units[ii].id].Type;

            if (type == "Striker" && strikersUsed < 4) {
                strikersUsed++;
                currencyBonus += bonus_units[ii].bonus;
            }
            if (type == "Special" && specialsUsed < 2) {
                specialsUsed++;
                currencyBonus += bonus_units[ii].bonus;
            }
        }

        currencyBonuses[currencyNames[i]] = currencyBonus;

    }
}

function UpdateBonuses() {

    let currencies = Object.keys(currencyBonuses);

    for (let i = 0; i < currencies.length; i++) {

        let currencyBonusLabel = document.getElementById("currency-" + currencies[i]);

        if (currencyBonusLabel) {
            currencyBonusLabel.innerText = "+" + Math.round(currencyBonuses[currencies[i]] * 100) + "%";
        }
    }

}

function SwitchTab(tab) {

    let tabs = document.getElementsByClassName('event-tab');

    for (let i = 0; i < tabs.length; i++) {
        tabs[i].style.display = '';
    }

    document.getElementById(tab + '-tab').style.display = 'block';

}

async function EnergySourceClicked(source) {

    let title, options = {}, input_placeholder;

    if (source == "Pyro") {
        for (let i = 0; i <= 20; i++) {
            options[i] = i + "x";
        }

        title = "Pyro refreshes";
        input_placeholder = "Select number of refreshes";
    }
    else if (source == "ArenaCoin") {
        for (let i = 0; i <= 4; i++) {
            options[i] = i + "x";
        }

        title = "Pvp refreshes";
        input_placeholder = "Select number of refreshes";
    }
    else if (source == "Cafe") {
        for (let i = 1; i <= 7; i++) {
            options[i] = "Lvl " + i;
        }

        title = "Cafe rank";
        input_placeholder = "Select cafe rank";
    }
    else if (source == "EnergyPack") {

        options = {
            "Yes": "Yes",
            "No": "No"
        }

        title = "Biweekly Energy Pack";
        input_placeholder = "Pack active?";
    }



    const { value: result } = await Swal.fire({
        title: title,
        input: 'select',
        inputOptions: options,
        inputPlaceholder: input_placeholder,
        showCancelButton: true
    })



    if (result) {

        if (source == "Pyro") {
            event_data["pyro_refreshes"] = parseInt(result);
            if (result == "0") {
                document.getElementById('energy-source-pyro-refresh').innerText = '';
            }
            else {
                document.getElementById('energy-source-pyro-refresh').innerText = result + "x";
            }
        }
        else if (source == "ArenaCoin") {
            event_data["pvp_refreshes"] = parseInt(result);
            if (result == "0") {
                document.getElementById('energy-source-pvp-refresh').innerText = '';
            }
            else {
                document.getElementById('energy-source-pvp-refresh').innerText = result + "x";
            }
        }
        else if (source == "Cafe") {
            event_data["cafe_rank"] = parseInt(result);
            if (result == "0") {
                document.getElementById('energy-source-cafe-level').innerText = '';
            }
            else {
                document.getElementById('energy-source-cafe-level').innerText = "Lvl " + result;
            }
        }
        else if (source == "EnergyPack") {
            if (result == "Yes") {
                event_data["energy_pack"] = true;
            }
            else {
                event_data["energy_pack"] = false;
            }
        }

        CalculateEnergyAvailable();

        saveTime = Date.now() + (1000 * 5);

        if (event_data.pyro_refreshes == undefined) {
            event_data.pyro_refreshes = 0;
        }

        UpdateNotifications();
    }
}

function CalculateEnergyAvailable() {

    let energyByDay = [];
    let energy_natural = 0, energy_dailytask = 0, energy_club = 0, energy_weeklytask = 0, energy_aronalogin = 0,
        energy_pyrorefresh = 0, energy_pvprefresh = 0, energy_cafe = 0, energy_energypack = 0;

    let eventObject = event_config.events[current_event];

    let resets = 0;

    for (let i = eventObject.reset_time; i < eventObject.end_time; i += 86400) {

        let dayLength = 24;

        let natural = 0, cafe = 0, dailytask = 0, club = 0, pyrorefresh = 0, pvprefresh = 0,
            energypack = 0, weeklytask = 0, aronalogin = 0;

        if (resets == 0) {
            dayLength = (((eventObject.reset_time + 86400) - eventObject.start_time) / 3600) - eventObject.maint_hours;
        }
        else if (i + 86400 > eventObject.end_time) {
            dayLength = (eventObject.end_time - eventObject.reset_time - (86400 * resets)) / 3600;
        }

        energy_natural += natural = (10 * dayLength);
        energy_cafe += cafe = Math.floor(event_misc.cafe_energy[event_data.cafe_rank ?? cafeDefault] * dayLength)
        energy_dailytask += dailytask = 150;
        energy_club += club = 10;
        energy_pyrorefresh += pyrorefresh = 120 * (event_data.pyro_refreshes ?? 0);
        energy_pvprefresh += pvprefresh = 90 * (event_data.pvp_refreshes ?? 0);

        if (event_data.energy_pack) {
            energy_energypack += energypack = 150;
        }

        energyByDay[resets] = natural + cafe + dailytask + club + pyrorefresh + pvprefresh + energypack;

        resets++;
    }

    document.getElementById('energy-natural-total').innerText = energy_natural;
    document.getElementById('energy-dailytask-total').innerText = energy_dailytask;
    document.getElementById('energy-club-total').innerText = energy_club;

    document.getElementById("energy-pyro-total").innerText = energy_pyrorefresh;
    if (event_data.pyro_refreshes) {
        document.getElementById('energy-source-pyro-refresh').innerText = event_data.pyro_refreshes + "x";
    }
    else {
        document.getElementById('energy-source-pyro-refresh').innerText = '';
    }
    document.getElementById("energy-arenacoin-total").innerText = energy_pvprefresh;
    if (event_data.pvp_refreshes) {
        document.getElementById('energy-source-pvp-refresh').innerText = event_data.pvp_refreshes + "x";
    }
    else {
        document.getElementById('energy-source-pvp-refresh').innerText = '';
    }
    document.getElementById("energy-cafe-total").innerText = energy_cafe;
    if (event_data.cafe_rank) {
        document.getElementById('energy-source-cafe-level').innerText = "Lvl " + event_data.cafe_rank;
    }
    else {
        document.getElementById('energy-source-cafe-level').innerText = '';
    }
    document.getElementById("energy-energypack-total").innerText = energy_energypack;

    energyAvailable = (energyByDay.reduce((t, c) => t + c) + 500 + 150)

    document.getElementById("energy-total").innerText = energyAvailable;

    energyAvailable = Math.max(energyAvailable - 100 - initialClearCost, 0);

    /////
    document.getElementById('energy-weeklytask-total').innerText = 500;
    document.getElementById('energy-aronalogin-total').innerText = 150;

    //energy_weeklytask += 500;
    //energy_aronalogin += 150;

    if (!eventLoading) {
        RefreshDropsDisplay();
    }

}

function GenerateShopTabs() {

    let currencies = event_config.events[current_event].currencies;
    let shops = event_config.events[current_event].shops;
    let shopCurrencies = Object.keys(shops);

    let elShopTabs = document.getElementById('currency-shop-tabs');

    while (elShopTabs.children.length > 0) {
        elShopTabs.children[0].remove();
    }

    for (let i = 0; i < shopCurrencies.length; i++) {

        let tabDiv = document.createElement('div');
        tabDiv.className = "currency-shop-tab";
        tabDiv.id = shopCurrencies[i];

        tabDiv.addEventListener('click', (event) => {
            ShopTabClicked(event.currentTarget.id);
        })

        let tabImg = document.createElement('img');

        tabImg.src = "icons/EventIcon/CurrencyIcon/" + currencies[shopCurrencies[i]].icon;

        tabDiv.appendChild(tabImg);

        let tabP = document.createElement('p');
        tabP.id = "currency-label-" + shopCurrencies[i];

        if (currencyNeededPre[shopCurrencies[i]]) {
            tabP.innerText = currencyNeededPre[shopCurrencies[i]];
        }
        else {
            tabP.innerText = 0;
        }

        tabDiv.appendChild(tabP);

        elShopTabs.appendChild(tabDiv);
    }

}

function GenerateBoxesTabs() {

    let boxCycleSets = event_config.events[current_event].boxes;

    if (!boxCycleSets) {

        ClearChildren(document.getElementById('box-cycle-tabs'));
        ClearChildren(document.getElementById('box-cycle-content'));
        document.getElementById('tab-Boxes').style.display = 'none';
        document.getElementById('include-box-rewards').style.display = 'none';
        document.getElementById('label-box-rewards').style.display = 'none';
        return;
    }
    else {
        document.getElementById('include-box-rewards').style.display = '';
        document.getElementById('label-box-rewards').style.display = '';
    }

    document.getElementById('tab-Boxes').style.display = '';

    let elementBoxesTabs = document.getElementById('box-cycle-tabs');

    ClearChildren(elementBoxesTabs);

    for (let i = 0; i < boxCycleSets.length; i++) {

        let boxSet = boxCycleSets[i];

        let tabDiv = document.createElement('div');
        tabDiv.className = "box-cycle-tab";
        tabDiv.id = "box-cycle-set-" + i;

        tabDiv.addEventListener('click', (event) => {
            BoxesTabClicked(event.currentTarget.id);
        })

        let tabP = document.createElement('p');
        tabP.id = "box-cycle-label-" + i;

        if (boxSet.cycle.length > 1) {

            let cycleText = boxSet.cycle[0];

            for (let ii = 1; ii < boxSet.cycle.length; ii++) {
                cycleText += "/" + boxSet.cycle[ii];
            }

            tabP.innerText = cycleText;
        }
        else {
            tabP.innerText = boxSet.cycle[0] + "+";
        }

        tabDiv.appendChild(tabP);

        elementBoxesTabs.appendChild(tabDiv);
    }

    if (elementBoxesTabs.children) {
        elementBoxesTabs.children[0].click();
    }
}

function CalculateBoxesNeeded(boxDropCurrency) {

    let boxCycleSets = event_config.events[current_event].boxes;
    let boxSelect = {};

    for (let i = 0; i < boxCycleSets.length; i++) {

        for (let ii = 0; ii < boxCycleSets[i].cycle.length; ii++) {

            boxSelect[boxCycleSets[i].cycle[ii]] = i;
        }
    }

    let infiniteBox = boxSelect[Object.keys(boxSelect).length];

    let cycle = 0;
    let boxCurrencyObtained = 0;

    while (boxCurrencyObtained < boxDropCurrency) {

        cycle++;

        let boxRewards;
        if (boxSelect[cycle] != undefined) {
            boxRewards = boxCycleSets[boxSelect[cycle]].rewards;
        }
        else {
            boxRewards = boxCycleSets[infiniteBox].rewards;
        }

        for (let i = 0; i < boxRewards.length; i++) {

            if (boxRewards[i].type == "EventCurrency") {
                boxCurrencyObtained += boxRewards[i].amount * boxRewards[i].count;
            }
        }
    }

    return cycle;
}

function CalculateBoxCurrencyNeeded(boxDropCurrency) {

    let pullCurrencyNeeded = CalculateBoxesNeeded(boxDropCurrency) * event_config.events[current_event].box_clear_cost;
    return pullCurrencyNeeded;
}

function ShopTabClicked(currency) {

    if (current_currency == currency) {
        return;
    }

    if (!event_data.shop_purchases) {
        event_data.shop_purchases = {};
    }

    if (!event_data.shop_purchases[currency]) {
        event_data.shop_purchases[currency] = {};
    }

    if (current_currency) {
        HarvestItemPurchases();
        if (shopPurchaseModified) {
            saveTime = Date.now() + (1000);
        }
    }

    current_currency = currency;

    let tabs = document.getElementsByClassName('currency-shop-tab');

    for (let i = 0; i < tabs.length; i++) {
        if (tabs[i].id == currency) {
            tabs[i].classList.add('selected')
        }
        else {
            tabs[i].classList.remove('selected')
        }
    }

    GenerateShopContent(currency);
}

function BoxesTabClicked(boxCycleTabId) {

    // if (current_currency == currency) {
    //     return;
    // }

    // current_currency = currency;

    let tabs = document.getElementsByClassName('box-cycle-tab');

    for (let i = 0; i < tabs.length; i++) {
        if (tabs[i].id == boxCycleTabId) {
            tabs[i].classList.add('selected')
        }
        else {
            tabs[i].classList.remove('selected')
        }
    }

    GenerateBoxContent(boxCycleTabId);
}

function GenerateShopContent(currency) {

    let shop = event_config.events[current_event].shops[currency];

    let elShopContent = document.getElementById('currency-shop-content');

    ClearChildren(elShopContent);

    for (let i = 0; i < shop.length; i++) {

        elShopContent.appendChild(CreateShopItem(shop[i], currency));

        if (shop[i].type == "Furniture") {

            if (shop[i].limited) {

                shopItemTippies.push(tippy(('#info-' + shop[i].id), {
                    content: "This furniture is event limited",
                    theme: 'light'
                })[0]);
            }
            else {
                shopItemTippies.push(tippy(('#info-' + shop[i].id), {
                    content: "This furniture is not limited",
                    theme: 'light'
                })[0]);
            }
        }
    }

}

function GenerateBoxContent(boxCycleTabId) {

    let cycleId = boxCycleTabId.substring(14);

    let box = event_config.events[current_event].boxes[cycleId];

    let elementBoxContent = document.getElementById('box-cycle-content');

    ClearChildren(elementBoxContent);

    for (let i = 0; i < box.rewards.length; i++) {

        elementBoxContent.appendChild(CreateBoxItem(box.rewards[i]));
    }

}

function ClearChildren(parentElement) {

    for (let i = 0; i < shopItemTippies.length; i++) {
        shopItemTippies[i].destroy();
    }

    shopItemTippies = [];

    while (parentElement.children.length > 0) {
        parentElement.children[0].remove();
    }
}

function CreateShopItem(item, currency) {

    let itemDiv = document.createElement('div');
    itemDiv.className = "shop-item";

    let itemImg = document.createElement('img');

    SetItemImage(itemImg, item, '');

    itemDiv.appendChild(itemImg);

    let inputDiv = document.createElement('div');
    inputDiv.className = "shop-item-input-container";

    let inputElement = document.createElement('input');
    inputElement.id = "input-" + item.id;
    inputElement.type = "number";
    inputElement.max = item.count;
    inputElement.min = 0;

    let initValue = event_data.shop_purchases[current_currency]?.[item.id];

    if (initValue) {
        inputElement.value = initValue;
    }
    else {
        inputElement.value = 0;
    }

    inputElement.addEventListener('input', (event) => {
        validateBasic(event.currentTarget.id);
    });

    inputElement.addEventListener('beforeinput', (event) => {
        preInput = event.target.value;
    });

    inputElement.addEventListener('focusout', (event) => {
        let validation = validateBasic(event.currentTarget.id);

        if (validation == "validated") {
            shopPurchaseModified = true;
            HarvestItemPurchases();
        }

        preInput = '';
    });

    let inputP = document.createElement('p');
    inputP.innerText = "/ " + item.count;

    inputDiv.appendChild(inputElement);
    inputDiv.appendChild(inputP);

    itemDiv.appendChild(inputDiv);

    if (item.amount) {

        let amountP = document.createElement('p');
        amountP.className = "shop-item-amount-label";

        amountP.innerText = "x" + commafy(item.amount);

        itemDiv.appendChild(amountP);
    }

    let priceDiv = document.createElement('div');
    priceDiv.className = "shop-item-price-container";

    let priceImg = document.createElement('img');
    priceImg.src = "icons/EventIcon/CurrencyIcon/" + currency + ".png";

    let priceP = document.createElement('p');
    priceP.innerText = item.cost;

    priceDiv.appendChild(priceImg);
    priceDiv.appendChild(priceP);

    itemDiv.appendChild(priceDiv);

    if (item.type == "Furniture") {

        let infoImg = document.createElement('img');
        infoImg.id = "info-" + item.id;
        infoImg.className = "shop-furniture-info-bubble";
        infoImg.src = "icons/Furniture/circle-exclamation-solid.svg";

        itemDiv.appendChild(infoImg);

        if (item.limited) {
            infoImg.classList.add('limited-furniture');
        }
    }


    return itemDiv;
}

function CreateBoxItem(item) {

    let itemDiv = document.createElement('div');
    itemDiv.className = "box-item";

    let itemImg = document.createElement('img');

    SetItemImage(itemImg, item, '');

    itemDiv.appendChild(itemImg);

    let amountP = document.createElement('p');
    amountP.className = "box-item-amount";
    amountP.innerText = commafy(item.amount);

    itemDiv.appendChild(amountP);

    let priceDiv = document.createElement('div');
    priceDiv.className = "box-item-times-container";

    let priceP = document.createElement('p');
    priceP.innerText = item.count + " times";

    priceDiv.appendChild(priceP);

    itemDiv.appendChild(priceDiv);


    return itemDiv;
}

function SetItemImage(itemImg, item, replacementId) {

    let itemId = item.id;
    if (replacementId) {
        itemId = replacementId;
    }

    if (item.type == "Eleph") {
        itemImg.src = "icons/Eleph/Eleph_" + itemId + ".png";
    }
    else if (item.type == "XpReport") {
        itemImg.src = "icons/LevelPart/" + itemId + ".png";
    }
    else if (item.type == "XpOrb") {
        itemImg.src = "icons/LevelPart/" + itemId + ".png";
    }
    else if (item.type == "XpWeapon") {
        itemImg.src = "icons/LevelPart/" + itemId + ".png";
    }
    else if (item.type == "Material") {
        let matName = matLookup.map[itemId];

        if (parseInt(itemId) < 1000) {
            itemImg.src = "icons/Artifact/" + matName + ".png";
        }
        else {
            itemImg.src = "icons/SchoolMat/" + matName + ".png";
        }
    }
    else if (item.type == "Furniture") {
        itemImg.src = "icons/Furniture/" + itemId + ".png";
    }
    else if (item.type == "Eligma") {
        itemImg.src = "icons/Misc/Eligma.png";
    }
    else if (item.type == "Credit") {
        itemImg.src = "icons/Misc/Credit.png";
    }
    else if (item.type == "SecretTech") {
        itemImg.src = "icons/Misc/SecretTech.png";
    }
    else if (item.type == "Pyroxene") {
        itemImg.src = "icons/Misc/Pyroxene.png";
    }
    else if (item.type == "EventCurrency") {
        itemImg.src = "icons/EventIcon/CurrencyIcon/" + itemId + ".png";
    }
    else if (item.type == "Misc") {
        itemImg.src = "icons/MiscItem/" + itemId + ".png";
    }
}

function HarvestItemPurchases() {

    if (!shopPurchaseModified) {
        return;
    }

    let shopPurchases = {};
    let totalPurchaseCost = 0;

    let shop = event_config.events[current_event].shops[current_currency];

    let purchaseInputs = document.querySelectorAll('.shop-item-input-container input');

    for (let i = 0; i < purchaseInputs.length; i++) {

        let itemId = purchaseInputs[i].id.substring(6);

        shopPurchases[itemId] = purchaseInputs[i].value ?? 0;

        totalPurchaseCost += shopPurchases[itemId] * shop[i].cost;

    }

    event_data.shop_purchases[current_currency] = shopPurchases;

    currencyNeededPre[current_currency] = totalPurchaseCost;

    let currencySource = event_config.events[current_event].currencies[current_currency].source;
    if (currencySource == "StageDrop") {
        currencyNeeded[current_currency] = currencyNeededPre[current_currency] - initialClearRewards[current_currency];
    }
    else if (currencySource == "BoxPull") {
        let boxPullCurrency = event_config.events[current_event].currencies[current_currency].pull_currency;

        let pullCurrencyNeeded = CalculateBoxCurrencyNeeded(totalPurchaseCost);

        currencyNeeded[boxPullCurrency] = pullCurrencyNeeded - initialClearRewards[boxPullCurrency];
        currencyNeededPre[boxPullCurrency] = pullCurrencyNeeded;
    }

    event_data.currency_needed = currencyNeededPre;

    document.getElementById('currency-label-' + current_currency).innerText = totalPurchaseCost;

    saveTime = Date.now() + (1000 * 5);

    RefreshDropsDisplay();
}

function CalculateInitalClear() {

    initialClearRewards = {};
    initialClearCost = 0;

    let stages = event_config.events[current_event].stages;

    for (let i = 0; i < stages.length; i++) {

        if (stages[i].initial) {

            let rewards = Object.keys(stages[i].initial);

            rewards.forEach((item) => {

                if (!initialClearRewards[item]) {
                    initialClearRewards[item] = 0;
                }

                initialClearRewards[item] += stages[i].initial[item];
                if (stages[i].drops && stages[i].drops[item]) {
                    initialClearRewards[item] += stages[i].drops[item];
                }
            })
        }

        initialClearCost += stages[i].cost;
    }

}

function CalculateNeededFinal() {

    let currencies = Object.keys(currencyNeededPre);

    for (let i = 0; i < currencies.length; i++) {

        if (initialClearRewards[currencies[i]]) {
            currencyNeeded[currencies[i]] = Math.max(currencyNeededPre[currencies[i]] - initialClearRewards[currencies[i]], 0);
        }
    }

    event_point_target = Math.max(event_point_target - initialClearRewards["Event_Point"], 0);

}

function GenerateStagesTable() {

    let existingTable = document.getElementById('stages-table');
    if (existingTable) {
        existingTable.remove();
    }

    let stages = event_config.events[current_event].stages;

    let tableContainer = document.getElementById('stages-table-container');

    let table = document.createElement('table');
    table.id = 'stages-table';
    let tableHead = document.createElement('thead');
    let tableBody = document.createElement('tbody');

    let tableHeadRow = document.createElement('tr');

    CreateTableRowCells(tableHeadRow, ["Quest", "Energy", "Runs", "Drops"], 'th');

    tableHead.appendChild(tableHeadRow);

    for (let i = 0; i < stages.length; i++) {

        let stage = stages[i];

        if (stage.type == "Quest") {

            let tableRow = document.createElement('tr');

            if (i % 2 == 1) {
                tableRow.className = "alternate-row";
            }

            CreateTableRowCells(tableRow, [("Q" + stage.number), CreateEnergyDiv(stage.cost), CreateRunsDiv(stage.number), CreateDropsDiv(stage.drops)], 'td');

            tableBody.appendChild(tableRow);
        }
    }

    table.appendChild(tableHead);
    table.appendChild(tableBody);

    tableContainer.appendChild(table);

    let currenciesContainer = document.getElementById("initial-clear-display-container");

    while (currenciesContainer.children.length > 0) {
        currenciesContainer.children[0].remove();
    }

    currenciesContainer.appendChild(CreateRewardItem("icons/EventIcon/EnergyIcon/EnergyPadded.png", initialClearCost, ""));

    let currencyNames = Object.keys(initialClearRewards);

    currencyNames.forEach((name) => {

        currenciesContainer.appendChild(CreateRewardItem("icons/EventIcon/CurrencyIcon/" + name + ".png", initialClearRewards[name], ""));
    })
}

function CreateTableRowCells(row, cells, cellType) {

    cells.forEach((item) => {

        let tableCell;
        if (cellType == 'th') {
            tableCell = document.createElement('th');
        }
        else if (cellType == 'td') {
            tableCell = document.createElement('td');
        }

        if (typeof (item) == "string" || typeof (item) == "number") {
            tableCell.innerText = item;
        }
        else if (typeof (item) == "object" && item.nodeName == "DIV") {
            tableCell.appendChild(item);
        }

        row.appendChild(tableCell);
    })
}

function CreateEnergyDiv(cost) {

    let energyDiv = document.createElement('div');
    let energyImg = document.createElement('img');
    let energyP = document.createElement('p');

    energyDiv.className = "stage-quest-energy";

    energyImg.src = "icons/Misc/Energy.png";

    energyP.innerText = cost;

    energyDiv.appendChild(energyImg);
    energyDiv.appendChild(energyP);

    return energyDiv;
}

function CreateDropsDiv(drops) {

    let currencies = event_config.events[current_event].currencies;
    let currencyNames = Object.keys(currencies);

    let dropsDiv = document.createElement('div');
    dropsDiv.className = 'stages-table-drops-container';

    let dropNames = Object.keys(drops);

    dropNames.forEach((drop) => {

        let dropDiv = document.createElement('div');
        let dropImg = document.createElement('img');
        let dropP = document.createElement('p');

        let matId = matLookup.reverseMap[drop];

        if (currencyNames.includes(drop)) {

            dropImg.src = "icons/EventIcon/CurrencyIcon/" + currencies[drop].icon;

            let adjustedDrop = Math.ceil((drops[drop] + (drops[drop] * (currencyBonuses[drop] ?? 0))).toFixed(5));

            dropP.innerText = adjustedDrop;
        }
        else if (matId) {

            if (parseInt(matId) < 1000) {
                dropImg.src = "icons/Artifact/" + drop + ".png";
            }
            else {
                dropImg.src = "icons/SchoolMat/" + drop + ".png";
            }

            dropP.innerText = (drops[drop] * 100) + "%";

            dropDiv.classList.add('drop-resource-rarity-' + drop.slice(-1));
            dropDiv.classList.add('drop-resource');
        }

        dropDiv.appendChild(dropImg);
        dropDiv.appendChild(dropP);
        dropsDiv.appendChild(dropDiv);
    })

    return dropsDiv;
}

function CreateRunsDiv(stage) {

    let runDiv = document.createElement('div');
    runDiv.className = "stage-runs-div";

    let runInput = document.createElement('input');
    runInput.id = "input-stage-" + stage;
    runInput.type = "number";
    runInput.min = 0;
    runInput.max = 2000; //TEMP
    if (optimisationType != "Manual") {
        runInput.disabled = true;
    }

    if (stage_runs[stage]) {
        runInput.value = stage_runs[stage];
    }
    else {
        runInput.value = "";
    }

    runInput.addEventListener('input', (event) => {
        validateBasic(event.currentTarget.id);
    });

    runInput.addEventListener('beforeinput', (event) => {
        preInput = event.target.value;
    });

    runInput.addEventListener('focusout', (event) => {
        let validation = validateBasic(event.currentTarget.id);

        if (validation == "validated") {
            HarvestStageRuns();
        }

        preInput = '';
    });

    runDiv.appendChild(runInput);

    return runDiv;
}

function GetStagesLinearModelVariables() {

    let currencies = event_config.events[current_event].currencies;
    let currencyNames = Object.keys(currencies);
    let stages = event_config.events[current_event].stages;

    let modelVariables = {};

    for (let i = 0; i < stages.length; i++) {

        let stage = stages[i];

        if (stage.type == "Quest") {

            modelVariables[stage.number] = {};
            Object.assign(modelVariables[stage.number], stage.drops);

            let drops = Object.keys(stage.drops);

            drops.forEach((drop) => {

                if (currencyNames.includes(drop)) {

                    modelVariables[stage.number][drop] = Math.ceil((stage.drops[drop] + (stage.drops[drop] * (currencyBonuses[drop] ?? 0))).toFixed(5));
                }
            })

            modelVariables[stages[i].number].Energy_Cost = stages[i].cost;
        }
    }

    return modelVariables;
}

function GetStagesLinearModel(optimise, opType, energyConstrained) {

    let model = {};
    model.optimize = optimise;
    if (opType) {
        model.opType = opType;
    }
    model.variables = GetStagesLinearModelVariables();
    model.constraints = {};

    let currencyNames = Object.keys(currencyNeeded);

    currencyNames.forEach((name) => {
        if (optimise != name) {
            model.constraints[name] = { "min": currencyNeeded[name] };
        }
    })

    if (energyConstrained) {
        model.constraints["Energy_Cost"] = { "max": energyAvailable };
    }

    if (event_point_target && optimise != "Event_Point") {
        model.constraints["Event_Point"] = { "min": event_point_target };
    }

    return model;
}

function SetOptimise(optimisation) {

    if (optimisation == optimisationType) {
        return;
    }

    let tabs = document.getElementsByClassName('optimise-approach-button');

    for (let i = 0; i < tabs.length; i++) {
        if (tabs[i].id == "tab-opti-" + optimisation) {
            tabs[i].classList.add('selected')
        }
        else {
            tabs[i].classList.remove('selected')
        }
    }

    let optContainer = document.getElementById('optimisation-settings-container');

    while (optContainer.children.length > 0) {
        optContainer.children[0].remove();
    }

    ClearRewards();

    stage_runs = {};
    targetedMaterials = {};
    event_data["optimisation_options"] = null;

    if (optimisation == "Shop") {

        optimisationType = "Shop";

        if (!eventLoading) {
            RefreshDropsDisplay();
            saveTime = Date.now() + (1000 * 5);
        }

    }
    else if (optimisation == "Materials") {

        optimisationType = "Materials";

        GenerateMaterialSelections();
    }
    else if (optimisation == "Currency") {

        optimisationType = "Currency";

        ShowCurrencyTargets();
    }
    else if (optimisation == "Manual") {

        optimisationType = "Manual";
        document.getElementById('tab-Stages').click();
        RefreshDropsDisplay();
    }

    event_data["optimisation_type"] = optimisationType;

    UpdateNotifications();
}

function GetMatDropOptions() {

    let currencies = event_config.events[current_event].currencies;
    let currencyNames = Object.keys(currencies);
    let stages = event_config.events[current_event].stages;

    let matDrops = [];

    for (let i = 0; i < stages.length; i++) {

        let stage = stages[i];

        if (stage.type == "Quest") {

            let drops = Object.keys(stage.drops);

            drops.forEach((drop) => {

                if (!currencyNames.includes(drop) && !matDrops.includes(drop)) {

                    matDrops.push(drop);
                }
            })
        }
    }

    matDrops.sort();

    return matDrops;

}

function GenerateMaterialSelections() {

    let optContainer = document.getElementById('optimisation-settings-container');

    let infoText = document.createElement('p');
    infoText.innerText = "Click artifacts to toggle";
    infoText.id = "artifact-toggle-info"
    optContainer.appendChild(infoText);

    let matDrops = GetMatDropOptions();

    let currentMatType = matDrops[0].slice(0, -2);
    let currentMatsContainer = document.createElement('div');
    currentMatsContainer.className = "justify-content-center";
    optContainer.appendChild(currentMatsContainer);

    let dropSliced = "", dropRarity = "";

    matDrops.forEach((drop) => {

        let matDiv = document.createElement('div');
        matDiv.id = "opt-select-" + drop;

        let matImg = document.createElement('img');

        let matId = matLookup.reverseMap[drop];

        if (matId && matId < 1000) {
            matImg.src = "icons/Artifact/" + drop + ".png";
            dropSliced = drop.slice(0, -2);
            dropRarity = drop.slice(-1);
        }
        else {
            matImg.src = "icons/SchoolMat/" + drop + ".png";
            dropSliced = drop.slice(5);
            dropRarity = drop.slice(3, 4);
        }

        if (dropSliced != currentMatType) {

            currentMatsContainer = document.createElement('div');
            currentMatsContainer.className = "justify-content-center";
            optContainer.appendChild(currentMatsContainer);

            currentMatType = dropSliced;
        }

        matDiv.appendChild(matImg);

        matDiv.classList.add('drop-resource-rarity-' + dropRarity);
        matDiv.classList.add('drop-resource');

        matDiv.addEventListener('click', (event) => {

            ToggleTargetMat(event.currentTarget.id);
        })

        currentMatsContainer.appendChild(matDiv);

    })
}

function ToggleTargetMat(divId) {

    let matName = divId.slice(11);

    if (targetedMaterials[matName]) {
        targetedMaterials[matName] = false;
        document.getElementById(divId).classList.remove('selected');
    }
    else {
        targetedMaterials[matName] = true;
        document.getElementById(divId).classList.add('selected');
    }

    event_data["optimisation_options"] = targetedMaterials;

    if (!eventLoading) {
        RefreshDropsDisplay();
        saveTime = Date.now() + (1000 * 5);
    }
}

function GetStagesMaterialsTargetModel() {

    let materials = Object.keys(targetedMaterials);
    let optimise = {};

    materials.forEach((mat) => {

        if (targetedMaterials[mat]) {

            optimise[mat] = "max"
        }
    });

    return GetStagesLinearModel(optimise, "", true);
}

function RefreshDropsDisplay() {

    if (optimisationType == "Shop") {

        let model = GetStagesLinearModel("Energy_Cost", "min", false);

        CalculateStageDrops(solver.Solve(model), false);
    }
    else if (optimisationType == "Materials") {

        let model = GetStagesMaterialsTargetModel();

        if (Object.keys(model.optimize).length != 0) {
            CalculateStageDrops(solver.Solve(model), false);
        }
        else {
            ClearRewards();
        }
    }
    else if (optimisationType == "Currency") {

        if (!targetedCurrency) {
            return;
        }

        let model = GetStagesLinearModel(targetedCurrency, "max", true);
        CalculateStageDrops(solver.Solve(model), false);
    }
    else if (optimisationType == "Manual") {

        CalculateStageDrops(stage_runs, true);
    }

}

function CalculateStageDrops(result, ignoreRequirement) {

    failureReason = "";

    let feasible = true;

    let stages = event_config.events[current_event].stages;
    let questStages = [];

    stages.forEach((stage) => {

        if (stage.type == 'Quest') {
            questStages.push(stage);
        }
    })

    if (result.midpoint) {
        result = result.midpoint;
    }

    let totalCurrencies = {};
    let totalArtifacts = {};
    let totalSchoolMats = {};
    let totalEleph = {};
    let totalXps = {};
    let totalEligma = 0;
    let totalCredit = 0;
    let totalSecretTech = 0;
    let energyCost = 0;

    let stageRuns = {};
    let stagesRun = Object.keys(result);

    for (let i = 0; i < stagesRun.length; i++) {

        if (["feasible", "result", "bounded"].includes(stagesRun[i])) {
            continue;
        }

        if (result[stagesRun[i]] <= -1) {
            feasible = false;
            break;
        }
        else if (result[stagesRun[i]] <= 0.01) {
            continue;
        }

        let runs = Math.ceil(result[stagesRun[i]]);
        stageRuns[stagesRun[i]] = runs;

        let drops = questStages[stagesRun[i] - 1].drops;
        let dropNames = Object.keys(drops);

        dropNames.forEach((drop) => {

            if (currencyBonuses[drop] || currencyBonuses[drop] == 0) {
                if (!totalCurrencies[drop]) {
                    totalCurrencies[drop] = 0;
                }

                totalCurrencies[drop] += runs * Math.ceil(drops[drop] + (drops[drop] * (currencyBonuses[drop] ?? 0))).toFixed(5);
            }
            else {
                if (!totalArtifacts[drop]) {
                    totalArtifacts[drop] = 0;
                }

                totalArtifacts[drop] += runs * drops[drop];
            }
        })

        energyCost += questStages[stagesRun[i] - 1].cost * runs;
    }

    let neededCurrencies = Object.keys(currencyNeeded);

    if (!ignoreRequirement) {

        for (let i = 0; i < neededCurrencies.length; i++) {

            if (totalCurrencies[neededCurrencies[i]] < currencyNeeded[neededCurrencies[i]]) {
                feasible = false;
            }
        }

        if (totalCurrencies["Event_Point"] < event_point_target) {
            feasible = false;
        }

    }

    if (energyCost > (energyAvailable + 100)) { //TEMP
        feasible = false;
    }

    energyCost += initialClearCost;

    if (displayIncluded['ShopPurchases']) {
        let intResults = AddShopPurchases(totalArtifacts, totalSchoolMats, totalEleph, totalXps, 0, 0, 0);
        if (intResults) {
            totalCredit += intResults[0];
            totalEligma += intResults[1];
            totalSecretTech += intResults[2];
        }
    }

    if (displayIncluded['LessonRewards']) {

        let intResults = AddLessonRewards(totalArtifacts, totalSchoolMats, totalEleph, totalXps, 0, 0, 0);
        if (intResults) {
            totalEligma += intResults[0];
        }
    }

    for (let i = 0; i < neededCurrencies.length; i++) {

        if (initialClearRewards[neededCurrencies[i]]) {

            if (!totalCurrencies[neededCurrencies[i]]) {
                totalCurrencies[neededCurrencies[i]] = 0;
            }

            totalCurrencies[neededCurrencies[i]] += initialClearRewards[neededCurrencies[i]];
        }
    }

    if (displayIncluded['BoxRewards']) {

        let pullCurrency;
        let currencyNames = Object.keys(event_config.events[current_event].currencies);
        let currencies = event_config.events[current_event].currencies;

        for (let i = 0; i < currencyNames.length; i++) {

            if (currencies[currencyNames[i]].source == "BoxPull") {

                pullCurrency = currencies[currencyNames[i]].pull_currency;
            }
        }

        let results = AddBoxRewards(totalCurrencies[pullCurrency], totalArtifacts, totalSchoolMats, totalEleph, totalXps);
        if (results) {
            totalCredit += results[0];
            totalEligma += results[1];
            totalSecretTech += results[2];
            totalCurrencies[results[4]] = results[3];
        }
    }
    else {
        document.getElementById('box-info-text').innerText = '';
    }

    if (initialClearRewards["Event_Point"]) {
        if (!totalCurrencies["Event_Point"]) {
            totalCurrencies["Event_Point"] = 0;
        }

        totalCurrencies["Event_Point"] += initialClearRewards["Event_Point"];
        maxEventPoints = totalCurrencies["Event_Point"];
    }

    if (displayIncluded['PointRewards']) {

        let intResults = AddPointRewards(maxEventPoints, totalEleph, totalXps, 0, 0, 0);
        if (intResults) {
            totalCredit += intResults[0];
            totalEligma += intResults[1];
            totalSecretTech += intResults[2];
        }
    }

    if (event_config.events[current_event].lessons) {
        document.getElementById("notification-lessons").style.display = 'none';
        let remainingEventPoints = maxEventPoints - GetUsedLessonPoints();
        if (remainingEventPoints < 0) {
            failureReason = "The number of Event Points used on lessons is too high, please reduce lesson runs until remaining points are not negative";
            feasible = false;
        }
        else if (remainingEventPoints > event_config.events[current_event].lessons_template.lesson_cost) {
            document.getElementById("notification-lessons").style.display = '';
        }
    }

    if (feasible) {
        UpdateRewardsObtained(totalCurrencies, energyCost, totalArtifacts, totalSchoolMats, totalEleph, totalXps,
            totalCredit, totalEligma, totalSecretTech);
        stage_runs = stageRuns;
    }
    else {
        ClearRewards();
        InfeasibleModel();
        if (!ignoreRequirement) {
            stage_runs = {};
        }
    }

}

function AddShopPurchases(totalArtifacts, totalSchoolMats, totalEleph, totalXps, totalCredit, totalEligma, totalSecretTech) {

    let shops = Object.keys(event_data.shop_purchases);

    for (let i = 0; i < shops.length; i++) {

        let shop = event_data.shop_purchases[shops[i]];

        let items = Object.keys(shop);

        for (let ii = 0; ii < items.length; ii++) {

            let itemNum = parseInt(items[ii]);

            if (itemNum) {

                if (itemNum < 1000) {

                    let matName = matLookup.get(itemNum);

                    if (!totalArtifacts[matName]) {
                        totalArtifacts[matName] = 0;
                    }

                    totalArtifacts[matName] += parseInt(shop[items[ii]]);
                }
                else if (itemNum < 5000) {

                    let matName = matLookup.get(itemNum);

                    if (!totalSchoolMats[matName]) {
                        totalSchoolMats[matName] = 0;
                    }

                    totalSchoolMats[matName] += parseInt(shop[items[ii]]);
                }
                else if (itemNum >= 10000 && itemNum < 30000) {

                    if (!totalEleph[items[ii]]) {
                        totalEleph[items[ii]] = 0;
                    }

                    totalEleph[items[ii]] += (parseInt(shop[items[ii]]));

                }
            }
            else if (items[ii].includes('-')) {

                if (items[ii].includes('Credit')) {
                    totalCredit += parseInt(items[ii].substring(items[ii].indexOf('-') + 1)) * parseInt(shop[items[ii]]);
                }
                else if (items[ii].includes('Eligma')) {
                    totalEligma += parseInt(items[ii].substring(items[ii].indexOf('-') + 1)) * parseInt(shop[items[ii]]);
                }
            }
            else if (items[ii] == "SecretTech") {
                totalSecretTech += parseInt(shop[items[ii]]);
            }
            else if (items[ii].includes('XP_') && items[ii].length <= 5) {

                if (!totalXps[items[ii]]) {
                    totalXps[items[ii]] = 0;
                }

                totalXps[items[ii]] += parseInt(shop[items[ii]]);
            }
            else if (items[ii].substring(0, 7) == "Needle_") {

                if (!totalXps[items[ii]]) {
                    totalXps[items[ii]] = 0;
                }

                totalXps[items[ii]] += parseInt(shop[items[ii]]);
            }
        }
    }

    return [totalCredit, totalEligma, totalSecretTech];
}

function AddPointRewards(pointTarget, totalEleph, totalXps, totalCredit, totalEligma, totalSecretTech) {

    let pointTiers = event_config.events[current_event].point_rewards;

    if (!pointTiers) {
        return;
    }

    for (let i = 0; i < pointTiers.length; i++) {

        let pTier = pointTiers[i];

        if (pTier.points > pointTarget) {
            break;
        }

        if (pTier.type == "XpReport" || pTier.type == "XpOrb") {

            if (!totalXps[pTier.id]) {
                totalXps[pTier.id] = 0;
            }

            totalXps[pTier.id] += pTier.count;
        }
        else if (pTier.type == "Eligma") {
            totalEligma += pTier.count;
        }
        else if (pTier.type == "Credit") {
            totalCredit += pTier.count;
        }
        else if (pTier.type == "SecretTech") {
            totalSecretTech += pTier.count;
        }
        else if (pTier.type == "Eleph") {

            if (!totalEleph[pTier.id]) {
                totalEleph[pTier.id] = 0;
            }

            totalEleph[pTier.id] += (pTier.count);
        }
    }

    return [totalCredit, totalEligma, totalSecretTech];
}

function AddBoxRewards(pullCurrency, totalArtifacts, totalSchoolMats, totalEleph, totalXps) {

    if (!pullCurrency) {
        return;
    }

    let totalCredit = 0, totalEligma = 0, totalSecretTech = 0;

    let boxClearCost = event_config.events[current_event].box_clear_cost;

    let boxClears = Math.floor(pullCurrency / boxClearCost);
    let leftoverBoxPercent = ((pullCurrency - boxClears * boxClearCost) / boxClearCost * 100).toFixed(0);

    if (leftoverBoxPercent) {
        document.getElementById('box-info-text').innerText = boxClears + " boxes cleared (displayed), and enough currency for " + leftoverBoxPercent + "% of a box (not displayed)";
    }

    let boxCycleSets = event_config.events[current_event].boxes;
    let boxSelect = {};

    for (let i = 0; i < boxCycleSets.length; i++) {

        for (let ii = 0; ii < boxCycleSets[i].cycle.length; ii++) {

            boxSelect[boxCycleSets[i].cycle[ii]] = i;
        }
    }

    let infiniteBox = boxSelect[Object.keys(boxSelect).length];

    let cycle = 0;
    let boxCurrencyObtained = 0;
    let boxCurrencyName = "";

    while (cycle < boxClears) {

        cycle++;

        let boxRewards;
        if (boxSelect[cycle] != undefined) {
            boxRewards = boxCycleSets[boxSelect[cycle]].rewards;
        }
        else {
            boxRewards = boxCycleSets[infiniteBox].rewards;
        }

        for (let i = 0; i < boxRewards.length; i++) {

            if (boxRewards[i].type == "XpReport" || boxRewards[i].type == "XpOrb") {

                if (!totalXps[boxRewards[i].id]) {
                    totalXps[boxRewards[i].id] = 0;
                }

                totalXps[boxRewards[i].id] += boxRewards[i].count;
            }
            else if (boxRewards[i].type == "Eligma") {
                totalEligma += boxRewards[i].count;
            }
            else if (boxRewards[i].type == "Credit") {
                totalCredit += (boxRewards[i].count * boxRewards[i].amount);
            }
            else if (boxRewards[i].type == "SecretTech") {
                totalSecretTech += boxRewards[i].count;
            }
            else if (boxRewards[i].type == "Material") {

                let itemNum = parseInt(boxRewards[i].id);

                if (itemNum < 1000) {

                    let matName = matLookup.get(itemNum);

                    if (!totalArtifacts[matName]) {
                        totalArtifacts[matName] = 0;
                    }

                    totalArtifacts[matName] += boxRewards[i].count;
                }
                else if (itemNum < 5000) {

                    let matName = matLookup.get(itemNum);

                    if (!totalSchoolMats[matName]) {
                        totalSchoolMats[matName] = 0;
                    }

                    totalSchoolMats[matName] += boxRewards[i].count;
                }
            }
            else if (boxRewards[i].type == "Eleph") {

                if (!totalEleph[boxRewards[i].id]) {
                    totalEleph[boxRewards[i].id] = 0;
                }

                totalEleph[boxRewards[i].id] += (boxRewards[i].amount * boxRewards[i].count);
            }
            else if (boxRewards[i].type == "EventCurrency") {

                if (!boxCurrencyName) {
                    boxCurrencyName = boxRewards[i].id;
                }

                boxCurrencyObtained += (boxRewards[i].amount * boxRewards[i].count);
            }
        }
    }

    return [totalCredit, totalEligma, totalSecretTech, boxCurrencyObtained, boxCurrencyName];
}

function AddLessonRewards(totalArtifacts, totalSchoolMats, totalEleph, totalXps, totalCredit, totalEligma, totalSecretTech) {

    if (!event_config.events[current_event].lessons) {
        return;
    }

    let rankUpgrades = event_config.events[current_event].lessons_template.rank_upgrades;
    let levelUnlocks = event_config.events[current_event].lessons_template.level_unlocks;
    let lessonCost = event_config.events[current_event].lessons_template.lesson_cost;

    for (let i = 0; i < lessonPreRuns.length; i++) {

        let currencySpent = lessonCost * i;

        let currentRank = 1;
        for (let ii = 0; ii < rankUpgrades.length; ii++) {

            if (rankUpgrades[ii] > currencySpent) {
                break;
            }
            else {
                currentRank = ii + 2;
            }
        }

        let currentLevel = 1;
        for (let ii = 0; ii < levelUnlocks.length; ii++) {

            if (levelUnlocks[ii] > currentRank) {
                break;
            }
            else {
                currentLevel = ii + 1;
            }
        }

        let lessonRewardTemplate = event_config.events[current_event].lessons_template.rewards[currentLevel - 1];

        for (let ii = 0; ii < lessonRewardTemplate.length; ii++) {

            let itemAmountAdded = 0;
            if (lessonRewardTemplate[ii].chance) {
                itemAmountAdded += lessonRewardTemplate[ii].chance;
            }
            else if (lessonRewardTemplate[ii].count) {
                itemAmountAdded += lessonRewardTemplate[ii].count;
            }

            let itemId = lessonRewardTemplate[ii].id;

            if (lessonRewardTemplate[ii].type == "XpReport" || lessonRewardTemplate[ii].type == "XpOrb") { }
            else if (lessonRewardTemplate[ii].type == "Eligma") {
                totalEligma += itemAmountAdded;
            }
            else if (lessonRewardTemplate[ii].type == "Credit") { }
            else if (lessonRewardTemplate[ii].type == "SecretTech") { }
            else if (lessonRewardTemplate[ii].type == "Material") {

                let itemNum = parseInt(event_config.events[current_event].lessons[lessonPreRuns[i]].id_swap[itemId]);

                if (itemNum < 1000) {

                    let matName = matLookup.get(itemNum);

                    if (!totalArtifacts[matName]) {
                        totalArtifacts[matName] = 0;
                    }

                    totalArtifacts[matName] += itemAmountAdded;
                }
                else if (itemNum < 5000) {

                    let matName = matLookup.get(itemNum);

                    if (!totalSchoolMats[matName]) {
                        totalSchoolMats[matName] = 0;
                    }

                    totalSchoolMats[matName] += itemAmountAdded;
                }
            }
            else if (lessonRewardTemplate[ii].type == "Eleph") {

                if (!totalEleph[itemId]) {
                    totalEleph[itemId] = 0;
                }

                totalEleph[itemId] += itemAmountAdded;
            }
        }
    }

    let lessonRunKeys = Object.keys(lessonPostRuns);

    for (let i = 0; i < lessonRunKeys.length; i++) {

        if (lessonPostRuns[lessonRunKeys[i]] == '0') {
            continue;
        }

        let lessonRewardTemplate = event_config.events[current_event].lessons_template.rewards[4];

        for (let ii = 0; ii < lessonRewardTemplate.length; ii++) {

            let itemAmountAdded = 0;
            if (lessonRewardTemplate[ii].chance) {
                itemAmountAdded += lessonRewardTemplate[ii].chance * lessonPostRuns[lessonRunKeys[i]];
            }
            else if (lessonRewardTemplate[ii].count) {
                itemAmountAdded += lessonRewardTemplate[ii].count * lessonPostRuns[lessonRunKeys[i]];
            }

            let itemId = lessonRewardTemplate[ii].id;

            if (lessonRewardTemplate[ii].type == "XpReport" || lessonRewardTemplate[ii].type == "XpOrb") { }
            else if (lessonRewardTemplate[ii].type == "Eligma") {
                totalEligma += itemAmountAdded;
            }
            else if (lessonRewardTemplate[ii].type == "Credit") { }
            else if (lessonRewardTemplate[ii].type == "SecretTech") { }
            else if (lessonRewardTemplate[ii].type == "Material") {

                let itemNum = parseInt(event_config.events[current_event].lessons[lessonRunKeys[i]].id_swap[itemId]);

                if (itemNum < 1000) {

                    let matName = matLookup.get(itemNum);

                    if (!totalArtifacts[matName]) {
                        totalArtifacts[matName] = 0;
                    }

                    totalArtifacts[matName] += itemAmountAdded;
                }
                else if (itemNum < 5000) {

                    let matName = matLookup.get(itemNum);

                    if (!totalSchoolMats[matName]) {
                        totalSchoolMats[matName] = 0;
                    }

                    totalSchoolMats[matName] += itemAmountAdded;
                }
            }
            else if (lessonRewardTemplate[ii].type == "Eleph") {

                if (!totalEleph[itemId]) {
                    totalEleph[itemId] = 0;
                }

                totalEleph[itemId] += itemAmountAdded;
            }
        }
    }

    return [totalEligma];
}

function DisplayOptionClicked(option) {

    if (displayIncluded[option]) {
        displayIncluded[option] = false;
    }
    else {
        displayIncluded[option] = true;
    }

    RefreshDropsDisplay();
}

function ClearRewards() {

    let rewardsContainer = document.getElementById('rewards-container');

    while (rewardsContainer.children.length > 0) {
        rewardsContainer.children[0].remove();
    }
}

function UpdateRewardsObtained(totalCurrencies, energyCost, totalArtifacts, totalSchoolMats, totalEleph, totalXps, totalCredit, totalEligma, totalSecretTech) {

    ClearRewards();

    let rewardsContainer = document.getElementById('rewards-container');

    let currenciesContainer = document.createElement('div');
    currenciesContainer.className = "reward-group";
    let artifactsContainer = document.createElement('div');
    artifactsContainer.className = "reward-group";
    let schoolMatsContainer = document.createElement('div');
    schoolMatsContainer.className = "reward-group";
    let xpMatsContainer = document.createElement('div');
    xpMatsContainer.className = "reward-group";
    let miscContainer = document.createElement('div');
    miscContainer.className = "reward-group";
    let elephContainer = document.createElement('div');
    elephContainer.className = "reward-group";

    currenciesContainer.appendChild(CreateRewardItem("icons/EventIcon/EnergyIcon/EnergyPadded.png", energyCost, ""));

    let currencyNames = Object.keys(totalCurrencies);

    currencyNames.forEach((name) => {

        currenciesContainer.appendChild(CreateRewardItem("icons/EventIcon/CurrencyIcon/" + name + ".png", totalCurrencies[name], ""));
    })

    let dropSliced = "";
    let dropRarity = "";
    let currentMatType = "";
    let currentSubDiv;

    let artifactNames = Object.keys(totalArtifacts).sort().reverse();

    artifactNames.forEach((name) => {

        dropSliced = name.slice(0, -2);
        dropRarity = name.slice(-1);

        if (currentMatType != dropSliced) {
            currentSubDiv = document.createElement('div');
            currentSubDiv.className = "reward-group";
            artifactsContainer.appendChild(currentSubDiv);

            currentMatType = dropSliced;
        }

        currentSubDiv.appendChild(CreateRewardItem("icons/Artifact/" + name + ".png", totalArtifacts[name].toFixed(1),
            'drop-resource-rarity-' + dropRarity + ' drop-resource'));
    })

    currentMatType = "";

    let schoolMatNames = Object.keys(totalSchoolMats).sort().reverse();

    schoolMatNames.forEach((name) => {

        dropSliced = name.slice(5);
        dropRarity = name.slice(3, 4);

        if (currentMatType != dropSliced) {
            currentSubDiv = document.createElement('div');
            currentSubDiv.className = "reward-group";
            schoolMatsContainer.appendChild(currentSubDiv);

            currentMatType = dropSliced;
        }

        currentSubDiv.appendChild(CreateRewardItem("icons/SchoolMat/" + name + ".png", totalSchoolMats[name].toFixed(1), ''));
        //'drop-resource-rarity-' + dropRarity + ' drop-resource'));
    })

    let xpMatNames = Object.keys(totalXps).sort().reverse();

    xpMatNames.forEach((name) => {
        xpMatsContainer.appendChild(CreateRewardItem("icons/LevelPart/" + name + ".png", totalXps[name], ""))
    })

    if (totalEligma) {
        miscContainer.appendChild(CreateRewardItem("icons/Misc/Eligma.png", totalEligma.toFixed(1), ""));
    }
    if (totalSecretTech) {
        miscContainer.appendChild(CreateRewardItem("icons/Misc/SecretTech.png", totalSecretTech, ""));
    }
    if (totalCredit) {
        miscContainer.appendChild(CreateRewardItem("icons/Misc/Credit.png", totalCredit, ""));
    }

    let elephIds = Object.keys(totalEleph);

    elephIds.forEach((id) => {
        elephContainer.appendChild(CreateRewardItem("icons/Eleph/Eleph_" + id + ".png", totalEleph[id].toFixed(1), ""))
    })

    rewardsContainer.appendChild(currenciesContainer);
    rewardsContainer.appendChild(elephContainer);
    rewardsContainer.appendChild(miscContainer);
    rewardsContainer.appendChild(xpMatsContainer);
    rewardsContainer.appendChild(schoolMatsContainer);
    rewardsContainer.appendChild(artifactsContainer);
}

function CreateRewardItem(imgSrc, itemCount, divClass) {

    let itemDiv = document.createElement('div');
    if (divClass) {
        itemDiv.className = divClass;
    }

    let itemImg = document.createElement('img');
    let itemP = document.createElement('p');

    itemImg.src = imgSrc;

    let itmCount = commafy(itemCount);

    if (itmCount.slice(-2) == ".0") {
        itmCount = itmCount.slice(0, -2);
    }

    itemP.innerText = itmCount;

    itemDiv.appendChild(itemImg);
    itemDiv.appendChild(itemP);

    return itemDiv;
}

function ShowCurrencyTargets() {

    let currencyTargets = event_config.events[current_event].currency_targets;
    let currencies = event_config.events[current_event].currencies;

    let optContainer = document.getElementById('optimisation-settings-container');

    let currencyDivsContainer = document.createElement('div');
    currencyDivsContainer.id = "currency-divs-container";

    for (let i = 0; i < currencyTargets.length; i++) {

        let currencyDiv = document.createElement('div');
        currencyDiv.id = "currency-target-" + currencyTargets[i];
        currencyDiv.innerText = currencies[currencyTargets[i]].shortname;

        currencyDiv.addEventListener('click', (event) => {
            OptimiseCurrency(event.currentTarget.id);
        })

        currencyDivsContainer.appendChild(currencyDiv);
    }

    optContainer.appendChild(currencyDivsContainer);

    if (!eventLoading && currencyTargets.length == 1) {
        document.getElementById('currency-target-' + currencyTargets[0]).click();
    }
}

function OptimiseCurrency(divId) {

    if (targetedCurrency) {
        document.getElementById('currency-target-' + targetedCurrency).classList.remove('selected');
    }
    document.getElementById(divId).classList.add('selected');

    targetedCurrency = divId.substring(16);

    event_data["optimisation_options"] = targetedCurrency;

    if (!eventLoading) {
        RefreshDropsDisplay();
        saveTime = Date.now() + (1000 * 5);
    }
}

function HarvestStageRuns() {

    let stages = event_config.events[current_event].stages;

    stage_runs = {};

    for (let i = 0; i < stages.length; i++) {

        let stage = stages[i];

        if (stage.type == "Quest") {

            let runs = parseInt(document.getElementById('input-stage-' + stage.number).value);

            if (runs > 0) {
                stage_runs[stage.number] = runs;
            }
        }
    }

    event_data["optimisation_options"] = stage_runs;

    RefreshDropsDisplay();
    if (!eventLoading) {
        saveTime = Date.now() + (1000 * 5);
    }
}

function InfeasibleModel() {

    let failureDiv = document.createElement('div');
    failureDiv.style.marginLeft = '0.5em';

    if (!failureReason) {

        let model = GetStagesLinearModel("Energy_Cost", "min", false);

        let solvedModel = solver.Solve(model);

        let energyMin = 0;

        if (solvedModel.result) {

            energyMin = Math.ceil(solvedModel.result + Math.min(solvedModel.result * 0.01, 50));
            energyMin += initialClearCost;
        }

        failureDiv.innerText = "A minimum of about " + energyMin + " energy is needed for this to be feasible, please either add additional energy sources, reduce shop purchases or set bonus characters";
    }
    else {
        failureDiv.innerText = failureReason;
    }

    document.getElementById('rewards-container').appendChild(failureDiv);
}

function GeneratePointsTable() {

    let existingTableContainer = document.getElementById('points-table-container');
    while (existingTableContainer.children.length > 0) {
        existingTableContainer.children[0].remove();
    }

    let pointTiers = event_config.events[current_event].point_rewards;

    if (!pointTiers) {
        document.getElementById('tab-Points').style.display = 'none';
        document.getElementById('include-point-rewards').style.display = 'none';
        document.getElementById('label-point-rewards').style.display = 'none';
        return;
    }
    else {
        document.getElementById('tab-Points').style.display = '';
        document.getElementById('include-point-rewards').style.display = '';
        document.getElementById('label-point-rewards').style.display = '';
    }

    let tableWrapPoint = Math.floor(pointTiers.length / 3);

    let tableContainer = document.getElementById('points-table-container');

    let table1 = GetNewTable(["Points", "Rewards"]);
    let table1Body = table1.getElementsByTagName('tbody')[0];
    let table2 = GetNewTable(["Points", "Rewards"]);
    let table2Body = table2.getElementsByTagName('tbody')[0];
    let table3 = GetNewTable(["Points", "Rewards"]);
    let table3Body = table3.getElementsByTagName('tbody')[0];

    table1.style.borderCollapse = 'collapse';
    table2.style.borderCollapse = 'collapse';
    table3.style.borderCollapse = 'collapse';

    for (let i = 0; i < pointTiers.length; i++) {

        let pTier = pointTiers[i];

        let tableRow = document.createElement('tr');
        tableRow.id = "point-tier-" + pTier.points;
        tableRow.className = "point-tier-row";

        tableRow.addEventListener('click', (event) => {

            let pointTargetClicked = event.currentTarget.id.substring(11);

            event_data.point_target = pointTargetClicked;
            event_point_target = Math.max(pointTargetClicked - initialClearRewards["Event_Point"], 0);

            RefreshDropsDisplay();

            HighlightPointTiers(pointTargetClicked);

            saveTime = Date.now() + (1000 * 5);
        })

        CreateTableRowCells(tableRow, [pTier.points, CreatePointRewardDiv(pTier.type, pTier.id, pTier.count)], 'td');

        if (i < tableWrapPoint) {
            table1Body.appendChild(tableRow);
        }
        else if (i < (tableWrapPoint * 2)) {
            table2Body.appendChild(tableRow);
        }
        else {
            table3Body.appendChild(tableRow);
        }
    }

    tableContainer.appendChild(table1);
    tableContainer.appendChild(table2);
    tableContainer.appendChild(table3);

    if (event_data.point_target) {
        HighlightPointTiers(event_data.point_target);
    }
    else {
        HighlightPointTiers(event_config.events[current_event].event_point_target);
    }
}

function HighlightPointTiers(targetTier) {

    let tierRows = document.getElementsByClassName('point-tier-row');

    for (let i = 0; i < tierRows.length; i++) {

        if (parseInt(tierRows[i].id.substring(11)) <= targetTier) {
            tierRows[i].style.backgroundColor = 'rgb(255 0 252 / 21%)';
        }
        else if (parseInt(tierRows[i].id.substring(11)) <= maxEventPoints) {
            tierRows[i].style.backgroundColor = 'rgb(0 201 255 / 21%)';
        }
        else {
            tierRows[i].style.backgroundColor = '';
        }
    }
}

function GetNewTable(headers) {

    let table = document.createElement('table');
    let tableHead = document.createElement('thead');
    let tableBody = document.createElement('tbody');

    let tableHeadRow = document.createElement('tr');

    CreateTableRowCells(tableHeadRow, headers, 'th');

    tableHead.appendChild(tableHeadRow);

    table.appendChild(tableHead);
    table.appendChild(tableBody);

    return table;
}

function CreatePointRewardDiv(rewardType, rewardId, rewardCount) {

    let rewardDiv = document.createElement('div');
    rewardDiv.className = 'point-rewards-table-container';

    let dropDiv = document.createElement('div');
    let dropImg = document.createElement('img');
    let dropP = document.createElement('p');

    if (rewardType == "XpReport" || rewardType == "XpOrb") {
        dropImg.src = "icons/LevelPart/" + rewardId + ".png";
    }
    else if (rewardType == "Eligma") {
        dropImg.src = "icons/Misc/Eligma.png";
    }
    else if (rewardType == "Credit") {
        dropImg.src = "icons/Misc/Credit.png";
    }
    else if (rewardType == "SecretTech") {
        dropImg.src = "icons/Misc/SecretTech.png";
    }
    else if (rewardType == "Eleph") {
        dropImg.src = "icons/Eleph/Eleph_" + rewardId + ".png";
    }

    dropP.innerText = commafy(rewardCount);

    dropDiv.appendChild(dropImg);
    dropDiv.appendChild(dropP);
    rewardDiv.appendChild(dropDiv);

    return rewardDiv;
}

function GetUsedLessonPoints() {

    let postRuns = 0;
    let runNums = Object.keys(lessonPostRuns);

    for (let i = 0; i < runNums.length; i++) {
        postRuns += parseInt(lessonPostRuns[runNums[i]]);
    }

    let usedEventPoints = (lessonPreRuns.length + postRuns) * event_config.events[current_event].lessons_template.lesson_cost;
    //let remainingEventPoints = maxEventPoints - usedEventPoints;

    return usedEventPoints;
}

function GenerateLessonsTab() {

    let lessonsContainer = document.getElementById('lessons-container');

    while (lessonsContainer.children.length > 0) {
        lessonsContainer.children[0].remove();
    }

    if (!event_config.events[current_event].lessons) {
        document.getElementById('tab-Lessons').style.display = 'none';
        document.getElementById('tab-Lessons').classList.remove('selected');
        document.getElementById('Lessons-tab').style.display = '';
        document.getElementById('include-lesson-rewards').style.display = 'none';
        document.getElementById('label-lesson-rewards').style.display = 'none';
        return;
    }
    else {
        document.getElementById('tab-Lessons').style.display = '';
        document.getElementById('include-lesson-rewards').style.display = '';
        document.getElementById('label-lesson-rewards').style.display = '';
    }

    let usedEventPoints = GetUsedLessonPoints();
    let remainingEventPoints = maxEventPoints - usedEventPoints;
    document.getElementById('lesson-points-remaining').innerText = commafy(remainingEventPoints);

    let remainingLessons = Math.max(Math.floor(remainingEventPoints / event_config.events[current_event].lessons_template.lesson_cost), 0);

    let lessons = event_config.events[current_event].lessons;
    let lessonRewardTemplate = event_config.events[current_event].lessons_template.rewards;

    let results = GetLessonRanks();

    let lessonRank = results[0];
    let lessonLevel = results[1];
    let rankMaxed = results[2];

    if (!rankMaxed) {
        let rankupEventPoints = event_config.events[current_event].lessons_template.rank_upgrades[lessonRank - 1] - usedEventPoints;
        document.getElementById('lesson-points-rankup').innerText = commafy(rankupEventPoints);
        document.getElementById('lesson-points-rankup-container').style.display = '';
        document.getElementById('lesson-points-rankup-info').style.display = '';
    }
    else {
        document.getElementById('lesson-points-rankup-container').style.display = 'none';
        document.getElementById('lesson-points-rankup-info').style.display = 'none';
    }

    for (let i = 0; i < lessons.length; i++) {

        let lessonContainer = document.createElement('div');
        lessonContainer.className = "lesson-container";

        let lessonPsDiv = document.createElement('div');
        lessonPsDiv.className = "lesson-text";

        let lessonName = document.createElement('p');
        let lessonRuns = document.createElement('p');
        lessonRuns.id = "lesson-text-runs-" + i;

        lessonPsDiv.appendChild(lessonName);
        lessonPsDiv.appendChild(lessonRuns);

        let lessonRewardsContainer = document.createElement('div');

        lessonRewardsContainer.className = "lesson-rewards-container";

        let lessonNameText = "Lvl " + lessonLevel + ", " + lessons[i].name1;
        if (lessonRank >= lessons[i].unlock_2) {
            lessonNameText += " / " + lessons[i].name2;
        }

        lessonName.innerText = lessonNameText;

        for (let ii = 0; ii < lessonRewardTemplate[lessonLevel - 1].length; ii++) {
            lessonRewardsContainer.appendChild(CreateLessonRewardItem(lessonRewardTemplate[lessonLevel - 1][ii], i))
        }

        lessonContainer.appendChild(lessonPsDiv);
        lessonContainer.appendChild(lessonRewardsContainer);

        if (!rankMaxed && lessonRank >= lessons[i].unlock_rank) {

            let lessonButtonsDiv = document.createElement('div');
            lessonButtonsDiv.className = "lesson-buttons-container";

            let lessonButton = document.createElement('button');
            lessonButton.innerText = '+';
            lessonButton.addEventListener('click', () => {
                LessonButtonClicked(Math.round(i), false);
            })

            let lessonMaxButton = document.createElement('button');
            lessonMaxButton.innerText = 'M';
            lessonMaxButton.addEventListener('click', () => {
                LessonButtonClicked(Math.round(i), true);
            })

            lessonButtonsDiv.appendChild(lessonButton);
            lessonButtonsDiv.appendChild(lessonMaxButton);

            lessonContainer.appendChild(lessonButtonsDiv);
        }
        else if (rankMaxed) {

            let inputDiv = document.createElement('div');
            inputDiv.className = "lesson-input-container";

            let lessonInput = document.createElement('input');
            lessonInput.id = "lesson-runs-input-" + i;
            lessonInput.className = "lesson-runs-input";
            lessonInput.type = "number";
            lessonInput.min = 0;

            let inputMax;

            if (lessonPostRuns[i]) {
                lessonInput.value = parseInt(lessonPostRuns[i]);
                inputMax = remainingLessons + parseInt(lessonPostRuns[i]);
            }
            else {
                lessonInput.value = 0;
                inputMax = remainingLessons;
            }

            lessonInput.max = inputMax;

            lessonInput.addEventListener('input', (event) => {
                validateBasic(event.currentTarget.id);
            });

            lessonInput.addEventListener('beforeinput', (event) => {
                preInput = event.target.value;
            });

            lessonInput.addEventListener('focusout', (event) => {
                let validation = validateBasic(event.currentTarget.id);

                let lPostRuns = lessonPostRuns[event.currentTarget.id.substring(18)];
                let lInputRun = document.getElementById(event.currentTarget.id).value;
                if (lInputRun == '') {
                    lInputRun = '0'
                }

                if (validation == "validated" && lPostRuns != lInputRun && !(lPostRuns == undefined && lInputRun == '0')) {

                    lessonPostRuns[event.currentTarget.id.substring(18)] = lInputRun;
                    event_data.lesson_post_runs = lessonPostRuns;

                    saveTime = Date.now() + (1000 * 5);

                    GenerateLessonsTab();
                }

                preInput = '';
            });

            let lessonInputLabel = document.createElement('p');
            lessonInputLabel.innerText = " / " + inputMax;

            inputDiv.appendChild(lessonInput);
            inputDiv.appendChild(lessonInputLabel);

            lessonContainer.appendChild(inputDiv);
        }

        lessonsContainer.appendChild(lessonContainer);
    }

    let lessonRunStrings = {};
    for (let i = 0; i < lessonPreRuns.length; i++) {

        if (!lessonRunStrings[lessonPreRuns[i]]) {
            lessonRunStrings[lessonPreRuns[i]] = (i + 1).toString();
        }
        else {
            lessonRunStrings[lessonPreRuns[i]] += " " + (i + 1);
        }
    }

    let lessonNums = Object.keys(lessonRunStrings);
    lessonNums.forEach((lessonNum) => {
        document.getElementById('lesson-text-runs-' + lessonNum).innerText = lessonRunStrings[lessonNum];
    })

    if (!eventLoading) {
        RefreshDropsDisplay();
    }
}

function LessonButtonClicked(lessonNum, max) {

    let usedEventPoints = GetUsedLessonPoints();
    let remainingEventPoints = maxEventPoints - usedEventPoints;
    let lessonCost = event_config.events[current_event].lessons_template.lesson_cost;

    if (max) {

        let rankUpgrades = event_config.events[current_event].lessons_template.rank_upgrades;

        let maxPreRuns = rankUpgrades[rankUpgrades.length - 1] / event_config.events[current_event].lessons_template.lesson_cost;

        let newLessonRuns = 0;

        for (let i = lessonPreRuns.length; i < maxPreRuns; i++) {

            newLessonRuns++;
            if (remainingEventPoints > newLessonRuns * lessonCost) {
                lessonPreRuns.push(lessonNum);
            }
            else {
                break;
            }
        }
    }
    else {
        if (remainingEventPoints > lessonCost) {
            lessonPreRuns.push(lessonNum);
        }
    }

    event_data.lesson_pre_runs = lessonPreRuns;

    saveTime = Date.now() + (1000 * 5);

    GenerateLessonsTab();
}

function GetLessonRanks() {

    let rankUpgrades = event_config.events[current_event].lessons_template.rank_upgrades;
    let levelUnlocks = event_config.events[current_event].lessons_template.level_unlocks;
    let lessonCost = event_config.events[current_event].lessons_template.lesson_cost;

    let currencySpent = lessonPreRuns.length * lessonCost;

    let rank = 1;
    let rankMaxed = false;
    if (currencySpent >= rankUpgrades[rankUpgrades.length - 1]) {
        rank = rankUpgrades.length + 1;
        rankMaxed = true;
    }
    else {
        for (let i = 0; i < rankUpgrades.length; i++) {

            rank = i + 1;

            if (rankUpgrades[i] > currencySpent) {
                break;
            }
        }
    }

    let level = 1;
    for (let i = 0; i < levelUnlocks.length; i++) {

        if (levelUnlocks[i] > rank) {
            break;
        }

        level = i + 1;
    }

    return [rank, level, rankMaxed];
}

function CreateLessonRewardItem(item, lesson) {

    let replacementId = '';
    if (item.id && item.id.substring(0, 5) == "swap_") {
        replacementId = event_config.events[current_event].lessons[lesson].id_swap[item.id];
    }

    let itemDiv = document.createElement('div');
    itemDiv.className = "lesson-item";

    let itemImg = document.createElement('img');

    SetItemImage(itemImg, item, replacementId);

    itemDiv.appendChild(itemImg);

    let amountP = document.createElement('p');
    amountP.className = "lesson-item-amount";
    if (item.count) {
        amountP.innerText = commafy(item.count);
    }
    else {
        amountP.innerText = Math.round(item.chance * 100) + "%"
    }

    itemDiv.appendChild(amountP);

    return itemDiv;

}

function ResetLessons() {

    event_data.lesson_pre_runs = lessonPreRuns = [];
    event_data.lesson_post_runs = lessonPostRuns = {};

    saveTime = Date.now() + (1000 * 5);

    GenerateLessonsTab();
}

function UpdateNotifications() {

    if (enabledBonusUnits.length == 0) {
        document.getElementById('notification-bonus').style.display = '';
    }
    else {
        document.getElementById('notification-bonus').style.display = 'none';
    }

    if (event_data.pyro_refreshes == undefined) {
        document.getElementById('notification-energy').style.display = '';
    }
    else {
        document.getElementById('notification-energy').style.display = 'none';
    }

    if (event_data.optimisation_type == undefined) {
        document.getElementById('notification-optimisation').style.display = '';
    }
    else {
        document.getElementById('notification-optimisation').style.display = 'none';
    }

    if (!event_config.events[current_event].lessons) {
        document.getElementById('notification-lessons').style.display = 'none';
    }
}

function DismissNotification(type) {

    if (type == "Energy") {
        if (event_data.pyro_refreshes == undefined) {
            event_data.pyro_refreshes = 0;
        }
    }

    UpdateNotifications();
}

function BonusCharsEnableAll() {

    let currencies = event_config.events[current_event].currencies;
    let currencyNames = Object.keys(currencies);

    let bonusCharsList = [];

    for (let i = 0; i < currencyNames.length; i++) {

        if (currencies[currencyNames[i]].source == "BoxPull") {
            continue;
        }

        let bonus_units = currencies[currencyNames[i]].bonus_units;

        for (let ii = 0; ii < bonus_units.length; ii++) {

            if (!bonusCharsList.includes(bonus_units[ii].id)) {

                bonusCharsList.push(bonus_units[ii].id);
            }
        }
    }

    enabledBonusUnits = bonusCharsList;
    event_data.enabled_bonus_units = enabledBonusUnits;

    GenerateBonusTab();

    CalculateBonuses();
    UpdateBonuses();
    UpdateNotifications();
    RefreshDropsDisplay();

    saveTime = Date.now() + (1000 * 5);
}

function InitMaxShopPurchases() {

    let shopPurchases = {};

    let shopList = event_config.events[current_event].shops;

    let shops = Object.keys(shopList);

    shops.forEach((shop) => {

        shopPurchases[shop] = {};

        shopList[shop].forEach((item) => {

            shopPurchases[shop][item.id] = item.count;
        })
    })

    let currencies = event_config.events[current_event].currencies;
    currencyNames = Object.keys(currencies);

    event_data.currency_needed = {};

    currencyNames.forEach((name) => {

        if (currencies[name].clear) {

            event_data.currency_needed[name] = currencies[name].clear;
        }
    })

    currencyNeededPre = event_data.currency_needed;

    return shopPurchases;
}

function ToggleEventList() {

    let eventList = document.getElementById('events-list');
    let eventContentContainer = document.getElementById('event-content-container');

    if (eventList.classList.contains('event-selected')) {
        eventList.classList.remove('event-selected');
        eventContentContainer.classList.remove('event-selected');
    }
    else {
        eventList.classList.add('event-selected');
        eventContentContainer.classList.add('event-selected');
    }
}
