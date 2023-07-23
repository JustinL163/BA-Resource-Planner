let language_strings;

function initDebug() {

    const params = new Proxy(new URLSearchParams(window.location.search), {
        get: (searchParams, prop) => searchParams.get(prop)
    });

    if (params.untranslated) {
        $.getJSON('json/strings.json?23').done(function (json) {
            language_strings = json;
            GetTranslationStrings(params.untranslated, false);
        });
    }

    if (params.translated) {
        $.getJSON('json/strings.json?23').done(function (json) {
            language_strings = json;
            GetTranslationStrings(params.translated, true);
        });
    }
}

function GetTranslationStrings(language, translated) {

    if (language.toLowerCase() == "en") {
        return;
    }

    let stringKeys = Object.keys(language_strings);

    let translationStrings = {};

    for (let i = 0; i < stringKeys.length; i++) {

        if (translated && !(language_strings[stringKeys[i]][language] === undefined)) {
            translationStrings[stringKeys[i]] = {};
            translationStrings[stringKeys[i]].EN = language_strings[stringKeys[i]].EN;
            translationStrings[stringKeys[i]][language] = language_strings[stringKeys[i]][language]; 
        } 
        else if (!translated && language_strings[stringKeys[i]][language] === undefined) {
            translationStrings[stringKeys[i]] = {};
            translationStrings[stringKeys[i]].EN = language_strings[stringKeys[i]].EN;
            translationStrings[stringKeys[i]][language] = ""; 
        }
    }

    document.getElementById("text-body").innerText = JSON.stringify(translationStrings, null, 4);
}