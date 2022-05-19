let whitelist = {
    special: [],
    filter_atk: [],
    filter_def: [],
    filter_star: [],
    filter_school: [],
    filter_type: [],
    filter_weapon: [],
    length() {
        return this.special.length + this.filter_atk.length + this.filter_def.length + this.filter_school.length + this.filter_star.length + this.filter_type.length + this.filter_weapon.length;
    },
    getNonEmpty() {
        let toreturn = [];
        if (this.special.length > 0) toreturn.push(this.special);
        if (this.filter_atk.length > 0) toreturn.push(this.filter_atk);
        if (this.filter_def.length > 0) toreturn.push(this.filter_def);
        if (this.filter_star.length > 0) toreturn.push(this.filter_star);
        if (this.filter_school.length > 0) toreturn.push(this.filter_school);
        if (this.filter_type.length > 0) toreturn.push(this.filter_type);
        if (this.filter_weapon.length > 0) toreturn.push(this.filter_weapon);

        return toreturn;
    }
};
let VIEW_MODE = 1;
let style = null;
let isFiltersBuilt = false;
$(document).ready(function () {
    style = $("style#toggleViewStyle");
});

function toggleViewFilters() {
    buildFilterList();
    $("div#viewFilters").toggle();
}

function buildFilterList() {
    if (!charlist) return;
    console.log("Building filters...");
    if (isFiltersBuilt) return;
    
    isFiltersBuilt = true;
    let filters = getAcceptedDynamicFilters();
    console.log(filters);

    let filterGroupElements = [
        buildFilterGroup("", {
            label: "Basic",
            options: ["Selected", "Deselected"]
        }),
    ];
    for(let type in filters) {
        filterGroupElements.push(buildFilterGroup(type+"_", filters[type]));
    }

    $("div#viewFilters").html(filterGroupElements.join("\n"));

    $("input.filter-option").change((e) => {
        assignClassFilters()
        let filter = $(e.currentTarget);
        let target = filter.attr("filter-target");
        const grouping = target.startsWith("filter_") ? target.split('_').splice(0,2).join("_") : "special";
        if (filter[0].checked) {
            console.log("Add Filter");
            if (whitelist[grouping].indexOf(target) < 0) {
                whitelist[grouping].push(target);
            }
        } else {
            console.log("Remove Filter");
            whitelist[grouping] = whitelist[grouping].filter(filtered => filtered != target);
        }
        rebuildViewFilters();
    });
    function buildFilterGroup(prefix, data) {
        const label = data.label;
        let optionElements = [];
        for(const option of data.options) {
            optionElements.push(buildFilterElement(prefix, option));
        }

        return `<div class="filter-view-group"><label class="char-action-label filter-group-header">${label}</label>${optionElements.join("\n")}</div>`;
    }
    function buildFilterElement(prefix, label) {
        // <input class="filter-option" filter-target="test" type="checkbox"> TEST
        // console.log(label);
        let attr = label.toLowerCase().replaceAll(" ", "_");
        let target = `${prefix}${attr}`;

        return `<label class="filter-option-item" for="${target}"><input class="filter-option" id="${target}" filter-target="${target}" type="checkbox"> ${label}</label>`;
    }

    function getAcceptedDynamicFilters() {
        let filterTypes = {
            filter_atk: {
                label: "Attack Type",
                options: []
            },
            filter_def: {
                label: "Defense Type",
                options: []
            },
            filter_star: {
                label: "Base Stars",
                options: []
            },
            filter_school: {
                label: "School",
                options: []
            },
            filter_type: {
                label: "Type",
                options: []
            },
            filter_weapon: {
                label: "Weapon Type",
                options: []
            }
        }

        for(const i in charlist) {
            const char = charlist[i];
            filterTypes.filter_atk.options.push(char.DamageType);
            filterTypes.filter_def.options.push(char.DefenseType);
            filterTypes.filter_school.options.push(char.School);
            filterTypes.filter_type.options.push(char.Type);
            filterTypes.filter_weapon.options.push(char.WeaponType);
            filterTypes.filter_star.options.push(char.BaseStar.toString());
        }
        console.log(filterTypes);
        for(const i in filterTypes) {
            // remove duplicates
            filterTypes[i].options = [...new Set(filterTypes[i].options)];
        }

        return filterTypes;
    }
}

function assignClassFilters() {
    console.log("Assigning Class Filters...");
    for(const char of $("div.main-display-char.charBox:not(.added-filters)")) {
        const id = char.id.substring(5);
        const charInfo = charlist[id];
        let attributes = [
            "added-filters",
            "filter_atk_"+charInfo.DamageType.toLowerCase().replaceAll(" ", "_"),
            "filter_def_"+charInfo.DefenseType.toLowerCase().replaceAll(" ", "_"),
            "filter_star_"+charInfo.BaseStar,
            "filter_school_"+charInfo.School.toLowerCase().replaceAll(" ", "_"),
            "filter_type_"+charInfo.Type.toLowerCase().replaceAll(" ", "_"),
            "filter_weapon_"+charInfo.WeaponType.toLowerCase().replaceAll(" ", "_"),
        ]
        if (charInfo.JpOnly) {
            attributes.push("filter_in_jp");
        }
        $(char).addClass(attributes);
    }
}
const cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));

function rebuildViewFilters() {
    if (whitelist.length() == 0) {
        style.html("");
    } else {
        let styles = [
            "div.charBox.main-display-char { display: none; }",
            // "div.charBox.main-display-char."+whitelist.join(".")+" { display: block; }"
        ];
        const combos = cartesian(...whitelist.getNonEmpty());
        console.log(whitelist, combos);
        for(const combo of combos) {
            if (Array.isArray(combo))
                styles.push("div.charBox.main-display-char."+combo.join(".")+" { display: block; }");
            else
                styles.push("div.charBox.main-display-char."+combo+" { display: block; }");

        }

        style.html(styles.join("\n"));
    }
}

function toggleView() {
    switch (VIEW_MODE) {
        case 1: // default -> hide unselected
            style.html("div.charBox.main-display-char.deselected { display: none; }");
            VIEW_MODE = 2;
            break;
        case 2: // hide unselected -> show unselected, hide selected
            style.html("div.charBox.main-display-char:not(.deselected) { display: none; }");
            VIEW_MODE = 3;
            break;
        case 3: // hide selected -> default
            style.html("");
            VIEW_MODE = 1;
            break;
    }
}
