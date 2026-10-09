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
