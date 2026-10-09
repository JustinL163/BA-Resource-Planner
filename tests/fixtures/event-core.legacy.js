function CalculateBonuses() {
    if (current_event == "aha-conquest") {
        currencyBonuses = { "Computation_Circuit": 1.2, "Engine_Parts": 1.2, "Chocolate_Burger": 1.2 };
        return;
    }
    else if (current_event == "momoyodou-beach-house") {
        currencyBonuses = { "Momoyodou_Glitter_Coin": 1.2, "Turban_Shell": 1.2, "Summer_Ninjutsu_Instructions_Scroll": 1.2, "Local_Currency": 1.2 };
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
            });
        }
        initialClearCost += stages[i].cost;
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
        energy_cafe += cafe = Math.floor(event_misc.cafe_energy[event_data.cafe_rank ?? cafeDefault] * dayLength);
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
    energyAvailable = (energyByDay.reduce((t, c) => t + c) + 500 + 150);
    document.getElementById("energy-total").innerText = energyAvailable;
    if (current_event == "momoyodou-beach-house" && !midEvent) {
        energyAvailable = Math.max(energyAvailable - 900 - initialClearCost, 0);
    }
    else {
        energyAvailable = Math.max(energyAvailable - 100 - initialClearCost, 0);
    }
    document.getElementById('energy-weeklytask-total').innerText = 500;
    document.getElementById('energy-aronalogin-total').innerText = 150;
    if (!eventLoading) {
        RefreshDropsDisplay();
    }
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
            });
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
            if (current_event == "momoyodou-beach-house" && basesChecked) {
                let tempCurrency = { "Momoyodou_Glitter_Coin": 4200, "Turban_Shell": 4200, "Summer_Ninjutsu_Instructions_Scroll": 4110 };
                model.constraints[name] = { "min": (currencyNeeded[name] + tempCurrency[name]) };
            }
            else {
                model.constraints[name] = { "min": currencyNeeded[name] };
            }
        }
    });
    if (energyConstrained) {
        model.constraints["Energy_Cost"] = { "max": energyAvailable };
    }
    if (event_point_target && optimise != "Event_Point") {
        model.constraints["Event_Point"] = { "min": Math.max(event_point_target, currencyNeeded["Event_Point"] ?? 0) };
    }
    return model;
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
            });
        }
    }
    matDrops.sort();
    return matDrops;
}

function GetStagesMaterialsTargetModel() {
    let materials = Object.keys(targetedMaterials);
    let optimise = {};
    materials.forEach((mat) => {
        if (targetedMaterials[mat]) {
            optimise[mat] = "max";
        }
    });
    return GetStagesLinearModel(optimise, "", true);
}
