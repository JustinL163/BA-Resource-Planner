let charlist, language_strings, raid_history, student_info;

let currentServer = "", currentUid = "", currentDifficulty = "", currentType = "";

let currentRaidVideo = "";
let submissionMode = "";

let localSubmissions;

let studentSearchMapping, studentSearchKeys;
let searchResultSize = 5;

let charSearchActive = false;
let charSearchMode = "";

let borrowMode = false;
let debug = false;

let selectedStudentSlot = "";
let selectedFilterSlot = "";

let usedStudents = [];
let usedBorrow = false;

let raidClears = [];

let includeFilters, excludeFilters;

let raidFilters = {};

let raid_videos_object = {};

let global = {};

let serverNames = { "Japan": "JP", "Global": "Gbl", "China": "CN" };

global.selectedRaid = {};
global.selectedRaid.maxDifficulty = "";

function loadResources() {

    $.getJSON('json/skillinfo/en.json?1').done(function (json) {
        charlist = json;
        checkResources();
    });

    $.getJSON('json/strings.json?13').done(function (json) {
        language_strings = json;
        checkResources();
    });

    $.getJSON('json/raids.json?2').done(function (json) {
        raid_history = json;
        checkResources();
    });

    $.getJSON('json/student_info.json?1').done(function (json) {
        student_info = json;
        LoadStudentInfo();
    })
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

    localSubmissions = JSON.parse(localStorage.getItem("local-submissions"));

    gUsername = localStorage.getItem("username");
    gAuthkey = localStorage.getItem("authkey");

    if (data?.page_theme != undefined) {
        setTheme(data.page_theme);
    }

    let textElements = document.getElementsByClassName('display-string');

    for (let i = 0; i < textElements.length; i++) {

        let dataId = textElements[i].getAttribute('data-id');

        textElements[i].innerText = GetLanguageString(dataId);
    }

    buildLanguages();
    document.getElementById('languages').value = language;

    CreateRaidCards();

    document.getElementById("timelines-wrapper").addEventListener("wheel", (event) => event.currentTarget.scrollLeft += event.deltaY, { passive: false });

    InitKeyTracking();

    $(document).click(function (e) {
        if (charSearchActive && !document.getElementById("student-searcher").contains(e.target)) {
            if (e.target.classList.contains("team-student") || e.target.parentElement.classList.contains("team-student")
                || e.target.classList.contains("student-filter-slot") || e.target.parentElement.classList.contains("student-filter-slot")) {
                return;
            }
            charSearchActive = false;
            $("#student-searcher").hide();
        }
    });

    StartValidation();

    $("#submission-editor").click(function (e) {
        if (!document.getElementById("submission-editor").children[0].contains(e.target)) {
            document.getElementById("submission-editor").style.display = "none";
            currentRaidVideo = "";
        }
    })

    $("#submission-viewer").click(function (e) {
        if (!document.getElementById("submission-viewer").children[0].contains(e.target)) {
            document.getElementById("submission-viewer").style.display = "none";
            currentRaidVideo = "";
        }
    })
}

function StartValidation() {

    inputElements = ["raid-submission-score", "raid-submission-level"];
    for (let i = 0; i < inputElements.length; i++) {
        let inputElement = document.getElementById(inputElements[i]);

        inputElement.addEventListener('input', (event) => {
            validateBasic(event.currentTarget.id);
        });

        inputElement.addEventListener('beforeinput', (event) => {
            preInput = event.target.value;
        });

        inputElement.addEventListener('focusout', (event) => {
            let validation = validateBasic(event.currentTarget.id);

            preInput = '';
        });
    }
}

function handleKeydown(e, keyPressed) {

    let keylist = Object.keys(keyPressed);
    let keycount = keylist.length;

    if (charSearchActive) {
        let searchElement = document.getElementById("student-searchbox");

        if (keyPressed.Escape) {
            if (searchElement.value) {
                searchElement.value = "";
            }
            else {
                charSearchActive = false;
                $("#student-searcher").hide();
            }
            return;
        }
        else if (keyPressed.Shift) {
            ToggleBorrowMode();
            return;
        }

        if (document.activeElement != searchElement) {
            searchElement.focus();
        }
        else {
            if (keyPressed.Enter || keyPressed.Tab) {
                e.preventDefault();
                SearchSelection("student-searched-0");
            }
            else if (keycount == 1 && "12345".includes(keylist[0])) {
                e.preventDefault();
                SearchSelection("student-searched-" + (parseInt(keylist[0]) - 1));
            }
        }
    }
}

function CreateRaidCards() {

    for (let r = 0; r < raid_history.servers.length; r++) {
        let server = raid_history.servers[r];

        for (let i = 0; i < raid_history[server].length; i++) {

            CreateRaidCard(raid_history[server][i], server, "-timeline");
        }

        CreateRaidCard({ "End": true }, server, "-timeline");
    }
}

