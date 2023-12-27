onmessage = (e) => {

    if (e.data == "sudoku") {
        postMessage("dead");
        self.close();
        return;
    }

    if (rewardsAvailable.length == 0) {
        Init(e.data[0]);
    }

    SimulateAttempts(e.data[0], e.data[1], e.data[2], e.data[3], e.data[4], e.data[5], e.data[6]);
}

let diceRewards;

let ticketLapTiers = {};
let rewardsAvailable = [];

let rollCost;
let maxTile;
let moveBonuses;
let ticketTile = -1;

function Init(diceRace) {

    diceRewards = diceRace.tiles;
    rollCost = diceRace.roll_cost;
    maxTile = diceRewards.length - 1;
    moveBonuses = Array(maxTile + 1).fill(0);

    for (let i = 0; i < diceRace.lap_rewards.length; i++) {
        for (let ii = 0; ii < diceRace.lap_rewards[i].length; ii++) {
            if (diceRace.lap_rewards[i][ii].type == "FixedDice") {
                ticketLapTiers[diceRace.lap_reward_tiers[i]] = true;
            }

            if (diceRace.lap_rewards[i][ii].id) {
                if (!rewardsAvailable.includes(diceRace.lap_rewards[i][ii].id)) {
                    rewardsAvailable.push(diceRace.lap_rewards[i][ii].id);
                }
            }
            else if (diceRace.lap_rewards[i][ii].type != "FixedDice") {
                if (!rewardsAvailable.includes(diceRace.lap_rewards[i][ii].type)) {
                    rewardsAvailable.push(diceRace.lap_rewards[i][ii].type);
                }
            }
        }
    }

    for (let i = 0; i < diceRewards.length; i++) {
        if (diceRewards[i].type == "MoveBonus") {
            moveBonuses[i] = diceRewards[i].amount;
        }
        else if (diceRewards[i].type == "FixedDice") {
            ticketTile = i;
        }
        else {
            if (diceRewards[i].id) {
                if (!rewardsAvailable.includes(diceRewards[i].id)) {
                    rewardsAvailable.push(diceRewards[i].id);
                }
            }
            else {
                if (!rewardsAvailable.includes(diceRewards[i].type)) {
                    rewardsAvailable.push(diceRewards[i].type);
                }
            }
        }
    }
}

function SimulateAttempts(diceRace, targetParams, timeout, attemptsNum, currencyOwned, devIndex, keepAlive) {

    // let startTime = new Date();

    let rewardArrays = {};
    for (i = 0; i < rewardsAvailable.length; i++) {
        rewardArrays[rewardsAvailable[i]] = [];
    }

    for (n = 0; n < attemptsNum; n++) {

        if (!keepAlive && n % 1000 == 0 && (new Date() - startTime) > timeout && n > 2500) {
            break;
        }

        let attemptCurrency = currencyOwned;

        let pos = 0;
        let lap = 0;

        // let cardsPulled = Array(gachaRewards.length).fill(0);

        let tilesRolled = Array(maxTile + 1).fill(0);

        let diceTickets = Array(6).fill(0);

        let useDice;
        let move;

        while (attemptCurrency >= rollCost) {

            useDice = 0;
            for (let i = 1; i <= 6; i++) {
                if (diceTickets[i - 1]) {
                    if (targetParams[pos].includes(i)) {
                        useDice = i;
                        continue;
                    }
                }

                if (useDice) {
                    continue;
                }
            }

            if (!useDice) {
                move = Math.ceil(Math.random() * 6);
                attemptCurrency -= rollCost;
            }
            else {
                move = useDice;
                diceTickets[useDice - 1]--;
            }

            pos += move;

            if (pos > maxTile) {
                pos -= (maxTile + 1);
                lap++;
                if (ticketLapTiers[lap]) {
                    diceTickets[Math.ceil(Math.random() * 6) - 1]++;
                }
            }

            pos += moveBonuses[pos];

            tilesRolled[pos]++;

            if (pos == ticketTile) {
                diceTickets[Math.ceil(Math.random() * 6) - 1]++;
            }
        }

        while (diceTickets.reduce((a, b) => (a + b)) > 0) {

            for (let i = 1; i <= 6; i++) {
                if (diceTickets[i - 1]) {
                    if (targetParams[pos].includes(i)) {
                        useDice = i;
                        continue;
                    }
                }

                if (useDice) {
                    continue;
                }
            }

            if (!useDice) {
                for (let i = 1; i <= 6; i++) {
                    if (diceTickets[i - 1]) {
                        useDice = i;
                        continue;
                    }
                }
            }

            if (!useDice) {
                move = Math.ceil(Math.random() * 6);
                attemptCurrency -= rollCost;
            }
            else {
                move = useDice;
                diceTickets[useDice - 1]--;
            }

            pos += move;

            if (pos > maxTile) {
                pos -= (maxTile + 1);
                lap++;
                if (ticketLapTiers[lap]) {
                    diceTickets[Math.ceil(Math.random() * 6) - 1]++;
                }
            }

            pos += moveBonuses[pos];

            tilesRolled[pos]++;

            if (pos == ticketTile) {
                diceTickets[Math.ceil(Math.random() * 6) - 1]++;
            }
        }

        let trialRewards = {};
        for (i = 0; i < diceRace.lap_rewards.length; i++) {
            if (lap >= diceRace.lap_reward_tiers[i]) {
                for (ii = 0; ii < diceRace.lap_rewards[i].length; ii++) {
                    if (diceRace.lap_rewards[i][ii].id) {
                        if (!trialRewards[diceRace.lap_rewards[i][ii].id]) {
                            trialRewards[diceRace.lap_rewards[i][ii].id] = 0;
                        }
                        trialRewards[diceRace.lap_rewards[i][ii].id] += diceRace.lap_rewards[i][ii].amount ?? 1;
                    }
                    else {
                        if (!trialRewards[diceRace.lap_rewards[i][ii].type]) {
                            trialRewards[diceRace.lap_rewards[i][ii].type] = 0;
                        }
                        trialRewards[diceRace.lap_rewards[i][ii].type] += diceRace.lap_rewards[i][ii].amount ?? 1;
                    }

                }
            }
            else {
                continue;
            }
        }

        for (i = 0; i < tilesRolled.length; i++) {
            if (diceRewards[i].id) {
                if (!trialRewards[diceRewards[i].id]) {
                    trialRewards[diceRewards[i].id] = 0;
                }
                trialRewards[diceRewards[i].id] += diceRewards[i].amount * tilesRolled[i] ?? 1;
            }
            else {
                if (!trialRewards[diceRewards[i].type]) {
                    trialRewards[diceRewards[i].type] = 0;
                }
                trialRewards[diceRewards[i].type] += diceRewards[i].amount * tilesRolled[i] ?? 1;
            }
        }

        for (i = 0; i < rewardsAvailable.length; i++) {
            rewardArrays[rewardsAvailable[i]].push(trialRewards[rewardsAvailable[i]]);
        }
    }

    if (devIndex || devIndex == 0) {
        postMessage([rewardArrays, devIndex]);
    }
    else {
        postMessage(rewardArrays);
    }

    if (!keepAlive) {
        self.close();
    }
}

function GetDiceRoll() {

    let rndNum = Math.ceil(Math.random() * 6);
    if (!rndNum) {
        rndNum = 1;
    }

    return rndNum;
}