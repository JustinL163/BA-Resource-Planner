//const html2canvas = require("../packages/html2canvas/html2canvas");

var curID = 0;
var modalCharID = 0;
var modalStars = { "star": 0, "star_target": 0, "ue": 0, "ue_target": 0 };
const ueStarCap = 3;
const globalMaxWorld = 26;
const cnMaxWorld = 17;

var requiredMatDict = {};
var neededMatDict = {};
var ownedMatDict = {};
let leftoverMatDict = {};
var charMatDicts = {};
var resourceDisplay = "Remaining";
var gearDisplay = "Remaining";
var mainDisplay = "Characters";

var charOptions = {};

let swappableStrikers, swappableSpecials;

let groupChars = [];
let groupStrikerOptions = [];
let groupSpecialOptions = [];
let groupStrikerBorrows = [];
let groupSpecialBorrows = [];
let groupEditMode = "Move";
let currentGroup = "";
let borrowed = false;

let bulkMode = false;
let bulkChars = [];

let movingControlPanel = false;

let GroupFilterMode = "OnlyGroup";

let selectingSlotId = "";
let multiCharSource = "";

let multiSelected = [];
let multiSelectVisible = false;

var sweepMax = 0;
let sweepMin = 0;

let lvlCalcsCap = 90;

var saveTime = 0;
var toastCooldownTime = 0;
var toastCooldownMsg = "";

var charMode = "Edit";

let misc_data, mLocalisations;

let charMap, charNames;

let saveCooldown = 0, loadCooldown = 0;

let focusedInput;
let navigationObjects = {};

let closableAfter = 0;

let tooltips = [];

let modalOpen = "";

let modelVariables, availableGear;
let campaignMultiplier = 1;
let OptimalStageRuns = [];

let docScrollTop = 0;

let bugsNotified = {};

let controlPanelDocked = true;

let sortingOperations = {};

let currentSort = "custom";

let cancelHidingOverlay = false;

let bodyFrozen = false;

const strNullImage = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

const platform = navigator.userAgentData?.platform || navigator.platform;
const isIOS = /iPad|iPhone|iPod/.test(platform)
    || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function loadResources() {

    $.getJSON('json/misc_data.json?20').done(function (json) {
        misc_data = json;
    });

    $.getJSON('json/manualLocalisations.json?3').done(function (json) {
        mLocalisations = json;
    });

    checkResources();
}

function checkResources() {

    if (charlist && misc_data && mLocalisations && language_strings) {

        if (!localStorage.getItem('data-backup')) {
            localStorage.setItem('data-backup', localStorage.getItem('save-data'));
        }

        charMap = new Map()
        charNames = new Map()

        for (key in charlist) {
            let locName;
            if (chartranslate) {
                locName = chartranslate[key]?.Name;
            }
            else {
                locName = charlist[key]?.Name;
            }
            charMap.set(locName, key);
            charNames.set(key, locName);
        }

        if (data != null) {

            for (var i = 0; i < data.characters.length; i++) {

                calculateCharResources(data.characters[i], false);
            }
        }

        generateTeamBorrowOptions();
        validateData();
        convertOld();

        loaded = true;

        init();
    }
    else {
        setTimeout(() => {
            checkResources();
        }, 200);
    }

}

$(document).ready(function () {

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
    }

    loadResources();

    if (/eruda=true/.test(window.location)) {
        import("https://cdn.jsdelivr.net/npm/eruda").then(() => eruda.init());
    }
})

function load() {
    //loadResources();
}

function convertOld() {

    if (data != null) {

        if (data.disabled_characters != undefined) {
            // maybe remove later, converts old disabled format to new one
            let newDisabledArray = [];

            for (let i = 0; i < data.disabled_characters.length; i++) {
                let charId = charMap.get(data.disabled_characters[i]);
                if (charlist[charId]) {
                    newDisabledArray.push(charId);
                }
            }

            if (newDisabledArray.length > 0) {
                data.disabled_characters = newDisabledArray;
            }
        }

        if (data.characters != undefined) {

            for (let i = 0; i < data.characters.length; i++) {
                data.characters[i].id = data.characters[i].id.toString();
            }

        }
    }
}

function init() {

    bugsNotified = JSON.parse(localStorage.getItem("bugs_notified")) ?? {};

    gUsername = localStorage.getItem("username");
    gAuthkey = localStorage.getItem("authkey");

    if (gUsername) {
        document.getElementById('input-transfer-username').value = gUsername;
    }
    if (gAuthkey) {
        document.getElementById('input-transfer-authkey').value = gAuthkey;
        document.getElementById('transfer-register-button').style.visibility = "hidden";
    }

    if (fastLanguage) {
        language = fastLanguage;
    }

    if (fastAprilFools) {
        aprilFools = fastAprilFools;
    }

    buildLanguages();
    document.getElementById('languages').value = language;

    if (data != null) {

        if (!data.groups) {
            data.groups = {};
        }

        // for (var i = 0; i < data.characters.length; i++) {

        //     // remove later maybe
        //     if (data.characters[i].eleph == undefined) {
        //         let eleph = data.characters[i].eleph = {};
        //         eleph.owned = 0;
        //         eleph.unlocked = true;
        //         eleph.cost = 1;
        //         eleph.purchasable = 20;
        //         eleph.farm_nodes = 0;
        //         eleph.node_refresh = false;
        //         eleph.use_eligma = false;
        //         eleph.use_shop = false;
        //     }

        //     if (document.getElementById('char_' + data.characters[i].id) == undefined) {
        //         createCharBox(data.characters[i].id, charsContainer, "main");
        //     }
        // }

        if (data.owned_materials != undefined) {
            for (key in data.owned_materials) {
                ownedMatDict[key] = data.owned_materials[key];
            }
        }

        if (data.page_theme != undefined) {
            setTheme(data.page_theme);
        }

        if (data.server == undefined) {
            data.server = "Global";
        }

        let serverToggleBtn = document.getElementById('hm-server-toggle');
        let serverToggleBtn2 = document.getElementById('nm-server-toggle');

        if (data.server == "Global") {
            serverToggleBtn.innerText = "Gbl";
            serverToggleBtn2.innerText = "Gbl";
        }
        else if (data.server == "JP") {
            serverToggleBtn.innerText = "JP";
            serverToggleBtn2.innerText = "JP";
        }
        else if (data.server == "CN") {
            serverToggleBtn.innerText = "CN";
            serverToggleBtn2.innerText = "CN";
        }

        if (!data.language) {
            data.language = "EN";
        }

        // if (!data.level_cap) {
        //     data.level_cap = 90;
        // }

        // lvlCalcsCap = data.level_cap;
    }

    document.getElementById('set-level-cap').innerText = GetLanguageString("button-levelcapprefix") + lvlCalcsCap;

    // remove later
    for (key in data.groups) {

        if (!data.groups[key]) {
            continue;
        }

        for (let i = 0; i < data.groups[key].length; i++) {

            for (let ii = 0; ii < 6; ii++) {
                if (data.groups[key][i][ii] && typeof (data.groups[key][i][ii]) != "object" && data.groups[key][i][ii].includes('borrow')) {
                    data.groups[key][i][ii] = null;
                    saveToLocalStorage(false);
                }
            }

        }

    }

    // add add button
    var container = document.getElementById("charsContainer");
    const newDiv = document.createElement("div");
    newDiv.className = "charBox";
    newDiv.id = "addCharButton";
    // newDiv.onclick = newCharClicked;
    newDiv.addEventListener('click', (event) => {
        showMultiSelect('AddNewChars');
    });
    // newDiv.onclick = showMultiSelect;
    const newContent = document.createElement("div");
    newContent.className = "charBoxwrap";
    const newImg = document.createElement("img");
    newImg.src = "icons/UI/addIcon.png";
    newImg.draggable = false;
    newDiv.appendChild(newContent).appendChild(newImg);

    container.appendChild(newDiv);


    //if (window.matchMedia("(pointer: coarse)").matches) {
    // touchscreen
    let modeDiv = document.createElement("div");
    modeDiv.className = "charBox";
    modeDiv.id = "modeButton";

    let modeP = document.createElement("p");
    modeP.innerText = GetLanguageString("label-editmode");
    modeDiv.onclick = modeChange;

    modeDiv.appendChild(modeP);

    container.appendChild(modeDiv);
    //}

    const sortable = new Draggable.Sortable(document.getElementById('charsContainer'), {
        draggable: 'div.main-display-char',
        delay: {
            mouse: 0,
            drag: 0,
            touch: 100
        }
    })

    sortable.on("sortable:start", (e) => {
        if (charMode != "Move" && keyPressed.Shift != true) {
            e.cancel();
        }
        else if (currentSort != "custom") {
            e.cancel();
            basicAlert("Can only move students when using custom sort") //TRANSLATE
        }
    })

    sortable.on("sortable:stop", (e) => {
        keyPressed.Shift = false;

        setTimeout(() => {
            if (currentSort == "custom") {
                data.character_order = getOrder();
            }
        }, 100);

        saveTime = Date.now() + 5 * 1000;
    })

    let tableNavigation = [];

    // generate resource modal tables
    createTable("school-mat-table", ["BD_4", "BD_3", "BD_2", "BD_1", "TN_4", "TN_3", "TN_2", "TN_1"], 0,
        ["Hyakkiyako", "Red Winter", "Trinity", "Gehenna", "Abydos", "Millennium", "Arius", "Shanhaijing", "Valkyrie"], 0,
        tableNavigation, document.getElementById("table-parent-1"), false, "resource", "icons/SchoolMat/", [], "school-");
    createTable("artifact-table-1", ["4", "3", "2", "1"], 0,
        ["Nebra", "Phaistos", "Wolfsegg", "Nimrud", "Mandragora", "Rohonc", "Aether", "Antikythera", "Voynich", "Haniwa"], 9,
        tableNavigation, document.getElementById("table-parent-2"), true, "resource", "icons/Artifact/", [], "artifact-");
    createTable("artifact-table-2", ["4", "3", "2", "1"], 4,
        ["Totem", "Baghdad", "Colgante", "Mystery", "Okiku", "Atlantis", "RomanDice", "Fleece", "Rocket", "Quimbaya"], 9,
        tableNavigation, document.getElementById("table-parent-3"), true, "resource", "icons/Artifact/", [], "artifact-");

    let gearNavigation = [];
    createTable("gear-table", ["T9", "T8", "T7", "T6", "T5", "T4", "T3", "T2"], 0, ["Hat", "Gloves", "Shoes", "Bag", "Badge", "Hairpin", "Charm", "Watch", "Necklace"],
        0, gearNavigation, document.getElementById('table-parent-4'), false, "gear", "icons/Gear/", [], "gear-");

    let navObj = {};
    for (let x in tableNavigation) {
        for (let y in tableNavigation[x]) {
            navObj[x + "|" + y] = tableNavigation[x][y];
        }
    }

    navigationObjects["resourceTable"] = { "type": "table", "object": new TwoWayMap(navObj) };

    let navGearObj = {};
    for (let x in gearNavigation) {
        for (let y in gearNavigation[x]) {
            navGearObj[x + "|" + y] = gearNavigation[x][y];
        }
    }

    navigationObjects["gearTable"] = { "type": "table", "object": new TwoWayMap(navGearObj) };

    // colour the table rows
    colourTableRows("school-mat-table");
    colourTableRows("artifact-table-1");
    colourTableRows("artifact-table-2");

    colourTableRows("gear-table");

    if ("1.4.12".localeCompare(data.site_version ?? "0.0.0", undefined, { numeric: true, sensitivity: 'base' }) == 1) {
        Swal.fire({
            title: GetLanguageString("text-updatedversionprefix") + "1.4.12",
            color: alertColour,
            html: GetLanguageString("text-updatemessage")
        })

        data.site_version = "1.4.12";
        // saveToLocalStorage(false);
    }

    document.body.addEventListener('click', (event) => {
        if (closableAfter != 0 && Date.now() > closableAfter) {
            HidePopup();
            HideStagesPopup();
        }
    });

    // set input validation

    InitInputValidation();

    var sectionNames = document.getElementsByClassName('section-name');

    for (i = 0; i < sectionNames.length; i++) {

        sectionNames[i].addEventListener('click', (event) => {
            sectionQuickSet(event.target.innerText);
        })
    }


    var xpInputs = document.getElementsByClassName("xp-input");

    for (i = 0; i < xpInputs.length; i++) {
        xpInputs[i].onchange = updatedResource;
        xpInputs[i].addEventListener('focusin', (event) => {
            event.target.className = "resource-input focused";
            event.target.parentElement.classList.add("focused");
        })
        xpInputs[i].addEventListener('focusout', (event) => {
            event.target.className = "resource-input";
            event.target.parentElement.classList.remove("focused");
        })
    }

    var inputs = document.getElementsByClassName("input-wrapper");

    for (i = 0; i < inputs.length; i++) {
        var input = inputs[i].children[0];
        input.onchange = updatedResource;
        input.addEventListener('focusin', (event) => {
            event.target.classList.add("focused");
            event.target.parentElement.classList.add("focused");
            event.target.parentElement.parentElement.classList.add("focused");
        })
        input.addEventListener('focusout', (event) => {
            event.target.classList.remove("focused");
            event.target.parentElement.classList.remove("focused");
            event.target.parentElement.parentElement.classList.remove("focused");
        })
    }

    var ueInputs = document.getElementsByClassName("ue-input");

    for (i = 0; i < ueInputs.length; i++) {
        ueInputs[i].onchange = updatedResource;
        ueInputs[i].addEventListener('focusin', (event) => {
            event.target.classList.add("focused");
            event.target.parentElement.classList.add("focused");
        })
        ueInputs[i].addEventListener('focusout', (event) => {
            event.target.classList.remove("focused");
            event.target.parentElement.classList.remove("focused");
        })
    }

    let starButtons = document.getElementsByClassName("star-icon");

    for (i = 0; i < starButtons.length; i++) {
        var starButton = starButtons[i];
        starButton.addEventListener('click', (event) => {

            var id = event.target.id;
            var type = id.substring(0, id.indexOf('-'));
            var mode = id.substring(id.indexOf('-') + 1, id.lastIndexOf('-'));
            var pos = id.substring(id.lastIndexOf('-') + 1);

            starClicked(type, mode, pos);
        })
    }

    starButtons = document.getElementsByClassName("bulk-star-icon");

    for (i = 0; i < starButtons.length; i++) {
        var starButton = starButtons[i];
        starButton.addEventListener('click', (event) => {

            var id = event.target.id.substring(5);
            var type = id.substring(0, id.indexOf('-'));
            var mode = id.substring(id.indexOf('-') + 1, id.lastIndexOf('-'));
            var pos = id.substring(id.lastIndexOf('-') + 1);

            bulkStarClicked(type, mode, pos);
        })
    }

    document.getElementById('current-resource-display').innerText = GetLanguageString('label-remainingneeded');
    document.getElementById('current-gear-display').innerText = GetLanguageString('label-remainingneeded');

    groupEditorMode("Move");

    rebuildGroups();

    rebuildFilters();
    document.getElementById('filter-groups').value = "All";

    tooltips[0] = tippy('#ex-img', {
        content: "",
        allowHTML: true,
        theme: 'light',
    })[0];

    tooltips[1] = tippy('#basic-img', {
        content: "",
        allowHTML: true,
        theme: 'light',
    })[0];

    tooltips[2] = tippy('#enhanced-img', {
        content: "",
        allowHTML: true,
        theme: 'light',
    })[0];

    tooltips[3] = tippy('#sub-img', {
        content: "",
        allowHTML: true,
        theme: 'light',
    })[0];

    tippy('#total-needed-needle', {
        content: GetLanguageString("tooltip-totalneededneedle"),
        theme: 'light'
    });

    tippy('#owned-all', {
        content: GetLanguageString("tooltip-ownedall"),
        theme: 'light'
    })

    tippy('#spring-all', {
        content: GetLanguageString("tooltip-springall"),
        theme: 'light'
    })

    tippy('#hammer-all', {
        content: GetLanguageString("tooltip-hammerall"),
        theme: 'light'
    })

    tippy('#barrel-all', {
        content: GetLanguageString("tooltip-barrelall"),
        theme: 'light'
    })

    tippy('#label-char-unlocked', {
        content: GetLanguageString("tooltip-charunlocked"),
        theme: 'light'
    })

    tippy('#label-eleph-cost', {
        content: GetLanguageString("tooltip-elephcost"),
        theme: 'light'
    })

    tippy('#label-eleph-purchasable', {
        content: GetLanguageString("tooltip-elephpurchasable"),
        theme: 'light'
    })

    tippy('#label-node-refresh', {
        content: GetLanguageString("tooltip-noderefresh"),
        theme: 'light'
    })

    tippy('#hm-server-toggle', {
        content: GetLanguageString("tooltip-hmservertoggle"),
        theme: 'light'
    })

    tippy('#nm-server-toggle', {
        content: GetLanguageString("tooltip-nmservertoggle"),
        theme: 'light'
    })

    tippy('#char-delete', {
        content: GetLanguageString("tooltip-chardelete"),
        theme: 'light'
    })

    tippy('#char-max', {
        content: GetLanguageString("tooltip-charmax"),
        theme: 'light'
    })

    tippy('#char-max-goal', {
        content: GetLanguageString("tooltip-charmaxtarget"),
        theme: 'light'
    })

    tippy('#btn-group-filter-mode', {
        content: GetLanguageString("tooltip-groupfiltermode"),
        allowHTML: true,
        theme: 'light'
    })

    setInterval(() => {
        if (saveTime != 0) {
            if (Date.now() > saveTime) {
                saveTime = 0
                data.owned_materials = ownedMatDict;
                saveToLocalStorage(true);
            }
        }
    }, 300);

    InitKeyTracking();
    TouchDraggableControlPanel();

    let controlPanel = document.getElementById("control-panel");
    setInterval(() => {
        if (!movingControlPanel) {
            let rect = controlPanel.getBoundingClientRect();

            if (rect.right < rect.width) {
                controlPanel.style.left = "10px";
            }
            else if (rect.left > (innerWidth - rect.width)) {
                controlPanel.style.left = (innerWidth - rect.width - 30) + "px";
            }

            if (rect.bottom < rect.height) {
                controlPanel.style.top = "100px";
            }
            else if (rect.top > (innerHeight - rect.height)) {
                controlPanel.style.top = (innerHeight - rect.height - 30) + "px";
            }
        }
    }, 500);

    let controlPanelSize = localStorage.getItem("control-panel-size");
    if (controlPanelSize) {
        controlPanel.style.fontSize = controlPanelSize;
    }

    //InitAprilFools();

    InitSortingOrder();
}

function validateData() {

    // for (key in charlist) {

    //     if (!misc_data.gun_ue_category[charlist[key].WeaponType]) {
    //         console.log("misc_data.json missing gun_ue_category value for " + charlist[key].WeaponType);
    //     }

    // }

}

function handleKeydown(e, keyPressed) {

    let keycount = Object.keys(keyPressed).length;

    if (focusedInput) {
        if (keyPressed.Tab == true) {
            e.preventDefault()
        }
        else if (keyPressed.Enter == true) {
            e.preventDefault()
        }
        else if (keyPressed.ArrowDown == true && keyPressed.Control == true) {
            e.preventDefault()
        }
        else if (keyPressed.ArrowUp == true && keyPressed.Control == true) {
            e.preventDefault()
        }
        else if (keyPressed.ArrowLeft == true && keyPressed.Control == true) {
            e.preventDefault()
        }
        else if (keyPressed.ArrowRight == true && keyPressed.Control == true) {
            e.preventDefault()
        }
    }
    else {
        if (keycount == 1 && modalOpen == "characterModal") {
            if (keyPressed.ArrowLeft) {
                SwitchCharacter("left");
            }
            else if (keyPressed.ArrowRight) {
                SwitchCharacter("right");
            }
        }
    }

    if (keycount == 2 && ((keyPressed.Control == true && keyPressed.ArrowLeft == true) || (keyPressed.Shift == true && keyPressed.Tab == true))) {
        inputNavigate('Left')
        keyPressed = {};
    }
    else if ((keycount == 2 && keyPressed.Control == true && keyPressed.ArrowRight == true) || (keycount == 1 && keyPressed.Tab == true)) {
        inputNavigate('Right')
        keyPressed = {};
    }
    else if (keycount == 2 && ((keyPressed.Control == true && keyPressed.ArrowUp == true) || (keyPressed.Shift == true && keyPressed.Enter == true))) {
        inputNavigate('Up')
        keyPressed = {};
    }
    else if ((keycount == 2 && keyPressed.Control == true && keyPressed.ArrowDown == true) || (keycount == 1 && keyPressed.Enter == true)) {
        inputNavigate('Down')
        keyPressed = {};
    }

    if (keycount == 1 && keyPressed.Escape == true) {
        if (modalOpen == "characterModal") {
            closeModal(true);
        }
        else if (modalOpen == "resourceModal") {
            closeResourceModal();
        }
        else if (modalOpen == "gearModal") {
            closeGearModal();
        }
        else if (modalOpen == "transferModal") {
            closeTransferModal();
        }
        else if (modalOpen == "bulkEditModal") {
            CloseBulkModal();
        }
    }

    if (keycount == 2 && keyPressed.Control == true) {
        if (keyPressed.Enter == true && modalOpen == "characterModal") {
            SwitchCharacter("right");
        }
        else if (keyPressed.Backspace == true && modalOpen == "characterModal") {
            SwitchCharacter("left");
        }
    }

    if (keycount == 3 && keyPressed.Control == true && keyPressed.Shift == true && keyPressed.S == true) {
        saveTime = Date.now() + 300;
        keyPressed = {};
    }

    if (multiSelectVisible) {
        let searchElement = document.getElementById("multiCharSearch");
        if (document.activeElement != searchElement) {
            searchElement.focus();
        }
    }

    if (keycount == 2 && keyPressed.Shift == true) {
        if (e.code == "Digit1") {
            ControlPanelClicked('Edit');
        }
        else if (e.code == "Digit2") {
            ControlPanelClicked('Move');
        }
        else if (e.code == "Digit3") {
            ControlPanelClicked('Disable');
        }
        else if (e.code == "Digit4") {
            ControlPanelClicked('AddStudent');
        }
        else if (e.code == "Digit5") {
            ControlPanelClicked('Filter');
        }
        else if (e.code == "Digit6") {
            ControlPanelClicked('Bulk');
        }
        else if (e.code == "Digit7") {
            ControlPanelClicked('Sort');
        }
    }
}

// async function sectionQuickSet(section) {

//     optionData = {
//         "Gear": {
//             " 777": {
//                 "7 7 7 7 7 7": "Both",
//                 "- 7 - 7 - 7": "Target"
//             },
//             " 666": {
//                 "6 6 6 6 6 6": "Both",
//                 "- 6 - 6 - 6": "Target"
//             },
//             " 555": {
//                 "5 5 5 5 5 5": "Both",
//                 "- 5 - 5 - 5": "Target"
//             },
//             " 444": {
//                 "4 4 4 4 4 4": "Both",
//                 "- 4 - 4 - 4": "Target"
//             },
//             " 333": {
//                 "3 3 3 3 3 3": "Both",
//                 "- 3 - 3 - 3": "Target"
//             },
//             " 222": {
//                 "2 2 2 2 2 2": "Both",
//                 "- 2 - 2 - 2": "Target"
//             },
//             " 111": {
//                 "1 1 1 1 1 1": "Both",
//                 "- 1 - 1 - 1": "Target"
//             }
//         },
//         "Skills": {
//             " MMMM": {
//                 "5 5 10 10 10 10 10 10": "Both",
//                 "- 5 - 10 - 10 - 10": "Target"
//             },
//             " M777": {
//                 "5 5 7 7 7 7 7 7": "Both",
//                 "- 5 - 7 - 7 - 7": "Target"
//             },
//             " M444": {
//                 "5 5 4 4 4 4 4 4": "Both",
//                 "- 5 - 4 - 4 - 4": "Target"
//             },
//             " 3777": {
//                 "3 3 7 7 7 7 7 7": "Both",
//                 "- 3 - 7 - 7 - 7": "Target"
//             },
//             " 3444": {
//                 "3 3 4 4 4 4 4 4": "Both",
//                 "- 3 - 4 - 4 - 4": "Target",
//             },
//             " 1444": {
//                 "1 1 4 4 4 4 4 4": "Both",
//                 "- 1 - 4 - 4 - 4": "Target",
//             },
//             " 1111": {
//                 "1 1 1 1 1 1 1 1": "Both",
//                 "- 1 - 1 - 1 - 1": "Target"
//             }
//         },
//         "Level": {
//             " 85": {
//                 "85 85": "Both",
//                 "- 85": "Target"
//             },
//             " 83": {
//                 "83 83": "Both",
//                 "- 83": "Target"
//             },
//             " 80": {
//                 "80 80": "Both",
//                 "- 80": "Target"
//             },
//             " 78": {
//                 "78 78": "Both",
//                 "- 78": "Target"
//             },
//             " 75": {
//                 "75 75": "Both",
//                 "- 75": "Target"
//             },
//             " 73": {
//                 "73 73": "Both",
//                 "- 73": "Target"
//             },
//             " 70": {
//                 "70 70": "Both",
//                 "- 70": "Target"
//             },
//             " 35": {
//                 "35 35": "Both",
//                 "- 35": "Target"
//             }
//         }
//     }

//     inputIds = {
//         "Gear": [
//             "input_gear1_current",
//             "input_gear1_target",
//             "input_gear2_current",
//             "input_gear2_target",
//             "input_gear3_current",
//             "input_gear3_target"
//         ],
//         "Skills": [
//             "input_ex_current",
//             "input_ex_target",
//             "input_basic_current",
//             "input_basic_target",
//             "input_enhanced_current",
//             "input_enhanced_target",
//             "input_sub_current",
//             "input_sub_target"
//         ],
//         "Level": [
//             "input_level_current",
//             "input_level_target"
//         ]
//     }

//     if (optionData[section] != undefined) {

//         const { value: newData } = await Swal.fire({
//             title: 'Quick data select',
//             input: 'select',
//             inputOptions: optionData[section],
//             inputPlaceholder: 'Select an option',
//             showCancelButton: true
//         })

//         if (newData) {
//             let inputs = inputIds[section];

//             let values = newData.split(' ');

//             for (let i = 0; i < inputs.length; i++) {
//                 let input = document.getElementById(inputs[i]);

//                 if (input && values[i] != "-") {
//                     input.value = values[i];
//                 }
//             }

//             for (let i = 0; i < inputs.length; i++) {
//                 let property = inputs[i].replace("input_", '').replace("_current", '');

//                 validateInput(property, false, true);
//             }
//         }
//     }

// }