function CreateRaidCard(raid, server, idSuffix) {

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
    bossImg.className = "boss-icon";
    bossImg.src = "icons/Raids/Raid_Portrait_" + raid.Boss + ".png";

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

    if (server) {
        raidCard.addEventListener('click', (event) => {
            RaidClicked(event.currentTarget.getAttribute("raid-server"), event.currentTarget.getAttribute("raid-uid"));
        })
    }

    document.getElementById(server + idSuffix).appendChild(raidCard);
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

    document.getElementById("raid-submissions").style.display = "";

    currentServer = server;
    currentUid = uid;
    currentType = "raids";

    document.getElementById("mobile-collapsed-server-indicator").innerText = serverNames[server];

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
    document.getElementById("raid-timeline").classList.add("collapsed");

    FilterTimeline("blank", true);

    let raid = raid_history[server].find(obj => { return obj.uid == uid });

    CreateDifficultyTabs(raid);

    let cardHolder = document.getElementById("raid-card-holder").children;
    while (cardHolder.length > 0) {
        cardHolder[0].remove();
    }
    CreateRaidCard(raid, "", "raid-card-holder");

    ClearOldVideoCards();

    raid_videos_object = {};

    LoadRaidVideoData(server, raid);

    // if (currentDifficulty && (raid_history.raid_difficulties_short.indexOf(raid.Max_Difficulty) < raid_history.raid_difficulties.indexOf(currentDifficulty))) {
    //     DifficultyClicked(currentDifficulty);
    // }
    // else {
    //     DifficultyClicked(raid.Max_Difficulty);
    // }
}

// Request raid videos data for selected raid
async function LoadRaidVideoData(server, raid) {

    $.getJSON(`https://raw.githubusercontent.com/JustinL163/ba-planner-data/main/shared-videos/${server}/raids/${raid.uid}.json`).done(function (json) {
        raid_videos_object = json;
        if (currentDifficulty && (raid_history.raid_difficulties_short.indexOf(raid.Max_Difficulty) < raid_history.raid_difficulties.indexOf(currentDifficulty))) {
            DifficultyClicked(currentDifficulty);
        }
        else {
            DifficultyClicked(raid.Max_Difficulty);
        }
    })

    // raid_videos_object = jsontest[raid.uid];
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
    document.getElementById("raid-submissions").style.display = "none";
    document.getElementById("raid-timeline").classList.remove("collapsed");

    FilterTimeline("blank", false);
}

function CreateDifficultyTabs(raid) {

    let difficultiesContainer = document.getElementById("raid-difficulties");

    while (difficultiesContainer.children.length > 0) {
        difficultiesContainer.children[0].remove();
    }

    let maxDifficulty = raid.Max_Difficulty;
    global.selectedRaid.maxDifficulty = raid.Max_Difficulty;

    let difficultyIndex = raid_history.raid_difficulties_short.indexOf(maxDifficulty);
    let difficulties = raid_history.raid_difficulties_short.length;

    for (let i = difficultyIndex; i < difficulties; i++) {

        let difficultyTab = document.createElement("div");
        difficultyTab.innerText = raid_history.raid_difficulties[i];
        difficultyTab.id = "difficulty-" + raid_history.raid_difficulties[i];

        difficultyTab.addEventListener('click', (event) => {
            DifficultyClicked(event.currentTarget.id.substring(11));
        })

        difficultiesContainer.appendChild(difficultyTab);
    }
}

function CreateRaidVideoCard(cardObject) {

    let raidScore = cardObject.score;
    let playerLevel = cardObject.level;
    let raidLink = cardObject.link;

    let raidVideoCard = document.createElement("div");
    raidVideoCard.className = "raid-video-card";
    raidVideoCard.id = cardObject.uuid;

    if (gUsername === cardObject.author) {
        raidVideoCard.style.backgroundColor = "#4d775687";
    }

    let raidVideoCardHeader = document.createElement("div");
    raidVideoCardHeader.className = "raid-video-card-header";

    let raidScoreText = document.createElement("div");
    raidScoreText.className = "raid-score";
    raidScoreText.innerText = commafy(raidScore);

    let raidPlayerLevel = document.createElement("div");
    raidPlayerLevel.className = "player-level";
    raidPlayerLevel.innerText = GetLanguageString("label-levelshort") + " " + playerLevel;

    raidVideoCardHeader.appendChild(raidScoreText);
    raidVideoCardHeader.appendChild(raidPlayerLevel);

    let raidTeams = document.createElement("div");
    raidTeams.className = "raid-teams";

    let teams = cardObject.teams;
    for (let i = 0; i < teams.length; i++) {

        let raidTeam = CreateRaidTeamElement(i + 1);

        let teamStrikers = raidTeam.children[1];
        let teamSpecials = raidTeam.children[2];

        let team = teams[i];
        for (let ii = 0; ii < 6; ii++) {

            let teamStudent = document.createElement("div");
            teamStudent.className = "student";

            if (team[ii]) {
                let studentImg = document.createElement("img");
                studentImg.src = "icons/Portrait/Icon_" + team[ii] + ".webp";

                teamStudent.appendChild(studentImg);

                if (typeof (team[ii]) == "object") {
                    teamStudent.classList.add("student-borrow");
                }
            }
            else {
                teamStudent.className = "student student-empty";
            }

            if (ii < 4) {
                teamStrikers.appendChild(teamStudent);
            }
            else {
                teamSpecials.appendChild(teamStudent);
            }
        }

        raidTeams.appendChild(raidTeam);
    }

    let raidVideoLink = document.createElement("div");
    raidVideoLink.className = "raid-video-link";

    let videoLink = document.createElement("a");
    videoLink.href = raidLink;
    videoLink.innerText = raidLink;
    videoLink.target = "_blank";

    raidVideoLink.appendChild(videoLink);

    raidVideoCard.appendChild(raidVideoCardHeader);
    raidVideoCard.appendChild(raidTeams);
    raidVideoCard.appendChild(raidVideoLink);

    document.getElementById("raid-video-cards").appendChild(raidVideoCard);

    raidVideoCard.addEventListener('click', (event) => {
        LoadVideoModal(event.currentTarget.id);
    })
}

