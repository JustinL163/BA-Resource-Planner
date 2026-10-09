function LegacyLessonRanks(lessons) {
    let rankUpgrades = lessons.rank_upgrades;
    let levelUnlocks = lessons.level_unlocks;
    let lessonCost = lessons.lesson_cost;
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

function LegacyUsedLessonPoints(lessons) {
    let postRuns = 0;
    let runNums = Object.keys(lessonPostRuns);
    for (let i = 0; i < runNums.length; i++) {
        postRuns += parseInt(lessonPostRuns[runNums[i]]);
    }
    return (lessonPreRuns.length + postRuns) * lessons.lesson_cost;
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
