function AddDiceRewards(totalEleph, totalXps) {
    if (!event_config.events[current_event].dice_race) {
        return;
    }
    let totalCredit = 0, totalEligma = 0, totalSecretTech = 0, totalGearBoxes = 0;
    let rewardNames = Object.keys(diceGachaAvgSD);
    for (i = 0; i < rewardNames.length; i++) {
        let rewardName = rewardNames[i];
        let nameInt = parseInt(rewardName);
        let rewardAmount = math.round(diceGachaAvgSD[rewardName].mean + (setSD * diceGachaAvgSD[rewardName].std));
        if (rewardAmount == 0) {
            continue;
        }
        if (rewardName == "Credit") {
            totalCredit += rewardAmount;
        }
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
    }
    return [totalCredit, totalEligma, totalSecretTech, totalGearBoxes];
}