function CreateRaidTeamElement(teamNum) {

    let raidTeam = document.createElement("div");
    raidTeam.className = "raid-team";

    let raidTeamNum = document.createElement("div");
    raidTeamNum.className = "team-num";
    raidTeamNum.innerText = teamNum;

    let teamStrikers = document.createElement("div");
    teamStrikers.className = "team-strikers";

    let teamSpecials = document.createElement("div");
    teamSpecials.className = "team-specials";

    raidTeam.appendChild(raidTeamNum);
    raidTeam.appendChild(teamStrikers);
    raidTeam.appendChild(teamSpecials);

    return raidTeam;
}

function LoadVideoModal(uuid) {

    let raidObject = raidClears.find(obj => { return obj.uuid == uuid });

    if (!raidObject) {
        console.log("Raid not found")
        return;
    }

    currentRaidVideo = uuid;

    document.getElementById("raid-viewer-videolink").innerHTML = '<a href="' + raidObject.link + '">' + raidObject.link + '</a>';
    document.getElementById("raid-viewer-score").innerText = commafy(raidObject.score);
    document.getElementById("raid-viewer-level").innerText = raidObject.level;

    let raidViewerTeams = document.getElementById("raid-viewer-teams");

    while (raidViewerTeams.children.length > 0) {
        raidViewerTeams.children[0].remove();
    }

    let teams = raidObject.teams;
    for (let i = 0; i < teams.length; i++) {

        let raidTeam = CreateRaidTeamElement(i + 1);

        let teamStrikers = raidTeam.children[1];
        let teamSpecials = raidTeam.children[2];

        let team = teams[i];
        for (let ii = 0; ii < 6; ii++) {

            let teamStudent = document.createElement("div");
            teamStudent.className = "student";

            if (team[ii]) {
                let studentImg = document.createElement("img");
                studentImg.src = "icons/Portrait/Icon_" + team[ii] + ".webp";

                teamStudent.appendChild(studentImg);

                if (typeof (team[ii]) == "object") {
                    teamStudent.classList.add("student-borrow");
                }
            }
            else {
                teamStudent.className = "student student-empty";
            }

            if (ii < 4) {
                teamStrikers.appendChild(teamStudent);
            }
            else {
                teamSpecials.appendChild(teamStudent);
            }
        }

        raidViewerTeams.appendChild(raidTeam);
    }

    document.getElementById("submission-viewer").style.display = "";

    if (raidObject.author === gUsername) {
        document.getElementById("submission-edit-button").style.display = "";
    }
    else {
        document.getElementById("submission-edit-button").style.display = "none";
    }
}

function EditVideoSubmission() {

    let raidObject = raidClears.find(obj => { return obj.uuid == currentRaidVideo });

    if ((!gAuthkey || !gUsername) && !debug) {
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: GetLanguageString("text-goregisteraccount"),
            color: alertColour
        })
        return;
    }

    usedStudents = [];
    usedBorrow = false;
    document.getElementById("search-footer")?.classList.remove("borrow-used");
    borrowMode = false;

    submissionMode = "Edit";

    document.getElementById("submission-viewer").style.display = "none";
    document.getElementById("submission-editor").style.display = "";

    document.getElementById("submission-editor-title").innerText = GetLanguageString("text-editvideosubmission");

    let difficultiesSelect = document.getElementById("raid-difficulty-select");

    while (difficultiesSelect.children.length > 0) {
        difficultiesSelect.children[0].remove();
    }

    let maxDifficulty = global.selectedRaid.maxDifficulty;

    let difficultyIndex = raid_history.raid_difficulties_short.indexOf(maxDifficulty);
    let difficulties = raid_history.raid_difficulties_short.length;

    for (let i = difficultyIndex; i < difficulties; i++) {
        addOption(difficultiesSelect, raid_history.raid_difficulties[i], raid_history.raid_difficulties[i]);
    }

    if (currentDifficulty) {
        difficultiesSelect.value = currentDifficulty;
    }
    
    if (!difficultiesSelect.value) {
        difficultiesSelect.value = raid_history.raid_difficulties[difficultyIndex];
    }

    let raidSubmissionTeams = document.getElementById("raid-submission-teams");

    while (raidSubmissionTeams.children.length > 0) {
        raidSubmissionTeams.children[0].remove();
    }

    let teams = raidObject.teams;
    for (let i = 0; i < teams.length; i++) {

        let raidTeam = CreateRaidTeamElement(i + 1);

        let teamStrikers = raidTeam.children[1];
        let teamSpecials = raidTeam.children[2];

        let team = teams[i];
        for (let ii = 0; ii < 6; ii++) {

            let teamStudent = GetBlankTeamSlot();

            if (team[ii]) {
                teamStudent.children[0].src = "icons/Portrait/Icon_" + team[ii] + ".webp";
                teamStudent.className = "team-student"
                teamStudent.setAttribute("character-id", team[ii].toString());

                if (typeof (team[ii]) == "object") {
                    teamStudent.classList.add("student-borrow");
                }
            }
            else { }

            if (ii < 4) {
                teamStrikers.appendChild(teamStudent);
            }
            else {
                teamSpecials.appendChild(teamStudent);
            }
        }

        raidTeam.appendChild(CreateRaidTeamActionbar());

        raidSubmissionTeams.appendChild(raidTeam);
    }

    document.getElementById("raid-submission-videolink").value = raidObject.link;
    document.getElementById("raid-submission-score").value = raidObject.score;
    document.getElementById("raid-submission-level").value = raidObject.level;

}

