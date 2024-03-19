function saveRequest(notify) {

    if (!gAuthkey || !gUsername) {
        return;
    }

    LZMA.compress(localStorage.getItem('save-data'), 9, function (result, error) {
        let uint = new Uint8Array(result);

        let xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.justin163.com/save');
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.setRequestHeader('Username', gUsername);
        xhr.setRequestHeader('Auth-Key', gAuthkey);
        xhr.onload = function () {
            if (this.status == 200) {

                if (this.response) {
                    let respJSON = JSON.parse(this.response);

                    if (respJSON && respJSON.Result == "Data saved") {

                        if (notify) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Saved',
                                text: "Data saved to cloud",
                                color: alertColour
                            })
                        }
                        else {
                            console.log("Saved to cloud");
                        }
                    }
                }
            }
            else {

                if (this.response) {

                    let respJSON = JSON.parse(this.response);

                    if (respJSON && respJSON.Error) {

                        if (notify) {
                            Swal.fire({
                                icon: 'error',
                                title: 'Oops...',
                                text: respJSON.Error,
                                color: alertColour
                            })
                        }
                        else {
                            console.log(respJSON.Error);
                        }
                    }
                }
            }
        }
        xhr.send(uint);
    })
}

function loadRequest(notify, setCreds) {

    // if (!gAuthkey || !gUsername) {
    //     return;
    // }

    let lUsername = document.getElementById('input-transfer-username').value;
    let lAuthkey = document.getElementById('input-transfer-authkey').value;

    if (lUsername && lAuthkey && lUsername.length >= 5 && lUsername.length <= 20 && lAuthkey.length == 6) {
    }
    else {
        return;
    }


    let xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.justin163.com/load');
    xhr.setRequestHeader('Username', document.getElementById('input-transfer-username').value);
    xhr.setRequestHeader('Auth-Key', document.getElementById('input-transfer-authkey').value);
    xhr.overrideMimeType('text\/plain; charset=x-user-defined');
    xhr.onload = function () {
        if (this.status == 200) {

            let buffer = new ArrayBuffer(this.response.length);
            let uintResponse = new Uint8Array(buffer);

            for (i = uintResponse.length; i--;) {
                uintResponse[i] = this.response[i].charCodeAt(0);
            }

            LZMA.decompress(uintResponse, function (result, error) {
                if (tryParseJSON(result)) {
                    localStorage.setItem('save-data', result);

                    if (setCreds) {
                        localStorage.setItem('username', lUsername);
                        localStorage.setItem('authkey', lAuthkey);
                    }

                    location.reload();
                }
            })
        }
        else {

            if (this.response) {

                let respJSON = JSON.parse(this.response);

                if (respJSON && respJSON.Error) {

                    if (notify) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Oops...',
                            text: respJSON.Error,
                            color: alertColour
                        })
                    }
                    else {
                        console.log(respJSON.Error);
                    }
                }
            }
        }
    }
    xhr.send();
}

function registerRequest(username) {

    if (gAuthkey || gUsername) {
        return;
    }

    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.justin163.com/register');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {

        if (this.status == 200) {

            if (this.response) {
                let respJSON = JSON.parse(this.response);

                if (respJSON && respJSON.Auth_Key) {
                    gUsername = username;
                    gAuthkey = respJSON.Auth_Key;
                    localStorage.setItem('username', gUsername);
                    localStorage.setItem('authkey', gAuthkey);

                    document.getElementById('input-transfer-username').value = gUsername;
                    document.getElementById('input-transfer-authkey').value = gAuthkey;

                    saveRequest(false);
                    saveCooldown = Date.now() + (2 * 60 * 1000 + 10000);
                    updateLoginButtons();

                    Swal.fire({
                        icon: 'success',
                        title: 'Registered',
                        text: "Registered account, Auth Key generated: " + gAuthkey,
                        color: alertColour
                    })
                }
            }
        }
        else {

            if (this.response) {
                let respJSON = JSON.parse(this.response);

                if (respJSON && respJSON.Error) {

                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: respJSON.Error,
                        color: alertColour
                    })

                    document.getElementById('transfer-register-button').style.visibility = "";
                }
            }
        }
    }
    xhr.send(JSON.stringify({
        "Username": username
    }))
}