function findPosString(string, direction, tableName) {

    let positions = string.split('|');
    let targetPos;

    if (direction == "Up") {
        positions[0] = parseInt(positions[0]) - 1;
    }
    else if (direction == "Down") {
        positions[0] = parseInt(positions[0]) + 1;
    }
    else if (direction == "Left") {
        let keys = navigationObjects[tableName].object.keys;
        let index = keys.indexOf(string) - 1;
        if (index >= 0) {
            targetPos = keys[index];
        }
        else {
            targetPos = "none";
        }
    }
    else if (direction == "Right") {
        let keys = navigationObjects[tableName].object.keys;
        let index = keys.indexOf(string) + 1;
        if (index < keys.length + 1) {
            targetPos = keys[index];
        }
        else {
            targetPos = "none";
        }
    }

    if (!targetPos) {
        targetPos = positions.join('|');
    }

    return targetPos;
}

function modeChange() {

    let modeButton = document.getElementById('modeButton');

    if (charMode == "Edit") {
        charMode = "Disable"
        modeButton.classList.add('mode-disable');
    }
    else if (charMode == "Disable") {
        charMode = "Move"
        modeButton.classList.remove('mode-disable')
        modeButton.classList.add('mode-move')
    }
    else if (charMode == "Move") {
        charMode = "Edit"
        modeButton.classList.remove('mode-move')
    }

    modeButton.children[0].innerText = GetLanguageString("label-" + charMode.toLowerCase() + "mode");

}

// async function newCharClicked() {


//     const { value: charId } = await Swal.fire({
//         title: 'Add new character',
//         input: 'select',
//         inputOptions: charOptions,
//         inputPlaceholder: 'Select a character',
//         showCancelButton: true
//     })

//     if (charId) {

//         if (data.characters.find(obj => { return obj.id == charId }) != undefined) {
//             return;
//         }

//         let charInfoObj = charlist[charId];
//         charInfoObj.Id = charInfoObj.Id.toString();

//         let newCharObj = new Student(charInfoObj);


//         data.characters.push(newCharObj);

//         let charsContainer = document.getElementById("charsContainer");

//         createCharBox(charId, charsContainer, "main");

//         saveToLocalStorage(true);

//         generateCharOptions();
//     }
// }

// function generateCharOptions() {

//     charOptions = {}

//     let existing = getExistingCharacters();

//     for (key in charlist) {

//         let charName, school;

//         let locName = localisations[language]?.Characters[key]?.Name;
//         if (locName) {
//             charName = locName;
//         }
//         else {
//             charName = charlist[key].Name;
//         }

//         school = mLocalisations[language].Data[charlist[key].School];

//         if (!existing.includes(key)) {

//             if (school) {

//                 if (!charOptions[school]) {
//                     charOptions[school] = {};
//                 }

//                 charOptions[school][key] = charName;
//             }
//             else {

//                 if (!charOptions["Unassigned"]) {
//                     charOptions["Unassigned"] = {};
//                 }

//                 charOptions["Unassigned"][key] = charName;
//             }
//         }
//     }

//     charOptions = sortObject(charOptions);

//     for (key in charOptions) {
//         charOptions[key] = sortObject(charOptions[key]);
//     }

// }

function sortObject(obj) {
    return Object.keys(obj).sort().reduce(function (result, key) {
        result[key] = obj[key];
        return result;
    }, {});
}

function getExistingCharacters() {

    var existChars = [];

    for (i = 0; i < data?.characters.length; i++) {
        existChars.push(data.characters[i].id);
    }

    return existChars;

}

function CharInputsMax() {

    Swal.fire({
        title: GetLanguageString("text-setinputsmax"),
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: GetLanguageString("button-globalmax"),
        denyButtonText: GetLanguageString("button-jpmax"),
        denyButtonColor: '#dc9641',
        cancelButtonText: GetLanguageString("label-cancel")
    }).then((result) => {
        if (result.isConfirmed) {
            let values = [90, 90, 5, 5, 10, 10, 10, 10, 10, 10, 9, 9, 9, 9, 8, 8];
            SetCharInputValues(values);
        }
        else if (result.isDenied) {
            let values = [90, 90, 5, 5, 10, 10, 10, 10, 10, 10, 9, 9, 9, 9, 9, 9];
            SetCharInputValues(values);
        }
    })


}

function CharInputsGoalMax() {

    Swal.fire({
        title: GetLanguageString("text-settargetinputsmax"),
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: GetLanguageString("button-globalmax"),
        denyButtonText: GetLanguageString("button-jpmax"),
        denyButtonColor: '#dc9641',
        cancelButtonText: GetLanguageString("label-cancel")
    }).then((result) => {
        if (result.isConfirmed) {
            let values = [90, 5, 10, 10, 10, 9, 9, 8];
            SetCharInputGoalValues(values);
        }
        else if (result.isDenied) {
            let values = [90, 5, 10, 10, 10, 9, 9, 9];
            SetCharInputGoalValues(values);
        }
    })


}

function SetCharInputGoalValues(values) {

    document.getElementById("input_level_target").value = values[0];

    document.getElementById("input_ex_target").value = values[1];
    document.getElementById("input_basic_target").value = values[2];
    document.getElementById("input_enhanced_target").value = values[3];
    document.getElementById("input_sub_target").value = values[4];

    document.getElementById("input_gear1_target").value = values[5];
    document.getElementById("input_gear2_target").value = values[6];
    document.getElementById("input_gear3_target").value = values[7];
}

function SetCharInputValues(values) {

    document.getElementById("input_level_current").value = values[0];
    document.getElementById("input_level_target").value = values[1];

    document.getElementById("input_ex_current").value = values[2];
    document.getElementById("input_ex_target").value = values[3];
    document.getElementById("input_basic_current").value = values[4];
    document.getElementById("input_basic_target").value = values[5];
    document.getElementById("input_enhanced_current").value = values[6];
    document.getElementById("input_enhanced_target").value = values[7];
    document.getElementById("input_sub_current").value = values[8];
    document.getElementById("input_sub_target").value = values[9];

    document.getElementById("input_gear1_current").value = values[10];
    document.getElementById("input_gear1_target").value = values[11];
    document.getElementById("input_gear2_current").value = values[12];
    document.getElementById("input_gear2_target").value = values[13];
    document.getElementById("input_gear3_current").value = values[14];
    document.getElementById("input_gear3_target").value = values[15];

    let charInfo = charlist[modalCharID];

    document.getElementById("gear1-img").src = "icons/Gear/T" + values[10] + "_" + charInfo.Equipment[0] + "_small.webp";
    document.getElementById("gear2-img").src = "icons/Gear/T" + values[12] + "_" + charInfo.Equipment[1] + "_small.webp";
    document.getElementById("gear3-img").src = "icons/Gear/T" + values[14] + "_" + charInfo.Equipment[2] + "_small.webp";
}

function deleteClicked() {
    Swal.fire({
        title: GetLanguageString("label-areyousure"),
        text: GetLanguageString("text-deletecharacterprompt"),
        color: alertColour,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: GetLanguageString("confirmdeletion"),
        cancelButtonText: GetLanguageString("label-cancel")
    }).then((result) => {
        if (result.isConfirmed) {
            deleteChar(modalCharID);
            closeModal(false, true);
        }
    })
}

function deleteChar(charId) {

    if (charId) {

        var charObject = data.characters.find(obj => { return obj.id == charId });
        let index = data.characters.indexOf(charObject);
        data.characters.splice(index, 1);

        index = data.character_order.indexOf(charId);
        data.character_order.splice(index, 1);

        delete charMatDicts[charId];

        var disableIndex = disabledChars.indexOf(charId);
        if (disableIndex != -1) {
            disabledChars.splice(disableIndex, 1);
        }

        data.disabled_characters = disabledChars;

        var charBox = document.getElementById("char_" + charId);
        if (charBox != null) {
            charBox.remove();
        }

        saveTime = Date.now() + (1000 * 5);
    }

}

function colourTableRows(tableId) {

    var table = document.getElementById(tableId);

    for (r = 0; r < table.children[0].children.length; r++) {
        var rowId = table.children[0].children[r].id.substring(4);

        if (rowColours[rowId] != undefined) {

            table.children[0].children[r].style.backgroundColor = rowColours[rowId];

        }
    }

}

function freezeBody(mode) {

    bodyFrozen = mode;

    if (mode) {
        let top = docScrollTop = window.pageYOffset;
        $("body").css('position', 'fixed').css('overflow', 'hidden').css('top', -top).css('width', '100%');
    }
    else {
        $("body").css('position', 'relative').css('overflow', 'auto').css('top', 0)
        window.scrollBy(0, docScrollTop);
        docScrollTop = 0;
    }
}

function openModal(e) {

    if (!loaded) {
        return;
    }

    cancelHidingOverlay = true;

    var fromChar = false;
    if (this.id.substring(0, 5) == "char_") {
        fromChar = true;
    }

    // APRIL FOOLS
    // if (!allCharsPulled.includes(this.id.substring(5))) {
    //     return;
    // }

    if (bulkMode) { // include alt key shortcut
        let charId = this.id.substring(5);

        if (bulkChars.includes(charId)) {
            bulkChars.splice(bulkChars.indexOf(charId), 1);
            this.classList.remove("multiSelected");
        }
        else {
            bulkChars.push(charId);
            this.classList.add("multiSelected");
        }

        return;
    }

    if (charMode == "Disable" || (e.ctrlKey && fromChar == true)) {
        let charId = this.id.substring(5);

        var charData = data.characters.find(obj => { return obj.id == charId });


        if (disabledChars.includes(charId)) {
            this.classList.remove("deselected");
            charData.enabled = true;
            var index = disabledChars.indexOf(charId);
            if (index !== -1) {
                disabledChars.splice(index, 1);
            }
        }
        else {
            this.classList.add("deselected");
            charData.enabled = false;
            disabledChars.push(charId);
        }

        data.disabled_characters = disabledChars;

        saveTime = Date.now() + (1000 * 5);

        return;
    }

    if (charMode == "Move" || keyPressed.Shift == true) {
        return;
    }

    var modal = document.getElementById("characterModal");

    if (modalCharID) {
        return;
    }

    modalCharID = this.id.substring(5);

    if (fromChar) {
        if (!bodyFrozen) {
            freezeBody(true);
        }
        modalOpen = "characterModal";
        this.style = "visibility:hidden";

        modal.style.visibility = "visible";

        document.getElementById('character-modal-wrapper').style.visibility = "hidden";

        let charId = this.id.substring(5);

        let charSelected = charNames.get(charId);

        document.getElementById('char-eleph').src = "icons/Eleph/Eleph_" + charId + ".png";
        document.getElementById('char-eleph-needed-icon').src = "icons/Eleph/Eleph_" + charId + ".png";

        let hardModes = misc_data.hard_modes[charId];
        let shopCharacter = misc_data.shop_characters[charId];
        let shopCurrency;

        let currencyDescriptorText = document.getElementById('char-currency-descriptor');
        let charShopCurrencyText = document.getElementById('char-shop-currency');
        let buyOptionTwo = document.getElementById('buy-option-two');

        populateCharModal(charId);

        populateCharResources(charId);

        let cost = document.getElementById('input_eleph_cost').value;

        if (cost == 5) {
            document.getElementById('label-eleph-purchasable').style.visibility = 'hidden';
            document.getElementById('input_eleph_purchasable').style.visibility = 'hidden';
        }
        else {
            document.getElementById('label-eleph-purchasable').style.visibility = '';
            document.getElementById('input_eleph_purchasable').style.visibility = '';
        }

        if (hardModes) {

            document.getElementById("content-13").style.display = "";
            document.getElementById("char-ShopCurrency").parentElement.style.display = "none";
            buyOptionTwo.style.display = "none";

            let hardModeNodes = 0;

            if (data.server == "Global") {

                for (let i = 0; i < hardModes.length; i++) {

                    if (parseInt(hardModes[i].substring(0, hardModes[i].indexOf('-'))) <= globalMaxWorld) {
                        hardModeNodes++;
                    }
                }
            }
            else if (data.server == "JP") {
                hardModeNodes = hardModes.length;
            }
            else if (data.server == "CN") {

                for (let i = 0; i < hardModes.length; i++) {

                    if (parseInt(hardModes[i].substring(0, hardModes[i].indexOf('-'))) <= cnMaxWorld) {
                        hardModeNodes++;
                    }
                }
            }

            sweepMax = hardModeNodes * 3; sweepMin = hardModeNodes * 3;
            if (document.getElementById('input_allow_node_refresh').checked) {
                sweepMax = hardModeNodes * 6;
            }

            document.getElementById("hard-nodes-count").innerText = "/ " + sweepMax;

            currencyDescriptorText.innerText = GetLanguageString("label-avgdays");

            document.getElementById("shop-currency-icon").src = "icons/Eleph/Eleph_" + charId + ".png";

        }
        else if (shopCharacter) {

            document.getElementById("content-13").style.display = "none";
            buyOptionTwo.style.display = "flex";

            document.getElementById("input_farm_nodes").value = 0;

            if (typeof (shopCharacter) == "object") {
                shopCurrency = shopCharacter.currency;
            }
            else {
                shopCurrency = shopCharacter;
            }

            if (shopCurrency == "RaidToken") {
                currencyDescriptorText.innerText = GetLanguageString("label-minraids");
                charShopCurrencyText.innerText = GetLanguageString("label-raidtokens");
            }
            else if (shopCurrency == "RareRaidToken") {
                currencyDescriptorText.innerText = GetLanguageString("label-minraids");
                charShopCurrencyText.innerText = GetLanguageString("label-rareraidtokens");
            }
            else if (shopCurrency == "ArenaCoin") {
                currencyDescriptorText.innerText = GetLanguageString("label-shopresets");
                charShopCurrencyText.innerText = GetLanguageString("label-arenacoins");;
            }
            else if (shopCurrency == "JECoin") {
                currencyDescriptorText.innerText = GetLanguageString("label-shopresets");
                charShopCurrencyText.innerText = GetLanguageString("label-jecoins");;
            }
            else if (shopCurrency == "MasteryCertificate") {
                currencyDescriptorText.innerText = GetLanguageString("label-shopresets");
                charShopCurrencyText.innerText = GetLanguageString("label-expertpermits");;
            }

            document.getElementById("shop-currency-icon").src = "icons/Misc/" + shopCurrency + ".png";
            document.getElementById("shop-currency-icon2").src = "icons/Misc/" + shopCurrency + ".png";
        }
        else {
            document.getElementById("content-13").style.display = "none";
            document.getElementById("input_farm_nodes").value = 0;
            buyOptionTwo.style.display = "none";
        }

        var displayImg = document.getElementById("displayImg");
        displayImg.src = "icons/Portrait/Icon_" + charId + ".webp";
        if (aprilFools) {
            displayImg.src = "icons/Portrait/April/Icon_" + charId + ".png";
        }

        var displayName = document.getElementById("displayName");
        displayName.innerText = charSelected

        var displayChar = document.getElementById("displayChar");
        displayChar.style = "display:inline-flex; visibility: visible";
        // var initLeft = this.getBoundingClientRect().left - displayChar.getBoundingClientRect().left;
        // var initTop = this.getBoundingClientRect().top - displayChar.getBoundingClientRect().top;
        // modalCharLeft = initLeft;
        // modalCharTop = initTop;
        // displayChar.style = "display:inline-flex; visibility: visible; transform: translate(" + Math.round(initLeft) + "px, " + Math.round(initTop) + "px);";

        // setTimeout(() => {
        // displayChar.style = "display:inline-flex; visibility: visible; transform: translate(0px, 0px); transition: all 0.3s;"

        // setTimeout(() => {
        modal.style.visibility = "visible";
        document.getElementById('character-modal-wrapper').style.visibility = "visible";

        var modalSections = document.getElementsByClassName("modal-content-section");

        // for (i = 0; i < modalSections.length; i++) {
        //     modalSections[i].classList.add("animate-pop");
        // }

        modal.onclick = function (event) {
            if (event.target == modal) {
                closeModal(fromChar);
            }
        };

        // }, 300);
        // }, 10);

    }
}

function closeModal(animated, forced) {

    if (!forced && isCharModalDirty()) {
        Swal.fire({
            title: GetLanguageString("text-unsavedchanges"),
            showDenyButton: true,
            confirmButtonText: GetLanguageString("button-goback"),
            denyButtonText: GetLanguageString("button-discardchanges"),
            denyButtonColor: '#d33'
        }).then((result) => {
            if (result.isConfirmed) {

            }
            else if (result.isDenied) {
                closeModal(animated, true);
            }
        })

        return;
    }

    modalOpen = "";

    var modal = document.getElementById("characterModal");
    //document.getElementById("new-char").value = ""



    if (!animated) {
        freezeBody(false);

        var displayChar = document.getElementById("displayChar");
        displayChar.style = "display:inline-flex;";

        //var modalWrapper = document.getElementsByClassName("modal-content-wrapper")[0]

        document.getElementById('character-modal-wrapper').style.visibility = "";
        modal.style.visibility = "hidden";
        modalCharID = "";
        return;
    }

    //var backgroundFill = document.getElementsByClassName("fill-layer")[0];
    //backgroundFill.className = "unfill-layer";

    var displayChar = document.getElementById("displayChar");

    var selectedChar = document.getElementById("char_" + modalCharID);
    // var charLeft = selectedChar.getBoundingClientRect().left - displayChar.getBoundingClientRect().left;
    // var charTop = selectedChar.getBoundingClientRect().top - displayChar.getBoundingClientRect().top;

    //setTimeout(() => {
    //var modalWrapper = document.getElementsByClassName("modal-content-wrapper")[0]

    document.getElementById('character-modal-wrapper').style.visibility = "hidden";

    // var modalSections = document.getElementsByClassName("modal-content-section");

    // for (i = 0; i < modalSections.length; i++) {
    //     modalSections[i].classList.remove("animate-pop");
    // }

    // displayChar.style = "display:inline-flex; visibility: visible; transform: translate(" + charLeft + "px, " + charTop + "px); transition: all 0.3s;";

    // setTimeout(() => {
    selectedChar.style.visibility = "visible";
    displayChar.style.transition = "none";
    displayChar.style.visibility = "hidden";
    cancelHidingOverlay = false;
    setTimeout(() => {
        if (!cancelHidingOverlay) {
            freezeBody(false);
            modal.style.visibility = "hidden";
        }
    }, 100);
    //backgroundFill.remove();
    //modalWrapper.style.backgroundColor = "white";
    // }, 300);

    modalCharID = "";

    modal.onclick = "";

    //}, 1000);

}

function multiCharCancel() {

    let boxesContainer = document.getElementById('boxesContainer');
    let editorContainer = document.getElementById('teamsEditorContainer');
    let multiSelectContainer = document.getElementById('characterMultiSelectContainer');
    let multiCharSearch = document.getElementById('multiCharSearch');

    multiCharSearch.value = "";

    multiCharsClear();

    if (multiCharSource == "AddNewChars") {
        document.getElementById("control-panel").style.display = "";
        multiSelected = [];

        boxesContainer.style.display = "";
        multiSelectContainer.style.display = "none";
    }
    else if (multiCharSource == "AddTeamStriker" || multiCharSource == "AddTeamSpecial" ||
        multiCharSource == "AddTeamStrikerBorrow" || multiCharSource == "AddTeamSpecialBorrow") {

        editorContainer.style.display = "";
        multiSelectContainer.style.display = "none";
    }

    multiSelectVisible = false;
}

function multiCharsClear() {

    let multiChars = document.getElementById('charsSelectContainer')?.children;

    while (multiChars?.length > 0) {
        multiChars[0].remove();
    }

}

function multiCharBorrow() {

    if (multiCharSource == "AddTeamStriker") {
        showMultiSelect("AddTeamStrikerBorrow");
    }
    else if (multiCharSource == "AddTeamSpecial") {
        showMultiSelect("AddTeamSpecialBorrow");
    }
}

function showMultiSelect(source) {

    // APRIL FOOLS
    // if (document.getElementById("button-addcharacters").classList.contains("april-fools-button")) {
    //     return;
    // }

    multiCharsClear();

    multiCharSource = source;
    multiSelectVisible = true;

    let boxesContainer = document.getElementById('boxesContainer');
    let editorContainer = document.getElementById('teamsEditorContainer');
    let multiSelectContainer = document.getElementById('characterMultiSelectContainer');
    let multiCharAdd = document.getElementById('multi-char-add');
    let multiCharCancel = document.getElementById('multi-char-cancel');
    let multiCharBorrow = document.getElementById('multi-char-borrow');

    boxesContainer.style.display = "none";
    editorContainer.style.display = "none";
    multiSelectContainer.style.display = "";
    document.getElementById("multiCharSearch").value = '';

    let visualCharOptions = [];
    let mode = "";

    if (source == "AddNewChars") {
        document.getElementById("control-panel").style.display = "none";
        let existingChars = getExistingCharacters();

        for (key in charlist) {

            if (!existingChars.includes(key)) {
                visualCharOptions.push(charNames.get(key));
            }
        }

        visualCharOptions.sort();
        mode = "Multi";
        multiCharBorrow.style.display = "none";
    }
    else if (source == "AddTeamStriker") {
        visualCharOptions = groupStrikerOptions;
        mode = "Single";
        if (!borrowed) {
            multiCharBorrow.style.display = "";
        }
    }
    else if (source == "AddTeamSpecial") {
        visualCharOptions = groupSpecialOptions;
        mode = "Single";
        if (!borrowed) {
            multiCharBorrow.style.display = "";
        }
    }
    else if (source == "AddTeamStrikerBorrow") {
        visualCharOptions = groupStrikerBorrows;
        mode = "Single";
        multiCharBorrow.style.display = "none";
    }
    else if (source == "AddTeamSpecialBorrow") {
        visualCharOptions = groupSpecialBorrows;
        mode = "Single";
        multiCharBorrow.style.display = "none";
    }

    if (mode == "Multi") {
        multiCharAdd.style.display = "";
    }
    else if (mode == "Single") {
        multiCharAdd.style.display = "none";
    }

    generateMultiSelectChars(visualCharOptions, mode);

}

function generateMultiSelectChars(newCharOptions, mode) {

    let multiCharsContainer = document.getElementById("charsSelectContainer");

    for (let i = 0; i < newCharOptions.length; i++) {
        createMultiSelectChar(charMap.get(newCharOptions[i]), multiCharsContainer, mode);
    }

}

function createMultiSelectChar(charId, container, mode) {

    let charName = charNames.get(charId.toString());

    const newCharDiv = document.createElement("div");
    newCharDiv.className = "multiSelectChar";
    newCharDiv.id = "multi_" + charId;

    const newImg = document.createElement("img");
    newImg.src = "icons/Portrait/Icon_" + charId + ".webp";
    if (aprilFools) {
        newImg.src = "icons/Portrait/April/Icon_" + charId + ".png";
    }
    newImg.draggable = false;
    newImg.className = "multi-char-img";

    const nameDiv = document.createElement("div");
    nameDiv.className = "nameBar multiCharName";

    const nameTag = document.createElement("p");
    if (charName.includes(' ')) {
        nameTag.innerText = charName.substring(0, charName.indexOf(' '));
    }
    else if (charName.includes('(')) {
        nameTag.innerText = charName.substring(0, charName.indexOf('('));
    }
    else if (charName.includes('（')) {
        nameTag.innerText = charName.substring(0, charName.indexOf('（'));
    }
    else {
        nameTag.innerText = charName;
    }
    nameDiv.appendChild(nameTag);

    newCharDiv.appendChild(newImg);
    newCharDiv.appendChild(nameDiv);

    if (mode == "Multi") {
        newCharDiv.addEventListener('click', (event) => {
            toggleMultiSelection(event.currentTarget.id);
        })
    }
    else if (mode == "Single") {
        newCharDiv.addEventListener('click', (event) => {
            singleSelect(event.currentTarget.id);
        })
    }


    container.appendChild(newCharDiv);

}

function singleSelect(boxId) {
    let charId = boxId.substring(6);

    if (multiCharSource == "AddTeamStriker" || multiCharSource == "AddTeamSpecial") {

        let slotContainer = document.getElementById(selectingSlotId);

        let slotChildren = slotContainer.children;

        for (let i = 0; i < slotChildren.length; i++) {
            slotChildren[i].remove();
        }

        createCharBox(charId, slotContainer, "teams", false);
        groupChars.push(charNames.get(charId));

        saveGroup();

        generateTeamCharOptions();

    }
    else if (multiCharSource == "AddTeamStrikerBorrow" || multiCharSource == "AddTeamSpecialBorrow") {

        let slotContainer = document.getElementById(selectingSlotId);

        let slotChildren = slotContainer.children;

        for (let i = 0; i < slotChildren.length; i++) {
            slotChildren[i].remove();
        }

        createCharBox(charId, slotContainer, "borrow", false);

        borrowed = true;
        saveGroup();
    }

    let editorContainer = document.getElementById('teamsEditorContainer');
    let multiSelectContainer = document.getElementById('characterMultiSelectContainer');

    editorContainer.style.display = "";
    multiSelectContainer.style.display = "none";
    multiSelectVisible = false;

    multiCharsClear();

}

function toggleMultiSelection(boxId) {

    let charId = boxId.substring(6);

    let element = document.getElementById(boxId);

    if (multiSelected.includes(charId)) {
        let charIndex = multiSelected.indexOf(charId);

        if (charIndex != -1) {
            multiSelected.splice(charIndex, 1);
        }

        element.classList.remove("multiSelected");
    }
    else {
        multiSelected.push(charId);

        element.classList.add("multiSelected");
    }

}

function filterMultiChars() {

    let searchInput = document.getElementById("multiCharSearch");

    let searchPhrase = searchInput.value.toLowerCase();
    let phraseLength = searchPhrase.length;

    if (!searchPhrase) {
        let multiChars = document.getElementsByClassName("multiSelectChar");

        for (let i = 0; i < multiChars.length; i++) {
            multiChars[i].style.display = "";
        }
    }
    else {
        let nameBars = document.getElementsByClassName("multiCharName");

        for (let i = 0; i < nameBars.length; i++) {
            if (nameBars[i].children[0].innerText.toLowerCase().substring(0, phraseLength) == searchPhrase) {
                nameBars[i].parentElement.style.display = "";
            }
            else {
                nameBars[i].parentElement.style.display = "none";
            }
        }
    }
}

function multiCharAdd() {

    for (let i = 0; i < multiSelected.length; i++) {

        let charInfoObj = charlist[multiSelected[i]];
        charInfoObj.Id = charInfoObj.Id.toString();

        let newCharObj = new Student(charInfoObj);

        data.characters.push(newCharObj);

    }

    saveToLocalStorage(false);

    location.reload();

}

