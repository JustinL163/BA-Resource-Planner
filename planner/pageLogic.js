var curID = 0;
var modalCharID = 0;
var modalChar = "";
var modalStars = { "star": 0, "star_target": 0, "ue": 0, "ue_target": 0 };
var data;
const ueStarCap = 3;
const globalMaxWorld = 16;

var requiredMatDict = {};
var neededMatDict = {};
var ownedMatDict = {};
var charMatDicts = {};
var resourceDisplay = "Remaining";
var gearDisplay = "Remaining";
var mainDisplay = "Characters";

var charOptions = {};
var disabledChars = [];

let swappableStrikers, swappableSpecials;

let groupChars = [];
let groupStrikerOptions = {};
let groupSpecialOptions = {};
let groupStrikerBorrows = {};
let groupSpecialBorrows = {};
let groupEditMode = "Move";
let currentGroup = "";
let borrowed = false;

const defaultGroups = ["Binah", "Chesed", "Hod", "ShiroKuro", "Perorodzilla", "Hieronymous", "Kaiten"];

var sweepMax = 0;
let sweepMin = 0;

var saveTime = 0;
var toastCooldownTime = 0;
var toastCooldownMsg = "";

var charMode = "Edit";

var misc_data, charlist, skillinfo;

let charMap, charNames, inputMap;

let focusedInput;
let navigationObjects = {};

let preInput;

let tooltips = [];

let keyPressed = {};
let modalOpen = "";
let pageTheme = "dark";
let alertColour = "#e1e1e1";

let loaded = false;

function loadResources() {

    $.getJSON('misc_data.json?5').done(function (json) {
        misc_data = json;
        checkResources();
    });

    $.getJSON('skillinfo.json?3').done(function (json) {
        skillinfo = json;
        checkResources();
    });

    $.getJSON('charlist.json?7').done(function (json) {
        charlist = json;
        checkResources();
    });

}

function checkResources() {

    if (charlist && misc_data && skillinfo) {

        charMap = new Map()
        charNames = new Map()

        for (key in charlist) {
            charMap.set(charlist[key].Name, key);
            charNames.set(key, charlist[key].Name);
        }

        if (data != null) {

            for (var i = 0; i < data.characters.length; i++) {

                calculateCharResources(data.characters[i], false);
            }
        }

        generateCharOptions();
        generateTeamBorrowOptions();
        validateData();

        loaded = true;
    }

}

function init() {

    data = tryParseJSON(localStorage.getItem('save-data'));

    loadResources();

    if (data == null) {
        data = { exportVersion: exportDataVersion, characters: [], disabled_characters: [], owned_materials: {}, groups: {} };
        localStorage.setItem("save-data", JSON.stringify(data));
    }

    if (data != null) {
        if (data.disabled_characters != undefined) {
            disabledChars = data.disabled_characters;
        }

        if (!data.groups) {
            data.groups = {};
        }

        let charsContainer = document.getElementById("charsContainer");

        if (data.character_order) {
            for (let i = 0; i < data.character_order.length; i++) {
                let char = data.characters.find(obj => { return obj.id == data.character_order[i] });

                if (char) {
                    createCharBox(char.name, char.id, charsContainer, "main");
                }
            }
        }

        for (var i = 0; i < data.characters.length; i++) {

            // remove later maybe
            if (data.characters[i].eleph == undefined) {
                let eleph = data.characters[i].eleph = {};
                eleph.owned = 0;
                eleph.unlocked = true;
                eleph.cost = 1;
                eleph.purchasable = 20;
                eleph.farm_nodes = 0;
                eleph.node_refresh = false;
                eleph.use_eligma = false;
                eleph.use_shop = false;
            }

            if (document.getElementById('char_' + data.characters[i].id) == undefined) {
                createCharBox(data.characters[i].name, data.characters[i].id, charsContainer, "main");
            }
        }

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

        if (data.server == "Global") {
            serverToggleBtn.innerText = "Gbl";
        }
        else if (data.server == "JP") {
            serverToggleBtn.innerText = "JP";
        }
    }

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
    newDiv.onclick = newCharClicked;
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
    modeP.innerText = "Edit Mode";
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
            e.cancel()
        }
    })

    sortable.on("sortable:stop", (e) => {
        keyPressed.Shift = false;

        saveTime = Date.now() + 5 * 1000;
    })

    let tableNavigation = [];

    // generate resource modal tables
    createTable("school-mat-table", ["BD_4", "BD_3", "BD_2", "BD_1", "TN_4", "TN_3", "TN_2", "TN_1"], 0,
        ["Hyakkiyako", "Red Winter", "Trinity", "Gehenna", "Abydos", "Millennium", "Arius", "Shanhaijing", "Valkyrie"], 0,
        tableNavigation, document.getElementById("table-parent-1"), false, "resource", "icons/SchoolMat/");
    createTable("artifact-table-1", ["4", "3", "2", "1"], 0,
        ["Nebra", "Phaistos", "Wolfsegg", "Nimrud", "Mandragora", "Rohonc", "Aether"], 9,
        tableNavigation, document.getElementById("table-parent-2"), true, "resource", "icons/Artifact/");
    createTable("artifact-table-2", ["4", "3", "2", "1"], 4,
        ["Antikythera", "Voynich", "Haniwa", "Totem", "Baghdad", "Colgante", "Mystery"], 9,
        tableNavigation, document.getElementById("table-parent-3"), true, "resource", "icons/Artifact/");

    let gearNavigation = [];
    createTable("gear-table", ["T7", "T6", "T5", "T4", "T3", "T2"], 0, ["Hat", "Gloves", "Shoes", "Bag", "Badge", "Hairpin", "Charm", "Watch", "Necklace"],
        0, gearNavigation, document.getElementById('table-parent-4'), false, "gear", "icons/Gear/");

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

    if ("1.2.0".localeCompare(data.site_version ?? "0.0.0", undefined, { numeric: true, sensitivity: 'base' }) == 1) {
        var updateMessage = ("If anything seems broken, try 'hard refreshing' the page (google it)<br>" +
            "If still having issues, contact me on Discord, Justin163#7721");
        Swal.fire({
            title: "Updated to Version 1.2.0",
            color: alertColour,
            html: updateMessage
        })

        data.site_version = "1.2.0";
        saveToLocalStorage(false);
    }

    // set input validation

    inputMap = new Map();

    for (let key in inputValidation) {

        let inputElement = null;

        if (inputValidation[key].id != undefined) {
            inputElement = document.getElementById(inputValidation[key].id);
            inputMap.set(inputValidation[key].id, key);
        }

        if (inputElement != null) {

            if (inputValidation[key].min != undefined) {
                inputElement.min = inputValidation[key].min;
            }

            if (inputValidation[key].max != undefined) {
                inputElement.max = inputValidation[key].max;
            }

            inputElement.addEventListener('input', (event) => {
                let result = validateInput(key, false, false);

                if (result != "validated" && (Date.now() > toastCooldownTime || toastCooldownMsg != result)) {

                    toastCooldownTime = Date.now() + 1000 * 10;
                    toastCooldownMsg = result;

                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        title: 'Invalid input',
                        text: result,
                        color: alertColour,
                        showConfirmButton: false,
                        timer: 4000
                    })
                }

                updateTooltip(modalChar, key);
            })

            inputElement.addEventListener('focusin', (event) => {
                focusedInput = event.target.id;
                event.target.select();
            })

            inputElement.addEventListener('beforeinput', (event) => {
                preInput = event.target.value;
            })

            let location = inputValidation[key].location;

            inputElement.addEventListener('focusout', (event) => {
                focusedInput = null;
                let result = validateInput(key, false, true);

                if (result != "validated" && (Date.now() > toastCooldownTime || toastCooldownMsg != result)) {

                    toastCooldownTime = Date.now() + 1000 * 10;
                    toastCooldownMsg = result;

                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        title: 'Invalid input',
                        text: result,
                        showConfirmButton: false,
                        timer: 4000
                    })
                }

                if (location == "characterModal" && result == "validated") {
                    populateCharResources(modalChar)

                    if (event.target.id == "input_gear1_current" || event.target.id == "input_gear2_current" || event.target.id == "input_gear3_current") {

                        if (event.target.value != "0") {

                            let charInfo = charlist[charMap.get(modalChar)];

                            if (event.target.id == "input_gear1_current") {
                                document.getElementById("gear1-img").src = "icons/Gear/T" + event.target.value + "_" + charInfo.Equipment.Slot1 + ".png";
                            }
                            else if (event.target.id == "input_gear2_current") {
                                document.getElementById("gear2-img").src = "icons/Gear/T" + event.target.value + "_" + charInfo.Equipment.Slot2 + ".png";
                            }
                            else if (event.target.id == "input_gear3_current") {
                                document.getElementById("gear3-img").src = "icons/Gear/T" + event.target.value + "_" + charInfo.Equipment.Slot3 + ".png";
                            }
                        }
                        else {

                            let charInfo = charlist[charMap.get(modalChar)];

                            if (event.target.id == "input_gear1_current") {
                                document.getElementById("gear1-img").src = "icons/Gear/T1_" + charInfo.Equipment.Slot1 + ".png";
                            }
                            else if (event.target.id == "input_gear2_current") {
                                document.getElementById("gear2-img").src = "icons/Gear/T1_" + charInfo.Equipment.Slot2 + ".png";
                            }
                            else if (event.target.id == "input_gear3_current") {
                                document.getElementById("gear3-img").src = "icons/Gear/T1_" + charInfo.Equipment.Slot3 + ".png";
                            }
                        }

                    }
                }
            })

        }

    }

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

    var starButtons = document.getElementsByClassName("star-icon");

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

    document.getElementById('switch-resource-owned').innerText = 'Switch to\nOwned';
    document.getElementById('switch-resource-total').innerText = 'Switch to\nTotal Needed';
    document.getElementById('switch-resource-remaining').innerText = 'Switch to\nRemaining Needed';

    document.getElementById('switch-gear-owned').innerText = 'Switch to\nOwned';
    document.getElementById('switch-gear-total').innerText = 'Switch to\nTotal Needed';
    document.getElementById('switch-gear-remaining').innerText = 'Switch to\nRemaining Needed';

    document.getElementById('current-resource-display').innerText = "Remaining Needed";
    document.getElementById('current-gear-display').innerText = "Remaining Needed";

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
        content: "Sum of Remaining Needed XP for the three non universal parts",
        theme: 'light'
    });

    tippy('#owned-all', {
        content: "Leftover XP, (excludes bonus except for universal Needle)",
        theme: 'light'
    })

    tippy('#spring-all', {
        content: "Used for gun types: SMG, SG, HG",
        theme: 'light'
    })

    tippy('#hammer-all', {
        content: "Used for gun types: AR, GL",
        theme: 'light'
    })

    tippy('#barrel-all', {
        content: "Used for gun types: MG, SR, RG, RL, MT",
        theme: 'light'
    })

    tippy('#label_char_unlocked', {
        content: "Whether you actually own the character, otherwise adds to the Eleph needed by the character unlock amount",
        theme: 'light'
    })

    tippy('#label_eleph_cost', {
        content: "Current price per Eleph in Eligma store",
        theme: 'light'
    })

    tippy('#label_eleph_purchasable', {
        content: "Number purchasable at current price tier (check in Eligma store by clicking Max to find the number from 1-20)",
        theme: 'light'
    })

    tippy('#label_node_refresh', {
        content: "If you are pyro resetting nodes for this character, doubles max allowed sweep attempts",
        theme: 'light'
    })

    tippy('#hm-server-toggle', {
        content: "Switch between Global/JP hardmode stages allowed",
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

    document.addEventListener('keydown', function (e) {

        keyPressed[e.key] = true; //+ e.location] = true;

        handleKeydown(e, keyPressed);

    }, false);

    document.addEventListener('keyup', function (e) {
        delete (keyPressed[e.key]) // = false //+ e.location] = false;

        if (keyPressed.Control == true || keyPressed.Shift == true) {

        }
        else {

            keyPressed = {};
        }

    }, false);

}

function validateData() {

    for (key in charlist) {

        if (!misc_data.gun_ue_category[charlist[key].WeaponType]) {
            console.log("misc_data.json missing gun_ue_category value for " + charlist[key].WeaponType);
        }

    }

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
    }
}

