let charlist, language_strings, raid_history;

let raidFilters = {};

function loadResources() {

    $.getJSON('json/charlist.json?24').done(function (json) {
        charlist = json;
        checkResources();
    });

    $.getJSON('json/strings.json?11').done(function (json) {
        language_strings = json;
        checkResources();
    });

    $.getJSON('json/raids.json').done(function (json) {
        raid_history = json;
        checkResources();
    });
}

function checkResources() {

    if (charlist && language_strings && raid_history) {

        data = tryParseJSON(localStorage.getItem('save-data'));

        // if (data) {
        //     events_data = data.events_data ?? {};
        // }
        // else {
        //     events_data = {};
        // }

        if (data?.language) {
            language = data.language;
            if (language == "EN") {
                language = "En";
            }
            else if (language == "KR") {
                language = "Kr";
            }
            else if (language == "JP") {
                language = "Jp";
            }
            else if (language == "CN") {
                language = "Tw";
            }
            else if (language == "TH") {
                language = "Th";
            }
        }

        init();
    }
}

function init() {

    let textElements = document.getElementsByClassName('display-string');

    for (let i = 0; i < textElements.length; i++) {

        let dataId = textElements[i].getAttribute('data-id');

        textElements[i].innerText = GetLanguageString(dataId);
    }

    CreateRaidCards();

    document.getElementById("timelines-wrapper").addEventListener("wheel", (event) => event.currentTarget.scrollLeft += event.deltaY, {passive: false});

}

function CreateRaidCards() {

    for (let r = 0; r < raid_history.servers.length; r++) {
        let server = raid_history.servers[r];

        for (let i = 0; i < raid_history[server].length; i++) {

            CreateRaidCard(raid_history[server][i], server);
        }

        CreateRaidCard({"End": true}, server);
    }
}

function CreateRaidCard(raid, server) {

    let raidCard = document.createElement("div");
    raidCard.className = "raid-card";

    if (raid.Blank) {
        raidCard.classList.add("blank");
        document.getElementById(server + "-timeline").appendChild(raidCard);
        return;
    }
    else if (raid.End) {
        raidCard.className = "timeline-end";
        document.getElementById(server + "-timeline").appendChild(raidCard);
        return;
    }

    raidCard.classList.add("raid-" + raid.Armour.toLowerCase());
    raidCard.setAttribute("filter-raid", raid.Boss);
    raidCard.setAttribute("filter-terrain", raid.Terrain);

    let bossImg = document.createElement("img");
    bossImg.src = "icons/Raids/Boss_Portrait_" + raid.Boss + ".png";

    let terrainBubble = document.createElement("div");
    terrainBubble.className = "terrain-bubble";

    let terrainImg = document.createElement("img");
    terrainImg.src = "icons/Mood/Terrain_" + raid.Terrain + ".png";
    terrainBubble.appendChild(terrainImg);

    let raidDate = document.createElement("div");
    raidDate.className = "raid-date";
    raidDate.innerText = (raid.Start_Date.Day + "/" + raid.Start_Date.Month + "/" + raid.Start_Date.Year);

    let raidSeason = document.createElement("div");
    raidSeason.className = "raid-season";
    raidSeason.innerText = "S " + raid.Season;

    let raidBossCount = document.createElement("div");
    raidBossCount.className = "raid-bosscount";
    raidBossCount.innerText = "# " + raid.Boss_Count;

    let raidTerrainCount = document.createElement("div");
    raidTerrainCount.className = "raid-terraincount";
    raidTerrainCount.innerText = "# " + raid.Boss_Terrain_Count;

    let raidDifficulty = document.createElement("div");
    raidDifficulty.className = "raid-difficulty";
    raidDifficulty.innerText = raid.Max_Difficulty;

    raidCard.appendChild(bossImg);
    raidCard.appendChild(terrainBubble);
    raidCard.appendChild(raidDate);
    raidCard.appendChild(raidSeason);
    raidCard.appendChild(raidBossCount);
    raidCard.appendChild(raidTerrainCount);
    raidCard.appendChild(raidDifficulty);

    raidCard.setAttribute("raid-uid", raid.uid);
    raidCard.setAttribute("raid-server", server);
    raidCard.id = server + "-" + raid.uid;

    raidCard.addEventListener('click', (event) => {
        RaidClicked(event.currentTarget.getAttribute("raid-server"), event.currentTarget.getAttribute("raid-uid"));
    })

    document.getElementById(server + "-timeline").appendChild(raidCard);
}

function TimelineFiltersToggle() {

    let filtersElement = document.getElementById("timeline-filters");

    filtersElement.classList.toggle("show")

    raidFilters = {};

    ResetRaidFilters();
}

