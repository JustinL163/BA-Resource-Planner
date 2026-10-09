// Frozen raid search reference for fuzzy-ranking parity.
function stringSimilarity(str1, str2, gramSize) {
    function getNGrams(s, len) {
        s = ' '.repeat(len - 1) + s.toLowerCase() + ' '.repeat(len - 1);
        let v = new Array(s.length - len + 1);
        for (let i = 0; i < v.length; i++) {
            v[i] = s.slice(i, i + len);
        }
        return v;
    }

    if (!str1?.length || !str2?.length) { return 0.0; }

    let s1 = str1.length < str2.length ? str1 : str2;
    let s2 = str1.length < str2.length ? str2 : str1;

    let pairs1 = getNGrams(s1, gramSize);
    let pairs2 = getNGrams(s2, gramSize);
    let set = new Set(pairs1);

    let total = pairs2.length;
    let hits = 0;
    for (let item of pairs2) {
        if (set.delete(item)) {
            hits++;
        }
    }
    return hits / total;
}

function LoadStudentInfo() {

    studentSearchMapping = {};
    studentSearchKeys = [];

    let studentIds = Object.keys(student_info);

    for (let i = 0; i < studentIds.length; i++) {

        let student = student_info[studentIds[i]];

        for (let ii = 0; ii < student["EN"].length; ii++) {
            studentSearchMapping[student["EN"][ii].toLowerCase()] = studentIds[i];
            studentSearchKeys.push(student["EN"][ii].toLowerCase());
        }
    }
}

function SearchStudent(searchString, maxMatches) {

    if (!maxMatches) {
        maxMatches = 5;
    }

    let comparisons = [];

    for (let i = 0; i < studentSearchKeys.length; i++) {
        if (borrowMode || !usedStudents.includes(studentSearchMapping[studentSearchKeys[i]])) {
            comparisons.push({ "Name": studentSearchKeys[i], "Similarity": stringSimilarity(searchString, studentSearchKeys[i], 2) });
        }
    }

    comparisons.sort(function (a, b) { return parseFloat(b.Similarity) - parseFloat(a.Similarity); })

    let bestMatches = [];

    for (let i = 0; i < comparisons.length; i++) {

        if (searchString.length >= 4) {
            if (comparisons[i].Similarity <= 0.1 || !comparisons[i].Name.includes(searchString)) {
                continue;
            }
        }
        else {
            if (comparisons[i].Similarity <= 0.1 || comparisons[i].Name.substring(0, searchString.length) != searchString) {
                continue;
            }
        }

        let studentId = studentSearchMapping[comparisons[i].Name];
        if (!bestMatches.includes(studentId)) {
            bestMatches.push(studentId);
        }

        if (bestMatches.length >= maxMatches) {
            break;
        }
    }

    for (let i = 0; i < comparisons.length; i++) {

        let studentId = studentSearchMapping[comparisons[i].Name];
        if (!bestMatches.includes(studentId)) {
            bestMatches.push(studentId);
        }

        if (bestMatches.length >= maxMatches) {
            break;
        }
    }

    return bestMatches;
}