function DifficultyClicked(difficulty) {

    if (raid_history.raid_difficulties_short.includes(difficulty)) {
        difficulty = raid_history.raid_difficulties[raid_history.raid_difficulties_short.indexOf(difficulty)];
    }

    currentDifficulty = difficulty;

    // Highlight selected difficulty tab
    let difficultyTabs = document.getElementById("raid-difficulties").children;

    for (let i = 0; i < difficultyTabs.length; i++) {
        difficultyTabs[i].classList.remove("selected");
    }

    document.getElementById("difficulty-" + difficulty).classList.add("selected");

    ClearOldVideoCards();

    // Create new video cards
    raidClears = raid_videos_object?.[difficulty] ?? [];

    let raidUuids = [];
    for (let i = 0; i < raidClears?.length; i++) {
        raidUuids.push(raidClears[i].uuid);
    }

    let localClears = localSubmissions?.[currentServer]?.["raids"]?.[currentUid]?.[difficulty];

    let tempLocal = [], clearExpired = false;
    for (let i = 0; i < localClears?.length; i++) {
        if (!localClears[i].expiry || localClears[i].expiry < Date.now() || raidUuids.includes(localClears[i].uuid)) {
            clearExpired = true;
        }
        else {
            tempLocal.push(localClears[i]);
        }
    }

    if (clearExpired) {
        localSubmissions[currentServer]["raids"][currentUid][difficulty] = tempLocal;
        localClears = tempLocal;
        localStorage.setItem("local-submissions", JSON.stringify(localSubmissions));
    }

    if (localClears) {
        raidClears = raidClears.concat(localClears);
    }

    raidClears.sort((a, b) => b.score - a.score)

    for (let i = 0; i < raidClears?.length; i++) {
        CreateRaidVideoCard(raidClears[i]);
    }

    ClearFilterSlots();
    // UpdateUsedFilterStudents();
    // FilterRaidVideoCards();
}

function ClearOldVideoCards() {
    let existingCards = document.getElementById("raid-video-cards");

    while (existingCards.children.length > 0) {
        existingCards.children[0].remove();
    }
}

function SubmissionButtonClicked() {

    if ((!gAuthkey || !gUsername) && !debug) {
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: GetLanguageString("text-goregisteraccount"),
            color: alertColour
        })
        return;
    }

    usedStudents = [];
    usedBorrow = false;
    document.getElementById("search-footer")?.classList.remove("borrow-used");
    borrowMode = false;

    submissionMode = "New";

    document.getElementById("submission-editor").style.display = "";

    document.getElementById("submission-editor-title").innerText = GetLanguageString("text-newvideosubmission");

    let difficultiesSelect = document.getElementById("raid-difficulty-select");

    while (difficultiesSelect.children.length > 0) {
        difficultiesSelect.children[0].remove();
    }

    let maxDifficulty = global.selectedRaid.maxDifficulty;

    let difficultyIndex = raid_history.raid_difficulties_short.indexOf(maxDifficulty);
    let difficulties = raid_history.raid_difficulties_short.length;

    for (let i = difficultyIndex; i < difficulties; i++) {
        addOption(difficultiesSelect, raid_history.raid_difficulties[i], raid_history.raid_difficulties[i]);
    }

    if (currentDifficulty) {
        difficultiesSelect.value = currentDifficulty;
    }
    
    if (!difficultiesSelect.value) {
        difficultiesSelect.value = raid_history.raid_difficulties[difficultyIndex];
    }

    let raidSubmissionTeams = document.getElementById("raid-submission-teams");

    while (raidSubmissionTeams.children.length > 0) {
        raidSubmissionTeams.children[0].remove();
    }

    let raidTeam = CreateRaidTeamElement(1);
    raidTeam.appendChild(CreateRaidTeamActionbar());
    FillRaidTeamBlanks(raidTeam);

    document.getElementById("raid-submission-teams").appendChild(raidTeam);

    document.getElementById("raid-submission-videolink").value = "";
    document.getElementById("raid-submission-score").value = "";
    document.getElementById("raid-submission-level").value = "";
}

function CreateRaidTeamActionbar() {

    let actionbar = document.createElement("div");
    actionbar.className = "team-actionbar";

    let plusTeamButton = document.createElement("img");
    plusTeamButton.src = "icons/UI/plus-solid.svg";
    plusTeamButton.className = "team-add-button team-action-button";

    plusTeamButton.addEventListener('click', (event) => {
        InsertBlankRaidTeam(event.currentTarget.parentElement.parentElement);
    });

    let crossTeamButton = document.createElement("img");
    crossTeamButton.src = "icons/UI/xmark-solid.svg";
    crossTeamButton.className = "team-remove-button team-action-button";

    crossTeamButton.addEventListener('click', (event) => {
        let teamRemoving = event.currentTarget.parentElement.parentElement;
        setTimeout(() => {
            teamRemoving.remove();
            UpdateTeamNumLabels();
            UpdateUsedStudents();
        }, 100);
    });

    let upTeamButton = document.createElement("img");
    upTeamButton.src = "icons/UI/arrow-up-solid.svg";
    upTeamButton.className = "team-up-button team-action-button";

    upTeamButton.addEventListener('click', (event) => {
        MoveRaidTeam(event.currentTarget.parentElement.parentElement, "Up");
    })

    let downTeamButton = document.createElement("img");
    downTeamButton.src = "icons/UI/arrow-down-solid.svg";
    downTeamButton.className = "team-down-button team-action-button";

    downTeamButton.addEventListener('click', (event) => {
        MoveRaidTeam(event.currentTarget.parentElement.parentElement, "Down");
    })

    actionbar.appendChild(plusTeamButton);
    actionbar.appendChild(crossTeamButton);
    actionbar.appendChild(upTeamButton);
    actionbar.appendChild(downTeamButton);

    return actionbar;
}

