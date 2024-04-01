let whitelist = {
    special: [],
    filter_type: [],
    filter_atk: [],
    filter_def: [],
    filter_star: [],
    filter_school: [],
    filter_weapon: [],
    filter_material: [],
    length() {
        return this.special.length + this.filter_atk.length + this.filter_def.length + this.filter_school.length + this.filter_star.length + this.filter_type.length + this.filter_weapon.length + this.filter_material.length;
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
        if (this.filter_material.length > 0) toreturn.push(this.filter_material);

        return toreturn;
    }
};

let style = null;
let isFiltersBuilt = false;
$(document).ready(function () {
    style = $("style#toggleViewStyle");
});

let toggleCount = 0;
function toggleViewFilters() {

    // APRIL FOOLS
    // if (document.getElementById("button-filters").classList.contains("april-fools-button")) {
    //     return;
    // }

    buildFilterList();
    $("div#viewFilters").toggle();
    if(toggleCount % 2 == 0)
    {
        $('div#viewFilters').css("minWidth", $('div#viewFilters').width());
        $("label.filter-group-header").each((a, b) => {
            if (b.classList.contains('toggle-closed')) {
                b.nextElementSibling.style.display = "none";
            }
        });
        toggleCount++;
    }
    else {
        $('div#viewFilters').css("minWidth","0px");
        $('.filter-option-container').css('display', '');
        toggleCount++;
    }
    if (window.matchMedia("(max-width: 800px)").matches) {
        $("#charsContainerActions").toggle()
    }
    else {
        $("#charsContainerActions").show()
    }
}