function teamsToggle() {
    // APRIL FOOLS
    // if (document.getElementById("button-teamstoggle").classList.contains("april-fools-button")) {
    //     return;
    // }

    if (document.getElementById("characterMultiSelectContainer").style.display != "none") {
        return;
    }

    let boxesContainer = document.getElementById('boxesContainer');
    let teamsEditorContainer = document.getElementById('teamsEditorContainer');
    let buttonText = document.getElementById('teamsEditorButton');

    if (mainDisplay == "Characters") {
        document.getElementById("control-panel").style.display = "none";
        mainDisplay = "Teams";
        boxesContainer.style.display = "none";
        teamsEditorContainer.style.display = "";
        buttonText.innerText = GetLanguageString("footer-characters");
        generateTeamCharOptions();
        $("div#viewFilters")[0].style.display = 'none';
        if (currentGroup) {
            clearTeams();
            borrowed = false;
            loadGroup(currentGroup);
        }
    }
    else if (mainDisplay == "Teams") {
        document.getElementById("control-panel").style.display = "";
        mainDisplay = "Characters";
        boxesContainer.style.display = "";
        teamsEditorContainer.style.display = "none";
        buttonText.innerText = GetLanguageString("footer-teamseditor");
        rebuildFilters();
        resetFilters();
    }
}

function generateTeamBorrowOptions() {

    groupStrikerBorrows = [];
    groupSpecialBorrows = [];

    for (key in charlist) {

        let charName = charNames.get(key);

        //let school = charlist[key].School;
        let damageType = charlist[key].BulletType;
        let type = charlist[key].SquadType;

        if (type == "Main") {
            groupStrikerBorrows.push(charName);
        }
        else if (type == "Support") {
            groupSpecialBorrows.push(charName);
        }

        // if (damageType) {

        //     if (type == "Striker") {
        //         if (!groupStrikerBorrows[damageType]) {
        //             groupStrikerBorrows[damageType] = {};
        //         }

        //         groupStrikerBorrows[damageType][key] = charName;
        //     }
        //     else if (type == "Special") {
        //         if (!groupSpecialBorrows[damageType]) {
        //             groupSpecialBorrows[damageType] = {};
        //         }

        //         groupSpecialBorrows[damageType][key] = charName;
        //     }
        // }
        // else {

        //     if (type == "Striker") {
        //         if (!groupStrikerBorrows["Unassigned"]) {
        //             groupStrikerBorrows["Unassigned"] = {};
        //         }

        //         groupStrikerBorrows["Unassigned"][key] = charName;
        //     }
        //     else if (type == "Special") {
        //         if (!groupSpecialBorrows["Unassigned"]) {
        //             groupSpecialBorrows["Unassigned"] = {};
        //         }

        //         groupSpecialBorrows["Unassigned"][key] = charName;
        //     }
        // }
    }

    groupStrikerBorrows.sort();
    groupSpecialBorrows.sort();

    // groupStrikerBorrows = sortObject(groupStrikerBorrows);

    // for (key in groupStrikerBorrows) {
    //     groupStrikerBorrows[key] = sortObject(groupStrikerBorrows[key]);
    // }

    // groupSpecialBorrows = sortObject(groupSpecialBorrows);

    // for (key in groupSpecialBorrows) {
    //     groupSpecialBorrows[key] = sortObject(groupSpecialBorrows[key]);
    // }

}

function generateTeamCharOptions() {

    groupStrikerOptions = [];
    groupSpecialOptions = [];

    let existing = getExistingCharacters();

    // for (let i = 0; i < existing.length; i++) {
    for (key in charlist) {

        if (!groupChars.includes(charNames.get(key))) {

            let charName = charNames.get(key);

            //let school = charlist[charId].School;
            let damageType = charlist[key].BulletType;
            let type = charlist[key].SquadType;

            if (type == "Main") {
                groupStrikerOptions.push(charName);
            }
            else if (type == "Support") {
                groupSpecialOptions.push(charName);
            }

            // if (damageType) {

            //     if (type == "Striker") {
            //         if (!groupStrikerOptions[damageType]) {
            //             groupStrikerOptions[damageType] = {};
            //         }

            //         groupStrikerOptions[damageType][key] = charName;
            //     }
            //     else if (type == "Special") {
            //         if (!groupSpecialOptions[damageType]) {
            //             groupSpecialOptions[damageType] = {};
            //         }

            //         groupSpecialOptions[damageType][existing[i]] = charName;
            //     }
            // }
            // else {

            //     if (type == "Striker") {
            //         if (!groupStrikerOptions["Unassigned"]) {
            //             groupStrikerOptions["Unassigned"] = {};
            //         }

            //         groupStrikerOptions["Unassigned"][key] = charName;
            //     }
            //     else if (type == "Special") {
            //         if (!groupSpecialOptions["Unassigned"]) {
            //             groupSpecialOptions["Unassigned"] = {};
            //         }

            //         groupSpecialOptions["Unassigned"][key] = charName;
            //     }
            // }
        }

    }

    groupStrikerOptions.sort();
    groupSpecialOptions.sort();

    // groupStrikerOptions = sortObject(groupStrikerOptions);

    // for (key in groupStrikerOptions) {
    //     groupStrikerOptions[key] = sortObject(groupStrikerOptions[key]);
    // }

    // groupSpecialOptions = sortObject(groupSpecialOptions);

    // for (key in groupSpecialOptions) {
    //     groupSpecialOptions[key] = sortObject(groupSpecialOptions[key]);
    // }
}

function addNewTeam(team) {

    if (currentGroup == "") {
        basicAlert(GetLanguageString("text-selectgroup"));
        return;
    }

    let teamsContainer = document.getElementById('teamsContainer');

    let teamNum = (teamsContainer.childElementCount + 1);

    if (teamNum > 25) {
        Swal.fire({
            toast: true,
            position: 'top-start',
            title: GetLanguageString("text-teamslimit"),
            showConfirmButton: false,
            timer: 1500
        })
        return;
    }

    let new_teamDiv = document.createElement('div');
    let teamId = "team" + teamNum;
    new_teamDiv.id = teamId;
    new_teamDiv.className = "team-wrapper"

    let new_teamLabel = document.createElement('p');
    new_teamLabel.className = "team-label";
    new_teamLabel.innerText = GetLanguageString("label-teamnumprefix") + teamNum;
    new_teamLabel.onclick = function (event) {
        handleGroupEditorClick(event.target, "", "Team");
    };

    let new_strikerDiv = document.createElement('div');
    new_strikerDiv.className = "striker-wrapper";

    new_teamDiv.appendChild(new_teamLabel)
    new_teamDiv.appendChild(new_strikerDiv);

    teamsContainer.appendChild(new_teamDiv);

    for (let i = 0; i < 4; i++) {
        let blankSlot = newBlankSlot(teamId, i, "Striker");
        new_strikerDiv.appendChild(blankSlot);
        if (team[i] == null) {
            blankSlot.appendChild(groupEmptySlot());
        }
        else {
            if (typeof (team[i]) == "object") {
                let charName = charNames.get(team[i].id);
                if (charName) {
                    createCharBox(team[i].id, blankSlot, "borrow", false);
                    //groupChars.push(charName);
                }
            }
            else {
                let charName = charNames.get(team[i]);
                if (charName) {
                    createCharBox(team[i], blankSlot, "teams", false);
                    groupChars.push(charName);
                }
            }
        }
    }

    let new_specialDiv = document.createElement('div');
    new_specialDiv.className = "special-wrapper";

    new_teamDiv.appendChild(new_specialDiv);

    for (let i = 0; i < 2; i++) {
        let blankSlot = newBlankSlot(teamId, i + 4, "Special");
        new_specialDiv.appendChild(blankSlot);
        if (team[i + 4] == null) {
            blankSlot.appendChild(groupEmptySlot());
        }
        else {
            if (typeof (team[i + 4]) == "object") {
                let charName = charNames.get(team[i + 4].id);
                if (charName) {
                    createCharBox(team[i + 4].id, blankSlot, "borrow", false);
                    //groupChars.push(charName);
                }
            }
            else {
                let charName = charNames.get(team[i + 4]);
                if (charName) {
                    createCharBox(team[i + 4], blankSlot, "teams", false);
                    groupChars.push(charName);
                }
            }
        }
    }

}

function newBlankSlot(teamId, slotId, type) {

    let new_slotDiv = document.createElement('div');
    let slotDivId = teamId + "-slot" + (slotId + 1);
    new_slotDiv.id = slotDivId;
    new_slotDiv.className = "team-slot";
    new_slotDiv.onclick = function (event) {
        handleGroupEditorClick(slotDivId, type, "Character");
    };

    if (type == "Striker") {
        swappableStrikers.addContainer(new_slotDiv);
    }
    else if (type == "Special") {
        swappableSpecials.addContainer(new_slotDiv);
    }

    return new_slotDiv;
}

function groupEmptySlot() {
    let new_charBox = document.createElement('div');
    new_charBox.className = "charBox team-slot-add";

    let new_charBoxwrap = document.createElement('div');
    new_charBoxwrap.className = "charBoxwrap";

    let new_addIcon = document.createElement('img');
    new_addIcon.src = "icons/UI/addIcon.png";
    new_addIcon.draggable = false;

    new_charBoxwrap.appendChild(new_addIcon);
    new_charBox.appendChild(new_charBoxwrap);

    return new_charBox;
}

function handleGroupEditorClick(divId, type, target) {

    if (target == "Character" && document.getElementById(divId)?.children[0]?.id != "" && groupEditMode == "Move") {
        return;
    }

    if (target == "Team" && groupEditMode == "Remove") {
        removeTeam(divId);
    }
    else if (target == "Character" && groupEditMode == "Remove") {
        removeGroupCharacter(divId);
    }
    else if (target == "Character") {
        pickCharacter(divId, type);
    }
}

function removeTeam(teamDiv) {

    let teamNum = parseInt(teamDiv.parentElement.id.substring(4));

    let teamWrapper = document.getElementById("team" + teamNum);

    let teamChars = getCharsInTeam("team" + teamNum);

    for (let i = 0; i < teamChars.length; i++) {

        let charName;

        if (teamChars[i] == null) {
            continue;
        }
        else if (typeof (teamChars[i]) == 'object') {
            borrowed = false;
            continue;
        }
        else {
            charName = charNames.get(teamChars[i]);

            if (!charName) {
                continue;
            }
        }

        let charIndex = groupChars.indexOf(charName);

        if (charIndex != -1) {
            groupChars.splice(charIndex, 1);
        }

    }

    for (let i = 1; i <= 6; i++) {
        if (i <= 4) {
            swappableStrikers.removeContainer(document.getElementById('team' + teamNum + '-slot' + i));
        }
        else {
            swappableSpecials.removeContainer(document.getElementById('team' + teamNum + '-slot' + i));
        }
    }

    let subsequentTeam = 1;
    let nextTeam = document.getElementById("team" + (teamNum + subsequentTeam));

    while (nextTeam) {

        let n = teamNum + subsequentTeam - 1;
        nextTeam.id = "team" + (teamNum + subsequentTeam - 1);
        nextTeam.children[0].innerText = GetLanguageString("label-teamnumprefix") + (teamNum + subsequentTeam - 1);
        for (let i = 0; i < 4; i++) {

            nextTeam.children[1].children[i].id = "team" + n + "-slot" + (i + 1);
            nextTeam.children[1].children[i].onclick = function (event) {
                handleGroupEditorClick("team" + n + "-slot" + (i + 1), "Striker", "Character");
            };

            if (i < 2) {
                nextTeam.children[2].children[i].id = "team" + n + "-slot" + (i + 5);
                nextTeam.children[2].children[i].onclick = function (event) {
                    handleGroupEditorClick("team" + n + "-slot" + (i + 5), "Special", "Character");
                };
            }
        }

        subsequentTeam++;

        nextTeam = document.getElementById("team" + (teamNum + subsequentTeam));
    }

    generateTeamCharOptions();

    teamWrapper.remove();

    saveGroup();
}

async function addNewGroup() {

    const { value: groupName } = await Swal.fire({
        title: GetLanguageString("text-createnewgroup"),
        input: 'text',
        inputPlaceholder: GetLanguageString("placeholder-newgroup"),
        showCancelButton: true,
        confirmButtonText: GetLanguageString("button-ok"),
        cancelButtonText: GetLanguageString("label-cancel"),
        inputValidator: (value) => {
            if (!value) {
                return GetLanguageString("text-fieldempty");
            }

            if (value.length > 35) {
                return GetLanguageString("text-namelong");
            }

            if ($("#select-groups option[value='" + value + "']").length > 0) {
                return GetLanguageString("text-groupexists");
            }
        }
    })

    if (groupName) {
        clearTeams();
        generateTeamCharOptions();

        currentGroup = groupName;
        addNewTeam([null, null, null, null, null, null]);
        borrowed = false;

        let groupCount = 0;
        if (data.groups) {
            groupCount = Object.keys(data.groups).length;
        }

        let selectElement = document.getElementById('select-groups');
        addOption(selectElement, (groupCount + 1) + ". " + groupName, groupName);

        selectElement.value = groupName;
    }

}

function clearTeams() {

    let teams = document.getElementById("teamsContainer")?.children;

    while (teams.length > 0) {
        teams[0].remove();
    }

    groupChars = [];

    if (swappableStrikers) {
        swappableStrikers.destroy();
    }
    if (swappableSpecials) {
        swappableSpecials.destroy();
    }

    swappableStrikers = new Draggable.Swappable([], {
        draggable: '.charBox'
    })

    swappableStrikers.on("swappable:start", (e) => {
        if (e.data.dragEvent.data.originalSource.id == "") {
            e.cancel();
        }
        else if (groupEditMode == "Remove") {
            e.cancel();
        }
    })

    swappableStrikers.on("swappable:stop", (e) => {
        saveGroup();
        saveTime = Date.now() + 5 * 1000;
    })

    swappableSpecials = new Draggable.Swappable([], {
        draggable: '.charBox'
    })

    swappableSpecials.on("swappable:start", (e) => {
        if (e.data.dragEvent.data.originalSource.id == "") {
            e.cancel();
        }
        else if (groupEditMode == "Remove") {
            e.cancel();
        }
    })

    swappableSpecials.on("swappable:stop", (e) => {
        saveGroup();
        saveTime = Date.now() + 5 * 1000;
    })

    borrowed = false;
}

function removeGroupCharacter(slotDivId) {

    let slotContainer = document.getElementById(slotDivId);

    let slotChildren = slotContainer.children;

    let charName = "";

    for (let i = 0; i < slotChildren.length; i++) {
        if (slotChildren[i].id.substring(0, 11) == "char_teams_") {
            charName = charNames.get(slotChildren[i].id.substring(11));
        }
        else if (slotChildren[i].id.includes('borrow')) {
            borrowed = false;
        }
        slotChildren[i].remove();
    }

    slotContainer.appendChild(groupEmptySlot());

    if (charName) {
        groupChars.splice(groupChars.indexOf(charName), 1);
        generateTeamCharOptions();
    }

    saveGroup();
}

async function PickLevelCalcsCap() {

    await Swal.fire({
        title: GetLanguageString("text-levelcapat"),
        input: 'range',
        inputAttributes: {
            min: 78,
            max: lvlMAX,
            step: 1
        },
        inputValue: lvlCalcsCap,
        showCancelButton: true,
        confirmButtonText: GetLanguageString("button-ok"),
        cancelButtonText: GetLanguageString("label-cancel")
        // showDenyButton: !borrowed,
        // denyButtonText: 'Borrow',
        // denyButtonColor: '#dc9641'
    }).then((result) => {
        if (result.isConfirmed) {

            if (lvlCalcsCap != result.value) {

                lvlCalcsCap = result.value;
                // data.level_cap = result.value;
                document.getElementById('set-level-cap').innerText = GetLanguageString("button-levelcapprefix") + lvlCalcsCap;

                updateAggregateCount();
                if (resourceDisplay == "Remaining") {
                    updateCells(neededMatDict, false, 'resource-count-text', 'misc-resource');
                }
                else if (resourceDisplay == "Total") {
                    updateCells(requiredMatDict, false, 'resource-count-text', 'misc-resource');
                }
                else if (resourceDisplay == "Leftover") {
                    updateCells(leftoverMatDict, false, 'resource-count-text', 'misc-resource');
                }

                saveTime = Date.now() + (1000 * 5);
            }
        }
    })
}

async function pickCharacter(slotDivId, type) {

    selectingSlotId = slotDivId;

    let options, optionsBorrow;
    if (type == "Striker") {
        showMultiSelect("AddTeamStriker");
        return;
        // options = groupStrikerOptions;
        // optionsBorrow = groupStrikerBorrows;
    }
    else if (type == "Special") {
        showMultiSelect("AddTeamSpecial");
        return;
        // options = groupSpecialOptions;
        // optionsBorrow = groupSpecialBorrows;
    }



    // let getBorrow = false;
    // let character;

    // await Swal.fire({
    //     title: 'Add new character',
    //     input: 'select',
    //     inputOptions: options,
    //     inputPlaceholder: 'Select a character',
    //     showCancelButton: true,
    //     showDenyButton: !borrowed,
    //     denyButtonText: 'Borrow',
    //     denyButtonColor: '#dc9641'
    // }).then((result) => {
    //     if (result.isConfirmed) {
    //         character = result.value;
    //     }
    //     else if (result.isDenied) {
    //         getBorrow = true;
    //     }
    // })

    // if (getBorrow) {
    //     const { value: borrow } = await Swal.fire({
    //         title: 'Add borrow character',
    //         input: 'select',
    //         inputOptions: optionsBorrow,
    //         inputPlaceholder: 'Select a character',
    //         showCancelButton: true
    //     })

    //     if (borrow) {
    //         let slotContainer = document.getElementById(slotDivId);

    //         let slotChildren = slotContainer.children;

    //         for (let i = 0; i < slotChildren.length; i++) {
    //             slotChildren[i].remove();
    //         }

    //         createCharBox(borrow, slotContainer, "borrow");

    //         borrowed = true;
    //         saveGroup();
    //     }
    // }

    // if (character) {
    //     let slotContainer = document.getElementById(slotDivId);

    //     let slotChildren = slotContainer.children;

    //     for (let i = 0; i < slotChildren.length; i++) {
    //         slotChildren[i].remove();
    //     }

    //     createCharBox(character, slotContainer, "teams");
    //     groupChars.push(charNames.get(character));

    //     saveGroup();

    //     generateTeamCharOptions();
    // }
}

function groupEditorMode(mode) {

    let groupMoveMode = document.getElementById('group-move-mode');
    let groupRemoveMode = document.getElementById('group-remove-mode');
    let teamsContainer = document.getElementById("teamsContainer")

    if (mode == "Move") {
        groupEditMode = "Move";
        groupMoveMode.style.filter = "invert(0.8)";
        groupRemoveMode.style.filter = "";
        teamsContainer.classList.add('move-mode')
        teamsContainer.classList.remove('remove-mode')
    }
    else if (mode == "Remove") {
        groupEditMode = "Remove";
        groupMoveMode.style.filter = "";
        groupRemoveMode.style.filter = "invert(0.8)";
        teamsContainer.classList.add('remove-mode')
        teamsContainer.classList.remove('move-mode')
    }

}

function getCharsInTeam(teamId) {

    let inGroup = [];

    let team = document.getElementById(teamId);

    if (team) {
        let strikers = team.children[1];
        let specials = team.children[2];

        for (let str = 0; str < 4; str++) {
            let slotCharId = strikers.children[str].children[0].id;

            if (slotCharId) {
                if (slotCharId.includes('borrow')) {
                    inGroup[str] = { id: slotCharId.substring(12) };
                }
                else {
                    inGroup[str] = slotCharId.substring(11);
                }
            }
            else {
                inGroup[str] = null;
            }
        }

        for (let spe = 0; spe < 2; spe++) {
            let slotCharId = specials.children[spe].children[0].id;

            if (slotCharId) {
                if (slotCharId.includes('borrow')) {
                    inGroup[spe + 4] = { id: slotCharId.substring(12) };
                }
                else {
                    inGroup[spe + 4] = slotCharId.substring(11);
                }
            }
            else {
                inGroup[spe + 4] = null;
            }
        }
    }

    return inGroup;
}

function getCharsInGroup() {

    let teams = [];

    let teamElements = document.getElementById("teamsContainer")?.children;

    for (let i = 0; i < teamElements.length; i++) {

        let teamId = teamElements[i].id;

        let team = getCharsInTeam(teamId);

        if (!isTeamEmpty(team)) {
            teams.push(team);
        }

    }

    return teams;

}

function saveGroup() {

    if (data.groups == null) {
        data.groups = {};
    }

    let teams = getCharsInGroup();

    if (teams.length > 0) {
        data.groups[currentGroup] = teams;
    }
    else {
        data.groups[currentGroup] = null;
    }

    saveTime = Date.now() + (1000 * 5);

}

function groupSelected() {

    let selectElement = document.getElementById('select-groups');
    selectElement.blur();

    let groupName = selectElement.value;

    if (groupName) {
        clearTeams();

        currentGroup = groupName;
        borrowed = false;
        loadGroup(groupName);
    }
}

function loadGroup(groupName) {

    let teams;

    if (data.groups) {
        teams = data.groups[groupName];
    }

    if (teams && teams.length > 0) {
        for (let i = 0; i < teams.length; i++) {
            addNewTeam(teams[i]);
        }
    }
    else {
        addNewTeam([null, null, null, null, null, null]);
    }

    generateTeamCharOptions();

}

function deleteGroup() {

    if (currentGroup == "") {
        basicAlert(GetLanguageString("text-selectgroup"));
        return;
    }

    Swal.fire({
        title: GetLanguageString("label-areyousure"),
        text: GetLanguageString("text-deletegroup"),
        color: alertColour,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: GetLanguageString("confirmdeletion"),
        cancelButtonText: GetLanguageString("label-cancel")
    }).then((result) => {
        if (result.isConfirmed) {
            clearTeams();
            document.getElementById('select-groups').value = "blankselect";

            // if (!defaultGroups.includes(currentGroup)) {

            $("#select-groups option[value='" + currentGroup + "']").remove();
            // }

            if (data.groups[currentGroup]) {

                delete (data.groups[currentGroup]);
                saveTime = Date.now() + (1000 * 5);
            }

            currentGroup = "";

            rebuildGroups();
        }
    })
}

async function renameGroup() {

    if (currentGroup == "") {
        basicAlert(GetLanguageString("text-selectgroup"));
        return;
    }

    if (false) {//defaultGroups.includes(currentGroup)) {
        Swal.fire({
            title: "Defaut groups can't be renamed",
            icon: 'warning'
        })
    }
    else {
        const { value: groupName } = await Swal.fire({
            title: GetLanguageString("text-renamegroup"),
            input: 'text',
            inputPlaceholder: GetLanguageString("placeholder-grouprename"),
            showCancelButton: true,
            confirmButtonText: GetLanguageString("button-ok"),
            cancelButtonText: GetLanguageString("label-cancel"),
            inputValidator: (value) => {
                if (!value) {
                    return GetLanguageString("text-fieldempty");
                }

                if (value.length > 35) {
                    return GetLanguageString("text-namelong");
                }

                // if (defaultGroups.includes(value) || value == "blankselect") {
                //     return "Can't use that name";
                // }

                if ($("#select-groups option[value='" + value + "']").length > 0) {
                    return GetLanguageString("text-groupexists");
                }
            }
        })

        if (groupName) {
            let option = $("#select-groups option[value='" + currentGroup + "']");

            // if (option.length > 0) {
            //     option[0].text = groupName;
            //     option[0].value = groupName;
            // }
            let curGroupPos;

            if (data.groups && data.groups[currentGroup]) {
                curGroupPos = Object.keys(data.groups).indexOf(currentGroup) + 1;

                data.groups[groupName] = data.groups[currentGroup];
                delete (data.groups[currentGroup]);

                currentGroup = groupName;

                if (curGroupPos) {
                    SetGroupOrder(curGroupPos);
                }

                rebuildGroups();

                saveTime = Date.now() + (1000 * 5);
            }
        }
    }

}

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

