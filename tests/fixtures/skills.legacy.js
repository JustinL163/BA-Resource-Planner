function GetSkillObject(charId, skill) {
    let charSkills;
    if (chartranslate) {
        charSkills = chartranslate[charId].Skills;
    }
    else {
        charSkills = charlist[charId].Skills;
    }
    if (charSkills[skill]) {
        return charSkills[skill];
    }
    return null;
}

function GetBuffName(buffid) {
    let buffName = skillbuffnames[language.toLowerCase()]?.BuffName[buffid];
    if (!buffName) {
        buffName = skillbuffnames["en"]?.BuffName[buffid];
    }
    return buffName;
}

function getSkillFormatted(charId, skill, level, targetLevel, targetUe, targetBG) {
    if (level == 0) {
        level = 1;
    }
    if (targetLevel == 0) {
        targetLevel = 1;
    }
    let newSkill = "";
    if (skill == "Ex") {
        newSkill = "Ex";
    }
    else if (skill == "Skill1" && targetBG >= 2) {
        newSkill = "GearPublic";
    }
    else if (skill == "Skill1") {
        newSkill = "Public";
    }
    else if (skill == "Skill2" && targetUe >= 2) {
        newSkill = "WeaponPassive";
    }
    else if (skill == "Skill2") {
        newSkill = "Passive";
    }
    else if (skill == "Skill3") {
        newSkill = "ExtraPassive";
    }
    let skillObj = GetSkillObject(charId, newSkill);
    let desc = skillObj.Desc;
    let params = skillObj.Parameters;
    let cost = skillObj.Cost;
    let paramCount = 1;
    let infiBreak = 0;
    while (true) {
        let paramString = "<\\?" + paramCount + ">";
        if (desc && desc.match(paramString)) {
            let paramFilled = '<span style="color: #008c9b;">' + params[paramCount - 1][level - 1] + "</span>";
            if (level != targetLevel) {
                paramFilled += '/<span style="color: #588f00;">' + params[paramCount - 1][targetLevel - 1] + "</span>";
            }
            let paramRegex = new RegExp(paramString, "g");
            desc = desc.replace(paramRegex, paramFilled);
            paramCount++;
        }
        else if (desc && desc.includes("<b:")) {
            let effectIndex = desc.indexOf("<b:");
            let closeIndex = desc.substring(effectIndex).indexOf(">");
            let effectKey = desc.substring(effectIndex + 3, effectIndex + closeIndex);
            let effectOverwriteQuery = effectKey.match(/='(.+?)'/);
            let effectShort = effectOverwriteQuery ? effectOverwriteQuery[1] : GetBuffName("Buff_" + effectKey);
            let paramRegex = new RegExp("<b:" + effectKey + ">", "g");
            desc = desc.replace(paramRegex, effectShort);
        }
        else if (desc && desc.includes("<d:")) {
            let effectIndex = desc.indexOf("<d:");
            let closeIndex = desc.substring(effectIndex).indexOf(">");
            let effectKey = desc.substring(effectIndex + 3, effectIndex + closeIndex);
            let effectOverwriteQuery = effectKey.match(/='(.+?)'/);
            let effectShort = effectOverwriteQuery ? effectOverwriteQuery[1] : GetBuffName("Debuff_" + effectKey);
            let paramRegex = new RegExp("<d:" + effectKey + ">", "g");
            desc = desc.replace(paramRegex, effectShort);
        }
        else if (desc && desc.includes("<c:")) {
            let effectIndex = desc.indexOf("<c:");
            let closeIndex = desc.substring(effectIndex).indexOf(">");
            let effectKey = desc.substring(effectIndex + 3, effectIndex + closeIndex);
            let effectOverwriteQuery = effectKey.match(/='(.+?)'/);
            let effectShort = effectOverwriteQuery ? effectOverwriteQuery[1] : GetBuffName("CC_" + effectKey);
            let paramRegex = new RegExp("<c:" + effectKey + ">", "g");
            desc = desc.replace(paramRegex, effectShort);
        }
        else if (desc && desc.includes("<s:")) {
            let effectIndex = desc.indexOf("<s:");
            let closeIndex = desc.substring(effectIndex).indexOf(">");
            let effectKey = desc.substring(effectIndex + 3, effectIndex + closeIndex);
            let effectOverwriteQuery = effectKey.match(/='(.+?)'/);
            let effectShort = effectOverwriteQuery ? effectOverwriteQuery[1] : GetBuffName("Special_" + effectKey);
            let paramRegex = new RegExp("<s:" + effectKey + ">", "g");
            desc = desc.replace(paramRegex, effectShort);
        }
        else {
            break;
        }
        infiBreak++;
        if (infiBreak > 100) {
            break;
        }
    }
    if (desc && skill == "Ex") {
        let costText = 'Cost: <span style="color: #008c9b;">' + cost[level - 1] + "</span>";
        if (level != targetLevel && cost[level - 1] != cost[targetLevel - 1]) {
            costText += '/<span style="color: #588f00;">' + cost[targetLevel - 1] + "</span>";
        }
        desc = costText + "<br>" + desc;
    }
    return desc;
}
