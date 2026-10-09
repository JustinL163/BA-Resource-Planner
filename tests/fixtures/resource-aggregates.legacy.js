// Frozen aggregate and weapon XP reference from the legacy UI.
function updateXP() {

    var xpOwned = parseInt(ownedMatDict["XP_1"] ?? 0) * 50 + parseInt(ownedMatDict["XP_2"] ?? 0) * 500 +
        parseInt(ownedMatDict["XP_3"] ?? 0) * 2000 + parseInt(ownedMatDict["XP_4"] ?? 0) * 10000;

    ownedMatDict["Xp"] = xpOwned;
    if (requiredMatDict["Xp"] != undefined) {
        neededMatDict["Xp"] = Math.max(requiredMatDict["Xp"] - xpOwned, 0);
    }
    else {
        neededMatDict["Xp"] = 0;
    }

    leftoverMatDict["Xp"] = Math.max(xpOwned - (requiredMatDict["Xp"] ?? 0), 0);
}

function updateGearXP() {

    var gxpOwned = parseInt(ownedMatDict["GXP_1"] ?? 0) * 90 + parseInt(ownedMatDict["GXP_2"] ?? 0) * 360 +
        parseInt(ownedMatDict["GXP_3"] ?? 0) * 1440 + parseInt(ownedMatDict["GXP_4"] ?? 0) * 5760;

    ownedMatDict["GearXp"] = gxpOwned;
    if (requiredMatDict["GearXp"] != undefined) {
        neededMatDict["GearXp"] = Math.max(requiredMatDict["GearXp"] - gxpOwned, 0);
    }
    else {
        neededMatDict["GearXp"] = 0;
    }

    leftoverMatDict["GearXp"] = Math.max(gxpOwned - (requiredMatDict["GearXp"] ?? 0), 0);
}

function updateUeXP() {

    let springXP = getTotalUeOfType("Spring");
    let hammerXP = getTotalUeOfType("Hammer");
    let barrelXP = getTotalUeOfType("Barrel");
    let needleXP = getTotalUeOfType("Needle");

    let springMin = document.getElementById('spring-min');
    let hammerMin = document.getElementById('hammer-min');
    let barrelMin = document.getElementById('barrel-min');
    let needleMin = document.getElementById('needle-min');
    let totalMin = document.getElementById('total-min');
    let springBonus = document.getElementById('spring-bonus');
    let hammerBonus = document.getElementById('hammer-bonus');
    let barrelBonus = document.getElementById('barrel-bonus');
    let totalBonus = document.getElementById('total-bonus');

    springMin.innerText = commafy(springXP);
    hammerMin.innerText = commafy(hammerXP);
    barrelMin.innerText = commafy(barrelXP);
    needleMin.innerText = commafy(needleXP * 1.5);
    springBonus.innerText = commafy(springXP * 0.5);
    hammerBonus.innerText = commafy(hammerXP * 0.5);
    barrelBonus.innerText = commafy(barrelXP * 0.5);

    totalMin.innerText = commafy(springXP + hammerXP + barrelXP + (needleXP * 1.5));
    totalBonus.innerText = commafy((springXP + hammerXP + barrelXP) * 0.5);

    let springOwned = document.getElementById('owned-spring');
    let springNeeded = document.getElementById('total-needed-spring');
    let springRemaining = document.getElementById('remaining-needed-spring');
    let hammerOwned = document.getElementById('owned-hammer');
    let hammerNeeded = document.getElementById('total-needed-hammer');
    let hammerRemaining = document.getElementById('remaining-needed-hammer');
    let barrelOwned = document.getElementById('owned-barrel');
    let barrelNeeded = document.getElementById('total-needed-barrel');
    let barrelRemaining = document.getElementById('remaining-needed-barrel');
    let needleOwned = document.getElementById('owned-needle');
    let needleNeeded = document.getElementById('total-needed-needle');
    let needleRemaining = document.getElementById('remaining-needed-needle');

    springOwned.innerText = commafy(springXP * 1.5);
    hammerOwned.innerText = commafy(hammerXP * 1.5);
    barrelOwned.innerText = commafy(barrelXP * 1.5);
    needleOwned.innerText = commafy(needleXP * 1.5);

    springNeeded.innerText = commafy(neededMatDict["Spring_Xp"] ?? 0);
    hammerNeeded.innerText = commafy(neededMatDict["Hammer_Xp"] ?? 0);
    barrelNeeded.innerText = commafy(neededMatDict["Barrel_Xp"] ?? 0);

    let springRemNeed = Math.max((neededMatDict["Spring_Xp"] ?? 0) - (springXP * 1.5), 0);
    let hammerRemNeed = Math.max((neededMatDict["Hammer_Xp"] ?? 0) - (hammerXP * 1.5), 0);
    let barrelRemNeed = Math.max((neededMatDict["Barrel_Xp"] ?? 0) - (barrelXP * 1.5), 0);

    springRemaining.innerText = commafy(springRemNeed);
    hammerRemaining.innerText = commafy(hammerRemNeed);
    barrelRemaining.innerText = commafy(barrelRemNeed);

    let needleNeed = springRemNeed + hammerRemNeed + barrelRemNeed;

    needleNeeded.innerText = commafy(needleNeed) + "*";

    let needleRemNeed = Math.max(needleNeed - (needleXP * 1.5), 0);

    needleRemaining.innerText = commafy(needleRemNeed);

    let allOwned = document.getElementById('owned-all');
    let allNeeded = document.getElementById('total-needed-all');
    let allRemaining = document.getElementById('remaining-needed-all');

    allNeeded.innerText = commafy(needleRemNeed);

    let remOwned = Math.max(Math.floor(((springXP * 1.5) - (neededMatDict["Spring_Xp"] ?? 0)) / 3 * 2), 0) +
        Math.max(Math.floor(((hammerXP * 1.5) - (neededMatDict["Hammer_Xp"] ?? 0)) / 3 * 2), 0) +
        Math.max(Math.floor(((barrelXP * 1.5) - (neededMatDict["Barrel_Xp"] ?? 0)) / 3 * 2), 0) +
        Math.max(((needleXP * 1.5) - needleNeed), 0);

    allOwned.innerText = commafy(remOwned) + "*";

    allRemaining.innerText = commafy(Math.max(needleRemNeed - remOwned, 0));

}

