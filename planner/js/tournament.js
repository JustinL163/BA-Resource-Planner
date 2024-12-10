let student_info;
let studentSearchKeys;
let charlist;

let borrowMode = false;
let debug = true;

let usedStudents = [];
let usedBorrow = false;
let charSearchActive = false;
let searchResultSize = 5;
let selectedStudentSlot = "";
let lastSave = 0;
let lastLoad = 0;
let selectedContainer = "";
let localData = [];
let lastLoadDisplay;

let maxBans = 5;

let dTournaments = { "tournament-1": "S2 ShiroKuro", "tournament-2": "S3 Kaiten", "tournament-3": "S4 Hod", "tournament-5": "S5 Goz", "tournament-6": "S6 Goz", "tournament-7": "S7 Wakamo" };
let dStages = { "qualifiers": "Qualifiers", "groups": "Groups", "elimination": "Elimination" };
let dGames = { "game-1": "1", "game-2": "2", "game-3": "3", "game-4": "4" };
let dArmour = { "light": "Light", "heavy": "Heavy", "special": "Special", "elastic": "Elastic" };

$.getJSON('json/student_info.json?2').done(function (json) {
    student_info = json;
    LoadStudentInfo();
})

$.getJSON('json/skillinfo/en.json?2').done(function (json) {
    charlist = json;
});

