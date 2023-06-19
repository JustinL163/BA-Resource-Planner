onmessage = (e) => {

    SimulateAttempts(e.data[0], e.data[1], e.data[2], e.data[3], e.data[4], e.data[5]);
}

function SimulateAttempts(omikujiRewards, omikujiChances, timeout, attemptsNum, currencyOwned, pullCost) {

    let startTime = new Date();

    let omikujiLength = omikujiChances[0].length;

    let targetIndex = -1;

    let rewardArrays = {};

    for (let i = 0; i < omikujiRewards.length; i++) {
        if (omikujiRewards[i][0] == 5 && targetIndex == -1) {
            targetIndex = i;
        }

        for (let ii = 0; ii < omikujiRewards[i][1].length; ii++) {
            if (!rewardArrays[omikujiRewards[i][1][ii]]) {
                rewardArrays[omikujiRewards[i][1][ii]] = [];
            }
        }
    }

    let rewardNames = Object.keys(rewardArrays);

    for (n = 0; n < attemptsNum; n++) {

        if (n % 1000 == 0 && (new Date() - startTime) > timeout && n > 2500) {
            break;
        }

        let attemptCurrency = currencyOwned;

        let currentPull = 1;

        let omikujiPulled = Array(omikujiRewards.length).fill(0);

        while (attemptCurrency >= pullCost) {

            let randomNum = Math.floor(Math.random() * 10000);

            let omikujiChanceSet = omikujiChances[Math.max(currentPull - 5, 0)];

            for (i = 0; i < omikujiLength; i++) {
                if (omikujiChanceSet[i] > randomNum) {
                    omikujiPulled[i - 1]++;
                    if (i >= targetIndex) {
                        currentPull = 1;
                    }
                    break;
                }
            }

            if (i == omikujiLength) {
                omikujiPulled[omikujiLength - 1]++;
                currentPull = 1;
            }

            attemptCurrency -= pullCost;
        }

        let rewardSubTotals = {};
        for (let i = 0; i < rewardNames.length; i++) {
            rewardSubTotals[rewardNames[i]] = 0;
        }

        for (let i = 0; i < omikujiLength; i++) {
            for (let ii = 0; ii < omikujiRewards[i][1].length; ii++) {
                rewardSubTotals[omikujiRewards[i][1][ii]] += omikujiRewards[i][2][ii] * omikujiPulled[i];
            }
        }

        for (let i = 0; i < rewardNames.length; i++) {
            rewardArrays[rewardNames[i]].push(rewardSubTotals[rewardNames[i]]);
        }


    }

    postMessage(rewardArrays);
    self.close();
}