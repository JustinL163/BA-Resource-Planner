// Frozen calculation reference from the pre-extraction implementation.
function calculateCharResources(charData, output) {

    let charMatDict = {};

    let charId = charData.id.toString();
    let charObj = charlist[charId];

    calcSkillCost(charObj, "ex", charData.current?.ex, charData.target?.ex, charMatDict);
    calcSkillCost(charObj, "normal", charData.current?.basic, charData.target?.basic, charMatDict);
    calcSkillCost(charObj, "passive", charData.current?.passive, charData.target?.passive, charMatDict);
    calcSkillCost(charObj, "sub", charData.current?.sub, charData.target?.sub, charMatDict);

    calcXpCost(charData.current?.level, charData.target?.level, charMatDict);

    calcGearCost(charObj, charData.current?.gear1, charData.target?.gear1, 1, charMatDict);
    calcGearCost(charObj, charData.current?.gear2, charData.target?.gear2, 2, charMatDict);
    calcGearCost(charObj, charData.current?.gear3, charData.target?.gear3, 3, charMatDict);

    calcBondGearCost(charObj, charData.current?.bond_gear, charData.target?.bond_gear, charMatDict);

    calcBookCost(charObj, charData.current?.book_hp, charData.target?.book_hp, 'HP', charMatDict);
    calcBookCost(charObj, charData.current?.book_atk, charData.target?.book_atk, 'ATK', charMatDict);
    calcBookCost(charObj, charData.current?.book_heal, charData.target?.book_heal, 'Heal', charMatDict);

    calcMysticCost(charData.current?.star, charData.target?.star, charMatDict);

    calcUECost(charObj, charData.current?.ue, charData.target?.ue, charData.current?.ue_level, charData.target?.ue_level, charMatDict);

    let purchaseData = misc_data.shop_characters[charId];
    let currency, amount, cost, times;

    if (purchaseData) {
        if (typeof (purchaseData) == "object") {
            currency = purchaseData.currency;
            amount = purchaseData.amount;
            cost = purchaseData.cost;
            times = purchaseData.times;
        }
        else {
            currency = purchaseData;
            let currencyInfo = misc_data.shop_eleph[currency];
            amount = currencyInfo.amount;
            cost = currencyInfo.cost;
            times = currencyInfo.times;
        }
    }

    if ((charData.eleph?.unlocked === false) &&
        (["RaidToken", "RareRaidToken", "EliminationRaidToken", "RareEliminationRaidToken", "ArenaCoin", "JECoin"].includes(currency) || misc_data.hard_modes[charId])) {

        if (!charMatDict["Eleph"]) {
            charMatDict["Eleph"] = 0;
        }

        charMatDict["Eleph"] += misc_data.unlock_cost[charObj.StarGrade + "*"];
    }

    if (charMatDict["Eleph"] && charData.eleph?.owned > 0) {
        charMatDict["Eleph"] = Math.max(charMatDict["Eleph"] - charData.eleph?.owned, 0);
    }

    if (charData.eleph?.use_eligma && charMatDict["Eleph"]) {

        if (!charMatDict["Eligma"]) {
            charMatDict["Eligma"] = 0;
        }

        charMatDict["Eligma"] += ligma(charMatDict["Eleph"], charData.eleph?.cost, charData.eleph?.purchasable);
    }

    if (charData.eleph?.use_shop && charMatDict["Eleph"] && misc_data.shop_characters[charId]) {

        let purchasesTaken = Math.ceil(charMatDict["Eleph"] / amount);
        let currencyCost = purchasesTaken * cost;
        let resetsTaken = Math.ceil(purchasesTaken / times);

        charMatDict[currency + "Cost"] = currencyCost;
        charMatDict["ShopResets"] = resetsTaken;
    }

    if (misc_data.hard_modes[charId] && charMatDict["Eleph"]) {

        charMatDict["ShopResets"] = Math.ceil(charMatDict["Eleph"] / (charData.eleph?.farm_nodes * 0.4));
    }

    if (output) {
        return charMatDict;
    }
    else {
        charMatDicts[charId] = charMatDict;
    }

}

