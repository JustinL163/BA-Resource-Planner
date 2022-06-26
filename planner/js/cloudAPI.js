function saveRequest() {
    LZMA.compress(localStorage.getItem('save-data'), 9, function (result, error) {
        let uint = new Uint8Array(result);

        // var xhr = new XMLHttpRequest();
        // xhr.open('POST', 'http://127.0.0.1:3000/save');
        // xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        // xhr.setRequestHeader('Username', "");
        // xhr.setRequestHeader('Auth_Key', "");
        // xhr.send(uint);
    })
}

function loadRequest() {

    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'http://127.0.0.1:3000/load');
    xhr.send();
}

ToBase64 = function (u8) {
    return btoa(String.fromCharCode.apply(null, u8));
}

FromBase64 = function (str) {
    return atob(str).split('').map(function (c) { return c.charCodeAt(0); });
}