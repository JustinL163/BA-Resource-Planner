class TwoWayMap {
    constructor(map) {
        this.map = map;
        this.reverseMap = {};
        for (const key in map) {
            const value = map[key];
            this.reverseMap[value] = key;
        }
    }
    get(key) { return this.map[key]; }
    revGet(key) { return this.reverseMap[key]; }
}

const matLookup = new TwoWayMap({
    100: "Nebra_1",
    101: "Nebra_2",
    102: "Nebra_3",
    103: "Nebra_4",
    110: "Phaistos_1",
    111: "Phaistos_1",
    112: "Phaistos_1",
    113: "Phaistos_1",
    120: "Wolfsegg_1",
    121: "Wolfsegg_2",
    122: "Wolfsegg_3",
    123: "Wolfsegg_4",
    130: "Nimrud_1",
    131: "Nimrud_2",
    132: "Nimrud_3",
    133: "Nimrud_4",
    140: "Mandragora_1",
    141: "Mandragora_2",
    142: "Mandragora_3",
    143: "Mandragora_4",
    150: "Rohonc_1",
    151: "Rohonc_2",
    152: "Rohonc_3",
    153: "Rohonc_4",
    160: "Aether_1",
    161: "Aether_2",
    162: "Aether_3",
    163: "Aether_4",
    170: "Antikythera_1",
    171: "Antikythera_2",
    172: "Antikythera_3",
    173: "Antikythera_4",
    180: "Voynich_1",
    181: "Voynich_2",
    182: "Voynich_3",
    183: "Voynich_4",
    190: "Haniwa_1",
    191: "Haniwa_2",
    192: "Haniwa_3",
    193: "Haniwa_4",
    200: "Totem_1",
    201: "Totem_2",
    202: "Totem_3",
    203: "Totem_4",
    210: "Baghdad_1",
    211: "Baghdad_2",
    212: "Baghdad_3",
    213: "Baghdad_4",

    3000: "BD_1_Hyakkiyako",
    3001: "BD_2_Hyakkiyako",
    3002: "BD_3_Hyakkiyako",
    3003: "BD_4_Hyakkiyako",
    3010: "BD_1_RedWinter",
    3011: "BD_2_RedWinter",
    3012: "BD_3_RedWinter",
    3013: "BD_4_RedWinter",
    3020: "BD_1_Trinity",
    3021: "BD_2_Trinity",
    3022: "BD_3_Trinity",
    3023: "BD_4_Trinity",
    3030: "BD_1_Gehenna",
    3031: "BD_2_Gehenna",
    3032: "BD_3_Gehenna",
    3033: "BD_4_Gehenna",
    3040: "BD_1_Abydos",
    3041: "BD_2_Abydos",
    3042: "BD_3_Abydos",
    3043: "BD_4_Abydos",
    3050: "BD_1_Millennium",
    3051: "BD_2_Millennium",
    3052: "BD_3_Millennium",
    3053: "BD_4_Millennium",
    3060: "BD_1_Arius",
    3061: "BD_2_Arius",
    3062: "BD_3_Arius",
    3063: "BD_4_Arius",
    3070: "BD_1_Shanhaijing",
    3071: "BD_2_Shanhaijing",
    3072: "BD_3_Shanhaijing",
    3073: "BD_4_Shanhaijing",
    3080: "BD_1_Valkyrie",
    3081: "BD_2_Valkyrie",
    3082: "BD_3_Valkyrie",
    3083: "BD_4_Valkyrie",

    4000: "TN_1_Hyakkiyako",
    4001: "TN_2_Hyakkiyako",
    4002: "TN_3_Hyakkiyako",
    4003: "TN_4_Hyakkiyako",
    4010: "TN_1_RedWinter",
    4011: "TN_2_RedWinter",
    4012: "TN_3_RedWinter",
    4013: "TN_4_RedWinter",
    4020: "TN_1_Trinity",
    4021: "TN_2_Trinity",
    4022: "TN_3_Trinity",
    4023: "TN_4_Trinity",
    4030: "TN_1_Gehenna",
    4031: "TN_2_Gehenna",
    4032: "TN_3_Gehenna",
    4033: "TN_4_Gehenna",
    4040: "TN_1_Abydos",
    4041: "TN_2_Abydos",
    4042: "TN_3_Abydos",
    4043: "TN_4_Abydos",
    4050: "TN_1_Millennium",
    4051: "TN_2_Millennium",
    4052: "TN_3_Millennium",
    4053: "TN_4_Millennium",
    4060: "BD_1_Arius",
    4061: "BD_2_Arius",
    4062: "BD_3_Arius",
    4063: "BD_4_Arius",
    4070: "TN_1_Shanhaijing",
    4071: "TN_2_Shanhaijing",
    4072: "TN_3_Shanhaijing",
    4073: "TN_4_Shanhaijing",
    4080: "TN_1_Valkyrie",
    4081: "TN_2_Valkyrie",
    4082: "TN_3_Valkyrie",
    4083: "TN_4_Valkyrie",

    9999: "Secret"
});