async function MoveGroup() {

    if (currentGroup == "") {
        basicAlert(GetLanguageString("text-selectgroup"));
        return;
    }

    let groupCount = 0;
    if (data.groups) {
        groupCount = Object.keys(data.groups).length;
        if (groupCount <= 1) {
            basicAlert(GetLanguageString("text-needmoregroups"));
            return;
        }
    }

    const { value: groupPos } = await Swal.fire({
        title: GetLanguageString("text-newgroupposition"),
        input: 'text',
        inputLabel: '1-' + groupCount,
        inputPlaceholder: '',
        showCancelButton: true,
        confirmButtonText: GetLanguageString("button-ok"),
        cancelButtonText: GetLanguageString("label-cancel"),
        inputValidator: (value) => {
            if (!value) {
                return GetLanguageString("text-fieldempty");
            }

            let positionValue = parseInt(value);

            if (positionValue < 1 || positionValue > groupCount) {
                return GetLanguageString("text-positionerrorprefix") + groupCount;
            }

        }
    })

    SetGroupOrder(groupPos);
    saveTime = Date.now() + (1000 * 5);

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

function rebuildGroups() {

    let selectElement = document.getElementById('select-groups');

    let options = selectElement.children;
    while (options.length > 1) {
        options[1].remove();
    }

    // for (let i = 0; i < defaultGroups.length; i++) {

    //     addOption(selectElement, defaultGroups[i], defaultGroups[i]);
    // }
    let curGroup = 1;

    if (data.groups) {

        for (key in data.groups) {

            // if (!defaultGroups.includes(key)) {
            addOption(selectElement, curGroup + ". " + key, key);
            // }
            curGroup++;
        }
    }

    selectElement.value = "blankselect";
    currentGroup = "";
    clearTeams();
}

function rebuildFilters() {

    let filterGroups = document.getElementById('filter-groups');

    let options = filterGroups.children;
    while (options.length > 0) {
        options[0].remove();
    }

    addOption(filterGroups, GetLanguageString("label-all"), "All");

    if (data.groups) {

        for (key in data.groups) {
            addOption(filterGroups, key, key);
        }
    }

}

function ToggleGroupFilterMode() {

    // APRIL FOOLS
    // if (document.getElementById("btn-group-filter-mode").classList.contains("april-fools-button")) {
    //     return;
    // }

    if (GroupFilterMode == "OnlyGroup") {
        GroupFilterMode = "UpToGroup";
        document.getElementById('btn-group-filter-mode').innerText = GetLanguageString("button-groupmodeupto");
    }
    else if (GroupFilterMode == "UpToGroup") {
        GroupFilterMode = "OnlyGroup";
        document.getElementById('btn-group-filter-mode').innerText = GetLanguageString("button-groupmodeonly");
    }

    filterChanged("group");
}

function filterChanged(filterType) {

    let filtered = [];

    if (filterType == "group") {

        let selectElement = document.getElementById('filter-groups');
        selectElement.blur();

        let groupName = selectElement.value;

        if (groupName == "All") {
            filtered = "All";
        }
        else if (groupName) {
            if (GroupFilterMode == "OnlyGroup") {
                filtered = charsFromGroup(groupName);
            }
            else if (GroupFilterMode == "UpToGroup") {
                let groups = Object.keys(data.groups);

                for (let i = 0; i < groups.length; i++) {
                    let additionalMembers = charsFromGroup(groups[i]);

                    for (let m = 0; m < additionalMembers.length; m++) {
                        if (!filtered.includes(additionalMembers[m])) {
                            filtered.push(additionalMembers[m]);
                        }
                    }

                    if (groups[i] == groupName) {
                        break;
                    }
                }
            }
        }
    }

    applyFilters(filtered);

}

function applyFilters(filtered) {

    var charBoxes = document.getElementsByClassName('main-display-char');

    for (let i = 0; i < charBoxes.length; i++) {

        if (filtered == "All") {
            charBoxes[i].classList.remove('filtered-out');
            continue;
        }

        if (filtered.includes(charBoxes[i].id.substring(5))) {
            charBoxes[i].classList.remove('filtered-out');
        }
        else {
            charBoxes[i].classList.add('filtered-out');
        }
    }

}

function resetFilters() {

    // APRIL FOOLS
    // if (document.getElementById("button-resetfilters").classList.contains("april-fools-button")) {
    //     return;
    // }

    let selectElement = document.getElementById('filter-groups');
    selectElement.value = "All";

    filterChanged('group');

    resetViewFilters();
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

function charactersToggle(value) {

    // APRIL FOOLS
    // if (value == "enable" && document.getElementById("button-enableall").classList.contains("april-fools-button")) {
    //     return;
    // }
    // else if (value == "disable" && document.getElementById("button-disableall").classList.contains("april-fools-button")) {
    //     return;
    // }

    disabledChars = [];

    for (let i in data.characters) {

        let charBox = document.getElementById('char_' + data.characters[i].id);

        if (!charBox) {
            continue;
        }

        if (value == "enable" && !charBox.classList.contains('filtered-out')) {
            data.characters[i].enabled = true;
            charBox.classList.remove("deselected");
        }
        else if (value == "disable" && !charBox.classList.contains('filtered-out')) {
            data.characters[i].enabled = false;
            disabledChars.push(data.characters[i].id.toString());
            charBox.classList.add("deselected");
        }
        else {
            if (data.characters[i].enabled == false) {
                disabledChars.push(data.characters[i].id.toString());
            }
        }
    }

    data.disabled_characters = disabledChars;

    saveTime = Date.now() + (1000 * 5);
}

function getTextGroup() {

    if (currentGroup == "") {
        basicAlert(GetLanguageString("text-selectgroup"));
        return;
    }

    Swal.fire({
        title: GetLanguageString("text-textformat"),
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: GetLanguageString("text-monospaced"),
        denyButtonText: GetLanguageString("text-proportional"),
        cancelButtonText: GetLanguageString("label-cancel"),
        denyButtonColor: '#dc9641'
    }).then((result) => {
        if (result.isConfirmed) {
            getTextFormattedGroup(true);
        }
        else if (result.isDenied) {
            getTextFormattedGroup(false);
        }
    })
}

function getTextFormattedGroup(monospaced) {

    let group = getCharsInGroup();
    let textOutput = "";

    let names = [];
    let levels = [];

    for (let i = 0; i < group.length; i++) {

        names.push("Team " + (i + 1));
        levels.push("");

        for (let c = 0; c < group[i].length; c++) {

            if (group[i][c] != null) {

                let charDataString = "";
                let charId;
                if (typeof (group[i][c]) == "object") {
                    charId = group[i][c].id;
                    names.push(charNames.get(charId));
                    levels.push("(Borrowed)");
                    continue;
                }
                else {
                    charId = group[i][c];
                }

                let charData = data.characters.find(obj => { return obj.id == charId });

                names.push(charNames.get(charId));

                if (charData.current.ue > 0) {
                    charDataString += "UE" + charData.current.ue + "★  ";
                }
                else {
                    charDataString += charData.current.star + "★  ";
                    if (monospaced) {
                        charDataString += "  ";
                    }
                }
                charDataString += charData.current.level + "  ";
                if (charData.current.level.length == 1 && monospaced) {
                    charDataString += " ";
                }
                charDataString += formatLevel("Ex", charData.current.ex) + formatLevel("Other", charData.current.basic) +
                    formatLevel("Other", charData.current.passive) + formatLevel("Other", charData.current.sub) + "  ";
                charDataString += charData.current.gear1 + charData.current.gear2 + charData.current.gear3 + "  ";
                if (charData.current.ue_level != "0") {
                    charDataString += charData.current.ue_level;
                }

                levels.push(charDataString);
            }

        }
    }

    let longest = 0;
    for (let i = 0; i < names.length; i++) {
        if (names[i].length > longest) {
            longest = names[i].length;
        }
    }

    if (monospaced) {
        textOutput += "Name" + " ".repeat(longest - 4) + " Star  Lvl Skill Gear UE\n";
    }
    else {
        textOutput += "Name   Star Lvl Skill Gear UE\n";
    }

    for (let i = 0; i < names.length; i++) {
        if (names[i].substring(0, 5) == "Team ") {
            if (i != 0) {
                textOutput += "\n";
            }
            textOutput += names[i] + "\n";
        }
        else {
            if (monospaced) {
                textOutput += names[i] + " ".repeat(longest - names[i].length + 1) + levels[i] + "\n";
            }
            else {
                textOutput += names[i] + " " + levels[i] + "\n";
            }
        }
    }

    Swal.fire({
        title: GetLanguageString("text-textrepresentation"),
        confirmButtonText: GetLanguageString("button-ok"),
        html: '<textarea style="width: 400px; height: 250px; resize: none; padding: 10px;" readonly>' + textOutput + '</textarea>'
    })

}

async function saveToLocalStorage(notify) {
    saveTime = 0;

    localStorage.setItem("save-data", JSON.stringify(data));

    if (notify && !document.documentElement.classList.contains('swal2-shown')) {
        Swal.fire({
            toast: true,
            position: 'top-start',
            title: GetLanguageString("text-datasaved"),
            showConfirmButton: false,
            timer: 1500
        })
    }
}

function saveCharChanges() {

    let allValid = true;
    let invalidMessages = "";

    for (let key in inputValidation) {
        if (inputValidation[key].location == "characterModal") {
            let result = validateInput(key, false, true);
            if (result != "validated") {
                //invalidMessages.push(result);
                invalidMessages += result + "<br>";
                allValid = false;
            }
        }
    }

    if (allValid == false) {
        // Swal.fire({
        //     title: 'Invalid inputs',
        //     html: invalidMessages,
        //     color: alertColour
        // })

        return false;
    }

    var charName = charNames.get(modalCharID);
    charId = modalCharID;

    var charData = data.characters.find(obj => { return obj.id == charId });

    if (charData != undefined) {

        charData.current = {};
        charData.target = {};
        charData.eleph = {};

        charData.current.level = document.getElementById("input_level_current").value;
        charData.target.level = document.getElementById("input_level_target").value;

        charData.current.ue_level = document.getElementById("input_ue_level_current").value;
        charData.target.ue_level = document.getElementById("input_ue_level_target").value;

        charData.current.bond = document.getElementById("input_bond_current").value;
        charData.target.bond = document.getElementById("input_bond_target").value;

        charData.current.ex = document.getElementById("input_ex_current").value;
        charData.target.ex = document.getElementById("input_ex_target").value;
        charData.current.basic = document.getElementById("input_basic_current").value;
        charData.target.basic = document.getElementById("input_basic_target").value;
        charData.current.passive = document.getElementById("input_enhanced_current").value;
        charData.target.passive = document.getElementById("input_enhanced_target").value;
        charData.current.sub = document.getElementById("input_sub_current").value;
        charData.target.sub = document.getElementById("input_sub_target").value;

        charData.current.gear1 = document.getElementById("input_gear1_current").value;
        charData.target.gear1 = document.getElementById("input_gear1_target").value;
        charData.current.gear2 = document.getElementById("input_gear2_current").value;
        charData.target.gear2 = document.getElementById("input_gear2_target").value;
        charData.current.gear3 = document.getElementById("input_gear3_current").value;
        charData.target.gear3 = document.getElementById("input_gear3_target").value;

        charData.current.star = modalStars.star;
        charData.target.star = modalStars.star_target;
        charData.current.ue = modalStars.ue;
        charData.target.ue = modalStars.ue_target;

        charData.eleph.owned = document.getElementById("input_eleph_owned").value;
        charData.eleph.unlocked = document.getElementById("input_char_unlocked").checked;
        charData.eleph.cost = document.getElementById("input_eleph_cost").value;
        charData.eleph.purchasable = document.getElementById("input_eleph_purchasable").value;
        charData.eleph.farm_nodes = document.getElementById("input_farm_nodes").value;
        charData.eleph.node_refresh = document.getElementById("input_allow_node_refresh").checked;
        charData.eleph.use_eligma = document.getElementById("option-eligma").checked;
        charData.eleph.use_shop = document.getElementById("option-shop").checked;

        saveToLocalStorage(true);
    }

    calculateCharResources(charData, false);

    updateInfoDisplay(charId, "", charData);

    updateStarDisplay(charId + "-star-container", charId, "star-display", true, charData);
    updateStarDisplay(charId + "-ue-container", charId, "ue-display", true, charData);

    if (keyPressed.Control == true) {
        closeModal(true);
    }
}

function updateTextBackground(id, property) {

    let textElement = document.getElementById(id);

    if (textElement) {
        textElement.style.backgroundColor = propertyColours[property];
    }

}

function GetMoodFromAdaptation(adaptationValue) {
    return ["D", "C", "B", "A", "S", "SS"][adaptationValue];
}

function GetOldTerrain(newTerrain) {
    if (newTerrain == "Street") {
        return "Urban";
    }
    else if (newTerrain == "Outdoor") {
        return "Outdoors";
    }
    else if (newTerrain == "Indoor") {
        return "Indoors";
    }
}

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

    // for (let i = 0; i < charSkills.length; i++) {
    //     if (charSkills[i].SkillType == skill) {
    //         return charSkills[i];
    //     }
    // }

    return null;
}

function populateCharModal(charId) {

    let charName = charNames.get(charId);
    var charData = data.characters.find(obj => { return obj.id == charId });

    var charInfo = charlist[charId];

    if (charData != undefined) {

        document.getElementById("display_school").innerText = GetLanguageString('school-' + charInfo.School.toLowerCase());
        updateTextBackground("display_school", charInfo.School);
        document.getElementById("display_type").innerText = GetLanguageString("type-" + GetOldTypeFromSquadType(charInfo.SquadType).toLowerCase());
        updateTextBackground("display_type", GetOldTypeFromSquadType(charInfo.SquadType));
        document.getElementById("display_role").innerText = GetLanguageString("role-" + charInfo.TacticRole.toLowerCase());
        document.getElementById("display_position").innerText = GetLanguageString("position-" + charInfo.Position.toLowerCase());
        document.getElementById("display_gun").innerText = GetLanguageString("gun-" + charInfo.WeaponType.toLowerCase());
        document.getElementById("display_attack_type").innerText = GetLanguageString("atktype-" + charInfo.BulletType.toLowerCase());
        updateTextBackground("display_attack_type", charInfo.BulletType);
        document.getElementById("display_defense_type").innerText = GetLanguageString("deftype-" + charInfo.ArmorType.toLowerCase());
        updateTextBackground("display_defense_type", charInfo.ArmorType);

        document.getElementById('mood-Urban').src = "icons/Mood/Mood_" + GetMoodFromAdaptation(charInfo.StreetBattleAdaptation) + ".png";
        document.getElementById('mood-Outdoors').src = "icons/Mood/Mood_" + GetMoodFromAdaptation(charInfo.OutdoorBattleAdaptation) + ".png";
        document.getElementById('mood-Indoors').src = "icons/Mood/Mood_" + GetMoodFromAdaptation(charInfo.IndoorBattleAdaptation) + ".png";

        if (charData.current?.ue >= 3) {

            let terrain = charInfo.Weapon.AdaptationType;
            let boostAmt = charInfo.Weapon.AdaptationValue;

            document.getElementById('mood-' + GetOldTerrain(terrain)).src = "icons/Mood/Mood_" + boostedMood(GetMoodFromAdaptation(charInfo[terrain + "BattleAdaptation"]), boostAmt) + ".png";
        }

        document.getElementById("input_level_current").value = charData.current?.level;
        document.getElementById("input_level_target").value = charData.target?.level;

        document.getElementById("input_ue_level_current").value = charData.current?.ue_level;
        document.getElementById("input_ue_level_target").value = charData.target?.ue_level;

        document.getElementById("input_bond_current").value = charData.current?.bond;
        document.getElementById("input_bond_target").value = charData.target?.bond;

        document.getElementById("input_ex_current").value = charData.current?.ex;
        document.getElementById("input_ex_target").value = charData.target?.ex;
        document.getElementById("input_basic_current").value = charData.current?.basic;
        document.getElementById("input_basic_target").value = charData.target?.basic;
        document.getElementById("input_enhanced_current").value = charData.current?.passive;
        document.getElementById("input_enhanced_target").value = charData.target?.passive;
        document.getElementById("input_sub_current").value = charData.current?.sub;
        document.getElementById("input_sub_target").value = charData.target?.sub;

        document.getElementById("input_gear1_current").value = charData.current?.gear1;
        document.getElementById("input_gear1_target").value = charData.target?.gear1;
        document.getElementById("input_gear2_current").value = charData.current?.gear2;
        document.getElementById("input_gear2_target").value = charData.target?.gear2;
        document.getElementById("input_gear3_current").value = charData.current?.gear3;
        document.getElementById("input_gear3_target").value = charData.target?.gear3;

        if (charData.current?.gear1 != "0") {
            document.getElementById("gear1-img").src = "icons/Gear/T" + charData.current?.gear1 + "_" + charInfo.Equipment[0] + "_small.webp";
        }
        else {
            document.getElementById("gear1-img").src = "icons/Gear/T1_" + charInfo.Equipment[0] + "_small.webp";
        }
        if (charData.current?.gear2 != "0") {
            document.getElementById("gear2-img").src = "icons/Gear/T" + charData.current?.gear2 + "_" + charInfo.Equipment[1] + "_small.webp";
        }
        else {
            document.getElementById("gear2-img").src = "icons/Gear/T1_" + charInfo.Equipment[1] + "_small.webp";
        }
        if (charData.current?.gear3 != "0") {
            document.getElementById("gear3-img").src = "icons/Gear/T" + charData.current?.gear3 + "_" + charInfo.Equipment[2] + "_small.webp";
        }
        else {
            document.getElementById("gear3-img").src = "icons/Gear/T1_" + charInfo.Equipment[2] + "_small.webp";
        }

        document.getElementById("ex-img").src = "icons/SkillIcon/" + GetSkillObject(charId, "Ex").Icon + ".png";
        document.getElementById("basic-img").src = "icons/SkillIcon/" + GetSkillObject(charId, "Public").Icon + ".png";
        document.getElementById("enhanced-img").src = "icons/SkillIcon/" + GetSkillObject(charId, "Passive").Icon + ".png";
        document.getElementById("sub-img").src = "icons/SkillIcon/" + GetSkillObject(charId, "ExtraPassive").Icon + ".png";


        modalStars.star = charData.current?.star;
        modalStars.star_target = charData.target?.star;
        modalStars.ue = charData.current?.ue;
        modalStars.ue_target = charData.target?.ue;

        document.getElementById("input_eleph_owned").value = charData.eleph?.owned;
        document.getElementById("input_char_unlocked").checked = charData.eleph?.unlocked;
        document.getElementById("input_eleph_cost").value = charData.eleph?.cost;
        document.getElementById("input_eleph_purchasable").value = charData.eleph?.purchasable;
        document.getElementById("input_farm_nodes").value = charData.eleph?.farm_nodes;
        document.getElementById("input_allow_node_refresh").checked = charData.eleph?.node_refresh;
        document.getElementById("option-eligma").checked = charData.eleph?.use_eligma;
        document.getElementById("option-shop").checked = charData.eleph?.use_shop;

        gtag('event', 'character_viewed', {
            'event_label': charName,
            'character_name': charName,
            'character_id': charId,
            'character_star': charData.current?.star,
            'character_level': charData.current?.level,
            'character_ex': charData.current?.ex,
            'character_ex': charData.current?.basic,
            'character_ex': charData.current?.passive,
            'character_ex': charData.current?.sub
        })
    }

    updateStarDisplays(charId, true);

    updateTooltip(charId, "ex");
    updateTooltip(charId, "basic");
    updateTooltip(charId, "passive");
    updateTooltip(charId, "sub");

}

function charUnlockClick() {

    let state = document.getElementById("input_char_unlocked").checked;

    if (state == false) {

        let charInfoObj = charlist[modalCharID];

        if (modalStars.star > charInfoObj.StarGrade) {

            modalStars.star = charInfoObj.StarGrade;

            if (modalStars.ue > 0) {
                modalStars.ue = 0;

                let terrain = charInfoObj.Weapon.AdaptationType;

                document.getElementById('mood-' + GetOldTerrain(terrain)).src = "icons/Mood/Mood_" + GetMoodFromAdaptation(charInfoObj[terrain + "BattleAdaptation"]) + ".png";
            }

            updateStarDisplays(modalCharID, true);
        }

    }

    populateCharResources(modalCharID);
}

function serverToggle(e) {

    if (e) {
        e.stopPropagation();
    }

    let serverToggleBtn = document.getElementById('hm-server-toggle');
    let serverToggleBtn2 = document.getElementById('nm-server-toggle');

    if (data.server == "Global") {
        data.server = "JP";
        serverToggleBtn.innerText = "JP";
        serverToggleBtn2.innerText = "JP";
    }
    else if (data.server == "JP") {
        data.server = "CN"
        serverToggleBtn.innerText = "CN";
        serverToggleBtn2.innerText = "CN";
    }
    else if (data.server == "CN") {
        data.server = "Global"
        serverToggleBtn.innerText = "Gbl";
        serverToggleBtn2.innerText = "Gbl";
    }

    if (e && e.currentTarget.id == "nm-server-toggle") {
        HideStagesPopup();
        SolveGearFarm();
        return;
    }

    let hardModes = misc_data.hard_modes[modalCharID];
    let hardModeNodes = 0;

    if (data.server == "Global") {

        for (let i = 0; i < hardModes.length; i++) {

            if (parseInt(hardModes[i].substring(0, hardModes[i].indexOf('-'))) <= globalMaxWorld) {
                hardModeNodes++;
            }
        }
    }
    else if (data.server == "JP") {
        hardModeNodes = hardModes.length;
    }
    else if (data.server == "CN") {
        for (let i = 0; i < hardModes.length; i++) {

            if (parseInt(hardModes[i].substring(0, hardModes[i].indexOf('-'))) <= cnMaxWorld) {
                hardModeNodes++;
            }
        }
    }

    sweepMax = hardModeNodes * 3; sweepMin = hardModeNodes * 3;
    if (document.getElementById('input_allow_node_refresh').checked) {
        sweepMax = hardModeNodes * 6;
    }

    document.getElementById("hard-nodes-count").innerText = "/ " + sweepMax;

    saveTime = Date.now() + (1000 * 5);
}

function boostedMood(base, boost) {

    let moods = ["D", "C", "B", "A", "S", "SS"];

    let moodValue = moods.indexOf(base);

    return moods[moodValue + boost];
}

function updateTooltip(charId, skill) {

    let charData = charDataFromModal(charId);

    if (skill == "ex" || skill == "ex_target") {
        tooltips[0].setProps({
            content: getSkillFormatted(charId, "Ex", charData.current?.ex, charData.target?.ex)
        })
    }
    else if (skill == "basic" || skill == "basic_target") {
        tooltips[1].setProps({
            content: getSkillFormatted(charId, "Skill1", charData.current?.basic, charData.target?.basic)
        })
    }
    else if (skill == "passive" || skill == "passive_target") {
        tooltips[2].setProps({
            content: getSkillFormatted(charId, "Skill2", charData.current?.passive, charData.target?.passive, charData.target?.ue)
        })
    }
    else if (skill == "sub" || skill == "sub_target") {
        tooltips[3].setProps({
            content: getSkillFormatted(charId, "Skill3", charData.current?.sub, charData.target?.sub)
        })
    }
}

function GetBuffName(buffid) {

    let buffName = skillbuffnames[language.toLowerCase()]?.BuffName[buffid];

    if (!buffName) {
        buffName = skillbuffnames["en"]?.BuffName[buffid];
    }

    return buffName;
}

function getSkillFormatted(charId, skill, level, targetLevel, targetUe) {

    if (level == 0) {
        level = 1;
    }
    if (targetLevel == 0) {
        targetLevel = 1;
    }

    // if (localisations[language]?.Characters[charId]?.Skills[skill]?.Name) {

    //     if (skill == "Skill2" && targetUe >= 2) {
    //         skill = "Skill2Upgrade";
    //     }

    //     let firstDesc = localisations[language]?.Characters[charId]?.Skills[skill]["Level" + level].Description;

    //     let secondDesc;
    //     if (level != targetLevel) {
    //         secondDesc = localisations[language]?.Characters[charId]?.Skills[skill]["Level" + targetLevel].Description;
    //     }

    //     while (firstDesc.includes('[c][007eff]')) {
    //         let firstParam = firstDesc.substring(firstDesc.indexOf('[c][007eff]') + 11, firstDesc.indexOf('[-][/c]'));
    //         firstDesc = firstDesc.replace('[c][007eff]', '<span style="color: #008c9b;">');
    //         if (secondDesc) {
    //             let secondParam = secondDesc.substring(secondDesc.indexOf('[c][007eff]') + 11, secondDesc.indexOf('[-][/c]'));
    //             if (firstParam != secondParam) {
    //                 firstDesc = firstDesc.replace('[-][/c]', '</span>/<span style="color: #588f00;">' + secondParam + '</span>');
    //             }
    //             else {
    //                 firstDesc = firstDesc.replace('[-][/c]', '</span>');
    //             }
    //             secondDesc = secondDesc.replace('[c][007eff]', '').replace('[-][/c]', '');
    //         }
    //         else {
    //             firstDesc = firstDesc.replace('[-][/c]', '</span>');
    //         }
    //     }

    //     while (firstDesc.includes('\n')) {
    //         firstDesc = firstDesc.replace('\n', "<br>")
    //     }

    //     if (firstDesc && skill == "Ex") {

    //         let curCost = GetSkillObject(charId, "ex").Cost[level - 1];
    //         let tgtCost = GetSkillObject(charId, "ex").Cost[targetLevel - 1];

    //         let costText = 'Cost: <span style="color: #008c9b;">' + curCost + "</span>";

    //         if (level != targetLevel && curCost != tgtCost) {
    //             costText += '/<span style="color: #588f00;">' + tgtCost + "</span>";
    //         }

    //         firstDesc = costText + "<br>" + firstDesc;
    //     }

    //     return firstDesc;
    // }
    // else {

    if (skill == "Skill3") {
        skill = "Skill4";
    }

    if (skill == "Skill2" && targetUe >= 2) {
        skill = "Skill3";
    }

    let newSkill = "";
    if (skill == "Ex") {
        newSkill = "Ex";
    }
    else if (skill == "Skill1") {
        newSkill = "Public";
    }
    else if (skill == "Skill2") {
        newSkill = "Passive"
    }
    else if (skill == "Skill3") {
        newSkill = "WeaponPassive";
    }
    else if (skill == "Skill4") {
        newSkill = "ExtraPassive";
    }
    let skillObj = GetSkillObject(charId, newSkill);

    let desc = skillObj.Desc;
    let params = skillObj.Parameters;
    let cost = skillObj.Cost;

    let paramCount = 1;
    let infiBreak = 0;
    while (true) {

        let paramString = "<?" + paramCount + ">";

        if (desc && desc.includes(paramString)) {

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
            let effectShort = GetBuffName("Buff_" + effectKey);

            let paramRegex = new RegExp("<b:" + effectKey + ">", "g");
            desc = desc.replace(paramRegex, effectShort);
        }
        else if (desc && desc.includes("<d:")) {
            let effectIndex = desc.indexOf("<d:");
            let closeIndex = desc.substring(effectIndex).indexOf(">");

            let effectKey = desc.substring(effectIndex + 3, effectIndex + closeIndex);
            let effectShort = GetBuffName("Debuff_" + effectKey);

            let paramRegex = new RegExp("<d:" + effectKey + ">", "g");
            desc = desc.replace(paramRegex, effectShort);
        }
        else if (desc && desc.includes("<c:")) {
            let effectIndex = desc.indexOf("<c:");
            let closeIndex = desc.substring(effectIndex).indexOf(">");

            let effectKey = desc.substring(effectIndex + 3, effectIndex + closeIndex);
            let effectShort = GetBuffName("CC_" + effectKey);

            let paramRegex = new RegExp("<c:" + effectKey + ">", "g");
            desc = desc.replace(paramRegex, effectShort);
        }
        else if (desc && desc.includes("<s:")) {
            let effectIndex = desc.indexOf("<s:");
            let closeIndex = desc.substring(effectIndex).indexOf(">");

            let effectKey = desc.substring(effectIndex + 3, effectIndex + closeIndex);
            let effectShort = GetBuffName("Special_" + effectKey);

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
    // }
}

function charDataFromModal(charId) {

    let charData = {};

    charData.name = charNames.get(charId);
    charData.id = charId;

    charData.current = {};
    charData.target = {};
    charData.eleph = {};

    charData.current.level = document.getElementById("input_level_current").value;
    charData.target.level = document.getElementById("input_level_target").value;

    charData.current.ue_level = document.getElementById("input_ue_level_current").value;
    charData.target.ue_level = document.getElementById("input_ue_level_target").value;

    charData.current.bond = document.getElementById("input_bond_current").value;
    charData.target.bond = document.getElementById("input_bond_target").value;

    charData.current.ex = document.getElementById("input_ex_current").value;
    charData.target.ex = document.getElementById("input_ex_target").value;
    charData.current.basic = document.getElementById("input_basic_current").value;
    charData.target.basic = document.getElementById("input_basic_target").value;
    charData.current.passive = document.getElementById("input_enhanced_current").value;
    charData.target.passive = document.getElementById("input_enhanced_target").value;
    charData.current.sub = document.getElementById("input_sub_current").value;
    charData.target.sub = document.getElementById("input_sub_target").value;

    charData.current.gear1 = document.getElementById("input_gear1_current").value;
    charData.target.gear1 = document.getElementById("input_gear1_target").value;
    charData.current.gear2 = document.getElementById("input_gear2_current").value;
    charData.target.gear2 = document.getElementById("input_gear2_target").value;
    charData.current.gear3 = document.getElementById("input_gear3_current").value;
    charData.target.gear3 = document.getElementById("input_gear3_target").value;

    charData.current.star = modalStars.star;
    charData.target.star = modalStars.star_target;
    charData.current.ue = modalStars.ue;
    charData.target.ue = modalStars.ue_target;

    charData.eleph.owned = document.getElementById("input_eleph_owned").value;
    charData.eleph.unlocked = document.getElementById("input_char_unlocked").checked;
    charData.eleph.cost = document.getElementById("input_eleph_cost").value;
    charData.eleph.purchasable = document.getElementById("input_eleph_purchasable").value;
    charData.eleph.farm_nodes = document.getElementById("input_farm_nodes").value;
    charData.eleph.node_refresh = document.getElementById("input_allow_node_refresh").checked;
    charData.eleph.use_eligma = document.getElementById("option-eligma").checked;
    charData.eleph.use_shop = document.getElementById("option-shop").checked;

    return charData;

}

function isCharModalDirty() {

    let charData = data.characters.find(obj => { return obj.id == modalCharID });
    let modalData = charDataFromModal();

    if (compareObjects(charData.current, modalData.current) != true) {
        return true;
    }
    else if (compareObjects(charData.target, modalData.target) != true) {
        return true;
    }
    else if (compareObjects(charData.eleph, modalData.eleph) != true) {
        return true;
    }

    return false;
}

function compareObjects(obj1, obj2) {

    let keyCount = 0;
    for (key in obj1) {

        if (obj1[key] != obj2[key]) {
            return false;
        }

        keyCount++;
    }

    if (keyCount != Object.keys(obj2).length) {
        return false;
    }

    return true;

}

function populateCharResources(charId) {

    let mainartisWrapper = document.getElementById('char-mainartis-wrapper');
    let subartisWrapper = document.getElementById('char-subartis-wrapper');
    let bdWrapper = document.getElementById('char-bds-wrapper');
    let tnWrapper = document.getElementById('char-tns-wrapper');

    while (mainartisWrapper.children.length > 0) {
        mainartisWrapper.children[0]._tippy.destroy();
        mainartisWrapper.children[0].remove();
    }
    while (subartisWrapper.children.length > 0) {
        subartisWrapper.children[0]._tippy.destroy();
        subartisWrapper.children[0].remove();
    }
    while (bdWrapper.children.length > 0) {
        bdWrapper.children[0]._tippy.destroy();
        bdWrapper.children[0].remove();
    }
    while (tnWrapper.children.length > 0) {
        tnWrapper.children[0]._tippy.destroy();
        tnWrapper.children[0].remove();
    }

    let resources = calculateCharResources(charDataFromModal(charId), true);

    if (resources) {

        let mainMatId = charlist[charId]?.SkillExMaterial[0][1];
        let mainMat = matLookup.get(mainMatId);
        if (mainMat) {
            mainMat = mainMat.substring(0, mainMat.indexOf('_'));
        }

        for (key in resources) {

            let matName = matLookup.get(key);

            if (matName && matName != "Secret") {
                const wrapDiv = document.createElement('div');
                wrapDiv.className = "char-resource-wrapper";
                tippy(wrapDiv, {
                    content: GetLanguageString("label-ownedprefix") + (ownedMatDict[key] ?? 0),
                    theme: "light"
                })

                let extraClassName = "";

                if (matName[2] === "_") {
                    extraClassName = " char-resource-rarity-" + matName[3];
                }
                else {
                    extraClassName = " char-resource-rarity-" + matName.substring(matName.length - 1);
                }

                wrapDiv.className += extraClassName;

                const resourceImg = document.createElement('img');
                resourceImg.className = "char-resource-img";

                if (matName.includes("BD") || matName.includes("TN")) {
                    resourceImg.src = "icons/SchoolMat/" + matName + ".webp";
                }
                else {
                    resourceImg.src = "icons/Artifact/" + matName + ".webp";
                }

                const resourceText = document.createElement('p');
                resourceText.className = "resource-display-text";
                resourceText.innerText = resources[key];

                wrapDiv.appendChild(resourceImg);
                wrapDiv.appendChild(resourceText);

                if (matName.includes("BD")) {
                    bdWrapper.appendChild(wrapDiv);
                }
                else if (matName.includes("TN")) {
                    tnWrapper.appendChild(wrapDiv);
                }
                else if (matName.includes(mainMat)) {
                    mainartisWrapper.appendChild(wrapDiv);
                }
                else {
                    subartisWrapper.appendChild(wrapDiv);
                }
            }

        }

        let creditText = document.getElementById('char-Credit');

        if (resources["Credit"] > 0) {
            creditText.innerText = commafy(resources["Credit"]);
            creditText.parentElement.style.display = "";
        }
        else {
            creditText.parentElement.style.display = "none";
        }

        let secretText = document.getElementById('char-Secret');

        if (resources["9999"] > 0) {
            secretText.innerText = resources["9999"];
            secretText.parentElement.style.display = "";
        }
        else {
            secretText.parentElement.style.display = "none";
        }

        let xpText = document.getElementById('char-XP');

        if (resources["Xp"] > 0) {
            xpText.innerText = commafy(resources["Xp"]);
            xpText.parentElement.style.display = "";
        }
        else {
            xpText.parentElement.style.display = "none";
        }

        let gxpText = document.getElementById('char-GXP');

        if (resources["GearXp"] > 0) {
            gxpText.innerText = commafy(resources["GearXp"]);
            gxpText.parentElement.style.display = "";
        }
        else {
            gxpText.parentElement.style.display = "none";
        }

        let uexpText = document.getElementById('char-UEXP');

        if (resources["Spring_Xp"] > 0) {
            uexpText.innerText = commafy(resources["Spring_Xp"]);
            uexpText.parentElement.style.display = "";
        }
        else if (resources["Hammer_Xp"] > 0) {
            uexpText.innerText = commafy(resources["Hammer_Xp"]);
            uexpText.parentElement.style.display = "";
        }
        else if (resources["Barrel_Xp"] > 0) {
            uexpText.innerText = commafy(resources["Barrel_Xp"]);
            uexpText.parentElement.style.display = "";
        }
        else {
            uexpText.parentElement.style.display = "none";
        }

        let elephText = document.getElementById('char-Eleph');

        if (resources["Eleph"] > 0) {
            elephText.innerText = commafy(resources["Eleph"]);
            elephText.parentElement.style.display = "";
        }
        else {
            elephText.parentElement.style.display = "none";
        }

        let eligmaText = document.getElementById('char-Eligma');

        if (resources["Eligma"] > 0) {
            eligmaText.innerText = commafy(resources["Eligma"]);
            eligmaText.parentElement.style.display = "";
        }
        else {
            eligmaText.parentElement.style.display = "none";
        }

        let hardModes = misc_data.hard_modes[charId];
        let shopCharacter = misc_data.shop_characters[charId];
        let shopCurrency;

        let shopCurrencyText = document.getElementById('char-ShopCurrency');
        let currencyResetsText = document.getElementById('char-currency-times');

        if (hardModes) {
            if (resources["ShopResets"] > 0) {
                currencyResetsText.innerText = resources["ShopResets"];
                document.getElementById("content-14").style.display = "";
            }
            else {
                document.getElementById("content-14").style.display = "none";
            }
        }
        else {

            if (typeof (shopCharacter) == "object") {
                shopCurrency = shopCharacter.currency;
            }
            else {
                shopCurrency = shopCharacter;
            }

            if (resources[shopCurrency + "Cost"] > 0) {
                shopCurrencyText.innerText = commafy(resources[shopCurrency + "Cost"]);
                shopCurrencyText.parentElement.style.display = "";
                currencyResetsText.innerText = resources["ShopResets"];
                document.getElementById("content-14").style.display = "";
            }
            else {
                document.getElementById("content-14").style.display = "none";
                shopCurrencyText.parentElement.style.display = "none";
            }


        }
    }

}

function buyTypeClick(type) {

    if (type == "Eligma") {
        document.getElementById('option-shop').checked = false;
    }
    else if (type == "Shop") {
        document.getElementById('option-eligma').checked = false;
    }

    populateCharResources(modalCharID);
}

function nodeRefreshClick() {

    if (document.getElementById('input_allow_node_refresh').checked) {
        sweepMax = sweepMin * 2;
    }
    else {
        sweepMax = sweepMin;
    }

    document.getElementById('hard-nodes-count').innerText = "/ " + sweepMax;

    validateInput('Node_Sweeps');
}

function shopCostChange() {

    let cost = document.getElementById('input_eleph_cost').value;

    if (cost == 5) {
        document.getElementById('label-eleph-purchasable').style.visibility = 'hidden';
        document.getElementById('input_eleph_purchasable').style.visibility = 'hidden';
    }
    else {
        document.getElementById('label-eleph-purchasable').style.visibility = '';
        document.getElementById('input_eleph_purchasable').style.visibility = '';
    }
}

function starClicked(type, mode, pos) {

    let charData = charDataFromModal(modalCharID);

    if (mode == "current" && charData.eleph?.unlocked == false) {

        let message = GetLanguageString("text-characterrequireobtained");

        if (Date.now() > toastCooldownTime || toastCooldownMsg != message) {

            toastCooldownTime = Date.now() + 1000 * 10;
            toastCooldownMsg = message;

            Swal.fire({
                toast: true,
                position: 'top-end',
                title: GetLanguageString("text-invalidinput"),
                text: message,
                color: alertColour,
                showConfirmButton: false,
                timer: 4000
            })
        }

        return;
    }

    var charInfoObj = charlist[modalCharID];

    pos = parseInt(pos);

    if (mode == "current") {
        if (type == "star") {
            if (pos >= charInfoObj.StarGrade && pos != modalStars.star) {
                modalStars.star = pos;

                if (pos > modalStars.star_target) {
                    modalStars.star_target = pos;
                }

                if (modalStars.star < 5) {
                    modalStars.ue = 0;
                }
            }
        }
        else if (type == "ue") {
            if (pos <= ueStarCap) {
                if (pos == 1 && modalStars.ue == 1) {
                    modalStars.ue = 0;
                }
                else {
                    modalStars.ue = pos;

                    if (pos > modalStars.ue_target) {
                        modalStars.ue_target = pos;
                    }

                    if (modalStars.star_target != 5) {
                        modalStars.star_target = 5;
                    }

                    if (modalStars.star != 5) {
                        modalStars.star = 5;
                    }
                }
            }
        }
    }
    else if (mode == "target") {
        if (type == "star") {
            if (pos >= charInfoObj.StarGrade && pos >= modalStars.star && pos != modalStars.star_target) {
                modalStars.star_target = pos;

                if (pos < 5) {
                    modalStars.ue = 0;
                    modalStars.ue_target = 0;
                }
            }
        }
        else if (type == "ue") {
            if (pos <= ueStarCap && pos >= modalStars.ue) {
                if (pos == 1 && modalStars.ue_target == 1) {
                    modalStars.ue_target = 0;
                }
                else {
                    modalStars.ue_target = pos;

                    if (modalStars.star_target != 5) {
                        modalStars.star_target = 5;
                    }
                }
            }
        }
    }

    if (modalStars.ue >= 3) {

        let terrain = charInfoObj.Weapon.AdaptationType;
        let boostAmt = charInfoObj.Weapon.AdaptationValue;

        document.getElementById('mood-' + GetOldTerrain(terrain)).src = "icons/Mood/Mood_" + boostedMood(GetMoodFromAdaptation(charInfoObj[terrain + "BattleAdaptation"]), boostAmt) + ".png";
    }
    else {

        let terrain = charInfoObj.Weapon.AdaptationType;

        document.getElementById('mood-' + GetOldTerrain(terrain)).src = "icons/Mood/Mood_" + GetMoodFromAdaptation(charInfoObj[terrain + "BattleAdaptation"]) + ".png";
    }

    updateStarDisplays(modalCharID, true);
    updateTooltip(modalCharID, "passive");
    populateCharResources(modalCharID);
}

function cancelCharModal() {
    closeModal(true);
}

function updateStarDisplays(charId, fromTemp) {

    updateStarDisplay("star-current-container", charId, "star-current", fromTemp);
    updateStarDisplay("star-target-container", charId, "star-target", fromTemp);
    updateStarDisplay("ue-current-container", charId, "ue-current", fromTemp);
    updateStarDisplay("ue-target-container", charId, "ue-target", fromTemp);

}

function UnloadStudentImgs() {

    let charImgs = $(".main-display-char .char-img");

    for (let i = 0; i < charImgs.length; i++) {
        if (charImgs[i].getAttribute("tempurl")) {
            continue;
        }
        charImgs[i].setAttribute("tempurl", charImgs[i].src);
        charImgs[i].src = strNullImage;
    }
}

function ReloadStudentImgs() {

    let charImgs = $(".main-display-char .char-img");

    for (let i = 0; i < charImgs.length; i++) {
        if (!charImgs[i].getAttribute("tempurl")) {
            continue;
        }
        charImgs[i].src = charImgs[i].getAttribute("tempurl");
        charImgs[i].removeAttribute("tempurl");
    }
}

function openResourceModal() {

    // APRIL FOOLS
    // if (document.getElementById("button-resources").classList.contains("april-fools-button")) {
    //     return;
    // }

    if (!loaded) {
        return;
    }

    let openDelay = 0;

    if (isIOS) {
        let test = document.getElementsByClassName("main-display-char");
        for (let i = 0; i < test.length; i++) {
            test[i].style.display = "none";
        }

        UnloadStudentImgs();

        document.getElementById("table-parent-1").style.display = "none";
        document.getElementById("table-parent-2").style.display = "none";
        document.getElementById("table-parent-3").style.display = "none";
        document.getElementById("other-resource-wrapper").style.display = "none";

        openDelay = 2500;
    }

    let modal = document.getElementById("resourceModal");

    modalOpen = "resourceModal";

    freezeBody(true);

    setTimeout(() => {
        modal.style.visibility = "visible";

        if (isIOS) {
            setTimeout(() => {
                document.getElementById("table-parent-1").style.display = "";
            }, 1000);
            setTimeout(() => {
                document.getElementById("table-parent-2").style.display = "";
            }, 2000);
            setTimeout(() => {
                document.getElementById("table-parent-3").style.display = "";
            }, 3000);
            setTimeout(() => {
                document.getElementById("other-resource-wrapper").style.display = "";
                hideEmpty();
            }, 4000);
        }

        updateAggregateCount();

        if (resourceDisplay == "Remaining") {
            updateCells(neededMatDict, false, 'resource-count-text', 'misc-resource');
            hideResourceDisplays();
        }
        else if (resourceDisplay == "Owned") {
            updateCells(ownedMatDict, true, 'resource-count-text', 'misc-resource');
        }
        else if (resourceDisplay == "Total") {
            updateCells(requiredMatDict, false, 'resource-count-text', 'misc-resource');
        }
        else if (resourceDisplay == "Leftover") {
            updateCells(leftoverMatDict, false, 'resource-count-text', 'misc-resource');
        }

        modal.onclick = function (event) {
            if (event.target == modal) {
                closeResourceModal();
            }
        };

        gtag('event', 'modal_view', {
            'event_label': 'resource',
            'modal_name': 'resource'
        })

        hideEmpty();
        hideResourceDisplays();
    }, openDelay);

}

function hideResourceDisplays() {
    let raidTokenDisplay = document.getElementById("RaidTokenCost");
    let rareRaidTokenDisplay = document.getElementById("RareRaidTokenCost");
    let eligmaDisplay = document.getElementById("Eligma");
    let arenaCoinDisplay = document.getElementById("ArenaCoinCost");
    let jeCoinDisplay = document.getElementById("JECoinCost");
    let masteryCertDisplay = document.getElementById("MasteryCertificateCost");

    raidTokenDisplay.parentElement.style.display = ""
    rareRaidTokenDisplay.parentElement.style.display = "";
    eligmaDisplay.parentElement.style.display = "";
    arenaCoinDisplay.parentElement.style.display = "";
    jeCoinDisplay.parentElement.style.display = "";
    masteryCertDisplay.parentElement.style.display = "";

    if (raidTokenDisplay.innerText == "0") {
        raidTokenDisplay.parentElement.style.display = "none";
    }
    if (rareRaidTokenDisplay.innerText == "0") {
        rareRaidTokenDisplay.parentElement.style.display = "none";
    }
    if (eligmaDisplay.innerText == "0") {
        eligmaDisplay.parentElement.style.display = "none";
    }
    if (arenaCoinDisplay.innerText == "0") {
        arenaCoinDisplay.parentElement.style.display = "none";
    }
    if (jeCoinDisplay.innerText == "0") {
        jeCoinDisplay.parentElement.style.display = "none";
    }
    if (masteryCertDisplay.innerText == "0") {
        masteryCertDisplay.parentElement.style.display = "none";
    }
}

function openGearModal() {
    // APRIL FOOLS
    // if (document.getElementById("button-gear").classList.contains("april-fools-button")) {
    //     return;
    // }

    if (!loaded) {
        return;
    }

    let openDelay = 0;

    if (isIOS) {
        let test = document.getElementsByClassName("main-display-char");
        for (let i = 0; i < test.length; i++) {
            test[i].style.display = "none";
        }

        UnloadStudentImgs();

        openDelay = 2500;
    }

    let modal = document.getElementById("gearModal");

    modalOpen = "gearModal";

    freezeBody(true);

    setTimeout(() => {
        modal.style.visibility = "visible";

        if (isIOS) {
            setTimeout(() => {
                hideEmptyGear();
            }, 1000);
        }

        updateAggregateCount();

        if (gearDisplay == "Remaining") {
            updateCells(neededMatDict, false, 'gear-count-text', 'misc-gear');
        }
        else if (gearDisplay == "Owned") {
            updateCells(ownedMatDict, true, 'gear-count-text', 'misc-gear');
        }
        else if (gearDisplay == "Total") {
            updateCells(requiredMatDict, false, 'gear-count-text', 'misc-gear');
        }
        else if (gearDisplay == "Leftover") {
            updateCells(leftoverMatDict, false, "gear-count-text", "misc-gear");
        }

        updateCells(ownedMatDict, true, 'ue-count-text', 'abrakadabra');
        updateUeXP();
        document.getElementById("leftover-xp").innerText = commafy(CalculateLeftoverGearXp());

        SolveGearFarm();

        modal.onclick = function (event) {
            if (event.target == modal) {
                closeGearModal();
            }
        };

        gtag('event', 'modal_view', {
            'event_label': 'gear',
            'modal_name': 'gear'
        })

        hideEmptyGear();
    }, openDelay);

}

function openTransferModal() {
    // APRIL FOOLS
    // if (document.getElementById("button-transfer").classList.contains("april-fools-button")) {
    //     return;
    // }

    if (document.getElementById("characterMultiSelectContainer").style.display != "none") {
        return;
    }

    freezeBody(true);

    modalOpen = "transferModal";

    let modal = document.getElementById("transferModal");

    updateLoginButtons();

    modal.style.visibility = "visible";

    modal.onclick = function (event) {
        if (event.target == modal) {
            closeTransferModal();
        }
    };

}

function updateCells(dict, editable, cellClass, miscClass) {

    let cellElements = document.getElementsByClassName(cellClass);

    for (i = 0; i < cellElements.length; i++) {

        let mat = cellElements[i].id;
        let matId = matLookup.revGet(mat);

        if (matId) {
            updateMatDisplay(mat, dict[matId] ?? 0, editable, 'normal');
        }
        else if (dict[mat] != undefined) {
            updateMatDisplay(mat, dict[mat], editable, 'normal');
        }
        else {
            updateMatDisplay(mat, 0, editable, 'normal');
        }

    }

    cellElements = document.getElementsByClassName(miscClass);

    for (i = 0; i < cellElements.length; i++) {

        let mat = cellElements[i].id;
        let matId = matLookup.revGet(mat);

        if (matId) {
            updateMatDisplay(mat, dict[matId] ?? 0, editable, 'misc');
        }
        else {
            updateMatDisplay(mat, dict[mat] ?? 0, editable, 'misc');
        }

    }

}

function updateMatDisplay(matName, matValue, editable, type) {

    if (type == 'misc') {
        var textElement = document.getElementById(matName);
        var inputElement = document.getElementById("input-" + matName);
        textElement.innerText = commafy(matValue);
        if (inputElement != null) {
            inputElement.value = matValue;
        }
    }
    else {
        var textElement = document.getElementById(matName);
        var inputElement = document.getElementById("input-" + matName);
        if (matValue == 0) {
            textElement.innerText = '';
        }
        else {
            textElement.innerText = matValue;
        }
        inputElement.value = textElement.innerText;
        if (editable || matName.includes("XP_")) {
            textElement.parentElement.classList.add("editable");
        }
        else {
            textElement.parentElement.classList.remove("editable")
        }
    }
}

function closeResourceModal() {

    freezeBody(false);

    HidePopup();

    var modal = document.getElementById("resourceModal");

    modal.style.visibility = "hidden";

    modalOpen = "";

    if (isIOS) {
        let test = document.getElementsByClassName("main-display-char");
        for (let i = 0; i < test.length; i++) {
            test[i].style.display = "";
        }

        ReloadStudentImgs();
    }

}

function closeGearModal() {

    freezeBody(false);

    HidePopup();
    HideStagesPopup();

    var modal = document.getElementById("gearModal");

    modal.style.visibility = "hidden";

    modalOpen = "";

    if (isIOS) {
        let test = document.getElementsByClassName("main-display-char");
        for (let i = 0; i < test.length; i++) {
            test[i].style.display = "";
        }

        ReloadStudentImgs();
    }

}

function closeTransferModal() {

    freezeBody(false);

    var modal = document.getElementById("transferModal");

    modal.style.visibility = "hidden";

    modalOpen = "";
}

function updateLoginButtons() {

    if (!gUsername) {
        document.getElementById('transfer-login-button').style.visibility = "";
    }

    let lUsername = document.getElementById('input-transfer-username').value;
    let lAuthkey = document.getElementById('input-transfer-authkey').value;

    if (!lUsername || lUsername.length < 5 || lUsername.length > 20 || lUsername != gUsername ||
        !lAuthkey || lAuthkey.length != 6 || lAuthkey != gAuthkey) {
        document.getElementById('transfer-save-button').disabled = true;
        document.getElementById('transfer-load-button').disabled = true;
    }
    else {
        document.getElementById('transfer-save-button').disabled = false;
        document.getElementById('transfer-load-button').disabled = false;
    }

    if ((lUsername == gUsername && lAuthkey == gAuthkey) || lUsername.length < 5 || lUsername.length > 20 || lAuthkey.length != 6) {
        document.getElementById('transfer-login-button').disabled = true;
    }
    else {
        document.getElementById('transfer-login-button').disabled = false;
    }

    if (!gAuthkey && lAuthkey) {
        document.getElementById('transfer-register-button').disabled = true;
    }
    else if (!gAuthkey && !lAuthkey) {
        document.getElementById('transfer-register-button').disabled = false;
    }

}

function registerClick() {

    let lUsername = document.getElementById('input-transfer-username').value;

    if (!lUsername || lUsername.length < 5 || lUsername.length > 20) {
        Swal.fire({
            icon: 'error',
            title: GetLanguageString("text-oops"),
            text: GetLanguageString("text-usernamelength"),
            color: alertColour
        })
    }
    else if (!gAuthkey && !gUsername) {
        registerRequest(lUsername);
        document.getElementById('transfer-register-button').style.visibility = "hidden";
    }
}

function loginClick() {

    let lUsername = document.getElementById('input-transfer-username').value;
    let lAuthkey = document.getElementById('input-transfer-authkey').value;

    if (Date.now() > loadCooldown) {

        if (lUsername && lAuthkey && lUsername.length >= 5 && lUsername.length <= 20 && lAuthkey.length == 6) {

            loadCooldown = Date.now() + (2 * 60 * 1000 + 10000);
            loadRequest(true, true);
        }
        else {
            // Swal.fire({
            //     icon: 'error',
            //     title: GetLanguageString("text-oops"),
            //     text: GetLanguageString("text-usernamelengthauthkey"),
            //     color: alertColour
            // })
        }
    }
    else {
        Swal.fire({
            icon: 'error',
            title: GetLanguageString("text-oops"),
            text: GetLanguageString("text-toosoontryagain") + timeUntil(loadCooldown),
            color: alertColour
        })
    }


}

function saveClick() {

    if (Date.now() > saveCooldown) {
        saveRequest(true);
        saveCooldown = Date.now() + (2 * 60 * 1000 + 10000);
    }
    else {
        Swal.fire({
            icon: 'error',
            title: GetLanguageString("text-oops"),
            text: GetLanguageString("text-toosoontryagain") + timeUntil(saveCooldown),
            color: alertColour
        })
    }

}

function loadClick() {

    if (Date.now() > loadCooldown) {
        loadRequest(true, false);
        loadCooldown = Date.now() + (2 * 60 * 1000 + 10000);
    }
    else {
        Swal.fire({
            icon: 'error',
            title: GetLanguageString("text-oops"),
            text: GetLanguageString("text-toosoontryagain") + timeUntil(loadCooldown),
            color: alertColour
        })
    }
}

function timeUntil(timeTarget) {

    let timeCurrent = Date.now();

    if (timeTarget > timeCurrent) {

        let diff = Math.floor((timeTarget - timeCurrent) / 1000);

        let mins = Math.floor(diff / 60);
        diff = diff - mins * 60;

        let resultString = "";
        if (mins > 0) {
            resultString += mins + "m";
        }
        if (diff > 0) {
            resultString += diff + "s";
        }

        if (resultString == "") {
            resultString = "0s";
        }

        return resultString;
    }
    else {
        return "0s";
    }
}

// function getCharByID(id) {

//     for (i = 0; i < data.characters.length; i++) {
//         if (data.characters[i].id == parseInt(id)) {
//             return data.characters[i].name;
//         }
//     }
// }

function hideEmpty() {

    var resourceTable = document.getElementById("school-mat-table");
    var artifactTable1 = document.getElementById("artifact-table-1");
    var artifactTable2 = document.getElementById("artifact-table-2");

    hideEmptyCells(resourceTable);
    hideEmptyCells(artifactTable1);
    hideEmptyCells(artifactTable2);

    hideEmptyCell("XP_1");
    hideEmptyCell("XP_2");
    hideEmptyCell("XP_3");
    hideEmptyCell("XP_4");
}

function hideEmptyGear() {

    var gearTable = document.getElementById('gear-table');

    hideEmptyCells(gearTable);

    hideEmptyCell("GXP_1");
    hideEmptyCell("GXP_2");
    hideEmptyCell("GXP_3");
    hideEmptyCell("GXP_4");

    let ueTable = document.getElementById('ue-table');

    hideEmptyCells(ueTable);
}

function hideEmptyCells(table) {
    var rows = table.children[0].children.length;
    var cols = table.children[0].children[0].children.length;

    for (row = 0; row < rows; row++) {
        for (col = 1; col < cols; col++) {
            if (!table.children[0].children[row].children[col].children[1]) {
                continue;
            }

            if (table.children[0].children[row].children[col].children[1].innerText == "") {

                table.children[0].children[row].children[col].classList.add("empty-resource");
            }
            else {

                table.children[0].children[row].children[col].classList.remove("empty-resource");
            }
        }
    }
}

function hideEmptyCell(id) {
    var textElement = document.getElementById(id);
    if (textElement.innerText == "") {
        textElement.parentElement.classList.add("empty-resource");
    }
    else {
        textElement.parentElement.classList.remove("empty-resource");
    }
}

function createTable(id, columns, colOffset, rows, rowOffset, tableNavigation, parent, reorder, type, imgLoc, skip, stringLangPrefix) {

    const newTable = document.createElement("table");
    newTable.className = "resource-table";
    newTable.id = id;

    const newTbody = document.createElement("tbody");

    //var cellId = 0;

    for (row = 0; row < rows.length; row++) {
        const newRow = document.createElement("tr");
        newRow.id = "row-" + rows[row];

        if (!tableNavigation[row + rowOffset]) {
            tableNavigation[row + rowOffset] = [];
        }

        for (col = 0; col < columns.length + 1; col++) {
            const newCell = document.createElement("td");

            let cellCombination = "";
            if (reorder) {
                cellCombination = rows[row] + "_" + columns[col - 1];
            }
            else {
                cellCombination = columns[col - 1] + "_" + rows[row];
            }

            if (col == 0) {
                if (language != "En" && language != "Kr" && language != "Th" && language != "Jp" && language != "Cn") {
                    let localisedName = mLocalisations[language]?.Data[rows[row].replace(/ /g, '')];
                    if (localisedName) {
                        newCell.innerText = localisedName;
                    }
                    else {
                        newCell.innerText = rows[row];
                    }
                }
                else {
                    newCell.innerText = GetLanguageString(stringLangPrefix + rows[row].toLowerCase().replace(/ /g, ''));
                }
                newCell.style.paddingLeft = "8px";
            }
            else if (!(skip && skip.includes(cellCombination))) {
                const newImg = document.createElement("img");
                newImg.draggable = false;
                newImg.className = type + "-icon";
                newImg.loading = "lazy";
                if (reorder) {
                    newImg.src = (imgLoc + rows[row] + "_" + columns[col - 1] + "_small.webp").replace(/ /g, '');
                }
                else {
                    newImg.src = (imgLoc + columns[col - 1] + "_" + rows[row] + "_small.webp").replace(/ /g, '');
                }

                const newP = document.createElement("p");
                newP.className = type + "-count-text";
                //newP.id = id + "-p_" + cellId;
                if (reorder) {
                    newP.id = (rows[row] + "_" + columns[col - 1]).replace(/ /g, '');
                }
                else {
                    newP.id = (columns[col - 1] + "_" + rows[row]).replace(/ /g, '');
                }

                let matFound = matLookup.reverseMap[newP.id];
                if (matFound) {
                    newCell.id = "mat-" + matFound;
                }
                else {
                    newCell.id = "mat-" + newP.id;
                }

                newCell.addEventListener('click', (event) => {
                    DisplayMatUsers(event.currentTarget.id);
                })

                const newInput = document.createElement("input");
                newInput.className = "resource-input";
                newInput.type = "number";
                //newInput.min = "0";
                //newInput.max = "10000";
                //newInput.id = id + "-input_" + cellId;
                newInput.onchange = updatedResource;
                newInput.addEventListener('focusin', (event) => {
                    event.target.className = "resource-input focused";
                    event.target.parentElement.classList.add("focused");
                })
                newInput.addEventListener('focusout', (event) => {
                    event.target.className = "resource-input";
                    event.target.parentElement.classList.remove("focused");
                })
                if (reorder) {
                    newInput.id = ("input-" + rows[row] + "_" + columns[col - 1]).replace(/ /g, '');
                }
                else {
                    newInput.id = ("input-" + columns[col - 1] + "_" + rows[row]).replace(/ /g, '');
                }
                if (matLookup.revGet(newP.id)) {
                    tableNavigation[row + rowOffset][col + colOffset] = newInput.id;
                }
                else if (gearLookup.includes(newP.id)) {
                    tableNavigation[row + rowOffset][col + colOffset] = newInput.id;
                }

                newCell.appendChild(newImg);
                newCell.appendChild(newP);
                newCell.appendChild(newInput);

                //cellId++;
            }

            newRow.appendChild(newCell);
        }

        newTbody.appendChild(newRow);
    }

    newTable.appendChild(newTbody);
    parent.appendChild(newTable);

}

function updatedResource() {

    var newCount = this.value;
    var matName = this.id.substring(6);
    var textElement = document.getElementById(matName);

    var nonCentred = false;
    if (textElement.classList.contains('misc-resource')) {
        nonCentred = true;
    }

    let isUEinput = false;
    if (textElement.classList.contains('ue-count-text')) {
        isUEinput = true;
    }

    if (newCount == 0 && (!nonCentred)) {
        this.value = 0;
        this.parentElement.classList.add("empty-resource");
        if (textElement != null) {
            textElement.innerText = '';
        }
        newCount = 0;
    }
    else if (newCount == 0 && nonCentred) {
        this.value = 0;
        textElement.innerText = '0';
        newCount = 0;
    }
    else if (newCount) {
        this.parentElement.classList.remove("empty-resource");
        if (textElement != null) {
            if (nonCentred) {
                textElement.innerText = commafy(newCount);
            }
            else {
                textElement.innerText = newCount;
            }
        }
    }

    let dictKey = matLookup.revGet(matName) ?? matName;
    ownedMatDict[dictKey] = newCount;

    if (dictKey.substring(0, 3) == "XP_") {
        updateXP();
        updateMatDisplay('Xp', ownedMatDict['Xp'], false, 'misc');
    }
    else if (dictKey.substring(0, 4) == "GXP_") {
        updateGearXP();
        updateMatDisplay('GearXp', ownedMatDict['GearXp'], false, 'misc');
    }
    else {
        updateNeededMat(dictKey);
        updateLeftoverMat(dictKey);
    }

    if (isUEinput) {
        updateUeXP();
    }

    if (gearLookup.includes(matName)) {
        document.getElementById("leftover-xp").innerText = commafy(CalculateLeftoverGearXp());
    }

    saveTime = Date.now() + (1000 * 5);
}

function DisplayMatUsers(mat) {

    if (resourceDisplay == "Owned" && modalOpen == "resourceModal" || gearDisplay == "Owned" && modalOpen == "gearModal") {
        return;
    }

    let matId = mat;
    if (mat.substring(0, 4) == "mat-") {
        matId = mat.substring(4);
    }
    let matUsers = [];

    for (key in charMatDicts) {
        if (!disabledChars.includes(key) && charMatDicts[key][matId] > 0) {
            matUsers.push({ "charId": key, "matCount": charMatDicts[key][matId] });
        }
    }

    if (matUsers.length == 0) {
        return;
    }

    matUsers = matUsers.sort(function (a, b) { return parseFloat(b.matCount) - parseFloat(a.matCount); })

    let wrapperDiv = document.getElementById('popup-wrapper');
    let wrapperChildren = wrapperDiv.children;
    while (wrapperChildren.length > 0) {
        wrapperChildren[0].remove();
    }

    for (let i = 0; i < matUsers.length; i++) {

        let charDiv = document.createElement('div');
        charDiv.className = "char-row-mats";

        let charImg = document.createElement('img');
        charImg.src = "icons/Portrait/Icon_" + matUsers[i].charId + ".webp";
        if (aprilFools) {
            charImg.src = "icons/Portrait/April/Icon_" + matUsers[i].charId + ".png";
        }

        let matAmount = document.createElement('p');
        matAmount.innerText = commafy(matUsers[i].matCount);

        charDiv.appendChild(charImg);
        charDiv.appendChild(matAmount);

        wrapperDiv.appendChild(charDiv);
    }

    if (mat == "9999") {
        mat = 'Secret';
    }

    let element = document.getElementById(mat);
    if (element.tagName.toLowerCase() == 'p') {
        element = element.parentElement;
    }

    let matOffset = getOffset(element);

    if (matOffset.left > (window.innerWidth / 2)) {
        wrapperDiv.style.right = (window.innerWidth - Math.round(matOffset.left) - 10) + "px";
        wrapperDiv.style.left = "";
    }
    else {
        wrapperDiv.style.left = (20 + Math.round(matOffset.left)) + "px";
        wrapperDiv.style.right = "";
    }

    if (matOffset.top > (window.innerHeight / 2)) {
        wrapperDiv.style.bottom = (document.body.clientHeight - Math.round(matOffset.top) - docScrollTop) + "px";
        wrapperDiv.style.top = "";
    }
    else {
        wrapperDiv.style.top = (20 + Math.round(matOffset.top) + docScrollTop) + "px";
        wrapperDiv.style.bottom = "";
    }

    HideStagesPopup();
    wrapperDiv.style.display = "";
    closableAfter = Date.now() + 200;

}

function HidePopup() {
    document.getElementById('popup-wrapper').style.display = 'none';
    closableAfter = 0;
}

function DisplayStageRuns() {

    if (OptimalStageRuns.length < 1) {
        return;
    }

    let wrapperDiv = document.getElementById('stages-popup-wrapper');
    let wrapperChildren = wrapperDiv.children;
    while (wrapperChildren.length > 0) {
        wrapperChildren[0].remove();
    }

    let disclaimerDiv = document.createElement('div');
    disclaimerDiv.className = "stage-disclaimer";

    let disclaimerP = document.createElement('p');
    disclaimerP.innerText = GetLanguageString("text-farmenergyinfo");

    let disclaimerP2 = document.createElement('p');
    disclaimerP2.innerText = GetLanguageString("text-farmenergyinfo2");
    disclaimerP2.style.marginTop = "15px";

    disclaimerDiv.appendChild(disclaimerP);
    disclaimerDiv.appendChild(disclaimerP2);
    wrapperDiv.appendChild(disclaimerDiv);

    for (let i = 0; i < OptimalStageRuns.length; i++) {

        let stageDiv = document.createElement('div');
        stageDiv.className = "stage-run";

        let stageName = document.createElement('p');
        if (OptimalStageRuns[i].stage.length == 4) {
            stageName.innerText = OptimalStageRuns[i].stage;
        }
        else {
            stageName.innerText = OptimalStageRuns[i].stage + "  ";
        }
        stageName.classList.add("stage-run-name");

        let stageRuns = document.createElement('p');
        stageRuns.innerText = commafy(OptimalStageRuns[i].runs) + " runs"

        stageDiv.appendChild(stageName);
        stageDiv.appendChild(stageRuns);

        wrapperDiv.appendChild(stageDiv);
    }

    let element = document.getElementById("ap-display-wrapper");

    let elOffset = getOffset(element);

    if (elOffset.left > (window.innerWidth / 2)) {
        wrapperDiv.style.right = (window.innerWidth - Math.round(elOffset.left) - 10) + "px";
        wrapperDiv.style.left = "";
    }
    else {
        wrapperDiv.style.left = (20 + Math.round(elOffset.left)) + "px";
        wrapperDiv.style.right = "";
    }

    wrapperDiv.style.top = (100 + docScrollTop) + "px";

    // if (elOffset.top > (window.innerHeight / 2)) {
    //     wrapperDiv.style.bottom = (document.body.clientHeight - Math.round(elOffset.top)) + "px";
    //     wrapperDiv.style.top = "";
    // }
    // else {
    //     wrapperDiv.style.top = (20 + Math.round(elOffset.top)) + "px";
    //     wrapperDiv.style.bottom = "";
    // }

    HidePopup();
    wrapperDiv.style.display = "";
    closableAfter = Date.now() + 200;
}

function HideStagesPopup() {
    document.getElementById('stages-popup-wrapper').style.display = 'none';
    closableAfter = 0;
}

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

function SetMultiplier(multi) {
    campaignMultiplier = multi;
    SolveGearFarm();
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

function updateXP() {

    var xpOwned = parseInt(ownedMatDict["XP_1"] ?? 0) * 50 + parseInt(ownedMatDict["XP_2"] ?? 0) * 500 +
        parseInt(ownedMatDict["XP_3"] ?? 0) * 2000 + parseInt(ownedMatDict["XP_4"] ?? 0) * 10000;

    ownedMatDict["Xp"] = xpOwned;
    if (requiredMatDict["Xp"] != undefined) {
        neededMatDict["Xp"] = Math.max(requiredMatDict["Xp"] - xpOwned, 0);
    }
    else {
        neededMatDict["Xp"] = 0;
    }

    leftoverMatDict["Xp"] = Math.max(xpOwned - (requiredMatDict["Xp"] ?? 0), 0);
}

function updateGearXP() {

    var gxpOwned = parseInt(ownedMatDict["GXP_1"] ?? 0) * 90 + parseInt(ownedMatDict["GXP_2"] ?? 0) * 360 +
        parseInt(ownedMatDict["GXP_3"] ?? 0) * 1440 + parseInt(ownedMatDict["GXP_4"] ?? 0) * 5760;

    ownedMatDict["GearXp"] = gxpOwned;
    if (requiredMatDict["GearXp"] != undefined) {
        neededMatDict["GearXp"] = Math.max(requiredMatDict["GearXp"] - gxpOwned, 0);
    }
    else {
        neededMatDict["GearXp"] = 0;
    }

    leftoverMatDict["GearXp"] = Math.max(gxpOwned - (requiredMatDict["GearXp"] ?? 0), 0);
}

function updateUeXP() {

    let springXP = getTotalUeOfType("Spring");
    let hammerXP = getTotalUeOfType("Hammer");
    let barrelXP = getTotalUeOfType("Barrel");
    let needleXP = getTotalUeOfType("Needle");

    let springMin = document.getElementById('spring-min');
    let hammerMin = document.getElementById('hammer-min');
    let barrelMin = document.getElementById('barrel-min');
    let needleMin = document.getElementById('needle-min');
    let totalMin = document.getElementById('total-min');
    let springBonus = document.getElementById('spring-bonus');
    let hammerBonus = document.getElementById('hammer-bonus');
    let barrelBonus = document.getElementById('barrel-bonus');
    let totalBonus = document.getElementById('total-bonus');

    springMin.innerText = commafy(springXP);
    hammerMin.innerText = commafy(hammerXP);
    barrelMin.innerText = commafy(barrelXP);
    needleMin.innerText = commafy(needleXP * 1.5);
    springBonus.innerText = commafy(springXP * 0.5);
    hammerBonus.innerText = commafy(hammerXP * 0.5);
    barrelBonus.innerText = commafy(barrelXP * 0.5);

    totalMin.innerText = commafy(springXP + hammerXP + barrelXP + (needleXP * 1.5));
    totalBonus.innerText = commafy((springXP + hammerXP + barrelXP) * 0.5);

    let springOwned = document.getElementById('owned-spring');
    let springNeeded = document.getElementById('total-needed-spring');
    let springRemaining = document.getElementById('remaining-needed-spring');
    let hammerOwned = document.getElementById('owned-hammer');
    let hammerNeeded = document.getElementById('total-needed-hammer');
    let hammerRemaining = document.getElementById('remaining-needed-hammer');
    let barrelOwned = document.getElementById('owned-barrel');
    let barrelNeeded = document.getElementById('total-needed-barrel');
    let barrelRemaining = document.getElementById('remaining-needed-barrel');
    let needleOwned = document.getElementById('owned-needle');
    let needleNeeded = document.getElementById('total-needed-needle');
    let needleRemaining = document.getElementById('remaining-needed-needle');

    springOwned.innerText = commafy(springXP * 1.5);
    hammerOwned.innerText = commafy(hammerXP * 1.5);
    barrelOwned.innerText = commafy(barrelXP * 1.5);
    needleOwned.innerText = commafy(needleXP * 1.5);

    springNeeded.innerText = commafy(neededMatDict["Spring_Xp"] ?? 0);
    hammerNeeded.innerText = commafy(neededMatDict["Hammer_Xp"] ?? 0);
    barrelNeeded.innerText = commafy(neededMatDict["Barrel_Xp"] ?? 0);

    let springRemNeed = Math.max((neededMatDict["Spring_Xp"] ?? 0) - (springXP * 1.5), 0);
    let hammerRemNeed = Math.max((neededMatDict["Hammer_Xp"] ?? 0) - (hammerXP * 1.5), 0);
    let barrelRemNeed = Math.max((neededMatDict["Barrel_Xp"] ?? 0) - (barrelXP * 1.5), 0);

    springRemaining.innerText = commafy(springRemNeed);
    hammerRemaining.innerText = commafy(hammerRemNeed);
    barrelRemaining.innerText = commafy(barrelRemNeed);

    let needleNeed = springRemNeed + hammerRemNeed + barrelRemNeed;

    needleNeeded.innerText = commafy(needleNeed) + "*";

    let needleRemNeed = Math.max(needleNeed - (needleXP * 1.5), 0);

    needleRemaining.innerText = commafy(needleRemNeed);

    let allOwned = document.getElementById('owned-all');
    let allNeeded = document.getElementById('total-needed-all');
    let allRemaining = document.getElementById('remaining-needed-all');

    allNeeded.innerText = commafy(needleRemNeed);

    let remOwned = Math.max(Math.floor(((springXP * 1.5) - (neededMatDict["Spring_Xp"] ?? 0)) / 3 * 2), 0) +
        Math.max(Math.floor(((hammerXP * 1.5) - (neededMatDict["Hammer_Xp"] ?? 0)) / 3 * 2), 0) +
        Math.max(Math.floor(((barrelXP * 1.5) - (neededMatDict["Barrel_Xp"] ?? 0)) / 3 * 2), 0) +
        Math.max(((needleXP * 1.5) - needleNeed), 0);

    allOwned.innerText = commafy(remOwned) + "*";

    allRemaining.innerText = commafy(Math.max(needleRemNeed - remOwned, 0));

}

function getTotalUeOfType(type) {
    return parseInt(ownedMatDict["T4_" + type] ?? 0) * 1000 + parseInt(ownedMatDict["T3_" + type] ?? 0) * 200
        + parseInt(ownedMatDict["T2_" + type] ?? 0) * 50 + parseInt(ownedMatDict["T1_" + type] ?? 0) * 10;
}

function updateNeededMat(mat) {
    neededMatDict[mat] = Math.max((requiredMatDict[mat] ?? 0) - (ownedMatDict[mat] ?? 0), 0);
}

function updateLeftoverMat(mat) {
    leftoverMatDict[mat] = Math.max((ownedMatDict[mat] ?? 0) - (requiredMatDict[mat] ?? 0), 0);
}

function calculateCharResources(charData, output) {

    let charMatDict = {};

    let charId = charData.id.toString();
    let charObj = charlist[charId];

    calcSkillCost(charObj, "ex", charData.current?.ex, charData.target?.ex, charMatDict);
    calcSkillCost(charObj, "normal", charData.current?.basic, charData.target?.basic, charMatDict);
    calcSkillCost(charObj, "passive", charData.current?.passive, charData.target?.passive, charMatDict);
    calcSkillCost(charObj, "sub", charData.current?.sub, charData.target?.sub, charMatDict);

    calcXpCost(charData.current?.level, charData.target?.level, charMatDict);

    calcGearCost(charObj, charData.current?.gear1, charData.target?.gear1, 1, charMatDict);
    calcGearCost(charObj, charData.current?.gear2, charData.target?.gear2, 2, charMatDict);
    calcGearCost(charObj, charData.current?.gear3, charData.target?.gear3, 3, charMatDict);

    calcMysticCost(charData.current?.star, charData.target?.star, charMatDict);

    calcUECost(charObj, charData.current?.ue, charData.target?.ue, charData.current?.ue_level, charData.target?.ue_level, charMatDict);

    let purchaseData = misc_data.shop_characters[charId];
    let currency, amount, cost, times;

    if (purchaseData) {
        if (typeof (purchaseData) == "object") {
            currency = purchaseData.currency;
            amount = purchaseData.amount;
            cost = purchaseData.cost;
            times = purchaseData.times;
        }
        else {
            currency = purchaseData;
            let currencyInfo = misc_data.shop_eleph[currency];
            amount = currencyInfo.amount;
            cost = currencyInfo.cost;
            times = currencyInfo.times;
        }
    }

    if ((charData.eleph?.unlocked === false) &&
        (["RaidToken", "RareRaidToken", "ArenaCoin", "JECoin"].includes(currency) || misc_data.hard_modes[charId])) {

        if (!charMatDict["Eleph"]) {
            charMatDict["Eleph"] = 0;
        }

        charMatDict["Eleph"] += misc_data.unlock_cost[charObj.StarGrade + "*"];
    }

    if (charMatDict["Eleph"] && charData.eleph?.owned > 0) {
        charMatDict["Eleph"] = Math.max(charMatDict["Eleph"] - charData.eleph?.owned, 0);
    }

    if (charData.eleph?.use_eligma && charMatDict["Eleph"]) {

        if (!charMatDict["Eligma"]) {
            charMatDict["Eligma"] = 0;
        }

        charMatDict["Eligma"] += ligma(charMatDict["Eleph"], charData.eleph?.cost, charData.eleph?.purchasable);
    }

    if (charData.eleph?.use_shop && charMatDict["Eleph"] && misc_data.shop_characters[charId]) {

        let purchasesTaken = Math.ceil(charMatDict["Eleph"] / amount);
        let currencyCost = purchasesTaken * cost;
        let resetsTaken = Math.ceil(purchasesTaken / times);

        charMatDict[currency + "Cost"] = currencyCost;
        charMatDict["ShopResets"] = resetsTaken;
    }

    if (misc_data.hard_modes[charId] && charMatDict["Eleph"]) {

        charMatDict["ShopResets"] = Math.ceil(charMatDict["Eleph"] / (charData.eleph?.farm_nodes * 0.4));
    }

    if (output) {
        return charMatDict;
    }
    else {
        charMatDicts[charId] = charMatDict;
    }

}

function calcSkillCost(characterObj, skill, current, target, matDict) {

    let skillMaterials, skillMaterialAmounts, skillType;

    if (skill == "ex") {
        skillMaterials = characterObj.SkillExMaterial;
        skillMaterialAmounts = characterObj.SkillExMaterialAmount;
        skillType = "ex";
    }
    else {
        skillMaterials = characterObj.SkillMaterial;
        skillMaterialAmounts = characterObj.SkillMaterialAmount;
        skillType = "other";
    }

    if (skillMaterials == undefined || skillMaterialAmounts == undefined) { return null; }

    let curLevel = parseInt(current);
    let tarLevel = parseInt(target);
    if (curLevel == 0 && tarLevel > 0) {
        curLevel = 1;
    }

    if (tarLevel == 10 && curLevel < 10) {
        if (!matDict["9999"]) {
            matDict["9999"] = 0;
        }

        matDict["9999"] += 1;
    }

    for (let s = curLevel; s < tarLevel; s++) {

        if (skillType != undefined) {

            if (!matDict["Credit"]) {
                matDict["Credit"] = 0;
            }

            matDict["Credit"] += misc_data.skill_credit_cost[skillType][s - 1];
        }

        let costObj = skillMaterials[s - 1];  // skillObj["Level" + s];
        if (costObj == undefined) {
            // console.log("Error: Skill Level data missing") // expand error later
            return null;
        }

        // let costObj = levelObj["LevelUpMats"];

        for (let i = 0; i < costObj.length; i++) {

            let item = costObj[i];

            if (item != undefined && skillMaterialAmounts[s - 1][i] != undefined) {

                if (!matDict[item]) {
                    matDict[item] = 0;
                }

                matDict[item] += skillMaterialAmounts[s - 1][i];
            }
        }
    }
}

function calcXpCost(level, levelTarget, matDict) {

    if (level && levelTarget) {
        var xpNeeded = Math.max(misc_data.level_xp[parseInt(levelTarget) - 1] - misc_data.level_xp[parseInt(level) - 1], 0);

        if (!matDict["Xp"]) {
            matDict["Xp"] = 0;
        }

        matDict["Xp"] += xpNeeded;

        if (!matDict["Credit"]) {
            matDict["Credit"] = 0;
        }

        matDict["Credit"] += xpNeeded * 7;
    }
}

function calcGearCost(charObj, gear, gearTarget, slotNum, matDict) {

    // need to also save gear xp later
    if ((gear || gear == 0) && gearTarget) {

        var gearObj = misc_data.cumulative_gear_cost["T" + gear];
        var targetGearObj = misc_data.cumulative_gear_cost["T" + gearTarget];

        if (gearObj && targetGearObj) {

            if ((gearObj.xp || gearObj.xp == 0) && targetGearObj.xp) {

                if (!matDict["GearXp"]) {
                    matDict["GearXp"] = 0;
                }

                matDict["GearXp"] += targetGearObj.xp - gearObj.xp;
            }

            if ((gearObj.credit || gearObj.credit == 0) && targetGearObj.credit) {

                if (!matDict["Credit"]) {
                    matDict["Credit"] = 0;
                }

                matDict["Credit"] += targetGearObj.credit - gearObj.credit;
            }

            if (charObj?.Equipment) {
                let gearName = charObj.Equipment[slotNum - 1];

                for (let i = 2; i <= 9; i++) {

                    let currentBP = gearObj["T" + i] ?? 0;
                    let targetBP = targetGearObj["T" + i];
                    let diff = targetBP - currentBP;

                    if (targetBP && (diff > 0)) {

                        if (!matDict["T" + i + "_" + gearName]) {
                            matDict["T" + i + "_" + gearName] = 0;
                        }

                        matDict["T" + i + "_" + gearName] += diff;
                    }
                }
            }
        }
    }

}

function calcMysticCost(star, starTarget, matDict) {

    if (star && starTarget) {

        let currentStar = misc_data.cumulative_mystic_cost[star + "*"];
        let targetStar = misc_data.cumulative_mystic_cost[starTarget + "*"];

        if (currentStar && targetStar) {

            if ((currentStar.credit || currentStar.credit == 0) && targetStar.credit) {

                if (!matDict["Credit"]) {
                    matDict["Credit"] = 0;
                }

                matDict["Credit"] += targetStar.credit - currentStar.credit;
            }

            if ((currentStar.eleph || currentStar.eleph == 0) && targetStar.eleph) {

                if (!matDict["Eleph"]) {
                    matDict["Eleph"] = 0;
                }

                matDict["Eleph"] += targetStar.eleph - currentStar.eleph
            }
        }
    }

}

function ligma(elephNeeded, elephCost, elephRemaining) {

    let ligmaNeeded = 0;

    while (elephCost < 5 && elephNeeded > 0) {

        let nextAmount = Math.min(elephRemaining, elephNeeded);
        if (nextAmount > 0) {
            elephNeeded -= nextAmount;
            ligmaNeeded += nextAmount * elephCost;
            elephCost++;
            elephRemaining = 20;
        }
        else {
            break;
        }
    }

    if (elephNeeded > 0) {
        ligmaNeeded += elephNeeded * 5;
    }

    return ligmaNeeded;

}

function calcUECost(charObj, star, starTarget, level, levelTarget, matDict) {

    if (star == 0) {
        star = 1;
    }

    if (level == 0) {
        level = 1;
    }
    if (levelTarget == 0) {
        levelTarget = 1;
    }

    if ((star) && starTarget) {

        let currentStar = misc_data.cumulative_mystic_cost["U" + star + "*"];
        let targetStar = misc_data.cumulative_mystic_cost["U" + starTarget + "*"];

        if (currentStar && targetStar) {

            if ((currentStar.credit || currentStar.credit == 0) && targetStar.credit) {

                if (!matDict["Credit"]) {
                    matDict["Credit"] = 0;
                }

                matDict["Credit"] += targetStar.credit - currentStar.credit;
            }

            if ((currentStar.eleph || currentStar.eleph == 0) && targetStar.eleph) {

                if (!matDict["Eleph"]) {
                    matDict["Eleph"] = 0;
                }

                matDict["Eleph"] += targetStar.eleph - currentStar.eleph
            }

        }
    }

    if ((level || level == 0) && levelTarget) {

        let currentXp = misc_data.ue_xp[level - 1];
        let targetXp = misc_data.ue_xp[levelTarget - 1];

        if ((currentXp || currentXp == 0) && targetXp) {

            let ue_xp_type = misc_data.gun_ue_category[charObj.WeaponType];

            if (!matDict[ue_xp_type + "_Xp"]) {
                matDict[ue_xp_type + "_Xp"] = 0;
            }

            matDict[ue_xp_type + "_Xp"] += targetXp - currentXp;

            if (!matDict["Credit"]) {
                matDict["Credit"] = 0;
            }

            matDict["Credit"] += (targetXp - currentXp) * 180;

        }

    }
}

function updateAggregateCount() {

    requiredMatDict = {};
    neededMatDict = {};

    for (charId in charMatDicts) {
        if (!disabledChars.includes(charId)) {
            for (matName in charMatDicts[charId]) {

                if (matName == "Xp") {
                    continue;
                }

                if (!requiredMatDict[matName]) {
                    requiredMatDict[matName] = 0;
                }

                requiredMatDict[matName] += charMatDicts[charId][matName];
            }

            let char = data.characters.find(obj => { return obj.id == charId });
            calcXpCost(char.current?.level, Math.min(char.target?.level, lvlCalcsCap), requiredMatDict);

            let checkCredit = {};
            calcXpCost(char.current?.level, char.target?.level, checkCredit);

            if (checkCredit.Credit > 0) {
                requiredMatDict["Credit"] -= checkCredit.Credit;
            }
        }
    }

    for (key in requiredMatDict) {
        updateNeededMat(key);
    }

    for (key in ownedMatDict) {
        updateLeftoverMat(key);
    }

    calculateRaidCoins();

    updateXP();

    updateGearXP();
}

function calculateRaidCoins() {

    let raidCoins = 0;

    for (key in neededMatDict) {
        if (key[0] == 3 && key.length == 4) {
            if (key[3] == 0) {
                raidCoins += 10 * neededMatDict[key];
            }
            else if (key[3] == 1) {
                raidCoins += 20 * neededMatDict[key];
            }
            else if (key[3] == 2) {
                raidCoins += 50 * neededMatDict[key];
            }
            else if (key[3] == 3) {
                raidCoins += 100 * neededMatDict[key];
            }
        }
        else if (key[0] == 4 && key.length == 4) {
            if (key[3] == 0) {
                raidCoins += 3 * neededMatDict[key];
            }
            else if (key[3] == 1) {
                raidCoins += 5 * neededMatDict[key];
            }
            else if (key[3] == 2) {
                raidCoins += 10 * neededMatDict[key];
            }
            else if (key[3] == 3) {
                raidCoins += 25 * neededMatDict[key];
            }
        }
        else if (key == "9999") {
            raidCoins += 500 * neededMatDict[key];
        }
    }

    if (!neededMatDict["RaidTokenCost"]) {
        neededMatDict["RaidTokenCost"] = 0;
    }

    neededMatDict["RaidTokenCost"] = raidCoins;

    for (charId in charMatDicts) {
        if (!disabledChars.includes(charId)) {

            if (charMatDicts[charId]["RaidTokenCost"]) {
                neededMatDict["RaidTokenCost"] += charMatDicts[charId]["RaidTokenCost"];
            }
        }
    }
}

function switchResourceDisplay(displayType) {

    // APRIL FOOLS
    // if (displayType == "Owned") {
    //     if (document.getElementById("switch-resource-owned").classList.contains("april-fools-button")) {
    //         return;
    //     }
    // }
    // else if (displayType == "Total") {
    //     if (document.getElementById("switch-resource-total").classList.contains("april-fools-button")) {
    //         return;
    //     }
    // }
    // else if (displayType == "Remaining") {
    //     if (document.getElementById("switch-resource-remaining").classList.contains("april-fools-button")) {
    //         return;
    //     }
    // }
    // else if (displayType == "Leftover") {
    //     if (document.getElementById("switch-resource-leftover").classList.contains("april-fools-button")) {
    //         return;
    //     }
    // }


    let btnOwned = document.getElementById("switch-resource-owned");
    let btnTotal = document.getElementById("switch-resource-total");
    let btnRemaining = document.getElementById("switch-resource-remaining");
    let btnLeftover = document.getElementById("switch-resource-leftover");
    let displayText = document.getElementById("current-resource-display");
    var raidTokenDisplay = document.getElementById("raid-token-display-wrapper");
    let rareRaidTokenDisplay = document.getElementById("rare-raid-token-display-wrapper");
    let eligmaDisplay = document.getElementById("eligma-display-wrapper");
    let arenaCoinDisplay = document.getElementById("arena-coin-display-wrapper");
    let jeCoinDisplay = document.getElementById("je-coin-display-wrapper");
    let masteryCertDisplay = document.getElementById("mastery-certificate-display-wrapper");
    var xpInputs = document.getElementById("xp-input-wrapper");
    var inputs = document.getElementsByClassName("input-wrapper");
    let btnLvlCap = document.getElementById("set-level-cap");

    raidTokenDisplay.style.display = "none";
    rareRaidTokenDisplay.style.display = "none";
    eligmaDisplay.style.display = "none";
    arenaCoinDisplay.style.display = "none";
    jeCoinDisplay.style.display = "none";
    masteryCertDisplay.style.display = "none";

    if (displayType == "Owned") {
        resourceDisplay = "Owned";
        btnOwned.parentElement.style.display = "none";
        btnTotal.parentElement.style.display = "";
        btnRemaining.parentElement.style.display = "";
        btnLeftover.parentElement.style.display = "";
        btnLvlCap.parentElement.style.display = "none";
        displayText.innerText = GetLanguageString("label-owned");
        xpInputs.style.display = "";
        updateCells(ownedMatDict, true, 'resource-count-text', 'misc-resource');
        for (i = 0; i < inputs.length; i++) {
            inputs[i].parentElement.classList.add("editable");
        }
    }
    else if (displayType == "Total") {
        resourceDisplay = "Total";
        btnOwned.parentElement.style.display = "";
        btnTotal.parentElement.style.display = "none";
        btnRemaining.parentElement.style.display = "";
        btnLeftover.parentElement.style.display = "";
        btnLvlCap.parentElement.style.display = "";
        displayText.innerText = GetLanguageString("label-totalneeded");
        xpInputs.style.display = "none";
        updateCells(requiredMatDict, false, 'resource-count-text', 'misc-resource');
        for (i = 0; i < inputs.length; i++) {
            inputs[i].parentElement.classList.remove("editable");
        }
    }
    else if (displayType == "Remaining") {
        calculateRaidCoins();
        resourceDisplay = "Remaining";
        btnOwned.parentElement.style.display = "";
        btnTotal.parentElement.style.display = "";
        btnRemaining.parentElement.style.display = "none";
        btnLeftover.parentElement.style.display = "";
        btnLvlCap.parentElement.style.display = "";
        displayText.innerText = GetLanguageString("label-remainingneeded");
        xpInputs.style.display = "none";
        updateCells(neededMatDict, false, 'resource-count-text', 'misc-resource');
        hideResourceDisplays();
        for (i = 0; i < inputs.length; i++) {
            inputs[i].parentElement.classList.remove("editable");
        }
    }
    else if (displayType == "Leftover") {
        resourceDisplay = "Leftover";
        btnOwned.parentElement.style.display = "";
        btnTotal.parentElement.style.display = "";
        btnRemaining.parentElement.style.display = "";
        btnLeftover.parentElement.style.display = "none";
        btnLvlCap.parentElement.style.display = "";
        displayText.innerText = GetLanguageString("label-leftover");
        xpInputs.style.display = "none";
        updateCells(leftoverMatDict, false, 'resource-count-text', 'misc-resource');
        for (i = 0; i < inputs.length; i++) {
            inputs[i].parentElement.classList.remove("editable");
        }
    }

    hideEmpty();

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

function switchGearDisplay(displayType) {

    // APRIL FOOLS
    // if (displayType == "Owned") {
    //     if (document.getElementById("switch-gear-owned").classList.contains("april-fools-button")) {
    //         return;
    //     }
    // }
    // else if (displayType == "Total") {
    //     if (document.getElementById("switch-gear-total").classList.contains("april-fools-button")) {
    //         return;
    //     }
    // }
    // else if (displayType == "Remaining") {
    //     if (document.getElementById("switch-gear-remaining").classList.contains("april-fools-button")) {
    //         return;
    //     }
    // }
    // else if (displayType == "Leftover") {
    //     if (document.getElementById("switch-gear-leftover").classList.contains("april-fools-button")) {
    //         return;
    //     }
    // }

    let btnOwned = document.getElementById("switch-gear-owned");
    let btnTotal = document.getElementById("switch-gear-total");
    let btnRemaining = document.getElementById("switch-gear-remaining");
    let btnLeftover = document.getElementById("switch-gear-leftover");
    let displayText = document.getElementById("current-gear-display");
    let gxpInputs = document.getElementById("gear-xp-input-wrapper");
    let campaignMulti = document.getElementById("normal-campaign-multi");
    let apDisplay = document.getElementById("gear-farm-energy");
    let leftoverDisplay = document.getElementById("leftover-xp");
    //var inputs = document.getElementsByClassName("input-wrapper");

    if (displayType == "Owned") {
        gearDisplay = "Owned";
        btnOwned.parentElement.style.display = "none";
        btnTotal.parentElement.style.display = "";
        btnRemaining.parentElement.style.display = "";
        btnLeftover.parentElement.style.display = "";
        gxpInputs.style.display = "";
        campaignMulti.parentElement.style.display = "none";
        apDisplay.parentElement.style.display = "none";
        leftoverDisplay.parentElement.style.display = "none";
        displayText.innerText = GetLanguageString("label-owned");
        updateCells(ownedMatDict, true, 'gear-count-text', 'misc-gear');
    }
    else if (displayType == "Remaining") {
        gearDisplay = "Remaining";
        btnOwned.parentElement.style.display = "";
        btnTotal.parentElement.style.display = "";
        btnRemaining.parentElement.style.display = "none";
        btnLeftover.parentElement.style.display = "";
        gxpInputs.style.display = "none";
        campaignMulti.parentElement.style.display = "";
        apDisplay.parentElement.style.display = "";
        leftoverDisplay.parentElement.style.display = "none";
        displayText.innerText = GetLanguageString("label-remainingneeded");
        updateCells(neededMatDict, false, 'gear-count-text', 'misc-gear');
        SolveGearFarm();
    }
    else if (displayType == "Total") {
        gearDisplay = "Total";
        btnOwned.parentElement.style.display = "";
        btnTotal.parentElement.style.display = "none";
        btnRemaining.parentElement.style.display = "";
        btnLeftover.parentElement.style.display = "";
        gxpInputs.style.display = "none";
        campaignMulti.parentElement.style.display = "none";
        apDisplay.parentElement.style.display = "none";
        leftoverDisplay.parentElement.style.display = "none";
        displayText.innerText = GetLanguageString("label-totalneeded");
        updateCells(requiredMatDict, false, 'gear-count-text', 'misc-gear');
    }
    else if (displayType == "Leftover") {
        gearDisplay = "Leftover";
        btnOwned.parentElement.style.display = "";
        btnTotal.parentElement.style.display = "";
        btnRemaining.parentElement.style.display = "";
        btnLeftover.parentElement.style.display = "none";
        gxpInputs.style.display = "none";
        campaignMulti.parentElement.style.display = "none";
        apDisplay.parentElement.style.display = "none";
        leftoverDisplay.parentElement.style.display = "";
        displayText.innerText = GetLanguageString("label-leftover");
        updateCells(leftoverMatDict, false, 'gear-count-text', 'misc-gear');
    }

    hideEmptyGear();

}

// function transferDialog() {

//     Swal.fire({
//         title: 'Data transfer',
//         showDenyButton: true,
//         showCancelButton: true,
//         confirmButtonText: 'Export',
//         denyButtonText: 'Import',
//         denyButtonColor: '#dc9641'
//     }).then((result) => {
//         if (result.isConfirmed) {
//             Swal.fire({
//                 title: 'Exported data',
//                 html: '<textarea style="width: 400px; height: 250px; resize: none;" readonly>' + localStorage.getItem('save-data') + '</textarea>'
//             })
//         }
//         else if (result.isDenied) {
//             getImportData();
//         }
//     })

// }

function displayExportData() {
    Swal.fire({
        title: GetLanguageString("text-exporteddata"),
        html: '<textarea style="width: 400px; height: 250px; resize: none;" readonly>' + localStorage.getItem('save-data') + '</textarea>'
    })
}

async function getImportData() {
    const { value: importData } = await Swal.fire({
        input: 'textarea',
        inputLabel: GetLanguageString("text-importdata"),
        color: alertColour,
        inputPlaceholder: GetLanguageString("placeholder-importdata"),
        showCancelButton: true
    })

    if (importData) {
        let tempData = tryParseJSON(importData);

        if (!!!tempData) {
            Swal.fire({
                icon: 'error',
                title: GetLanguageString("text-oops"),
                text: GetLanguageString("text-invalidjson"),
                color: alertColour
            })

            return false;
        }

        localStorage.setItem("save-data", JSON.stringify(tempData));

        gtag('event', 'action_import');

        location.reload();
    }
}

function initData() {

    if (!data.groups) {
        data.groups = {};
    }
}

function refreshAllChars() {

    var charBoxes = document.getElementsByClassName('main-display-char');

    while (charBoxes.length > 0) {
        charBoxes[0].remove();
    }

    let charsContainer = document.getElementById("charsContainer");

    if (data.character_order) {

        for (let i = 0; i < data.character_order.length; i++) {
            let char = data.characters.find(obj => { return obj.id == data.character_order[i] });

            if (char) {
                createCharBox(char.name, char.id, charsContainer, "main", false);
                calculateCharResources(char, false);
            }
        }
    }

    for (var i = 0; i < data.characters.length; i++) {

        if (document.getElementById('char_' + data.characters[i].id) == undefined) {

            createCharBox(data.characters[i].id, charsContainer, "main", false);

            calculateCharResources(data.characters[i], false);
        }
    }


}

function getOrder() {

    let characters = document.getElementsByClassName("main-display-char");

    let charOrder = [];

    for (let i = 0; i < characters.length; i++) {
        charOrder.push(characters[i].id.substring(5));
    }

    return charOrder;

}

function formatLevel(type, level) {

    if (type == "Other") {
        if (level == "10" || level == 10) {
            return "M";
        }
    }
    else if (type == "Ex") {
        if (level == "5" || level == 5) {
            return "M";
        }
    }

    if (level != undefined) {
        return level.toString();
    }
    else {
        return '';
    }

}

function getOffset(el) {
    const rect = el.getBoundingClientRect();
    return {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY
    };
}

function GetGroupScreenshot() {

    if (currentGroup == "") {
        basicAlert(GetLanguageString("text-selectgroup"));
        return;
    }

    document.getElementById("background-blur-container").style.display = '';
    document.getElementById("button-save-image").style.display = "none";

    html2canvas(document.getElementById("teamsContainer"), { "logging": false, "windowWidth": 2000, "windowHeight": 1000, "scale": 1 })
        .then(canvas => {
            document.getElementById("popup-screenshot").appendChild(canvas); document.getElementById("text-creating-image").style.display = "none";
            document.getElementById("button-save-image").style.display = "";
        });
}

function ClearScreenshot() {

    let canvasElement = document.getElementById("popup-screenshot").children;

    if (canvasElement.length > 0) {
        canvasElement[0].remove();
    }
    else {
        return;
    }

    document.getElementById("background-blur-container").style.display = "none";
    document.getElementById("text-creating-image").style.display = '';
}

function SaveScreenshot() {

    let canvas = document.querySelector('#popup-screenshot canvas');

    let dataURL = canvas.toDataURL("image/png", 1.0);

    DownloadImage(dataURL, currentGroup + ".png");
}

function DownloadImage(data, filename = 'untitled.png') {
    let a = document.createElement('a');
    a.href = data;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// Make the DIV element draggable:
dragElement(document.getElementById("control-panel"));

function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    // if (document.getElementById(elmnt.id + "-header")) {
    //     // if present, the header is where you move the DIV from:
    //     document.getElementById(elmnt.id + "-header").onmousedown = dragMouseDown;
    // } else {
    // otherwise, move the DIV from anywhere inside the DIV:
    elmnt.onmousedown = dragMouseDown;
    // }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        if (!controlPanelDocked) {
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        }

        setTimeout(() => {
            movingControlPanel = true;
        }, 100);
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;

        setTimeout(() => {
            movingControlPanel = false;
        }, 300);
    }
}

function TouchDraggableControlPanel() {
    // find the element that you want to drag.
    var mPos1 = 0, mPos2 = 0, mPos3 = 0, mPos4 = 0;
    var box = document.getElementById('control-panel');

    box.addEventListener('touchstart', function (e) {
        mPos3 = e.clientX;
        mPos4 = e.clientY;
    })

    /* listen to the touchMove event,
    every time it fires, grab the location
    of touch and assign it to box */

    box.addEventListener('touchmove', function (e) {
        e.preventDefault();
        // grab the location of touch
        var touchLocation = e.targetTouches[0];

        mPos1 = mPos3 - touchLocation.clientX;
        mPos2 = mPos4 - touchLocation.clientY;
        mPos3 = touchLocation.clientX;
        mPos4 = touchLocation.clientY;

        // assign box new coordinates based on the touch.
        if (!controlPanelDocked) {
            box.style.left = (box.offsetLeft - mPos1) + 'px';
        }
        box.style.top = (box.offsetTop - mPos2) + 'px';

        setTimeout(() => {
            movingControlPanel = true;
        }, 100);
    })

    /* record the position of the touch
    when released using touchend event.
    This will be the drop position. */

    box.addEventListener('touchend', function (e) {
        setTimeout(() => {
            movingControlPanel = false;
        }, 300);
    })

}

function ControlPanelSize(change) {
    let controlPanel = document.getElementById("control-panel");
    let fontEm = parseFloat(controlPanel.style.fontSize.substring(0, controlPanel.style.fontSize.indexOf("em")));

    if (change == "Expand") {
        if (fontEm < 1) {
            controlPanel.style.fontSize = (fontEm + 0.1) + "em";
            localStorage.setItem("control-panel-size", controlPanel.style.fontSize);
        }
    }
    else if (change == "Shrink") {
        if (fontEm > 0.6) {
            controlPanel.style.fontSize = (fontEm - 0.1) + "em";
            localStorage.setItem("control-panel-size", controlPanel.style.fontSize);
        }
    }
}

function ControlPanelClicked(button) {

    if (movingControlPanel) {
        return;
    }

    if (multiSelectVisible || modalOpen || mainDisplay == "Teams") {
        return;
    }

    if (button == "Edit") {
        // APRIL FOOLS
        // if (document.getElementById("control-edit").classList.contains("april-fools-button")) {
        //     return;
        // }

        if (bulkMode && bulkChars.length > 0) {
            OpenBulkModal();
        }
        else {
            document.getElementById("control-button-edit").classList.add("selected");
            document.getElementById("control-button-move").classList.remove("selected");
            document.getElementById("control-button-disable").classList.remove("selected");
            charMode = "Edit";
            ResetBulkMode();
        }
    }
    else if (button == "Move") {
        // APRIL FOOLS
        // if (document.getElementById("control-move").classList.contains("april-fools-button")) {
        //     return;
        // }

        document.getElementById("control-button-edit").classList.remove("selected");
        document.getElementById("control-button-move").classList.add("selected");
        document.getElementById("control-button-disable").classList.remove("selected");
        charMode = "Move";
        ResetBulkMode();
    }
    else if (button == "Disable") {
        // APRIL FOOLS
        // if (document.getElementById("control-disable").classList.contains("april-fools-button")) {
        //     return;
        // }

        document.getElementById("control-button-edit").classList.remove("selected");
        document.getElementById("control-button-move").classList.remove("selected");
        document.getElementById("control-button-disable").classList.add("selected");
        charMode = "Disable";
        ResetBulkMode();
    }
    else if (button == "AddStudent") {
        // APRIL FOOLS
        // if (document.getElementById("control-addstudent").classList.contains("april-fools-button")) {
        //     return;
        // }

        showMultiSelect('AddNewChars');
        ResetBulkMode();
    }
    else if (button == "Filter") {
        // APRIL FOOLS
        // if (document.getElementById("control-filter").classList.contains("april-fools-button")) {
        //     return;
        // }

        toggleViewFilters();
        ResetBulkMode();
    }
    else if (button == "Bulk") {
        // APRIL FOOLS
        // if (document.getElementById("control-bulk").classList.contains("april-fools-button")) {
        //     return;
        // }

        if (!bulkMode) {
            document.getElementById("control-button-bulk").classList.add("selected");
            document.getElementById("control-button-edit").classList.remove("selected");
            document.getElementById("control-button-move").classList.remove("selected");
            document.getElementById("control-button-move").classList.add("disabled");
            document.getElementById("control-button-disable").classList.remove("selected");
            document.getElementById("control-button-disable").classList.add("disabled");
            document.getElementById("control-button-add-student").classList.add("disabled");
            document.getElementById("control-button-filter").classList.add("disabled");

            bulkMode = true;
            charMode = "Edit";
        }
        else {
            ResetBulkMode();
            document.getElementById("control-button-edit").classList.add("selected");
        }
    }
    else if (button == "Sort") {
        OpenSortDialog();
    }
    else if (button == "Dock") {
        let controlPanel = document.getElementById("control-panel");
        let charsContainer = document.getElementById("charsContainer");

        if (controlPanel.classList.contains("docked")) {
            controlPanel.classList.remove("docked");
            charsContainer.classList.remove("docked");
            controlPanelDocked = false;
        }
        else {
            controlPanel.classList.add("docked");
            charsContainer.classList.add("docked");
            controlPanelDocked = true;
            controlPanel.style.left = 0;
        }
    }
}

function ChangeCharSizes(input, set) {
    let charsContainer = document.getElementById("charsContainer");

    if (set) {
        localStorage.setItem("character_box_size", input.value.toString());
        return;
    }

    charsContainer.classList.remove("size-1");
    charsContainer.classList.remove("size-2");
    charsContainer.classList.remove("size-3");
    charsContainer.classList.remove("size-4");
    charsContainer.classList.remove("size-5");

    charsContainer.classList.add("size-" + input.value);
}

function ResetBulkMode() {
    bulkMode = false;
    document.getElementById("control-button-bulk").classList.remove("selected");

    document.getElementById("control-button-move").classList.remove("disabled");
    document.getElementById("control-button-disable").classList.remove("disabled");
    document.getElementById("control-button-add-student").classList.remove("disabled");
    document.getElementById("control-button-filter").classList.remove("disabled");

    let bulkSelected = document.getElementsByClassName("charBox multiSelected");

    while (bulkSelected.length > 0) {
        bulkSelected[0].classList.remove("multiSelected");
    }

    bulkChars = [];

    CloseBulkModal();
}

function OpenBulkModal() {

    let modal = document.getElementById("bulkEditModal");
    modal.style.visibility = "visible";

    document.getElementById("bulk-input_level_current").value = "";
    document.getElementById("bulk-input_level_target").value = "";

    document.getElementById("bulk-input_ue_level_current").value = "";
    document.getElementById("bulk-input_ue_level_target").value = "";

    document.getElementById("bulk-input_bond_current").value = "";
    document.getElementById("bulk-input_bond_target").value = "";

    document.getElementById("bulk-input_ex_current").value = "";
    document.getElementById("bulk-input_ex_target").value = "";
    document.getElementById("bulk-input_basic_current").value = "";
    document.getElementById("bulk-input_basic_target").value = "";
    document.getElementById("bulk-input_enhanced_current").value = "";
    document.getElementById("bulk-input_enhanced_target").value = "";
    document.getElementById("bulk-input_sub_current").value = "";
    document.getElementById("bulk-input_sub_target").value = "";

    document.getElementById("bulk-input_gear1_current").value = "";
    document.getElementById("bulk-input_gear1_target").value = "";
    document.getElementById("bulk-input_gear2_current").value = "";
    document.getElementById("bulk-input_gear2_target").value = "";
    document.getElementById("bulk-input_gear3_current").value = "";
    document.getElementById("bulk-input_gear3_target").value = "";

    modalStars = { star: 0, star_target: 0, ue: 0, ue_target: 0 };
    updateBulkStarDisplays("", true);

    modalOpen = "bulkEditModal";

    modal.onclick = function (event) {
        if (event.target == modal) {
            CloseBulkModal();
        }
    };
}

function CloseBulkModal() {

    document.getElementById("bulkEditModal").style.visibility = "";

    modalOpen = "";
}

function ConfirmBulkUpdate() {

    let allValid = true;
    let invalidMessages = "";

    for (let key in inputValidation) {
        if (inputValidation[key].location == "bulkEditModal") {
            let result = validateInput(key, false, true);
            if (result != "validated") {
                //invalidMessages.push(result);
                invalidMessages += result + "<br>";
                allValid = false;
            }
        }
    }

    if (allValid == false) {
        // Swal.fire({
        //     title: 'Invalid inputs',
        //     html: invalidMessages,
        //     color: alertColour
        // })

        return false;
    }

    let bulkUpdate = {};

    bulkUpdate.current = {};
    bulkUpdate.target = {};
    bulkUpdate.eleph = {};

    bulkUpdate.current.level = document.getElementById("bulk-input_level_current").value;
    bulkUpdate.target.level = document.getElementById("bulk-input_level_target").value;

    bulkUpdate.current.ue_level = document.getElementById("bulk-input_ue_level_current").value;
    bulkUpdate.target.ue_level = document.getElementById("bulk-input_ue_level_target").value;

    bulkUpdate.current.bond = document.getElementById("bulk-input_bond_current").value;
    bulkUpdate.target.bond = document.getElementById("bulk-input_bond_target").value;

    bulkUpdate.current.ex = document.getElementById("bulk-input_ex_current").value;
    bulkUpdate.target.ex = document.getElementById("bulk-input_ex_target").value;
    bulkUpdate.current.basic = document.getElementById("bulk-input_basic_current").value;
    bulkUpdate.target.basic = document.getElementById("bulk-input_basic_target").value;
    bulkUpdate.current.passive = document.getElementById("bulk-input_enhanced_current").value;
    bulkUpdate.target.passive = document.getElementById("bulk-input_enhanced_target").value;
    bulkUpdate.current.sub = document.getElementById("bulk-input_sub_current").value;
    bulkUpdate.target.sub = document.getElementById("bulk-input_sub_target").value;

    bulkUpdate.current.gear1 = document.getElementById("bulk-input_gear1_current").value;
    bulkUpdate.target.gear1 = document.getElementById("bulk-input_gear1_target").value;
    bulkUpdate.current.gear2 = document.getElementById("bulk-input_gear2_current").value;
    bulkUpdate.target.gear2 = document.getElementById("bulk-input_gear2_target").value;
    bulkUpdate.current.gear3 = document.getElementById("bulk-input_gear3_current").value;
    bulkUpdate.target.gear3 = document.getElementById("bulk-input_gear3_target").value;

    // charData.current.star = modalStars.star;
    // charData.target.star = modalStars.star_target;
    // charData.current.ue = modalStars.ue;
    // charData.target.ue = modalStars.ue_target;

    Swal.fire({
        title: GetLanguageString("label-areyousure"),
        text: GetLanguageString("text-bulkupdateprompt"),
        color: alertColour,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: GetLanguageString("confirmupdate"),
        cancelButtonText: GetLanguageString("label-cancel")
    }).then((result) => {
        if (result.isConfirmed) {
            CloseBulkModal();
            ApplyBulkUpdate(bulkUpdate);
        }
    })

}

function ApplyBulkUpdate(bulkUpdate) {

    for (let i = 0; i < bulkChars.length; i++) {

        let charData = data.characters.find(obj => { return obj.id == bulkChars[i] });

        if (charData != undefined) {
            let uc = bulkUpdate.current;
            let ut = bulkUpdate.target;

            let cc = charData.current;
            let ct = charData.target;

            let params = ["level", "ex", "basic", "passive", "sub", "gear1", "gear2", "gear3"];
            for (let p = 0; p < params.length; p++) {
                if (uc[params[p]]) {
                    cc[params[p]] = uc[params[p]];
                }

                if (ut[params[p]]) {
                    ct[params[p]] = Math.max(ut[params[p]], cc[params[p]]);
                }
                else {
                    if (parseInt(ct[params[p]]) < parseInt(cc[params[p]])) {
                        ct[params[p]] = cc[params[p]];
                    }
                }
            }

            let charInfoObj = charlist[bulkChars[i]];

            if (modalStars.star) {
                cc.star = Math.max(modalStars.star, charInfoObj.StarGrade);
                cc.ue = modalStars.ue;
            }

            if (modalStars.star_target) {
                ct.star = Math.max(modalStars.star_target, cc.star);
                ct.ue = Math.max(modalStars.ue_target, cc.ue);
            }
            else {
                if (ct.star < cc.star) {
                    ct.star = cc.star;
                }

                if (ct.ue < cc.ue) {
                    ct.ue = cc.ue;
                }
            }

            if (uc.ue_level) {
                if (parseInt(cc.ue) >= 3) {
                    cc.ue_level = uc.ue_level;
                }
                else if (cc.ue == 2) {
                    cc.ue_level = Math.min(uc.ue_level, 40);
                }
                else if (cc.ue == 1) {
                    cc.ue_level = Math.min(uc.ue_level, 30);
                }
                else {
                    cc.ue_level = 0;
                }
            }

            if (ut.ue_level) {
                if (parseInt(ct.ue) >= 3) {
                    ct.ue_level = Math.max(ut.ue_level, cc.ue_level);
                }
                else if (ct.ue == 2) {
                    ct.ue_level = Math.min(Math.max(ut.ue_level, cc.ue_level), 40);
                }
                else if (ct.ue == 1) {
                    ct.ue_level = Math.min(Math.max(ut.ue_level, cc.ue_level), 30);
                }
                else {
                    ct.ue_level = 0;
                }
            }
            else {
                if (parseInt(ct.ue_level) < parseInt(cc.ue_level)) {
                    ct.ue_level = cc.ue_level;
                }
            }

            if (uc.bond) {
                if (parseInt(cc.star) >= 5) {
                    cc.bond = uc.bond;
                }
                else if (parseInt(cc.star) >= 3) {
                    cc.bond = Math.min(uc.bond, 20);
                }
                else {
                    cc.bond = Math.min(uc.bond, 10);
                }
            }

            if (ut.bond) {
                if (parseInt(ct.star) >= 5) {
                    ct.bond = Math.max(ut.bond, cc.bond);
                }
                else if (parseInt(cc.star) >= 3) {
                    ct.bond = Math.min(Math.max(ut.bond, cc.bond), 20);
                }
                else {
                    ct.bond = Math.min(Math.max(ut.bond, cc.bond), 10);
                }
            }
            else {
                if (parseInt(ct.bond) < parseInt(cc.bond)) {
                    ct.bond = cc.bond;
                }
            }
        }
    }

    saveToLocalStorage(false);

    location.reload();
}

function bulkStarClicked(type, mode, pos) {

    pos = parseInt(pos);

    if (mode == "current") {
        if (type == "star") {
            if (pos != modalStars.star) {
                modalStars.star = pos;

                if (modalStars.star < 5) {
                    modalStars.ue = 0;
                }

                if (modalStars.star == 5) {
                    modalStars.ue = 1;
                }
            }
            else {
                if (modalStars.ue <= 1) {
                    modalStars.star = 0;
                    modalStars.ue = 0;
                }
                else {
                    if (modalStars.star == 5) {
                        modalStars.ue = 1;
                    }
                }
            }
        }
        else if (type == "ue") {
            if (pos != modalStars.ue) {
                modalStars.ue = pos;

                if (modalStars.star != 5) {
                    modalStars.star = 5;
                }
            }
            else {
                modalStars.star = 0;
                modalStars.ue = 0;
            }
        }
    }
    else if (mode == "target") {
        if (type == "star") {
            if (pos > modalStars.star && pos != modalStars.star_target) {
                modalStars.star_target = pos;

                if (pos < 5) {
                    modalStars.ue = 0;
                    modalStars.ue_target = 0;
                }

                if (modalStars.star_target == 5) {
                    modalStars.ue_target = 1;
                }
            }
            else {
                if (modalStars.ue_target <= 1) {
                    modalStars.star_target = 0;
                    modalStars.ue_target = 0;
                }
                else {
                    if (modalStars.star_target == 5) {
                        modalStars.ue_target = 1;
                    }
                }
            }
        }
        else if (type == "ue") {
            if (pos > modalStars.ue && pos != modalStars.ue_target) {
                if (pos == 1 && modalStars.ue_target == 1) {
                    modalStars.ue_target = 0;
                }
                else {
                    modalStars.ue_target = pos;

                    if (modalStars.star_target != 5) {
                        modalStars.star_target = 5;
                    }
                }
            }
            else {
                modalStars.star_target = 0;
                modalStars.ue_target = 0;
            }
        }
    }

    updateBulkStarDisplays("", true);
}

function updateBulkStarDisplays(charId, fromTemp) {

    updateStarDisplay("bulk-star-current-container", charId, "star-current", fromTemp);
    updateStarDisplay("bulk-star-target-container", charId, "star-target", fromTemp);
    updateStarDisplay("bulk-ue-current-container", charId, "ue-current", fromTemp);
    updateStarDisplay("bulk-ue-target-container", charId, "ue-target", fromTemp);

}

let chars1Star = [], chars2Star = [], chars3Star = [];
let charStars = [];
let aprilPyro = 0;
let allCharsPulled = [];
function InitAprilFools() {

    let charKeys = Object.keys(charlist);
    for (let i = 0; i < charKeys.length; i++) {
        let aprilStar = charlist[charKeys[i]].StarGrade;

        if (aprilStar == 1) {
            chars1Star.push(charKeys[i]);
        }
        else if (aprilStar == 2) {
            chars2Star.push(charKeys[i]);
        }
        else if (aprilStar == 3) {
            chars3Star.push(charKeys[i]);
        }
    }

    charStars = [chars1Star, chars2Star, chars3Star];

    let aprilTemp = localStorage.getItem("april-ids-unlocked");
    if (aprilTemp) {
        aprilIds = JSON.parse(aprilTemp);
    }

    let aprilTemp2 = localStorage.getItem("april-ids-chars");
    if (aprilTemp2) {
        allCharsPulled = JSON.parse(aprilTemp2);
    }

    let charBoxes = document.getElementsByClassName("main-display-char");

    for (let i = 0; i < charBoxes.length; i++) {

        let newDiv = document.createElement("div");

        let coverDiv = document.createElement("div");
        coverDiv.className = "april-fools-char-cover";

        let lockImg = document.createElement("img");
        lockImg.src = "icons/UI/unlock-solid.svg";
        lockImg.className = "april-fools-main-display-char";

        newDiv.appendChild(coverDiv);
        newDiv.appendChild(lockImg);

        charBoxes[i].appendChild(newDiv);

        charBoxes[i].addEventListener("click", (event) => {
            AprilLockClicked(event.currentTarget, "char");
        })
    }

    let buttonsList = document.getElementsByClassName("charEditorButton");

    for (let i = 0; i < buttonsList.length; i++) {
        buttonsList[i].classList.add("april-fools-button");
        buttonsList[i].addEventListener("click", (event) => {
            AprilLockClicked(event.currentTarget);
        })
    }

    buttonsList = document.getElementsByClassName("control-panel-button-wrapper");

    for (let i = 0; i < buttonsList.length; i++) {
        buttonsList[i].classList.add("april-fools-button");
        buttonsList[i].addEventListener("click", (event) => {
            AprilLockClicked(event.currentTarget);
        })
    }

    buttonsList = document.getElementsByClassName("footer-button");

    for (let i = 0; i < buttonsList.length; i++) {
        buttonsList[i].classList.add("april-fools-button");
        buttonsList[i].addEventListener("click", (event) => {
            AprilLockClicked(event.currentTarget);
        })
    }

    buttonsList = document.getElementsByClassName("button-switch-display");

    for (let i = 0; i < buttonsList.length; i++) {
        buttonsList[i].classList.add("april-fools-button");
        buttonsList[i].addEventListener("click", (event) => {
            AprilLockClicked(event.currentTarget);
        })
    }

    for (let i = 0; i < aprilIds.length; i++) {
        document.getElementById(aprilIds[i]).classList.remove("april-fools-button");
    }

    let aprilTempPyro = localStorage.getItem("april-pyro");
    if (aprilTempPyro) {
        aprilPyro = JSON.parse(aprilTempPyro);
    }

    UnlockStudents();
    RefreshPyro();
}

let aprilIds = [];
let currentLocked = "";
function AprilLockClicked(target, type) {

    if (type == "char") {
        // APRIL FOOLS
        if (!allCharsPulled.includes(target.id.substring(5))) {
            AprilPullScreen();
        }
    }
    else {
        if (target.classList.contains("april-fools-button")) {
            AprilBuyScreen();
        }
    }
    currentLocked = target.id;
}

function BuyFeature() {

    if (aprilPyro >= 2000) {
        aprilPyro -= 2000;
        aprilIds.push(currentLocked);
        document.getElementById(currentLocked).classList.remove("april-fools-button");
        RefreshPyro();
        AprilClosePopup();
    }
    else {
        document.getElementById("april-pyroxene-count").classList.add("nopyros");
        setTimeout(() => {
            document.getElementById("april-pyroxene-count").classList.remove("nopyros");
            AprilPyroScreen();
        }, 1000);
    }

    localStorage.setItem("april-ids-unlocked", JSON.stringify(aprilIds));
}

function RandomPull() {
    let randPull = Math.random();

    if (randPull <= 0.7) {
        let randChar = Math.floor(Math.random() * chars1Star.length);
        return chars1Star[randChar];
    }
    else if (randPull <= 0.9) {
        let randChar = Math.floor(Math.random() * chars2Star.length);
        return chars2Star[randChar];
    }
    else {
        let randChar = Math.floor(Math.random() * chars3Star.length);
        return chars3Star[randChar];
    }
}

function AprilBuyScreen() {
    document.getElementById("april-pyroxene-popup").style.display = "";

    document.getElementById("april-char-pulls").style.display = "none";
    document.getElementById("buy-packs").style.display = "none";

    document.getElementById("spend-pyros").style.display = "";
}

function AprilPyroScreen() {
    document.getElementById("april-pyroxene-popup").style.display = "";

    document.getElementById("spend-pyros").style.display = "none";
    document.getElementById("april-char-pulls").style.display = "none";

    document.getElementById("buy-packs").style.display = "";
}

function AprilPullScreen() {
    document.getElementById("april-pyroxene-popup").style.display = "";

    document.getElementById("spend-pyros").style.display = "none";
    document.getElementById("buy-packs").style.display = "none";

    document.getElementById("april-char-pulls").style.display = "";
}

function RollClicked(num) {
    let charsPulled = [];
    let newChars = [];
    if (num == 120) {
        if (aprilPyro >= 120) {
            aprilPyro -= 120;
        }
        else {
            document.getElementById("april-pyroxene-count").classList.add("nopyros");
            setTimeout(() => {
                document.getElementById("april-pyroxene-count").classList.remove("nopyros");
            }, 1000);
            AprilPyroScreen();
            return;
        }
        let pull = RandomPull();
        charsPulled = [pull];
        if (!allCharsPulled.includes(pull)) {
            allCharsPulled.push(pull);
            newChars.push(pull);
        }
    }
    else if (num == 1200) {
        if (aprilPyro >= 1200) {
            aprilPyro -= 1200;
        }
        else {
            document.getElementById("april-pyroxene-count").classList.add("nopyros");
            setTimeout(() => {
                document.getElementById("april-pyroxene-count").classList.remove("nopyros");
            }, 1000);
            AprilPyroScreen();
            return;
        }
        for (let i = 0; i < 10; i++) {
            let pull = RandomPull();
            charsPulled.push(pull);
            if (!allCharsPulled.includes(pull)) {
                allCharsPulled.push(pull);
                newChars.push(pull);
            }
            else {
                newChars.push(false);
            }
        }
    }

    for (let i = 0; i < 10; i++) {
        if (charsPulled[i]) {
            document.getElementById("char-pull-" + (i + 1)).src = "icons/Portrait/Icon_" + charsPulled[i] + ".webp";
        }
        else {
            document.getElementById("char-pull-" + (i + 1)).src = "";
        }

        if (newChars[i]) {
            document.getElementById("char-pull-" + (i + 1)).classList.add("newstudent");
        }
        else {
            document.getElementById("char-pull-" + (i + 1)).classList.remove("newstudent");
        }
    }

    UnlockStudents();
    RefreshPyro();

    localStorage.setItem("april-ids-chars", JSON.stringify(allCharsPulled));
}

function UnlockStudents() {

    for (let i = 0; i < allCharsPulled.length; i++) {
        let studentEle = document.getElementById("char_" + allCharsPulled[i]);

        if (studentEle) {
            if (studentEle.lastChild.children[0].classList.contains("april-fools-char-cover")) {
                studentEle.lastChild.remove();
            }
        }
    }
}

let purchasedPacks = [0, 0, 0];
function BuyPack(pack) {

    if (pack == 1) {
        if (purchasedPacks[0] < 1) {
            aprilPyro += 8000;
            purchasedPacks[0] += 1;
        }

        if (purchasedPacks[0] >= 1) {
            document.getElementById("pack-1").classList.add("disabled");
        }
    }
    else if (pack == 2) {
        if (purchasedPacks[1] < 3) {
            aprilPyro += 6600;
            purchasedPacks[1] += 1;
        }

        if (purchasedPacks[1] >= 3) {
            document.getElementById("pack-2").classList.add("disabled");
        }
    }
    else if (pack == 3) {
        aprilPyro += 4800;
        purchasedPacks[2] += 1;
    }

    RefreshPyro();
}

function RefreshPyro() {

    document.getElementById("april-pyroxene-count").innerText = commafy(aprilPyro);
    localStorage.setItem("april-pyro", JSON.stringify(aprilPyro));
}

function AprilClosePopup() {

    document.getElementById("april-pyroxene-popup").style.display = "none";
}

function HELP() {

    Swal.fire({
        title: "Get rid of April fools joke?",
        showDenyButton: true,
        confirmButtonText: "Yes please",
        denyButtonText: "No thanks",
        denyButtonColor: '#dc9641'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.setItem("april-ids-unlocked", JSON.stringify(["btn-group-filter-mode", "button-resetfilters", "button-enableall", "button-filters",
                "button-addcharacters", "control-move", "control-edit", "button-resources", "button-gear", "switch-resource-owned", "switch-resource-remaining",
                "switch-resource-total", "switch-resource-leftover", "switch-gear-owned", "switch-gear-remaining", "button-transfer", "button-teamstoggle", "button-disableall",
                "control-disable", "control-addstudent", "control-filter", "control-bulk", "switch-gear-total", "switch-gear-leftover"]))

            let allIds = [];

            let charKeys = Object.keys(charlist);
            for (let i = 0; i < charKeys.length; i++) {
                allIds.push(charKeys[i]);
            }
            localStorage.setItem("april-ids-chars", JSON.stringify(allIds));
            location.reload();
        }
    })
}

function SortStudents(students, sortType) {

    let academyOrder = {
        "Hyakkiyako": 11, "RedWinter": 10, "Trinity": 9, "Gehenna": 8, "Abydos": 7,
        "Millennium": 6, "Arius": 5, "Shanhaijing": 4, "Valkyrie": 3, "SRT": 2, "ETC": 1, "Tokiwadai": 0
    }
    let bulletOrder = {
        "Sonic": 4, "Mystic": 3, "Explosion": 2, "Pierce": 1
    }
    let armourOrder = {
        "ElasticArmor": 4, "Unarmed": 3, "HeavyArmor": 2, "LightArmor": 1
    }
    let roleOrder = {
        "Tanker": 5, "DamageDealer": 4, "Healer": 3, "Supporter": 2, "Vehicle": 1
    }
    let weaponOrder = {
        "SG": 11, "SMG": 10, "AR": 9, "GL": 8, "HG": 7, "RL": 6, "SR": 5, "RG": 4, "MG": 3, "MT": 2, "FT": 1
    }

    let sorted = [];

    let sorting = {};

    for (let i = 0; i < students.length; i++) {
        let sortparam;

        if (sortType == "academy") {
            sortparam = academyOrder[charlist[students[i].id].School];
        }
        else if (sortType == "name") {
            // sortparam = charlist[students[i].id].Name;
            sortparam = charNames.get(students[i].id);
        }
        else if (sortType == "street") {
            sortparam = charlist[students[i].id].StreetBattleAdaptation;
            if (students[i].current.ue >= 3 && charlist[students[i].id].Weapon.AdaptationType == "Street") {
                sortparam += charlist[students[i].id].Weapon.AdaptationValue;
            }
        }
        else if (sortType == "outdoor") {
            sortparam = charlist[students[i].id].OutdoorBattleAdaptation;
            if (students[i].current.ue >= 3 && charlist[students[i].id].Weapon.AdaptationType == "Outdoor") {
                sortparam += charlist[students[i].id].Weapon.AdaptationValue;
            }
        }
        else if (sortType == "indoor") {
            sortparam = charlist[students[i].id].IndoorBattleAdaptation;
            if (students[i].current.ue >= 3 && charlist[students[i].id].Weapon.AdaptationType == "Indoor") {
                sortparam += charlist[students[i].id].Weapon.AdaptationValue;
            }
        }
        else if (sortType == "bullet") {
            sortparam = bulletOrder[charlist[students[i].id].BulletType];
        }
        else if (sortType == "armour") {
            sortparam = armourOrder[charlist[students[i].id].ArmorType];
        }
        else if (sortType == "role") {
            sortparam = roleOrder[charlist[students[i].id].TacticRole];
        }
        else if (sortType == "weapon") {
            sortparam = weaponOrder[charlist[students[i].id].WeaponType];
        }
        else {
            sortparam = students[i].current[sortType];
        }

        if (!sorting[sortparam]) {
            sorting[sortparam] = [students[i]];
        }
        else {
            sorting[sortparam].push(students[i]);
        }
    }

    let sortingKeys;
    if (sortType == "name") {
        if (language == "Jp") {
            sortingKeys = Object.keys(sorting).sort(function (a, b) {
                return a.localeCompare(b, 'ja');
            })
        }
        else {
            sortingKeys = Object.keys(sorting).sort();
        }
    }
    else {
        sortingKeys = Object.keys(sorting).sort((a, b) => b - a);
    }
    for (let i = 0; i < sortingKeys.length; i++) {
        sorted.push(sorting[sortingKeys[i]]);
    }

    return sorted;
}

function FullSort(order) {

    let operations = sortingOperations[order];


    let sorted = SortStudents(data.characters, operations[0]);

    for (let i = 1; i < operations.length; i++) {
        let tempSorted = [];
        for (let ii = 0; ii < sorted.length; ii++) {
            tempSorted = tempSorted.concat(SortStudents(sorted[ii], operations[i]));
        }
        sorted = tempSorted;
    }

    let fullSorted = [];

    for (let i = 0; i < sorted.length; i++) {
        for (let ii = 0; ii < sorted[i].length; ii++) {
            fullSorted.push(sorted[i][ii]);
        }
    }

    MoveAllStudents(fullSorted);
}

function MoveAllStudents(order) {

    let charsContainer = document.getElementById("charsContainer");

    for (let i = order.length - 1; i >= 0; i--) {

        let sortId = order[i];
        if (sortId.id) {
            sortId = sortId.id;
        }
        charsContainer.prepend(document.getElementById("char_" + sortId));
    }
}

function AddOrderDisplay(order) {

    let orderDisplay = document.getElementById(order + "-order-display");

    for (let i = 0; i < sortingOperations[order].length; i++) {
        if (i != 0) {
            let separatorDiv = document.createElement("div");
            separatorDiv.innerText = ">";
            orderDisplay.appendChild(separatorDiv);
        }

        if (["name", "ex"].includes(sortingOperations[order][i])) {
            let orderDiv = document.createElement("div");

            if (sortingOperations[order][i] == "name") {
                orderDiv.innerText = "Abc";
            }
            else if (sortingOperations[order][i] == "ex") {
                orderDiv.innerText = GetLanguageString("label-skillex");
            }

            orderDisplay.appendChild(orderDiv);
        }
        else {

            let orderImg = document.createElement("img");
            orderImg.draggable = false;

            if (sortingOperations[order][i] == "level") {
                orderImg.src = "icons/Misc/exp.png";
            }
            else if (sortingOperations[order][i] == "star") {
                orderImg.src = "icons/Misc/mysticstar.png";
            }
            else if (sortingOperations[order][i] == "bond") {
                orderImg.src = "icons/Misc/bondheart.png";
            }
            else if (sortingOperations[order][i] == "star") {
                orderImg.src = "icons/Misc/mysticstar.png";
            }
            else if (sortingOperations[order][i] == "academy") {
                orderImg.src = "icons/Misc/School_Icon_MILLENNIUM_W.png";
            }
            else if (sortingOperations[order][i] == "street") {
                orderImg.src = "icons/Mood/Terrain_Street.png";
            }
            else if (sortingOperations[order][i] == "outdoor") {
                orderImg.src = "icons/Mood/Terrain_Outdoor.png";
            }
            else if (sortingOperations[order][i] == "indoor") {
                orderImg.src = "icons/Mood/Terrain_Indoor.png";
            }
            else if (sortingOperations[order][i] == "bullet") {
                orderImg.src = "icons/Misc/Type_Attack.png";
            }
            else if (sortingOperations[order][i] == "armour") {
                orderImg.src = "icons/Misc/Type_Defense.png";
            }
            else if (sortingOperations[order][i] == "role") {
                orderImg.src = "icons/Misc/Role_DamageDealer.png";
            }
            else if (sortingOperations[order][i] == "weapon") {
                orderImg.src = "icons/Misc/Gun.webp";
            }

            orderDisplay.appendChild(orderImg);
        }
    }
}

function InitSortingOrder() {

    sortingOperations["level"] = ["level", "star", "bond", "academy", "name"]; // level
    sortingOperations["star"] = ["star", "level", "bond", "academy", "name"]; // star quantity
    sortingOperations["bond"] = ["bond", "star", "level", "academy", "name"]; // relationship
    sortingOperations["academy"] = ["academy", "star", "level", "bond", "name"]; // academy
    sortingOperations["name"] = ["name"]; // name
    sortingOperations["ex"] = ["ex", "star", "level", "bond", "academy", "name"]; // ex skill
    sortingOperations["street"] = ["street", "star", "level", "bond", "academy", "name"]; // urban warfare
    sortingOperations["outdoor"] = ["outdoor", "star", "level", "bond", "academy", "name"]; // field warfare
    sortingOperations["indoor"] = ["indoor", "star", "level", "bond", "academy", "name"]; // indoor warfare
    sortingOperations["bullet"] = ["bullet", "star", "level", "bond", "academy", "name"]; // bullet type
    sortingOperations["armour"] = ["armour", "star", "level", "bond", "academy", "name"]; // armour type
    sortingOperations["role"] = ["role", "star", "level", "bond", "academy", "name"]; // role
    sortingOperations["weapon"] = ["weapon", "star", "level", "bond", "academy", "name"]; // weapon

    let orderKeys = Object.keys(sortingOperations);

    for (let i = 0; i < orderKeys.length; i++) {
        AddOrderDisplay(orderKeys[i]);
    }

    let sortPopup = document.getElementById("sort-popup");

    sortPopup.onclick = function (event) {
        if (event.target == sortPopup) {
            CloseSortDialog();
        }
    };
}

function OpenSortDialog() {
    document.getElementById("sort-popup").style.display = "";
}

function CloseSortDialog() {
    document.getElementById("sort-popup").style.display = "none";
}

function SortType(type) {

    CloseSortDialog();

    currentSort = type;

    if (type == "custom") {
        if (data.character_order) {
            MoveAllStudents(data.character_order);
        }
    }
    else {
        FullSort(type);
    }
}

function SwitchCharacter(direction) {

    let curChar = document.getElementById("char_" + modalCharID);

    let nextCharId;

    if (direction == "right") {
        let nextChar = curChar.nextSibling;
        if (!nextChar || nextChar.id == "addCharButton") {
            nextCharId = document.getElementById("charsContainer").firstElementChild.id;
        }
        else {
            nextCharId = nextChar.id;
        }
    }
    else if (direction == "left") {
        let nextChar = curChar.previousElementSibling;
        if (!nextChar) {
            nextCharId = document.getElementById("charsContainer").lastElementChild.previousElementSibling.previousElementSibling.id;
        }
        else {
            nextCharId = nextChar.id;
        }
    }

    if (nextCharId) {
        nextCharId = nextCharId.substring(5);
    }

    closeModal(true);

    setTimeout(() => {
        document.getElementById("char_" + nextCharId).click();
    }, 10);
}