function InsertBlankRaidTeam(sibling) {
    let raidTeamContainer = document.getElementById("raid-submission-teams");
    if (raidTeamContainer.children.length >= 25) {
        basicAlert(GetLanguageString("text-teamslimit"));
        return;
    }

    let raidTeam = CreateRaidTeamElement(0);
    raidTeam.appendChild(CreateRaidTeamActionbar());
    FillRaidTeamBlanks(raidTeam);

    sibling.insertAdjacentElement('afterend', raidTeam);

    UpdateTeamNumLabels();
}

function MoveRaidTeam(element, direction) {

    if (direction == "Up") {
        element.previousElementSibling.insertAdjacentElement('beforebegin', element);
    }
    else if (direction == "Down") {
        element.nextElementSibling.insertAdjacentElement('afterend', element);
    }

    UpdateTeamNumLabels();
}

function UpdateTeamNumLabels() {
    let teams = document.getElementById("raid-submission-teams").children;

    for (let i = 0; i < teams.length; i++) {

        teams[i].children[0].innerText = (i + 1);
    }
}

function FillRaidTeamBlanks(raidTeam) {

    let teamStrikers = raidTeam.children[1];
    let teamSpecials = raidTeam.children[2];

    for (let i = 0; i < 4; i++) {
        teamStrikers.appendChild(GetBlankTeamSlot());
    }

    for (let i = 0; i < 2; i++) {
        teamSpecials.appendChild(GetBlankTeamSlot());
    }
}

function GetBlankTeamSlot() {

    let teamStudent = document.createElement("div");
    teamStudent.className = "team-student student-blank";
    if (debug) {
        teamStudent.id = debugUUID();
    }
    else {
        teamStudent.id = crypto.randomUUID();
    }

    let teamStudentImg = document.createElement("img");
    teamStudentImg.src = "icons/UI/plus-solid.svg";

    teamStudent.appendChild(teamStudentImg);

    teamStudent.addEventListener('click', (event) => {
        ClearStudentSlot(event.currentTarget.id);
        LoadStudentSearch(event.currentTarget.id, "submission-slot");
    })

    return teamStudent;
}

function ClearStudentSlot(parentid) {

    let parent = document.getElementById(parentid);

    if (!parent.classList.contains("student-blank")) {
        parent.classList.add("student-blank");
        parent.classList.remove("student-borrow");
        parent.children[0].src = "icons/UI/plus-solid.svg";
        parent.removeAttribute("character-id");
        UpdateUsedStudents();
    }
}

function LoadStudentSearch(parentid, mode) {

    charSearchMode = mode;

    selectedStudentSlot = parentid;

    let searcher = document.getElementById("student-searcher");

    if (!searcher) {
        searcher = CreateStudentSearch();
    }
    else {
        document.getElementById("student-searchbox").value = "";
    }

    searcher.style.display = "";

    document.getElementById("student-searchbox").focus();

    UpdateStudentSearch();

    keyPressed = {};

    setTimeout(() => {
        charSearchActive = true;
    }, 100);

    let parent = document.getElementById(parentid);
    let parentRect = parent.getBoundingClientRect();

    if (document.body.clientWidth <= 800) {
        searcher.style.top = (parentRect.bottom - 115) + "px";
    }
    else {
        searcher.style.top = (parentRect.bottom - 195) + "px";
    }

    searcher.style.left = parentRect.left + "px";
}

function CreateStudentSearch() {

    let studentSearcher = document.createElement("div");
    studentSearcher.id = "student-searcher";
    studentSearcher.addEventListener('input', (event) => {
        UpdateStudentSearch();
    })

    let studentSearchBody = document.createElement("div");
    studentSearchBody.id = "student-searcher-body";

    let searchSlots = document.createElement("div");
    searchSlots.id = "student-search-slots";

    for (let i = 0; i < searchResultSize; i++) {
        let searchSlotDiv = document.createElement("div");

        let searchSlot = document.createElement("img");
        searchSlot.id = "student-searched-" + i;
        searchSlot.className = "student-searched";

        let searchSlotP = document.createElement("p");
        searchSlotP.innerText = (i + 1);

        searchSlot.addEventListener('click', (event) => {
            SearchSelection(event.currentTarget.id);
        });

        searchSlotDiv.appendChild(searchSlot);
        searchSlotDiv.appendChild(searchSlotP);

        searchSlots.appendChild(searchSlotDiv);
    }

    let footerDiv = document.createElement("div");
    footerDiv.id = "search-footer";

    let searchBox = document.createElement("input");
    searchBox.id = "student-searchbox";
    searchBox.autocomplete = "off";

    let borrowButton = document.createElement("div");
    borrowButton.id = "search-borrow-button";
    borrowButton.innerText = GetLanguageString("button-borrow");

    borrowButton.addEventListener('click', (event) => {
        ToggleBorrowMode();
    })

    footerDiv.appendChild(searchBox);
    footerDiv.appendChild(borrowButton);

    studentSearchBody.appendChild(searchSlots);
    studentSearchBody.appendChild(footerDiv);

    studentSearcher.appendChild(studentSearchBody);

    document.body.appendChild(studentSearcher);

    if (charSearchMode == "filter-slot") {
        usedBorrow = true;
        document.getElementById("search-footer")?.classList.add("borrow-used");
        borrowMode = false;
    }

    return studentSearcher;
}

