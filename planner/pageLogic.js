var curID = 0;
var modalCharID = 0;
var modalChar = "";
var modalStars = { "star": 0, "star_target": 0, "ue": 0, "ue_target": 0 };
var data;
const ueStarCap = 3;

var requiredMatDict = {};
var neededMatDict = {};
var ownedMatDict = {};
var charMatDicts = {};
var resourceDisplay = "Needed";
var gearDisplay = "Needed";

var charOptions = {};
var disabledChars = [];

var saveTime = 0;
var toastCooldownTime = 0;
var toastCooldownMsg = "";

var charMode = "Edit";

var misc_data, charlist;

let charMap, charNames, inputMap;

let focusedInput;
let navigationObjects = {};

let preInput;

let keyPressed = {};
let modalOpen = "";
let pageTheme = "dark";
let alertColour = "#e1e1e1";

function loadResources() {

    $.getJSON('misc_data.json?2').done(function (json) {
        misc_data = json;
        checkResources();
    });

    $.getJSON('charlist.json').done(function (json) {
        charlist = json;
        checkResources();
    });

}

function checkResources() {

    if (charlist && misc_data) {

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
    }

}

function init() {

    data = tryParseJSON(localStorage.getItem('save-data'));

    loadResources();

    if (data == null) {
        data = { exportVersion: exportDataVersion, characters: [], disabled_characters: [], owned_materials: {} };
        localStorage.setItem("save-data", JSON.stringify(data));
    }

    if (data != null) {
        if (data.disabled_characters != undefined) {
            disabledChars = data.disabled_characters;
        }

        if (data.character_order) {
            for (let i = 0; i < data.character_order.length; i++) {
                let char = data.characters.find(obj => { return obj.id == data.character_order[i] });

                if (char) {
                    createCharBox(char.name, char.id);
                }
            }
        }

        for (var i = 0; i < data.characters.length; i++) {

            if (document.getElementById('char_' + data.characters[i].id) == undefined) {
                createCharBox(data.characters[i].name, data.characters[i].id);
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
    }

    // add add button
    var container = document.getElementsByClassName("charsContainer")[0];
    const newDiv = document.createElement("div");
    newDiv.className = "charBox";
    newDiv.id = "addCharButton";
    newDiv.onclick = newCharClicked;
    const newContent = document.createElement("div");
    newContent.className = "charBoxwrap";
    const newImg = document.createElement("img");
    newImg.src = "icons/addIcon.png";
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

    const sortable = new Draggable.Sortable(document.getElementsByClassName('charsContainer')[0], {
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
        ["Hyakkiyako", "Red Winter", "Trinity", "Gehenna", "Abydos", "Millennium", "Shanhaijing", "Valkyrie"], 0,
        tableNavigation, document.getElementById("table-parent-1"), false, "resource");
    createTable("artifact-table-1", ["4", "3", "2", "1"], 0,
        ["Nebra", "Phaistos", "Wolfsegg", "Nimrud", "Mandragora", "Rohonc", "Aether"], 8,
        tableNavigation, document.getElementById("table-parent-2"), true, "resource");
    createTable("artifact-table-2", ["4", "3", "2", "1"], 4,
        ["Antikythera", "Voynich", "Haniwa", "Baghdad", "Totem", "Fleece", "Kikuko"], 8,
        tableNavigation, document.getElementById("table-parent-3"), true, "resource");

    let gearNavigation = [];
    createTable("gear-table", ["T6", "T5", "T4", "T3", "T2"], 0, ["Hat", "Gloves", "Shoes", "Bag", "Badge", "Hairpin", "Charm", "Watch", "Necklace"],
        0, gearNavigation, document.getElementById('table-parent-4'), false, "gear");

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

    if ("1.0.6".localeCompare(data.site_version ?? "0.0.0", undefined, { numeric: true, sensitivity: 'base' }) == 1) {
        var updateMessage = ("If anything seems broken, try 'hard refreshing' the page (google it)<br>" +
            "If still having issues, contact me on Discord, Justin163#7721");
        Swal.fire({
            title: "Updated to Version 1.0.6",
            color: alertColour,
            html: updateMessage
        })

        data.site_version = "1.0.6";
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
                                document.getElementById("gear1-img").src = "icons/T" + event.target.value + "_" + charInfo.Equipment.Slot1 + ".webp";
                            }
                            else if (event.target.id == "input_gear2_current") {
                                document.getElementById("gear2-img").src = "icons/T" + event.target.value + "_" + charInfo.Equipment.Slot2 + ".webp";
                            }
                            else if (event.target.id == "input_gear3_current") {
                                document.getElementById("gear3-img").src = "icons/T" + event.target.value + "_" + charInfo.Equipment.Slot3 + ".webp";
                            }
                        }
                        else {
                            if (event.target.id == "input_gear1_current") {
                                document.getElementById("gear1-img").src = "icons/T1_" + charInfo.Equipment.Slot1 + ".webp";
                            }
                            else if (event.target.id == "input_gear2_current") {
                                document.getElementById("gear2-img").src = "icons/T1_" + charInfo.Equipment.Slot2 + ".webp";
                            }
                            else if (event.target.id == "input_gear3_current") {
                                document.getElementById("gear3-img").src = "icons/T1_" + charInfo.Equipment.Slot3 + ".webp";
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

            if (navValue == "direct") {
                targetCell = inputValidation[property][direction];
            }
            else {
                let navObj = navigationObjects[navValue];

                if (navObj.type == "table") {

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


        if (inputElement.value == '') {
            if ((preInput || preInput == 0) && keyPressed.Delete != true && keyPressed.Backspace != true) {
                inputElement.value = preInput;
            }
            else {
                inputElement.value = '';
            }
        }

        if (inputElement.value.length > val.max.length) {
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

        createCharBox(character, charId);

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

                charOptions[school] ??= {};
                charOptions[school][charName] = charName;
            }
            else {

                charOptions["Unassigned"] ??= {};
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

function openModal(e) {

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
        modalOpen = "characterModal";
        this.style = "visibility:hidden";

        modal.style.visibility = "visible";

        document.getElementById('character-modal-wrapper').style.visibility = "hidden";

        var charSelected = charNames.get(this.id.substring(5));

        modalChar = charSelected;

        populateCharModal(charSelected);

        populateCharResources(charSelected);

        var displayImg = document.getElementById("displayImg");
        displayImg.src = "icons/Icon_" + charMap.get(charSelected) + ".png";

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

async function saveToLocalStorage(notify) {
    saveTime = 0;
    data.character_order = getOrder();

    localStorage.setItem("save-data", JSON.stringify(data));

    if (notify) {
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

        saveToLocalStorage(true);
    }

    calculateCharResources(charData, false);

    updateInfoDisplay(charName, charId);

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
        document.getElementById("display_role").innerText = "No data";//charInfo.role;
        document.getElementById("display_position").innerText = "No data";//charInfo.position;
        document.getElementById("display_gun").innerText = "No data";//charInfo.gun;
        document.getElementById("display_attack_type").innerText = charInfo.DamageType;
        updateTextBackground("display_attack_type", charInfo.DamageType);
        document.getElementById("display_defense_type").innerText = charInfo.DefenseType;
        updateTextBackground("display_defense_type", charInfo.DefenseType);


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
            document.getElementById("gear1-img").src = "icons/T" + charData.current?.gear1 + "_" + charInfo.Equipment.Slot1 + ".webp";
        }
        else {
            document.getElementById("gear1-img").src = "icons/T1_" + charInfo.Equipment.Slot1 + ".webp";
        }
        if (charData.current?.gear2 != "0") {
            document.getElementById("gear2-img").src = "icons/T" + charData.current?.gear2 + "_" + charInfo.Equipment.Slot2 + ".webp";
        }
        else {
            document.getElementById("gear2-img").src = "icons/T1_" + charInfo.Equipment.Slot2 + ".webp";
        }
        if (charData.current?.gear3 != "0") {
            document.getElementById("gear3-img").src = "icons/T" + charData.current?.gear3 + "_" + charInfo.Equipment.Slot3 + ".webp";
        }
        else {
            document.getElementById("gear3-img").src = "icons/T1_" + charInfo.Equipment.Slot3 + ".webp";
        }

        document.getElementById("ex-img").src = "icons/" + charInfo.Skills.Ex.Level1.Icon + ".png";
        document.getElementById("basic-img").src = "icons/" + charInfo.Skills.Skill1.Level1.Icon + ".png";
        document.getElementById("enhanced-img").src = "icons/" + charInfo.Skills.Skill2.Level1.Icon + ".png";
        document.getElementById("sub-img").src = "icons/" + charInfo.Skills.Skill3.Level1.Icon + ".png";


        modalStars.star = charData.current?.star;
        modalStars.star_target = charData.target?.star;
        modalStars.ue = charData.current?.ue;
        modalStars.ue_target = charData.target?.ue;
    }

    updateStarDisplays(character, true);
}

function charDataFromModal(character) {

    let charData = {};

    charData.name = character;

    charData.current = {};
    charData.target = {};

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
                resourceImg.src = "icons/" + matName + ".webp";

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
    }

}

function starClicked(type, mode, pos) {

    var charInfoObj = charlist[charMap.get(modalChar)];

    pos = parseInt(pos);

    if (mode == "current") {
        if (type == "star") {
            if (pos >= charInfoObj.BaseStar && pos != modalStars.star) {
                modalStars.star = pos;

                if (pos > modalStars.star_target) {
                    modalStars.star_target = pos;
                }
            }
        }
        else if (type == "ue" && modalStars.star_target >= 5) {
            if (pos <= ueStarCap) {
                if (pos == 1 && modalStars.ue == 1) {
                    modalStars.ue = 0;
                }
                else {
                    modalStars.ue = pos;

                    if (pos > modalStars.ue_target) {
                        modalStars.ue_target = pos;
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
        else if (type == "ue" && modalStars.star_target >= 5) {
            if (pos <= ueStarCap && pos >= modalStars.ue) {
                if (pos == 1 && modalStars.ue_target == 1) {
                    modalStars.ue_target = 0;
                }
                else {
                    modalStars.ue_target = pos;
                }
            }
        }
    }

    updateStarDisplays(modalChar, true);
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

    modalOpen = "resourceModal";

    var modal = document.getElementById("resourceModal");

    modal.style.visibility = "visible";

    updateAggregateCount();

    if (resourceDisplay == "Needed") {
        updateCells(neededMatDict, false, 'resource-count-text', 'misc-resource');
    }
    else if (resourceDisplay == "Owned") {
        updateCells(ownedMatDict, true, 'resource-count-text', 'misc-resource');
    }

    hideEmpty();


    modal.onclick = function (event) {
        if (event.target == modal) {
            closeResourceModal();
        }
    };

}

function openGearModal() {

    modalOpen = "gearModal";

    var modal = document.getElementById("gearModal");

    modal.style.visibility = "visible";

    updateAggregateCount();

    if (gearDisplay == "Needed") {
        updateCells(neededMatDict, false, 'gear-count-text', 'misc-resource');
    }
    else if (gearDisplay == "Owned") {
        updateCells(ownedMatDict, true, 'gear-count-text', 'miscsdasjda');
    }

    hideEmptyGear();

    modal.onclick = function (event) {
        if (event.target == modal) {
            closeGearModal();
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

    var modal = document.getElementById("resourceModal");

    modal.style.visibility = "hidden";

    modalOpen = "";

}

function closeGearModal() {

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
}

function hideEmptyCells(table) {
    var rows = table.children[0].children.length;
    var cols = table.children[0].children[0].children.length;

    for (row = 0; row < rows; row++) {
        for (col = 1; col < cols; col++) {
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

function createTable(id, columns, colOffset, rows, rowOffset, tableNavigation, parent, reorder, type) {

    const newTable = document.createElement("table");
    newTable.className = "resource-table";
    newTable.id = id;

    const newTbody = document.createElement("tbody");

    //var cellId = 0;

    for (row = 0; row < rows.length; row++) {
        const newRow = document.createElement("tr");
        newRow.id = "row-" + rows[row];

        tableNavigation[row + rowOffset] ??= [];

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
                    newImg.src = ("icons/" + rows[row] + "_" + columns[col - 1] + ".webp").replace(/ /g, '');
                }
                else {
                    newImg.src = ("icons/" + columns[col - 1] + "_" + rows[row] + ".webp").replace(/ /g, '');
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

    if (newCount == 0 && (!nonCentred)) {
        this.value = '';
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
    }
    else {
        updateNeededMat(dictKey);
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
    if (requiredMatDict["Xp"] != undefined) {
        neededMatDict["Xp"] = Math.max(requiredMatDict["Xp"] - xpOwned, 0);
    }
    else {
        neededMatDict["Xp"] = 0;
    }
}

function updateNeededMat(mat) {
    neededMatDict[mat] = Math.max((requiredMatDict[mat] ?? 0) - (ownedMatDict[mat] ?? 0), 0);
}

function calculateCharResources(charData, output) {

    let charMatDict = {};

    let charObj = charlist[charMap.get(charData.name)];

    calcSkillCost(charObj, "Ex", charData.current?.ex, charData.target?.ex, charMatDict);
    calcSkillCost(charObj, "Skill1", charData.current?.basic, charData.target?.basic, charMatDict);
    calcSkillCost(charObj, "Skill2", charData.current?.passive, charData.target?.passive, charMatDict);
    calcSkillCost(charObj, "Skill3", charData.current?.sub, charData.target?.sub, charMatDict);

    calcXpCost(charData.current?.level, charData.target?.level, charMatDict);

    calcGearCost(charObj, charData.current?.gear1, charData.target?.gear1, 1, charMatDict);
    calcGearCost(charObj, charData.current?.gear2, charData.target?.gear2, 2, charMatDict);
    calcGearCost(charObj, charData.current?.gear3, charData.target?.gear3, 3, charMatDict);

    calcMysticCost(charData.current?.star, charData.target?.star, charMatDict);

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

    for (let s = parseInt(current); s < parseInt(target); s++) {

        let levelObj = skillObj["Level" + s];
        if (levelObj == undefined) {
            console.log("Error: Skill Level data missing") // expand error later
            return null;
        }

        let costObj = levelObj["LevelUpMats"];

        for (let i = 0; i < costObj?.["Items"].length; i++) {

            let item = costObj["Items"][i];

            if (item["ItemId"] != undefined && item["Quantity"] != undefined) {

                matDict[item["ItemId"]] ??= 0;
                matDict[item["ItemId"]] += item["Quantity"];
            }
        }

        if (costObj["Currency"] != undefined) {

            matDict["Credit"] ??= 0;
            matDict["Credit"] += costObj["Currency"];

        }


    }
}

function calcXpCost(level, levelTarget, matDict) {

    if (level && levelTarget) {
        var xpNeeded = Math.max(misc_data.level_xp[parseInt(levelTarget) - 1] - misc_data.level_xp[parseInt(level) - 1], 0);
        matDict["Xp"] = xpNeeded;

        matDict["Credit"] ??= 0;
        matDict["Credit"] += xpNeeded * 7;
    }
}

function calcGearCost(charObj, gear, gearTarget, slotNum, matDict) {

    // need to also save gear xp later
    if ((gear || gear == 0) && gearTarget) {

        var gearObj = misc_data.cumulative_gear_cost["T" + gear];
        var targetGearObj = misc_data.cumulative_gear_cost["T" + gearTarget];

        if (gearObj && targetGearObj) {

            if (gearObj.xp && targetGearObj.xp) {
            }

            if ((gearObj.credit || gearObj.credit == 0) && targetGearObj.credit) {

                matDict["Credit"] ??= 0;
                matDict["Credit"] += targetGearObj.credit - gearObj.credit;
            }

            if (charObj?.Equipment) {
                let gearName = charObj.Equipment["Slot" + slotNum];

                for (let i = 2; i <= 6; i++) {

                    let currentBP = gearObj["T" + i] ?? 0;
                    let targetBP = targetGearObj["T" + i];
                    let diff = targetBP - currentBP;

                    if (targetBP && (diff > 0)) {
                        matDict["T" + i + "_" + gearName] ??= 0
                        matDict["T" + i + "_" + gearName] += diff;
                    }
                }
            }
        }
    }

}

function calcMysticCost(star, starTarget, matDict) {

    if (star && starTarget) {

        var currentStar = misc_data.cumulative_mystic_cost[star + "*"];
        var targetStar = misc_data.cumulative_mystic_cost[starTarget + "*"];

        if (currentStar && targetStar) {

            if ((currentStar.credit || currentStar.credit == 0) && targetStar.credit) {

                matDict["Credit"] ??= 0;
                matDict["Credit"] += targetStar.credit - currentStar.credit;
            }
        }
    }

}

function updateAggregateCount() {

    requiredMatDict = {};
    neededMatDict = {};

    for (character in charMatDicts) {
        if (!disabledChars.includes(character)) {
            for (matName in charMatDicts[character]) {
                requiredMatDict[matName] ??= 0
                requiredMatDict[matName] += charMatDicts[character][matName];
            }
        }
    }

    for (key in requiredMatDict) {
        updateNeededMat(key);
    }

    updateXP();
}

function switchResourceDisplay() {

    var btn = document.getElementById("button-switch-display");
    var xpDisplay = document.getElementById("xp-display-wrapper");
    var xpInputs = document.getElementById("xp-input-wrapper");
    var inputs = document.getElementsByClassName("input-wrapper");

    if (resourceDisplay == "Needed") {
        resourceDisplay = "Owned";
        btn.innerText = "Switch to Needed";
        btn.style.backgroundColor = "#f5c8dd";
        xpDisplay.style.display = "none";
        xpInputs.style.display = "";
        updateCells(ownedMatDict, true, 'resource-count-text', 'misc-resource');
        for (i = 0; i < inputs.length; i++) {
            inputs[i].parentElement.classList.add("editable");
        }
    }
    else if (resourceDisplay == "Owned") {
        resourceDisplay = "Needed";
        btn.innerText = "Switch to Owned";
        btn.style.backgroundColor = "#c8e6f5";
        xpDisplay.style.display = "";
        xpInputs.style.display = "none";
        updateCells(neededMatDict, false, 'resource-count-text', 'misc-resource');
        for (i = 0; i < inputs.length; i++) {
            inputs[i].parentElement.classList.remove("editable");
        }
    }

    hideEmpty();

}

function switchGearDisplay() {

    var btn = document.getElementById("gear-switch-display");
    //var inputs = document.getElementsByClassName("input-wrapper");

    if (gearDisplay == "Needed") {
        gearDisplay = "Owned";
        btn.innerText = "Switch to Needed";
        btn.style.backgroundColor = "#f5c8dd";
        updateCells(ownedMatDict, true, 'gear-count-text', 'miscasdjashdkja');
    }
    else if (gearDisplay == "Owned") {
        gearDisplay = "Needed";
        btn.innerText = "Switch to Owned";
        btn.style.backgroundColor = "#c8e6f5";
        updateCells(neededMatDict, false, 'gear-count-text', 'miscasdasdasd');
    }

    hideEmptyGear();

}

function updateInfoDisplay(character, charId) {

    var charData = data.characters.find(obj => { return obj.id == charId });

    var skillCurrent = formatLevel("Ex", charData.current?.ex) + formatLevel("Other", charData.current?.basic) +
        formatLevel("Other", charData.current?.passive) + formatLevel("Other", charData.current?.sub);

    var skillTarget = formatLevel("Ex", charData.target?.ex) + formatLevel("Other", charData.target?.basic) +
        formatLevel("Other", charData.target?.passive) + formatLevel("Other", charData.target?.sub);

    var gearCurrent = formatLevel("Gear", charData.current?.gear1) + formatLevel("Gear", charData.current?.gear2) + formatLevel("Gear", charData.current?.gear3);
    var gearTarget = formatLevel("Gear", charData.target?.gear1) + formatLevel("Gear", charData.target?.gear2) +
        formatLevel("Gear", charData.target?.gear3);

    document.getElementById(character + "-skill-current").innerText = skillCurrent;
    document.getElementById(character + "-skill-target").innerText = skillTarget;

    document.getElementById(character + "-gear-current").innerText = gearCurrent;
    document.getElementById(character + "-gear-target").innerText = gearTarget;

    document.getElementById(character + "-level-current").innerText = formatLevel("Level", charData.current.level);
    document.getElementById(character + "-level-target").innerText = formatLevel("Level", charData.target.level);

    document.getElementById(character + "-bond-current").innerText = charData.current?.bond;
    document.getElementById(character + "-bond-target").innerText = charData.target?.bond;

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

        refreshAllChars();
    }
}

function refreshAllChars() {

    var charBoxes = document.getElementsByClassName('main-display-char');

    while (charBoxes.length > 0) {
        charBoxes[0].remove();
    }

    if (data.character_order) {

        for (let i = 0; i < data.character_order.length; i++) {
            let char = data.characters.find(obj => { return obj.id == data.character_order[i] });

            if (char) {
                createCharBox(char.name, char.id);
                calculateCharResources(char, false);
            }
        }
    }

    for (var i = 0; i < data.characters.length; i++) {

        if (document.getElementById('char_' + data.characters[i].id) == undefined) {

            createCharBox(data.characters[i].name, data.characters[i].id);

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
        image.src = "icons/moon-black.svg";
        pageTheme = "light";
        document.body.classList.remove('dark-theme');
        alertColour = "black"
        switchStylesheets("light")
    }
    else if (theme == "dark") {
        image.src = "icons/sun.svg";
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

function createCharBox(newChar, charId) {

    var container = document.getElementsByClassName("charsContainer")[0];

    var addCharButton = document.getElementById("addCharButton");

    const newDiv = document.createElement("div");
    newDiv.className = "charBox main-display-char";
    newDiv.id = "char_" + charId;

    if (disabledChars.includes(newChar)) {
        newDiv.classList.add("deselected");
    }

    if (window.matchMedia("(pointer: fine)").matches) {
        newDiv.title = `Ctrl+click to disable/enable
        Shift+drag to move`
    }

    const newContent = document.createElement("div");
    newContent.className = "charBoxwrap";

    const newContentBox = document.createElement("div");
    newContentBox.className = "main-box-content";

    const newStarContainer = document.createElement("div");
    newStarContainer.className = "star-container";
    newStarContainer.id = newChar + "-star-container";

    const newBondContainer = document.createElement("div");
    newBondContainer.className = "char-heart-container";

    const newBondImg = document.createElement("img");
    newBondImg.src = "icons/bond.png";
    newBondImg.draggable = false;

    const newBondP = document.createElement("p");
    newBondP.id = newChar + "-bond-current";
    newBondP.style = "transform: translate(-50%, -95%)";

    const newBondP2 = document.createElement("p");
    newBondP2.id = newChar + "-bond-target";
    newBondP2.style = "transform: translate(-50%, -25%)";

    newBondContainer.appendChild(newBondImg);
    newBondContainer.appendChild(newBondP);
    newBondContainer.appendChild(newBondP2);

    for (i = 0; i < 5; i++) {
        const newStar = document.createElement("img");
        newStar.draggable = false;
        newStar.className = "display-star";
        newStar.src = "icons/star.png";

        newStarContainer.appendChild(newStar);
    }

    const newUEContainer = document.createElement("div");
    newUEContainer.className = "ue-container";
    newUEContainer.id = newChar + "-ue-container";

    for (i = 0; i < 5; i++) {
        const newStar = document.createElement("img");
        newStar.draggable = false;
        newStar.className = "display-star";
        newStar.src = "icons/star.png";

        newUEContainer.appendChild(newStar);
    }

    var classes = ["skill-bar", "gear-bar", "level-bar"];

    for (i = 0; i < 3; i++) {
        const newBar = document.createElement("div");
        newBar.className = classes[i] + " info-bar";

        const newP = document.createElement("p");
        newP.className = "info-display";
        newP.id = newChar + "-" + classes[i].substring(0, classes[i].indexOf('-')) + "-current";
        newBar.appendChild(newP);

        const newP2 = document.createElement("p");
        newP2.className = "info-display";
        newP2.id = newChar + "-" + classes[i].substring(0, classes[i].indexOf('-')) + "-target";
        newBar.appendChild(newP2);

        newContentBox.appendChild(newBar);
    }

    const newImg = document.createElement("img");
    newImg.src = "icons/Icon_" + charId + ".png"
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

    newContentBox.appendChild(newImg);
    newContentBox.appendChild(nameDiv).appendChild(nameTag);

    newContent.appendChild(newContentBox);

    newDiv.appendChild(newContent);
    newDiv.appendChild(newStarContainer);
    newDiv.appendChild(newUEContainer);
    newDiv.appendChild(newBondContainer);
    newDiv.onclick = openModal

    let lastNode = document.getElementById('addCharButton')

    container.insertBefore(newDiv, lastNode);

    updateInfoDisplay(newChar, charId);
    updateStarDisplay(newChar + "-star-container", newChar, charId, "star-display", false);
    updateStarDisplay(newChar + "-ue-container", newChar, charId, "ue-display", false);
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
