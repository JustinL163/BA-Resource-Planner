let pageTheme = "dark";
let alertColour = "#e1e1e1";
let keyPressed = {};
let inputMap = new Map();
let preInput;
const defaultGroups = { "Binah": [], "Chesed": [], "Hod": [], "ShiroKuro": [], "Perorodzilla": [], "Goz": [], "Hieronymous": [], "Kaiten": [] }
let lvlMAX = 87;
const languages = ["En", "Kr", "Jp", "Tw", "Th", "Id"];
let language = "En";
let gUsername, gAuthkey;

let aprilFools = false;

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

function InitKeyTracking() {

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

function ToggleImageStyle() {

    if (aprilFools) {
        aprilFools = false;
        document.getElementById('image-style-button').src = "icons/UI/ShirokoScribble.png";
    }
    else {
        aprilFools = true;
        document.getElementById('image-style-button').src = "icons/UI/ShirokoIcon.png"
    }

    localStorage.setItem('image-style', aprilFools);

    location.reload();
}

function validateBasic(input_id, checkonly) {

    let inputElement = document.getElementById(input_id);

    return validateInputBasic(input_id, inputElement.max, inputElement.min, checkonly ?? false);
}

function validateInputBasic(input_id, max, min, checkonly) {

    if (input_id == undefined) {
        return "key_no_id";
    }

    let inputElement = document.getElementById(input_id);

    if (inputElement == null) {
        return "element_null";
    }

    if (keyPressed.m) {
        inputElement.value = max;
    }

    if (inputElement.value == '') {
        if ((preInput || preInput == 0) && keyPressed.Delete != true && keyPressed.Backspace != true) {
            inputElement.value = preInput;
        }
        else {
            inputElement.value = '';
        }
    }

    if (inputElement.value.length > max?.length) {
        if (checkonly) {
            return "too_long";
        }
        if (preInput || preInput == 0) {
            inputElement.value = preInput;
        }
        else {
            inputElement.value = max;
        }
    }

    if (parseInt(inputElement.value) > parseInt(max)) {
        if (checkonly) {
            return "too_large";
        }
        if (preInput || preInput == 0) {
            inputElement.value = preInput;
        }
        else {
            inputElement.value = max;
        }
    }

    if (parseInt(inputElement.value) < parseInt(min)) {
        if (checkonly) {
            return "too_small";
        }
        inputElement.value = min;
    }

    if (isNaN(parseInt(inputElement.value))) {
        if (checkonly) {
            return "not_number";
        }
    }

    if (inputElement.value.length > 1 && inputElement.value[0] == 0) {
        inputElement.value = parseInt(inputElement.value)
    }

    return "validated";
}

function validateInput(key, checkonly, verbose) {

    if (inputValidation[key] != undefined) {

        var val = inputValidation[key];

        let validation = validateInputBasic(val.id, val.max, val.min, checkonly);

        if (validation != "validated") {
            return validation;
        }

        let inputElement = document.getElementById(val.id);

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
                        } else if (!sanitise) {
                            return maxMessage;
                        }
                    }

                    if (checkMin != null && parseInt(inputElement.value) < checkMin) {
                        if (!checkonly && sanitise) {
                            inputElement.value = checkMin;
                        } else if (!sanitise) {
                            return minMessage;
                        }
                    }
                }
                else if (valReq.type == "object" && compareMode == "direct") {

                    if (compareType == "equal_greater") {
                        if (parseInt(inputElement.value) < compareVal) {
                            if (!checkonly && sanitise) {
                                inputElement.value = compareVal;
                            } else if (!sanitise) {
                                message = val.name + " must be greater than or equal to " + compareVal;
                                return message;
                            }
                        }
                    }
                    else if (compareType == "equal_lesser") {
                        if (parseInt(inputElement.value) > compareVal) {
                            if (!checkonly && sanitise) {
                                inputElement.value = compareVal;
                            } else if (!sanitise) {
                                message = val.name + " must be lesser than or equal to " + compareVal;
                                return message;
                            }
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

                    let result = validateInput(reqKey, checkonly, verbose);

                    if (result != "validated") {
                        return result;
                    }

                    if (compareType == "equal_greater") {
                        if (parseInt(inputElement.value) < compareVal) {
                            if (!checkonly && sanitise) {
                                inputElement.value = compareVal;
                            } else if (!sanitise) {
                                message = val.name + " must be greater than or equal to " + inputValidation[reqKey].name;
                                return message;
                            }
                        }
                    }
                    else if (compareType == "equal_lesser") {
                        if (parseInt(inputElement.value) > compareVal) {
                            if (!checkonly && sanitise) {
                                inputElement.value = compareVal;
                            } else if (!sanitise) {
                                message = val.name + " must be lesser than or equal to " + inputValidation[reqKey].name;
                                return message;
                            }
                        }
                    }

                }
            }
        }

        return "validated";
    }

}

