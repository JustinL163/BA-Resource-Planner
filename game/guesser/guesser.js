(() => {
    let inputType, timeLimit, maxGuesses, colourMode;
    let input;
    let multiChoice;
    let timer;
    let gameActive = false;

    let failedState = false;
    let failBonus = false;

    let students_released = [];
    let validGuesses = [];

    let haloOrder = [];
    let currentImage = 0;
    let currentGuesses = 0;

    let baseScores = [2108000, 4216000, 10160000, 21016000, 31708000];
    let timeScores = [1728000, 3456000, 5184000, 6912000, 8640000];

    let guessEndTime = 0;

    let startTime = 0, endTime = 0;

    let correct = 0, wrong = 0;

    let data;
    fetch('guesser/data.json').then((response) => response.json()).then((json) => {
        data = json;

        ProcessData();
    });

    $(document).ready(Init);

    function Init() {

        InputType("Freeform");
        TimeLimit(false);
        MaxGuess(1);
        ColourMode("Colour");

        input = document.getElementById("freeform-input");
        multiChoice = document.getElementById("mode-multichoice");
        timer = document.getElementById("timer");

        document.getElementById("freeform-input").addEventListener('keypress', (e) => {
            if (e.code == "Enter") {
                Submit();
            }
        })

        document.getElementById("freeform-input").addEventListener('keydown', (e) => {
            if (failedState || !/[a-z]/i.test(e.key)) {
                e.preventDefault();
            }
        })

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

        $("#start-banner").click(() => {
            Start();
        });

        $("#return-button").click(() => {
            Restart();
        });

        $("#submit-button").click(() => {
            Submit();
        })

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
                students_released.push(data.halos[haloKeys[i]]);
                students_released[students_released.length - 1].id = haloKeys[i];
            }
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
        }
        else if (type == "MultiChoice") {
            document.getElementById("input-multichoice").classList.add("selected");
            document.getElementById("time-1.5s").style.display = "";
            document.getElementById("guess-limit").style.display = "none";
            document.getElementById("guess-limit-label").style.display = "none";
            MaxGuess(1);
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

    function Start() {

        if (!data) {
            return;
        }

        correct = 0;
        wrong = 0;

        document.getElementById("settings").style.display = "none";
        document.getElementById("guesses-container").style.display = "";
        document.getElementById("timer").style.display = "";

        if (inputType == "Freeform") {
            document.getElementById("mode-freeform").style.display = "";
        }
        else if (inputType == "MultiChoice") {
            document.getElementById("mode-multichoice").style.display = "";
            maxGuesses = 1;
        }

        haloOrder = [];

        haloOrder = haloOrder.concat(students_released);

        for (let i = 0; i < haloOrder.length; i++) {
            validGuesses.push(haloOrder[i].name.toLowerCase());

            if (!haloOrder[i].altnames) { continue; }

            for (let ii = 0; ii < haloOrder[i].altnames.length; ii++) {
                validGuesses.push(haloOrder[i].altnames[ii].toLowerCase());
            }
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

        document.getElementById("guess-picture").src = "halo/" + halo.id + ".webp";

        if (colourMode == "Colour") {
            document.getElementById("guess-picture").style.filter = "";
        }
        else if (colourMode == "Grayscale") {
            document.getElementById("guess-picture").style.filter = "grayscale(1)";
        }

        let guessChoices = [halo.name];
        if (inputType == "MultiChoice") {

            while (guessChoices.length < 4) {
                let random = Math.floor(Math.random() * haloOrder.length);
                let choiceName = haloOrder[random].name;

                if (!guessChoices.includes(choiceName)) {
                    guessChoices.push(choiceName);
                }
            }

            shuffle(guessChoices);

            while (multiChoice.children.length > 0) {
                multiChoice.children[0].remove();
            }

            for (let i = 0; i < 4; i++) {
                let newChoice = document.createElement("div");
                newChoice.innerText = guessChoices[i];
                newChoice.id = guessChoices[i].toLowerCase();
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

        let name;

        if (failedState) {
            return;
        }

        if (choice) {
            name = choice;
        }
        else {
            name = input.value.toLowerCase();

            if (name == "" || !validGuesses.includes(name)) {
                return;
            }

            input.value = "";
        }

        currentGuesses++;

        if (haloOrder[currentImage].name.toLowerCase() == name || (haloOrder[currentImage].altnames && haloOrder[currentImage].altnames.includes(name))) {
            currentImage++;
            correct++;

            if (currentImage == haloOrder.length) {
                Finish();
            }
            else {
                LoadNext();
            }
        }
        else if (currentGuesses >= maxGuesses) {
            wrong++;
            Failed(name);
        }

        UpdateDisplay();
    }

    function Failed(name) {

        failedState = true;
        failBonus = true;

        if (inputType == "Freeform") {
            input.value = haloOrder[currentImage].name
            input.classList.add("failed");
        }
        else if (inputType == "MultiChoice") {
            if (name) {
                document.getElementById(name).classList.add("wrong-choice");
            }
            document.getElementById(haloOrder[currentImage].name.toLowerCase()).classList.add("correct-choice");
        }

        currentImage++;
        UpdateDisplay();

        setTimeout(() => {
            input.classList.remove("failed");
            input.value = "";
            failedState = false;
            if (currentImage == haloOrder.length) {
                Finish();
            }
            else {
                LoadNext();
            }
        }, 2000);
    }

    function Finish() {
        endTime = Date.now();
        gameActive = false;

        document.getElementById("guesses-container").style.display = "none";
        document.getElementById("mode-freeform").style.display = "none";
        document.getElementById("mode-multichoice").style.display = "none";
        document.getElementById("timer").style.display = "none";

        document.getElementById("guess-picture").src = "guesser/BA_halo.webp";
        document.getElementById("guess-picture").style.filter = "";

        document.getElementById("final-guesses").style.display = "";
        document.getElementById("total-time").style.display = "";
        document.getElementById("final-score").style.display = "";
        document.getElementById("modifiers-short").style.display = "";
        document.getElementById("return-button").style.display = "";

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
        document.getElementById("final-score").innerText = GetScore(timeElapsed);

        document.getElementById("final-correct-guesses").innerText = correct;
        document.getElementById("final-wrong-guesses").innerText = wrong;

        let modifierShort = "";

        // Build modifier short string
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

        modifierShort += colourMode.substring(0, 1);

        document.getElementById("modifiers-short").innerText = modifierShort;

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

        document.getElementById("final-guesses").style.display = "none";
        document.getElementById("total-time").style.display = "none";
        document.getElementById("final-score").style.display = "none";
        document.getElementById("modifiers-short").style.display = "none";
        document.getElementById("return-button").style.display = "none";

        document.getElementById("settings").style.display = "";
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