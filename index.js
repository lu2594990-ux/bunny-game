jQuery(() => {
    $(document.getElementById("extensions_settings")).append(
        '<div class="inline-drawer">' +
        '<div class="inline-drawer-toggle inline-drawer-header">' +
        '<b>🐰 Bunny Toolbox</b>' +
        '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>' +
        '</div>' +
        '<div class="inline-drawer-content">' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:5px 0;">' +
        '<input type="checkbox" id="bny-toggle" /><span>Show Bunny</span>' +
        '</label>' +
        '<div id="bny-status" style="padding:5px 0;font-size:12px;color:#888;">Bunny is hidden</div>' +
        '</div></div>'
    );

    function getActiveRegex() {
        var result = [];
        try {
            var ctx = SillyTavern.getContext();
            var gr = ctx.extensionSettings.regex || [];
            for (var i = 0; i < gr.length; i++) {
                if (!gr[i].disabled && gr[i].placement &&
                    (gr[i].placement.indexOf(1) !== -1 || gr[i].placement.indexOf(2) !== -1)) {
                    result.push({
                        source: "全局",
                        name: gr[i].scriptName || "未命名",
                        findRegex: gr[i].findRegex || "",
                        replaceString: gr[i].replaceString || ""
                    });
                }
            }
            if (ctx.characters && ctx.characterId !== undefined) {
                var ch = ctx.characters[ctx.characterId];
                if (ch && ch.data && ch.data.extensions && ch.data.extensions.regex_scripts) {
                    var cr = ch.data.extensions.regex_scripts;
                    for (var j = 0; j < cr.length; j++) {
                        if (!cr[j].disabled && cr[j].placement &&
                            (cr[j].placement.indexOf(1) !== -1 || cr[j].placement.indexOf(2) !== -1)) {
                            result.push({
                                source: "角色卡",
                                name: cr[j].scriptName || "未命名",
                                findRegex: cr[j].findRegex || "",
                                replaceString: cr[j].replaceString || ""
                            });
                        }
                    }
                }
            }
        } catch (e) { }
        return result;
    }

    function getLastAIMsg() {
        try {
            var ctx = SillyTavern.getContext();
            for (var i = ctx.chat.length - 1; i >= 0; i--) {
                if (!ctx.chat[i].is_user) {
                    return { idx: i, mes: ctx.chat[i].mes };
                }
            }
        } catch (e) { }
        return null;
    }

    function parseRegex(fr) {
        try {
            var m = fr.match(/^\/(.*)\/([gimsuy]*)$/s);
            if (m) return new RegExp(m[1], m[2]);
            return new RegExp(fr);
        } catch (e) { return null; }
    }

    function extractSkeleton(regexStr) {
        var m = regexStr.match(/^\/(.*)\/[gimsuy]*$/s);
        var pattern = m ? m[1] : regexStr;
        var pieces = [];
        var fixed = "";
        var i = 0;
        while (i < pattern.length) {
            var ch = pattern[i];
            if (ch === "\\" && i + 1 < pattern.length) {
                var nx = pattern[i + 1];
                if ("sSdDwWbBnrtfv".indexOf(nx) !== -1) {
                    if (fixed) { pieces.push(fixed); fixed = ""; }
                    i += 2;
                    while (i < pattern.length && "*+?{".indexOf(pattern[i]) !== -1) {
                        if (pattern[i] === "{") {
                            while (i < pattern.length && pattern[i] !== "}") i++;
                            i++;
                        } else { i++; }
                    }
                } else if (nx === "/") {
                    fixed += "/";
                    i += 2;
                } else {
                    fixed += nx;
                    i += 2;
                }
            } else if (ch === "(") {
                if (fixed) { pieces.push(fixed); fixed = ""; }
                i++;
                if (i < pattern.length && pattern[i] === "?") {
                    i++;
                    while (i < pattern.length && pattern[i] !== ")" && ":!=<".indexOf(pattern[i]) !== -1) i++;
                }} else if (ch === ")") {
                i++;
                while (i < pattern.length && "*+?{".indexOf(pattern[i]) !== -1) {
                    if (pattern[i] === "{") {
                        while (i < pattern.length && pattern[i] !== "}") i++;
                        i++;
                    } else { i++; }
                }
            } else if (ch === "[") {
                if (fixed) { pieces.push(fixed); fixed = ""; }
                i++;
                while (i < pattern.length && pattern[i] !== "]") {
                    if (pattern[i] === "\\" && i + 1 < pattern.length) i += 2;
                    else i++;
                }
                if (i < pattern.length) i++;
                while (i < pattern.length && "*+?{".indexOf(pattern[i]) !== -1) {
                    if (pattern[i] === "{") {
                        while (i < pattern.length && pattern[i] !== "}") i++;
                        i++;
                    } else { i++; }
                }
            } else if (".*+?^$|".indexOf(ch) !== -1) {
                if ("*+?".indexOf(ch) !== -1 && fixed.length > 0) {
                    fixed = fixed.slice(0, -1);
                }
                if (fixed) { pieces.push(fixed); fixed = ""; }
                i++;
            } else if (ch === "{") {
                if (fixed.length > 0) {
                    fixed = fixed.slice(0, -1);
                    if (fixed) { pieces.push(fixed); fixed = ""; }
                }
                while (i < pattern.length && pattern[i] !== "}") i++;
                if (i < pattern.length) i++;
            } else {
                fixed += ch;
                i++;
            }
        }
        if (fixed) pieces.push(fixed);
        return pieces.filter(function (p) { return p.length >= 2; });
    }

    function charSimilarity(a, b) {
        var aL = a.toLowerCase();
        var bL = b.toLowerCase();
        if (aL === bL) return 1;
        var longer = aL.length > bL.length ? aL : bL;
        var shorter = aL.length > bL.length ? bL : aL;
        if (longer.length === 0) return 1;
        var matches = 0;
        var used = longer.split("");
        for (var i = 0; i < shorter.length; i++) {
            for (var j = 0; j < used.length; j++) {
                if (used[j] === shorter[i]) {
                    matches++;
                    used.splice(j, 1);
                    break;
                }
            }
        }
        return matches / Math.max(aL.length, bL.length);
    }

    function fuzzyFind(text, pieces) {
        if (!pieces.length) return null;
        var tLow = text.toLowerCase();
        var allHits = [];
        for (var i = 0; i < pieces.length; i++) {
            var pLow = pieces[i].toLowerCase();
            var pos = 0;
            while (true) {
                var idx = tLow.indexOf(pLow, pos);
                if (idx === -1) break;
                allHits.push({ pieceIdx: i, start: idx, end: idx + pieces[i].length });
                pos = idx + 1;
                if (allHits.length > 500) break;
            }
        }
        if (allHits.length === 0) return null;
        allHits.sort(function (a, b) { return a.start - b.start; });
        var best = null;
        for (var h = 0; h < allHits.length; h++) {
            var center = allHits[h].start;
            var segStart = allHits[h].start;
            var segEnd = allHits[h].end;
            var hitMap = {};
            for (var k = 0; k < allHits.length; k++) {
                if (Math.abs(allHits[k].start - center) < 5000) {
                    hitMap[allHits[k].pieceIdx] = true;
                    if (allHits[k].start < segStart) segStart = allHits[k].start;
                    if (allHits[k].end > segEnd) segEnd = allHits[k].end;
                }
            }
            var score = 0;
            for (var key in hitMap) {
                if (hitMap.hasOwnProperty(key)) score++;
            }
            if (!best || score > best.score) {
                best = { start: segStart, end: segEnd, score: score, total: pieces.length };
            }
        }
        if (best) {
            best.start = Math.max(0, best.start - 200);
            best.end = Math.min(text.length, best.end + 50);
            best.text = text.substring(best.start, best.end);
        }
        return best;
    }

    function findWrongVersion(segText, correctPiece) {
        if (correctPiece.length < 2) return null;
        var cLow = correctPiece.toLowerCase();
        var sLow = segText.toLowerCase();
        if (sLow.indexOf(cLow) !== -1) return null;
        var bestSim = 0;
        var bestResult = null;
        var minW = Math.max(2, correctPiece.length - 5);
        var maxW = Math.min(segText.length, correctPiece.length + 8);
        for (var wl = minW; wl <= maxW; wl++) {
            for (var i = 0; i <= segText.length - wl; i++) {
                var cand = segText.substring(i, i + wl);
                var sim = charSimilarity(cand, correctPiece);
                if (sim > 0.6 && sim > bestSim) {
                    bestSim = sim;
                    bestResult = {
                        start: i,
                        end: i + wl,
                        wrongText: cand,
                        correctText: correctPiece,
                        sim: sim
                    };
                }
            }
        }
        return bestResult;
    }

    function saveMsg(idx, newText) {
        try {
            var ctx = SillyTavern.getContext();
            ctx.chat[idx].mes = newText;
            ctx.saveChat();
            return true;
        } catch (e) { return false; }
    }

    var host = document.createElement("div");
    host.id = "bny-host";
    host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;";
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: "open" });

    var styleEl = document.createElement("style");
    styleEl.textContent = [
        "*{box-sizing:border-box;margin:0;padding:0;}",
        "::-webkit-scrollbar{width:4px;}",
        "::-webkit-scrollbar-thumb{background:#e0c0c8;border-radius:4px;}",
        ".ov{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1;pointer-events:auto;display:none;background:rgba(0,0,0,.2);}",
        ".fab{position:fixed;width:52px;height:52px;font-size:24px;line-height:52px;text-align:center;border-radius:50%;background:linear-gradient(135deg,#ff6b9d,#c44569);color:#fff;border:2px solid rgba(255,255,255,.3);cursor:pointer;box-shadow:0 4px 15px rgba(255,107,157,.5);display:none;touch-action:none;user-select:none;-webkit-user-select:none;pointer-events:auto;transition:transform .15s;z-index:10;}",
        ".fab:active{transform:scale(.9);}",
        ".pnl{position:fixed;width:92vw;max-width:440px;height:80vh;max-height:700px;background:#fffafc;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;pointer-events:auto;border:1px solid #fde2e8;z-index:5;}",
        ".hdr{display:flex;align-items:center;padding:12px 14px;background:linear-gradient(135deg,#ff6b9d,#c44569);color:#fff;font-size:14px;font-weight:bold;gap:8px;flex-shrink:0;}",
        ".body{flex:1;overflow-y:auto;padding:12px;}",
        ".sel{margin-bottom:12px;}",
        ".sel label{font-size:11px;color:#999;display:block;margin-bottom:4px;}",
        ".sel select{width:100%;height:36px;border:1px solid #f0d0d8;border-radius:10px;padding:0 10px;font-size:12px;outline:none;background:#fff;}",
        ".box{background:#fff;border:1px solid #f0e0e6;border-radius:10px;padding:10px;margin-bottom:10px;}",
        ".blabel{font-size:11px;color:#999;margin-bottom:6px;}",
        ".bst{font-size:11px;padding:2px 8px;border-radius:8px;color:#fff;display:inline-block;}",
        ".bst.ok{background:#059669;}",
        ".bst.no{background:#dc2626;}",
        ".bst.warn{background:#d97706;}",
        ".pieces{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;}",
        ".pieces span{font-size:10px;padding:2px 6px;border-radius:6px;font-family:monospace;}",
        ".pieces .hit{background:#d1fae5;color:#059669;}",
        ".pieces .miss{background:#fee2e2;color:#dc2626;}",
        ".fix{background:#fff8f0;border:1px solid #fed7aa;border-radius:8px;padding:8px;margin:6px 0;}",
        ".frow{display:flex;align-items:center;gap:6px;font-size:11px;font-family:monospace;flex-wrap:wrap;}",
        ".fwrong{background:#fee2e2;color:#dc2626;padding:1px 4px;border-radius:4px;text-decoration:line-through;}",
        ".fright{background:#d1fae5;color:#059669;padding:1px 4px;border-radius:4px;}",
        ".farrow{color:#999;}",
        "textarea{width:100%;min-height:120px;border:1px solid #f0d0d8;border-radius:8px;padding:8px;font-size:11px;font-family:monospace;outline:none;resize:vertical;line-height:1.5;}",
        "textarea:focus{border-color:#ff6b9d;}",
        "pre{background:#f8f5f6;border-radius:8px;padding:8px;font-size:10px;font-family:monospace;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow-y:auto;color:#555;}",
        ".btns{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}",
        ".btns button{flex:1;min-width:70px;height:36px;border:none;border-radius:10px;font-size:12px;cursor:pointer;color:#fff;}",
        ".btns button:active{opacity:.7;}",
        ".bfix{background:linear-gradient(135deg,#f59e0b,#d97706);}",
        ".btest{background:linear-gradient(135deg,#60a5fa,#3b82f6);}",
        ".bsave{background:linear-gradient(135deg,#34d399,#059669);}",
        ".breset{background:#ddd;color:#888!important;}",
        ".info{text-align:center;padding:30px;color:#ccc;font-size:12px;}",
        ".msg{text-align:center;padding:6px;font-size:11px;min-height:20px;flex-shrink:0;}"
    ].join("\n");
    shadow.appendChild(styleEl);

    var ov = document.createElement("div");
    ov.className = "ov";
    shadow.appendChild(ov);

    var fab = document.createElement("div");
    fab.className = "fab";
    fab.textContent = "\u{1F430}";
    shadow.appendChild(fab);

    var panel = document.createElement("div");
    panel.className = "pnl";
    shadow.appendChild(panel);

    var hdr = document.createElement("div");
    hdr.className = "hdr";
    hdr.textContent = "🔧 正则调试";
    panel.appendChild(hdr);

    var bodyDiv = document.createElement("div");
    bodyDiv.className = "body";
    panel.appendChild(bodyDiv);

    var selDiv = document.createElement("div");
    selDiv.className = "sel";
    bodyDiv.appendChild(selDiv);

    var selLabel = document.createElement("label");
    selLabel.textContent = "选择要调试的正则：";
    selDiv.appendChild(selLabel);

    var selEl = document.createElement("select");
    selEl.id = "bny-sel";
    selDiv.appendChild(selEl);

    var contentEl = document.createElement("div");
    contentEl.id = "bny-content";
    bodyDiv.appendChild(contentEl);

    var defInfo = document.createElement("div");
    defInfo.className = "info";
    defInfo.textContent = "👆 请先选择一条正则";
    contentEl.appendChild(defInfo);

    var msgEl = document.createElement("div");
    msgEl.className = "msg";
    panel.appendChild(msgEl);

    var panelOpen = false;
    var cachedRegex = [];

    panel.addEventListener("touchstart", function (e) { e.stopPropagation(); });
    panel.addEventListener("touchmove", function (e) { e.stopPropagation(); });
    panel.addEventListener("touchend", function (e) { e.stopPropagation(); });
    panel.addEventListener("mousedown", function (e) { e.stopPropagation(); });ov.addEventListener("click", function () { closeP(); });
    ov.addEventListener("touchstart", function (e) { e.preventDefault(); closeP(); });

    function populateSelect() {
        cachedRegex = getActiveRegex();
        selEl.innerHTML = "";
        var defOpt = document.createElement("option");
        defOpt.value = "";
        defOpt.textContent = "-- 请选择（" + cachedRegex.length + "条）--";
        selEl.appendChild(defOpt);
        for (var i = 0; i < cachedRegex.length; i++) {
            var opt = document.createElement("option");
            opt.value = String(i);
            opt.textContent = "[" + cachedRegex[i].source + "] " + cachedRegex[i].name;
            selEl.appendChild(opt);
        }}

    selEl.addEventListener("change", function (e) {
        e.stopPropagation();
        if (selEl.value === "") {
            contentEl.innerHTML = "";
            var inf = document.createElement("div");
            inf.className = "info";
            inf.textContent = "👆 请先选择一条正则";
            contentEl.appendChild(inf);
            return;
        }
        runAnalysis(parseInt(selEl.value));
    });
    selEl.addEventListener("mousedown", function (e) { e.stopPropagation(); });
    selEl.addEventListener("touchstart", function (e) { e.stopPropagation(); });

    function runAnalysis(idx) {
        var rx = cachedRegex[idx];
        var lastMsg = getLastAIMsg();
        if (!lastMsg) {
            contentEl.innerHTML = "";
            var inf = document.createElement("div");
            inf.className = "info";
            inf.textContent = "❌ 没有AI消息";
            contentEl.appendChild(inf);
            return;
        }

        var pieces = extractSkeleton(rx.findRegex);
        var reg = parseRegex(rx.findRegex);
        var directMatch = false;
        if (reg) {
            directMatch = reg.test(lastMsg.mes);
            if (reg.global) reg.lastIndex = 0;
        }

        var found = fuzzyFind(lastMsg.mes, pieces);
        var tLow = lastMsg.mes.toLowerCase();
        var hitPieces = [];
        var missPieces = [];
        for (var pi = 0; pi < pieces.length; pi++) {
            if (tLow.indexOf(pieces[pi].toLowerCase()) !== -1) {
                hitPieces.push(pieces[pi]);
            } else {
                missPieces.push(pieces[pi]);
            }
        }

        var fixes = [];
        if (found && !directMatch) {
            for (var fi = 0; fi < missPieces.length; fi++) {
                var wv = findWrongVersion(found.text, missPieces[fi]);
                if (wv) fixes.push(wv);
            }
        }

        contentEl.innerHTML = "";

        var box1 = document.createElement("div");
        box1.className = "box";
        contentEl.appendChild(box1);

        var statusDiv = document.createElement("div");
        statusDiv.className = "blabel";
        box1.appendChild(statusDiv);

        var statusSpan = document.createElement("span");
        if (directMatch) {
            statusSpan.className = "bst ok";
            statusSpan.textContent = "✅ 匹配成功，无需修复";
        } else if (found && found.score >= Math.ceil(found.total * 0.3)) {
            statusSpan.className = "bst warn";
            statusSpan.textContent = "⚠️ 未匹配，找到相似段落（" + found.score + "/" + found.total + "）";
        } else {
            statusSpan.className = "bst no";
            statusSpan.textContent = "❌ 未找到相似内容";
        }
        statusDiv.appendChild(statusSpan);

        var pLabel = document.createElement("div");
        pLabel.className = "blabel";
        pLabel.style.marginTop = "6px";
        pLabel.textContent = "🧩 骨架碎片：";
        box1.appendChild(pLabel);

        var piecesDiv = document.createElement("div");
        piecesDiv.className = "pieces";
        box1.appendChild(piecesDiv);

        for (var hi = 0; hi < hitPieces.length; hi++) {
            var hs = document.createElement("span");
            hs.className = "hit";
            hs.textContent = "✓ " + hitPieces[hi];
            piecesDiv.appendChild(hs);
        }
        for (var mi = 0; mi < missPieces.length; mi++) {
            var ms = document.createElement("span");
            ms.className = "miss";
            ms.textContent = "✗ " + missPieces[mi];
            piecesDiv.appendChild(ms);
        }

        if (missPieces.length > 0) {
            var tip = document.createElement("div");
            tip.style.cssText = "font-size:10px;color:#dc2626;padding:4px 0;";
            tip.textContent = "💡 红色碎片 = 正文里写错/缺失的部分";
            box1.appendChild(tip);
        }

        if (fixes.length > 0) {
            var fixBox = document.createElement("div");
            fixBox.className = "box";
            contentEl.appendChild(fixBox);

            var fixLabel = document.createElement("div");
            fixLabel.className = "blabel";
            fixLabel.textContent = "🔧 发现 " + fixes.length + " 处可自动修复：";
            fixBox.appendChild(fixLabel);

            for (var fxi = 0; fxi < fixes.length; fxi++) {
                var fixItem = document.createElement("div");
                fixItem.className = "fix";
                fixBox.appendChild(fixItem);

                var frow = document.createElement("div");
                frow.className = "frow";
                fixItem.appendChild(frow);

                var ws = document.createElement("span");
                ws.className = "fwrong";
                ws.textContent = fixes[fxi].wrongText;
                frow.appendChild(ws);

                var ar = document.createElement("span");
                ar.className = "farrow";
                ar.textContent = " → ";
                frow.appendChild(ar);

                var rs = document.createElement("span");
                rs.className = "fright";
                rs.textContent = fixes[fxi].correctText;
                frow.appendChild(rs);
            }
        }

        var box2 = document.createElement("div");
        box2.className = "box";
        contentEl.appendChild(box2);

        var editLabel = document.createElement("div");
        editLabel.className = "blabel";
        editLabel.textContent = "📍 问题段落（可手动编辑）：";
        box2.appendChild(editLabel);

        var editEl = document.createElement("textarea");
        editEl.value = found ? found.text : "";
        box2.appendChild(editEl);

        var evts = ["keydown", "keyup", "keypress", "input", "touchstart", "touchmove"];
        for (var ei = 0; ei < evts.length; ei++) {
            editEl.addEventListener(evts[ei], function (e) { e.stopPropagation(); });
        }

        var btnsDiv = document.createElement("div");
        btnsDiv.className = "btns";
        contentEl.appendChild(btnsDiv);

        if (fixes.length > 0) {
            var autoBtn = document.createElement("button");
            autoBtn.className = "bfix";
            autoBtn.textContent = "⚡ 一键修复（" + fixes.length + "处）";
            autoBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                var txt = editEl.value;
                var sorted = fixes.slice().sort(function (a, b) { return b.start - a.start; });
                for (var si = 0; si < sorted.length; si++) {
                    var f = sorted[si];
                    txt = txt.substring(0, f.start) + f.correctText + txt.substring(f.end);
                }
                editEl.value = txt;
                msgEl.textContent = "⚡ 已修复 " + fixes.length + " 处！点测试确认";});
            btnsDiv.appendChild(autoBtn);
        }

        var testBtn = document.createElement("button");
        testBtn.className = "btest";
        testBtn.textContent = "▶️ 测试";
        testBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var edited = editEl.value;
            var testReg = parseRegex(rx.findRegex);
            var ok = testReg ? testReg.test(edited) : false;
            if (testReg && testReg.global) testReg.lastIndex = 0;

            var old = contentEl.querySelector("#bny-result");
            if (old) old.remove();

            var resDiv = document.createElement("div");
            resDiv.id = "bny-result";
            contentEl.appendChild(resDiv);

            if (ok) {
                var replaced = edited;
                try {
                    var rr = parseRegex(rx.findRegex);
                    replaced = edited.replace(rr, rx.replaceString);
                } catch (er) { }

                var okBox = document.createElement("div");
                okBox.className = "box";
                okBox.style.marginTop = "8px";
                resDiv.appendChild(okBox);

                var okLabel = document.createElement("div");
                okLabel.className = "blabel";
                okBox.appendChild(okLabel);

                var okSpan = document.createElement("span");
                okSpan.className = "bst ok";
                okSpan.textContent = "✅ 匹配成功！";
                okLabel.appendChild(okSpan);

                var prevLabel = document.createElement("div");
                prevLabel.className = "blabel";
                prevLabel.textContent = "替换后预览：";
                okBox.appendChild(prevLabel);

                var prevEl = document.createElement("pre");
                prevEl.textContent = replaced.substring(0, 800);
                okBox.appendChild(prevEl);
            } else {
                var noBox = document.createElement("div");
                noBox.className = "box";
                noBox.style.marginTop = "8px";
                resDiv.appendChild(noBox);

                var noLabel = document.createElement("div");
                noLabel.className = "blabel";
                noBox.appendChild(noLabel);

                var noSpan = document.createElement("span");
                noSpan.className = "bst no";
                noSpan.textContent = "❌ 仍不匹配";
                noLabel.appendChild(noSpan);

                var noTip = document.createElement("div");
                noTip.style.cssText = "font-size:10px;color:#999;padding:4px;";
                noTip.textContent = "继续调整后再试";
                noBox.appendChild(noTip);
            }
            msgEl.textContent = ok ? "✅ 匹配成功" : "❌ 仍未匹配";
        });
        btnsDiv.appendChild(testBtn);

        var saveBtn = document.createElement("button");
        saveBtn.className = "bsave";
        saveBtn.textContent = "💾 保存";
        saveBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            if (!found) {
                msgEl.textContent = "❌ 没有段落";
                return;
            }
            var edited = editEl.value;
            var newMes = lastMsg.mes.substring(0, found.start) + edited + lastMsg.mes.substring(found.end);
            if (saveMsg(lastMsg.idx, newMes)) {
                msgEl.textContent = "✅ 已保存！";
            } else {
                msgEl.textContent = "❌ 保存失败";
            }
        });
        btnsDiv.appendChild(saveBtn);

        var resetBtn = document.createElement("button");
        resetBtn.className = "breset";
        resetBtn.textContent = "🔄 重置";
        resetBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            editEl.value = found ? found.text : "";
            var old = contentEl.querySelector("#bny-result");
            if (old) old.remove();
            msgEl.textContent = "🔄 已重置";
        });
        btnsDiv.appendChild(resetBtn);
    }

    var posX = 100;
    var posY = 300;

    function posPanel() {
        var pw = Math.min(window.innerWidth * 0.92, 440);
        var ph = Math.min(window.innerHeight * 0.8, 700);
        var left = posX +26- pw / 2;
        if (left < 5) left = 5;
        if (left + pw > window.innerWidth - 5) left = window.innerWidth - 5 - pw;
        var top = posY -10 - ph;
        if (top < 5) top = posY + 62;
        if (top + ph > window.innerHeight - 5) top = window.innerHeight - 5 - ph;
        panel.style.left = left + "px";
        panel.style.top = top + "px";
        panel.style.width = pw + "px";
        panel.style.height = ph + "px";
    }

    function openP() {
        posPanel();
        panel.style.display = "flex";
        ov.style.display = "block";
        panelOpen = true;
        populateSelect();
    }

    function closeP() {
        panel.style.display = "none";
        ov.style.display = "none";
        panelOpen = false;
    }

    function toggleP() {
        if (panelOpen) closeP();
        else openP();
    }

    var dragging = false;
    var hasMoved = false;
    var startX = 0;
    var startY = 0;

    function moveTo(x, y) {
        posX = Math.max(0, Math.min(x, window.innerWidth - 52));
        posY = Math.max(0, Math.min(y, window.innerHeight - 52));
        fab.style.left = posX + "px";
        fab.style.top = posY + "px";
        if (panelOpen) posPanel();
    }

    fab.addEventListener("touchstart", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dragging = true;
        hasMoved = false;
        startX = e.touches[0].clientX - posX;
        startY = e.touches[0].clientY - posY;
    }, { passive: false });

    fab.addEventListener("touchmove", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (dragging) {
            hasMoved = true;
            moveTo(e.touches[0].clientX - startX, e.touches[0].clientY - startY);
        }
    }, { passive: false });

    fab.addEventListener("touchend", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var wm = hasMoved;
        dragging = false;
        hasMoved = false;
        if (!wm) {
            setTimeout(toggleP, 50);
        } else {
            localStorage.setItem("bnyPosX", String(posX));
            localStorage.setItem("bnyPosY", String(posY));
        }
    }, { passive: false });

    fab.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dragging = true;
        hasMoved = false;
        startX = e.clientX - posX;
        startY = e.clientY - posY;
    });

    document.addEventListener("mousemove", function (e) {
        if (dragging) {
            hasMoved = true;
            moveTo(e.clientX - startX, e.clientY - startY);
        }
    });

    document.addEventListener("mouseup", function () {
        if (!dragging) return;
        var wm = hasMoved;
        dragging = false;
        hasMoved = false;
        if (!wm) {
            toggleP();
        } else {
            localStorage.setItem("bnyPosX", String(posX));
            localStorage.setItem("bnyPosY", String(posY));
        }
    });

    function showFab() {
        var sx = localStorage.getItem("bnyPosX");
        var sy = localStorage.getItem("bnyPosY");
        if (sx && sy) {
            posX = parseInt(sx);
            posY = parseInt(sy);}
        moveTo(posX, posY);fab.style.display = "block";
    }

    function hideFab() {
        fab.style.display = "none";closeP();
    }

    if (localStorage.getItem("bnyShow") === "1") {
        $("#bny-toggle").prop("checked", true);
        showFab();
        $("#bny-status").text("Bunny is visible!");
    }

    $("#bny-toggle").on("change", function () {
        var on = $(this).prop("checked");
        if (on) {
            showFab();
            $("#bny-status").text("Bunny is visible!");
        } else {
            hideFab();
            $("#bny-status").text("Bunny is hidden");
        }
        localStorage.setItem("bnyShow", on ? "1" : "0");
    });
});