function ToggleBorrowMode() {

    if (usedBorrow) {
        return;
    }

    borrowMode = !borrowMode;

    let borrowButton = document.getElementById("search-borrow-button");

    if (borrowMode) {
        borrowButton.classList.add("selected");
    }
    else {
        borrowButton.classList.remove("selected");
    }

    UpdateStudentSearch();
}

function SearchSelection(id) {

    let searchSelected = document.getElementById(id);
    let studentId = searchSelected.getAttribute("character-id");

    let studentType = charlist[studentId].Type;


    if (charSearchMode == "submission-slot") {
        let availableSlotId = GetNextBlankSlot(studentType, true, studentId);

        if (availableSlotId) {
            UpdateStudentSlot(availableSlotId, studentId);
        }

        let nextSlotId = GetNextBlankSlot("Any", true, "");

        UpdateUsedStudents();

        if (nextSlotId) {
            LoadStudentSearch(nextSlotId, "submission-slot");
        }

        if (usedBorrow) {
            document.getElementById("search-borrow-button").classList.remove("selected");
        }
    }
    else if (charSearchMode == "filter-slot") {

        UpdateFilterSlot(studentId);

        UpdateUsedFilterStudents();
        FilterRaidVideoCards();

        charSearchActive = false;
        $("#student-searcher").hide();
    }
}

function UpdateUsedStudents() {

    usedStudents = [];

    let result = GetSubmissionTeams();
    let teams = result[0];

    for (let i = 0; i < teams.length; i++) {

        let team = teams[i];

        for (let ii = 0; ii < team.length; ii++) {

            if (team[ii]) {
                usedStudents.push(team[ii]);
            }
        }
    }

    if (result[2] > 0) {
        usedBorrow = true;
        document.getElementById("search-footer")?.classList.add("borrow-used");
        borrowMode = false;
    }
    else {
        usedBorrow = false;
        document.getElementById("search-footer")?.classList.remove("borrow-used");
    }
}

function UpdateUsedFilterStudents() {

    usedStudents = [];
    includeFilters = [];
    excludeFilters = [];

    let filterSlots = document.getElementsByClassName("student-filter-slot");

    for (let i = 0; i < filterSlots.length; i++) {

        let studentId = filterSlots[i].getAttribute("character-id");

        if (studentId) {
            usedStudents.push(studentId);

            if (filterSlots[i].parentElement.previousElementSibling.getAttribute("data-id") == "label-includedstudents") {
                includeFilters.push(studentId);
            }
            else {
                excludeFilters.push(studentId);
            }
        }
    }
}

function FilterRaidVideoCards() {

    for (let i = 0; i < raidClears?.length; i++) {

        let passes = true;

        let teamString = raidClears[i].teams.toString();

        for (let ii = 0; ii < includeFilters.length; ii++) {
            if (!teamString.includes(includeFilters[ii])) {
                passes = false;
            }
        }

        for (let ii = 0; ii < excludeFilters.length; ii++) {
            if (teamString.includes(excludeFilters[ii])) {
                passes = false;
            }
        }

        if (passes) {
            document.getElementById(raidClears[i].uuid).style.display = "";
        }
        else {
            document.getElementById(raidClears[i].uuid).style.display = "none";
        }
    }
}

function UpdateStudentSlot(guid, studentId) {

    let studentSlot = document.getElementById(guid);
    studentSlot.classList.remove("student-blank");
    studentSlot.setAttribute("character-id", studentId);

    if (borrowMode) {
        studentSlot.classList.add("student-borrow");
    }

    studentSlot.children[0].src = "icons/Portrait/Icon_" + studentId + ".webp";
}

function UpdateFilterSlot(studentId) {

    let filterSlot = document.getElementById(selectedFilterSlot);
    filterSlot.classList.add("student-filtered");
    filterSlot.setAttribute("character-id", studentId);

    filterSlot.children[1].src = "icons/Portrait/Icon_" + studentId + ".webp";
}

// https://stackoverflow.com/a/62216738
function stringSimilarity(str1, str2, gramSize) {
    function getNGrams(s, len) {
        s = ' '.repeat(len - 1) + s.toLowerCase() + ' '.repeat(len - 1);
        let v = new Array(s.length - len + 1);
        for (let i = 0; i < v.length; i++) {
            v[i] = s.slice(i, i + len);
        }
        return v;
    }

    if (!str1?.length || !str2?.length) { return 0.0; }

    let s1 = str1.length < str2.length ? str1 : str2;
    let s2 = str1.length < str2.length ? str2 : str1;

    let pairs1 = getNGrams(s1, gramSize);
    let pairs2 = getNGrams(s2, gramSize);
    let set = new Set(pairs1);

    let total = pairs2.length;
    let hits = 0;
    for (let item of pairs2) {
        if (set.delete(item)) {
            hits++;
        }
    }
    return hits / total;
}

function LoadStudentInfo() {

    studentSearchMapping = {};
    studentSearchKeys = [];

    let studentIds = Object.keys(student_info);

    for (let i = 0; i < studentIds.length; i++) {

        let student = student_info[studentIds[i]];

        for (let ii = 0; ii < student["EN"].length; ii++) {
            studentSearchMapping[student["EN"][ii].toLowerCase()] = studentIds[i];
            studentSearchKeys.push(student["EN"][ii].toLowerCase());
        }
    }
}