function FilterTimeline(type, filterValue) {

    raidFilters[type] = filterValue;

    ResetRaidFilters();

    if (type == "raid") {
        delete raidFilters["terrain"];
    }

    if (raidFilters["raid"]) {
        let raidTerrains = raid_history.raids[raidFilters["raid"]].Terrains;

        for (let i = 0; i < raidTerrains.length; i++) {

            document.getElementById("terrain-filter-" + raidTerrains[i]).style.display = "";
        }

        document.getElementById("raid-filter-divider").style.display = "";

        document.getElementById("raid-filter-" + raidFilters["raid"]).classList.add("selected");
    }

    if (raidFilters["terrain"]) {
        document.getElementById("terrain-filter-" + raidFilters["terrain"]).classList.add("selected");
    }

    ApplyTimelineFilters();
}

function ApplyTimelineFilters() {

    let timelineContainers = document.getElementsByClassName("server-timeline");
    let containerCount = timelineContainers.length;

    let filterProperties = Object.keys(raidFilters);
    let filterCount = filterProperties.length;

    let index = 0;

    while (true) {

        let continueWhile = false;

        let hidden = Array(containerCount).fill(false);

        for (let i = 0; i < containerCount; i++) {
            let raidCard = timelineContainers[i].children[index];

            if (raidCard && (raidCard.classList.contains("blank") || raidCard.classList.contains("timeline-end"))) {
                hidden[i] = true;
                continueWhile = true;
                if (raidFilters["blank"]) {
                    raidCard.style.display = "none";
                }
            }
            else if (raidCard) {

                let hide = false;

                for (let ii = 0; ii < filterCount; ii++) {

                    if (filterProperties[ii] == "blank") {
                        continue;
                    }

                    let attributeValue = raidCard.getAttribute("filter-" + filterProperties[ii]);

                    if (attributeValue && attributeValue == raidFilters[filterProperties[ii]]) { }
                    else if (attributeValue) {
                        hide = true;
                    }
                }

                if (hide) {
                    if (raidFilters["blank"]) {
                        raidCard.style.display = "none";
                    }
                    else {
                        raidCard.style.visibility = "hidden";
                    }
                    hidden[i] = true;
                }
                continueWhile = true;
            }
            else {
                hidden[i] = true;
            }
        }

        if (!hidden.includes(false)) {
            for (let i = 0; i < containerCount; i++) {
                let raidCard = timelineContainers[i].children[index];

                if (raidCard) {
                    raidCard.style.display = "none";
                }
            }
        }

        if (!continueWhile) {
            break;
        }

        index++;
    }
}

function ResetRaidFilters() {

    let timelineContainers = document.getElementsByClassName("server-timeline");

    for (let i = 0; i < timelineContainers.length; i++) {

        let raidCards = timelineContainers[i].children;

        for (let ii = 0; ii < raidCards.length; ii++) {

            raidCards[ii].style.display = "";
            raidCards[ii].style.visibility = "";
        }
    }

    let bossFilters = document.getElementsByClassName("raid-boss-filter");

    for (let i = 0; i < bossFilters.length; i++) {

        bossFilters[i].classList.remove("selected");
    }

    let terrainFilters = document.getElementsByClassName("raid-terrain-filter");

    for (let i = 0; i < terrainFilters.length; i++) {

        terrainFilters[i].style.display = "none";
        terrainFilters[i].classList.remove("selected");
    }

    document.getElementById("raid-filter-divider").style.display = "none";
}

function RaidClicked(server, uid) {

    let serverTimelines = document.getElementsByClassName("server-timeline");

    for (let i = 0; i < serverTimelines.length; i++) {

        if (serverTimelines[i].id != server + "-timeline") {
            serverTimelines[i].style.display = "none";
        }
    }

    let serverLabels = document.getElementById("server-labels").children;

    for (let i = 0; i < serverLabels.length; i++) {

        if (serverLabels[i].id != server + "-timeline-label") {
            serverLabels[i].style.display = "none";
        }
    }

    let raidCards = document.getElementsByClassName("raid-card");
    
    for (let i = 0; i < raidCards.length; i++) {
        raidCards[i].classList.remove("selected");
    }

    document.getElementById(server + "-" + uid).classList.add("selected");

    document.getElementById("timeline-filter-container").style.display = "none";
    document.getElementById("timelines-expand-arrow").style.display = "";

    FilterTimeline("blank", true);
}

function ExpandRaidTimeline() {

    let serverTimelines = document.getElementsByClassName("server-timeline");

    for (let i = 0; i < serverTimelines.length; i++) {
        serverTimelines[i].style.display = "";
    }

    let serverLabels = document.getElementById("server-labels").children;

    for (let i = 0; i < serverLabels.length; i++) {
        serverLabels[i].style.display = "";
    }

    document.getElementById("timeline-filter-container").style.display = "";
    document.getElementById("timelines-expand-arrow").style.display = "none";

    FilterTimeline("blank", false);
}