function Loaded() {
    let raidTeam = CreateRaidTeamElement(1);
    FillRaidTeamBlanks(raidTeam);
    raidTeam.appendChild(CreateRaidTeamActionbar());

    document.getElementById("player-1-teams").appendChild(raidTeam);

    raidTeam = CreateRaidTeamElement(1);
    FillRaidTeamBlanks(raidTeam);
    raidTeam.appendChild(CreateRaidTeamActionbar());

    document.getElementById("player-2-teams").appendChild(raidTeam);

    InitKeyTracking();

    $(document).click(function (e) {
        if (charSearchActive && !document.getElementById("student-searcher").contains(e.target)) {
            if (e.target.classList.contains("team-student") || e.target.parentElement.classList.contains("team-student")
                || e.target.classList.contains("student-slot") || e.target.parentElement.classList.contains("student-slot")
                || e.target.classList.contains("student-force-pick")) {
                return;
            }
            charSearchActive = false;
            $("#student-searcher").hide();
        }
    });

    let tourneyPassword = localStorage.getItem("TournamentPassword");

    if (tourneyPassword) {
        document.getElementById("tournament-password").value = tourneyPassword;
        lastLoad = Date.now();
        LoadTournamentData(false);
    }

    lastLoadDisplay = document.getElementById("last-update-text");

    setInterval(() => {
        if (lastLoad != 0) {
            lastLoadDisplay.innerText = "Last data update: " + Math.floor((Date.now() - lastLoad) / 1000) + "s";
        }
        else {
            lastLoadDisplay.innerText = "Data not loaded"
        }
    }, 1000);
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

function SlotClicked(id) {

    selectedFilterSlot = id;

    let filterSlot = document.getElementById(id);
    ClearFilterSlot(filterSlot);

    // UpdateUsedFilterStudents();

    selectedContainer = "";
    LoadStudentSearch(id, "filter-slot");
}

function ClearFilterSlot(filterSlot) {


    filterSlot.classList.remove("student-filtered");
    filterSlot.removeAttribute("character-id");

    filterSlot.children[1].src = "";
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

function LoadStudentSearch(parentid, mode) {

    charSearchMode = mode;

    selectedStudentSlot = parentid;

    usedStudents = [];
    if (selectedContainer) {
        UpdateUsedStudents();
    }

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
    borrowButton.innerText = "Borrow"; //GetLanguageString("button-borrow");

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

function SearchSelection(id) {

    let searchSelected = document.getElementById(id);
    let studentId = searchSelected.getAttribute("character-id");

    let studentType = GetOldTypeFromSquadType(charlist[studentId].SquadType);


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
        
        UpdateSlot(studentId, selectedFilterSlot);

        let nextSlotId = GetNextBlankFilterSlot();

        UpdateUsedFilterStudents();

        if (nextSlotId) {
            selectedFilterSlot = nextSlotId;
            LoadStudentSearch(nextSlotId, "filter-slot");
        }
        else {
            charSearchActive = false;
            $("#student-searcher").hide();
        }
    }
}

function GetNextBlankFilterSlot() {
    let filterSlots = document.getElementsByClassName("student-slot");

    for (let i = 0; i < filterSlots.length; i++) {
        if (!filterSlots[i].getAttribute("character-id")) {
            return filterSlots[i].id;
        }
    }

    return null;
}

function UpdateSlot(studentId, slotId) {

    let filterSlot = document.getElementById(slotId);
    filterSlot.classList.add("student-filtered");
    filterSlot.setAttribute("character-id", studentId);

    filterSlot.children[1].src = "icons/Portrait/Icon_" + studentId + ".webp";
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
        selectedContainer = event.currentTarget.parentElement.parentElement.parentElement.id;
        ClearStudentSlot(event.currentTarget.id);
        LoadStudentSearch(event.currentTarget.id, "submission-slot");
    })

    return teamStudent;
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
                    newSlotId = document.getElementById(selectedContainer).children[i].children[1].children[ii].id;
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
                        newSlotId = document.getElementById(selectedContainer).children[i].children[2].children[ii - 4].id;
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

function GetSubmissionTeams(container) {

    if (!container) {
        container = selectedContainer;
    }

    teamElements = document.getElementById(container).children;

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

function UpdateStudentSlot(guid, studentId) {

    let studentSlot = document.getElementById(guid);
    studentSlot.classList.remove("student-blank");
    studentSlot.setAttribute("character-id", studentId);

    if (borrowMode) {
        studentSlot.classList.add("student-borrow");
    }

    studentSlot.children[0].src = "icons/Portrait/Icon_" + studentId + ".webp";
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

function CreateRaidTeamActionbar(num) {

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
        let teamsContainerId = teamRemoving.parentElement.id;
        setTimeout(() => {
            teamRemoving.remove();
            UpdateTeamNumLabels(teamsContainerId);
            if (selectedContainer) {
                UpdateUsedStudents();
            }
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

function UpdateTeamNumLabels(teamsContainerId) {
    let teams = document.getElementById(teamsContainerId).children;

    for (let i = 0; i < teams.length; i++) {

        teams[i].children[0].innerText = (i + 1);
    }
}

function MoveRaidTeam(element, direction) {

    if (direction == "Up") {
        element.previousElementSibling.insertAdjacentElement('beforebegin', element);
    }
    else if (direction == "Down") {
        element.nextElementSibling.insertAdjacentElement('afterend', element);
    }

    UpdateTeamNumLabels(element.parentElement.id);
}

function InsertBlankRaidTeam(sibling) {
    let raidTeamContainer = document.getElementById(sibling.parentElement.id);
    if (raidTeamContainer.children.length >= 25) {
        basicAlert(GetLanguageString("text-teamslimit"));
        return;
    }

    let raidTeam = CreateRaidTeamElement(0);
    raidTeam.appendChild(CreateRaidTeamActionbar());
    FillRaidTeamBlanks(raidTeam);

    sibling.insertAdjacentElement('afterend', raidTeam);

    UpdateTeamNumLabels(sibling.parentElement.id);
}

function SaveData() {

    let tourneyPassword = document.getElementById("tournament-password").value;

    if (!tourneyPassword) {
        basicAlert("Tournament Password is required");
        return;
    }

    if (lastSave > Date.now() - 5 * 1000) {
        basicAlert("Wait 5s before saving again");
    }
    else {
        Swal.fire({
            title: "Submit",
            text: "Submit changes to database?",
            color: alertColour,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#959aa3',
            confirmButtonText: "Submit",
            cancelButtonText: "Cancel"
        }).then((result) => {
            if (result.isConfirmed) {
                lastSave = Date.now();
                basicAlert("Saving");
                PrepareData();
            }
        })
    }
}

function PrepareData() {
    let tourneyPassword = document.getElementById("tournament-password").value;

    if (!tourneyPassword) {
        basicAlert("Tournament Password is required");
        return;
    }

    let tID = document.getElementById("tournaments").value;
    let tStage = document.getElementById("stage").value;
    let tGame = document.getElementById("game").value;
    let tPlayer1 = document.getElementById("player1").value;
    let tPlayer2 = document.getElementById("player2").value;
    let tArmour = document.getElementById("armour").value;
    let forcePick = document.getElementById("student-force-pick").getAttribute("character-id");
    let tPlayer1Bans = [];
    for (let i = 1; i <= 5; i++) {
        let charId = document.getElementById("student-ban-1-slot-" + i).getAttribute("character-id");
        if (charId) {
            tPlayer1Bans.push(charId);
        }
    }
    let tPlayer2Bans = [];
    for (let i = 1; i <= 5; i++) {
        let charId = document.getElementById("student-ban-2-slot-" + i).getAttribute("character-id");
        if (charId) {
            tPlayer2Bans.push(charId);
        }
    }
    let tPlayer1Teams = GetSubmissionTeams("player-1-teams")[0];
    let tPlayer2Teams = GetSubmissionTeams("player-2-teams")[0];
    let tPlayer1Score = document.getElementById("player-1-score").value;
    let tPlayer2Score = document.getElementById("player-2-score").value;

    if (tPlayer1 == "n/a") {
        basicAlert("Player 1 can't be empty");
        return;
    }

    if (tPlayer1 == tPlayer2) {
        basicAlert("Both players can't be the same");
        return;
    }

    if (forcePick == null) {
        basicAlert("Force pick needs to be set");
        return;
    }

    let submissionData = {
        "Tournament": tID,
        "Stage": tStage,
        "Game": tGame,
        "Player1": tPlayer1,
        "Player2": tPlayer2,
        "Armour": tArmour,
        "ForcePick": forcePick,
        "Player1Bans": tPlayer1Bans,
        "Player2Bans": tPlayer2Bans,
        "Player1Teams": tPlayer1Teams,
        "Player2Teams": tPlayer2Teams,
        "Player1Score": tPlayer1Score,
        "Player2Score": tPlayer2Score
    }

    UpdateTournamentRecord(submissionData, tourneyPassword);
}

function GetData() {

    if (lastLoad > Date.now() - 5 * 1000) {
        basicAlert("Wait 5s before saving again");
    }
    else {
        LoadTournamentData(true);
    }
}

function LoadTournamentData(notify) {

    let tourneyPassword = document.getElementById("tournament-password").value;

    if (!tourneyPassword) {
        basicAlert("Tournament Password is required");
        return;
    }

    GetTournamentData(tourneyPassword, notify);
}

function ProcessLoadedData(records) {

    localData = JSON.parse(records.Data);
    for (let i = 0; i < localData.length; i++) {
        localData[i] = JSON.parse(localData[i]);
    }

    FindExistingData();
}

function SetPassword() {

    let tourneyPassword = document.getElementById("tournament-password").value;

    localStorage.setItem("TournamentPassword", tourneyPassword);
}

function InputUpdated(inputId) {

    if (["tournaments", "stage", "game", "player1", "player2", "armour"].includes(inputId)) {
        FindExistingData();
    }
}

function FindExistingData() {

    let tID = document.getElementById("tournaments").value;
    let tStage = document.getElementById("stage").value;
    let tGame = document.getElementById("game").value;
    let tPlayer1 = document.getElementById("player1").value;
    let tPlayer2 = document.getElementById("player2").value;
    let tArmour = document.getElementById("armour").value;

    let anyFound = false;

    for (let i = 0; i < localData.length; i++) {
        if (localData[i].Tournament == tID && localData[i].Stage == tStage && localData[i].Game == tGame && localData[i].Armour == tArmour) {

            if (localData[i].Player1 == tPlayer1 && localData[i].Player2 == tPlayer2) {
                FillData(localData[i]);
                anyFound = true;
                break;
            }
            else if (localData[i].Player1 == tPlayer2 && localData[i].Player2 == tPlayer1) {
                FillData(localData[i]);
                anyFound = true;
                break;
            }
        }
    }

    if (!anyFound) {
        ClearFields();
    }
}

function FillData(gameData) {

    document.getElementById("player1").value = gameData.Player1;
    document.getElementById("player2").value = gameData.Player2;
    document.getElementById("player-1-score").value = gameData.Player1Score;
    document.getElementById("player-2-score").value = gameData.Player2Score;

    let playerTeamContainers = ["player-1-teams", "player-2-teams"];
    let playerTeams = [gameData.Player1Teams, gameData.Player2Teams];

    for (let p = 0; p <= 1; p++) {

        let raidTeamsContainer = document.getElementById(playerTeamContainers[p]);
        let teams = playerTeams[p];

        while (raidTeamsContainer.children.length > 0) {
            raidTeamsContainer.children[0].remove();
        }

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

            raidTeamsContainer.appendChild(raidTeam);
        }

        if (raidTeamsContainer.children.length == 0) {
            let raidTeam = CreateRaidTeamElement(1);
            FillRaidTeamBlanks(raidTeam);
            raidTeam.appendChild(CreateRaidTeamActionbar());

            raidTeamsContainer.appendChild(raidTeam);
        }
    }

    if (gameData.ForcePick) {
        UpdateSlot(gameData.ForcePick, "student-force-pick");
    }

    for (let i = 0; i < Math.min(gameData.Player1Bans.length, maxBans); i++) {
        UpdateSlot(gameData.Player1Bans[i], "student-ban-1-slot-" + (i + 1));
    }

    for (let i = 0; i < Math.min(gameData.Player2Bans.length, maxBans); i++) {
        UpdateSlot(gameData.Player2Bans[i], "student-ban-2-slot-" + (i + 1));
    }
}

function ClearFields() {

    document.getElementById("player-1-score").value = "";
    document.getElementById("player-2-score").value = "";

    ClearFilterSlots();

    let playerTeamContainers = ["player-1-teams", "player-2-teams"];

    for (let p = 0; p <= 1; p++) {

        let raidTeamsContainer = document.getElementById(playerTeamContainers[p]);

        while (raidTeamsContainer.children.length > 0) {
            raidTeamsContainer.children[0].remove();
        }

        let raidTeam = CreateRaidTeamElement(1);
        FillRaidTeamBlanks(raidTeam);
        raidTeam.appendChild(CreateRaidTeamActionbar());

        raidTeamsContainer.appendChild(raidTeam);
    }
}

function ClearFilterSlots() {

    let filterSlots = document.getElementsByClassName("student-slot");

    for (let i = 0; i < filterSlots.length; i++) {

        ClearFilterSlot(filterSlots[i]);
    }
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

function DownloadExport() {

    let exportable = "Tournament,Stage,Player1,Player2,Game,Armour,ForcePick,Player1Bans,Player2Bans,Player1Teams,Player2Teams,Player1Score,Player2Score\r\n";

    for (let i = 0; i < localData.length; i++) {
        let csvRow = "";
        csvRow += dTournaments[localData[i].Tournament] + ",";
        csvRow += dStages[localData[i].Stage] + ",";
        csvRow += localData[i].Player1 + ",";
        if (localData[i].Player2 == "n/a") {
            csvRow += ",";
        }
        else {
            csvRow += localData[i].Player2 + ",";
        }
        csvRow += dGames[localData[i].Game] + ",";
        csvRow += dArmour[localData[i].Armour] + ",";
        if (localData[i].ForcePick) {
            csvRow += student_info[localData[i].ForcePick].EN[0] + ",";
        }
        else {
            csvRow += ",";
        }
        let bans1 = GetNamedBans(localData[i].Player1Bans);
        if (bans1) {
            csvRow += "\"" + JSON.stringify(bans1).replaceAll("\"", "") + "\",";
        }
        else {
            csvRow += ",";
        }
        let bans2 = GetNamedBans(localData[i].Player2Bans);
        if (bans2) {
            csvRow += "\"" + JSON.stringify(bans2).replaceAll("\"", "") + "\",";
        }
        else {
            csvRow += ",";
        }
        let teams1 = GetNamedTeams(localData[i].Player1Teams);
        if (teams1) {
            csvRow += "\"" + JSON.stringify(teams1).replaceAll("\"", "") + "\",";
        }
        else {
            csvRow += ",";
        }
        let teams2 = GetNamedTeams(localData[i].Player2Teams);
        if (teams2) {
            csvRow += "\"" + JSON.stringify(teams2).replaceAll("\"", "") + "\",";
        }
        else {
            csvRow += ",";
        }
        csvRow += localData[i].Player1Score + ",";
        csvRow += localData[i].Player2Score;

        exportable += csvRow + "\r\n";
    }

    let fileName = "export-" + Math.floor(Date.now() / 1000) + ".csv";

    let fileToSave = new Blob([exportable], {
        type: "application/csv"
    })

    saveAs(fileToSave, fileName);
}

function GetNamedBans(bans) {

    let namedBans = [];

    for (let i = 0; i < bans.length; i++) {
        namedBans.push(student_info[bans[i]].EN[0]);
    }

    if (namedBans.length == 0) {
        return false;
    }
    else {
        return namedBans;
    }
}

function GetNamedTeams(teams) {

    let namedTeams = [];

    let allNull = true;

    for (let i = 0; i < teams.length; i++) {
        let team = [];
        if (teams[i] != null) {
            for (let ii = 0; ii < teams[i].length; ii++) {
                if (teams[i][ii] != null) {
                    team.push(student_info[teams[i][ii]].EN[0]);
                    allNull = false;
                }
                else {
                    team.push(null);
                }
            }

            namedTeams.push(team);
        }
    }

    if (allNull) {
        return false;
    }
    else {
        return namedTeams;
    }

}

function LocalTourneyUpdate(submissionObject) {

    let tID = submissionObject.Tournament;
    let tStage = submissionObject.Stage;
    let tGame = submissionObject.Game;
    let tPlayer1 = submissionObject.Player1;
    let tPlayer2 = submissionObject.Player2;
    let tArmour = submissionObject.Armour;

    let anyFound = false;

    for (let i = 0; i < localData.length; i++) {
        if (localData[i].Tournament == tID && localData[i].Stage == tStage && localData[i].Game == tGame && localData[i].Armour == tArmour) {

            if (localData[i].Player1 == tPlayer1 && localData[i].Player2 == tPlayer2) {
                localData[i] = submissionObject;
                anyFound = true;
                break;
            }
            else if (localData[i].Player1 == tPlayer2 && localData[i].Player2 == tPlayer1) {
                localData[i] = submissionObject;
                anyFound = true;
                break;
            }
        }
    }

    if (!anyFound) {
        localData.push(submissionObject);
    }
}