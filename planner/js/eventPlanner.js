let data;
let events_data, event_data;
let saveTime = 0;

let event_config, charlist, event_misc, language_strings;
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

let cafeDefault = 9;

let shopItemTippies = [];

let cardGachaChances = [];

let omikujiChances = [];
let omikujiRewards = [];

let cardGachaSimResults = {};
let completedWorkers = [];
let cardGachaAvgSD = {};
let setSD = 0;
let cardPullCurrencyOwned = 0;

let omikujiGachaSimResults = {};
let omikujiGachaAvgSD = {};
let omikujiPullCurrencyOwned = 0;

let diceGachaSimResults = {};
let diceGachaAvgSD = {};
let diceRollCurrencyOwned = 0;

let cardGachaProcessed = false;
let omikujiGachaProcessed = false;
let diceGachaProcessed = false;

let cardGachaProcessing = false;
let omikujiGachaProcessing = false;
let diceGachaProcessing = false;

let midEvent = false;
let resets_left = 0;
let resets_total = 0;

let stageGroup1 = true, stageGroup2 = true, stageGroup3 = true;

let currentTab = "";

function loadResources() {

    $.getJSON('json/events.json?67').done(function (json) {
        event_config = json;
        checkResources();
    });

    $.getJSON('json/event_misc.json?2').done(function (json) {
        event_misc = json;
        checkResources();
    });

    $.getJSON('json/skillinfo/en.json?2').done(function (json) {
        charlist = json;
        checkResources();
    });

    $.getJSON('json/strings.json?334').done(function (json) {
        language_strings = json;
        checkResources();
    });
}