async function sectionQuickSet(section) {

    optionData = {
        "Gear": {
            " 666": {
                "6 6 6 6 6 6": "Both",
                "- 6 - 6 - 6": "Target"
            },
            " 555": {
                "5 5 5 5 5 5": "Both",
                "- 5 - 5 - 5": "Target"
            },
            " 444": {
                "4 4 4 4 4 4": "Both",
                "- 4 - 4 - 4": "Target"
            },
            " 333": {
                "3 3 3 3 3 3": "Both",
                "- 3 - 3 - 3": "Target"
            },
            " 222": {
                "2 2 2 2 2 2": "Both",
                "- 2 - 2 - 2": "Target"
            },
            " 111": {
                "1 1 1 1 1 1": "Both",
                "- 1 - 1 - 1": "Target"
            }
        },
        "Skills": {
            " MMMM": {
                "5 5 10 10 10 10 10 10": "Both",
                "- 5 - 10 - 10 - 10": "Target"
            },
            " M777": {
                "5 5 7 7 7 7 7 7": "Both",
                "- 5 - 7 - 7 - 7": "Target"
            },
            " M444": {
                "5 5 4 4 4 4 4 4": "Both",
                "- 5 - 4 - 4 - 4": "Target"
            },
            " 3777": {
                "3 3 7 7 7 7 7 7": "Both",
                "- 3 - 7 - 7 - 7": "Target"
            },
            " 3444": {
                "3 3 4 4 4 4 4 4": "Both",
                "- 3 - 4 - 4 - 4": "Target",
            },
            " 1444": {
                "1 1 4 4 4 4 4 4": "Both",
                "- 1 - 4 - 4 - 4": "Target",
            },
            " 1111": {
                "1 1 1 1 1 1 1 1": "Both",
                "- 1 - 1 - 1 - 1": "Target"
            }
        },
        "Level": {
            " 78": {
                "78 78": "Both",
                "- 78": "Target"
            },
            " 75": {
                "75 75": "Both",
                "- 75": "Target"
            },
            " 73": {
                "73 73": "Both",
                "- 73": "Target"
            },
            " 70": {
                "70 70": "Both",
                "- 70": "Target"
            },
            " 35": {
                "35 35": "Both",
                "- 35": "Target"
            }
        }
    }

    inputIds = {
        "Gear": [
            "input_gear1_current",
            "input_gear1_target",
            "input_gear2_current",
            "input_gear2_target",
            "input_gear3_current",
            "input_gear3_target"
        ],
        "Skills": [
            "input_ex_current",
            "input_ex_target",
            "input_basic_current",
            "input_basic_target",
            "input_enhanced_current",
            "input_enhanced_target",
            "input_sub_current",
            "input_sub_target"
        ],
        "Level": [
            "input_level_current",
            "input_level_target"
        ]
    }

    if (optionData[section] != undefined) {

        const { value: newData } = await Swal.fire({
            title: 'Quick data select',
            input: 'select',
            inputOptions: optionData[section],
            inputPlaceholder: 'Select an option',
            showCancelButton: true
        })

        if (newData) {
            let inputs = inputIds[section];

            let values = newData.split(' ');

            for (let i = 0; i < inputs.length; i++) {
                let input = document.getElementById(inputs[i]);

                if (input && values[i] != "-") {
                    input.value = values[i];
                }
            }

            for (let i = 0; i < inputs.length; i++) {
                let property = inputs[i].replace("input_", '').replace("_current", '');

                validateInput(property, false, true);
            }
        }
    }

}

function inputNavigate(direction) {

    if (focusedInput) {

        let targetCell;

        let property = inputMap.get(focusedInput);

        if (property && inputValidation[property]?.navigation) {

            let navValue = inputValidation[property].navigation;

            targetCell = inputValidation[property][direction];

            if (!targetCell) {
                let navObj = navigationObjects[navValue];

                if (navObj && navObj.type == "table") {

                    let cell = navObj.object.revGet(focusedInput);

                    let targetPos = findPosString(cell, direction, navValue);
                    targetCell = navObj.object.get(targetPos);
                }
            }
        }

        if (targetCell) {

            let targetInput = document.getElementById(targetCell);

            targetInput.classList.add('focused');
            targetInput.parentElement.classList.add('focused');
            targetInput.focus();
            targetInput.select();
        }
    }

}

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

    modeButton.children[0].innerText = charMode + " Mode";

}

function validateInput(key, checkonly, verbose) {

    if (inputValidation[key] != undefined) {

        var val = inputValidation[key];

        if (val.id == undefined) {
            return "key_no_id";
        }

        var inputElement = document.getElementById(val.id);

        if (inputElement == null) {
            return "element_null";
        }

        if (keyPressed.m) {
            inputElement.value = val.max;
        }

        if (inputElement.value == '') {
            if ((preInput || preInput == 0) && keyPressed.Delete != true && keyPressed.Backspace != true) {
                inputElement.value = preInput;
            }
            else {
                inputElement.value = '';
            }
        }

        if (inputElement.value.length > val.max?.length) {
            if (checkonly) {
                return "too_long";
            }
            if (preInput || preInput == 0) {
                inputElement.value = preInput;
            }
            else {
                inputElement.value = val.max;
            }
        }

        if (parseInt(inputElement.value) > parseInt(val.max)) {
            if (checkonly) {
                return "too_large";
            }
            if (preInput || preInput == 0) {
                inputElement.value = preInput;
            }
            else {
                inputElement.value = val.max;
            }
        }

        if (parseInt(inputElement.value) < parseInt(val.min)) {
            if (checkonly) {
                return "too_small";
            }
            inputElement.value = val.min;
        }

        if (isNaN(parseInt(inputElement.value))) {
            if (checkonly) {
                return "not_number";
            }
        }

        if (inputElement.value.length > 1 && inputElement.value[0] == 0) {
            inputElement.value = parseInt(inputElement.value)
        }

        if (val.requisite != undefined) {

            for (let reqKey in val.requisite) {

                let checkMax = null, checkMin = null, lastReq = null, message = null, minMessage = null, maxMessage = null;
                let valReq = val.requisite[reqKey];
                let reqName = valReq.name;
                let compareType = valReq.compare;
                let compareMode = valReq.mode;
                let sanitise = valReq.sanitise;
                let compareVal;

                if (valReq.type == "object") {

                    let objPath = reqKey.split('.');
                    let obj = this[objPath.shift()];
                    while (objPath.length) {
                        obj = obj[objPath.shift()];
                    }
                    // add check that compareVal is resolved to a value rather than object
                    compareVal = parseInt(obj);
                }
                else if (valReq.type == "input") {
                    let reqElement = document.getElementById(inputValidation[reqKey].id);
                    if (reqElement != null) {
                        compareVal = parseInt(reqElement.value);
                    }
                }

                if (compareMode == "threshold") {
                    let conditionFound = false;

                    for (l = 0; l < valReq.levels.length; l++) {

                        let reqValue = parseInt(valReq.levels[l].required);
                        let maxProp = valReq.levels[l].max;
                        let minProp = valReq.levels[l].min;

                        if (isNaN(reqValue)) {

                            if (compareType == "equal_greater" && lastReq != null) {
                                message = " requires " + reqName + " >" + lastReq;
                            }

                            conditionFound = true;
                        }

                        if (compareType == "equal_greater" && compareVal >= reqValue) {

                            if (lastReq != null) {
                                message = " requires " + reqName + " <" + lastReq;
                            }

                            conditionFound = true;
                        }

                        if (conditionFound) {

                            if (maxProp != undefined) {
                                checkMax = maxProp;
                            }

                            if (minProp != undefined) {
                                checkMin = minProp;
                            }

                            if (lastReq != null) {
                                if (checkMax != null) {
                                    maxMessage = val.name + " >" + checkMax + ", " + message;
                                }
                                if (checkMin != null) {
                                    minMessage = val.name + " <" + checkMin + ", " + message;
                                }
                            }

                            break;
                        }

                        lastReq = reqValue;

                    }

                    if (checkMax != null && parseInt(inputElement.value) > checkMax) {
                        if (!checkonly && sanitise) {
                            inputElement.value = checkMax;
                        }
                        return maxMessage;
                    }

                    if (checkMin != null && parseInt(inputElement.value) < checkMin) {
                        if (!checkonly && sanitise) {
                            inputElement.value = checkMin;
                        }
                        return minMessage;
                    }
                }
                else if (valReq.type == "object" && compareMode == "direct") {

                    if (compareType == "equal_greater") {
                        if (parseInt(inputElement.value) < compareVal) {
                            if (!checkonly && sanitise) {
                                inputElement.value = compareVal;
                            }
                            message = val.name + " must be greater than or equal to " + compareVal;
                            return message;
                        }
                    }
                    else if (compareType == "equal_lesser") {
                        if (parseInt(inputElement.value) > compareVal) {
                            if (!checkonly && sanitise) {
                                inputElement.value = compareVal;
                            }
                            message = val.name + " must be lesser than or equal to " + compareVal;
                            return message;
                        }
                    }
                    else if (compareType == "max") {
                        if (parseInt(inputElement.value) > compareVal) {
                            inputElement.value = compareVal;
                            message = val.name + " must be lesser than or equal to " + compareVal;
                            return "validated";
                        }
                    }
                }
                else if (verbose && compareMode == 'direct') {

                    let result = validateInput(reqKey, true, verbose);

                    if (result != "validated") {
                        return result;
                    }

                    if (compareType == "equal_greater") {
                        if (parseInt(inputElement.value) < compareVal) {
                            if (!checkonly && sanitise) {
                                inputElement.value = compareVal;
                            }
                            message = val.name + " must be greater than or equal to " + inputValidation[reqKey].name;
                            return message;
                        }
                    }
                    else if (compareType == "equal_lesser") {
                        if (parseInt(inputElement.value) > compareVal) {
                            if (!checkonly && sanitise) {
                                inputElement.value = compareVal;
                            }
                            message = val.name + " must be lesser than or equal to " + inputValidation[reqKey].name;
                            return message;
                        }
                    }

                }
            }
        }

        return "validated";
    }

}

