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
