let event_data;

function loadResources() {

    $.getJSON('json/events.json?1').done(function (json) {
        event_data = json;
        checkResources();
    });
}

function checkResources() {

    if (event_data) {

        init();
    }
}

function init() {

    let events_list = document.getElementById("events-list");

    for (let i = 0; i < event_data.event_order.length; i++) {
        let eventDiv = document.createElement("div");
        let eventImg = document.createElement("img");

        eventImg.src = event_data.events[event_data.event_order[i]].icon;
        eventImg.className = "event-icon";

        eventDiv.appendChild(eventImg);
        eventDiv.id = event_data.event_order[i];
        eventDiv.style.cursor = "pointer";

        eventDiv.addEventListener('click', (event) => {
            LoadEvent(event.currentTarget.id);
        })

        events_list.appendChild(eventDiv);
    }
}

function LoadEvent(eventId) {

    console.log(eventId);
}