async function newCharClicked() {


    const { value: character } = await Swal.fire({
        title: 'Add new character',
        input: 'select',
        inputOptions: charOptions,
        inputPlaceholder: 'Select a character',
        showCancelButton: true
    })

    if (character) {

        let charId = charMap.get(character);

        if (data.characters.find(obj => { return obj.id == charId }) != undefined) {
            return;
        }

        let charInfoObj = charlist[charId];

        let newCharObj = new Student(charInfoObj);

        // let newCharObj = { name: character, id: charId, star: charInfoObj?.BaseStar ?? 1, star_target: charInfoObj?.BaseStar ?? 1, ue: 0, ue_target: 0 }

        // defProperties = ['level', 'level_target', 'ue_level', 'ue_level_target', 'bond', 'bond_target', 'ex', 'ex_target', 'basic', 'basic_target', 'passive',
        //     'passive_target', 'sub', 'sub_target', 'gear1', 'gear1_target', 'gear2', 'gear2_target', 'gear3', 'gear3_target'];

        // for (let i = 0; i < defProperties.length; i++) {
        //     let defValue = inputValidation[defProperties[i]].default;
        //     if (defValue || defValue === 0) {
        //         newCharObj[defProperties[i]] = defValue;
        //     }
        // }

        data.characters.push(newCharObj);

        let charsContainer = document.getElementById("charsContainer");

        createCharBox(character, charId, charsContainer, "main");

        saveToLocalStorage(true);

        generateCharOptions();
    }
}

function generateCharOptions() {

    charOptions = {}

    let existing = getExistingCharacters();

    for (key in charlist) {
        let charName = charlist[key].Name;
        let school = charlist[key].School;

        if (!existing.includes(charName)) {

            if (school) {

                if (!charOptions[school]) {
                    charOptions[school] = {};
                }

                charOptions[school][charName] = charName;
            }
            else {

                if (!charOptions["Unassigned"]) {
                    charOptions["Unassigned"] = {};
                }

                charOptions["Unassigned"][charName] = charName;
            }
        }
    }

    charOptions = sortObject(charOptions);

    for (key in charOptions) {
        charOptions[key] = sortObject(charOptions[key]);
    }

}

function sortObject(obj) {
    return Object.keys(obj).sort().reduce(function (result, key) {
        result[key] = obj[key];
        return result;
    }, {});
}

function getExistingCharacters() {

    var existChars = [];

    for (i = 0; i < data?.characters.length; i++) {
        existChars.push(data.characters[i].name);
    }

    return existChars;

}

function deleteClicked() {
    Swal.fire({
        title: 'Are you sure?',
        text: 'This will remove the selected character and all data associated with it.',
        color: alertColour,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Confirm deletion'
    }).then((result) => {
        if (result.isConfirmed) {
            deleteChar(modalChar);
            closeModal(false, true);
        }
    })
}

function deleteChar(character) {

    if (character) {

        let charId = charMap.get(character)
        var charObject = data.characters.find(obj => { return obj.id == charId });
        var index = data.characters.indexOf(charObject);
        data.characters.splice(index, 1);

        delete charMatDicts[character];

        var disableIndex = disabledChars.indexOf(character);
        if (disableIndex != -1) {
            disabledChars.splice(disableIndex, 1);
        }

        data.disabled_characters = disabledChars;

        var charBox = document.getElementById("char_" + charId);
        if (charBox != null) {
            charBox.remove();
        }

        generateCharOptions();

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

    if (mode) {
        let top = $("body").scrollTop();
        $("body").css('position', 'fixed').css('overflow', 'hidden').css('top', -top).css('width', '100%');
    }
    else {
        let top = $("body").position().top;
        $("body").css('position', 'relative').css('overflow', 'auto').css('top', 0).scrollTop(-top);
    }
}

function openModal(e) {

    if (!loaded) {
        return;
    }

    var fromChar = false;
    if (this.id.substring(0, 5) == "char_") {
        fromChar = true;
    }

    if (charMode == "Disable" || (e.ctrlKey && fromChar == true)) {
        var charId = this.id.substring(5);

        let charSelected = charNames.get(charId);
        var charData = data.characters.find(obj => { return obj.id == charId });


        if (disabledChars.includes(charSelected)) {
            this.classList.remove("deselected");
            charData.enabled = true;
            var index = disabledChars.indexOf(charSelected);
            if (index !== -1) {
                disabledChars.splice(index, 1);
            }
        }
        else {
            this.classList.add("deselected");
            charData.enabled = false;
            disabledChars.push(charSelected);
        }

        data.disabled_characters = disabledChars;

        saveTime = Date.now() + (1000 * 5);

        return;
    }

    if (charMode == "Move" || keyPressed.Shift == true) {
        return;
    }

    var modal = document.getElementById("characterModal");


    modalCharID = this.id;

    if (fromChar) {
        freezeBody(true);
        modalOpen = "characterModal";
        this.style = "visibility:hidden";

        modal.style.visibility = "visible";

        document.getElementById('character-modal-wrapper').style.visibility = "hidden";

        let charId = this.id.substring(5);

        var charSelected = charNames.get(charId);

        document.getElementById('char-eleph').src = "icons/Eleph/Eleph_" + charId + ".png";
        document.getElementById('char-eleph-needed-icon').src = "icons/Eleph/Eleph_" + charId + ".png";

        let hardModes = misc_data.hard_modes[charId];
        let shopCharacter = misc_data.shop_characters[charId];
        let shopCurrency;

        let currencyDescriptorText = document.getElementById('char-currency-descriptor');
        let charShopCurrencyText = document.getElementById('char-shop-currency');
        let buyOptionTwo = document.getElementById('buy-option-two');

        populateCharModal(charSelected);

        populateCharResources(charSelected);

        let cost = document.getElementById('input_eleph_cost').value;

        if (cost == 5) {
            document.getElementById('label_eleph_purchasable').style.visibility = 'hidden';
            document.getElementById('input_eleph_purchasable').style.visibility = 'hidden';
        }
        else {
            document.getElementById('label_eleph_purchasable').style.visibility = '';
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

            sweepMax = hardModeNodes * 3; sweepMin = hardModeNodes * 3;
            if (document.getElementById('input_allow_node_refresh').checked) {
                sweepMax = hardModeNodes * 6;
            }

            document.getElementById("hard-nodes-count").innerText = "/ " + sweepMax;

            currencyDescriptorText.innerText = "Avg Days";

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
                currencyDescriptorText.innerText = "Min Raids";
                charShopCurrencyText.innerText = "Raid Tokens";
            }
            else if (shopCurrency == "RareRaidToken") {
                currencyDescriptorText.innerText = "Min Raids";
                charShopCurrencyText.innerText = "Rare Raid Tokens";
            }
            else if (shopCurrency == "ArenaCoin") {
                currencyDescriptorText.innerText = "Shop Resets";
                charShopCurrencyText.innerText = "TC Coins";
            }
            else if (shopCurrency == "JECoin") {
                currencyDescriptorText.innerText = "Shop Resets";
                charShopCurrencyText.innerText = "JE Coins";
            }
            else if (shopCurrency == "MasteryCertificate") {
                currencyDescriptorText.innerText = "Shop Resets";
                charShopCurrencyText.innerText = "Certificates";
            }

            document.getElementById("shop-currency-icon").src = "icons/Misc/" + shopCurrency + ".png";
            document.getElementById("shop-currency-icon2").src = "icons/Misc/" + shopCurrency + ".png";
        }
        else {
            document.getElementById("content-13").style.display = "none";
            document.getElementById("input_farm_nodes").value = 0;
            buyOptionTwo.style.display = "none";
        }

        modalChar = charSelected;

        var displayImg = document.getElementById("displayImg");
        displayImg.src = "icons/Portrait/Icon_" + charMap.get(charSelected) + ".png";

        var displayName = document.getElementById("displayName");
        displayName.innerText = charSelected

        var displayChar = document.getElementById("displayChar");
        displayChar.style = "display:inline-flex; visibility: visible";
        var initLeft = this.getBoundingClientRect().left - displayChar.getBoundingClientRect().left;
        var initTop = this.getBoundingClientRect().top - displayChar.getBoundingClientRect().top;
        modalCharLeft = initLeft;
        modalCharTop = initTop;
        displayChar.style = "display:inline-flex; visibility: visible; transform: translate(" + Math.round(initLeft) + "px, " + Math.round(initTop) + "px);";

        setTimeout(() => {
            displayChar.style = "display:inline-flex; visibility: visible; transform: translate(0px, 0px); transition: all 0.3s;"

            setTimeout(() => {
                modal.style.visibility = "visible";
                document.getElementById('character-modal-wrapper').style.visibility = "visible";

                var modalSections = document.getElementsByClassName("modal-content-section");

                for (i = 0; i < modalSections.length; i++) {
                    modalSections[i].classList.add("animate-pop");
                }

            }, 300);
        }, 10);

    }

    modal.onclick = function (event) {
        if (event.target == modal) {
            closeModal(fromChar);
        }
    };
}

