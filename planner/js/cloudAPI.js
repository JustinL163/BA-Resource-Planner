let testuint;
function saveRequest() {
    LZMA.compress(localStorage.getItem('save-data'), 9, function (result, error) {
        testuint = new Int8Array(result);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'http://127.0.0.1:3000/save');
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(testuint);
    })
}

function loadRequest() {

    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'http://127.0.0.1:3000/load');
    xhr.send();
}