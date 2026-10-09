// Frozen farming reference; do not regenerate to accept numerical changes.
function GenerateModelVariables(multiplier) {
    let rates = misc_data.gear_rates;
    let areas = Object.keys(rates);

    let drops = misc_data.gear_drops;

    modelVariables = {};
    availableGear = {};

    for (let i = 0; i < areas.length; i++) {

        if ((data.server == "Global" && parseInt(areas[i]) > globalMaxWorld) || (data.server == "CN" && parseInt(areas[i]) > cnMaxWorld)) {
            break;
        }

        for (let s = 1; s <= 5; s++) {

            let stage = areas[i] + "-" + s;
            let newVariable = {};

            for (let gr = 0; gr < rates[areas[i]].length; gr++) {

                let tier = rates[areas[i]][gr].Tier;

                let rateArray = rates[areas[i]][gr].Rates;
                if (data.server == "CN" && rates[areas[i]][gr].OldRates) {
                    rateArray = rates[areas[i]][gr].OldRates;
                }

                newVariable["T" + tier + "_" + drops[stage][0]] = rateArray[0] * multiplier;
                newVariable["T" + tier + "_" + drops[stage][1]] = rateArray[1] * multiplier;
                newVariable["T" + tier + "_" + drops[stage][2]] = rateArray[2] * multiplier;
                newVariable["AP"] = 10;

                availableGear["T" + tier + "_" + drops[stage][0]] = true;
                availableGear["T" + tier + "_" + drops[stage][1]] = true;
                availableGear["T" + tier + "_" + drops[stage][2]] = true;
            }

            modelVariables[stage] = newVariable;
        }
    }

    return;
}

function GenerateGearLinearModel() {

    let model = {};
    model.optimize = "AP";
    model.opType = "min";
    model.constraints = {};
    model.variables = modelVariables;

    let keys = Object.keys(neededMatDict);

    for (let i = 0; i < keys.length; i++) {
        if (availableGear[keys[i]] == true && neededMatDict[keys[i]] != 0) {
            model.constraints[keys[i]] = { "min": neededMatDict[keys[i]] };
        }
    }

    return model;
}

function SolveGearFarm() {

    GenerateModelVariables(campaignMultiplier);
    let solution = solver.Solve(GenerateGearLinearModel());
    let solKeys = Object.keys(solution);

    OptimalStageRuns = [];
    let totalAP = 0;

    for (let i = 0; i < solKeys.length; i++) {

        if (solKeys[i].includes('-')) {
            let sr = Math.ceil(solution[solKeys[i]]);
            OptimalStageRuns.push({ stage: solKeys[i], runs: sr })
            totalAP += sr * 10;
        }
    }

    OptimalStageRuns.sort((a, b) => b.runs - a.runs);

    document.getElementById("gear-farm-energy").innerText = commafy(totalAP);
}

function CalculateLeftoverGearXp() {

    let totalLeftover = 0;

    let matKeys = Object.keys(leftoverMatDict);
    for (let i = 0; i < matKeys.length; i++) {
        if (gearLookup.includes(matKeys[i])) {
            let tier = matKeys[i].substring(0, matKeys[i].indexOf("_"));
            totalLeftover += leftoverMatDict[matKeys[i]] * misc_data.gear_bp_value[tier];
        }
    }

    return totalLeftover;
}
