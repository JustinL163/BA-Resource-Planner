(() => {
    let inputType, timeLimit, maxGuesses, colourMode, gameContent, lenience, dateMode, consciousState;
    let input;
    let multiChoice;
    let timer;
    let gameActive = false;
    let retryingGame = false;

    let failedState = false;
    let failBonus = false;

    let students_released = [];
    let UE_weapons = [];
    let chocolates = [];
    let alt_students = [];
    let validGuesses = [];

    let haloOrder = [];
    let currentImage = 0;
    let currentGuesses = 0;

    let failedGuesses = [];

    let baseScores = [2108000, 4216000, 10160000, 21016000, 31708000];
    let timeScores = [1728000, 3456000, 5184000, 6912000, 8640000];

    let oneToThirtyOne = [];

    let guessEndTime = 0;

    let startTime = 0, endTime = 0;

    let correct = 0, wrong = 0;

    let data;
    fetch('guesser/data.json?3').then((response) => response.json()).then((json) => {
        data = json;

        ProcessData();
    });

    $(document).ready(Init);

    function Init() {

        ContentType("Halos");
        InputType("Freeform");
        TimeLimit(false);
        MaxGuess(1);
        ColourMode("Colour");
        Lenience(3);
        DateMode("Date");
        ConsciousState("Sleeping");

        input = document.getElementById("freeform-input");
        multiChoice = document.getElementById("mode-multichoice");
        timer = document.getElementById("timer");

        document.getElementById("freeform-input").addEventListener('keypress', (e) => {
            if (e.code == "Enter") {
                Submit();
            }
        })

        document.getElementById("freeform-input").addEventListener('keydown', (e) => {
            if (failedState || !/[a-z]/i.test(e.key) && ["Halos", "Weapons", "Chocolates", "Silhouettes", "Surnames"].includes(gameContent)) {
                e.preventDefault();
            }
            else if (gameContent == "Ages" && !/[a-z\d?]/i.test(e.key) && !(e.key == " ")) {
                e.preventDefault();
            }
            else if (gameContent == "Heights" && !/[0-9]/i.test(e.key) && !(["Backspace", "ArrowLeft", "ArrowRight", "Delete", "Enter"].includes(e.key))) {
                e.preventDefault();
            }
        })

        $("#content-Halos").click(() => {
            ContentType("Halos");
        });

        $("#content-Weapons").click(() => {
            ContentType("Weapons");
        });

        $("#content-Chocolates").click(() => {
            ContentType("Chocolates");
        });

        $("#content-Silhouettes").click(() => {
            ContentType("Silhouettes");
        });

        $("#content-Surnames").click(() => {
            ContentType("Surnames");
        });

        $("#content-Ages").click(() => {
            ContentType("Ages");
        });

        $("#content-Birthdays").click(() => {
            ContentType("Birthdays");
        });

        $("#content-Heights").click(() => {
            ContentType("Heights");
        });

        $("#input-freeform").click(() => {
            InputType("Freeform")
        });
        $("#input-multichoice").click(() => {
            InputType("MultiChoice");
        });

        $("#time-1\\.5s").click(() => {
            TimeLimit(1.5);
        });
        $("#time-3s").click(() => {
            TimeLimit(3);
        });
        $("#time-10s").click(() => {
            TimeLimit(10);
        });
        $("#time-none").click(() => {
            TimeLimit(false);
        });

        $("#guesses-1").click(() => {
            MaxGuess(1);
        });
        $("#guesses-2").click(() => {
            MaxGuess(2);
        });
        $("#guesses-3").click(() => {
            MaxGuess(3);
        });

        $("#mode-colour").click(() => {
            ColourMode("Colour");
        });
        $("#mode-grayscale").click(() => {
            ColourMode("Grayscale");
        });

        $("#lenience-0").click(() => {
            Lenience(0);
        });
        $("#lenience-1").click(() => {
            Lenience(1);
        });
        $("#lenience-3").click(() => {
            Lenience(3);
        });

        $("#datemode-month").click(() => {
            DateMode("Month");
        });
        $("#datemode-date").click(() => {
            DateMode("Date");
        });

        $("#state-conscious").click(() => {
            ConsciousState("Awake");
        });
        $("#state-sleeping").click(() => {
            ConsciousState("Sleeping");
        });

        $("#start-banner").click(() => {
            Start(false);
        });

        $("#return-button").click(() => {
            Restart();
        });

        $("#retry-button").click(() => {
            Retry();
        })

        $("#submit-button").click(() => {
            Submit();
        })

        $("#restart-button").click(() => {
            PromptReset();
        })

        for (let i = 1; i <= 31; i++) {
            oneToThirtyOne.push(i.toString());
        }

        setInterval(() => {
            if (gameActive && timeLimit && !failedState) {
                let curTime = Date.now();
                if (curTime < guessEndTime) {
                    let remainingTime = ((guessEndTime - curTime) / 1000).toFixed(1);
                    timer.innerText = remainingTime;
                }
                else if (curTime > guessEndTime) {
                    timer.innerText = 0;
                    wrong++;
                    Failed();
                    UpdateDisplay();
                }
            }
        }, 30);
    }

    function ProcessData() {

        let haloKeys = Object.keys(data.halos);

        for (let i = 0; i < haloKeys.length; i++) {
            if (data.halos[haloKeys[i]].released) {
                students_released.push($.extend({}, data.halos[haloKeys[i]]));
                students_released[students_released.length - 1].id = haloKeys[i];
            }

            if (data.halos[haloKeys[i]].weapons) {
                for (let ii = 0; ii < data.halos[haloKeys[i]].weapons.length; ii++) {
                    UE_weapons.push($.extend({}, data.halos[haloKeys[i]]));
                    UE_weapons[UE_weapons.length - 1].weapon = data.halos[haloKeys[i]].weapons[ii];
                }
            }

            if (data.halos[haloKeys[i]].chocolate) {
                chocolates.push($.extend({}, data.halos[haloKeys[i]]));
                chocolates[chocolates.length - 1].id = haloKeys[i];
            }

            if (data.halos[haloKeys[i]].alts) {
                for (let ii = 0; ii < data.halos[haloKeys[i]].alts.length; ii++) {
                    alt_students.push($.extend({}, data.halos[haloKeys[i]]));
                    alt_students[alt_students.length - 1].alt = data.halos[haloKeys[i]].alts[ii];
                }
            }
        }
    }

    function ContentType(content) {

        gameContent = content;

        document.getElementById("content-Halos").classList.remove("selected");
        document.getElementById("content-Weapons").classList.remove("selected");
        document.getElementById("content-Chocolates").classList.remove("selected");
        document.getElementById("content-Silhouettes").classList.remove("selected");
        document.getElementById("content-Surnames").classList.remove("selected");
        document.getElementById("content-Ages").classList.remove("selected");
        document.getElementById("content-Birthdays").classList.remove("selected");
        document.getElementById("content-Heights").classList.remove("selected");

        document.getElementById("content-" + content).classList.add("selected");

        document.getElementById("colour-setting-label").style.display = "";
        document.getElementById("colour-mode").style.display = "";
        document.getElementById("lenience-setting-label").style.display = "none";
        document.getElementById("lenience-setting").style.display = "none";
        document.getElementById("datemode-setting-label").style.display = "none";
        document.getElementById("datemode").style.display = "none";
        document.getElementById("conscious-setting-label").style.display = "none";
        document.getElementById("conscious-setting").style.display = "none";


        if (gameContent == "Halos") {
            document.getElementById("title").innerText = "Who's that Halo?";
        }
        else if (gameContent == "Weapons") {
            document.getElementById("title").innerText = "Who's that Weapon?";
        }
        else if (gameContent == "Chocolates") {
            document.getElementById("title").innerText = "Who's that Chocolate?";
        }
        else if (gameContent == "Silhouettes") {
            document.getElementById("title").innerText = "Who's that Student?";
            document.getElementById("conscious-setting-label").style.display = "";
            document.getElementById("conscious-setting").style.display = "";
        }
        else if (gameContent == "Surnames") {
            document.getElementById("title").innerText = "Who's that Surname?";
        }
        else if (gameContent == "Ages") {
            document.getElementById("title").innerText = "Who's that Age?";
        }
        else if (gameContent == "Birthdays") {
            document.getElementById("title").innerText = "Who's that Birthday?";
            document.getElementById("datemode-setting-label").style.display = "";
            document.getElementById("datemode").style.display = "";
        }
        else if (gameContent == "Heights") {
            document.getElementById("title").innerText = "Who's that Height?";
            if (inputType == "Freeform") {
                document.getElementById("lenience-setting-label").style.display = "";
                document.getElementById("lenience-setting").style.display = "";
            }
        }

        if (["Silhouettes", "Surnames", "Ages", "Birthdays", "Heights"].includes(gameContent)) {
            document.getElementById("colour-setting-label").style.display = "none";
            document.getElementById("colour-mode").style.display = "none";
        }
    }

    function InputType(type) {

        inputType = type;

        document.getElementById("input-freeform").classList.remove("selected");
        document.getElementById("input-multichoice").classList.remove("selected");

        if (type == "Freeform") {
            document.getElementById("input-freeform").classList.add("selected");
            document.getElementById("time-1.5s").style.display = "none";
            document.getElementById("guess-limit").style.display = "";
            document.getElementById("guess-limit-label").style.display = "";
            if (timeLimit == 1.5) {
                TimeLimit(3);
            }

            if (gameContent == "Heights") {
                document.getElementById("lenience-setting-label").style.display = "";
                document.getElementById("lenience-setting").style.display = "";
            }
        }
        else if (type == "MultiChoice") {
            document.getElementById("input-multichoice").classList.add("selected");
            document.getElementById("time-1.5s").style.display = "";
            document.getElementById("guess-limit").style.display = "none";
            document.getElementById("guess-limit-label").style.display = "none";
            MaxGuess(1);

            if (gameContent == "Heights") {
                document.getElementById("lenience-setting-label").style.display = "none";
                document.getElementById("lenience-setting").style.display = "none";
            }
        }
    }

    function TimeLimit(time) {

        timeLimit = time;

        let timeLimits = document.getElementsByClassName("time-limits");

        for (let i = 0; i < timeLimits.length; i++) {
            timeLimits[i].classList.remove("selected");
        }

        if (time) {
            document.getElementById("time-" + time + "s").classList.add("selected");
        }
        else if (!time) {
            document.getElementById("time-none").classList.add("selected");
        }
    }

    function MaxGuess(guessCount) {

        maxGuesses = guessCount;

        document.getElementById("guesses-1").classList.remove("selected");
        document.getElementById("guesses-2").classList.remove("selected");
        document.getElementById("guesses-3").classList.remove("selected");

        if (maxGuesses == 1) {
            document.getElementById("guesses-1").classList.add("selected");
        }
        else if (maxGuesses == 2) {
            document.getElementById("guesses-2").classList.add("selected");
        }
        else if (maxGuesses == 3) {
            document.getElementById("guesses-3").classList.add("selected");
        }
    }

    function ColourMode(colour) {

        colourMode = colour;

        document.getElementById("mode-colour").classList.remove("selected");
        document.getElementById("mode-grayscale").classList.remove("selected");

        if (colourMode == "Colour") {
            document.getElementById("mode-colour").classList.add("selected");
        }
        else if (colourMode == "Grayscale") {
            document.getElementById("mode-grayscale").classList.add("selected");
        }

    }

    function Lenience(num) {

        lenience = num;

        document.getElementById("lenience-0").classList.remove("selected");
        document.getElementById("lenience-1").classList.remove("selected");
        document.getElementById("lenience-3").classList.remove("selected");

        if (lenience == 0) {
            document.getElementById("lenience-0").classList.add("selected");
        }
        else if (lenience == 1) {
            document.getElementById("lenience-1").classList.add("selected");
        }
        else if (lenience == 3) {
            document.getElementById("lenience-3").classList.add("selected");
        }
    }

    function DateMode(mode) {

        dateMode = mode;

        document.getElementById("datemode-month").classList.remove("selected");
        document.getElementById("datemode-date").classList.remove("selected");

        if (dateMode == "Month") {
            document.getElementById("datemode-month").classList.add("selected");
        }
        else if (dateMode == "Date") {
            document.getElementById("datemode-date").classList.add("selected");
        }
    }

    function ConsciousState(state) {

        consciousState = state;

        document.getElementById("state-conscious").classList.remove("selected");
        document.getElementById("state-sleeping").classList.remove("selected");

        if (consciousState == "Awake") {
            document.getElementById("state-conscious").classList.add("selected");
        }
        else if (consciousState == "Sleeping") {
            document.getElementById("state-sleeping").classList.add("selected");
        }
    }

    function Start(retry) {

        retryingGame = retry;

        if (!data) {
            return;
        }

        correct = 0;
        wrong = 0;

        document.getElementById("settings").style.display = "none";
        document.getElementById("guesses-container").style.display = "";
        document.getElementById("timer").style.display = "";
        document.getElementById("restart-button").style.display = "";
        document.getElementById("display-image").classList.remove("menu");

        if (inputType == "Freeform") {
            document.getElementById("mode-freeform").style.display = "";
        }
        else if (inputType == "MultiChoice") {
            document.getElementById("mode-multichoice").style.display = "";
            maxGuesses = 1;
        }

        if (gameContent == "Weapons") {
            document.getElementById("display-image").classList.add("weapon");
        }
        else if (gameContent == "Silhouettes") {
            document.getElementById("display-image").classList.add("splashart");
        }
        else if (gameContent == "Surnames" || gameContent == "Ages" || gameContent == "Birthdays" || gameContent == "Heights") {
            document.getElementById("display-image").classList.add("splashart");
        }

        haloOrder = [];

        if (retry) {
            haloOrder = haloOrder.concat(haloOrder, failedGuesses);
            failedGuesses = [];
        }
        else {

            if (gameContent == "Halos") {
                haloOrder = haloOrder.concat(students_released);
            }
            else if (gameContent == "Weapons") {
                haloOrder = haloOrder.concat(UE_weapons);
            }
            else if (gameContent == "Chocolates") {
                haloOrder = haloOrder.concat(chocolates);
            }
            else if (gameContent == "Silhouettes") {
                haloOrder = haloOrder.concat(alt_students);
            }
            else if (gameContent == "Surnames" || gameContent == "Ages" || gameContent == "Birthdays" || gameContent == "Heights") {
                haloOrder = haloOrder.concat(students_released);
            }
        }

        validGuesses = [];

        for (let i = 0; i < haloOrder.length; i++) {
            if (["Halos", "Weapons", "Chocolates", "Silhouettes"].includes(gameContent)) {
                validGuesses.push(haloOrder[i].name.toLowerCase());

                if (!haloOrder[i].altnames) { continue; }

                for (let ii = 0; ii < haloOrder[i].altnames.length; ii++) {
                    validGuesses.push(haloOrder[i].altnames[ii].toLowerCase());
                }
            }
            else if (gameContent == "Surnames") {
                if (!validGuesses.includes(haloOrder[i].surname.toLowerCase())) {
                    validGuesses.push(haloOrder[i].surname.toLowerCase());
                }
            }
            else if (gameContent == "Ages") {
                let tAge = haloOrder[i].age;
                if (typeof (tAge) == "string") {
                    tAge = tAge.toLowerCase();
                }

                if (!validGuesses.includes(tAge)) {
                    validGuesses.push(tAge);
                }
            }
        }

        if (gameContent == "Heights") {
            for (let i = 128; i < 180; i++) {
                validGuesses.push(i);
            }
        }

        if (gameContent == "Birthdays") {
            validGuesses = ["jan", "january", "feb", "february", "mar", "march", "apr", "april", "may", "jun", "june", "jul", "july", "aug", "august",
                "sep", "september", "oct", "october", "nov", "november", "dec", "december"];
        }

        shuffle(haloOrder);
        
        currentImage = 0;

        LoadNext();

        gameActive = true;
        input.focus();

        UpdateDisplay();

        startTime = Date.now();
    }

    function LoadNext() {
        let halo = haloOrder[currentImage];

        document.getElementById("guess-picture").style.filter = "";

        if (gameContent == "Halos") {
            document.getElementById("guess-picture").src = "halo/" + halo.id + ".webp";
        }
        else if (gameContent == "Weapons") {
            document.getElementById("guess-picture").src = "../planner/icons/UE/weapon_icon_" + halo.weapon + ".webp";
        }
        else if (gameContent == "Chocolates") {
            document.getElementById("guess-picture").src = "chocolate/" + halo.id + ".webp";
        }
        else if (gameContent == "Silhouettes") {
            if (consciousState == "Sleeping") {
                document.getElementById("guess-picture").src = "sleeping/" + halo.alt + ".webp";
            }
            else if (consciousState == "Awake") {
                document.getElementById("guess-picture").src = "../planner/icons/splashart/" + halo.alt + ".webp";
            }
            document.getElementById("guess-picture").style.filter = "brightness(0)";
        }
        else if (gameContent == "Surnames" || gameContent == "Ages" || gameContent == "Birthdays" || gameContent == "Heights") {
            document.getElementById("guess-picture").src = "../planner/icons/splashart/" + halo.alts[0] + ".webp";
        }

        if (colourMode == "Colour" && gameContent != "Silhouettes") {
            document.getElementById("guess-picture").style.filter = "";
        }
        else if (colourMode == "Grayscale" && gameContent != "Silhouettes") {
            document.getElementById("guess-picture").style.filter = "grayscale(1)";
        }

        let guessChoices;
        if (["Halos", "Weapons", "Chocolates", "Silhouettes"].includes(gameContent)) {
            guessChoices = [halo.name];
        }
        else if (gameContent == "Surnames") {
            guessChoices = [halo.surname];
        }
        else if (gameContent == "Ages") {
            guessChoices = [halo.age];
        }
        else if (gameContent == "Heights") {
            guessChoices = [halo.height];
        }
        else if (gameContent == "Birthdays") {
            if (dateMode == "Month") {
                guessChoices = [halo.birthday.substring(0, halo.birthday.indexOf(" "))];
            }
            else if (dateMode == "Date") {
                guessChoices = [halo.birthday];
            }
        }

        if (inputType == "MultiChoice") {

            while (guessChoices.length < Math.min(4, haloOrder.length)) {
                let random = Math.floor(Math.random() * haloOrder.length);
                let choiceName;
                if (["Halos", "Weapons", "Chocolates", "Silhouettes"].includes(gameContent)) {
                    choiceName = haloOrder[random].name;
                }
                else if (gameContent == "Surnames") {
                    choiceName = haloOrder[random].surname;
                }
                else if (gameContent == "Ages") {
                    choiceName = haloOrder[random].age;
                }
                else if (gameContent == "Heights") {
                    choiceName = haloOrder[random].height;
                }
                else if (gameContent == "Birthdays") {
                    if (dateMode == "Month") {
                        choiceName = haloOrder[random].birthday.substring(0, haloOrder[random].birthday.indexOf(" "));
                    }
                    else if (dateMode == "Date") {
                        choiceName = haloOrder[random].birthday;
                    }
                }

                if (!guessChoices.includes(choiceName)) {
                    guessChoices.push(choiceName);
                }
            }

            shuffle(guessChoices);

            while (multiChoice.children.length > 0) {
                multiChoice.children[0].remove();
            }

            for (let i = 0; i < guessChoices.length; i++) {
                let newChoice = document.createElement("div");
                newChoice.innerText = guessChoices[i];
                if (typeof (guessChoices[i]) == "number") {
                    newChoice.id = guessChoices[i];
                }
                else {
                    newChoice.id = guessChoices[i].toLowerCase();
                }
                newChoice.addEventListener('click', (e) => {
                    Submit(e.currentTarget.innerText.toLowerCase());
                })

                multiChoice.appendChild(newChoice);
            }
        }

        if (timeLimit) {
            guessEndTime = Date.now() + timeLimit * 1000;
            timer.innerText = "10";
        }

        if (currentImage == 0) {
            guessEndTime += 1000;
        }

        if (failBonus) {
            guessEndTime += 500;
            failBonus = false;
        }

        currentGuesses = 0;
    }

    function Submit(choice) {

        let answer;

        if (failedState) {
            return;
        }

        if (choice) {
            answer = choice;
        }
        else {
            answer = input.value.toLowerCase();
            if (/^\d*$/i.test(answer)) {
                answer = parseInt(answer);
            }

            if (answer == "" || !validGuesses.includes(answer)) {
                if (answer && gameContent == "Birthdays" && dateMode == "Date" && answer.indexOf(" ") > 0 && validGuesses.includes(answer.substring(0, answer.indexOf(" ")))
                    && oneToThirtyOne.includes(answer.substring(answer.indexOf(" ") + 1))) { }
                else {
                    return;
                }
            }

            input.value = "";
        }

        currentGuesses++;

        if (["Halos", "Weapons", "Chocolates", "Silhouettes"].includes(gameContent) &&
            haloOrder[currentImage].name.toLowerCase() == answer || (haloOrder[currentImage].altnames && haloOrder[currentImage].altnames.includes(answer))) {

            Correct();
        }
        else if (gameContent == "Surnames" && haloOrder[currentImage].surname.toLowerCase() == answer) {
            Correct();

        }
        else if (gameContent == "Ages" && haloOrder[currentImage].age == answer) {
            Correct();
        }
        else if (gameContent == "Heights" && haloOrder[currentImage].height == answer) {
            Correct();
        }
        else if (gameContent == "Heights" && inputType == "Freeform" && Math.abs(haloOrder[currentImage].height - answer) <= lenience) {
            HalfCorrect();
        }
        else if (gameContent == "Birthdays" && dateMode == "Month" &&
            (haloOrder[currentImage].birthday.substring(0, haloOrder[currentImage].birthday.indexOf(" ")).toLowerCase() == answer ||
                haloOrder[currentImage].birthday.substring(0, 3).toLowerCase() == answer)) {

            Correct();
        }
        else if (gameContent == "Birthdays" && dateMode == "Date" && answer.indexOf(" ") > 0 &&
            ((haloOrder[currentImage].birthday.substring(0, haloOrder[currentImage].birthday.indexOf(" ")).toLowerCase() == answer.substring(0, answer.indexOf(" "))
                && haloOrder[currentImage].birthday.substring(haloOrder[currentImage].birthday.indexOf(" ") + 1) == answer.substring(answer.indexOf(" ") + 1)) ||
                (haloOrder[currentImage].birthday.substring(0, 3).toLowerCase() == answer.substring(0, answer.indexOf(" ")) &&
                    haloOrder[currentImage].birthday.substring(haloOrder[currentImage].birthday.indexOf(" ") + 1) == answer.substring(answer.indexOf(" ") + 1)))) {
            Correct();
        }
        else if (currentGuesses >= maxGuesses) {
            Failed(answer);
        }

        UpdateDisplay();
    }

    function Correct() {
        currentImage++;
        correct++;

        if (currentImage == haloOrder.length) {
            Finish(!retryingGame);
        }
        else {
            LoadNext();
        }
    }

    function HalfCorrect() {

        failedState = true;

        let correctAnswer;
        if (["Halos", "Weapons", "Chocolates", "Silhouettes"].includes(gameContent)) {
            correctAnswer = haloOrder[currentImage].name;
        }
        else if (gameContent == "Surnames") {
            correctAnswer = haloOrder[currentImage].surname;
        }
        else if (gameContent == "Ages") {
            correctAnswer = haloOrder[currentImage].age;
        }
        else if (gameContent == "Heights") {
            correctAnswer = haloOrder[currentImage].height;
        }

        if (inputType == "Freeform") {
            input.value = correctAnswer;
            input.classList.add("halfcorrect");
        }

        currentImage++;
        correct++;
        UpdateDisplay();

        setTimeout(() => {
            if (gameActive) {
                input.classList.remove("halfcorrect");
                input.value = "";
                failedState = false;
                if (currentImage == haloOrder.length) {
                    Finish(!retryingGame);
                }
                else {
                    LoadNext();
                }
            }
        }, 2000);
    }

    function Failed(name) {

        wrong++;

        failedState = true;
        failBonus = true;

        failedGuesses.push(haloOrder[currentImage]);

        let correctAnswer;
        if (["Halos", "Weapons", "Chocolates", "Silhouettes"].includes(gameContent)) {
            correctAnswer = haloOrder[currentImage].name;
        }
        else if (gameContent == "Surnames") {
            correctAnswer = haloOrder[currentImage].surname;
        }
        else if (gameContent == "Ages") {
            correctAnswer = haloOrder[currentImage].age;
        }
        else if (gameContent == "Heights") {
            correctAnswer = haloOrder[currentImage].height;
        }
        else if (gameContent == "Birthdays") {
            if (dateMode == "Month") {
                correctAnswer = haloOrder[currentImage].birthday.substring(0, haloOrder[currentImage].birthday.indexOf(" "));
            }
            else if (dateMode == "Date") {
                correctAnswer = haloOrder[currentImage].birthday;
            }
        }

        if (inputType == "Freeform") {
            input.value = correctAnswer;
            input.classList.add("failed");
        }
        else if (inputType == "MultiChoice") {
            if (name) {
                document.getElementById(name).classList.add("wrong-choice");
            }

            if (typeof (correctAnswer) == "number") {
                document.getElementById(correctAnswer).classList.add("correct-choice");
            }
            else {
                document.getElementById(correctAnswer.toLowerCase()).classList.add("correct-choice");
            }
        }

        if (gameContent == "Silhouettes") {
            document.getElementById("guess-picture").style.filter = "";
        }

        currentImage++;
        UpdateDisplay();

        setTimeout(() => {
            if (gameActive) {
                input.classList.remove("failed");
                input.value = "";
                failedState = false;
                if (currentImage == haloOrder.length) {
                    Finish(!retryingGame);
                }
                else {
                    LoadNext();
                }
            }
        }, 2000);
    }

    function Finish(completed) {
        endTime = Date.now();
        gameActive = false;

        document.getElementById("guesses-container").style.display = "none";
        document.getElementById("mode-freeform").style.display = "none";
        document.getElementById("mode-multichoice").style.display = "none";
        document.getElementById("timer").style.display = "none";
        document.getElementById("restart-button").style.display = "none";

        document.getElementById("final-guesses").style.display = "";
        document.getElementById("total-time").style.display = "";
        document.getElementById("return-button").style.display = "";
        if (failedGuesses.length > 0) {
            document.getElementById("retry-button").style.display = "";
        }

        document.getElementById("final-correct-guesses").innerText = correct;
        document.getElementById("final-wrong-guesses").innerText = wrong;
        document.getElementById("modifiers-short").innerText = "Retry";

        let timeElapsed = (endTime - startTime) / 1000;

        let minutesElapsed = Math.floor(timeElapsed / 60);
        let secondsElapsed = timeElapsed - minutesElapsed * 60;

        if (Math.trunc(secondsElapsed).toString().length == 1) {
            secondsElapsed = "0" + secondsElapsed.toFixed(2);
        }
        else {
            secondsElapsed = secondsElapsed.toFixed(2);
        }

        document.getElementById("total-time").innerText = minutesElapsed + ":" + secondsElapsed;

        if (completed) {
            document.getElementById("final-score").style.display = "";
            document.getElementById("modifiers-short").style.display = "";

            document.getElementById("final-score").innerText = GetScore(timeElapsed);


            let modifierShort = "";

            // Build modifier short string
            modifierShort += gameContent + " ";
            modifierShort += inputType.substring(0, 1) + " ";

            if (!timeLimit) {
                modifierShort += "0s ";
            }
            else {
                modifierShort += timeLimit + "s ";
            }

            if (inputType == "Freeform") {
                modifierShort += maxGuesses + " ";
            }

            if (["Halos", "Weapons", "Chocolates"].includes(gameContent)) {
                modifierShort += colourMode.substring(0, 1);
            }
            else if (gameContent == "Birthdays") {
                modifierShort += dateMode.substring(0, 1);
            }
            else if (gameContent == "Heights" && inputType == "Freeform") {
                modifierShort += lenience + "cm";
            }
            else if (gameContent == "Silhouettes") {
                modifierShort += consciousState.substring(0, 1);
            }

            document.getElementById("modifiers-short").innerText = modifierShort;
        }

    }

    function GetScore(timeElapsed) {

        let difficulty;

        if ((inputType == "Freeform" && timeLimit == 3 && maxGuesses == 1) || (inputType == "MultiChoice" && timeLimit == 1.5)) {
            difficulty = 4;
        }
        else if ((inputType == "Freeform" && timeLimit == 10 && maxGuesses == 1) || (inputType == "MultiChoice" && timeLimit == 3)) {
            difficulty = 3;
        }
        else if ((inputType == "Freeform" && timeLimit == 10) || (inputType == "MultiChoice" && timeLimit == 10)) {
            difficulty = 2;
        }
        else if ((inputType == "Freeform" && !timeLimit && maxGuesses == 1) || (inputType == "MultiChoice")) {
            difficulty = 1;
        }
        else {
            difficulty = 0;
        }

        let basePercentage = (Math.pow(correct, 2) / 10000);

        let baseScore = baseScores[difficulty] * basePercentage;

        let maxTimeRoot = Math.sqrt(haloOrder.length * 30);
        let minTimeRoot = Math.sqrt(haloOrder.length);

        let timeScore = timeScores[difficulty] - timeScores[difficulty] * Math.min(Math.max((Math.sqrt(timeElapsed) - minTimeRoot) / (maxTimeRoot - minTimeRoot), 0), 1);

        let colourModifier = 1;
        if (colourMode == "Grayscale") {
            colourModifier = 1.05;
        }

        let score = commafy(Math.ceil((baseScore + timeScore) * colourModifier));

        return score;
    }

    function Restart() {

        input.classList.remove("failed");
        input.classList.remove("halfcorrect");
        input.value = "";
        failedState = false;

        document.getElementById("final-guesses").style.display = "none";
        document.getElementById("total-time").style.display = "none";
        document.getElementById("final-score").style.display = "none";
        document.getElementById("modifiers-short").style.display = "none";
        document.getElementById("return-button").style.display = "none";
        document.getElementById("retry-button").style.display = "none";
        document.getElementById("restart-button").style.display = "none";

        document.getElementById("guess-picture").src = "guesser/BA_halo.webp";
        document.getElementById("guess-picture").style.filter = "";
        document.getElementById("display-image").classList.remove("weapon");
        document.getElementById("display-image").classList.remove("splashart");
        document.getElementById("display-image").classList.add("menu");

        document.getElementById("settings").style.display = "";
    }

    function Retry() {
        document.getElementById("final-guesses").style.display = "none";
        document.getElementById("total-time").style.display = "none";
        document.getElementById("final-score").style.display = "none";
        document.getElementById("modifiers-short").style.display = "none";
        document.getElementById("return-button").style.display = "none";
        document.getElementById("retry-button").style.display = "none";
        document.getElementById("restart-button").style.display = "none";

        Start(true);
    }

    function PromptReset() {

        Swal.fire({
            title: "Return to menu?",
            color: "#000000",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: "Quit",
            cancelButtonText: "Cancel"
        }).then((result) => {
            if (result.isConfirmed) {
                Finish(false);
                Restart();
            }
        })
    }

    function UpdateDisplay() {
        document.getElementById("correct-guesses").innerText = correct;
        document.getElementById("wrong-guesses").innerText = wrong;
        document.getElementById("remaining-guesses").innerText = (haloOrder.length - currentImage);
    }

    function shuffle(array) {
        let currentIndex = array.length, randomIndex;

        // While there remain elements to shuffle.
        while (currentIndex > 0) {

            // Pick a remaining element.
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }

        return array;
    }

    function commafy(num) {
        var parts = ('' + (num < 0 ? -num : num)).split("."), s = parts[0], L, i = L = s.length, o = '';
        while (i--) {
            o = (i === 0 ? '' : ((L - i) % 3 ? '' : ','))
                + s.charAt(i) + o
        }
        return (num < 0 ? '-' : '') + o + (parts[1] ? '.' + parts[1] : '');
    }
})();