var rowColours = {
    "Abydos": "#9ce4fc66", "Gehenna": "#ec7d7966", "Millennium": "#9ebdfa66", "Trinity": "#fcd19c66", "Hyakkiyako": "#f0a8c466",
    "Shanhaijing": "#b4feca66", "Red Winter": "#d98c9e66", "Valkyrie": "#a1a9e166", "Nebra": "#99919466", "Phaistos": "#fdf7e766", "Wolfsegg": "#93a5f266",
    "Nimrud": "#67e4ef66", "Mandragora": "#a1ede566", "Rohonc": "#c9ab9366", "Aether": "#ca96e066", "Antikythera": "#f7e28866",
    "Voynich": "#84b28066", "Haniwa": "#e7bef466", "Baghdad": "#d179a066", "Totem": "#b77e6166", "Fleece": "#faf69f66", "Kikuko": "#ef957f66"
};

// perhaps need to move this to JSON file later lmao, is probably getting a bit big
// also perhaps later add functionality to set validation for a whole class of inputs rather than just invidually
var inputValidation = {
    "level": {
        id: "input_level_current",
        location: "characterModal",
        min: "1",
        max: "78",
        default: "1",
        name: "Level"
    },
    "level_target": {
        id: "input_level_target",
        location: "characterModal",
        min: "1",
        max: "78",
        default: "1",
        name: "Level Target",
        requisite: {
            "level": {
                type: "input",
                compare: "equal_greater",
                mode: "direct",
                sanitise: false
            }
        }
    },
    "ue_level": {
        id: "input_ue_level_current",
        location: "characterModal",
        min: "0",
        max: "50",
        default: "0",
        name: "UE Level",
        requisite: {
            "modalStars.ue": {
                type: "object",
                name: "Target UE Stars",
                compare: "equal_greater",
                mode: "threshold",
                sanitise: true,
                levels: [
                    {
                        required: "3",
                        max: "50"
                    },
                    {
                        required: "2",
                        max: "40"
                    },
                    {
                        required: "1",
                        max: "30"
                    },
                    {
                        max: "0"
                    }
                ]
            }
        }
    },
    "ue_level_target": {
        id: "input_ue_level_target",
        location: "characterModal",
        min: "0",
        max: "50",
        default: "0",
        name: "UE Level Target",
        requisite: {
            "modalStars.ue_target": {
                type: "object",
                name: "Target UE Stars",
                compare: "equal_greater",
                mode: "threshold",
                sanitise: true,
                levels: [
                    {
                        required: "3",
                        max: "50"
                    },
                    {
                        required: "2",
                        max: "40"
                    },
                    {
                        required: "1",
                        max: "30"
                    },
                    {
                        max: "0"
                    }
                ]
            },
            "ue_level": {
                type: "input",
                compare: "equal_greater",
                mode: "direct",
                sanitise: false
            }
        }
    },
    "bond": {
        id: "input_bond_current",
        location: "characterModal",
        min: "1",
        max: "100",
        default: "1",
        name: "Bond",
        requisite: {
            "modalStars.star_target": {
                type: "object",
                name: "Target Stars",
                compare: "equal_greater",
                mode: "threshold",
                sanitise: true,
                levels: [
                    {
                        required: "5",
                        max: "100"
                    },
                    {
                        required: "3",
                        max: "20"
                    },
                    {
                        max: "10"
                    }
                ]
            }
        }
    },
    "bond_target": {
        id: "input_bond_target",
        location: "characterModal",
        min: "1",
        max: "100",
        default: "1",
        name: "Bond Target",
        requisite: {
            "modalStars.star_target": {
                type: "object",
                name: "Target Stars",
                compare: "equal_greater",
                mode: "threshold",
                sanitise: true,
                levels: [
                    {
                        required: "5",
                        max: "100"
                    },
                    {
                        required: "3",
                        max: "20"
                    },
                    {
                        max: "10"
                    }
                ]
            },
            "bond": {
                type: "input",
                compare: "equal_greater",
                mode: "direct",
                sanitise: false
            }
        }
    },
    "ex": {
        id: "input_ex_current",
        location: "characterModal",
        min: "1",
        max: "5",
        default: "1",
        name: "EX"
    },
    "ex_target": {
        id: "input_ex_target",
        location: "characterModal",
        min: "1",
        max: "5",
        default: "1",
        name: "EX Target",
        requisite: {
            "ex": {
                type: "input",
                compare: "equal_greater",
                mode: "direct",
                sanitise: false
            }
        }
    },
    "basic": {
        id: "input_basic_current",
        location: "characterModal",
        min: "1",
        max: "10",
        default: "1",
        name: "Basic"
    },
    "basic_target": {
        id: "input_basic_target",
        location: "characterModal",
        min: "1",
        max: "10",
        default: "1",
        name: "Basic Target",
        requisite: {
            "basic": {
                type: "input",
                compare: "equal_greater",
                mode: "direct",
                sanitise: false
            }
        }
    },
    "passive": {
        id: "input_enhanced_current",
        location: "characterModal",
        min: "0",
        max: "10",
        default: "0",
        name: "Enhanced",
        requisite: {
            "modalStars.star_target": {
                type: "object",
                name: "Target Stars",
                compare: "equal_greater",
                mode: "threshold",
                sanitise: true,
                levels: [
                    {
                        required: "2",
                        max: "10"
                    },
                    {
                        max: "0"
                    }
                ]
            }
        }
    },
    "passive_target": {
        id: "input_enhanced_target",
        location: "characterModal",
        min: "0",
        max: "10",
        default: "0",
        name: "Enhanced Target",
        requisite: {
            "modalStars.star_target": {
                type: "object",
                name: "Target Stars",
                compare: "equal_greater",
                mode: "threshold",
                sanitise: true,
                levels: [
                    {
                        required: "2",
                        max: "10"
                    },
                    {
                        max: "0"
                    }
                ]
            },
            "passive": {
                type: "input",
                compare: "equal_greater",
                mode: "direct",
                sanitise: false
            }
        }
    },
    "sub": {
        id: "input_sub_current",
        location: "characterModal",
        min: "0",
        max: "10",
        default: "0",
        name: "Sub",
        requisite: {
            "modalStars.star_target": {
                type: "object",
                name: "Target Stars",
                compare: "equal_greater",
                mode: "threshold",
                sanitise: true,
                levels: [
                    {
                        required: "3",
                        max: "10"
                    },
                    {
                        max: "0"
                    }
                ]
            }
        }
    },
    "sub_target": {
        id: "input_sub_target",
        location: "characterModal",
        min: "0",
        max: "10",
        default: "0",
        name: "Sub Target",
        requisite: {
            "modalStars.star_target": {
                type: "object",
                name: "Target Stars",
                compare: "equal_greater",
                mode: "threshold",
                sanitise: true,
                levels: [
                    {
                        required: "3",
                        max: "10"
                    },
                    {
                        max: "0"
                    }
                ]
            },
            "sub": {
                type: "input",
                compare: "equal_greater",
                mode: "direct",
                sanitise: false
            }
        }
    },
    "gear1": {
        id: "input_gear1_current",
        location: "characterModal",
        min: "0",
        max: "6",
        default: "0",
        name: "Gear 1"
    },
    "gear1_target": {
        id: "input_gear1_target",
        location: "characterModal",
        min: "0",
        max: "6",
        default: "0",
        name: "Gear 1 Target",
        requisite: {
            "gear1": {
                type: "input",
                compare: "equal_greater",
                mode: "direct",
                sanitise: false
            }
        }
    },
    "gear2": {
        id: "input_gear2_current",
        location: "characterModal",
        min: "0",
        max: "6",
        default: "0",
        name: "Gear 2",
        requisite: {
            "level_target": {
                type: "input",
                name: "Level Target",
                compare: "equal_greater",
                mode: "threshold",
                sanitise: true,
                levels: [
                    {
                        required: "15",
                        max: "6"
                    },
                    {
                        max: "0"
                    }
                ]
            }
        }
    },
    "gear2_target": {
        id: "input_gear2_target",
        location: "characterModal",
        min: "0",
        max: "6",
        default: "0",
        name: "Gear 2 Target",
        requisite: {
            "level_target": {
                type: "input",
                name: "Level Target",
                compare: "equal_greater",
                mode: "threshold",
                sanitise: true,
                levels: [
                    {
                        required: "15",
                        max: "6"
                    },
                    {
                        max: "0"
                    }
                ]
            },
            "gear2": {
                type: "input",
                compare: "equal_greater",
                mode: "direct",
                sanitise: false
            }
        }
    },
    "gear3": {
        id: "input_gear3_current",
        location: "characterModal",
        min: "0",
        max: "6",
        default: "0",
        name: "Gear 3",
        requisite: {
            "level_target": {
                type: "input",
                name: "Level Target",
                compare: "equal_greater",
                mode: "threshold",
                sanitise: true,
                levels: [
                    {
                        required: "35",
                        max: "6"
                    },
                    {
                        max: "0"
                    }
                ]
            }
        }
    },
    "gear3_target": {
        id: "input_gear3_target",
        location: "characterModal",
        min: "0",
        max: "6",
        default: "0",
        name: "Gear 3 Target",
        requisite: {
            "level_target": {
                type: "input",
                name: "Level Target",
                compare: "equal_greater",
                mode: "threshold",
                sanitise: true,
                levels: [
                    {
                        required: "35",
                        max: "6"
                    },
                    {
                        max: "0"
                    }
                ]
            },
            "gear3": {
                type: "input",
                compare: "equal_greater",
                mode: "direct",
                sanitise: false
            }
        }
    },
    "BD_1_Abydos": {
        "id": "input-BD_1_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_1_Gehenna": {
        "id": "input-BD_1_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_1_Millennium": {
        "id": "input-BD_1_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_1_Trinity": {
        "id": "input-BD_1_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_1_Hyakkiyako": {
        "id": "input-BD_1_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_1_Shanhaijing": {
        "id": "input-BD_1_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_1_RedWinter": {
        "id": "input-BD_1_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_1_Valkyrie": {
        "id": "input-BD_1_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_2_Abydos": {
        "id": "input-BD_2_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_2_Gehenna": {
        "id": "input-BD_2_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_2_Millennium": {
        "id": "input-BD_2_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_2_Trinity": {
        "id": "input-BD_2_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_2_Hyakkiyako": {
        "id": "input-BD_2_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_2_Shanhaijing": {
        "id": "input-BD_2_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_2_RedWinter": {
        "id": "input-BD_2_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_2_Valkyrie": {
        "id": "input-BD_2_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_3_Abydos": {
        "id": "input-BD_3_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_3_Gehenna": {
        "id": "input-BD_3_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_3_Millennium": {
        "id": "input-BD_3_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_3_Trinity": {
        "id": "input-BD_3_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_3_Hyakkiyako": {
        "id": "input-BD_3_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_3_Shanhaijing": {
        "id": "input-BD_3_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_3_RedWinter": {
        "id": "input-BD_3_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_3_Valkyrie": {
        "id": "input-BD_3_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_4_Abydos": {
        "id": "input-BD_4_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_4_Gehenna": {
        "id": "input-BD_4_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_4_Millennium": {
        "id": "input-BD_4_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_4_Trinity": {
        "id": "input-BD_4_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_4_Hyakkiyako": {
        "id": "input-BD_4_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_4_Shanhaijing": {
        "id": "input-BD_4_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_4_RedWinter": {
        "id": "input-BD_4_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "BD_4_Valkyrie": {
        "id": "input-BD_4_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_1_Abydos": {
        "id": "input-TN_1_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_1_Gehenna": {
        "id": "input-TN_1_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_1_Millennium": {
        "id": "input-TN_1_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_1_Trinity": {
        "id": "input-TN_1_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_1_Hyakkiyako": {
        "id": "input-TN_1_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_1_Shanhaijing": {
        "id": "input-TN_1_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_1_RedWinter": {
        "id": "input-TN_1_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_1_Valkyrie": {
        "id": "input-TN_1_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_2_Abydos": {
        "id": "input-TN_2_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_2_Gehenna": {
        "id": "input-TN_2_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_2_Millennium": {
        "id": "input-TN_2_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_2_Trinity": {
        "id": "input-TN_2_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_2_Hyakkiyako": {
        "id": "input-TN_2_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_2_Shanhaijing": {
        "id": "input-TN_2_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_2_RedWinter": {
        "id": "input-TN_2_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_2_Valkyrie": {
        "id": "input-TN_2_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_3_Abydos": {
        "id": "input-TN_3_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_3_Gehenna": {
        "id": "input-TN_3_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_3_Millennium": {
        "id": "input-TN_3_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_3_Trinity": {
        "id": "input-TN_3_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_3_Hyakkiyako": {
        "id": "input-TN_3_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_3_Shanhaijing": {
        "id": "input-TN_3_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_3_RedWinter": {
        "id": "input-TN_3_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_3_Valkyrie": {
        "id": "input-TN_3_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_4_Abydos": {
        "id": "input-TN_4_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_4_Gehenna": {
        "id": "input-TN_4_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_4_Millennium": {
        "id": "input-TN_4_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_4_Trinity": {
        "id": "input-TN_4_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_4_Hyakkiyako": {
        "id": "input-TN_4_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_4_Shanhaijing": {
        "id": "input-TN_4_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_4_RedWinter": {
        "id": "input-TN_4_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "TN_4_Valkyrie": {
        "id": "input-TN_4_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "Nebra_1": {
        "id": "input-Nebra_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Nebra_2": {
        "id": "input-Nebra_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Nebra_3": {
        "id": "input-Nebra_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Nebra_4": {
        "id": "input-Nebra_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Phaistos_1": {
        "id": "input-Phaistos_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Phaistos_2": {
        "id": "input-Phaistos_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Phaistos_3": {
        "id": "input-Phaistos_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Phaistos_4": {
        "id": "input-Phaistos_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Wolfsegg_1": {
        "id": "input-Wolfsegg_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Wolfsegg_2": {
        "id": "input-Wolfsegg_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Wolfsegg_3": {
        "id": "input-Wolfsegg_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Wolfsegg_4": {
        "id": "input-Wolfsegg_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Nimrud_1": {
        "id": "input-Nimrud_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Nimrud_2": {
        "id": "input-Nimrud_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Nimrud_3": {
        "id": "input-Nimrud_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Nimrud_4": {
        "id": "input-Nimrud_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Mandragora_1": {
        "id": "input-Mandragora_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Mandragora_2": {
        "id": "input-Mandragora_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Mandragora_3": {
        "id": "input-Mandragora_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Mandragora_4": {
        "id": "input-Mandragora_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Rohonc_1": {
        "id": "input-Rohonc_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Rohonc_2": {
        "id": "input-Rohonc_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Rohonc_3": {
        "id": "input-Rohonc_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Rohonc_4": {
        "id": "input-Rohonc_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Aether_1": {
        "id": "input-Aether_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Aether_2": {
        "id": "input-Aether_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Aether_3": {
        "id": "input-Aether_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Aether_4": {
        "id": "input-Aether_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Antikythera_1": {
        "id": "input-Antikythera_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Antikythera_2": {
        "id": "input-Antikythera_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Antikythera_3": {
        "id": "input-Antikythera_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Antikythera_4": {
        "id": "input-Antikythera_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Voynich_1": {
        "id": "input-Voynich_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Voynich_2": {
        "id": "input-Voynich_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Voynich_3": {
        "id": "input-Voynich_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Voynich_4": {
        "id": "input-Voynich_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Haniwa_1": {
        "id": "input-Haniwa_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Haniwa_2": {
        "id": "input-Haniwa_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Haniwa_3": {
        "id": "input-Haniwa_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Haniwa_4": {
        "id": "input-Haniwa_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Baghdad_1": {
        "id": "input-Baghdad_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Baghdad_2": {
        "id": "input-Baghdad_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Baghdad_3": {
        "id": "input-Baghdad_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Baghdad_4": {
        "id": "input-Baghdad_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Totem_1": {
        "id": "input-Totem_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Totem_2": {
        "id": "input-Totem_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Totem_3": {
        "id": "input-Totem_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Totem_4": {
        "id": "input-Totem_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Fleece_1": {
        "id": "input-Fleece_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Fleece_2": {
        "id": "input-Fleece_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Fleece_3": {
        "id": "input-Fleece_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Fleece_4": {
        "id": "input-Fleece_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Kikuko_1": {
        "id": "input-Kikuko_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Kikuko_2": {
        "id": "input-Kikuko_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Kikuko_3": {
        "id": "input-Kikuko_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Kikuko_4": {
        "id": "input-Kikuko_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "Credit": {
        "id": "input-Credit",
        "location": "resourceModal",
        "min": "0",
        "max": "10000000000"
    },
    "Secret": {
        "id": "input-Secret",
        "location": "resourceModal",
        "min": "0",
        "max": "20"
    },
    "XP_4": {
        "id": "input-XP_4",
        "location": "resourceModal",
        "min": "0",
        "max": "999"
    },
    "XP_3": {
        "id": "input-XP_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "XP_2": {
        "id": "input-XP_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999"
    },
    "XP_1": {
        "id": "input-XP_1",
        "location": "resourceModal",
        "min": "0",
        "max": "99999"
    }
}