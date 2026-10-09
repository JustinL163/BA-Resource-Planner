// Frozen pre-migration reference; do not regenerate to accept behaviour differences.
function ApplyBulkUpdate(bulkUpdate) {
    for (let i = 0; i < bulkChars.length; i++) {

        let charData = data.characters.find(obj => { return obj.id == bulkChars[i] });

        if (charData != undefined) {
            let uc = bulkUpdate.current;
            let ut = bulkUpdate.target;

            let cc = charData.current;
            let ct = charData.target;

            let params = ["level", "ex", "basic", "passive", "sub", "gear1", "gear2", "gear3"];
            for (let p = 0; p < params.length; p++) {
                if (uc[params[p]]) {
                    cc[params[p]] = uc[params[p]];
                }

                if (ut[params[p]]) {
                    ct[params[p]] = Math.max(ut[params[p]], cc[params[p]]);
                }
                else {
                    if (parseInt(ct[params[p]]) < parseInt(cc[params[p]])) {
                        ct[params[p]] = cc[params[p]];
                    }
                }
            }

            if (charData.hasBondGear) {
                if (uc["bond_gear"]) {
                    cc["bond_gear"] = uc["bond_gear"];
                }

                if (ut["bond_gear"]) {
                    ct["bond_gear"] = Math.max(ut["bond_gear"], cc["bond_gear"]);
                }
                else {
                    if (parseInt(ct["bond_gear"]) < parseInt(cc["bond_gear"])) {
                        ct["bond_gear"] = cc["bond_gear"];
                    }
                }
            }

            let charInfoObj = charlist[bulkChars[i]];

            if (modalStars.star) {
                cc.star = Math.max(modalStars.star, charInfoObj.StarGrade);
                cc.ue = modalStars.ue;
            }

            if (modalStars.star_target) {
                ct.star = Math.max(modalStars.star_target, cc.star);
                ct.ue = Math.max(modalStars.ue_target, cc.ue);
            }
            else {
                if (ct.star < cc.star) {
                    ct.star = cc.star;
                }

                if (ct.ue < cc.ue) {
                    ct.ue = cc.ue;
                }
            }

            if (uc.ue_level) {
                if (parseInt(cc.ue) >= 3) {
                    cc.ue_level = uc.ue_level;
                }
                else if (cc.ue == 2) {
                    cc.ue_level = Math.min(uc.ue_level, 40);
                }
                else if (cc.ue == 1) {
                    cc.ue_level = Math.min(uc.ue_level, 30);
                }
                else {
                    cc.ue_level = 0;
                }
            }

            if (ut.ue_level) {
                if (parseInt(ct.ue) >= 3) {
                    ct.ue_level = Math.max(ut.ue_level, cc.ue_level);
                }
                else if (ct.ue == 2) {
                    ct.ue_level = Math.min(Math.max(ut.ue_level, cc.ue_level), 40);
                }
                else if (ct.ue == 1) {
                    ct.ue_level = Math.min(Math.max(ut.ue_level, cc.ue_level), 30);
                }
                else {
                    ct.ue_level = 0;
                }
            }
            else {
                if (parseInt(ct.ue_level) < parseInt(cc.ue_level)) {
                    ct.ue_level = cc.ue_level;
                }
            }

            let bookParams = ["book_hp", "book_atk", "book_heal"];
            for (let p = 0; p < bookParams.length; p++) {
                if (uc[bookParams[p]]) {
                    cc[bookParams[p]] = cc.ue > 0 ? uc[bookParams[p]] : 0;
                }

                if (ut[bookParams[p]]) {
                    ct[bookParams[p]] = ct.ue > 0 ? Math.max(ut[bookParams[p]], cc[bookParams[p]]) : 0;
                }
                else {
                    if (parseInt(ct[bookParams[p]]) < parseInt(cc[bookParams[p]])) {
                        ct[bookParams[p]] = cc[bookParams[p]];
                    }
                }
            }

            if (uc.bond) {
                if (parseInt(cc.star) >= 5) {
                    cc.bond = uc.bond;
                }
                else if (parseInt(cc.star) >= 3) {
                    cc.bond = Math.min(uc.bond, 20);
                }
                else {
                    cc.bond = Math.min(uc.bond, 10);
                }
            }

            if (ut.bond) {
                if (parseInt(ct.star) >= 5) {
                    ct.bond = Math.max(ut.bond, cc.bond);
                }
                else if (parseInt(cc.star) >= 3) {
                    ct.bond = Math.min(Math.max(ut.bond, cc.bond), 20);
                }
                else {
                    ct.bond = Math.min(Math.max(ut.bond, cc.bond), 10);
                }
            }
            else {
                if (parseInt(ct.bond) < parseInt(cc.bond)) {
                    ct.bond = cc.bond;
                }
            }
        }
    }

    saveToLocalStorage(false);

    location.reload();
}