function closeModal(animated, forced) {

    freezeBody(false);

    if (!forced && isCharModalDirty()) {
        Swal.fire({
            title: 'Unsaved Changes',
            showDenyButton: true,
            confirmButtonText: 'Go back',
            denyButtonText: 'Discard changes',
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
        var displayChar = document.getElementById("displayChar");
        displayChar.style = "display:inline-flex;";

        var modalWrapper = document.getElementsByClassName("modal-content-wrapper")[0]

        document.getElementById('character-modal-wrapper').style.visibility = "";
        modal.style.visibility = "hidden";
        return;
    }

    //var backgroundFill = document.getElementsByClassName("fill-layer")[0];
    //backgroundFill.className = "unfill-layer";

    var displayChar = document.getElementById("displayChar");

    var selectedChar = document.getElementById(modalCharID);
    var charLeft = selectedChar.getBoundingClientRect().left - displayChar.getBoundingClientRect().left;
    var charTop = selectedChar.getBoundingClientRect().top - displayChar.getBoundingClientRect().top;

    //setTimeout(() => {
    var modalWrapper = document.getElementsByClassName("modal-content-wrapper")[0]

    document.getElementById('character-modal-wrapper').style.visibility = "hidden";

    var modalSections = document.getElementsByClassName("modal-content-section");

    for (i = 0; i < modalSections.length; i++) {
        modalSections[i].classList.remove("animate-pop");
    }

    displayChar.style = "display:inline-flex; visibility: visible; transform: translate(" + charLeft + "px, " + charTop + "px); transition: all 0.3s;";

    setTimeout(() => {
        selectedChar.style.visibility = "visible";
        displayChar.style.transition = "none";
        displayChar.style.visibility = "hidden";
        modal.style.visibility = "hidden";
        //backgroundFill.remove();
        //modalWrapper.style.backgroundColor = "white";
    }, 300);

    //}, 1000);

}

function teamsToggle() {

    let boxesContainer = document.getElementById('boxesContainer');
    let teamsEditorContainer = document.getElementById('teamsEditorContainer');
    let buttonText = document.getElementById('teamsEditorButton');

    if (mainDisplay == "Characters") {
        mainDisplay = "Teams";
        boxesContainer.style.display = "none";
        teamsEditorContainer.style.display = "";
        buttonText.innerText = "Characters"
        generateTeamCharOptions();
        $("div#viewFilters")[0].style.display = 'none';
        if (currentGroup) {
            clearTeams();
            borrowed = false;
            loadGroup(currentGroup);
        }
    }
    else if (mainDisplay == "Teams") {
        mainDisplay = "Characters";
        boxesContainer.style.display = "";
        teamsEditorContainer.style.display = "none";
        buttonText.innerText = "Teams Editor"
        rebuildFilters();
        resetFilters();
    }
}

function generateTeamBorrowOptions() {

    groupStrikerBorrows = {};
    groupSpecialBorrows = {};

    for (key in charlist) {

        let charName = charNames.get(key);

        let school = charlist[key].School;
        let damageType = charlist[key].DamageType;
        let type = charlist[key].Type;

        if (damageType) {

            if (type == "Striker") {
                if (!groupStrikerBorrows[damageType]) {
                    groupStrikerBorrows[damageType] = {};
                }

                groupStrikerBorrows[damageType][charName] = charName;
            }
            else if (type == "Special") {
                if (!groupSpecialBorrows[damageType]) {
                    groupSpecialBorrows[damageType] = {};
                }

                groupSpecialBorrows[damageType][charName] = charName;
            }
        }
        else {

            if (type == "Striker") {
                if (!groupStrikerBorrows["Unassigned"]) {
                    groupStrikerBorrows["Unassigned"] = {};
                }

                groupStrikerBorrows["Unassigned"][charName] = charName;
            }
            else if (type == "Special") {
                if (!groupSpecialBorrows["Unassigned"]) {
                    groupSpecialBorrows["Unassigned"] = {};
                }

                groupSpecialBorrows["Unassigned"][charName] = charName;
            }
        }
    }

    groupStrikerBorrows = sortObject(groupStrikerBorrows);

    for (key in groupStrikerBorrows) {
        groupStrikerBorrows[key] = sortObject(groupStrikerBorrows[key]);
    }

    groupSpecialBorrows = sortObject(groupSpecialBorrows);

    for (key in groupSpecialBorrows) {
        groupSpecialBorrows[key] = sortObject(groupSpecialBorrows[key]);
    }

}

function generateTeamCharOptions() {

    groupStrikerOptions = {};
    groupSpecialOptions = {};

    let existing = getExistingCharacters();

    for (let i = 0; i < existing.length; i++) {

        if (!groupChars.includes(existing[i])) {
            let charId = charMap.get(existing[i]);

            let school = charlist[charId].School;
            let damageType = charlist[charId].DamageType;
            let type = charlist[charId].Type;

            if (damageType) {

                if (type == "Striker") {
                    if (!groupStrikerOptions[damageType]) {
                        groupStrikerOptions[damageType] = {};
                    }

                    groupStrikerOptions[damageType][existing[i]] = existing[i];
                }
                else if (type == "Special") {
                    if (!groupSpecialOptions[damageType]) {
                        groupSpecialOptions[damageType] = {};
                    }

                    groupSpecialOptions[damageType][existing[i]] = existing[i];
                }
            }
            else {

                if (type == "Striker") {
                    if (!groupStrikerOptions["Unassigned"]) {
                        groupStrikerOptions["Unassigned"] = {};
                    }

                    groupStrikerOptions["Unassigned"][existing[i]] = existing[i];
                }
                else if (type == "Special") {
                    if (!groupSpecialOptions["Unassigned"]) {
                        groupSpecialOptions["Unassigned"] = {};
                    }

                    groupSpecialOptions["Unassigned"][existing[i]] = existing[i];
                }
            }
        }

    }

    groupStrikerOptions = sortObject(groupStrikerOptions);

    for (key in groupStrikerOptions) {
        groupStrikerOptions[key] = sortObject(groupStrikerOptions[key]);
    }

    groupSpecialOptions = sortObject(groupSpecialOptions);

    for (key in groupSpecialOptions) {
        groupSpecialOptions[key] = sortObject(groupSpecialOptions[key]);
    }
}

function addNewTeam(team) {

    if (currentGroup == "") {
        basicAlert("Select group first");
        return;
    }

    let teamsContainer = document.getElementById('teamsContainer');

    let teamNum = (teamsContainer.childElementCount + 1);

    if (teamNum > 6) {
        Swal.fire({
            toast: true,
            position: 'top-start',
            title: "Can't add more than 6 teams",
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
    new_teamLabel.innerText = "Team " + teamNum;
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
                    createCharBox(charName, team[i].id, blankSlot, "borrow");
                    groupChars.push(charName);
                }
            }
            else {
                let charName = charNames.get(team[i]);
                if (charName) {
                    createCharBox(charName, team[i], blankSlot, "teams");
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
                    createCharBox(charName, team[i + 4].id, blankSlot, "borrow");
                    groupChars.push(charName);
                }
            }
            else {
                let charName = charNames.get(team[i + 4]);
                if (charName) {
                    createCharBox(charName, team[i + 4], blankSlot, "teams");
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

    let teamNum = parseInt(teamDiv.innerText.substring(5));

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
        nextTeam.children[0].innerText = "Team " + (teamNum + subsequentTeam - 1);
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
        title: 'Create new group',
        input: 'text',
        inputPlaceholder: 'New group name',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) {
                return "Name can't be empty";
            }

            if (value.length > 15) {
                return "Name must be less than or equal to 15 characters long";
            }

            if (defaultGroups.includes(value) || value == "blankselect") {
                return "Can't use that name";
            }

            if ($("#select-groups option[value='" + value + "']").length > 0) {
                return "Group with name already exists";
            }
        }
    })

    if (groupName) {
        clearTeams();
        generateTeamCharOptions();

        currentGroup = groupName;
        addNewTeam([null, null, null, null, null, null]);
        borrowed = false;

        let selectElement = document.getElementById('select-groups');
        addOption(selectElement, groupName, groupName);

        selectElement.value = groupName;
    }

}

function addOption(selectElement, text, value) {
    let newGroupOption = document.createElement('option');
    newGroupOption.text = text;
    newGroupOption.value = value;
    selectElement.add(newGroupOption);
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

async function pickCharacter(slotDivId, type) {

    let options, optionsBorrow;
    if (type == "Striker") {
        options = groupStrikerOptions;
        optionsBorrow = groupStrikerBorrows;
    }
    else if (type == "Special") {
        options = groupSpecialOptions;
        optionsBorrow = groupSpecialBorrows;
    }

    let getBorrow = false;
    let character;

    await Swal.fire({
        title: 'Add new character',
        input: 'select',
        inputOptions: options,
        inputPlaceholder: 'Select a character',
        showCancelButton: true,
        showDenyButton: !borrowed,
        denyButtonText: 'Borrow',
        denyButtonColor: '#dc9641'
    }).then((result) => {
        if (result.isConfirmed) {
            character = result.value;
        }
        else if (result.isDenied) {
            getBorrow = true;
        }
    })

    if (getBorrow) {
        const { value: borrow } = await Swal.fire({
            title: 'Add borrow character',
            input: 'select',
            inputOptions: optionsBorrow,
            inputPlaceholder: 'Select a character',
            showCancelButton: true
        })

        if (borrow) {
            let slotContainer = document.getElementById(slotDivId);

            let slotChildren = slotContainer.children;

            for (let i = 0; i < slotChildren.length; i++) {
                slotChildren[i].remove();
            }

            createCharBox(borrow, charMap.get(borrow), slotContainer, "borrow");

            borrowed = true;
            saveGroup();
        }
    }

    if (character) {
        let slotContainer = document.getElementById(slotDivId);

        let slotChildren = slotContainer.children;

        for (let i = 0; i < slotChildren.length; i++) {
            slotChildren[i].remove();
        }

        createCharBox(character, charMap.get(character), slotContainer, "teams");
        groupChars.push(character);

        saveGroup();

        generateTeamCharOptions();
    }
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
        basicAlert("Select group first");
        return;
    }

    Swal.fire({
        title: 'Are you sure?',
        text: 'This will clear the whole group and its teams',
        color: alertColour,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Confirm deletion'
    }).then((result) => {
        if (result.isConfirmed) {
            clearTeams();
            document.getElementById('select-groups').value = "blankselect";

            if (!defaultGroups.includes(currentGroup)) {

                $("#select-groups option[value='" + currentGroup + "']").remove();
            }

            if (data.groups[currentGroup]) {

                delete (data.groups[currentGroup]);
                saveTime = Date.now() + (1000 * 5);
            }

            currentGroup = "";
        }
    })
}

async function renameGroup() {

    if (currentGroup == "") {
        basicAlert("Select group first");
        return;
    }

    if (defaultGroups.includes(currentGroup)) {
        Swal.fire({
            title: "Defaut groups can't be renamed",
            icon: 'warning'
        })
    }
    else {
        const { value: groupName } = await Swal.fire({
            title: 'Rename group',
            input: 'text',
            inputPlaceholder: 'New group name',
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) {
                    return "Name can't be empty";
                }

                if (value.length > 15) {
                    return "Name must be less than or equal to 15 characters long";
                }

                if (defaultGroups.includes(value) || value == "blankselect") {
                    return "Can't use that name";
                }

                if ($("#select-groups option[value='" + value + "']").length > 0) {
                    return "Group with name already exists";
                }
            }
        })

        if (groupName) {
            let option = $("#select-groups option[value='" + currentGroup + "']");

            if (option.length > 0) {
                option[0].text = groupName;
                option[0].value = groupName;
            }

            if (data.groups && data.groups[currentGroup]) {
                data.groups[groupName] = data.groups[currentGroup];
                delete (data.groups[currentGroup]);

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

function rebuildGroups() {

    let selectElement = document.getElementById('select-groups');

    let options = selectElement.children;
    while (options.length > 1) {
        options[1].remove();
    }

    for (let i = 0; i < defaultGroups.length; i++) {

        addOption(selectElement, defaultGroups[i], defaultGroups[i]);
    }

    if (data.groups) {

        for (key in data.groups) {

            if (!defaultGroups.includes(key)) {
                addOption(selectElement, key, key);
            }
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

    addOption(filterGroups, "All", "All");

    if (data.groups) {

        for (key in data.groups) {
            addOption(filterGroups, key, key);
        }
    }

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
            filtered = charsFromGroup(groupName);
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

                if (team[i] != null && typeof (team[i] != "object")) {
                    inGroup.push(team[i]);
                }
            }

        }

    }

    return inGroup;

}

function charactersToggle(value) {

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
            disabledChars.push(charNames.get(data.characters[i].id.toString()));
            charBox.classList.add("deselected");
        }
        else {
            if (data.characters[i].enabled == false) {
                disabledChars.push(charNames.get(data.characters[i].id.toString()));
            }
        }
    }

    data.disabled_characters = disabledChars;

    saveTime = Date.now() + (1000 * 5);
}