function getTotalUeOfType(type) {
    return parseInt(ownedMatDict["T4_" + type] ?? 0) * 1000 + parseInt(ownedMatDict["T3_" + type] ?? 0) * 200
        + parseInt(ownedMatDict["T2_" + type] ?? 0) * 50 + parseInt(ownedMatDict["T1_" + type] ?? 0) * 10;
}

function updateNeededMat(mat) {
    neededMatDict[mat] = Math.max((requiredMatDict[mat] ?? 0) - (ownedMatDict[mat] ?? 0), 0);
}

function updateLeftoverMat(mat) {
    leftoverMatDict[mat] = Math.max((ownedMatDict[mat] ?? 0) - (requiredMatDict[mat] ?? 0), 0);
}

function updateAggregateCount() {

    requiredMatDict = {};
    neededMatDict = {};

    for (charId in charMatDicts) {
        if (!disabledChars.includes(charId)) {
            for (matName in charMatDicts[charId]) {

                if (matName == "Xp") {
                    continue;
                }

                if (!requiredMatDict[matName]) {
                    requiredMatDict[matName] = 0;
                }

                requiredMatDict[matName] += charMatDicts[charId][matName];
            }

            let char = data.characters.find(obj => { return obj.id == charId });
            calcXpCost(char.current?.level, Math.min(char.target?.level, lvlCalcsCap), requiredMatDict);

            let checkCredit = {};
            calcXpCost(char.current?.level, char.target?.level, checkCredit);

            if (checkCredit.Credit > 0) {
                requiredMatDict["Credit"] -= checkCredit.Credit;
            }
        }
    }

    for (key in requiredMatDict) {
        updateNeededMat(key);
    }

    for (key in ownedMatDict) {
        updateLeftoverMat(key);
    }

    calculateRaidCoins();

    updateXP();

    updateGearXP();
}

function calculateRaidCoins() {

    let raidCoins = 0;

    for (key in neededMatDict) {
        if (key[0] == 3 && key.length == 4) {
            if (key[3] == 0) {
                raidCoins += 10 * neededMatDict[key];
            }
            else if (key[3] == 1) {
                raidCoins += 20 * neededMatDict[key];
            }
            else if (key[3] == 2) {
                raidCoins += 50 * neededMatDict[key];
            }
            else if (key[3] == 3) {
                raidCoins += 100 * neededMatDict[key];
            }
        }
        else if (key[0] == 4 && key.length == 4) {
            if (key[3] == 0) {
                raidCoins += 3 * neededMatDict[key];
            }
            else if (key[3] == 1) {
                raidCoins += 5 * neededMatDict[key];
            }
            else if (key[3] == 2) {
                raidCoins += 10 * neededMatDict[key];
            }
            else if (key[3] == 3) {
                raidCoins += 25 * neededMatDict[key];
            }
        }
        else if (key == "9999") {
            raidCoins += 500 * neededMatDict[key];
        }
    }

    if (!neededMatDict["RaidTokenCost"]) {
        neededMatDict["RaidTokenCost"] = 0;
    }

    neededMatDict["RaidTokenCost"] = raidCoins;

    for (charId in charMatDicts) {
        if (!disabledChars.includes(charId)) {

            if (charMatDicts[charId]["RaidTokenCost"]) {
                neededMatDict["RaidTokenCost"] += charMatDicts[charId]["RaidTokenCost"];
            }
        }
    }
}
