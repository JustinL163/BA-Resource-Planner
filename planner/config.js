class TwoWayMap {
    constructor(map) {
        this.map = map;
        this.reverseMap = {};
        this.keys = [];
        for (const key in map) {
            const value = map[key];
            this.reverseMap[value] = key;
            this.keys.push(key);
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
    111: "Phaistos_2",
    112: "Phaistos_3",
    113: "Phaistos_4",
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
    240: "Colgante_1",
    241: "Colgante_2",
    242: "Colgante_3",
    243: "Colgante_4",
    290: "Mystery_1",
    291: "Mystery_2",
    292: "Mystery_3",
    293: "Mystery_4",

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
    4060: "TN_1_Arius",
    4061: "TN_2_Arius",
    4062: "TN_3_Arius",
    4063: "TN_4_Arius",
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

const gearLookup = ["T2_Hat", "T2_Gloves", "T2_Shoes", "T2_Bag", "T2_Badge", "T2_Hairpin", "T2_Charm", "T2_Watch", "T2_Necklace",
    "T3_Hat", "T3_Gloves", "T3_Shoes", "T3_Bag", "T3_Badge", "T3_Hairpin", "T3_Charm", "T3_Watch", "T3_Necklace",
    "T4_Hat", "T4_Gloves", "T4_Shoes", "T4_Bag", "T4_Badge", "T4_Hairpin", "T4_Charm", "T4_Watch", "T4_Necklace",
    "T5_Hat", "T5_Gloves", "T5_Shoes", "T5_Bag", "T5_Badge", "T5_Hairpin", "T5_Charm", "T5_Watch", "T5_Necklace",
    "T6_Hat", "T6_Gloves", "T6_Shoes", "T6_Bag", "T6_Badge", "T6_Hairpin", "T6_Charm", "T6_Watch", "T6_Necklace",
    "T7_Hat", "T7_Gloves", "T7_Shoes", "T7_Bag", "T7_Badge", "T7_Hairpin", "T7_Charm", "T7_Watch", "T7_Necklace"]

var rowColours = {
    "Abydos": "#9ce4fc66", "Gehenna": "#ec7d7966", "Millennium": "#9ebdfa66", "Trinity": "#fcd19c66", "Hyakkiyako": "#f0a8c466", "Arius": "#dbdad85e",
    "Shanhaijing": "#b4feca66", "Red Winter": "#d98c9e66", "Valkyrie": "#a1a9e166", "Nebra": "#99919466", "Phaistos": "#fdf7e766", "Wolfsegg": "#93a5f266",
    "Nimrud": "#67e4ef66", "Mandragora": "#a1ede566", "Rohonc": "#c9ab9366", "Aether": "#ca96e066", "Antikythera": "#f7e28866",
    "Voynich": "#84b28066", "Haniwa": "#e7bef466", "Baghdad": "#d179a066", "Totem": "#b77e6166", "Fleece": "#faf69f66", "Kikuko": "#ef957f66",
    "Colgante": "#c2cdfe70", "Mystery": "#305c894a",
    "Gloves": "#84848436", "Bag": "#84848436", "Hairpin": "#84848436", "Watch": "#84848436"
};

const propertyColours = {
    "Explosive": "#ec242487", "Piercing": "#fff10099", "Mystic": "#1070a5c2",
    "Light": "#ec242487", "Heavy": "#fff10099", "Special": "#1070a5c2",
    "Striker": "#ec242487",
    "Abydos": "#9ce4fc66", "Gehenna": "#ec7d7966", "Millennium": "#9ebdfa66", "Trinity": "#fcd19c66", "Hyakkiyako": "#f0a8c466",
    "Arius": "#dbdad85e", "Shanhaijing": "#b4feca66", "Red Winter": "#d98c9e66", "Valkyrie": "#a1a9e166"
}

const exportDataVersion = 2;
// perhaps need to move this to JSON file later lmao, is probably getting a bit big
// also perhaps later add functionality to set validation for a whole class of inputs rather than just invidually
class Student {

    constructor(characterInfo) {
        this.id = characterInfo.Id;
        this.name = characterInfo.Name;
        this.current = StudentInvestment.Default(characterInfo);
        this.target = StudentInvestment.DefaultTarget(characterInfo);
        this.enabled = true;
    }

    static FromVersion1Data(version1) {

        var student = new Student({
            Id: version1.id,
            Name: version1.name
        });
        student.enabled = version1.enabled;

        const props = ['level', 'bond', 'star', 'ue', 'ue_level', 'ex', 'basic', 'passive', 'sub', 'gear1', 'gear2', 'gear3']
        var cur = [];
        var tar = [];
        for (var prop of props) {
            cur.push(version1[prop]);
            tar.push(version1[prop + "_target"]);
        }

        student.current = new StudentInvestment(...cur);
        student.target = new StudentInvestment(...tar);

        return student;
    }
}

class StudentInvestment {

    constructor(level, bond, star, ue, ue_level, ex, basic, passive, sub, gear1, gear2, gear3) {
        this.level = level;
        this.bond = bond;
        this.star = star;
        this.ue = ue;
        this.ue_level = ue_level;
        this.ex = ex;
        this.basic = basic;
        this.passive = passive;
        this.sub = sub;
        this.gear1 = gear1;
        this.gear2 = gear2;
        this.gear3 = gear3;
    }

    static Default(characterInfo) {
        var data = [
            1,
            1,
            characterInfo?.BaseStar ?? 1,
            0,
            0,

            1,
            1,
            0,
            0,

            0,
            0,
            0
        ];

        return new StudentInvestment(...data);
    }

    static DefaultTarget(characterInfo) {
        var defaultTarget = StudentInvestment.Default(characterInfo);
        defaultTarget.ex = inputValidation.ex_target.default;
        defaultTarget.basic = inputValidation.basic_target.default;
        defaultTarget.passive = inputValidation.passive_target.default;
        defaultTarget.sub = inputValidation.sub_target.default;

        defaultTarget.bond = inputValidation.bond_target.default;
        defaultTarget.level = inputValidation.level_target.default;
        defaultTarget.star = characterInfo?.BaseStar ?? 1;
        defaultTarget.ue = 0;
        defaultTarget.ue_level = inputValidation.ue_level_target.default;

        defaultTarget.gear1 = inputValidation.gear1_target.default;
        defaultTarget.gear2 = inputValidation.gear2_target.default;
        defaultTarget.gear2 = inputValidation.gear2_target.default;

        return defaultTarget
    }
}
const inputValidation = {
    "level": {
        id: "input_level_current",
        location: "characterModal",
        min: "1",
        max: "80",
        default: "1",
        name: "Level",
        "navigation": "direct",
        "Down": "input_level_target",
        "Right": "input_level_target"
    },
    "level_target": {
        id: "input_level_target",
        location: "characterModal",
        min: "1",
        max: "80",
        default: "1",
        name: "Level Target",
        requisite: {
            "level": {
                type: "input",
                compare: "equal_greater",
                mode: "direct",
                sanitise: true
            }
        },
        "navigation": "direct",
        "Up": "input_level_current",
        "Left": "input_level_current",
        "Down": "input_ex_current",
        "Right": "input_ue_level_current"
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
        },
        "navigation": "direct",
        "Up": "input_level_target",
        "Left": "input_level_target",
        "Down": "input_ue_level_target",
        "Right": "input_ue_level_target"
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
                sanitise: true
            }
        },
        "navigation": "direct",
        "Up": "input_ue_level_current",
        "Left": "input_ue_level_current",
        "Down": "input_bond_current",
        "Right": "input_bond_current"
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
        },
        "navigation": "direct",
        "Up": "input_ue_level_target",
        "Left": "input_ue_level_target",
        "Down": "input_bond_target",
        "Right": "input_bond_target"
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
                sanitise: true
            }
        },
        "navigation": "direct",
        "Up": "input_bond_current",
        "Left": "input_bond_current",
        "Down": "input_ex_current",
        "Right": "input_ex_current"
    },
    "ex": {
        id: "input_ex_current",
        location: "characterModal",
        min: "1",
        max: "5",
        default: "1",
        name: "EX",
        "navigation": "direct",
        "Up": "input_level_target",
        "Left": "input_level_target",
        "Down": "input_ex_target",
        "Right": "input_basic_current"
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
                sanitise: true
            }
        },
        "navigation": "direct",
        "Up": "input_ex_current",
        "Left": "input_sub_current",
        "Down": "input_basic_current",
        "Right": "input_basic_target"
    },
    "basic": {
        id: "input_basic_current",
        location: "characterModal",
        min: "1",
        max: "10",
        default: "1",
        name: "Basic",
        "navigation": "direct",
        "Up": "input_ex_target",
        "Left": "input_ex_current",
        "Down": "input_basic_target",
        "Right": "input_enhanced_current"
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
                sanitise: true
            }
        },
        "navigation": "direct",
        "Up": "input_basic_current",
        "Left": "input_ex_target",
        "Down": "input_enhanced_current",
        "Right": "input_enhanced_target"
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
        },
        "navigation": "direct",
        "Up": "input_basic_target",
        "Left": "input_basic_current",
        "Down": "input_enhanced_target",
        "Right": "input_sub_current"
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
                sanitise: true
            }
        },
        "navigation": "direct",
        "Up": "input_enhanced_current",
        "Left": "input_basic_target",
        "Down": "input_sub_current",
        "Right": "input_sub_target"
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
        },
        "navigation": "direct",
        "Up": "input_enhanced_target",
        "Left": "input_enhanced_current",
        "Down": "input_sub_target",
        "Right": "input_ex_target"
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
                sanitise: true
            }
        },
        "navigation": "direct",
        "Up": "input_sub_current",
        "Left": "input_enhanced_target",
        "Down": "input_gear1_current",
        "Right": "input_gear1_current"
    },
    "gear1": {
        id: "input_gear1_current",
        location: "characterModal",
        min: "0",
        max: "7",
        default: "0",
        name: "Gear 1",
        "navigation": "direct",
        "Up": "input_sub_target",
        "Left": "input_sub_target",
        "Down": "input_gear1_target",
        "Right": "input_gear2_current"
    },
    "gear1_target": {
        id: "input_gear1_target",
        location: "characterModal",
        min: "0",
        max: "7",
        default: "0",
        name: "Gear 1 Target",
        requisite: {
            "gear1": {
                type: "input",
                compare: "equal_greater",
                mode: "direct",
                sanitise: true
            }
        },
        "navigation": "direct",
        "Up": "input_gear1_current",
        "Left": "input_gear3_current",
        "Down": "input_gear2_current",
        "Right": "input_gear2_target"
    },
    "gear2": {
        id: "input_gear2_current",
        location: "characterModal",
        min: "0",
        max: "7",
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
                        max: "7"
                    },
                    {
                        max: "0"
                    }
                ]
            }
        },
        "navigation": "direct",
        "Up": "input_gear1_target",
        "Left": "input_gear1_current",
        "Down": "input_gear2_target",
        "Right": "input_gear3_current"
    },
    "gear2_target": {
        id: "input_gear2_target",
        location: "characterModal",
        min: "0",
        max: "7",
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
                        max: "7"
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
                sanitise: true
            }
        },
        "navigation": "direct",
        "Up": "input_gear2_current",
        "Left": "input_gear1_target",
        "Down": "input_gear3_current",
        "Right": "input_gear3_target"
    },
    "gear3": {
        id: "input_gear3_current",
        location: "characterModal",
        min: "0",
        max: "7",
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
                        max: "7"
                    },
                    {
                        max: "0"
                    }
                ]
            }
        },
        "navigation": "direct",
        "Up": "input_gear2_target",
        "Left": "input_gear2_current",
        "Down": "input_gear3_target",
        "Right": "input_gear1_target"
    },
    "gear3_target": {
        id: "input_gear3_target",
        location: "characterModal",
        min: "0",
        max: "7",
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
                        max: "7"
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
                sanitise: true
            }
        },
        "navigation": "direct",
        "Up": "input_gear3_current",
        "Left": "input_gear2_target",
        "Down": "input_ue_level_current"
    },
    "BD_1_Abydos": {
        "id": "input-BD_1_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-BD_4_Millennium"
    },
    "BD_1_Gehenna": {
        "id": "input-BD_1_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-BD_4_Abydos"
    },
    "BD_1_Millennium": {
        "id": "input-BD_1_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-BD_4_Arius"
    },
    "BD_1_Trinity": {
        "id": "input-BD_1_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-BD_4_Gehenna"
    },
    "BD_1_Hyakkiyako": {
        "id": "input-BD_1_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-BD_4_RedWinter",
        "Up": "input-BD_2_Valkyrie"
    },
    "BD_1_Shanhaijing": {
        "id": "input-BD_1_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-BD_4_Valkyrie"
    },
    "BD_1_Arius": {
        "id": "input-BD_1_Arius",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-BD_4_Shanhaijing"
    },
    "BD_1_RedWinter": {
        "id": "input-BD_1_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-BD_4_Trinity"
    },
    "BD_1_Valkyrie": {
        "id": "input-BD_1_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-TN_4_Hyakkiyako",
        "Down": "input-TN_4_Hyakkiyako"
    },
    "BD_2_Abydos": {
        "id": "input-BD_2_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_2_Gehenna": {
        "id": "input-BD_2_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_2_Millennium": {
        "id": "input-BD_2_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_2_Trinity": {
        "id": "input-BD_2_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_2_Hyakkiyako": {
        "id": "input-BD_2_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Up": "input-BD_3_Valkyrie"
    },
    "BD_2_Shanhaijing": {
        "id": "input-BD_2_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_2_Arius": {
        "id": "input-BD_2_Arius",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_2_RedWinter": {
        "id": "input-BD_2_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_2_Valkyrie": {
        "id": "input-BD_2_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Down": "input-BD_1_Hyakkiyako"
    },
    "BD_3_Abydos": {
        "id": "input-BD_3_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_3_Gehenna": {
        "id": "input-BD_3_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_3_Millennium": {
        "id": "input-BD_3_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_3_Trinity": {
        "id": "input-BD_3_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_3_Hyakkiyako": {
        "id": "input-BD_3_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Up": "input-BD_4_Valkyrie"
    },
    "BD_3_Shanhaijing": {
        "id": "input-BD_3_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_3_Arius": {
        "id": "input-BD_3_Arius",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_3_RedWinter": {
        "id": "input-BD_3_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_3_Valkyrie": {
        "id": "input-BD_3_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Down": "input-BD_2_Hyakkiyako"
    },
    "BD_4_Abydos": {
        "id": "input-BD_4_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-BD_1_Gehenna"
    },
    "BD_4_Gehenna": {
        "id": "input-BD_4_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-BD_1_Trinity"
    },
    "BD_4_Millennium": {
        "id": "input-BD_4_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-BD_1_Abydos"
    },
    "BD_4_Trinity": {
        "id": "input-BD_4_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-BD_1_RedWinter"
    },
    "BD_4_Hyakkiyako": {
        "id": "input-BD_4_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "BD_4_Shanhaijing": {
        "id": "input-BD_4_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-BD_1_Arius"
    },
    "BD_4_Arius": {
        "id": "input-BD_4_Arius",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-BD_1_Millennium"
    },
    "BD_4_RedWinter": {
        "id": "input-BD_4_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-BD_1_Hyakkiyako"
    },
    "BD_4_Valkyrie": {
        "id": "input-BD_4_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-BD_1_Shanhaijing",
        "Down": "input-BD_3_Hyakkiyako"
    },
    "TN_1_Abydos": {
        "id": "input-TN_1_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-TN_4_Millennium"
    },
    "TN_1_Gehenna": {
        "id": "input-TN_1_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-TN_4_Abydos"
    },
    "TN_1_Millennium": {
        "id": "input-TN_1_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-TN_4_Arius"
    },
    "TN_1_Trinity": {
        "id": "input-TN_1_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-TN_4_Gehenna"
    },
    "TN_1_Hyakkiyako": {
        "id": "input-TN_1_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-TN_4_RedWinter",
        "Up": "input-TN_2_Valkyrie"
    },
    "TN_1_Shanhaijing": {
        "id": "input-TN_1_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-TN_4_Valkyrie"
    },
    "TN_1_Arius": {
        "id": "input-TN_1_Arius",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-TN_4_Shanhaijing"
    },
    "TN_1_RedWinter": {
        "id": "input-TN_1_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-TN_4_Trinity"
    },
    "TN_1_Valkyrie": {
        "id": "input-TN_1_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Right": "input-Nebra_4",
        "Down": "input-Nebra_4"
    },
    "TN_2_Abydos": {
        "id": "input-TN_2_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_2_Gehenna": {
        "id": "input-TN_2_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_2_Millennium": {
        "id": "input-TN_2_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_2_Trinity": {
        "id": "input-TN_2_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_2_Hyakkiyako": {
        "id": "input-TN_2_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Up": "input-TN_3_Valkyrie"
    },
    "TN_2_Shanhaijing": {
        "id": "input-TN_2_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_2_Arius": {
        "id": "input-TN_2_Arius",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_2_RedWinter": {
        "id": "input-TN_2_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_2_Valkyrie": {
        "id": "input-TN_2_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Down": "input-TN_1_Hyakkiyako"
    },
    "TN_3_Abydos": {
        "id": "input-TN_3_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_3_Gehenna": {
        "id": "input-TN_3_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_3_Millennium": {
        "id": "input-TN_3_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_3_Trinity": {
        "id": "input-TN_3_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_3_Hyakkiyako": {
        "id": "input-TN_3_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Up": "input-TN_4_Valkyrie"
    },
    "TN_3_Shanhaijing": {
        "id": "input-TN_3_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_3_Arius": {
        "id": "input-TN_3_Arius",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_3_RedWinter": {
        "id": "input-TN_3_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable"
    },
    "TN_3_Valkyrie": {
        "id": "input-TN_3_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Down": "input-TN_2_Hyakkiyako"
    },
    "TN_4_Abydos": {
        "id": "input-TN_4_Abydos",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-TN_1_Gehenna"
    },
    "TN_4_Gehenna": {
        "id": "input-TN_4_Gehenna",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-TN_1_Trinity"
    },
    "TN_4_Millennium": {
        "id": "input-TN_4_Millennium",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-TN_1_Abydos"
    },
    "TN_4_Trinity": {
        "id": "input-TN_4_Trinity",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-TN_1_RedWinter"
    },
    "TN_4_Hyakkiyako": {
        "id": "input-TN_4_Hyakkiyako",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-BD_1_Valkyrie",
        "Up": "input-BD_1_Valkyrie"
    },
    "TN_4_Shanhaijing": {
        "id": "input-TN_4_Shanhaijing",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-TN_1_Arius"
    },
    "TN_4_Arius": {
        "id": "input-TN_4_Arius",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-TN_1_Millennium"
    },
    "TN_4_RedWinter": {
        "id": "input-TN_4_RedWinter",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-TN_1_Hyakkiyako"
    },
    "TN_4_Valkyrie": {
        "id": "input-TN_4_Valkyrie",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "resourceTable",
        "Left": "input-TN_1_Shanhaijing",
        "Down": "input-TN_3_Hyakkiyako"
    },
    "Nebra_1": {
        "id": "input-Nebra_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Phaistos_4",
        "Up": "input-Aether_2"
    },
    "Nebra_2": {
        "id": "input-Nebra_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Up": "input-Aether_3"
    },
    "Nebra_3": {
        "id": "input-Nebra_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Up": "input-Aether_4"
    },
    "Nebra_4": {
        "id": "input-Nebra_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Up": "input-TN_1_Valkyrie"
    },
    "Phaistos_1": {
        "id": "input-Phaistos_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Wolfsegg_4"
    },
    "Phaistos_2": {
        "id": "input-Phaistos_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Phaistos_3": {
        "id": "input-Phaistos_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Phaistos_4": {
        "id": "input-Phaistos_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Nebra_1"
    },
    "Wolfsegg_1": {
        "id": "input-Wolfsegg_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Nimrud_4"
    },
    "Wolfsegg_2": {
        "id": "input-Wolfsegg_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Wolfsegg_3": {
        "id": "input-Wolfsegg_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Wolfsegg_4": {
        "id": "input-Wolfsegg_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Phaistos_1"
    },
    "Nimrud_1": {
        "id": "input-Nimrud_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Mandragora_4"
    },
    "Nimrud_2": {
        "id": "input-Nimrud_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Nimrud_3": {
        "id": "input-Nimrud_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Nimrud_4": {
        "id": "input-Nimrud_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Wolfsegg_1"
    },
    "Mandragora_1": {
        "id": "input-Mandragora_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Rohonc_4"
    },
    "Mandragora_2": {
        "id": "input-Mandragora_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Mandragora_3": {
        "id": "input-Mandragora_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Mandragora_4": {
        "id": "input-Mandragora_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Nimrud_1"
    },
    "Rohonc_1": {
        "id": "input-Rohonc_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Aether_4"
    },
    "Rohonc_2": {
        "id": "input-Rohonc_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Rohonc_3": {
        "id": "input-Rohonc_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Rohonc_4": {
        "id": "input-Rohonc_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Mandragora_1"
    },
    "Aether_1": {
        "id": "input-Aether_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Antikythera_4",
        "Down": "input-Antikythera_4"
    },
    "Aether_2": {
        "id": "input-Aether_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Down": "input-Nebra_1"
    },
    "Aether_3": {
        "id": "input-Aether_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Down": "input-Nebra_2"
    },
    "Aether_4": {
        "id": "input-Aether_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Rohonc_1",
        "Down": "input-Nebra_3"
    },
    "Antikythera_1": {
        "id": "input-Antikythera_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Voynich_4",
        "Up": "input-Mystery_2"
    },
    "Antikythera_2": {
        "id": "input-Antikythera_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Up": "input-Mystery_3"
    },
    "Antikythera_3": {
        "id": "input-Antikythera_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Up": "input-Mystery_4"
    },
    "Antikythera_4": {
        "id": "input-Antikythera_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Aether_1",
        "Up": "input-Aether_1"
    },
    "Voynich_1": {
        "id": "input-Voynich_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Haniwa_4"
    },
    "Voynich_2": {
        "id": "input-Voynich_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Voynich_3": {
        "id": "input-Voynich_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Voynich_4": {
        "id": "input-Voynich_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Antikythera_1"
    },
    "Haniwa_1": {
        "id": "input-Haniwa_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Totem_4"
    },
    "Haniwa_2": {
        "id": "input-Haniwa_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Haniwa_3": {
        "id": "input-Haniwa_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Haniwa_4": {
        "id": "input-Haniwa_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Voynich_1"
    },
    "Baghdad_1": {
        "id": "input-Baghdad_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Colgante_4"
    },
    "Baghdad_2": {
        "id": "input-Baghdad_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Baghdad_3": {
        "id": "input-Baghdad_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Baghdad_4": {
        "id": "input-Baghdad_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Totem_1"
    },
    "Totem_1": {
        "id": "input-Totem_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Baghdad_4"
    },
    "Totem_2": {
        "id": "input-Totem_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Totem_3": {
        "id": "input-Totem_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Totem_4": {
        "id": "input-Totem_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Haniwa_1"
    },
    "Fleece_1": {
        "id": "input-Fleece_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Fleece_2": {
        "id": "input-Fleece_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Fleece_3": {
        "id": "input-Fleece_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Fleece_4": {
        "id": "input-Fleece_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Kikuko_1": {
        "id": "input-Kikuko_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Kikuko_2": {
        "id": "input-Kikuko_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Kikuko_3": {
        "id": "input-Kikuko_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Kikuko_4": {
        "id": "input-Kikuko_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Colgante_1": {
        "id": "input-Colgante_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Right": "input-Mystery_4"
    },
    "Colgante_2": {
        "id": "input-Colgante_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Colgante_3": {
        "id": "input-Colgante_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Colgante_4": {
        "id": "input-Colgante_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Baghdad_1"
    },
    "Mystery_1": {
        "id": "input-Mystery_1",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable"
    },
    "Mystery_2": {
        "id": "input-Mystery_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Down": "input-Antikythera_1"
    },
    "Mystery_3": {
        "id": "input-Mystery_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Down": "input-Antikythera_2"
    },
    "Mystery_4": {
        "id": "input-Mystery_4",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "resourceTable",
        "Left": "input-Colgante_1",
        "Down": "input-Antikythera_3"
    },
    "Credit": {
        "id": "input-Credit",
        "location": "resourceModal",
        "min": "0",
        "max": "10000000000",
        "navigation": "direct",
        "Right": "input-XP_4",
        "Down": "input-XP_4"
    },
    "Secret": {
        "id": "input-Secret",
        "location": "resourceModal",
        "min": "0",
        "max": "20",
        "navigation": "direct",
        "Left": "input-XP_4",
        "Up": "input-XP_4"
    },
    "XP_4": {
        "id": "input-XP_4",
        "location": "resourceModal",
        "min": "0",
        "max": "999",
        "navigation": "direct",
        "Right": "input-XP_3",
        "Left": "input-Credit",
        "Up": "input-Credit",
        "Down": "input-XP_3"
    },
    "XP_3": {
        "id": "input-XP_3",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Right": "input-XP_2",
        "Left": "input-XP_4",
        "Up": "input-Credit",
        "Down": "input-XP_2"
    },
    "XP_2": {
        "id": "input-XP_2",
        "location": "resourceModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Right": "input-XP_1",
        "Left": "input-XP_3",
        "Up": "input-Credit",
        "Down": "input-XP_1"
    },
    "XP_1": {
        "id": "input-XP_1",
        "location": "resourceModal",
        "min": "0",
        "max": "99999",
        "navigation": "direct",
        "Right": "input-Secret",
        "Left": "input-XP_2",
        "Up": "input-Credit",
        "Down": "input-Secret"
    },
    "T2_Hat": {
        "id": "input-T2_Hat",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T2_Gloves": {
        "id": "input-T2_Gloves",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T2_Shoes": {
        "id": "input-T2_Shoes",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T2_Bag": {
        "id": "input-T2_Bag",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T2_Badge": {
        "id": "input-T2_Badge",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T2_Hairpin": {
        "id": "input-T2_Hairpin",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T2_Charm": {
        "id": "input-T2_Charm",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T2_Watch": {
        "id": "input-T2_Watch",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T2_Necklace": {
        "id": "input-T2_Necklace",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T3_Hat": {
        "id": "input-T3_Hat",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T3_Gloves": {
        "id": "input-T3_Gloves",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T3_Shoes": {
        "id": "input-T3_Shoes",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T3_Bag": {
        "id": "input-T3_Bag",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T3_Badge": {
        "id": "input-T3_Badge",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T3_Hairpin": {
        "id": "input-T3_Hairpin",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T3_Charm": {
        "id": "input-T3_Charm",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T3_Watch": {
        "id": "input-T3_Watch",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T3_Necklace": {
        "id": "input-T3_Necklace",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T4_Hat": {
        "id": "input-T4_Hat",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T4_Gloves": {
        "id": "input-T4_Gloves",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T4_Shoes": {
        "id": "input-T4_Shoes",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T4_Bag": {
        "id": "input-T4_Bag",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T4_Badge": {
        "id": "input-T4_Badge",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T4_Hairpin": {
        "id": "input-T4_Hairpin",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T4_Charm": {
        "id": "input-T4_Charm",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T4_Watch": {
        "id": "input-T4_Watch",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T4_Necklace": {
        "id": "input-T4_Necklace",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T5_Hat": {
        "id": "input-T5_Hat",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T5_Gloves": {
        "id": "input-T5_Gloves",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T5_Shoes": {
        "id": "input-T5_Shoes",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T5_Bag": {
        "id": "input-T5_Bag",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T5_Badge": {
        "id": "input-T5_Badge",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T5_Hairpin": {
        "id": "input-T5_Hairpin",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T5_Charm": {
        "id": "input-T5_Charm",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T5_Watch": {
        "id": "input-T5_Watch",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T5_Necklace": {
        "id": "input-T5_Necklace",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T6_Hat": {
        "id": "input-T6_Hat",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T6_Gloves": {
        "id": "input-T6_Gloves",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T6_Shoes": {
        "id": "input-T6_Shoes",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T6_Bag": {
        "id": "input-T6_Bag",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T6_Badge": {
        "id": "input-T6_Badge",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T6_Hairpin": {
        "id": "input-T6_Hairpin",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T6_Charm": {
        "id": "input-T6_Charm",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T6_Watch": {
        "id": "input-T6_Watch",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T6_Necklace": {
        "id": "input-T6_Necklace",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T7_Hat": {
        "id": "input-T7_Hat",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T7_Gloves": {
        "id": "input-T7_Gloves",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T7_Shoes": {
        "id": "input-T7_Shoes",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T7_Bag": {
        "id": "input-T7_Bag",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T7_Badge": {
        "id": "input-T7_Badge",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T7_Hairpin": {
        "id": "input-T7_Hairpin",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T7_Charm": {
        "id": "input-T7_Charm",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T7_Watch": {
        "id": "input-T7_Watch",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "T7_Necklace": {
        "id": "input-T7_Necklace",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "gearTable"
    },
    "GXP_4": {
        "id": "input-GXP_4",
        "location": "gearModal",
        "min": "0",
        "max": "999",
        "navigation": "direct",
        "Right": "input-GXP_3",
        "Down": "input-GXP_3"
    },
    "GXP_3": {
        "id": "input-GXP_3",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Right": "input-GXP_2",
        "Left": "input-GXP_4",
        "Down": "input-GXP_2",
        "Up": "input-GXP_4"
    },
    "GXP_2": {
        "id": "input-GXP_2",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Right": "input-GXP_1",
        "Left": "input-GXP_3",
        "Down": "input-GXP_1",
        "Up": "input-GXP_3"
    },
    "GXP_1": {
        "id": "input-GXP_1",
        "location": "gearModal",
        "min": "0",
        "max": "99999",
        "navigation": "direct",
        "Left": "input-GXP_2",
        "Up": "input-GXP_2"
    },
    "T4_Spring": {
        "id": "input-T4_Spring",
        "location": "gearModal",
        "min": "0",
        "max": "999",
        "navigation": "direct",
        "Right": "input-T3_Spring",
        "Down": "input-T4_Hammer"
    },
    "T3_Spring": {
        "id": "input-T3_Spring",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Left": "input-T4_Spring",
        "Right": "input-T2_Spring",
        "Down": "input-T3_Hammer",
        "Up": "input-T4_Needle"
    },
    "T2_Spring": {
        "id": "input-T2_Spring",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Left": "input-T3_Spring",
        "Right": "input-T1_Spring",
        "Down": "input-T2_Hammer",
        "Up": "input-T3_Needle"
    },
    "T1_Spring": {
        "id": "input-T1_Spring",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Left": "input-T2_Spring",
        "Right": "input-T4_Hammer",
        "Down": "input-T1_Hammer",
        "Up": "input-T2_Needle"
    },
    "T4_Hammer": {
        "id": "input-T4_Hammer",
        "location": "gearModal",
        "min": "0",
        "max": "999",
        "navigation": "direct",
        "Left": "input-T1_Spring",
        "Right": "input-T3_Hammer",
        "Down": "input-T4_Barrel",
        "Up": "input-T4_Spring"
    },
    "T3_Hammer": {
        "id": "input-T3_Hammer",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Left": "input-T4_Hammer",
        "Right": "input-T2_Hammer",
        "Down": "input-T3_Barrel",
        "Up": "input-T3_Spring"
    },
    "T2_Hammer": {
        "id": "input-T2_Hammer",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Left": "input-T3_Hammer",
        "Right": "input-T1_Hammer",
        "Down": "input-T2_Barrel",
        "Up": "input-T2_Spring"
    },
    "T1_Hammer": {
        "id": "input-T1_Hammer",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Left": "input-T2_Hammer",
        "Right": "input-T4_Barrel",
        "Down": "input-T1_Barrel",
        "Up": "input-T1_Spring"
    },
    "T4_Barrel": {
        "id": "input-T4_Barrel",
        "location": "gearModal",
        "min": "0",
        "max": "999",
        "navigation": "direct",
        "Left": "input-T1_Hammer",
        "Right": "input-T3_Barrel",
        "Down": "input-T4_Needle",
        "Up": "input-T4_Hammer"
    },
    "T3_Barrel": {
        "id": "input-T3_Barrel",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Left": "input-T4_Barrel",
        "Right": "input-T2_Barrel",
        "Down": "input-T3_Needle",
        "Up": "input-T3_Hammer"
    },
    "T2_Barrel": {
        "id": "input-T2_Barrel",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Left": "input-T3_Barrel",
        "Right": "input-T1_Barrel",
        "Down": "input-T2_Needle",
        "Up": "input-T2_Hammer"
    },
    "T1_Barrel": {
        "id": "input-T1_Barrel",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Left": "input-T2_Barrel",
        "Right": "input-T4_Needle",
        "Down": "input-T1_Needle",
        "Up": "input-T1_Hammer"
    },
    "T4_Needle": {
        "id": "input-T4_Needle",
        "location": "gearModal",
        "min": "0",
        "max": "999",
        "navigation": "direct",
        "Left": "input-T1_Barrel",
        "Right": "input-T3_Needle",
        "Down": "input-T3_Spring",
        "Up": "input-T4_Barrel"
    },
    "T3_Needle": {
        "id": "input-T3_Needle",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Left": "input-T4_Needle",
        "Right": "input-T2_Needle",
        "Down": "input-T2_Spring",
        "Up": "input-T3_Barrel"
    },
    "T2_Needle": {
        "id": "input-T2_Needle",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Left": "input-T3_Needle",
        "Right": "input-T1_Needle",
        "Down": "input-T1_Spring",
        "Up": "input-T2_Barrel"
    },
    "T1_Needle": {
        "id": "input-T1_Needle",
        "location": "gearModal",
        "min": "0",
        "max": "9999",
        "navigation": "direct",
        "Left": "input-T2_Needle",
        "Up": "input-T1_Barrel"
    }
}