function getTextGroup() {

    if (currentGroup == "") {
        basicAlert("Select group first");
        return;
    }

    Swal.fire({
        title: 'Text format',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Monospaced',
        denyButtonText: 'Normal',
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

                names.push(charData.name);

                charDataString += charData.current.star + "★  ";
                charDataString += charData.current.level + "  ";
                if (charData.current.level.length == 1 && monospaced) {
                    charDataString += " ";
                }
                charDataString += formatLevel("Ex", charData.current.ex) + formatLevel("Other", charData.current.basic) +
                    formatLevel("Other", charData.current.passive) + formatLevel("Other", charData.current.sub) + "  ";
                charDataString += charData.current.gear1 + charData.current.gear2 + charData.current.gear3 + "  ";
                charDataString += charData.current.bond;

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
        textOutput += "Name" + " ".repeat(longest - 4) + "Star Lvl Skill Gear Bond\n";
    }
    else {
        textOutput += "Name   Star Lvl Skill Gear Bond\n";
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
        title: 'Text representation',
        html: '<textarea style="width: 400px; height: 250px; resize: none; padding: 10px;" readonly>' + textOutput + '</textarea>'
    })

}

function basicAlert(alertText) {
    Swal.fire({
        toast: true,
        position: 'top-start',
        title: alertText,
        showConfirmButton: false,
        timer: 1500
    })
}

async function saveToLocalStorage(notify) {
    saveTime = 0;
    data.character_order = getOrder();

    localStorage.setItem("save-data", JSON.stringify(data));

    if (notify && !document.documentElement.classList.contains('swal2-shown')) {
        Swal.fire({
            toast: true,
            position: 'top-start',
            title: 'Data saved',
            showConfirmButton: false,
            timer: 1500
        })
    }
}

function saveCharChanges() {

    var allValid = true;
    let invalidMessages = "";

    for (let key in inputValidation) {
        if (inputValidation[key].location == "characterModal") {
            let result = validateInput(key, true, true);
            if (result != "validated") {
                //invalidMessages.push(result);
                invalidMessages += result + "<br>";
                allValid = false;
            }
        }
    }

    if (allValid == false) {
        Swal.fire({
            title: 'Invalid inputs',
            html: invalidMessages,
            color: alertColour
        })

        return false;
    }

    var charName = document.getElementById("displayName").innerText;

    let charId = charMap.get(charName)
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

    updateInfoDisplay(charName, charId, "");

    updateStarDisplay(charName + "-star-container", charName, charId, "star-display", false);
    updateStarDisplay(charName + "-ue-container", charName, charId, "ue-display", false);

    closeModal(true);
}

function updateTextBackground(id, property) {

    let textElement = document.getElementById(id);

    if (textElement) {
        textElement.style.backgroundColor = propertyColours[property];
    }

}

function populateCharModal(character) {

    let charId = charMap.get(character)
    var charData = data.characters.find(obj => { return obj.id == charId });

    var charInfo = charlist[charMap.get(character)];

    if (charData != undefined) {

        document.getElementById("display_school").innerText = charInfo.School;
        updateTextBackground("display_school", charInfo.School);
        document.getElementById("display_type").innerText = charInfo.Type;
        updateTextBackground("display_type", charInfo.Type);
        document.getElementById("display_role").innerText = charInfo.TacticRole;
        document.getElementById("display_position").innerText = charInfo.TacticRange;
        document.getElementById("display_gun").innerText = charInfo.WeaponType;
        document.getElementById("display_attack_type").innerText = charInfo.DamageType;
        updateTextBackground("display_attack_type", charInfo.DamageType);
        document.getElementById("display_defense_type").innerText = charInfo.DefenseType;
        updateTextBackground("display_defense_type", charInfo.DefenseType);

        document.getElementById('mood-Urban').src = "icons/Mood/Mood_" + charInfo.Affinities.Urban + ".png";
        document.getElementById('mood-Outdoors').src = "icons/Mood/Mood_" + charInfo.Affinities.Outdoors + ".png";
        document.getElementById('mood-Indoors').src = "icons/Mood/Mood_" + charInfo.Affinities.Indoors + ".png";

        if (charData.current?.ue >= 3) {

            let terrain = charInfo.CharacterWeapon.AffinityBoost;
            let boostAmt = charInfo.CharacterWeapon.AffinityBoostAmount;

            document.getElementById('mood-' + terrain).src = "icons/Mood/Mood_" + boostedMood(charInfo.Affinities[terrain], boostAmt) + ".png";
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
            document.getElementById("gear1-img").src = "icons/Gear/T" + charData.current?.gear1 + "_" + charInfo.Equipment.Slot1 + ".png";
        }
        else {
            document.getElementById("gear1-img").src = "icons/Gear/T1_" + charInfo.Equipment.Slot1 + ".png";
        }
        if (charData.current?.gear2 != "0") {
            document.getElementById("gear2-img").src = "icons/Gear/T" + charData.current?.gear2 + "_" + charInfo.Equipment.Slot2 + ".png";
        }
        else {
            document.getElementById("gear2-img").src = "icons/Gear/T1_" + charInfo.Equipment.Slot2 + ".png";
        }
        if (charData.current?.gear3 != "0") {
            document.getElementById("gear3-img").src = "icons/Gear/T" + charData.current?.gear3 + "_" + charInfo.Equipment.Slot3 + ".png";
        }
        else {
            document.getElementById("gear3-img").src = "icons/Gear/T1_" + charInfo.Equipment.Slot3 + ".png";
        }

        document.getElementById("ex-img").src = "icons/SkillIcon/" + charInfo.Skills.Ex.Level1.Icon + ".png";
        document.getElementById("basic-img").src = "icons/SkillIcon/" + charInfo.Skills.Skill1.Level1.Icon + ".png";
        document.getElementById("enhanced-img").src = "icons/SkillIcon/" + charInfo.Skills.Skill2.Level1.Icon + ".png";
        document.getElementById("sub-img").src = "icons/SkillIcon/" + charInfo.Skills.Skill3.Level1.Icon + ".png";


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
            'event_label': character,
            'character_name': character,
            'character_id': charId,
            'character_star': charData.current?.star,
            'character_level': charData.current?.level,
            'character_ex': charData.current?.ex,
            'character_ex': charData.current?.basic,
            'character_ex': charData.current?.passive,
            'character_ex': charData.current?.sub
        })
    }

    updateStarDisplays(character, true);

    updateTooltip(character, "ex");
    updateTooltip(character, "basic");
    updateTooltip(character, "passive");
    updateTooltip(character, "sub");

}

