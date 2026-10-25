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
