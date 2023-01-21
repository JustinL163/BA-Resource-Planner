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

let current_event = "", current_currency = "";
let stage_runs = {};
let event_point_target = 0;

let targetedMaterials = {}, targetedCurrency = "";
let optimisationType = "";

let initialClearRewards = {};
let initialClearCost = 0;

let cafeDefault = 7;

function loadResources() {

    $.getJSON('json/events.json?1').done(function (json) {
        event_config = json;
        checkResources();
    });

    $.getJSON('json/event_misc.json?1').done(function (json) {
        event_misc = json;
        checkResources();
    });

    $.getJSON('json/charlist.json?19').done(function (json) {
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

        init();
    }
}

function init() {

    if (data == null) {
        window.location.replace("/planner/index.html");
    }

    if (data.page_theme != undefined) {
        setTheme(data.page_theme);
    }


    let events_list = document.getElementById("events-list");

    for (let i = 0; i < event_config.event_order.length; i++) {
        let eventDiv = document.createElement("div");
        let eventImg = document.createElement("img");

        eventImg.src = "icons/EventIcon/" + event_config.events[event_config.event_order[i]].icon;
        eventImg.className = "event-icon";

        eventDiv.appendChild(eventImg);
        eventDiv.id = event_config.event_order[i];
        eventDiv.style.cursor = "pointer";

        eventDiv.addEventListener('click', (event) => {
            LoadEvent(event.currentTarget.id);
        })

        events_list.appendChild(eventDiv);
    }

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

function LoadEvent(eventId) {

    if (current_event == eventId) {
        return;
    }

    eventLoading = true;

    if (current_event) {
        document.getElementById(current_event).classList.remove('selected');
    }
    document.getElementById(eventId).classList.add('selected');

    current_event = eventId;
    current_currency = "";
    currencyNeeded = {};
    targetedMaterials = {};
    optimisationType = "";

    if (events_data[current_event]) {
        event_data = events_data[current_event];
        enabledBonusUnits = event_data.enabled_bonus_units ?? [];
        currencyNeededPre = event_data.currency_needed ?? {};
    }
    else {
        event_data = {};
        enabledBonusUnits = [];
        event_data.shop_purchases = {};
        event_data.currency_needed = {};
    }

    if (event_config.events[current_event].event_point_target) {
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
    CalculateInitalClear();
    CalculateEnergyAvailable();
    CalculateNeededFinal();
    InitTargetsTab();
    GenerateStagesTable();
    LoadFirstShop();

    eventLoading = false;
}

function EventTabClicked(tab) {

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

    SwitchTab(tab);
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

        document.getElementById("currency-" + currencies[i]).innerText = "+" + Math.round(currencyBonuses[currencies[i]] * 100) + "%";
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
        }
        else if (source == "ArenaCoin") {
            event_data["pvp_refreshes"] = parseInt(result);
        }
        else if (source == "Cafe") {
            event_data["cafe_rank"] = parseInt(result);
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
    document.getElementById("energy-arenacoin-total").innerText = energy_pvprefresh;
    document.getElementById("energy-cafe-total").innerText = energy_cafe;
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

function GenerateShopContent(currency) {

    let shop = event_config.events[current_event].shops[currency];

    let elShopContent = document.getElementById('currency-shop-content');

    while (elShopContent.children.length > 0) {
        elShopContent.children[0].remove();
    }

    for (let i = 0; i < shop.length; i++) {

        elShopContent.appendChild(CreateShopItem(shop[i], currency));
    }


}

function CreateShopItem(item, currency) {

    let itemDiv = document.createElement('div');
    itemDiv.className = "shop-item";

    let itemImg = document.createElement('img');

    if (item.type == "Eleph") {
        itemImg.src = "icons/Eleph/Eleph_" + item.id + ".png";
    }
    else if (item.type == "XpReport") {
        itemImg.src = "icons/LevelPart/" + item.id + ".png";
    }
    else if (item.type == "XpOrb") {
        itemImg.src = "icons/LevelPart/" + item.id + ".png";
    }
    else if (item.type == "Material") {
        let matName = matLookup.map[item.id];

        if (parseInt(item.id) < 1000) {
            itemImg.src = "icons/Artifact/" + matName + ".png";
        }
        else {
            itemImg.src = "icons/SchoolMat/" + matName + ".png";
        }
    }
    else if (item.type == "Furniture") {
        itemImg.src = "icons/Furniture/" + item.id + ".png";
    }

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

    let priceDiv = document.createElement('div');
    priceDiv.className = "shop-item-price-container";

    let priceImg = document.createElement('img');
    priceImg.src = "icons/EventIcon/CurrencyIcon/" + currency + ".png";

    let priceP = document.createElement('p');
    priceP.innerText = item.cost;

    priceDiv.appendChild(priceImg);
    priceDiv.appendChild(priceP);

    itemDiv.appendChild(priceDiv);


    return itemDiv;
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
    event_data.currency_needed = currencyNeededPre;

    currencyNeeded[current_currency] = currencyNeededPre[current_currency] - initialClearRewards[current_currency];

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
            })
        }

        initialClearCost += stages[i].cost;
    }

}