function buildFilterList() {
    if (!charlist) return;
    if (isFiltersBuilt) return;
    
    isFiltersBuilt = true;
    let filters = getAcceptedDynamicFilters();

    let filterGroupElements = [
        '<button id="button-filters-close" onclick="toggleViewFilters()">Close</button>',
        buildFilterGroup("", {
            label: GetLanguageString("label-basic"),
            options: [GetLanguageString("label-selected"), GetLanguageString("label-deselected")]
        }),
    ];
    for(let type in filters) {
        filterGroupElements.push(buildFilterGroup(type+"_", filters[type]));
    }

    $("div#viewFilters").html(filterGroupElements.join("\n"));

    $("label.filter-group-header").each((a, b) => {
        $(b).click(() => {
            $(b.nextElementSibling).toggle(0, () => {
                if(b.nextElementSibling.style.display === "none")
                {
                    b.className = "char-action-label filter-group-header toggle-closed";
                }
                else
                {
                    b.className = "char-action-label filter-group-header toggle-open";
                }
            })
        });
    });

    $("input.filter-option").change((e) => {
        assignClassFilters()
        let filter = $(e.currentTarget);
        let target = filter.attr("filter-target");
        const grouping = target.startsWith("filter_") ? target.split('_').splice(0,2).join("_") : "special";
        if (filter[0].checked) {
            filter.closest("label.filter-option-item").attr("ischecked", "true");
            if (whitelist[grouping].indexOf(target) < 0) {
                whitelist[grouping].push(target);
            }
        } else {
            filter.closest("label.filter-option-item").attr("ischecked", "false");
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

        return `<div class="filter-view-group"><label class="char-action-label filter-group-header toggle-closed">${label}</label><div class="filter-option-container">${optionElements.join("\n")}</div></div>`;
    }
    function buildFilterElement(prefix, label) {
        // <input class="filter-option" filter-target="test" type="checkbox"> TEST;
        let attr = label.toLowerCase().replaceAll(" ", "_");
        let target = `${prefix}${attr}`;

        let langPrefix = langPrefixFromFilter(prefix);
        if (langPrefix) {
            label = GetLanguageString(langPrefix + label.toLowerCase());
        }


        return `<label class="filter-option-item" checked="false" for="${target}"><input class="filter-option" id="${target}" filter-target="${target}" type="checkbox"> ${label}</label>`;
    }

    function getAcceptedDynamicFilters() {
        let filterTypes = {
            filter_atk: {
                label: GetLanguageString("label-attacktype"),
                options: []
            },
            filter_def: {
                label: GetLanguageString("label-defensetype"),
                options: []
            },
            filter_star: {
                label: GetLanguageString("label-basestars"),
                options: []
            },
            filter_school: {
                label: GetLanguageString("label-school"),
                options: []
            },
            filter_type: {
                label: GetLanguageString("label-type"),
                options: []
            },
            filter_weapon: {
                label: GetLanguageString('label-weapontype'),
                options: []
            },
            filter_material: {
                label: GetLanguageString('label-artifact'),
                options: []
            },
        }

        for(const i in charlist) {
            const char = charlist[i];
            filterTypes.filter_atk.options.push(char.BulletType);
            filterTypes.filter_def.options.push(char.ArmorType);
            filterTypes.filter_school.options.push(char.School);
            filterTypes.filter_type.options.push(GetOldTypeFromSquadType(char.SquadType));
            filterTypes.filter_weapon.options.push(char.WeaponType);
            filterTypes.filter_star.options.push(char.StarGrade.toString());
            let mat1id = char.SkillExMaterial[3][2];
            let mat2id = char.SkillExMaterial[3][3];
            if(mat1id < 1000)
            {
                let mat = matLookup.get(mat1id);
                filterTypes.filter_material.options.push(mat.substr(0, mat.length - 2));
            }
            if(mat2id < 1000)
            {
                let mat = matLookup.get(mat2id);
                filterTypes.filter_material.options.push(mat.substr(0, mat.length - 2));
            }
        }
        for(const i in filterTypes) {
            // remove duplicates
            filterTypes[i].options = [...new Set(filterTypes[i].options)];
        }
        
        filterTypes.filter_material.options.sort();
        
        return filterTypes;
    }
}

function langPrefixFromFilter(prefix) {

    whitelist.filter_type = [];
    whitelist.filter_atk = [];
    whitelist.filter_def = [];
    whitelist.filter_star = [];
    whitelist.filter_school = [];
    whitelist.filter_weapon = [];
    whitelist.filter_material = [];
    
    if (prefix == "filter_type_") {
        return "type-"
    }
    else if (prefix == "filter_atk_") {
        return "atktype-"
    }
    else if (prefix == "filter_def_") {
        return "deftype-"
    }
    else if (prefix == "filter_star_") {

    }
    else if (prefix == "filter_school_") {
        return "school-"
    }
    else if (prefix == "filter_weapon_") {
        return "gun-"
    }
    else if (prefix == "filter_material_") {
        return "artifact-"
    }
    

    return ""
}

function assignClassFilters() {
    for(const char of $("div.main-display-char.charBox:not(.added-filters)")) {
        const id = char.id.substring(5);
        const charInfo = charlist[id];
        let attributes = [
            "added-filters",
            "filter_atk_"+charInfo.BulletType.toLowerCase().replaceAll(" ", "_"),
            "filter_def_"+charInfo.ArmorType.toLowerCase().replaceAll(" ", "_"),
            "filter_star_"+charInfo.StarGrade,
            "filter_school_"+charInfo.School.toLowerCase().replaceAll(" ", "_"),
            "filter_type_"+GetOldTypeFromSquadType(charInfo.SquadType).toLowerCase().replaceAll(" ", "_"),
            "filter_weapon_"+charInfo.WeaponType.toLowerCase().replaceAll(" ", "_"),
        ]
        if (charInfo.JpOnly) {
            attributes.push("filter_in_jp");
        }
        let mat1id = charInfo.SkillExMaterial[3][2];
        let mat2id = charInfo.SkillExMaterial[3][3];
        if(mat1id < 1000)
        {
            let mat = matLookup.get(mat1id);
            attributes.push("filter_material_" + mat.substr(0, mat.length - 2).toLowerCase());
        }
        if(mat2id < 1000)
        {
            let mat = matLookup.get(mat2id);
            attributes.push("filter_material_" + mat.substr(0, mat.length - 2).toLowerCase());
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
        for(const combo of combos) {
            if (Array.isArray(combo))
                styles.push("div.charBox.main-display-char."+combo.join(".")+" { display: block; }");
            else
                styles.push("div.charBox.main-display-char."+combo+" { display: block; }");

        }

        style.html(styles.join("\n"));
    }
}

function resetViewFilters() {

    let filterLabels = document.getElementsByClassName("filter-option-item");
    let filterCheckboxes = document.getElementsByClassName("filter-option");

    for (let i = 0; i < filterLabels.length; i++) {

        if (filterLabels[i].getAttribute('ischecked')) {
            filterLabels[i].setAttribute('ischecked','false');
        }
    }

    for (let i = 0; i < filterCheckboxes.length; i++) {

        if (filterCheckboxes[i].checked) {
            filterCheckboxes[i].checked = false;
        }
    }

    whitelist.special = [];
    whitelist.filter_type = [];
    whitelist.filter_atk = [];
    whitelist.filter_def = [];
    whitelist.filter_star = [];
    whitelist.filter_school = [];
    whitelist.filter_weapon = [];
    whitelist.filter_material = [];

    rebuildViewFilters();
}