function charUnlockClick() {

    let state = document.getElementById("input_char_unlocked").checked;

    if (state == false) {

        let charInfoObj = charlist[charMap.get(modalChar)];

        if (modalStars.star > charInfoObj.BaseStar) {

            modalStars.star = charInfoObj.BaseStar;

            if (modalStars.ue > 0) {
                modalStars.ue = 0;

                let terrain = charInfoObj.CharacterWeapon.AffinityBoost;

                document.getElementById('mood-' + terrain).src = "icons/Mood/Mood_" + charInfoObj.Affinities[terrain] + ".png";
            }

            updateStarDisplays(modalChar, true);
        }

    }

    populateCharResources(modalChar);
}

function serverToggle() {

    let serverToggleBtn = document.getElementById('hm-server-toggle');

    if (data.server == "Global") {
        data.server = "JP";
        serverToggleBtn.innerText = "JP";
    }
    else if (data.server == "JP") {
        data.server = "Global"
        serverToggleBtn.innerText = "Gbl";
    }

    let hardModes = misc_data.hard_modes[charMap.get(modalChar)];
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

function updateTooltip(charName, skill) {

    let charId = charMap.get(charName);
    let charData = charDataFromModal(charName);

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
            content: getSkillFormatted(charId, "Skill2", charData.current?.passive, charData.target?.passive)
        })
    }
    else if (skill == "sub" || skill == "sub_target") {
        tooltips[3].setProps({
            content: getSkillFormatted(charId, "Skill3", charData.current?.sub, charData.target?.sub)
        })
    }
}

function getSkillFormatted(charId, skill, level, targetLevel) {

    if (level == 0) {
        level = 1;
    }
    if (targetLevel == 0) {
        targetLevel = 1;
    }

    let desc = skillinfo[charId].Skills[skill].DescEn;
    let params = skillinfo[charId].Skills[skill].Parameters;
    let cost = skillinfo[charId].Skills[skill].Cost;

    let paramCount = 1;
    while (true) {

        let paramString = "<?" + paramCount + ">";

        if (desc.includes(paramString)) {

            let paramFilled = '<span style="color: #008c9b;">' + params[paramCount - 1][level - 1] + "</span>";

            if (level != targetLevel) {
                paramFilled += '/<span style="color: #588f00;">' + params[paramCount - 1][targetLevel - 1] + "</span>";
            }

            desc = desc.replaceAll(paramString, paramFilled);

            paramCount++;
        }
        else {
            break;
        }
    }

    if (skill == "Ex") {

        let costText = 'Cost: <span style="color: #008c9b;">' + cost[level - 1] + "</span>";

        if (level != targetLevel && cost[level - 1] != cost[targetLevel - 1]) {
            costText += '/<span style="color: #588f00;">' + cost[targetLevel - 1] + "</span>";
        }

        desc = costText + "<br>" + desc;
    }

    return desc;
}