function checkResources() {

    if (event_config && event_misc && charlist && language_strings) {

        data = tryParseJSON(localStorage.getItem('save-data'));

        if (data) {
            events_data = data.events_data ?? {};
        }
        else {
            events_data = {};
        }

        if (data?.language) {
            language = data.language;
            if (language == "EN") {
                language = "En";
            }
            else if (language == "KR") {
                language = "Kr";
            }
            else if (language == "JP") {
                language = "Jp";
            }
            else if (language == "CN") {
                language = "Tw";
            }
            else if (language == "TH") {
                language = "Th";
            }
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

    let imgStyle = localStorage.getItem("image-style");

    if (imgStyle === 'true') {
        aprilFools = true;
        document.getElementById('image-style-button').src = "icons/UI/ShirokoIcon.png";
    }
    else {
        aprilFools = false;
        document.getElementById('image-style-button').src = "icons/UI/ShirokoScribble.png";
    }

    buildLanguages();
    document.getElementById('languages').value = language;

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
                if (current_event == "0068-opera-with-love") {
                    GenerateShopContent(current_currency);
                }
            }
        }
    }, 300);

    InitKeyTracking();

    InitTippies();

    document.getElementById('include-shop-purchases').checked = false;
    document.getElementById('include-point-rewards').checked = false;
    document.getElementById('include-box-rewards').checked = false;
    document.getElementById('include-lesson-rewards').checked = false;

    let textElements = document.getElementsByClassName('display-string');

    for (let i = 0; i < textElements.length; i++) {

        let dataId = textElements[i].getAttribute('data-id');

        textElements[i].innerText = GetLanguageString(dataId);
    }
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
        let eventInfo = event_config.events[eventName] ?? {};
        let eventDisabled = false;
        if (eventName.substring(0, 1) == "|") {
            eventName = eventName.substring(1);
            eventDisabled = true;
            eventLabel.innerText = GetLanguageString("text-comingsoon");
            eventInfo = event_config.events[eventName];
        }
        else if (eventInfo.display_name) {
            eventLabel.innerText = GetLanguageString("event-" + eventName); //eventInfo.display_name;

            if (eventName == "aha-conquest") {
                eventLabel.innerHTML = 'I played too much Genshin oops... this event format is kinda complicated to put here without a bit of work I can\'t do in time, check this guy\'s vid instead: <a href="https://www.youtube.com/watch?v=qAH0hqpLAGY" style="color: lightskyblue;">https://www.youtube.com/watch?v=qAH0hqpLAGY</a><br>I\'ll update the other events up to JP after the weekend when I finish new raid page I\'m working on';
            }
        }

        eventImg.src = "icons/EventIcon/" + eventInfo.icon;
        eventImg.className = "event-icon";

        eventDiv.appendChild(eventImg);

        let previewItems = eventInfo.reward_preview;

        if (eventName != "aha-conquest") {
            for (let p = 0; p < previewItems?.length; p++) {
                let previewImg = document.createElement("img");
                SetItemImage(previewImg, previewItems[p], null, true);
                previewImg.className = "event-reward-preview preview-" + previewItems[p].preview;
                eventDiv.appendChild(previewImg);
            }
        }

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

    let tippieMsgs = ['tooltip-targets', 'tooltip-energy', 'tooltip-bonus', 'tooltip-shop', 'tooltip-stages', 'tooltip-points', 'tooltip-boxes',
        'tooltip-energynatural', 'tooltip-energydailies', 'tooltip-energyclub', 'tooltip-energyweeklies', 'tooltip-energyarona', 'tooltip-energypyro',
        'tooltip-energypvp', 'tooltip-energycafe', 'tooltip-energypack', 'tooltip-energytotal', 'tooltip-includeshop', 'tooltip-includepointrewards',
        'tooltip-includebox', 'tooltip-includelessons', 'tooltip-optishop', 'tooltip-optimaterials', 'tooltip-opticurrency', "tooltip-optimanual"]

    //let tippieTimeouts = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 10, 10, 10]

    for (let i = 0; i < tippieIds.length; i++) {
        tippy(tippieIds[i], {
            content: GetLanguageString(tippieMsgs[i]),
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

    if (cardGachaProcessing || omikujiGachaProcessing) {
        return;
    }

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
    cardGachaChances = [];
    cardGachaSimResults = {};
    completedWorkers = [];
    cardGachaAvgSD = {};
    setSD = 0;
    cardGachaProcessed = false;
    cardPullCurrencyOwned = 0;
    omikujiChances = [];
    omikujiRewards = [];
    omikujiGachaSimResults = {};
    omikujiGachaAvgSD = {};
    omikujiGachaProcessed = false;
    omikujiPullCurrencyOwned = 0;
    diceGachaProcessed = false;
    resets_left = 0;
    resets_total = 0;

    if (events_data[current_event]) {
        event_data = events_data[current_event];
        enabledBonusUnits = event_data.enabled_bonus_units ?? [];
        currencyNeededPre = event_data.currency_needed ?? {};
        lessonPreRuns = event_data.lesson_pre_runs ?? [];
        lessonPostRuns = event_data.lesson_post_runs ?? {};
        cardGachaAvgSD = event_data.card_pull_rewards ?? {};
        cardPullCurrencyOwned = event_data.card_pull_currency_owned ?? 0;
        omikujiGachaAvgSD = event_data.omikuji_pull_rewards ?? {};
        omikujiPullCurrencyOwned = event_data.omikuji_pull_currency_owned ?? 0;
        diceGachaAvgSD = event_data.dice_roll_rewards ?? {};
        diceRollCurrencyOwned = event_data.dice_roll_currency_owned ?? 0;
        setSD = event_data.standard_deviation ?? 0;
    }
    else {
        event_data = {};
        enabledBonusUnits = [];
        event_data.shop_purchases = {};
        event_data.currency_needed = {};
        event_data.cafe_rank = cafeDefault;
    }

    if (current_event === "new-year-68-rerun") {
        currencyNeededPre["Lucky_Bag"] = 14400;
        event_data.currency_needed["Lucky_Bag"] = 14400;
        // currencyNeededPre["Fortune_Slip_Voucher"] = 140;
        // event_data.currency_needed["Fortune_Slip_Voucher"] = 140;
    }

    if (current_event === "hidden-heritage") {
        document.getElementById("temp-disclaimer").style.display = "";
    }
    else {
        document.getElementById("temp-disclaimer").style.display = "none";
    }

    if (current_event == "momoyodou-beach-house") {
        Swal.fire({
            toast: true,
            position: 'top-start',
            title: "CAUTION: The S.Shizuko shard calculation and stage calculation is quite jank this time, should be more accurate after doing initial clears and enabling Owned mode though",
            showConfirmButton: false,
            timer: 8000
        })
        document.getElementById("summer-hyakki-temp").style.display = "flex";
    }
    else {
        document.getElementById("summer-hyakki-temp").style.display = "none";
    }

    if (current_event == "ive-alive") {
        Swal.fire({
            toast: true,
            position: 'top-start',
            title: "CAUTION: Some parts are a bit broken at the moment, due to event points coming from the minigame instead of stages it broke some code, will fix tomorrow",
            showConfirmButton: false,
            timer: 8000
        })
    }

    let enabledStageGroups;
    //TEMP
    if (current_event == "get-set-go-rerun") {
        enabledStageGroups = event_data?.enabled_stage_groups ?? [false, false, true];
    }
    else {
        enabledStageGroups = event_data?.enabled_stage_groups ?? [true, true, true];
    }

    document.getElementById('include-stage-group-1').checked = stageGroup1 = enabledStageGroups[0];
    document.getElementById('include-stage-group-2').checked = stageGroup2 = enabledStageGroups[1];
    document.getElementById('include-stage-group-3').checked = stageGroup3 = enabledStageGroups[2];

    document.getElementById('label-stage-group-1').innerText = GetLanguageString("label-tabstages") + " " + event_config.events[current_event].stage_groups[0];
    document.getElementById('label-stage-group-2').innerText = GetLanguageString("label-tabstages") + " " + event_config.events[current_event].stage_groups[1];
    document.getElementById('label-stage-group-3').innerText = GetLanguageString("label-tabstages") + " " + event_config.events[current_event].stage_groups[2];

    if (Object.keys(cardGachaAvgSD).length > 0) {
        cardGachaProcessed = true;
    }

    if (Object.keys(omikujiGachaAvgSD).length > 0) {
        omikujiGachaProcessed = true;
    }

    if (Object.keys(diceGachaAvgSD).length > 0) {
        diceGachaProcessed = true;
    }

    if (event_config.events[current_event].shops && Object.keys(event_data.shop_purchases).length == 0) {
        event_data.shop_purchases = InitMaxShopPurchases();
    }
    else if (Object.keys(event_data.currency_needed).length == 0) {
        let currencies = event_config.events[current_event].currencies;
        currencyNames = Object.keys(currencies);

        event_data.currency_needed = {};

        currencyNames.forEach((name) => {

            if (currencies[name].clear) {

                event_data.currency_needed[name] = currencies[name].clear;
            }
        })

        currencyNeededPre = event_data.currency_needed;
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

    let ownedCurrencies = Object.keys(event_data.currency_owned ?? {});

    midEvent = false;

    for (let i = 0; i < ownedCurrencies.length; i++) {
        let amount = event_data.currency_owned[ownedCurrencies[i]];
        if (amount && parseInt(amount) > 0) {
            midEvent = true;
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
    InitOwnedTab();
    InitTargetsTab();
    GenerateStagesTable();
    GeneratePointsTable();
    GenerateLessonsTab();
    InitCardsTab();
    LoadCardGachaChances();
    LoadOmikuji();
    LoadDice();
    InitInvasionTab();
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
    else if (tab == "Shop") {
        ShopTabClicked(current_currency, true);
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

        if (currencies[currencyNames[i]].source == "BoxPull" || currencies[currencyNames[i]].source == "CardPull" || currencies[currencyNames[i]].source == "MinigameDrop") {
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

        charImg.src = "icons/Portrait/Icon_" + bonusCharsList[i] + ".webp";
        if (aprilFools) {
            charImg.src = "icons/Portrait/April/Icon_" + bonusCharsList[i] + ".png";
        }

        charDiv.appendChild(charImg);
        charsContainer.appendChild(charDiv);

        charDiv.addEventListener('click', (event) => {
            ToggleBonusChar(event.currentTarget.id);
        })
    }

}

function LoadFirstShop() {

    if (!event_config.events[current_event].shops) {
        return;
    }

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

    Save(5);

    CalculateBonuses();
    UpdateBonuses();
    UpdateNotifications();
    RefreshDropsDisplay();
}

function CalculateBonuses() {

    if (current_event == "aha-conquest") {
        currencyBonuses = { "Computation_Circuit": 1.2, "Engine_Parts": 1.2, "Chocolate_Burger": 1.2 };
        return;
    }
    else if (current_event == "momoyodou-beach-house") {
        currencyBonuses = { "Momoyodou_Glitter_Coin": 1.2, "Turban_Shell": 1.2, "Summer_Ninjutsu_Instructions_Scroll": 1.2, "Local_Currency": 1.2 }
        return;
    }

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

            let type = GetOldTypeFromSquadType(charlist[bonus_units[ii].id].SquadType);

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

    currentTab = tab;
}

async function EnergySourceClicked(source) {

    let title, options = {}, input_placeholder;

    let inputType;

    if (source == "Pyro") {
        for (let i = 0; i <= 20; i++) {
            options[i] = i + "x";
        }

        title = "Pyro refreshes";
        input_placeholder = "Select number of refreshes";
        inputType = "Options";
    }
    else if (source == "ArenaCoin") {
        for (let i = 0; i <= 4; i++) {
            options[i] = i + "x";
        }

        title = "Pvp refreshes";
        input_placeholder = "Select number of refreshes";
        inputType = "Options";
    }
    else if (source == "Cafe") {
        for (let i = 1; i <= 9; i++) {
            options[i] = "Lvl " + i;
        }

        title = "Cafe rank";
        input_placeholder = "Select cafe rank";
        inputType = "Options";
    }
    else if (source == "EnergyPack") {

        options = {
            "Yes": "Yes",
            "No": "No"
        }

        title = "Biweekly Energy Pack";
        input_placeholder = "Pack active?";
        inputType = "Options";
    }
    else if (source == "Carryover") {

        title = "Energy Carryover";
        input_placeholder = "0-3000";
        inputType = "Number";
    }

    let result;

    if (inputType == "Options") {
        const tempResult = await Swal.fire({
            title: title,
            input: 'select',
            inputOptions: options,
            inputPlaceholder: input_placeholder,
            showCancelButton: true
        });

        result = tempResult.value;
    }
    else if (inputType == "Number") {
        const tempResult = await Swal.fire({
            title: title,
            input: 'text',
            inputPlaceholder: input_placeholder,
            showCancelButton: true,
            inputValidator: (value) => {
                let tempVal;
                try {
                    tempVal = parseInt(value);
                    if (tempVal >= 0 && tempVal <= 3000) { }
                    else {
                        return "Enter an integer between 0-3000";
                    }
                }
                catch {
                    return "Enter an integer between 0-3000";
                }
            }
        });

        result = parseInt(tempResult.value);
    }

    if (result || result === 0) {

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
        else if (source == "Carryover") {
            if (result == 0) {
                event_data["energy_carryover"] = 0;
            }
            else if (!isNaN(result)) {
                event_data["energy_carryover"] = result;
            }
        }

        CalculateEnergyAvailable();

        Save(5);

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

    let daysPassed = 0;
    if (midEvent) {
        daysPassed = Math.floor((Date.now() / 1000 - eventObject.reset_time) / 86400) + 1;
    }

    let resets = daysPassed;

    for (let i = eventObject.reset_time + (daysPassed * 86400); i < eventObject.end_time; i += 86400) {

        let dayLength = 24;

        let natural = 0, cafe = 0, dailytask = 0, club = 0, pyrorefresh = 0, pvprefresh = 0,
            energypack = 0, weeklytask = 0, aronalogin = 0;

        let carryover = 0;

        if (resets == 0) {
            dayLength = (((eventObject.reset_time + 86400) - eventObject.start_time) / 3600) - eventObject.maint_hours;
            if (!midEvent) {
                carryover = event_data.energy_carryover ?? 0;
            }
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

        energyByDay[resets] = natural + cafe + dailytask + club + pyrorefresh + pvprefresh + energypack + carryover;

        resets++;
    }

    resets_left = Math.max(resets - daysPassed, 0);
    resets_total = resets;

    document.getElementById('energy-natural-total').innerText = energy_natural;
    document.getElementById('energy-dailytask-total').innerText = energy_dailytask;
    document.getElementById('energy-club-total').innerText = energy_club;
    document.getElementById('energy-carryover-total').innerText = event_data.energy_carryover ?? 0;

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

    // TEMP
    if (current_event == "momoyodou-beach-house" && !midEvent) {
        energyAvailable = Math.max(energyAvailable - 900 - initialClearCost, 0);
    }
    else {
        energyAvailable = Math.max(energyAvailable - 100 - initialClearCost, 0);
    }

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

    if (!event_config.events[current_event].shops) {
        document.getElementById("tab-Shop").style.display = "none";
        return;
    }
    else {
        document.getElementById("tab-Shop").style.display = "";
    }

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

function CalculateBoxDropCurrencyFromBoxCurrency(boxPullCurrency) {

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
    let boxPullCurrencyUsed = 0;

    let boxClearCost = event_config.events[current_event].box_clear_cost;

    while (Math.floor(boxPullCurrencyUsed / boxClearCost) < Math.floor(boxPullCurrency / boxClearCost)) {

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

        boxPullCurrencyUsed += boxClearCost;
    }

    return boxCurrencyObtained;
}

function ShopTabClicked(currency, override) {

    if (current_currency == currency && !override) {
        return;
    }

    if (!event_data.shop_purchases) {
        event_data.shop_purchases = {};
    }

    if (!event_data.shop_purchases[currency]) {
        event_data.shop_purchases[currency] = {};
    }

    if (current_currency && !override) {
        HarvestItemPurchases();
        if (shopPurchaseModified) {
            Save(1);
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
                    content: GetLanguageString("tooltip-furniturelimited"),
                    theme: 'light'
                })[0]);
            }
            else {
                shopItemTippies.push(tippy(('#info-' + shop[i].id), {
                    content: GetLanguageString("tooltip-furniturecraftable"),
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

    SetItemImage(itemImg, item, null, false);

    itemDiv.appendChild(itemImg);

    let inputDiv = document.createElement('div');
    inputDiv.className = "shop-item-input-container";

    let inputElement = document.createElement('input');
    inputElement.id = "input-" + item.id;
    inputElement.type = "number";
    inputElement.max = item.count;
    if (item.count == 0) {
        inputElement.max = item.overflow_cap;
    }
    inputElement.min = 0;

    if (item.locked && !midEvent) {
        inputElement.disabled = true;
    }

    let initValue = event_data.shop_purchases[current_currency]?.[item.id];
    if (event_data.shop_purchases["overflow_" + current_currency]?.[item.id]) {
        initValue = event_data.shop_purchases["overflow_" + current_currency]?.[item.id];
        inputElement.disabled = true;
    }

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
    if (item.count > 0) {
        inputP.innerText = "/ " + item.count;
    }
    else {
        inputP.innerText = "/ ∞";
    }

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

    SetItemImage(itemImg, item, null, false);

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

function SetItemImage(itemImg, item, replacementId, small) {

    let itemId = item.id;
    if (replacementId) {
        itemId = replacementId;
    }

    let smallInsert = "";
    if (small) {
        smallInsert = "_small";
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
            itemImg.src = "icons/Artifact/" + matName + smallInsert + ".webp";
        }
        else {
            itemImg.src = "icons/SchoolMat/" + matName + smallInsert + ".webp";
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
    else if (item.type == "Gift") {
        itemImg.src = "icons/Gifts/" + itemId + ".png";
    }
    else if (item.type == "Choice") {
        itemImg.src = "icons/Selectors/" + itemId + ".png";
    }
    else if (item.type == "AreaKey") {
        itemImg.src = "icons/EventIcon/AreaKey/" + item.icon + ".png";
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

        if (!shop[i].overflow || !purchaseInputs[i].disabled) {

            shopPurchases[itemId] = purchaseInputs[i].value ?? 0;

            totalPurchaseCost += shopPurchases[itemId] * shop[i].cost;
        }

    }

    event_data.shop_purchases[current_currency] = shopPurchases;

    currencyNeededPre[current_currency] = totalPurchaseCost;

    let currencySource = event_config.events[current_event].currencies[current_currency].source;
    if (currencySource == "StageDrop") {
        currencyNeeded[current_currency] = currencyNeededPre[current_currency] - (initialClearRewards[current_currency] ?? 0);
    }
    else if (currencySource == "BoxPull") {
        let boxPullCurrency = event_config.events[current_event].currencies[current_currency].pull_currency;

        let pullCurrencyNeeded = CalculateBoxCurrencyNeeded(totalPurchaseCost);

        currencyNeeded[boxPullCurrency] = pullCurrencyNeeded - (initialClearRewards[boxPullCurrency] ?? 0);
        currencyNeededPre[boxPullCurrency] = pullCurrencyNeeded;
    }

    event_data.currency_needed = currencyNeededPre;

    document.getElementById('currency-label-' + current_currency).innerText = totalPurchaseCost;

    Save(5);

    RefreshDropsDisplay();
}

function CalculateItemPurchases() {

    let shopPurchases = event_data.shop_purchases;

    let shopNames = Object.keys(event_config.events[current_event].shops);
    for (let s = 0; s < shopNames.length; s++) {

        let totalPurchaseCost = 0;

        let shop = event_config.events[current_event].shops[shopNames[s]];

        let purchaseNames = Object.keys(shop);
        for (let i = 0; i < purchaseNames.length; i++) {

            let loadedShopPurchases = shopPurchases[shopNames[s]];
            if (loadedShopPurchases && loadedShopPurchases[shop[i].id]) {
                totalPurchaseCost += loadedShopPurchases[shop[i].id] * shop[i].cost;
            }
        }

        if (current_event == "dragon-and-tortoise" && shopNames[s] == "Black_Tortoise_Meal_Ticket") {
            event_data.currency_needed["Black_Tortoise_Meal_Ticket"] = totalPurchaseCost
        }
        else if (current_event == "dragon-and-tortoise" && shopNames[s] == "Genryumon_Badge") {
            event_data.currency_needed["Genryumon_Badge"] = totalPurchaseCost
        }
        else if (current_event == "new-year-march" && shopNames[s] == "Event_Point") {
            event_data.currency_needed["Event_Point"] = totalPurchaseCost;
        }

        if (current_event == "descent-of-five-senses") {
            event_data.currency_needed["Moonlight_Festival_Voucher"] = event_data.currency_needed["Moonlight_Festival_Firecrackers"] * 270;
        }

        // currencyNeededPre[shopNames[s]] = totalPurchaseCost;

        // let currencySource = event_config.events[current_event].currencies[shopNames[s]].source;
        // if (currencySource == "StageDrop") {
        //     currencyNeeded[shopNames[s]] = currencyNeededPre[shopNames[s]] - (initialClearRewards[shopNames[s]] ?? 0);
        // }
        // else if (currencySource == "BoxPull") {
        //     let boxPullCurrency = event_config.events[current_event].currencies[shopNames[s]].pull_currency;

        //     let pullCurrencyNeeded = CalculateBoxCurrencyNeeded(totalPurchaseCost);

        //     currencyNeeded[boxPullCurrency] = pullCurrencyNeeded - (initialClearRewards[boxPullCurrency] ?? 0);
        //     currencyNeededPre[boxPullCurrency] = pullCurrencyNeeded;
        // }

        // event_data.currency_needed = currencyNeededPre;

        CalculateNeededFinal();

        document.getElementById('currency-label-' + shopNames[s]).innerText = totalPurchaseCost;
    }
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

    let invasionCurrencies = {};
    AddInvasionRewards(invasionCurrencies, {}, {});

    for (let i = 0; i < currencies.length; i++) {

        let currencyOwned = 0;

        if (event_data.currency_owned && event_data.currency_owned[currencies[i]]) {
            let currencyInt = parseInt(event_data.currency_owned[currencies[i]]);

            if (currencyInt > 0) {
                currencyOwned = currencyInt;
            }
        }

        let currencySource = event_config.events[current_event].currencies[currencies[i]].source;

        if (initialClearRewards[currencies[i]] && !midEvent) {
            if (currencySource == "StageDrop") {
                currencyNeeded[currencies[i]] = Math.max(currencyNeededPre[currencies[i]] - initialClearRewards[currencies[i]] - (invasionCurrencies[currencies[i]] ?? 0), 0);
            }
            else if (currencySource == "BoxPull") {
                let boxPullCurrency = event_config.events[current_event].currencies[currencies[i]].pull_currency;

                let pullCurrencyNeeded = CalculateBoxCurrencyNeeded(currencyNeededPre[currencies[i]]);

                currencyNeeded[boxPullCurrency] = Math.max(pullCurrencyNeeded - (initialClearRewards[boxPullCurrency] ?? 0) - (invasionCurrencies[currencies[i]] ?? 0), 0);
            }
        }
        else {
            currencyNeeded[currencies[i]] = Math.max(currencyNeededPre[currencies[i]] - currencyOwned - invasionCurrencies[currencies[i]], 0);

            if (currencySource == "StageDrop") {
                currencyNeeded[currencies[i]] = Math.max(currencyNeededPre[currencies[i]] - currencyOwned - (invasionCurrencies[currencies[i]] ?? 0), 0);
            }
            else if (currencySource == "BoxPull") {
                let boxPullCurrency = event_config.events[current_event].currencies[currencies[i]].pull_currency;

                let pullCurrencyNeeded = CalculateBoxCurrencyNeeded(currencyNeededPre[currencies[i]]);

                currencyNeeded[boxPullCurrency] = Math.max(pullCurrencyNeeded - currencyOwned - (invasionCurrencies[currencies[i]] ?? 0), 0);
            }
            else if (currencySource == "CardPull") {
                let cardPullCurrency = event_config.events[current_event].currencies[currencies[i]].pull_currency;

                let cardCurrencyOwned = 0;
                if (event_data.currency_owned && event_data.currency_owned[cardPullCurrency]) {
                    let currencyInt = parseInt(event_data.currency_owned[cardPullCurrency]);

                    if (currencyInt > 0) {
                        cardCurrencyOwned = currencyInt;
                    }
                }

                let currencySubtract = 0;

                if (cardCurrencyOwned > 0) {
                    currencySubtract = cardCurrencyOwned;
                }
                else {
                    currencySubtract = (initialClearRewards[cardPullCurrency] ?? 0);
                }

                let pullCurrencyNeeded = currencyNeededPre[currencies[i]];

                // TEMP
                currencyNeeded[cardPullCurrency] = Math.max(Math.ceil(pullCurrencyNeeded * 0.544811320) * 200 - currencySubtract - (invasionCurrencies[currencies[i]] ?? 0), 0);
            }
        }
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

    let currencyOwned = 0;

    if (event_data.currency_owned && event_data.currency_owned["Event_Point"]) {
        let currencyInt = parseInt(event_data.currency_owned["Event_Point"]);

        if (currencyInt > 0) {
            currencyOwned = currencyInt;
        }
    }

    if (midEvent) {
        event_point_target = Math.max(event_point_target - currencyOwned, 0);
    }
    else {
        event_point_target = Math.max(event_point_target - initialClearRewards["Event_Point"], 0);
    }

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

    CreateTableRowCells(tableHeadRow, [GetLanguageString("label-headerquest"), GetLanguageString("label-headerenergy"), GetLanguageString("label-headerruns"),
    GetLanguageString("label-headerdrops")], 'th');

    tableHead.appendChild(tableHeadRow);

    for (let i = 0; i < stages.length; i++) {

        let stage = stages[i];

        if (stage.visible === false) {
            continue;
        }

        if (stage.type == "Quest") {

            let tableRow = document.createElement('tr');

            if (i % 2 == 1) {
                tableRow.className = "alternate-row";
            }

            let stageLabel = "Q" + stage.number;
            if (stage.label) {
                stageLabel = stage.label;
            }

            CreateTableRowCells(tableRow, [(stageLabel), CreateEnergyDiv(stage.cost), CreateRunsDiv(stage.number), CreateDropsDiv(stage.drops)], 'td');

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

    if (!midEvent) {
        document.getElementById("initial-clear-info").style.display = "";

        currenciesContainer.appendChild(CreateRewardItem("icons/EventIcon/EnergyIcon/EnergyPadded.png", initialClearCost, ""));

        let currencyNames = Object.keys(initialClearRewards);

        currencyNames.forEach((name) => {

            currenciesContainer.appendChild(CreateRewardItem("icons/EventIcon/CurrencyIcon/" + name + ".png", initialClearRewards[name], ""));
        })
    }
    else {
        document.getElementById("initial-clear-info").style.display = "none";
    }
}

function CreateTableRowCells(row, cells, cellType) {

    cells.forEach((item) => {

        if (item == null) {
            return;
        }

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
        let dropInt = parseInt(drop);

        if (currencyNames.includes(drop)) {

            dropImg.src = "icons/EventIcon/CurrencyIcon/" + currencies[drop].icon;

            let adjustedDrop = Math.ceil((drops[drop] + (drops[drop] * (currencyBonuses[drop] ?? 0))).toFixed(5));

            dropP.innerText = adjustedDrop;
        }
        else if (matId) {

            if (parseInt(matId) < 1000) {
                dropImg.src = "icons/Artifact/" + drop + ".webp";
            }
            else if (["T1_", "T2_", "T3_", "T4_", "T5_", "T6_", "T7_", "T8_", "T9_"].includes(drop.substring(0, 3))) {
                dropImg.src = "icons/Gear/" + drop + ".webp";
            }
            else {
                dropImg.src = "icons/SchoolMat/" + drop + ".webp";
            }

            if (Number.isInteger(drops[drop])) {
                dropP.innerText = (drops[drop]);
            }
            else {
                dropP.innerText = parseFloat((drops[drop] * 100).toFixed(2)) + "%";
            }

            dropDiv.classList.add('drop-resource-rarity-' + drop.slice(-1));
            dropDiv.classList.add('drop-resource');
        }
        else if (drop == "Credit") {

            dropImg.src = "icons/Misc/Credit.png";

            dropP.innerText = ShortenNumber(drops[drop]);
        }
        else if (drop.includes('XP_')) {

            dropImg.src = "icons/LevelPart/" + drop + ".png";

            dropP.innerText = drops[drop];
        }
        else if (["T1_", "T2_", "T3_", "T4_", "T5_", "T6_", "T7_", "T8_", "T9_"].includes(drop.substring(0, 3))) {
            dropImg.src = "icons/Gear/" + drop + "_small.webp";

            if (Number.isInteger(drops[drop])) {
                dropP.innerText = (drops[drop]);
            }
            else {
                dropP.innerText = parseFloat((drops[drop] * 100).toFixed(2)) + "%";
            }

            dropP.classList.add("drop-smaller-text");
        }
        else if (dropInt) {
            if (dropInt >= 10000 && dropInt < 30000) {

                dropImg.src = "icons/Eleph/Eleph_" + drop + ".png";

                dropP.innerText = drops[drop];
            }
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

            if (!stageGroup1 && stage.group == 1) {
                continue;
            }
            else if (!stageGroup2 && stage.group == 2) {
                continue;
            }
            else if (!stageGroup3 && stage.group == 3) {
                continue;
            }

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

    let basesChecked = document.getElementById("upgrade-bases").checked;

    currencyNames.forEach((name) => {
        if (optimise != name && event_config.events[current_event]?.currencies[name]?.source == "StageDrop") {
            // TEMP
            if (current_event == "momoyodou-beach-house" && basesChecked) {
                let tempCurrency = { "Momoyodou_Glitter_Coin": 4200, "Turban_Shell": 4200, "Summer_Ninjutsu_Instructions_Scroll": 4110 };
                model.constraints[name] = { "min": (currencyNeeded[name] + tempCurrency[name]) };
            }
            else {
                model.constraints[name] = { "min": currencyNeeded[name] };
            }
        }
    })

    if (energyConstrained) {
        model.constraints["Energy_Cost"] = { "max": energyAvailable };
    }

    if (event_point_target && optimise != "Event_Point") {
        model.constraints["Event_Point"] = { "min": Math.max(event_point_target, currencyNeeded["Event_Point"] ?? 0) };
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
            Save(5);
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
    infoText.innerText = GetLanguageString("label-clicktotoggle");
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
            matImg.src = "icons/Artifact/" + drop + ".webp";
            dropSliced = drop.slice(0, -2);
            dropRarity = drop.slice(-1);
        }
        else if (["T1_", "T2_", "T3_", "T4_", "T5_", "T6_", "T7_", "T8_", "T9_"].includes(drop.substring(0, 3))) {
            matImg.src = "icons/Gear/" + drop + "_small.webp";
            dropSliced = drop.slice(0, 2);
        }
        else {
            matImg.src = "icons/SchoolMat/" + drop + ".webp";
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
        Save(5);
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

    if (optimisationType == "Currency") {

        currencyNames = Object.keys(event_data.shop_purchases);
        for (let i = 0; i < currencyNames.length; i++) {

            if (currencyNames[i].substring(0, 9) == "overflow_") {
                continue;
            }

            let shop = event_config.events[current_event].shops[currencyNames[i]];

            if (!shop) {
                continue;
            }

            for (let ii = 0; ii < shop.length; ii++) {
                if (shop[ii].overflow) {
                    event_data.shop_purchases[currencyNames[i]][shop[ii].id] = 0;
                }
            }
        }
    }
    else {
        storedPurchaseNames = Object.keys(event_data.shop_purchases);
        for (let i = 0; i < storedPurchaseNames.length; i++) {
            if (storedPurchaseNames[i].substring(0, 9) == "overflow_") {
                event_data.shop_purchases[storedPurchaseNames[i]] = {};
            }
        }
    }

    if (event_config.events[current_event].shops) {
        CalculateItemPurchases();
    }

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
    let totalGear = {};
    let totalEligma = 0;
    let totalCredit = 0;
    let totalSecretTech = 0;
    let totalGearBoxes = 0;
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

            let matId = matLookup.revGet(drop);

            if (currencyBonuses[drop] || currencyBonuses[drop] == 0) {
                if (!totalCurrencies[drop]) {
                    totalCurrencies[drop] = 0;
                }

                totalCurrencies[drop] += runs * Math.ceil(drops[drop] + (drops[drop] * (currencyBonuses[drop] ?? 0))).toFixed(5);
            }
            else if (drop == "Credit") {
                totalCredit += runs * drops[drop];
            }
            else if (matId && matId < 1000) {
                if (!totalArtifacts[drop]) {
                    totalArtifacts[drop] = 0;
                }

                totalArtifacts[drop] += runs * drops[drop];
            }
            else if (matId) {
                if (!totalSchoolMats[drop]) {
                    totalSchoolMats[drop] = 0;
                }

                totalSchoolMats[drop] += runs * drops[drop];
            }
            else if (["T1_", "T2_", "T3_", "T4_", "T5_", "T6_", "T7_", "T8_", "T9_"].includes(drop.substring(0, 3))) {
                if (!totalGear[drop]) {
                    totalGear[drop] = 0;
                }

                totalGear[drop] += runs * drops[drop];
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

    if (!midEvent) {
        energyCost += initialClearCost;
    }

    if (current_event == "momoyodou-beach-house") {
        energyCost += 800;
    }

    if (displayIncluded['InvasionRewards']) {
        let intResults = AddInvasionRewards({}, totalEleph, totalXps);
        if (intResults) {
            totalCredit += intResults[0];
        }
    }

    AddInvasionRewards(totalCurrencies, {}, {});

    if (displayIncluded['LessonRewards']) {

        let intResults = AddLessonRewards(totalArtifacts, totalSchoolMats, totalEleph, totalXps, 0, 0, 0);
        if (intResults) {
            totalCredit += intResults[0];
            totalEligma += intResults[1];
        }
    }

    for (let i = 0; i < neededCurrencies.length; i++) {

        if (initialClearRewards[neededCurrencies[i]]) {

            if (!totalCurrencies[neededCurrencies[i]]) {
                totalCurrencies[neededCurrencies[i]] = 0;
            }

            //totalCurrencies[neededCurrencies[i]] += initialClearRewards[neededCurrencies[i]];
        }
    }

    if (!midEvent) {
        initialCurrencyNames = Object.keys(initialClearRewards);

        for (let i = 0; i < initialCurrencyNames.length; i++) {

            if (!totalCurrencies[initialCurrencyNames[i]]) {
                totalCurrencies[initialCurrencyNames[i]] = 0;
            }

            totalCurrencies[initialCurrencyNames[i]] += initialClearRewards[initialCurrencyNames[i]];
        }
    }
    else {
        ownedCurrencyNames = Object.keys(event_data.currency_owned ?? {});

        for (let i = 0; i < ownedCurrencyNames.length; i++) {

            if (!totalCurrencies[ownedCurrencyNames[i]]) {
                totalCurrencies[ownedCurrencyNames[i]] = 0;
            }

            let currencyInt = 0;
            if (event_data.currency_owned[ownedCurrencyNames[i]]) {
                currencyInt = parseInt(event_data.currency_owned[ownedCurrencyNames[i]]);
            }

            totalCurrencies[ownedCurrencyNames[i]] += currencyInt;
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
            if (results[3]) {
                totalCurrencies[results[4]] = results[3];
            }
        }
    }
    else {
        document.getElementById('box-info-text').innerText = '';
    }

    // Add Event Currencies buyable from shop
    if (optimisationType == "Currency") {

        currencyNames = Object.keys(totalCurrencies);
        for (let i = 0; i < currencyNames.length; i++) {

            let leftoverCurrency = totalCurrencies[currencyNames[i]] - currencyNeededPre[currencyNames[i]];

            if (!event_config.events[current_event].shops) {
                continue;
            }

            let shop = event_config.events[current_event].shops[currencyNames[i]];

            if (!shop) {
                continue;
            }

            for (let ii = 0; ii < shop.length; ii++) {
                if (shop[ii].overflow && shop[ii].type == "EventCurrency") {
                    let overflowAmount = Math.max(Math.min(Math.floor(leftoverCurrency / shop[ii].cost), shop[ii].overflow_cap), 0);
                    event_data.shop_purchases["overflow_" + currencyNames[i]] = {};
                    event_data.shop_purchases["overflow_" + currencyNames[i]][shop[ii].id] = overflowAmount;
                    if (!event_data.shop_purchases[currencyNames[i]]) {
                        event_data.shop_purchases[currencyNames[i]] = {};
                    }
                    event_data.shop_purchases[currencyNames[i]][shop[ii].id] = 0;

                    totalCurrencies[shop[ii].id] = overflowAmount;
                }
            }
        }
    }
    else {

        currencyNames = Object.keys(totalCurrencies);
        for (let i = 0; i < currencyNames.length; i++) {

            if (!event_config.events[current_event].shops) {
                continue;
            }

            let shop = event_config.events[current_event].shops[currencyNames[i]];

            if (!shop) {
                continue;
            }

            for (let ii = 0; ii < shop.length; ii++) {
                if (shop[ii].overflow && shop[ii].type == "EventCurrency") {
                    totalCurrencies[shop[ii].id] = event_data.shop_purchases[currencyNames[i]][shop[ii].id];
                }
            }
        }
    }

    if (current_event == "ive-alive") {
        totalCurrencies["Event_Point"] = Math.floor(totalCurrencies["Countdown_Calendar"] / 720) * 400;
        // event_point_target = 20000;
        maxEventPoints = totalCurrencies["Event_Point"];
    }

    if (!midEvent) {
        if (initialClearRewards["Event_Point"]) {
            if (!totalCurrencies["Event_Point"]) {
                totalCurrencies["Event_Point"] = 0;
            }

            maxEventPoints = totalCurrencies["Event_Point"];
        }
    }
    else {
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

    if (event_config.events[current_event].card_drops) {

        let pullCurrency, pulledCurrency;
        let currencyNames = Object.keys(event_config.events[current_event].currencies);
        let currencies = event_config.events[current_event].currencies;

        for (let i = 0; i < currencyNames.length; i++) {

            if (currencies[currencyNames[i]].source == "CardPull") {

                pullCurrency = currencies[currencyNames[i]].pull_currency;
                pulledCurrency = currencyNames[i];
            }
        }

        if (cardPullCurrencyOwned != totalCurrencies[pullCurrency]) {
            cardPullCurrencyOwned = totalCurrencies[pullCurrency] ?? 0;
            cardGachaProcessed = false;
            cardGachaAvgSD = {};
            event_data.card_pull_rewards = {};
            event_data.card_pull_currency_owned = cardPullCurrencyOwned ?? 0;
        }

        if (displayIncluded['CardRewards']) {

            let intResults = AddCardRewards(pulledCurrency, totalCurrencies, totalArtifacts, totalEleph, totalXps);
            if (intResults) {
                totalCredit += intResults[0];
                totalEligma += intResults[1];
            }
        }
    }

    if (event_config.events[current_event].omikuji) {

        let pullCurrency = event_config.events[current_event].omikuji.pull_currency;

        let changed = false;
        if (omikujiPullCurrencyOwned != totalCurrencies[pullCurrency]) {
            changed = true;
        }

        let boxPullCurrencyForOmikuji = 0;
        if (event_config.events[current_event].boxes) {
            boxPullCurrencyForOmikuji = GetBoxPullCurrencyForOmikuji(totalCurrencies);
        }

        if (event_config.events[current_event].boxes && omikujiPullCurrencyOwned == boxPullCurrencyForOmikuji) {
            changed = false;
        }

        if (changed) {
            omikujiPullCurrencyOwned = totalCurrencies[pullCurrency] ?? 0;
            if (boxPullCurrencyForOmikuji > 0) {
                omikujiPullCurrencyOwned = boxPullCurrencyForOmikuji;
            }
            omikujiGachaProcessed = false;
            omikujiGachaAvgSD = {};
            event_data.omikuji_pull_rewards = {};
            event_data.omikuji_pull_currency_owned = omikujiPullCurrencyOwned ?? 0;
        }

        if (displayIncluded['OmikujiRewards']) {

            let intResults = AddOmikujiRewards(totalEleph, totalArtifacts);
            if (intResults) {
                totalCredit += intResults[0];
                totalEligma += intResults[1];
            }
        }
    }

    if (event_config.events[current_event].dice_race) {

        let rollCurrency = event_config.events[current_event].dice_race.roll_currency;

        let changed = false;
        if (diceRollCurrencyOwned != totalCurrencies[rollCurrency]) {
            changed = true;
        }

        if (changed) {
            diceRollCurrencyOwned = totalCurrencies[rollCurrency] ?? 0;
            diceGachaProcessed = false;
            diceGachaAvgSD = {};
            event_data.dice_roll_rewards = {};
            event_data.dice_roll_currency_owned = diceRollCurrencyOwned ?? 0;
        }

        if (displayIncluded['DiceRewards']) {

            let intResults = AddDiceRewards(totalEleph, totalXps);
            if (intResults) {
                totalCredit += intResults[0];
                totalEligma += intResults[1];
                totalSecretTech += intResults[2];
                totalGearBoxes += intResults[3];
            }
        }
    }

    if (optimisationType == "Currency") {

        currencyNames = Object.keys(totalCurrencies);
        for (let i = 0; i < currencyNames.length; i++) {

            let leftoverCurrency = totalCurrencies[currencyNames[i]] - currencyNeededPre[currencyNames[i]];

            if (!event_config.events[current_event].shops) {
                continue;
            }

            let shop = event_config.events[current_event].shops[currencyNames[i]];

            if (!shop) {
                continue;
            }

            for (let ii = 0; ii < shop.length; ii++) {
                if (shop[ii].overflow) {
                    let overflowAmount = Math.max(Math.min(Math.floor(leftoverCurrency / shop[ii].cost), shop[ii].overflow_cap), 0);
                    event_data.shop_purchases["overflow_" + currencyNames[i]] = {};
                    event_data.shop_purchases["overflow_" + currencyNames[i]][shop[ii].id] = overflowAmount;
                    if (!event_data.shop_purchases[currencyNames[i]]) {
                        event_data.shop_purchases[currencyNames[i]] = {};
                    }
                    event_data.shop_purchases[currencyNames[i]][shop[ii].id] = 0;
                }
            }
        }
    }
    else {
        storedPurchaseNames = Object.keys(event_data.shop_purchases);
        for (let i = 0; i < storedPurchaseNames.length; i++) {
            if (storedPurchaseNames[i].substring(0, 9) == "overflow_") {
                event_data.shop_purchases[storedPurchaseNames[i]] = {};
            }
        }
    }

    if (displayIncluded['ShopPurchases']) {
        let intResults = AddShopPurchases(totalArtifacts, totalSchoolMats, totalEleph, totalXps, 0, 0, 0);
        if (intResults) {
            if (!isNaN(intResults)) {
                totalCredit += intResults[0];
            }
            totalEligma += intResults[1];
            totalSecretTech += intResults[2];
        }
        if (current_event == "serenade-promenade") {
            if (totalEleph["10058"]) {
                totalEleph["16016"] ??= 0;
                totalEleph["16016"] += totalEleph["10058"];
                totalEleph["10058"] = 0;
            }
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

    //TEMP
    if (current_event == "hakua-calling-card-rerun") {
        let minigameRuns = math.max(math.floor(totalCurrencies["Mansion_Invitation"] / 400), 0);
        if (minigameRuns > 0) {
            if (!totalEleph["26009"]) {
                totalEleph["26009"] = 0;
            }
            totalEleph["26009"] += 2 * minigameRuns;
            totalCredit += 250000 * minigameRuns;
            if (!totalXps["XP_3"]) {
                totalXps["XP_3"] = 0;
            }
            totalXps["XP_3"] += minigameRuns;
            if (!totalXps["GXP_3"]) {
                totalXps["GXP_3"] = 0;
            }
            totalXps["GXP_3"] += minigameRuns;
        }
    }
    else if (current_event == "hidden-heritage-rerun") {
        let tempPoints = totalCurrencies["Event_Point"] - 8000;
        if (midEvent) {
            tempPoints = totalCurrencies["Event_Point"];
        }
        let boardLaps = Math.max(Math.floor(tempPoints / 5100), 0);

        let leftoverPoints = tempPoints - boardLaps * 5100;
        let lapLeftover = 0;
        if (leftoverPoints >= 3900) {
            lapLeftover = 3;
        }
        else if (leftoverPoints >= 2700) {
            lapLeftover = 2;
        }
        else if (leftoverPoints >= 1200) {
            lapLeftover = 1;
        }

        totalEleph["16013"] = 0;
        if (!totalArtifacts["Wolfsegg_1"]) {
            totalArtifacts["Wolfsegg_1"] = 0;
        }
        if (!totalArtifacts["Wolfsegg_2"]) {
            totalArtifacts["Wolfsegg_2"] = 0;
        }
        if (!totalArtifacts["Wolfsegg_3"]) {
            totalArtifacts["Wolfsegg_3"] = 0;
        }
        if (!totalArtifacts["Wolfsegg_4"]) {
            totalArtifacts["Wolfsegg_4"] = 0;
        }
        if (!totalArtifacts["Antikythera_1"]) {
            totalArtifacts["Antikythera_1"] = 0;
        }
        if (!totalArtifacts["Antikythera_2"]) {
            totalArtifacts["Antikythera_2"] = 0;
        }
        if (!totalArtifacts["Antikythera_3"]) {
            totalArtifacts["Antikythera_3"] = 0;
        }
        if (!totalArtifacts["Antikythera_4"]) {
            totalArtifacts["Antikythera_4"] = 0;
        }
        if (!totalArtifacts["Fleece_1"]) {
            totalArtifacts["Fleece_1"] = 0;
        }
        if (!totalArtifacts["Fleece_2"]) {
            totalArtifacts["Fleece_2"] = 0;
        }
        if (!totalArtifacts["Fleece_3"]) {
            totalArtifacts["Fleece_3"] = 0;
        }
        if (!totalArtifacts["Fleece_4"]) {
            totalArtifacts["Fleece_4"] = 0;
        }
        if (!totalArtifacts["RomanDice_1"]) {
            totalArtifacts["RomanDice_1"] = 0;
        }
        if (!totalArtifacts["RomanDice_2"]) {
            totalArtifacts["RomanDice_2"] = 0;
        }
        if (!totalArtifacts["RomanDice_3"]) {
            totalArtifacts["RomanDice_3"] = 0;
        }
        if (!totalArtifacts["RomanDice_4"]) {
            totalArtifacts["RomanDice_4"] = 0;
        }

        if (midEvent) {
            boardLaps += 3;
        }
        else {

            totalCredit += 8000000 * Math.min(boardLaps, 3);
            totalEleph["16013"] += 40 * Math.min(boardLaps, 3);

            totalArtifacts["Wolfsegg_1"] += 20 * Math.min(boardLaps, 3);

            totalArtifacts["Wolfsegg_2"] += 6 * Math.min(boardLaps, 3);

            totalArtifacts["Wolfsegg_3"] += 4 * Math.min(boardLaps, 3);

            totalArtifacts["Wolfsegg_4"] += 2 * Math.min(boardLaps, 3);

            totalArtifacts["Antikythera_1"] += 20 * Math.min(boardLaps, 3);

            totalArtifacts["Antikythera_2"] += 6 * Math.min(boardLaps, 3);

            totalArtifacts["Antikythera_3"] += 4 * Math.min(boardLaps, 3);

            totalArtifacts["Antikythera_4"] += 2 * Math.min(boardLaps, 3);

            totalArtifacts["Fleece_1"] += 20 * Math.min(boardLaps, 3);

            totalArtifacts["Fleece_2"] += 6 * Math.min(boardLaps, 3);

            totalArtifacts["Fleece_3"] += 4 * Math.min(boardLaps, 3);

            totalArtifacts["Fleece_4"] += 2 * Math.min(boardLaps, 3);

            totalArtifacts["RomanDice_1"] += 20 * Math.min(boardLaps, 3);

            totalArtifacts["RomanDice_2"] += 6 * Math.min(boardLaps, 3);

            totalArtifacts["RomanDice_3"] += 4 * Math.min(boardLaps, 3);

            totalArtifacts["RomanDice_4"] += 2 * Math.min(boardLaps, 3);

        }

        if (boardLaps > 3) {
            totalCredit += 4000000 * (boardLaps - 3);
            totalEleph["16013"] += 20 * (boardLaps - 3);
            totalArtifacts["Wolfsegg_1"] += 4 * (boardLaps - 3);
            totalArtifacts["Wolfsegg_2"] += 3 * (boardLaps - 3);
            totalArtifacts["Wolfsegg_3"] += 2 * (boardLaps - 3);
            totalArtifacts["Wolfsegg_4"] += 1 * (boardLaps - 3);
            totalArtifacts["Antikythera_1"] += 4 * (boardLaps - 3);
            totalArtifacts["Antikythera_2"] += 3 * (boardLaps - 3);
            totalArtifacts["Antikythera_3"] += 2 * (boardLaps - 3);
            totalArtifacts["Antikythera_4"] += 1 * (boardLaps - 3);
            totalArtifacts["Fleece_1"] += 4 * (boardLaps - 3);
            totalArtifacts["Fleece_2"] += 3 * (boardLaps - 3);
            totalArtifacts["Fleece_3"] += 2 * (boardLaps - 3);
            totalArtifacts["Fleece_4"] += 1 * (boardLaps - 3);
            totalArtifacts["RomanDice_1"] += 4 * (boardLaps - 3);
            totalArtifacts["RomanDice_2"] += 3 * (boardLaps - 3);
            totalArtifacts["RomanDice_3"] += 2 * (boardLaps - 3);
            totalArtifacts["RomanDice_4"] += 1 * (boardLaps - 3);
        }

        if (lapLeftover >= 1) {
            if (boardLaps > 2) {
                totalCredit += 1000000;
                totalEleph["16013"] += 5;
                totalArtifacts["Wolfsegg_1"] += 4;
                totalArtifacts["Wolfsegg_2"] += 3;
                totalArtifacts["Wolfsegg_3"] += 2;
                totalArtifacts["Wolfsegg_4"] += 1;
            }
            else {
                totalCredit += 2000000;
                totalEleph["16013"] += 10;
                totalArtifacts["Wolfsegg_1"] += 20;
                totalArtifacts["Wolfsegg_2"] += 6;
                totalArtifacts["Wolfsegg_3"] += 4;
                totalArtifacts["Wolfsegg_4"] += 2;
            }

            if (lapLeftover >= 2) {
                if (boardLaps > 2) {
                    totalCredit += 1000000;
                    totalEleph["16013"] += 5;
                    totalArtifacts["Antikythera_1"] += 4;
                    totalArtifacts["Antikythera_2"] += 3;
                    totalArtifacts["Antikythera_3"] += 2;
                    totalArtifacts["Antikythera_4"] += 1;
                }
                else {
                    totalCredit += 2000000;
                    totalEleph["16013"] += 10;
                    totalArtifacts["Antikythera_1"] += 20;
                    totalArtifacts["Antikythera_2"] += 6;
                    totalArtifacts["Antikythera_3"] += 4;
                    totalArtifacts["Antikythera_4"] += 2;
                }

                if (lapLeftover == 3) {
                    if (boardLaps > 2) {
                        totalCredit += 1000000;
                        totalEleph["16013"] += 5;
                        totalArtifacts["Fleece_1"] += 4;
                        totalArtifacts["Fleece_2"] += 3;
                        totalArtifacts["Fleece_3"] += 2;
                        totalArtifacts["Fleece_4"] += 1;
                    }
                    else {
                        totalCredit += 2000000;
                        totalEleph["16013"] += 10;
                        totalArtifacts["Fleece_1"] += 20;
                        totalArtifacts["Fleece_2"] += 6;
                        totalArtifacts["Fleece_3"] += 4;
                        totalArtifacts["Fleece_4"] += 2;
                    }
                }
            }
        }
    }
    else if (current_event == "momoyodou-beach-house") {
        totalEleph["26008"] = Math.floor((totalCurrencies["Local_Currency"] ?? 0) / 300);
        if (document.getElementById("upgrade-bases").checked) {
            totalEleph["26008"] += 87;
        }
    }
    else if (current_event == "trip-trap-train") {
        if (!totalXps["XP_1"]) {
            totalXps["XP_1"] = 0;
        }

        totalXps["XP_1"] += 100;

        if (!totalXps["XP_2"]) {
            totalXps["XP_2"] = 0;
        }

        totalXps["XP_2"] += 100;

        if (!totalXps["XP_3"]) {
            totalXps["XP_3"] = 0;
        }

        totalXps["XP_3"] += 50;

        if (!totalXps["XP_4"]) {
            totalXps["XP_4"] = 0;
        }

        totalXps["XP_4"] += 30;

        totalCredit += 46000000;

        if (totalCurrencies["Ticket"] >= 2000) {
            totalEleph["13003"] = 20;
            if (totalCurrencies["Ticket"] >= 3000) {
                totalEleph["13003"] += 5;
                if (totalCurrencies["Ticket"] >= 4500) {
                    totalEleph["13003"] += 5;
                    if (totalCurrencies["Ticket"] >= 6000) {
                        totalEleph["13003"] += 10;
                        if (totalCurrencies["Ticket"] > 7500) {
                            totalEleph["13003"] += 10;
                        }
                    }
                }
            }
        }

        if (totalCurrencies["Attache_Case"] >= 2000) {
            totalEleph["10006"] = 20;
            if (totalCurrencies["Attache_Case"] >= 3000) {
                totalEleph["10006"] += 5;
                if (totalCurrencies["Attache_Case"] >= 4500) {
                    totalEleph["10006"] += 5;
                    if (totalCurrencies["Attache_Case"] >= 6000) {
                        totalEleph["10006"] += 10;
                        if (totalCurrencies["Attache_Case"] > 7500) {
                            totalEleph["10006"] += 10;
                        }
                    }
                }
            }
        }

        if (totalCurrencies["Crew_Whistle"] >= 2000) {
            totalEleph["10013"] = 20;
            if (totalCurrencies["Crew_Whistle"] >= 3000) {
                totalEleph["10013"] += 5;
                if (totalCurrencies["Crew_Whistle"] >= 4500) {
                    totalEleph["10013"] += 5;
                    if (totalCurrencies["Crew_Whistle"] >= 6000) {
                        totalEleph["10013"] += 10;
                        if (totalCurrencies["Crew_Whistle"] > 7500) {
                            totalEleph["10013"] += 10;
                        }
                    }
                }
            }
        }

        let totalTokens = totalCurrencies["Ticket"] + totalCurrencies["Attache_Case"] + totalCurrencies["Crew_Whistle"];

        if (totalTokens >= 3000) {
            totalEligma += 20;
            if (totalTokens >= 6000) {
                totalEligma += 20;
                if (totalTokens >= 10000) {
                    totalEligma += 20;
                    if (totalTokens >= 15000) {
                        totalEligma += 20;
                        if (totalTokens > 20000) {
                            totalEligma += 20;
                        }
                    }
                }
            }
        }

        if (!totalXps["GXP_1"]) {
            totalXps["GXP_1"] = 0;
        }
        if (!totalXps["GXP_2"]) {
            totalXps["GXP_2"] = 0;
        }
        if (!totalXps["GXP_3"]) {
            totalXps["GXP_3"] = 0;
        }
        if (!totalXps["GXP_4"]) {
            totalXps["GXP_4"] = 0;
        }

        if (totalCurrencies["Event_Point"] >= 3000) {
            totalXps["GXP_1"] += 100;
            totalXps["GXP_2"] += 50;
            if (totalCurrencies["Event_Point"] >= 5000) {
                totalXps["GXP_2"] += 50;
                if (totalCurrencies["Event_Point"] >= 7000) {
                    totalXps["GXP_3"] += 20;
                    if (totalCurrencies["Event_Point"] >= 9000) {
                        totalXps["GXP_3"] += 30;
                        if (totalCurrencies["Event_Point"] > 11000) {
                            totalXps["GXP_4"] += 30;
                        }
                    }
                }
            }
        }

        if (!totalArtifacts["Antikythera_1"]) {
            totalArtifacts["Antikythera_1"] = 0;
        }
        if (!totalArtifacts["Antikythera_2"]) {
            totalArtifacts["Antikythera_2"] = 0;
        }
        if (!totalArtifacts["Antikythera_3"]) {
            totalArtifacts["Antikythera_3"] = 0;
        }
        if (!totalArtifacts["Antikythera_4"]) {
            totalArtifacts["Antikythera_4"] = 0;
        }

        if (!totalArtifacts["Rohonc_1"]) {
            totalArtifacts["Rohonc_1"] = 0;
        }
        if (!totalArtifacts["Rohonc_2"]) {
            totalArtifacts["Rohonc_2"] = 0;
        }
        if (!totalArtifacts["Rohonc_3"]) {
            totalArtifacts["Rohonc_3"] = 0;
        }
        if (!totalArtifacts["Rohonc_4"]) {
            totalArtifacts["Rohonc_4"] = 0;
        }

        totalArtifacts["Antikythera_1"] += 60;
        totalArtifacts["Antikythera_2"] += 40;
        totalArtifacts["Antikythera_3"] += 30;
        totalArtifacts["Antikythera_4"] += 12;

        totalArtifacts["Rohonc_1"] += 60;
        totalArtifacts["Rohonc_2"] += 40;
        totalArtifacts["Rohonc_3"] += 30;
        totalArtifacts["Rohonc_4"] += 12;
    }

    if (feasible) {
        UpdateRewardsObtained(totalCurrencies, energyCost, totalArtifacts, totalSchoolMats, totalEleph, totalXps,
            totalCredit, totalEligma, totalSecretTech, totalGearBoxes, totalGear);
        stage_runs = stageRuns;
    }
    else {
        ClearRewards();
        InfeasibleModel();
        if (!ignoreRequirement) {
            stage_runs = {};
        }
    }

    Save(5);
}

function GetBoxPullCurrencyForOmikuji(totalCurrencies) {

    let boxPullCurrencyForOmikuji = 0;
    if (event_config.events[current_event].boxes) {
        let boxPullCurrency;
        let currencyNames = Object.keys(event_config.events[current_event].currencies);
        let currencies = event_config.events[current_event].currencies;

        for (let i = 0; i < currencyNames.length; i++) {

            if (currencies[currencyNames[i]].source == "BoxPull") {

                boxPullCurrency = currencies[currencyNames[i]].pull_currency;
            }
        }

        boxPullCurrencyForOmikuji = CalculateBoxDropCurrencyFromBoxCurrency(totalCurrencies[boxPullCurrency]);
    }

    return boxPullCurrencyForOmikuji;
}

function AddShopPurchases(totalArtifacts, totalSchoolMats, totalEleph, totalXps, totalCredit, totalEligma, totalSecretTech) {

    let shops = Object.keys(event_data.shop_purchases);

    let shopPurchaseables = {};

    let configShops = Object.keys(event_config.events[current_event].shops);
    for (let i = 0; i < configShops.length; i++) {

        let configShop = event_config.events[current_event].shops[configShops[i]];

        for (let ii = 0; ii < configShop.length; ii++) {
            shopPurchaseables[configShop[ii].id] = configShop[ii];
        }
    }

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

                    totalEleph[items[ii]] += (parseInt(shop[items[ii]]) * (shopPurchaseables[items[ii]].amount ?? 1));

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

                totalXps[items[ii]] += parseInt(shop[items[ii]]) * (shopPurchaseables[items[ii]].amount ?? 1);
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
            else if (lessonRewardTemplate[ii].type == "Credit") {
                totalCredit += lessonRewardTemplate[ii].count;
            }
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
            else if (lessonRewardTemplate[ii].type == "Credit") {
                totalCredit += itemAmountAdded;
            }
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

    return [totalCredit, totalEligma];
}

function AddCardRewards(pullCurrency, totalCurrencies, totalArtifacts, totalEleph, totalXps) {

    if (!event_config.events[current_event].card_drops) {
        return;
    }

    let totalCredit = 0;
    let totalEligma = 0;

    let rewardNames = Object.keys(cardGachaAvgSD);

    for (i = 0; i < rewardNames.length; i++) {

        let rewardName = rewardNames[i];
        let nameInt = parseInt(rewardName);
        let matId = matLookup.reverseMap[rewardName];

        let rewardAmount = math.round(cardGachaAvgSD[rewardName].mean + (setSD * cardGachaAvgSD[rewardName].std));

        if (rewardAmount == 0) {
            continue;
        }

        if (rewardName == "Credit") {
            totalCredit += rewardAmount;
        }
        else if (rewardName == "Eligma") {
            totalEligma += rewardAmount;
        }
        else if (rewardName == pullCurrency) {

            if (!totalCurrencies[pullCurrency]) {
                totalCurrencies[pullCurrency] = 0;
            }

            totalCurrencies[pullCurrency] += rewardAmount;
        }
        else if (rewardName.includes("XP_")) {

            if (!totalXps[rewardName]) {
                totalXps[rewardName] = 0;
            }

            totalXps[rewardName] += rewardAmount;
        }
        else if (nameInt) {

            if (nameInt >= 10000 && nameInt < 30000) {

                if (!totalEleph[rewardName]) {
                    totalEleph[rewardName] = 0;
                }

                totalEleph[rewardName] += rewardAmount;
            }
        }
        else if (matId) {

            if (matId < 1000) {

                if (!totalArtifacts[rewardName]) {
                    totalArtifacts[rewardName] = 0;
                }

                totalArtifacts[rewardName] += rewardAmount;
            }
        }
    }

    return [totalCredit, totalEligma];
}

function AddOmikujiRewards(totalEleph, totalArtifacts) {

    if (!event_config.events[current_event].omikuji) {
        return;
    }

    let totalCredit = 0, totalEligma = 0;

    let rewardNames = Object.keys(omikujiGachaAvgSD);

    for (i = 0; i < rewardNames.length; i++) {

        let rewardName = rewardNames[i];
        let nameInt = parseInt(rewardName);
        let matName = matLookup.map[rewardName];

        let rewardAmount = math.round(omikujiGachaAvgSD[rewardName].mean + (setSD * omikujiGachaAvgSD[rewardName].std));

        if (rewardAmount == 0) {
            continue;
        }

        if (nameInt && nameInt == 1) {
            totalCredit += rewardAmount;
        }
        // else if (rewardName == pullCurrency) {

        //     if (!totalCurrencies[pullCurrency]) {
        //         totalCurrencies[pullCurrency] = 0;
        //     }

        //     totalCurrencies[pullCurrency] += rewardAmount;
        // }
        // else if (rewardName.includes("XP_")) {

        //     if (!totalXps[rewardName]) {
        //         totalXps[rewardName] = 0;
        //     }

        //     totalXps[rewardName] += rewardAmount;
        // }
        else if (nameInt && nameInt == 23) {
            totalEligma += rewardAmount;
        }
        else if (nameInt) {

            if (nameInt < 1000) {

                if (!totalArtifacts[matName]) {
                    totalArtifacts[matName] = 0;
                }

                totalArtifacts[matName] += rewardAmount;
            }
            else if (nameInt >= 10000 && nameInt < 30000) {

                if (!totalEleph[rewardName]) {
                    totalEleph[rewardName] = 0;
                }

                totalEleph[rewardName] += rewardAmount;
            }
        }
    }

    return [totalCredit, totalEligma];
}

function AddDiceRewards(totalEleph, totalXps) {

    if (!event_config.events[current_event].dice_race) {
        return;
    }

    let totalCredit = 0, totalEligma = 0, totalSecretTech = 0, totalGearBoxes = 0;

    let rewardNames = Object.keys(diceGachaAvgSD);

    for (i = 0; i < rewardNames.length; i++) {

        let rewardName = rewardNames[i];
        let nameInt = parseInt(rewardName);
        // let matId = matLookup.reverseMap[rewardName];

        let rewardAmount = math.round(diceGachaAvgSD[rewardName].mean + (setSD * diceGachaAvgSD[rewardName].std));

        if (rewardAmount == 0) {
            continue;
        }

        if (rewardName == "Credit") {
            totalCredit += rewardAmount;
        }
        // else if (rewardName == pullCurrency) {

        //     if (!totalCurrencies[pullCurrency]) {
        //         totalCurrencies[pullCurrency] = 0;
        //     }

        //     totalCurrencies[pullCurrency] += rewardAmount;
        // }
        else if (rewardName.includes("XP_")) {

            if (!totalXps[rewardName]) {
                totalXps[rewardName] = 0;
            }

            totalXps[rewardName] += rewardAmount;
        }
        else if (rewardName == "Eligma") {
            totalEligma += rewardAmount;
        }
        else if (rewardName == "SecretTech") {
            totalSecretTech += rewardAmount;
        }
        else if (rewardName == "GearBox") {
            totalGearBoxes += rewardAmount;
        }
        else if (nameInt) {

            if (nameInt >= 10000 && nameInt < 30000) {

                if (!totalEleph[rewardName]) {
                    totalEleph[rewardName] = 0;
                }

                totalEleph[rewardName] += rewardAmount;
            }
        }
        // else if (matId) {

        //     if (matId < 1000) {

        //         if (!totalArtifacts[rewardName]) {
        //             totalArtifacts[rewardName] = 0;
        //         }

        //         totalArtifacts[rewardName] += rewardAmount;
        //     }
        // }
    }

    return [totalCredit, totalEligma, totalSecretTech, totalGearBoxes]
}

function AddInvasionRewards(totalCurrencies, totalEleph, totalXps) {

    if (!event_config.events[current_event].invasion_stages) {
        return;
    }

    let remainingResets = resets_total - 1;

    if (midEvent) {
        remainingResets = resets_left;
    }

    let invasionStages = event_config.events[current_event].invasion_stages;

    let maxStage = event_config.events[current_event].invasion_config.max_stage;
    let dailyAttempts = event_config.events[current_event].invasion_config.daily_attempts;
    let firstDayAttempts = event_config.events[current_event].invasion_config.first_day_attempts;

    let invasionCredit = 0;

    if (!midEvent) {
        for (let i = 0; i < Math.min(invasionStages.length, maxStage); i++) {
            let dropNames = Object.keys(invasionStages[i].drops);
            for (let r = 0; r < dropNames.length; r++) {
                let itemType = invasionStages[i].drop_key[r];

                let itemAmountAdded = 0;

                if (i + 1 == maxStage) {
                    itemAmountAdded = invasionStages[i].drops[dropNames[r]] * (firstDayAttempts - maxStage + 1);
                }
                else {
                    itemAmountAdded = invasionStages[i].drops[dropNames[r]];
                }

                let intResults = InvasionRewardAdd(itemType, dropNames[r], itemAmountAdded, totalCurrencies, totalEleph, totalXps);
                invasionCredit += intResults[0];
            }

            dropNames = Object.keys(invasionStages[i].initial);
            for (let r = 0; r < dropNames.length; r++) {
                let itemType = invasionStages[i].initial_key[r];

                let itemAmountAdded = invasionStages[i].initial[dropNames[r]];

                let intResults = InvasionRewardAdd(itemType, dropNames[r], itemAmountAdded, totalCurrencies, totalEleph, totalXps);
                invasionCredit += intResults[0];
            }
        }
    }


    let dropNames = Object.keys(invasionStages[maxStage - 1].drops);
    for (let r = 0; r < dropNames.length; r++) {
        let itemType = invasionStages[maxStage - 1].drop_key[r];

        let itemAmountAdded = invasionStages[maxStage - 1].drops[dropNames[r]] * dailyAttempts * remainingResets;

        let intResults = InvasionRewardAdd(itemType, dropNames[r], itemAmountAdded, totalCurrencies, totalEleph, totalXps);
        invasionCredit += intResults[0];
    }

    return [invasionCredit];
}

function InvasionRewardAdd(itemType, itemName, itemAmount, totalCurrencies, totalEleph, totalXps) {
    let internalAddCredit = 0;

    if (itemType == "Eleph") {
        if (!totalEleph[itemName]) { totalEleph[itemName] = 0; }
        totalEleph[itemName] += itemAmount;
    }
    else if (itemType == "XP") {
        if (!totalXps[itemName]) { totalXps[itemName] = 0; }
        totalXps[itemName] += itemAmount;
    }
    else if (itemType == "Credit") {
        internalAddCredit += itemAmount;
    }
    else if (itemType == "Currency") {
        if (!totalCurrencies[itemName]) { totalCurrencies[itemName] = 0; }
        totalCurrencies[itemName] += itemAmount;
    }

    return [internalAddCredit];
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

function UpdateRewardsObtained(totalCurrencies, energyCost, totalArtifacts, totalSchoolMats, totalEleph, totalXps, totalCredit, totalEligma, totalSecretTech, totalGearBoxes,
    totalGear) {

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
    let gearContainer = document.createElement('div');
    gearContainer.className = "reward-group";

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

        currentSubDiv.appendChild(CreateRewardItem("icons/Artifact/" + name + ".webp", totalArtifacts[name].toFixed(1),
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

        currentSubDiv.appendChild(CreateRewardItem("icons/SchoolMat/" + name + ".webp", totalSchoolMats[name].toFixed(1), ''));
        //'drop-resource-rarity-' + dropRarity + ' drop-resource'));
    })

    if (totalGearBoxes) {
        xpMatsContainer.appendChild(CreateRewardItem("icons/MiscItem/Random_Equipment_Box_0.png", totalGearBoxes, ""));
    }

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

    let gearNames = Object.keys(totalGear).sort().reverse();

    gearNames.forEach((name) => {

        // dropSliced = name.slice(0, -2);
        // dropRarity = name.slice(-1);

        // if (currentMatType != dropSliced) {
        //     currentSubDiv = document.createElement('div');
        //     currentSubDiv.className = "reward-group";
        //     artifactsContainer.appendChild(currentSubDiv);

        //     currentMatType = dropSliced;
        // }

        // currentSubDiv.appendChild(CreateRewardItem("icons/Artifact/" + name + ".webp", totalArtifacts[name].toFixed(1),
        //     'drop-resource-rarity-' + dropRarity + ' drop-resource'));

        gearContainer.appendChild(CreateRewardItem("icons/Gear/" + name + ".webp", totalGear[name].toFixed(0), ""));
    })

    rewardsContainer.appendChild(currenciesContainer);
    rewardsContainer.appendChild(elephContainer);
    rewardsContainer.appendChild(miscContainer);
    rewardsContainer.appendChild(xpMatsContainer);
    rewardsContainer.appendChild(schoolMatsContainer);
    rewardsContainer.appendChild(artifactsContainer);
    rewardsContainer.appendChild(gearContainer);
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
        Save(5);
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
        Save(5);
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

    let table1 = GetNewTable([GetLanguageString("label-points"), GetLanguageString("label-rewards")]);
    let table1Body = table1.getElementsByTagName('tbody')[0];
    let table2 = GetNewTable([GetLanguageString("label-points"), GetLanguageString("label-rewards")]);
    let table2Body = table2.getElementsByTagName('tbody')[0];
    let table3 = GetNewTable([GetLanguageString("label-points"), GetLanguageString("label-rewards")]);
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
            if (midEvent) {
                let currencyInt = 0;
                if (event_data.currency_owned && event_data.currency_owned["Event_Point"]) {
                    currencyInt = parseInt(event_data.currency_owned["Event_Point"]);
                }

                event_point_target = Math.max(pointTargetClicked - currencyInt);
            }
            else {
                event_point_target = Math.max(pointTargetClicked - initialClearRewards["Event_Point"], 0);
            }

            RefreshDropsDisplay();

            HighlightPointTiers(pointTargetClicked);

            Save(5);
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
    else if (rewardType == "Pyroxene") {
        dropImg.src = "icons/Misc/Pyroxene.png";
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

                    Save(5);

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

    Save(5);

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

    SetItemImage(itemImg, item, replacementId, false);

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

    Save(5);

    GenerateLessonsTab();
}

function UpdateNotifications() {

    if (enabledBonusUnits.length == 0 && current_event != "aha-conquest") {
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

    if (event_config.events[current_event].card_drops && Object.keys(cardGachaAvgSD).length == 0 && !(cardPullCurrencyOwned == 0)) {
        document.getElementById('notification-cards').style.display = '';
    }
    else {
        document.getElementById('notification-cards').style.display = 'none';
    }

    if (event_config.events[current_event].omikuji && Object.keys(omikujiGachaAvgSD).length == 0 && !(omikujiPullCurrencyOwned == 0)) {
        document.getElementById('notification-omikuji').style.display = '';
    }
    else {
        document.getElementById('notification-omikuji').style.display = 'none';
    }

    let ownedCurrencies = Object.keys(event_data.currency_owned ?? {});

    let anyOwned = false;
    midEvent = false;

    for (let i = 0; i < ownedCurrencies.length; i++) {
        let amount = event_data.currency_owned[ownedCurrencies[i]];
        if (amount && parseInt(amount) > 0) {
            anyOwned = true;
            midEvent = true;
        }
    }

    if (midEvent) {
        document.getElementById("energy-source-carryover").style.display = "none"; //.backgroundColor = "transparent";
    }
    else {
        document.getElementById("energy-source-carryover").style.display = ""; //.backgroundColor = "";
    }

    if (anyOwned) {
        document.getElementById('notification-owned').style.display = '';
    }
    else {
        document.getElementById('notification-owned').style.display = 'none';
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

        if (currencies[currencyNames[i]].source == "BoxPull" || currencies[currencyNames[i]].source == "CardPull") {
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

    Save(5);
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

function LoadCardGachaChances() {

    let cardDrops = event_config.events[current_event].card_drops;

    if (!cardDrops) {
        return;
    }

    let sum = 0;

    let cumChancesArray = [];

    for (i = 0; i < cardDrops.length; i++) {

        sum += cardDrops[i].chance;

        cumChancesArray.push(sum);
    }

    for (i = 0; i < cumChancesArray.length; i++) {

        cumChancesArray[i] = cumChancesArray[i] / sum;
    }

    cardGachaChances[0] = cumChancesArray;
    cardGachaChances[1] = cardGachaChances[0];
    cardGachaChances[2] = cardGachaChances[1];

    let sum2 = 0;

    let cumChancesArray2 = [];

    for (i = 0; i < cardDrops.length; i++) {

        if (!(cardDrops[i].icon.substring(0, 2) == "UR" || cardDrops[i].icon.substring(0, 2) == "SR")) {
            break;
        }

        sum2 += cardDrops[i].chance4;

        cumChancesArray2.push(sum2);
    }

    for (i = 0; i < cumChancesArray2.length; i++) {

        cumChancesArray2[i] = cumChancesArray2[i] / sum2;
    }

    cardGachaChances[3] = cumChancesArray2;
}

// let startsTime;
function SimulateCardGacha() {

    if (cardGachaProcessed) {
        return;
    }

    cardGachaSimResults = {};
    completedWorkers = [];

    let card_drop_event = current_event + "";

    // startsTime = new Date();
    const worker1 = new Worker("js/cardGachaWorker.js");
    const worker2 = new Worker("js/cardGachaWorker.js");
    const worker3 = new Worker("js/cardGachaWorker.js");
    const worker4 = new Worker("js/cardGachaWorker.js");

    worker1.onmessage = (e) => {
        completedWorkers.push(1);
        CombineObjectArrays(e.data, cardGachaSimResults);
        ProcessSimResults(card_drop_event);
    }
    worker2.onmessage = (e) => {
        completedWorkers.push(2);
        CombineObjectArrays(e.data, cardGachaSimResults);
        ProcessSimResults(card_drop_event);
    }
    worker3.onmessage = (e) => {
        completedWorkers.push(3);
        CombineObjectArrays(e.data, cardGachaSimResults);
        ProcessSimResults(card_drop_event);
    }
    worker4.onmessage = (e) => {
        completedWorkers.push(4);
        CombineObjectArrays(e.data, cardGachaSimResults);
        ProcessSimResults(card_drop_event);
    }

    let cardDrops = event_config.events[current_event].card_drops;

    worker1.postMessage([cardDrops, cardGachaChances, 3000, 100000, cardPullCurrencyOwned]);
    worker2.postMessage([cardDrops, cardGachaChances, 3000, 100000, cardPullCurrencyOwned]);
    worker3.postMessage([cardDrops, cardGachaChances, 3000, 100000, cardPullCurrencyOwned]);
    worker4.postMessage([cardDrops, cardGachaChances, 3000, 100000, cardPullCurrencyOwned]);
}

function ProcessSimResults(eventName) {

    if (completedWorkers.length != 4) {
        return;
    }

    if (eventName != current_event) {
        cardGachaSimResults = {};
        cardGachaProcessing = false;
        return;
    }

    let rewardNames = Object.keys(cardGachaSimResults);

    for (i = 0; i < rewardNames.length; i++) {

        cardGachaAvgSD[rewardNames[i]] = {};

        cardGachaAvgSD[rewardNames[i]].std = math.std(cardGachaSimResults[rewardNames[i]]);
        cardGachaAvgSD[rewardNames[i]].mean = math.mean(cardGachaSimResults[rewardNames[i]]);
    }

    events_data[eventName].card_pull_rewards = cardGachaAvgSD;
    events_data[eventName].card_pull_currency_owned = cardPullCurrencyOwned ?? 0;

    Swal.fire({
        toast: true,
        position: 'top-start',
        title: ('Simulated ' + cardGachaSimResults["Credit"].length + " attempts"),
        showConfirmButton: false,
        timer: 3000
    })

    cardGachaSimResults = {};

    RefreshDropsDisplay();

    cardGachaProcessing = false;
    cardGachaProcessed = true;

    UpdateNotifications();

    Save(5);
}

function CombineObjectArrays(source, target) {

    let sourceKeys = Object.keys(source);

    for (i = 0; i < sourceKeys.length; i++) {
        if (!target[sourceKeys[i]]) {
            target[sourceKeys[i]] = source[sourceKeys[i]];
        }
        else {
            target[sourceKeys[i]] = target[sourceKeys[i]].concat(source[sourceKeys[i]]);
        }
    }
}

function LoadDice() {

    let diceRace = event_config.events[current_event].dice_race;

    if (!diceRace) {

        document.getElementById("tab-Dice").style.display = 'none';
        document.getElementById('Dice-tab').style.display = 'none';
        document.getElementById('include-dice-rewards').style.display = 'none';
        document.getElementById('label-dice-rewards').style.display = 'none';
        return;
    }
    else {
        document.getElementById('include-dice-rewards').style.display = '';
        document.getElementById('label-dice-rewards').style.display = '';
    }

    document.getElementById("tab-Dice").style.display = '';
    if (currentTab == "Dice") {
        document.getElementById('Dice-tab').style.display = 'block';
    }

    if (setSD || setSD == 0) {
        document.getElementById("dice-sd-slider").value = setSD;
        SDSliderChanged("dice-sd-slider", "display-standard-deviation-dice");
    }
}

function LoadOmikuji() {

    omikujiChances = [];
    let omikuji = event_config.events[current_event].omikuji;

    if (!omikuji) {

        document.getElementById('tab-Omikuji').style.display = 'none';
        document.getElementById('Omikuji-tab').style.display = 'none';
        document.getElementById('include-omikuji-rewards').style.display = 'none';
        document.getElementById('label-omikuji-rewards').style.display = 'none';
        return;
    }
    else {
        document.getElementById('include-omikuji-rewards').style.display = '';
        document.getElementById('label-omikuji-rewards').style.display = '';
    }

    document.getElementById('tab-Omikuji').style.display = '';
    if (currentTab == "Omikuji") {
        document.getElementById('Omikuji-tab').style.display = 'block';
    }

    for (let i = 0; i < omikuji.MaxPullCount - omikuji.ProbModifyStartCount; i++) {
        omikujiChances[i] = [];

        let totalChance = 0;

        for (let ii = 0; ii < omikuji.slips.length; ii++) {
            let slip = omikuji.slips[ii];
            if (slip.ProbModifyLimit == 0) {
                let adjustedProb = Math.max(slip.Prob + (Math.max(i + 1, 0) * slip.ProbModifyValue), 0);
                omikujiChances[i].push(totalChance);
                totalChance += adjustedProb;
            }
            else {
                let adjustedProb = Math.min(slip.Prob + (Math.max(i + 1, 0) * slip.ProbModifyValue), slip.ProbModifyLimit);
                omikujiChances[i].push(totalChance);
                totalChance += adjustedProb;
            }
        }
    }

    for (let i = 0; i < omikuji.slips.length; i++) {
        let slip = omikuji.slips[i];

        omikujiRewards.push([slip.Grade, slip.RewardId, slip.RewardAmount]);
    }

    if (setSD || setSD == 0) {
        document.getElementById("omikuji-sd-slider").value = setSD;
        SDSliderChanged("omikuji-sd-slider", "display-standard-deviation-omikuji");
    }
}

function SimulateOmikujiGacha() {

    if (omikujiGachaProcessed) {
        return;
    }

    omikujiGachaSimResults = {};
    completedWorkers = [];

    let omikuji_drop_event = current_event + "";

    // startsTime = new Date();
    const worker1 = new Worker("js/omikujiGachaWorker.js?1");
    const worker2 = new Worker("js/omikujiGachaWorker.js?1");
    const worker3 = new Worker("js/omikujiGachaWorker.js?1");
    const worker4 = new Worker("js/omikujiGachaWorker.js?1");

    worker1.onmessage = (e) => {
        completedWorkers.push(1);
        CombineObjectArrays(e.data, omikujiGachaSimResults);
        ProcessOmikujiResults(omikuji_drop_event);
    }
    worker2.onmessage = (e) => {
        completedWorkers.push(2);
        CombineObjectArrays(e.data, omikujiGachaSimResults);
        ProcessOmikujiResults(omikuji_drop_event);
    }
    worker3.onmessage = (e) => {
        completedWorkers.push(3);
        CombineObjectArrays(e.data, omikujiGachaSimResults);
        ProcessOmikujiResults(omikuji_drop_event);
    }
    worker4.onmessage = (e) => {
        completedWorkers.push(4);
        CombineObjectArrays(e.data, omikujiGachaSimResults);
        ProcessOmikujiResults(omikuji_drop_event);
    }

    omikujiPullCurrencyOwned = event_data.omikuji_pull_currency_owned;
    let pullCost = event_config.events[current_event].omikuji.pull_cost;
    let targetGrade = event_config.events[current_event].omikuji.TargetGrade;

    worker1.postMessage([omikujiRewards, omikujiChances, 3000, 100000, omikujiPullCurrencyOwned, pullCost, targetGrade]);
    worker2.postMessage([omikujiRewards, omikujiChances, 3000, 100000, omikujiPullCurrencyOwned, pullCost, targetGrade]);
    worker3.postMessage([omikujiRewards, omikujiChances, 3000, 100000, omikujiPullCurrencyOwned, pullCost, targetGrade]);
    worker4.postMessage([omikujiRewards, omikujiChances, 3000, 100000, omikujiPullCurrencyOwned, pullCost, targetGrade]);
}

function ProcessOmikujiResults(eventName) {

    if (completedWorkers.length != 4) {
        return;
    }

    if (eventName != current_event) {
        omikujiGachaSimResults = {};
        omikujiGachaProcessing = false;
        return;
    }

    let rewardNames = Object.keys(omikujiGachaSimResults);

    for (i = 0; i < rewardNames.length; i++) {

        omikujiGachaAvgSD[rewardNames[i]] = {};

        omikujiGachaAvgSD[rewardNames[i]].std = math.std(omikujiGachaSimResults[rewardNames[i]]);
        omikujiGachaAvgSD[rewardNames[i]].mean = math.mean(omikujiGachaSimResults[rewardNames[i]]);
    }

    events_data[eventName].omikuji_pull_rewards = omikujiGachaAvgSD;
    //events_data[eventName].omikuji_pull_currency_owned = omikujiPullCurrencyOwned ?? 0;

    Swal.fire({
        toast: true,
        position: 'top-start',
        title: ('Simulated ' + omikujiGachaSimResults["1"].length + " attempts"),
        showConfirmButton: false,
        timer: 3000
    })

    omikujiGachaSimResults = {};

    RefreshDropsDisplay();

    omikujiGachaProcessing = false;
    omikujiGachaProcessed = true;

    UpdateNotifications();

    Save(5);
}

function SimulateDiceGacha() {

    if (diceGachaProcessed) {
        return;
    }

    diceGachaSimResults = {};
    completedWorkers = [];

    let dice_drop_event = current_event + "";

    const worker1 = new Worker("js/diceGachaWorker.js?2");
    const worker2 = new Worker("js/diceGachaWorker.js?2");
    const worker3 = new Worker("js/diceGachaWorker.js?2");
    const worker4 = new Worker("js/diceGachaWorker.js?2");

    worker1.onmessage = (e) => {
        completedWorkers.push(1);
        CombineObjectArrays(e.data, diceGachaSimResults);
        ProcessDiceResults(dice_drop_event);
    }
    worker2.onmessage = (e) => {
        completedWorkers.push(2);
        CombineObjectArrays(e.data, diceGachaSimResults);
        ProcessDiceResults(dice_drop_event);
    }
    worker3.onmessage = (e) => {
        completedWorkers.push(3);
        CombineObjectArrays(e.data, diceGachaSimResults);
        ProcessDiceResults(dice_drop_event);
    }
    worker4.onmessage = (e) => {
        completedWorkers.push(4);
        CombineObjectArrays(e.data, diceGachaSimResults);
        ProcessDiceResults(dice_drop_event);
    }

    let diceRace = event_config.events[current_event].dice_race;

    worker1.postMessage([diceRace, [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []], 3000, 100000, diceRollCurrencyOwned, [1, 1, 1, 1, 1, 1]]);
    worker2.postMessage([diceRace, [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []], 3000, 100000, diceRollCurrencyOwned, [1, 1, 1, 1, 1, 1]]);
    worker3.postMessage([diceRace, [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []], 3000, 100000, diceRollCurrencyOwned, [1, 1, 1, 1, 1, 1]]);
    worker4.postMessage([diceRace, [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []], 3000, 100000, diceRollCurrencyOwned, [1, 1, 1, 1, 1, 1]]);
}
let test;
function ProcessDiceResults(eventName) {

    if (completedWorkers.length != 4) {
        return;
    }

    if (eventName != current_event) {
        diceGachaSimResults = {};
        diceGachaProcessing = false;
        return;
    }

    let rewardNames = Object.keys(diceGachaSimResults);

    for (i = 0; i < rewardNames.length; i++) {

        diceGachaAvgSD[rewardNames[i]] = {};

        diceGachaAvgSD[rewardNames[i]].std = math.std(diceGachaSimResults[rewardNames[i]]);
        diceGachaAvgSD[rewardNames[i]].mean = math.mean(diceGachaSimResults[rewardNames[i]]);
    }

    events_data[eventName].dice_roll_rewards = diceGachaAvgSD;

    Swal.fire({
        toast: true,
        position: 'top-start',
        title: ('Simulated ' + diceGachaSimResults["Credit"].length + " attempts"),
        showConfirmButton: false,
        timer: 3000
    })

    diceGachaSimResults = {};

    RefreshDropsDisplay();

    diceGachaProcessing = false;
    diceGachaProcessed = true;

    UpdateNotifications();

    Save(5);
}

let devPathListProcessed = {};
function devProcessDiceResults(data, pathIndex) {

    let rewardNames = Object.keys(data);

    devPathListProcessed[pathIndex] = {};

    for (i = 0; i < rewardNames.length; i++) {

        devPathListProcessed[pathIndex][rewardNames[i]] = {};

        devPathListProcessed[pathIndex][rewardNames[i]].std = math.std(data[rewardNames[i]]);
        devPathListProcessed[pathIndex][rewardNames[i]].mean = math.mean(data[rewardNames[i]]);
    }
}

function devWorkerFinished() {
    if (completedWorkers.length == 8) {
        devDownloadDiceResult(curChunk + "_sim.json");
        completedWorkers = [];
        devPathListProcessed = {};
        devTestNextDiceChunk();
    }
}

function devTestAllDiceChunks() {
    devSplitDicePathList();
    devTestNextDiceChunk();
}

let curChunk = 0;
function devTestNextDiceChunk() {
    if (devSplitPaths[curChunk]) {
        devRecursePathList = devSplitPaths[curChunk];
        devTestAllDicePaths(100, 50000);
        curChunk++;
    }
}

function devGetTrimmedPathList(idList) {
    let newPathList = [];
    for (let i = 0; i < idList.length; i++) {
        newPathList.push(devRecursePathList[idList[i]]);
    }

    devRecursePathList = newPathList;
}

function devTestAllDicePaths(trials, currencyAvailable) {

    let pathIndex = 0;

    let modulus = 1000;
    if (trials * currencyAvailable > 10000000) {
        modulus = 100;
    }

    let diceRace = event_config.events[current_event].dice_race;

    const worker1 = new Worker("js/diceGachaWorker.js");
    const worker2 = new Worker("js/diceGachaWorker.js");
    const worker3 = new Worker("js/diceGachaWorker.js");
    const worker4 = new Worker("js/diceGachaWorker.js");
    const worker5 = new Worker("js/diceGachaWorker.js");
    const worker6 = new Worker("js/diceGachaWorker.js");
    const worker7 = new Worker("js/diceGachaWorker.js");
    const worker8 = new Worker("js/diceGachaWorker.js");

    worker1.onmessage = (e) => {
        if (e.data == "dead") {
            completedWorkers.push("1");
            devWorkerFinished();
        }
        else {
            devProcessDiceResults(e.data[0], e.data[1]);
            e.data = {};
            if (pathIndex % modulus == 0) {
                console.log("worker1: " + pathIndex + "/" + devRecursePathList.length);
            }
            if (devRecursePathList.length > pathIndex) {
                worker1.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
                pathIndex++;
            }
            else {
                worker1.postMessage("sudoku");
            }
        }
    }

    worker2.onmessage = (e) => {
        if (e.data == "dead") {
            completedWorkers.push("2");
            devWorkerFinished();
        }
        else {
            devProcessDiceResults(e.data[0], e.data[1]);
            e.data = {};
            if (pathIndex % modulus == 0) {
                console.log("worker2: " + pathIndex + "/" + devRecursePathList.length);
            }
            if (devRecursePathList.length > pathIndex) {
                worker2.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
                pathIndex++;
            }
            else {
                worker2.postMessage("sudoku");
            }
        }
    }

    worker3.onmessage = (e) => {
        if (e.data == "dead") {
            completedWorkers.push("3");
            devWorkerFinished();
        }
        else {
            devProcessDiceResults(e.data[0], e.data[1]);
            e.data = {};
            if (pathIndex % modulus == 0) {
                console.log("worker3: " + pathIndex + "/" + devRecursePathList.length);
            }
            if (devRecursePathList.length > pathIndex) {
                worker3.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
                pathIndex++;
            }
            else {
                worker3.postMessage("sudoku");
            }
        }
    }

    worker4.onmessage = (e) => {
        if (e.data == "dead") {
            completedWorkers.push("4");
            devWorkerFinished();
        }
        else {
            devProcessDiceResults(e.data[0], e.data[1]);
            e.data = {};
            if (pathIndex % modulus == 0) {
                console.log("worker4: " + pathIndex + "/" + devRecursePathList.length);
            }
            if (devRecursePathList.length > pathIndex) {
                worker4.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
                pathIndex++;
            }
            else {
                worker4.postMessage("sudoku");
            }
        }
    }

    worker5.onmessage = (e) => {
        if (e.data == "dead") {
            completedWorkers.push("5");
            devWorkerFinished();
        }
        else {
            devProcessDiceResults(e.data[0], e.data[1]);
            e.data = {};
            if (pathIndex % modulus == 0) {
                console.log("worker5: " + pathIndex + "/" + devRecursePathList.length);
            }
            if (devRecursePathList.length > pathIndex) {
                worker5.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
                pathIndex++;
            }
            else {
                worker5.postMessage("sudoku");
            }
        }
    }

    worker6.onmessage = (e) => {
        if (e.data == "dead") {
            completedWorkers.push("6");
            devWorkerFinished();
        }
        else {
            devProcessDiceResults(e.data[0], e.data[1]);
            e.data = {};
            if (pathIndex % modulus == 0) {
                console.log("worker6: " + pathIndex + "/" + devRecursePathList.length);
            }
            if (devRecursePathList.length > pathIndex) {
                worker6.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
                pathIndex++;
            }
            else {
                worker6.postMessage("sudoku");
            }
        }
    }

    worker7.onmessage = (e) => {
        if (e.data == "dead") {
            completedWorkers.push("7");
            devWorkerFinished();
        }
        else {
            devProcessDiceResults(e.data[0], e.data[1]);
            e.data = {};
            if (pathIndex % modulus == 0) {
                console.log("worker7: " + pathIndex + "/" + devRecursePathList.length);
            }
            if (devRecursePathList.length > pathIndex) {
                worker7.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
                pathIndex++;
            }
            else {
                worker7.postMessage("sudoku");
            }
        }
    }

    worker8.onmessage = (e) => {
        if (e.data == "dead") {
            completedWorkers.push("8");
            devWorkerFinished();
        }
        else {
            devProcessDiceResults(e.data[0], e.data[1]);
            e.data = {};
            if (pathIndex % modulus == 0) {
                console.log("worker8: " + pathIndex + "/" + devRecursePathList.length);
            }
            if (devRecursePathList.length > pathIndex) {
                worker8.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
                pathIndex++;
            }
            else {
                worker8.postMessage("sudoku");
            }
        }
    }

    worker1.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
    pathIndex++;

    worker2.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
    pathIndex++;

    worker3.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
    pathIndex++;

    worker4.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
    pathIndex++;

    worker5.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
    pathIndex++;

    worker6.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
    pathIndex++;

    worker7.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
    pathIndex++;

    worker8.postMessage([diceRace, devRecursePathList[pathIndex], 1000, trials, currencyAvailable, pathIndex, true]);
    pathIndex++;
}

function devDownloadDiceResult(filename) {

    devPathListProcessed = JSON.stringify(devPathListProcessed);

    var blob = new Blob([devPathListProcessed], { type: 'text/json' }),
        e = document.createEvent('MouseEvents'),
        a = document.createElement('a')

    a.download = filename
    a.href = window.URL.createObjectURL(blob)
    a.dataset.downloadurl = ['text/json', a.download, a.href].join(':')
    e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    a.dispatchEvent(e)
}

function devGenerateDicePath(targets) {

    let tiles = event_config.events[current_event].dice_race.tiles

    let dicePaths = Array(tiles.length);

    for (let i = 0; i < tiles.length; i++) {
        dicePaths[i] = [];
        for (let d = 1; d <= 6; d++) {
            let tileCheck = i + d;
            if (tileCheck >= tiles.length) {
                tileCheck -= tiles.length;
            }
            if (targets.includes(tiles[tileCheck].type)) {
                dicePaths[i].push(d);
            }
        }
    }

    return dicePaths;
}

let devRecursePathList = [];
function devRecurseGetAllDicePaths(dicePath, prePath = []) {

    if (prePath.length == 0) {
        devRecursePathList = [];
    }

    let combinations = Combinations(dicePath[0]);

    if (dicePath.length > 1) {
        for (let i = 0; i < combinations.length; i++) {
            devRecurseGetAllDicePaths(dicePath.slice(1), prePath.concat([combinations[i]]));
        }
    }
    else {
        for (let i = 0; i < combinations.length; i++) {
            devRecursePathList.push(prePath.concat([combinations[i]]));
        }
    }

}

let devSplitPaths = [];
let chunkSize = 250000;
function devSplitDicePathList() {
    for (let i = 0; i < devRecursePathList.length; i += chunkSize) {
        devSplitPaths.push(devRecursePathList.slice(i, i + chunkSize));
    }
}

function Combinations(a) {
    var fn = function (n, src, got, all) {
        if (n == 0) {
            if (got.length > 0) {
                all[all.length] = got;
            }
            return;
        }
        for (var j = 0; j < src.length; j++) {
            fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
        }
        return;
    }
    var all = [];
    for (var i = 0; i < a.length; i++) {
        fn(i, a, [], all);
    }
    all.push(a);
    if (a.length) {
        all.push([]);
    }
    return all;
}

function InitCardsTab() {

    let cardDrops = event_config.events[current_event].card_drops;

    if (!cardDrops) {

        document.getElementById('tab-Cards').style.display = 'none';
        document.getElementById('Cards-tab').style.display = 'none';
        document.getElementById('include-card-rewards').style.display = 'none';
        document.getElementById('label-card-rewards').style.display = 'none';
        return;
    }
    else {
        document.getElementById('include-card-rewards').style.display = '';
        document.getElementById('label-card-rewards').style.display = '';
    }

    document.getElementById('tab-Cards').style.display = '';
    if (currentTab == "Cards") {
        document.getElementById('Cards-tab').style.display = 'block';
    }

    let elementCardsTabs = document.getElementById('cards-tabs');

    if (elementCardsTabs.children) {
        elementCardsTabs.children[0].click();
    }

    if (setSD || setSD == 0) {
        document.getElementById("sd-slider").value = setSD;
        SDSliderChanged("sd-slider", "display-standard-deviation");
    }
}

function GenerateCardsRarityTable(rarity) {

    let tabs = document.getElementsByClassName('cards-rarity-tab');

    for (let i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('selected')
    }

    if (rarity[0] == 'UR') {
        document.getElementById('tab-cards-ur').classList.add('selected');
    }
    else if (rarity[0] == 'SR') {
        document.getElementById('tab-cards-sr').classList.add('selected');
    }
    else if (rarity[0] == 'R') {
        document.getElementById('tab-cards-r').classList.add('selected');
    }
    else if (rarity[0] == 'N_') {
        document.getElementById('tab-cards-n').classList.add('selected');
    }

    let cardDrops = event_config.events[current_event].card_drops;

    let existingTable = document.getElementById('cards-table');
    if (existingTable) {
        existingTable.remove();
    }

    let tableContainer = document.getElementById('cards-table-container');

    let table = document.createElement('table');
    table.id = 'cards-table';
    let tableHead = document.createElement('thead');
    let tableBody = document.createElement('tbody');

    let tableHeadRow = document.createElement('tr');

    CreateTableRowCells(tableHeadRow, [GetLanguageString("label-card"), GetLanguageString("label-chance"), GetLanguageString("label-drops")], 'th');

    tableHead.appendChild(tableHeadRow);

    let previousIcon = "";

    let alternating = 0;

    for (let i = 0; i < cardDrops.length; i++) {

        let card = cardDrops[i];

        if (!(rarity.includes(card.icon.substring(0, 2)))) {
            continue;
        }

        let tableRow = document.createElement('tr');

        let useIcon = null;
        if (previousIcon != card.icon) {

            if (previousIcon) {
                alternating++;
            }

            useIcon = document.createElement("div");
            useIcon.className = "gacha-card-icon";
            useIcon.id = "card-" + card.icon;

            iconImg = document.createElement("img");
            iconImg.src = "icons/EventIcon/CardIcon/" + card.icon + ".png";

            useIcon.appendChild(iconImg);

            previousIcon = card.icon;
        }
        else {
            let useIcon = tableBody.querySelector("#card-" + card.icon).parentElement;
            let rowSpan = useIcon.rowSpan;

            if (rowSpan) {
                useIcon.rowSpan = parseInt(rowSpan) + 1;
            }
            else {
                useIcon.rowSpan = 2;
            }
        }

        if (alternating % 2 == 1) {
            tableRow.className = "alternate-row";
        }

        CreateTableRowCells(tableRow, [useIcon, (card.chance * 100).toFixed(2) + "%", CreateDropsDiv(card.drops)], 'td');

        tableBody.appendChild(tableRow);

    }

    table.appendChild(tableHead);
    table.appendChild(tableBody);

    tableContainer.appendChild(table);
}

function SDSliderChanged(sliderId, labelId) {

    let labelBottom = GetLanguageString("label-bottom");
    let labelTop = GetLanguageString("label-top");

    let sdDescs = ["(" + labelBottom + " 2.3%)", "(" + labelBottom + " 6.7%)", "(" + labelBottom + " 15.9%)", "(" + labelBottom + " 30.9%)", "",
    "(" + labelTop + " 30.9%)", "(" + labelTop + " 15.9%)"]

    let sd = document.getElementById(sliderId).value;

    let sdLabel = document.getElementById(labelId);

    if (sd == 0) {
        sdLabel.innerText = GetLanguageString("label-stdinfo");
    }
    else {
        sdLabel.innerText = sd + "σ" + " " + sdDescs[parseFloat(sd) * 2 + 4];
    }
}

function SDSliderSet(sliderId) {

    let sd = document.getElementById(sliderId).value;

    setSD = parseFloat(sd);

    event_data.standard_deviation = setSD;

    RefreshDropsDisplay();

    Save(5);
}

function HideCards() {

    let tabs = document.getElementsByClassName('cards-rarity-tab');
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('selected')
    }

    let existingTable = document.getElementById('cards-table');
    if (existingTable) {
        existingTable.remove();
    }
}

function SimButtonClicked() {

    if (cardGachaProcessing || cardGachaProcessed) {
        return;
    }

    cardGachaProcessing = true;

    let btn = document.getElementById("gacha-sim-button");
    btn.classList.add('active');

    SimulateCardGacha();

    setTimeout(() => {
        btn.classList.remove('active');
    }, 4000);
}

function SimOmikujiClicked() {

    if (omikujiGachaProcessing || omikujiGachaProcessed) {
        return;
    }

    omikujiGachaProcessing = true;

    let btn = document.getElementById("omikuji-sim-button");
    btn.classList.add('active');

    SimulateOmikujiGacha();

    setTimeout(() => {
        btn.classList.remove('active');
    }, 4000);
}

function SimDiceClicked() {

    if (diceGachaProcessing || diceGachaProcessed) {
        return;
    }

    diceGachaProcessing = true;

    let btn = document.getElementById("dice-sim-button");
    btn.classList.add('active');

    SimulateDiceGacha();

    setTimeout(() => {
        btn.classList.remove('active');
    }, 4000);
}

function StageGroupsStatusUpdate(stagenum) {

    stageGroup1 = document.getElementById('include-stage-group-1').checked;
    stageGroup2 = document.getElementById('include-stage-group-2').checked;
    stageGroup3 = document.getElementById('include-stage-group-3').checked;

    if (!stageGroup1 && !stageGroup2 && !stageGroup3) {
        document.getElementById('include-stage-group-3').checked = true;
        stageGroup3 = true;
    }

    events_data[current_event].enabled_stage_groups = [stageGroup1, stageGroup2, stageGroup3];

    Save(5);

    RefreshDropsDisplay();
    GenerateStagesTable();
}

function InitOwnedTab() {

    let elOwnedCurrencies = document.getElementById('currency-owned-container');

    while (elOwnedCurrencies.children.length > 0) {
        elOwnedCurrencies.children[0].remove();
    }

    let eventActive = event_config.events[current_event].active;

    if (!eventActive) {
        document.getElementById('tab-Owned').style.display = 'none';
        document.getElementById("label-owned-currency-info-1").style.display = "none";
        document.getElementById("label-owned-currency-info-2").style.display = "none";
        document.getElementById("label-owned-currency-info-3").style.display = "none";
        document.getElementById("label-owned-currency-info-4").style.display = "none";
        document.getElementById("label-owned-currency-info-5").style.display = "none";
        return;
    }
    else {
        document.getElementById('tab-Owned').style.display = '';
        document.getElementById("label-owned-currency-info-1").style.display = "";
        document.getElementById("label-owned-currency-info-2").style.display = "";
        document.getElementById("label-owned-currency-info-3").style.display = "";
        document.getElementById("label-owned-currency-info-4").style.display = "";
        document.getElementById("label-owned-currency-info-5").style.display = "";
    }

    let currencies = event_config.events[current_event].currencies;
    let dropCurrencies = Object.keys(currencies);

    for (let i = 0; i < dropCurrencies.length; i++) {

        if (currencies[dropCurrencies[i]].source != "StageDrop" && dropCurrencies[i] != "Event_Point") {
            continue;
        }

        let curDiv = document.createElement('div');
        curDiv.className = "owned-currency-container";
        curDiv.id = "owned-currency-" + dropCurrencies[i];

        // tabDiv.addEventListener('click', (event) => {
        //     ShopTabClicked(event.currentTarget.id);
        // })

        let curImg = document.createElement('img');

        curImg.src = "icons/EventIcon/CurrencyIcon/" + currencies[dropCurrencies[i]].icon;

        curDiv.appendChild(curImg);

        let curInput = document.createElement('input');
        curInput.type = "number";
        curInput.id = "currency-input-" + dropCurrencies[i];
        curInput.className = "owned-currency-input";
        curInput.min = 0;
        curInput.max = 200000;

        if (event_data.currency_owned && event_data.currency_owned[dropCurrencies[i]]) {
            curInput.value = parseInt(event_data.currency_owned[dropCurrencies[i]]);
        }
        else {
            curInput.value = 0;
        }

        curInput.addEventListener('input', (event) => {
            validateBasic(event.currentTarget.id);
        });

        curInput.addEventListener('beforeinput', (event) => {
            preInput = event.target.value;
        });

        curInput.addEventListener('focusout', (event) => {
            let validation = validateBasic(event.currentTarget.id);

            if (validation == "validated") {

                let currency = event.currentTarget.id.substring(15);

                if (!event_data.currency_owned) {
                    event_data.currency_owned = {};
                }

                event_data.currency_owned[currency] = event.currentTarget.value;

                Save(5);

                UpdateNotifications();
                CalculateEnergyAvailable();
                CalculateNeededFinal();
                RefreshDropsDisplay();
            }

            preInput = '';
        });

        curDiv.appendChild(curInput);

        elOwnedCurrencies.appendChild(curDiv);
    }

}

function InitInvasionTab() {

    if (event_config.events[current_event].invasion_stages) {

        document.getElementById('include-invasion-rewards').style.display = '';
        document.getElementById('label-invasion-rewards').style.display = '';
    }
    else {
        document.getElementById('include-invasion-rewards').style.display = 'none';
        document.getElementById('label-invasion-rewards').style.display = 'none';
    }
}