function UploadSubmission(submissionObject, server, type, uid, difficulty) {

    if (!gAuthkey || !gUsername) {
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: "Please register or log into a cloud save account, go to the main planner page to do so for now (this page is still in progress)",
            color: alertColour
        })
        return;
    }

    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.justin163.com/submitraid');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Username', gUsername);
    xhr.setRequestHeader('Auth-Key', gAuthkey);
    xhr.onload = function () {

        if (this.status == 200) {

            if (this.response) {
                let respJSON = JSON.parse(this.response);

                if (respJSON && respJSON.UUID) {

                    Swal.fire({
                        icon: 'success',
                        title: 'Submitted',
                        text: "Successfully submitted: " + respJSON.UUID,
                        color: alertColour
                    })

                    LocalSubmission(submissionObject, difficulty, respJSON.UUID);
                }
            }
        }
        else {

            if (this.response) {
                let respJSON = JSON.parse(this.response);

                if (respJSON && respJSON.Error) {

                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: respJSON.Error,
                        color: alertColour
                    })
                }
            }
        }
    }
    xhr.send(JSON.stringify({
        "Server": server,
        "Type": type,
        "Raid_Index": uid,
        "Difficulty": difficulty,
        "Score": submissionObject.score,
        "Level": submissionObject.level,
        "Video_Link": submissionObject.link,
        "Teams": submissionObject.teams
    }))
}

function EditSubmission(submissionObject, server, type, uid, difficulty, uuid) {

    if (!gAuthkey || !gUsername) {
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: "Please register or log into a cloud save account, go to the main planner page to do so for now (this page is still in progress)",
            color: alertColour
        })
        return;
    }

    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.justin163.com/editraid');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Username', gUsername);
    xhr.setRequestHeader('Auth-Key', gAuthkey);
    xhr.onload = function () {

        if (this.status == 200) {

            if (this.response) {
                let respJSON = JSON.parse(this.response);

                if (respJSON && respJSON.UUID) {

                    Swal.fire({
                        icon: 'success',
                        title: 'Submitted',
                        text: "Successfully edited: " + respJSON.UUID,
                        color: alertColour
                    })

                    LocalSubmission(submissionObject, difficulty, respJSON.UUID);
                }
            }
        }
        else {

            if (this.response) {
                let respJSON = JSON.parse(this.response);

                if (respJSON && respJSON.Error) {

                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: respJSON.Error,
                        color: alertColour
                    })
                }
            }
        }
    }
    xhr.send(JSON.stringify({
        "Server": server,
        "Type": type,
        "Raid_Index": uid,
        "Difficulty": difficulty,
        "Score": submissionObject.score,
        "Level": submissionObject.level,
        "Video_Link": submissionObject.link,
        "Teams": submissionObject.teams,
        "UUID": uuid
    }))
}

function UpdateTournamentRecord(submissionObject, password) {

    if (!password) {
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: "Please set the tournament password",
            color: alertColour
        })
        return;
    }

    let xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.justin163.com/settourneydata');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('TournamentPassword', password);
    xhr.onload = function () {

        if (this.status == 200) {

            if (this.response) {
                let respJSON = JSON.parse(this.response);

                if (respJSON) {

                    Swal.fire({
                        icon: 'success',
                        title: 'Submitted',
                        text: "Successfully updated",
                        color: alertColour
                    })

                    LocalTourneyUpdate(submissionObject);
                }
            }
        }
        else {

            if (this.response) {
                let respJSON = JSON.parse(this.response);

                if (respJSON && respJSON.Error) {

                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: respJSON.Error,
                        color: alertColour
                    })
                }
            }
        }
    }
    xhr.send(JSON.stringify(submissionObject))
}

function GetTournamentData(password, notify) {

    let xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.justin163.com/loadtourneydata');
    xhr.setRequestHeader('TournamentPassword', password);
    // xhr.overrideMimeType('text\/plain; charset=x-user-defined');
    xhr.onload = function () {
        if (this.status == 200) {

            ProcessLoadedData(JSON.parse(this.response));
            lastLoad = Date.now();

            if (notify) {
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: "Successfully updated",
                    color: alertColour
                })
            }
        }
        else {

            if (this.response) {

                let respJSON = JSON.parse(this.response);

                if (respJSON && respJSON.Error) {

                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: respJSON.Error,
                        color: alertColour
                    })
                }
            }
        }
    }
    xhr.send();
}