function SearchStudent(searchString, maxMatches) {

    if (!maxMatches) {
        maxMatches = 5;
    }

    let comparisons = [];

    for (let i = 0; i < studentSearchKeys.length; i++) {
        if (borrowMode || !usedStudents.includes(studentSearchMapping[studentSearchKeys[i]])) {
            comparisons.push({ "Name": studentSearchKeys[i], "Similarity": stringSimilarity(searchString, studentSearchKeys[i], 2) });
        }
    }

    comparisons.sort(function (a, b) { return parseFloat(b.Similarity) - parseFloat(a.Similarity); })

    let bestMatches = [];

    for (let i = 0; i < comparisons.length; i++) {

        if (searchString.length >= 4) {
            if (comparisons[i].Similarity <= 0.1 || !comparisons[i].Name.includes(searchString)) {
                continue;
            }
        }
        else {
            if (comparisons[i].Similarity <= 0.1 || comparisons[i].Name.substring(0, searchString.length) != searchString) {
                continue;
            }
        }

        let studentId = studentSearchMapping[comparisons[i].Name];
        if (!bestMatches.includes(studentId)) {
            bestMatches.push(studentId);
        }

        if (bestMatches.length >= maxMatches) {
            break;
        }
    }

    for (let i = 0; i < comparisons.length; i++) {

        let studentId = studentSearchMapping[comparisons[i].Name];
        if (!bestMatches.includes(studentId)) {
            bestMatches.push(studentId);
        }

        if (bestMatches.length >= maxMatches) {
            break;
        }
    }

    return bestMatches;
}

function UpdateStudentSearch() {

    let searchString = document.getElementById("student-searchbox").value;

    // if (searchString == "") {
    //     return;
    // }

    let bestMatches = SearchStudent(searchString, searchResultSize);

    for (let i = 0; i < searchResultSize; i++) {

        let el = document.getElementById("student-searched-" + i);

        if (bestMatches.length >= i) {
            el.src = "icons/Portrait/Icon_" + bestMatches[i] + ".webp";
            el.setAttribute("character-id", bestMatches[i]);
        }
        else {
            document.getElementById("student-searched-" + i).src = "";
            el.setAttribute("character-id", "");
        }
    }
}

function GetSubmissionTeams() {

    teamElements = document.getElementById("raid-submission-teams").children;

    let teams = [];
    let borrows = 0;

    let selectionPos = { "Team": 0, "Type": "Any", "Pos": 0 };

    for (let i = 0; i < teamElements.length; i++) {

        let team = [];

        for (let ii = 0; ii < 4; ii++) {
            let studentSlot = teamElements[i].children[1].children[ii];
            if (studentSlot.classList.contains("student-borrow")) {
                team.push([studentSlot.getAttribute("character-id")]);
                borrows++;
            }
            else {
                team.push(studentSlot.getAttribute("character-id"));
            }
            if (studentSlot.id == selectedStudentSlot) {
                selectionPos = { "Team": i, "Type": "Striker", "Pos": ii };
            }
        }

        for (let ii = 0; ii < 2; ii++) {
            let studentSlot = teamElements[i].children[2].children[ii];
            if (studentSlot.classList.contains("student-borrow")) {
                team.push([studentSlot.getAttribute("character-id")]);
                borrows++;
            }
            else {
                team.push(studentSlot.getAttribute("character-id"));
            }
            if (studentSlot.id == selectedStudentSlot) {
                selectionPos = { "Team": i, "Type": "Special", "Pos": (ii + 4) };
            }
        }

        teams.push(team);
    }

    return [teams, selectionPos, borrows];
}

function GetNextBlankSlot(type, fromCurrent, studentId) {

    let result = GetSubmissionTeams();
    let teams = result[0];
    let selectionPos = result[1];
    if (!fromCurrent) {
        selectionPos = { "Team": 0, "Type": "Any", "Pos": 0 };
    }
    // else if ((type == "Special" || type == "Any") && selectionPos.Type == "Striker") {
    //     selectionPos.Pos = 0;
    // }

    let newSlotId = "";

    for (let i = selectionPos.Team; i < teams.length; i++) {

        let team = teams[i];

        let teamStudents = [];

        let startPos = 0;
        if (i == selectionPos.Team) {
            startPos = selectionPos.Pos;
        }

        for (let ii = 0; ii < 6; ii++) {
            if (team[ii] && typeof (team[ii]) == "object") {
                teamStudents.push(team[ii][0]);
            }
            else if (team[ii]) {
                teamStudents.push(team[ii]);
            }
        }

        if (type == "Striker" || type == "Any") {

            for (let ii = startPos; ii < 4; ii++) {
                if (!newSlotId && team[ii] === null) {
                    newSlotId = document.getElementById("raid-submission-teams").children[i].children[1].children[ii].id;
                }
            }
        }

        if (!newSlotId) {
            startPos = 4;
            if (i == selectionPos.Team && selectionPos.Type != "Striker") {
                startPos = selectionPos.Pos;
            }

            if (type == "Special" || type == "Any") {

                for (let ii = startPos; ii < 6; ii++) {
                    if (!newSlotId && team[ii] === null) {
                        newSlotId = document.getElementById("raid-submission-teams").children[i].children[2].children[ii - 4].id;
                    }
                }
            }
        }

        if (teamStudents.includes(studentId)) {
            newSlotId = "";
        }

        if (newSlotId) {
            break;
        }
    }

    if (newSlotId) {
        return newSlotId;
    }

    return false;
}