function calcSkillCost(characterObj, skill, current, target, matDict) {

    let skillMaterials, skillMaterialAmounts, skillType;

    if (skill == "ex") {
        skillMaterials = characterObj.SkillExMaterial;
        skillMaterialAmounts = characterObj.SkillExMaterialAmount;
        skillType = "ex";
    }
    else {
        skillMaterials = characterObj.SkillMaterial;
        skillMaterialAmounts = characterObj.SkillMaterialAmount;
        skillType = "other";
    }

    if (skillMaterials == undefined || skillMaterialAmounts == undefined) { return null; }

    let curLevel = parseInt(current);
    let tarLevel = parseInt(target);
    if (curLevel == 0 && tarLevel > 0) {
        curLevel = 1;
    }

    if (tarLevel == 10 && curLevel < 10) {
        if (!matDict["9999"]) {
            matDict["9999"] = 0;
        }

        matDict["9999"] += 1;
    }

    for (let s = curLevel; s < tarLevel; s++) {

        if (skillType != undefined) {

            if (!matDict["Credit"]) {
                matDict["Credit"] = 0;
            }

            matDict["Credit"] += misc_data.skill_credit_cost[skillType][s - 1];
        }

        let costObj = skillMaterials[s - 1];  // skillObj["Level" + s];
        if (costObj == undefined) {
            // console.log("Error: Skill Level data missing") // expand error later
            return null;
        }

        // let costObj = levelObj["LevelUpMats"];

        for (let i = 0; i < costObj.length; i++) {

            let item = costObj[i];

            if (item != undefined && skillMaterialAmounts[s - 1][i] != undefined) {

                if (!matDict[item]) {
                    matDict[item] = 0;
                }

                matDict[item] += skillMaterialAmounts[s - 1][i];
            }
        }
    }
}

function calcXpCost(level, levelTarget, matDict) {

    if (level && levelTarget) {
        var xpNeeded = Math.max(misc_data.level_xp[parseInt(levelTarget) - 1] - misc_data.level_xp[parseInt(level) - 1], 0);

        if (!matDict["Xp"]) {
            matDict["Xp"] = 0;
        }

        matDict["Xp"] += xpNeeded;

        if (!matDict["Credit"]) {
            matDict["Credit"] = 0;
        }

        matDict["Credit"] += xpNeeded * 7;
    }
}

function calcGearCost(charObj, gear, gearTarget, slotNum, matDict) {
    gear = parseInt(gear);
    gearTarget = parseInt(gearTarget);

    // need to also save gear xp later
    if ((gear || gear == 0) && gearTarget > gear) {

        var gearObj = misc_data.cumulative_gear_cost["T" + gear];
        var targetGearObj = misc_data.cumulative_gear_cost["T" + gearTarget];

        if (gearObj && targetGearObj) {

            if ((gearObj.xp || gearObj.xp == 0) && targetGearObj.xp) {

                if (!matDict["GearXp"]) {
                    matDict["GearXp"] = 0;
                }

                matDict["GearXp"] += targetGearObj.xp - gearObj.xp;
            }

            if ((gearObj.credit || gearObj.credit == 0) && targetGearObj.credit) {

                if (!matDict["Credit"]) {
                    matDict["Credit"] = 0;
                }

                matDict["Credit"] += targetGearObj.credit - gearObj.credit;
            }

            if (charObj?.Equipment) {
                let gearName = charObj.Equipment[slotNum - 1];

                for (let i = 2; i <= 10; i++) {

                    let currentBP = gearObj["T" + i] ?? 0;
                    let targetBP = targetGearObj["T" + i];
                    let diff = targetBP - currentBP;

                    if (targetBP && (diff > 0)) {

                        if (!matDict["T" + i + "_" + gearName]) {
                            matDict["T" + i + "_" + gearName] = 0;
                        }

                        matDict["T" + i + "_" + gearName] += diff;
                    }
                }
            }
        }
    }

}

function calcBondGearCost(charObj, gear, gearTarget, matDict) {
    const costFloorLevel = 1;
    gear = Math.max(parseInt(gear), costFloorLevel);
    gearTarget = parseInt(gearTarget);

    // by this logic, gear should never be less than 1
    if (gear && gearTarget > gear) {
        const gearMat = charObj.Gear?.TierUpMaterial;
        const gearMatAmount = charObj.Gear?.TierUpMaterialAmount;

        if (!gearMat || !gearMatAmount) {
            return;
        }

        for (let upgradedLevel = gear; upgradedLevel < gearTarget; upgradedLevel++) {
            const matCostIndex = upgradedLevel - costFloorLevel;
            const lvlMat = gearMat[matCostIndex];
            const lvlMatAmount = gearMatAmount[matCostIndex];


            for (let matIndex = 0; matIndex < lvlMat.length; matIndex++) {
                const matId = lvlMat[matIndex];

                if (!matDict[matId]) {
                    matDict[matId] = 0;
                }
                matDict[matId] += lvlMatAmount[matIndex];
            }

            if (!matDict["Credit"]) {
                matDict["Credit"] = 0;
            }

            matDict["Credit"] += misc_data.bond_gear_credit_cost[matCostIndex];
        }


    }
}