function charDataFromModal(character) {

    let charData = {};

    charData.name = character;

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

    let charData = data.characters.find(obj => { return obj.id == charMap.get(modalChar) });
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

function populateCharResources(character) {

    let mainartisWrapper = document.getElementById('char-mainartis-wrapper');
    let subartisWrapper = document.getElementById('char-subartis-wrapper');
    let bdWrapper = document.getElementById('char-bds-wrapper');
    let tnWrapper = document.getElementById('char-tns-wrapper');

    while (mainartisWrapper.children.length > 0) {
        mainartisWrapper.children[0].remove();
    }
    while (subartisWrapper.children.length > 0) {
        subartisWrapper.children[0].remove();
    }
    while (bdWrapper.children.length > 0) {
        bdWrapper.children[0].remove();
    }
    while (tnWrapper.children.length > 0) {
        tnWrapper.children[0].remove();
    }

    let resources = calculateCharResources(charDataFromModal(character), true);

    if (resources) {

        let mainMatId = charlist[charMap.get(character)]?.Skills?.Ex?.Level1?.LevelUpMats?.Items[1]?.ItemId;
        let mainMat = matLookup.get(mainMatId);
        if (mainMat) {
            mainMat = mainMat.substring(0, mainMat.indexOf('_'));
        }

        for (key in resources) {

            let matName = matLookup.get(key);

            if (matName && matName != "Secret") {
                const wrapDiv = document.createElement('div');
                wrapDiv.className = "char-resource-wrapper";

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
                    resourceImg.src = "icons/SchoolMat/" + matName + ".png";
                }
                else {
                    resourceImg.src = "icons/Artifact/" + matName + ".png";
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

        let charId = charMap.get(character);

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

    populateCharResources(modalChar);
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
        document.getElementById('label_eleph_purchasable').style.visibility = 'hidden';
        document.getElementById('input_eleph_purchasable').style.visibility = 'hidden';
    }
    else {
        document.getElementById('label_eleph_purchasable').style.visibility = '';
        document.getElementById('input_eleph_purchasable').style.visibility = '';
    }
}

function starClicked(type, mode, pos) {

    let charData = charDataFromModal(modalChar);

    if (mode == "current" && charData.eleph?.unlocked == false) {
        let message = "Character has to be Unlocked to change Current Stars";

        if (Date.now() > toastCooldownTime || toastCooldownMsg != message) {

            toastCooldownTime = Date.now() + 1000 * 10;
            toastCooldownMsg = message;

            Swal.fire({
                toast: true,
                position: 'top-end',
                title: 'Invalid input',
                text: message,
                color: alertColour,
                showConfirmButton: false,
                timer: 4000
            })
        }

        return;
    }

    var charInfoObj = charlist[charMap.get(modalChar)];

    pos = parseInt(pos);

    if (mode == "current") {
        if (type == "star") {
            if (pos >= charInfoObj.BaseStar && pos != modalStars.star) {
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
            if (pos >= charInfoObj.BaseStar && pos >= modalStars.star && pos != modalStars.star_target) {
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

        let terrain = charInfoObj.CharacterWeapon.AffinityBoost;
        let boostAmt = charInfoObj.CharacterWeapon.AffinityBoostAmount;

        document.getElementById('mood-' + terrain).src = "icons/Mood/Mood_" + boostedMood(charInfoObj.Affinities[terrain], boostAmt) + ".png";
    }
    else {

        let terrain = charInfoObj.CharacterWeapon.AffinityBoost;

        document.getElementById('mood-' + terrain).src = "icons/Mood/Mood_" + charInfoObj.Affinities[terrain] + ".png";
    }

    updateStarDisplays(modalChar, true);
    populateCharResources(modalChar);
}

function cancelCharModal() {
    closeModal(true);
}

function updateStarDisplays(character, fromTemp) {

    let charId = charMap.get(character)

    updateStarDisplay("star-current-container", character, charId, "star-current", fromTemp);
    updateStarDisplay("star-target-container", character, charId, "star-target", fromTemp);
    updateStarDisplay("ue-current-container", character, charId, "ue-current", fromTemp);
    updateStarDisplay("ue-target-container", character, charId, "ue-target", fromTemp);

}

function updateStarDisplay(id, character, charId, type, fromTemp) {

    var starContainer = document.getElementById(id);

    var star, star_target, ue, ue_target;

    if (fromTemp) {
        star = modalStars.star;
        star_target = modalStars.star_target;
        ue = modalStars.ue;
        ue_target = modalStars.ue_target;
    }
    else {
        var charData = data.characters.find(obj => { return obj.id == charId });

        star = charData.current?.star;
        star_target = charData.target?.star;
        ue = charData.current?.ue;
        ue_target = charData.target?.ue;
    }

    for (s = 0; s < 5; s++) {
        if (type == "star-current" || type == "star-target") {
            if (star > s) {
                starContainer.children[s].style.filter = "grayscale(0)";
            }
            else if (type == "star-target" && star_target > s) {
                starContainer.children[s].style.filter = "grayscale(0) hue-rotate(300deg) saturate(0.9)";
            }
            else {
                starContainer.children[s].style.filter = "grayscale(1)";
            }
        }
        else if (type == "ue-current" || type == "ue-target") {
            if (ue > s) {
                starContainer.children[s].style.filter = "grayscale(0) hue-rotate(150deg)";
            }
            else if (type == "ue-target" && ue_target > s) {
                starContainer.children[s].style.filter = "grayscale(0) hue-rotate(40deg) saturate(0.8)";
            }
            else {
                starContainer.children[s].style.filter = "grayscale(1)";
            }
        }
        else if (type == "star-display") {
            if (star > s) {
                starContainer.children[s].style.visibility = "";
            }
            else if (star_target > s) {
                starContainer.children[s].style.visibility = "";
                starContainer.children[s].style.filter = "grayscale(0.5) contrast(0.5)";
            }
            else {
                starContainer.children[s].style.visibility = "hidden";
            }
        }
        else if (type == "ue-display") {
            if (ue > s) {
                starContainer.children[s].style.visibility = "";
                starContainer.children[s].style.filter = "grayscale(0) hue-rotate(150deg)";
            }
            else if (ue_target > s) {
                starContainer.children[s].style.visibility = "";
                starContainer.children[s].style.filter = "grayscale(0.5) hue-rotate(150deg) contrast(0.5)";
            }
            else {
                starContainer.children[s].style.visibility = "hidden";
            }
        }
    }

}

function openResourceModal() {

    if (!loaded) {
        return;
    }

    freezeBody(true);

    modalOpen = "resourceModal";

    var modal = document.getElementById("resourceModal");

    modal.style.visibility = "visible";

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

    hideEmpty();


    modal.onclick = function (event) {
        if (event.target == modal) {
            closeResourceModal();
        }
    };

    gtag('event', 'modal_view', {
        'event_label': 'resource',
        'modal_name': 'resource'
    })

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

    if (!loaded) {
        return;
    }

    freezeBody(true);

    modalOpen = "gearModal";

    var modal = document.getElementById("gearModal");

    modal.style.visibility = "visible";

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

    updateCells(ownedMatDict, true, 'ue-count-text', 'abrakadabra');
    updateUeXP();

    hideEmptyGear();

    modal.onclick = function (event) {
        if (event.target == modal) {
            closeGearModal();
        }
    };

    gtag('event', 'modal_view', {
        'event_label': 'gear',
        'modal_name': 'gear'
    })

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

    var modal = document.getElementById("resourceModal");

    modal.style.visibility = "hidden";

    modalOpen = "";

}

function closeGearModal() {

    freezeBody(false);

    var modal = document.getElementById("gearModal");

    modal.style.visibility = "hidden";

    modalOpen = "";

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

function createTable(id, columns, colOffset, rows, rowOffset, tableNavigation, parent, reorder, type, imgLoc) {

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

            if (col == 0) {
                newCell.innerText = rows[row];
                newCell.style.paddingLeft = "8px";
            }
            else {
                const newImg = document.createElement("img");
                newImg.draggable = false;
                newImg.className = type + "-icon";
                if (reorder) {
                    newImg.src = (imgLoc + rows[row] + "_" + columns[col - 1] + ".png").replace(/ /g, '');
                }
                else {
                    newImg.src = (imgLoc + columns[col - 1] + "_" + rows[row] + ".png").replace(/ /g, '');
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
    }

    if (isUEinput) {
        updateUeXP();
    }

    saveTime = Date.now() + (1000 * 5);
}

function commafy(num) {
    var parts = ('' + (num < 0 ? -num : num)).split("."), s = parts[0], L, i = L = s.length, o = '';
    while (i--) {
        o = (i === 0 ? '' : ((L - i) % 3 ? '' : ','))
            + s.charAt(i) + o
    }
    return (num < 0 ? '-' : '') + o + (parts[1] ? '.' + parts[1] : '');
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

function calculateCharResources(charData, output) {

    let charMatDict = {};

    let charId = charMap.get(charData.name);
    let charObj = charlist[charId];

    calcSkillCost(charObj, "Ex", charData.current?.ex, charData.target?.ex, charMatDict);
    calcSkillCost(charObj, "Skill1", charData.current?.basic, charData.target?.basic, charMatDict);
    calcSkillCost(charObj, "Skill2", charData.current?.passive, charData.target?.passive, charMatDict);
    calcSkillCost(charObj, "Skill3", charData.current?.sub, charData.target?.sub, charMatDict);

    calcXpCost(charData.current?.level, charData.target?.level, charMatDict);

    calcGearCost(charObj, charData.current?.gear1, charData.target?.gear1, 1, charMatDict);
    calcGearCost(charObj, charData.current?.gear2, charData.target?.gear2, 2, charMatDict);
    calcGearCost(charObj, charData.current?.gear3, charData.target?.gear3, 3, charMatDict);

    calcMysticCost(charData.current?.star, charData.target?.star, charMatDict);

    calcUECost(charObj, charData.current?.ue, charData.target?.ue, charData.current?.ue_level, charData.target?.ue_level, charMatDict);

    if (charMatDict["Eleph"] && charData.eleph?.owned > 0) {
        charMatDict["Eleph"] = Math.max(charMatDict["Eleph"] - charData.eleph?.owned, 0);
    }

    if (charData.eleph?.use_eligma && charMatDict["Eleph"]) {

        if (!charMatDict["Eligma"]) {
            charMatDict["Eligma"] = 0;
        }

        charMatDict["Eligma"] += ligma(charMatDict["Eleph"], charData.eleph?.cost, charData.eleph?.purchasable);
    }

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

        charMatDict["Eleph"] += misc_data.unlock_cost[charObj.BaseStar + "*"];
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
        charMatDicts[charData.name] = charMatDict;
    }

}

function calcSkillCost(characterObj, skill, current, target, matDict) {

    let skillObj = characterObj["Skills"]?.[skill];
    if (skillObj == undefined) { return null; }

    let curLevel = parseInt(current);
    let tarLevel = parseInt(target);
    if (curLevel == 0 && tarLevel > 0) {
        curLevel = 1;
    }

    for (let s = curLevel; s < tarLevel; s++) {

        let levelObj = skillObj["Level" + s];
        if (levelObj == undefined) {
            console.log("Error: Skill Level data missing") // expand error later
            return null;
        }

        let costObj = levelObj["LevelUpMats"];

        for (let i = 0; i < costObj?.["Items"].length; i++) {

            let item = costObj["Items"][i];

            if (item["ItemId"] != undefined && item["Quantity"] != undefined) {

                if (!matDict[item["ItemId"]]) {
                    matDict[item["ItemId"]] = 0;
                }

                matDict[item["ItemId"]] += item["Quantity"];
            }
        }

        if (costObj["Currency"] != undefined) {

            if (!matDict["Credit"]) {
                matDict["Credit"] = 0;
            }

            matDict["Credit"] += costObj["Currency"];

        }


    }
}

function calcXpCost(level, levelTarget, matDict) {

    if (level && levelTarget) {
        var xpNeeded = Math.max(misc_data.level_xp[parseInt(levelTarget) - 1] - misc_data.level_xp[parseInt(level) - 1], 0);
        matDict["Xp"] = xpNeeded;

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
                let gearName = charObj.Equipment["Slot" + slotNum];

                for (let i = 2; i <= 7; i++) {

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

    for (character in charMatDicts) {
        if (!disabledChars.includes(character)) {
            for (matName in charMatDicts[character]) {

                if (!requiredMatDict[matName]) {
                    requiredMatDict[matName] = 0;
                }

                requiredMatDict[matName] += charMatDicts[character][matName];
            }
        }
    }

    for (key in requiredMatDict) {
        updateNeededMat(key);
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

    for (character in charMatDicts) {
        if (!disabledChars.includes(character)) {

            if (charMatDicts[character]["RaidTokenCost"]) {
                neededMatDict["RaidTokenCost"] += charMatDicts[character]["RaidTokenCost"];
            }
        }
    }
}

function switchResourceDisplay(displayType) {

    let btnOwned = document.getElementById("switch-resource-owned");
    let btnTotal = document.getElementById("switch-resource-total");
    let btnRemaining = document.getElementById("switch-resource-remaining");
    let displayText = document.getElementById("current-resource-display");
    var raidTokenDisplay = document.getElementById("raid-token-display-wrapper");
    let rareRaidTokenDisplay = document.getElementById("rare-raid-token-display-wrapper");
    let eligmaDisplay = document.getElementById("eligma-display-wrapper");
    let arenaCoinDisplay = document.getElementById("arena-coin-display-wrapper");
    let jeCoinDisplay = document.getElementById("je-coin-display-wrapper");
    let masteryCertDisplay = document.getElementById("mastery-certificate-display-wrapper");
    var xpInputs = document.getElementById("xp-input-wrapper");
    var inputs = document.getElementsByClassName("input-wrapper");

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
        displayText.innerText = "Owned";
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
        displayText.innerText = "Total Needed"
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
        displayText.innerText = "Remaining Needed";
        xpInputs.style.display = "none";
        updateCells(neededMatDict, false, 'resource-count-text', 'misc-resource');
        hideResourceDisplays();
        for (i = 0; i < inputs.length; i++) {
            inputs[i].parentElement.classList.remove("editable");
        }
    }

    hideEmpty();

}

function switchGearDisplay(displayType) {

    let btnOwned = document.getElementById("switch-gear-owned");
    let btnTotal = document.getElementById("switch-gear-total");
    let btnRemaining = document.getElementById("switch-gear-remaining");
    let displayText = document.getElementById("current-gear-display");
    let gxpInputs = document.getElementById("gear-xp-input-wrapper");
    //var inputs = document.getElementsByClassName("input-wrapper");

    if (displayType == "Owned") {
        gearDisplay = "Owned";
        btnOwned.parentElement.style.display = "none";
        btnTotal.parentElement.style.display = "";
        btnRemaining.parentElement.style.display = "";
        gxpInputs.style.display = "";
        displayText.innerText = "Owned";
        updateCells(ownedMatDict, true, 'gear-count-text', 'misc-gear');
    }
    else if (displayType == "Remaining") {
        gearDisplay = "Remaining";
        btnOwned.parentElement.style.display = "";
        btnTotal.parentElement.style.display = "";
        btnRemaining.parentElement.style.display = "none";
        gxpInputs.style.display = "none";
        displayText.innerText = "Remaining Needed";
        updateCells(neededMatDict, false, 'gear-count-text', 'misc-gear');
    }
    else if (displayType == "Total") {
        gearDisplay = "Total";
        btnOwned.parentElement.style.display = "";
        btnTotal.parentElement.style.display = "none";
        btnRemaining.parentElement.style.display = "";
        gxpInputs.style.display = "none";
        displayText.innerText = "Total Needed";
        updateCells(requiredMatDict, false, 'gear-count-text', 'misc-gear');
    }

    hideEmptyGear();

}

function updateInfoDisplay(character, charId, idInject) {

    var charData = data.characters.find(obj => { return obj.id == charId });

    var skillCurrent = formatLevel("Ex", charData.current?.ex) + formatLevel("Other", charData.current?.basic) +
        formatLevel("Other", charData.current?.passive) + formatLevel("Other", charData.current?.sub);

    var skillTarget = formatLevel("Ex", charData.target?.ex) + formatLevel("Other", charData.target?.basic) +
        formatLevel("Other", charData.target?.passive) + formatLevel("Other", charData.target?.sub);

    var gearCurrent = formatLevel("Gear", charData.current?.gear1) + formatLevel("Gear", charData.current?.gear2) + formatLevel("Gear", charData.current?.gear3);
    var gearTarget = formatLevel("Gear", charData.target?.gear1) + formatLevel("Gear", charData.target?.gear2) +
        formatLevel("Gear", charData.target?.gear3);

    document.getElementById(character + idInject + "-skill-current").innerText = skillCurrent;
    if (skillCurrent != skillTarget) {
        document.getElementById(character + idInject + "-skill-target").innerText = skillTarget;
    }
    else {
        document.getElementById(character + idInject + "-skill-target").innerText = "";
    }

    document.getElementById(character + idInject + "-gear-current").innerText = gearCurrent;
    if (gearCurrent != gearTarget) {
        document.getElementById(character + idInject + "-gear-target").innerText = gearTarget;
    }
    else {
        document.getElementById(character + idInject + "-gear-target").innerText = "";
    }

    document.getElementById(character + idInject + "-level-current").innerText = formatLevel("Level", charData.current.level);
    if (charData.current.level != charData.target.level) {
        document.getElementById(character + idInject + "-level-target").innerText = formatLevel("Level", charData.target.level);
    }
    else {
        document.getElementById(character + idInject + "-level-target").innerText = "";
    }

    document.getElementById(character + idInject + "-bond-current").innerText = charData.current?.bond;
    if (charData.current?.bond != charData.target?.bond) {
        document.getElementById(character + idInject + "-bond-target").innerText = charData.target?.bond;
    }
    else {
        document.getElementById(character + idInject + "-bond-target").innerText = "";
    }
}

function transferDialog() {

    Swal.fire({
        title: 'Data transfer',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Export',
        denyButtonText: 'Import',
        denyButtonColor: '#dc9641'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Exported data',
                html: '<textarea style="width: 400px; height: 250px; resize: none;" readonly>' + localStorage.getItem('save-data') + '</textarea>'
            })
        }
        else if (result.isDenied) {
            getImportData();
        }
    })

}

function tryParseJSON(source) {
    try {
        var data = JSON.parse(source);
        if (!!!data) return null;

        if (!!!data.exportVersion || data.exportVersion < exportDataVersion) {
            data.exportVersion = data?.exportVersion ?? 1;
            // old data structure used. convert it to new one.
            // ideally structure does not change much.
            // update this in case 
            if (data.exportVersion < 2) {
                // convert version 1 to version 2
                for (let i in data.characters) {
                    data.characters[i] = Student.FromVersion1Data(data.characters[i]);
                }
                data.exportVersion = 2;
                localStorage.setItem("save-data", JSON.stringify(data));
            }
            // incremental
            // Note: if, not else if
            if (data.exportVersion < 3) {
                // convert version 2 to version 3
                // not used yet
            }
        }

        return data;
    } catch (e) {
        console.log(e);
        return null;
    }
}

async function getImportData() {
    const { value: importData } = await Swal.fire({
        input: 'textarea',
        inputLabel: 'Import data',
        color: alertColour,
        inputPlaceholder: 'Paste your previously exported data here',
        showCancelButton: true
    })

    if (importData) {
        data = tryParseJSON(importData);

        if (!!!data) {
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: "That wasn't valid json, couldn't import it",
                color: alertColour
            })

            return false;
        }

        localStorage.setItem("save-data", JSON.stringify(data));

        ownedMatDict = {};
        if (data != null) {
            if (data.owned_materials != undefined) {
                for (key in data.owned_materials) {
                    ownedMatDict[key] = data.owned_materials[key];
                }
            }

            if (data.disabled_characters != undefined) {
                disabledChars = data.disabled_characters;
            }
        }

        initData();

        refreshAllChars();
        rebuildGroups();
        rebuildFilters();

        generateCharOptions();
        generateTeamBorrowOptions();

        gtag('event', 'action_import');
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
                createCharBox(char.name, char.id, charsContainer, "main");
                calculateCharResources(char, false);
            }
        }
    }

    for (var i = 0; i < data.characters.length; i++) {

        if (document.getElementById('char_' + data.characters[i].id) == undefined) {

            createCharBox(data.characters[i].name, data.characters[i].id, charsContainer, "main");

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

function switchTheme() {

    if (pageTheme == "dark") {
        setTheme("light");
        data.page_theme = "light";
        saveTime = Date.now() + 5 * 1000;
    }
    else if (pageTheme == "light") {
        setTheme("dark");
        data.page_theme = "dark";
        saveTime = Date.now() + 5 * 1000;
    }

}

function setTheme(theme) {

    let image = document.getElementById('theme-button');

    if (theme == "light") {
        image.src = "icons/UI/moon-black.svg";
        pageTheme = "light";
        document.body.classList.remove('dark-theme');
        alertColour = "black"
        switchStylesheets("light")
    }
    else if (theme == "dark") {
        image.src = "icons/UI/sun.svg";
        pageTheme = "dark";
        document.body.classList.add('dark-theme');
        alertColour = "#e1e1e1"
        switchStylesheets("dark");
    }
}

function switchStylesheets(theme) {

    let sheets = document.styleSheets;

    for (let i = 0; i < sheets.length; i++) {
        if (sheets[i].href == "https://cdn.jsdelivr.net/npm/@sweetalert2/theme-dark@4/dark.css") {
            if (theme == "dark") {
                sheets[i].disabled = false;
            }
            else {
                sheets[i].disabled = true;
            }
        }
        else if (sheets[i].href == "https://cdn.jsdelivr.net/npm/@sweetalert2/theme-minimal@4/minimal.css") {
            if (theme == "dark") {
                sheets[i].disabled = true;
            }
            else {
                sheets[i].disabled = false;
            }
        }
    }

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

function createCharBox(newChar, charId, container, location) {

    let idInject = "";

    if (location == "teams") {
        idInject = "-teams";
    }
    else if (location == "borrow") {
        idInject = "-borrow";
        borrowed = true;
    }

    const newDiv = document.createElement("div");
    if (location == "main") {
        newDiv.className = "charBox main-display-char";
        newDiv.id = "char_" + charId;
    }
    else if (location == "teams") {
        newDiv.className = "charBox teams-display-char";
        newDiv.id = "char_teams_" + charId;
    }
    else if (location == "borrow") {
        newDiv.className = "charBox teams-display-char";
        newDiv.id = "char_borrow_" + charId;
    }

    if (location == "main") {
        if (disabledChars.includes(newChar)) {
            newDiv.classList.add("deselected");
        } else {
            newDiv.classList.add("selected");
        }

        if (window.matchMedia("(pointer: fine)").matches) {
            newDiv.title = `Ctrl+click to disable/enable
        Shift+drag to move`
        }
    }

    const newContent = document.createElement("div");
    newContent.className = "charBoxwrap";

    const newContentBox = document.createElement("div");
    newContentBox.className = "main-box-content";

    let newStarContainer;
    let newUEContainer;
    let newBondContainer;

    if (location != "borrow") {

        newStarContainer = document.createElement("div");
        newStarContainer.className = "star-container";
        newStarContainer.id = newChar + idInject + "-star-container";

        newBondContainer = document.createElement("div");
        newBondContainer.className = "char-heart-container";

        const newBondImg = document.createElement("img");
        newBondImg.src = "icons/Misc/bond.png";
        newBondImg.draggable = false;

        const newBondP = document.createElement("p");
        newBondP.id = newChar + idInject + "-bond-current";
        newBondP.style = "transform: translate(-50%, -95%)";

        const newBondP2 = document.createElement("p");
        newBondP2.id = newChar + idInject + "-bond-target";
        newBondP2.style = "transform: translate(-50%, -25%)";

        newBondContainer.appendChild(newBondImg);
        newBondContainer.appendChild(newBondP);
        newBondContainer.appendChild(newBondP2);

        for (i = 0; i < 5; i++) {
            const newStar = document.createElement("img");
            newStar.draggable = false;
            newStar.className = "display-star";
            newStar.src = "icons/Misc/star.png";

            newStarContainer.appendChild(newStar);
        }

        newUEContainer = document.createElement("div");
        newUEContainer.className = "ue-container";
        newUEContainer.id = newChar + idInject + "-ue-container";

        for (i = 0; i < 5; i++) {
            const newStar = document.createElement("img");
            newStar.draggable = false;
            newStar.className = "display-star";
            newStar.src = "icons/Misc/star.png";

            newUEContainer.appendChild(newStar);
        }

        var classes = ["skill-bar", "gear-bar", "level-bar"];

        for (i = 0; i < 3; i++) {
            const newBar = document.createElement("div");
            newBar.className = classes[i] + " info-bar";

            const newP = document.createElement("p");
            newP.className = "info-display";
            newP.id = newChar + idInject + "-" + classes[i].substring(0, classes[i].indexOf('-')) + "-current";
            newBar.appendChild(newP);

            const newP2 = document.createElement("p");
            newP2.className = "info-display";
            newP2.id = newChar + idInject + "-" + classes[i].substring(0, classes[i].indexOf('-')) + "-target";
            newBar.appendChild(newP2);

            newContentBox.appendChild(newBar);
        }

    }

    const newImg = document.createElement("img");
    newImg.src = "icons/Portrait/Icon_" + charId + ".png"
    newImg.draggable = false;
    newImg.className = "char-img";

    const nameDiv = document.createElement("div");
    nameDiv.className = "nameBar";

    const nameTag = document.createElement("p");
    if (newChar.includes(' ')) {
        nameTag.innerText = newChar.substring(0, newChar.indexOf(' '));
    }
    else {
        nameTag.innerText = newChar;
    }

    let borrowDiv, borrowTag;

    if (location == "borrow") {
        borrowDiv = document.createElement("div");
        borrowDiv.className = "borrowBar";

        borrowTag = document.createElement("p");
        borrowTag.innerText = "Borrowed";
    }

    newContentBox.appendChild(newImg);
    newContentBox.appendChild(nameDiv).appendChild(nameTag);
    if (location == "borrow") {
        newContentBox.appendChild(borrowDiv).appendChild(borrowTag);
    }

    newContent.appendChild(newContentBox);

    newDiv.appendChild(newContent);
    if (location != "borrow") {
        newDiv.appendChild(newStarContainer);
        newDiv.appendChild(newUEContainer);
        newDiv.appendChild(newBondContainer);
    }
    if (location == "main") {
        newDiv.onclick = openModal
    }

    if (location == "main") {

        let lastNode = document.getElementById('addCharButton')

        container.insertBefore(newDiv, lastNode);
    }
    else if (location == "teams" || location == "borrow") {

        container.appendChild(newDiv);
    }

    if (location != "borrow") {
        updateInfoDisplay(newChar, charId, idInject);
        updateStarDisplay(newChar + idInject + "-star-container", newChar, charId, "star-display", false);
        updateStarDisplay(newChar + idInject + "-ue-container", newChar, charId, "ue-display", false);
    }
}

function getOffset(el) {
    const rect = el.getBoundingClientRect();
    return {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY
    };
}


// function debugGetCharData(character) {
//     console.log(data.characters.find(obj => { return obj.name == character }));
// }

// function debugCharCalc(char) {
//     var charData = data.characters.find(obj => { return obj.name == char });
//     console.log(calculateCharResources(charData, true));
// }

// function debugGetDicts() {
//     var result = {};
//     result.owned = ownedMatDict;
//     result.required = requiredMatDict;
//     result.needed = neededMatDict;

//     return result;
// }
