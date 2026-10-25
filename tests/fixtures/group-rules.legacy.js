// Frozen pre-migration reference; do not regenerate to accept behaviour differences.
function isTeamEmpty(team) {

    let isEmpty = true;

    for (let c = 0; c < 6; c++) {

        if (team[c] != null) {
            isEmpty = false;
            break;
        }
    }

    return isEmpty
}

function SetGroupOrder(newPos) {

    if (newPos) {
        let curGroup = 1;
        let newGroupObject = {};
        let groups = Object.keys(data.groups);

        for (let i = 0; i < groups.length; i++) {
            if (newPos == curGroup) {
                newGroupObject[currentGroup] = data.groups[currentGroup];
            }
            if (groups[i] != currentGroup) {
                newGroupObject[groups[i]] = data.groups[groups[i]];
                curGroup++;
            }
        }
        if (newGroupObject[currentGroup] == undefined) {
            newGroupObject[currentGroup] = data.groups[currentGroup];
        }

        data.groups = newGroupObject;
        rebuildGroups();
    }
}

function charsFromGroup(group) {

    let inGroup = [];

    if (data.groups && data.groups[group]) {

        for (let t = 0; t < data.groups[group].length; t++) {

            let team = data.groups[group][t];

            for (let i = 0; i < team.length; i++) {

                if (team[i] != null && typeof (team[i]) != "object") {
                    inGroup.push(team[i]);
                }
            }

        }

    }

    return inGroup;

}
