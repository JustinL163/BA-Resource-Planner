function LegacyInvasionRewards(invasionStages, invasionConfig, resetsTotal, resetsLeft, midEvent) {
    let remainingResets = resetsTotal - 1;
    if (midEvent) {
        remainingResets = resetsLeft;
    }

    let totalCurrencies = {};
    let totalEleph = {};
    let totalXps = {};
    let invasionCredit = 0;

    function InvasionRewardAdd(itemType, itemName, itemAmount) {
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

    if (!midEvent) {
        for (let i = 0; i < Math.min(invasionStages.length, invasionConfig.max_stage); i++) {
            let dropNames = Object.keys(invasionStages[i].drops);
            for (let r = 0; r < dropNames.length; r++) {
                let itemType = invasionStages[i].drop_key[r];
                let itemAmountAdded = 0;
                if (i + 1 == invasionConfig.max_stage) {
                    itemAmountAdded = invasionStages[i].drops[dropNames[r]] *
                        (invasionConfig.first_day_attempts - invasionConfig.max_stage + 1);
                }
                else {
                    itemAmountAdded = invasionStages[i].drops[dropNames[r]];
                }
                invasionCredit += InvasionRewardAdd(itemType, dropNames[r], itemAmountAdded)[0];
            }

            dropNames = Object.keys(invasionStages[i].initial);
            for (let r = 0; r < dropNames.length; r++) {
                let itemType = invasionStages[i].initial_key[r];
                let itemAmountAdded = invasionStages[i].initial[dropNames[r]];
                invasionCredit += InvasionRewardAdd(itemType, dropNames[r], itemAmountAdded)[0];
            }
        }
    }

    let dropNames = Object.keys(invasionStages[invasionConfig.max_stage - 1].drops);
    for (let r = 0; r < dropNames.length; r++) {
        let itemType = invasionStages[invasionConfig.max_stage - 1].drop_key[r];
        let itemAmountAdded = invasionStages[invasionConfig.max_stage - 1].drops[dropNames[r]] *
            invasionConfig.daily_attempts * remainingResets;
        invasionCredit += InvasionRewardAdd(itemType, dropNames[r], itemAmountAdded)[0];
    }

    return { currencies: totalCurrencies, eleph: totalEleph, xps: totalXps, credit: invasionCredit };
}
