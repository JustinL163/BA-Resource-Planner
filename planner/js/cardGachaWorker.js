onmessage = (e) => {

    SimulateAttempts(e.data[0], e.data[1], e.data[2], e.data[3], e.data[4]);
}

function SimulateAttempts(gachaRewards, cardGachaChances, timeout, attemptsNum, currencyOwned) {

    let startTime = new Date();

    let rewardsAvailable = [];
    for (i = 0; i < gachaRewards.length; i++) {
        let cardDropNames = Object.keys(gachaRewards[i].drops);
        for (ii = 0; ii < cardDropNames.length; ii++) {
            if (!rewardsAvailable.includes(cardDropNames[ii])) {
                rewardsAvailable.push(cardDropNames[ii]);
            }
        }
    }

    let rewardArrays = {};
    for (i = 0; i < rewardsAvailable.length; i++) {
        rewardArrays[rewardsAvailable[i]] = [];
    }

    for (n = 0; n < attemptsNum; n++) {

        if (n % 1000 == 0 && (new Date() - startTime) > timeout && n > 2500) {
            break;
        }

        let attemptCurrency = currencyOwned;

        let pullCost = 200;

        let cardsPulled = Array(gachaRewards.length).fill(0);

        while (attemptCurrency >= pullCost) {

            let refreshGroupOrder = GetRefreshGroupOrder();

            //for (ii = 0; ii < 4; ii++) {

            cardsPulled[GetCardPull(cardGachaChances, refreshGroupOrder[0] - 1)]++;

            attemptCurrency -= pullCost;
            //}
        }

        for (i = 0; i < rewardsAvailable.length; i++) {

            let resourceTotal = 0;
            for (ii = 0; ii < cardsPulled.length; ii++) {
                resourceTotal += (gachaRewards[ii].drops[rewardsAvailable[i]] ?? 0) * cardsPulled[ii];
            }

            rewardArrays[rewardsAvailable[i]].push(resourceTotal);
        }

    }

    postMessage(rewardArrays);
    self.close();
}

//https://stackoverflow.com/a/2450976
function GetRefreshGroupOrder() {

    let array = [1, 2, 3, 4];
    let currentIndex = 4, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

function GetCardPull(cardGachaChances, refreshGroup) {

    let rndNum = Math.random();

    let cur = 0;
    let cardGachaC = cardGachaChances[refreshGroup];
    while (cardGachaC[cur] <= rndNum) {
        cur++;
    }

    return cur;
}