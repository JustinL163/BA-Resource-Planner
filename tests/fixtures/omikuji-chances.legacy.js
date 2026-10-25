function LegacyOmikujiChances(omikuji) {
    let omikujiChances = [];
    for (let i = 0; i < omikuji.MaxPullCount - omikuji.ProbModifyStartCount; i++) {
        omikujiChances[i] = [];
        let totalChance = 0;
        for (let ii = 0; ii < omikuji.slips.length; ii++) {
            let slip = omikuji.slips[ii];
            if (slip.ProbModifyLimit == 0) {
                let adjustedProb = Math.max(slip.Prob + (Math.max(i + 1, 0) * slip.ProbModifyValue), 0);
                omikujiChances[i].push(totalChance);
                totalChance += adjustedProb;
            }
            else {
                let adjustedProb = Math.min(slip.Prob + (Math.max(i + 1, 0) * slip.ProbModifyValue), slip.ProbModifyLimit);
                omikujiChances[i].push(totalChance);
                totalChance += adjustedProb;
            }
        }
    }
    return omikujiChances;
}