function CalculateNeededFinal() {

    let currencies = Object.keys(currencyNeededPre);

    for (let i = 0; i < currencies.length; i++) {

        currencyNeeded[currencies[i]] = Math.max(currencyNeededPre[currencies[i]] - initialClearRewards[currencies[i]], 0);
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

            CreateTableRowCells(tableRow, [stage.number, stage.cost, CreateRunsDiv(stage.number), CreateDropsDiv(stage.drops)], 'td');

            tableBody.appendChild(tableRow);
        }
    }

    table.appendChild(tableHead);
    table.appendChild(tableBody);

    tableContainer.appendChild(table);
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
    }

    event_data["optimisation_type"] = optimisationType;
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

    let matDrops = GetMatDropOptions();

    let currentMatType = matDrops[0].slice(0, -2);
    let currentMatsContainer = document.createElement('div');
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
    let totalDrops = {};
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
                if (!totalDrops[drop]) {
                    totalDrops[drop] = 0;
                }

                totalDrops[drop] += runs * drops[drop];
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

    if (!ignoreRequirement) {
        energyCost += initialClearCost;
    }

    for (let i = 0; i < neededCurrencies.length; i++) {

        if (initialClearRewards[neededCurrencies[i]]) {
            totalCurrencies[neededCurrencies[i]] += initialClearRewards[neededCurrencies[i]];
        }
    }

    if (initialClearRewards["Event_Point"]) {
        totalCurrencies["Event_Point"] += initialClearRewards["Event_Point"];
    }

    if (feasible) {
        UpdateRewardsObtained(totalCurrencies, totalDrops, energyCost);
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

function ClearRewards() {

    let rewardsContainer = document.getElementById('rewards-container');

    while (rewardsContainer.children.length > 0) {
        rewardsContainer.children[0].remove();
    }
}

function UpdateRewardsObtained(totalCurrencies, totalDrops, energyCost) {

    ClearRewards();

    let rewardsContainer = document.getElementById('rewards-container');

    rewardsContainer.appendChild(CreateRewardItem("icons/EventIcon/EnergyIcon/EnergyPadded.png", energyCost, ""));

    let currencyNames = Object.keys(totalCurrencies);

    currencyNames.forEach((name) => {

        rewardsContainer.appendChild(CreateRewardItem("icons/EventIcon/CurrencyIcon/" + name + ".png", totalCurrencies[name], ""));
    })

    let artifactNames = Object.keys(totalDrops).sort();

    artifactNames.forEach((name) => {

        rewardsContainer.appendChild(CreateRewardItem("icons/Artifact/" + name + ".png", totalDrops[name].toFixed(1),
            'drop-resource-rarity-' + name.slice(-1) + ' drop-resource'));
    })
}

function CreateRewardItem(imgSrc, itemCount, divClass) {

    let itemDiv = document.createElement('div');
    itemDiv.className = divClass;

    let itemImg = document.createElement('img');
    let itemP = document.createElement('p');

    itemImg.src = imgSrc;

    itemP.innerText = commafy(itemCount);

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

    let model = GetStagesLinearModel("Energy_Cost", "min", false);

    let solvedModel = solver.Solve(model);

    let energyMin = 0;

    if (solvedModel.result) {

        energyMin = Math.ceil(solvedModel.result + Math.min(solvedModel.result * 0.01, 50));
    }

    let failureDiv = document.createElement('div');

    failureDiv.innerText = "A minimum of about " + energyMin + " energy is needed for this to be feasible, please either add additional energy sources, or reduce shop purchases.";

    document.getElementById('rewards-container').appendChild(failureDiv);
}