function calcBookCost(charObj, book, bookTarget, bookType, matDict) {
    book = parseInt(book);
    bookTarget = parseInt(bookTarget);

    if ((book || book == 0) && bookTarget > book) {
        const bookObj = misc_data.cumulative_limit_break_cost[book];
        const targetBookObj = misc_data.cumulative_limit_break_cost[bookTarget];

        if (!bookObj || !targetBookObj) {
            return;
        }

        if (targetBookObj.books) {
            const bookId = matLookup.revGet(`Book_${bookType}`)
            if (!matDict[bookId]) {
                matDict[bookId] = 0;
            }

            matDict[bookId] += targetBookObj.books - (bookObj.books ?? 0);
        }

        for (let i = 0; i < 2; i++) {
            const prop = `artifact_${i + 1}`;
            if (targetBookObj[prop]) {
                const artifactId = charObj.PotentialMaterial + i;

                if (!matDict[artifactId]) {
                    matDict[artifactId] = 0;
                }

                matDict[artifactId] += targetBookObj[prop] - (bookObj[prop] ?? 0);
            }
        }

        if (typeof bookObj.credit === 'number' && targetBookObj.credit) {

            if (!matDict["Credit"]) {
                matDict["Credit"] = 0;
            }

            matDict["Credit"] += targetBookObj.credit - bookObj.credit;
        }
    }
}

function calcMysticCost(star, starTarget, matDict) {

    if (star && starTarget) {

        let currentStar = misc_data.cumulative_mystic_cost[star + "*"];
        let targetStar = misc_data.cumulative_mystic_cost[starTarget + "*"];

        if (currentStar && targetStar) {

            if ((currentStar.credit || currentStar.credit == 0) && targetStar.credit) {

                if (!matDict["Credit"]) {
                    matDict["Credit"] = 0;
                }

                matDict["Credit"] += targetStar.credit - currentStar.credit;
            }

            if ((currentStar.eleph || currentStar.eleph == 0) && targetStar.eleph) {

                if (!matDict["Eleph"]) {
                    matDict["Eleph"] = 0;
                }

                matDict["Eleph"] += targetStar.eleph - currentStar.eleph
            }
        }
    }

}

function ligma(elephNeeded, elephCost, elephRemaining) {

    let ligmaNeeded = 0;

    while (elephCost < 5 && elephNeeded > 0) {

        let nextAmount = Math.min(elephRemaining, elephNeeded);
        if (nextAmount > 0) {
            elephNeeded -= nextAmount;
            ligmaNeeded += nextAmount * elephCost;
            elephCost++;
            elephRemaining = 20;
        }
        else {
            break;
        }
    }

    if (elephNeeded > 0) {
        ligmaNeeded += elephNeeded * 5;
    }

    return ligmaNeeded;

}

function calcUECost(charObj, star, starTarget, level, levelTarget, matDict) {

    if (star == 0) {
        star = 1;
    }

    if (level == 0) {
        level = 1;
    }
    if (levelTarget == 0) {
        levelTarget = 1;
    }

    if ((star) && starTarget) {

        let currentStar = misc_data.cumulative_mystic_cost["U" + star + "*"];
        let targetStar = misc_data.cumulative_mystic_cost["U" + starTarget + "*"];

        if (currentStar && targetStar) {

            if ((currentStar.credit || currentStar.credit == 0) && targetStar.credit) {

                if (!matDict["Credit"]) {
                    matDict["Credit"] = 0;
                }

                matDict["Credit"] += targetStar.credit - currentStar.credit;
            }

            if ((currentStar.eleph || currentStar.eleph == 0) && targetStar.eleph) {

                if (!matDict["Eleph"]) {
                    matDict["Eleph"] = 0;
                }

                matDict["Eleph"] += targetStar.eleph - currentStar.eleph
            }

        }
    }

    if ((level || level == 0) && levelTarget) {

        let currentXp = misc_data.ue_xp[level - 1];
        let targetXp = misc_data.ue_xp[levelTarget - 1];

        if ((currentXp || currentXp == 0) && targetXp) {

            let ue_xp_type = misc_data.gun_ue_category[charObj.WeaponType];

            if (!matDict[ue_xp_type + "_Xp"]) {
                matDict[ue_xp_type + "_Xp"] = 0;
            }

            matDict[ue_xp_type + "_Xp"] += targetXp - currentXp;

            if (!matDict["Credit"]) {
                matDict["Credit"] = 0;
            }

            matDict["Credit"] += (targetXp - currentXp) * 180;

        }

    }
}