function ValidateSubmissionField(field) {

    let fieldElement = document.getElementById(field);

    if (field == "raid-submission-videolink") {

        try {
            let urlObject = new URL(fieldElement.value);

            if (urlObject.hostname == "youtu.be") {

                let vString = urlObject.pathname.substring(1);

                // EmbedVideo("raid-submission-video-embed", "youtube", {"width": 392, "height": 224, "vString": vString});
                // EmbedVideo("raid-submission-video-embed", "youtube", {"width": 560, "height": 319, "vString": vString});
            }

            return true;
        }
        catch {
            return false;
        }
    }

    return false;
}

function SaveVideoSubmission() {

    let validated = ValidateSubmissionField("raid-submission-videolink");
    if (!validated) {
        basicAlert(GetLanguageString("text-invalidlink"));
        return;
    }
    validated = validateBasic("raid-submission-score", true);
    if (validated != "validated") {
        basicAlert(GetLanguageString("text-invalidraidscore"));
        return;
    }
    validated = validateBasic("raid-submission-level", true);
    if (validated != "validated") {
        basicAlert(GetLanguageString("text-invalidraidlevel"));
        return;
    }

    let linkfield = document.getElementById("raid-submission-videolink");
    if (linkfield.value.length > 100) {
        basicAlert(GetLanguageString("text-linktoolong"));
        return;
    }

    let teams = GetSubmissionTeams()[0];

    let studentCount = 0;
    for (let i = 0; i < teams.length; i++) {

        let team = teams[i];

        for (let ii = 0; ii < team.length; ii++) {

            if (team[ii]) {
                studentCount++;
            }
        }
    }

    if (studentCount == 0) {
        basicAlert(GetLanguageString("text-submissionemptyteams"));
        return;
    }

    let submissionObject = {
        "score": document.getElementById("raid-submission-score").value,
        "level": document.getElementById("raid-submission-level").value,
        "link": document.getElementById("raid-submission-videolink").value,
        "teams": teams
    }

    let difficulty = document.getElementById("raid-difficulty-select").value;

    if (submissionMode == "New") {
        UploadSubmission(submissionObject, currentServer, "raids", currentUid, difficulty);
    }
    else if (submissionMode == "Edit") {
        EditSubmission(submissionObject, currentServer, "raids", currentUid, difficulty, currentRaidVideo);
    }

    document.getElementById("submission-editor").style.display = "none";
}

function LocalSubmission(submissionObject, difficulty, uuid) {

    if (!localSubmissions) {
        localSubmissions = {};
    }

    if (!localSubmissions[currentServer]) {
        localSubmissions[currentServer] = {};
    }

    if (!localSubmissions[currentServer]["raids"]) {
        localSubmissions[currentServer]["raids"] = {};
    }

    if (!localSubmissions[currentServer]["raids"][currentUid]) {
        localSubmissions[currentServer]["raids"][currentUid] = {};
    }

    if (!localSubmissions[currentServer]["raids"][currentUid][difficulty]) {
        localSubmissions[currentServer]["raids"][currentUid][difficulty] = [];
    }

    for (let i = 0; i < localSubmissions[currentServer]["raids"][currentUid][difficulty].length; i++) {
        if (localSubmissions[currentServer]["raids"][currentUid][difficulty][i].uuid = uuid) {
            localSubmissions[currentServer]["raids"][currentUid][difficulty].splice(i, 1);
            break;
        }
    }

    submissionObject.expiry = Date.now() + (60 * 60 * 1000) // Expiry in 1 hour
    submissionObject.uuid = uuid;

    localSubmissions[currentServer]["raids"][currentUid][difficulty].push(submissionObject);

    localStorage.setItem("local-submissions", JSON.stringify(localSubmissions));

    if (currentDifficulty == difficulty) {
        DifficultyClicked(currentDifficulty);
    }
}

function EmbedVideo(containerId, platform, properties) {

    let embedContainer = document.getElementById(containerId);

    while (embedContainer.children.length > 0) {
        embedContainer.children[0].remove();
    }

    if (platform == "youtube") {

        let embedIframe = document.createElement("iframe");

        embedIframe.width = properties.width;
        embedIframe.height = properties.height;
        embedIframe.src = "https://www.youtube.com/embed/" + properties.vString;
        embedIframe.title = "YouTube video player";
        embedIframe.frameborder = "0";
        embedIframe.allow = "clipboard-write; encrypted-media;"
        embedIframe.allowFullscreen = "true";

        embedContainer.appendChild(embedIframe);
    }

}

function LabelClicked(server) {

    let lastRaidCard = document.getElementById(server + "-timeline").lastChild.previousElementSibling;

    if (lastRaidCard) {

        lastRaidCard.scrollIntoView({
            "behavior": "smooth",
            "block": "center",
            "inline": "center"
        })
    }
}

function FilterSlotClicked(id) {

    selectedFilterSlot = id;

    let filterSlot = document.getElementById(id);
    ClearFilterSlot(filterSlot);

    UpdateUsedFilterStudents();
    FilterRaidVideoCards();

    LoadStudentSearch(id, "filter-slot");
}

function ClearFilterSlot(filterSlot) {


    filterSlot.classList.remove("student-filtered");
    filterSlot.removeAttribute("character-id");

    filterSlot.children[1].src = "";
}

function ClearFilterSlots() {

    let filterSlots = document.getElementsByClassName("student-filter-slot");

    for (let i = 0; i < filterSlots.length; i++) {

        ClearFilterSlot(filterSlots[i]);
    }
}

function debugUUID() {
    var dt = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (dt + Math.random() * 16) % 16 | 0;
        dt = Math.floor(dt / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}