function InitInputValidation() {

    for (let key in inputValidation) {

        let inputElement = null;

        if (inputValidation[key].id != undefined) {
            inputElement = document.getElementById(inputValidation[key].id);
        }

        if (inputElement != null) {

            inputMap.set(inputValidation[key].id, key);

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

                updateTooltip(modalCharID, key);
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
                        color: alertColour,
                        showConfirmButton: false,
                        timer: 4000
                    })
                }

                if (location == "characterModal" && result == "validated") {
                    populateCharResources(modalCharID)

                    if (event.target.id == "input_gear1_current" || event.target.id == "input_gear2_current" || event.target.id == "input_gear3_current") {

                        if (event.target.value != "0") {

                            let charInfo = charlist[modalCharID];

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

                            let charInfo = charlist[modalCharID];

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

                preInput = '';
            })

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

function commafy(num) {
    var parts = ('' + (num < 0 ? -num : num)).split("."), s = parts[0], L, i = L = s.length, o = '';
    while (i--) {
        o = (i === 0 ? '' : ((L - i) % 3 ? '' : ','))
            + s.charAt(i) + o
    }
    return (num < 0 ? '-' : '') + o + (parts[1] ? '.' + parts[1] : '');
}

function ShortenNumber(num, decimalPlaces = 1, unitLetters = ['', 'K', 'M', 'B', 'T']) {
    const units = Math.min(unitLetters.length - 1, Math.floor(Math.log10(Math.abs(num)) / 3));
    const result = num / Math.pow(10, units * 3);
    const truncatedResult = result.toFixed(decimalPlaces).replace(/\.?0+$/, '');
    return truncatedResult + unitLetters[units];
}

function GetLanguageString(dataId) {

    if (language_strings[dataId]) {

        //return "Done"
        let languageUpper = language.toUpperCase();

        if (language_strings[dataId][languageUpper]) {
            return language_strings[dataId][languageUpper];
        }
        else {
            return language_strings[dataId]["EN"];
        }
    }
    else {
        return "Undefined"
    }
}

function buildLanguages() {

    let selectElement = document.getElementById('languages');

    for (let i = 0; i < languages.length; i++) {

        if (languages[i] == "Tw") {
            addOption(selectElement, "CN", "Tw");
            continue;
        }
        addOption(selectElement, languages[i].toUpperCase(), languages[i]);
    }
}

function addOption(selectElement, text, value) {
    let newGroupOption = document.createElement('option');
    newGroupOption.text = text;
    newGroupOption.value = value;
    selectElement.add(newGroupOption);
}

function languageChanged() {

    let selectElement = document.getElementById('languages');
    selectElement.blur();

    let languageSet = selectElement.value;
    data.language = languageSet;

    localStorage.setItem("save-data", JSON.stringify(data));

    location.reload();
}

function Save(seconds) {
    saveTime = Date.now() + (1000 * seconds);
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