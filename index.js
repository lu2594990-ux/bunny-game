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
                if (!gr[i].disabled && gr[i].placement && (gr[i].placement.indexOf(1) !== -1 || gr[i].placement.indexOf(2) !== -1)) {
                    result.push({ source: "全局", name: gr[i].scriptName || "未命名", findRegex: gr[i].findRegex || "", replaceString: gr[i].replaceString || "" });
                }
            }if (ctx.characters && ctx.characterId !== undefined) {
                var ch = ctx.characters[ctx.characterId];
                if (ch && ch.data && ch.data.extensions && ch.data.extensions.regex_scripts) {
                    var cr = ch.data.extensions.regex_scripts;
                    for (var j = 0; j < cr.length; j++) {
                        if (!cr[j].disabled && cr[j].placement && (cr[j].placement.indexOf(1) !== -1 || cr[j].placement.indexOf(2) !== -1)) {
                            result.push({ source: "角色卡", name: cr[j].scriptName || "未命名", findRegex: cr[j].findRegex || "", replaceString: cr[j].replaceString || "" });
                        }
                    }
                }
            }
        } catch (e) {}
        return result;
    }

    function getLastAIMsg() {
        try {
            var ctx = SillyTavern.getContext();
            for (var i = ctx.chat.length - 1; i >= 0; i--) {
                if (!ctx.chat[i].is_user) return { idx: i, mes: ctx.chat[i].mes };
            }
        } catch (e) {}
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
                        if (pattern[i] === "{") { while (i < pattern.length && pattern[i] !== "}") i++; i++; } else i++;
                    }
                } else if (nx === "/") { fixed += "/"; i += 2; }
                else { fixed += nx; i += 2; }
            } else if (ch === "(") {
                if (fixed) { pieces.push(fixed); fixed = ""; }
                i++;
                if (i < pattern.length && pattern[i] === "?") { i++; while (i < pattern.length && pattern[i] !== ")" && ":!=<".indexOf(pattern[i]) !== -1) i++; }} else if (ch === ")") {
                i++;
                while (i < pattern.length && "*+?{".indexOf(pattern[i]) !== -1) {
                    if (pattern[i] === "{") { while (i < pattern.length && pattern[i] !== "}") i++; i++; } else i++;
                }
            } else if (ch === "[") {
                if (fixed) { pieces.push(fixed); fixed = ""; }
                i++;
                while (i < pattern.length && pattern[i] !== "]") { if (pattern[i] === "\\" && i + 1 < pattern.length) i += 2; else i++; }
                if (i < pattern.length) i++;
                while (i < pattern.length && "*+?{".indexOf(pattern[i]) !== -1) {
                    if (pattern[i] === "{") { while (i < pattern.length && pattern[i] !== "}") i++; i++; } else i++;
                }
            } else if (".*+?^$|".indexOf(ch) !== -1) {
                if ("*+?".indexOf(ch) !== -1 && fixed.length > 0) fixed = fixed.slice(0, -1);
                if (fixed) { pieces.push(fixed); fixed = ""; }
                i++;
            } else if (ch === "{") {
                if (fixed.length > 0) { fixed = fixed.slice(0, -1); if (fixed) { pieces.push(fixed); fixed = ""; } }
                while (i < pattern.length && pattern[i] !== "}") i++;
                if (i < pattern.length) i++;
            } else { fixed += ch; i++; }
        }
        if (fixed) pieces.push(fixed);
        return pieces.filter(function (p) { return p.length >= 2; });
    }

    function editDist(a, b) {
        var m = a.length, n = b.length;
        if (m === 0) return n;
        if (n === 0) return m;
        var dp = [];
        for (var i = 0; i <= m; i++) { dp[i] = [i]; for (var j = 1; j <= n; j++) dp[i][j] = 0; }
        for (var j = 0; j <= n; j++) dp[0][j] = j;
        for (var i = 1; i <= m; i++) {
            for (var j = 1; j <= n; j++) {
                if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
                else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
        return dp[m][n];
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
            for (var key in hitMap) { if (hitMap.hasOwnProperty(key)) score++; }
            if (!best || score > best.score) {
                best = { start: segStart, end: segEnd, score: score, total: pieces.length };
            }
        }
        if (best) {
            var expand = 200;
            best.start = Math.max(0, best.start - expand);
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
        var minW = Math.max(2, cLow.length - 5);
        var maxW = Math.min(segText.length, cLow.length + 8);
        var best = null;
        var bestDist = Infinity;
        for (var wl = minW; wl <= maxW; wl++) {
            for (var i = 0; i <= segText.length - wl; i++) {
                var cand = sLow.substring(i, i + wl);
                var d = editDist(cand, cLow);
                var threshold = Math.floor(cLow.length * 0.45);
                if (d <= threshold && d < bestDist) {
                    bestDist = d;
                    best = { start: i, end: i + wl, wrongText: segText.substring(i, i + wl), correctText: correctPiece, dist: d };
                }
            }
        }
        return best;
    }

    function saveMsg(idx, newText) {
        try {
            var ctx = SillyTavern.getContext();
            ctx.chat[idx].mes = newText;
            ctx.saveChat();
            return true;
        } catch (e) { return false; }
    }
    host.id = "bny-host";
    host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;";
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: "open" });

    var styleEl = document.createElement("style");
    styleEl.textContent =
        "*{box-sizing:border-box;margin:0;padding:0;}" +
        "::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#e0c0c8;border-radius:4px;}" +
        ".ov{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1;pointer-events:auto;display:none;background:rgba(0,0,0,.2);}" +
        ".fab{position:fixed;width:52px;height:52px;font-size:24px;line-height:52px;text-align:center;border-radius:50%;background:linear-gradient(135deg,#ff6b9d,#c44569);color:#fff;border:2px solid rgba(255,255,255,.3);cursor:pointer;box-shadow:0 4px 15px rgba(255,107,157,.5);display:none;touch-action:none;user-select:none;-webkit-user-select:none;pointer-events:auto;transition:transform .15s;z-index:10;}" +
        ".fab:active{transform:scale(.9);}" +
        ".pnl{position:fixed;width:92vw;max-width:440px;height:80vh;max-height:700px;background:#fffafc;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;pointer-events:auto;border:1px solid #fde2e8;z-index:5;}" +
        ".hdr{display:flex;align-items:center;padding:12px 14px;background:linear-gradient(135deg,#ff6b9d,#c44569);color:#fff;font-size:14px;font-weight:bold;gap:8px;flex-shrink:0;}" +
        ".hdr .htitle{flex:1;}" +
        ".body{flex:1;overflow-y:auto;padding:12px;}" +
        ".sel{margin-bottom:12px;}" +
        ".sel label{font-size:11px;color:#999;display:block;margin-bottom:4px;}" +
        ".sel select{width:100%;height:36px;border:1px solid #f0d0d8;border-radius:10px;padding:0 10px;font-size:12px;outline:none;background:#fff;}" +
        ".box{background:#fff;border:1px solid #f0e0e6;border-radius:10px;padding:10px;margin-bottom:10px;}" +
        ".blabel{font-size:11px;color:#999;margin-bottom:6px;}" +
        ".bst{font-size:11px;padding:2px 8px;border-radius:8px;color:#fff;display:inline-block;}" +
        ".bst.ok{background:#059669;}.bst.no{background:#dc2626;}.bst.warn{background:#d97706;}" +
        ".pieces{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;}" +
        ".pieces span{font-size:10px;padding:2px 6px;border-radius:6px;font-family:monospace;}" +
        ".pieces .hit{background:#d1fae5;color:#059669;}" +
        ".pieces .miss{background:#fee2e2;color:#dc2626;}" +
        ".fix{background:#fff8f0;border:1px solid #fed7aa;border-radius:8px;padding:8px;margin:6px 0;}" +
        ".fix .frow{display:flex;align-items:center;gap:4px;font-size:11px;margin:2px 0;font-family:monospace;flex-wrap:wrap;}" +
        ".fix .fwrong{background:#fee2e2;color:#dc2626;padding:1px 4px;border-radius:4px;text-decoration:line-through;}" +
        ".fix .farrow{color:#999;}" +
        ".fix .fright{background:#d1fae5;color:#059669;padding:1px 4px;border-radius:4px;}" +
        "textarea{width:100%;min-height:120px;border:1px solid #f0d0d8;border-radius:8px;padding:8px;font-size:11px;font-family:monospace;outline:none;resize:vertical;line-height:1.5;}" +
        "textarea:focus{border-color:#ff6b9d;}" +
        "pre{background:#f8f5f6;border-radius:8px;padding:8px;font-size:10px;font-family:monospace;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow-y:auto;color:#555;}" +
        ".btns{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}" +
        ".btns button{flex:1;min-width:80px;height:36px;border:none;border-radius:10px;font-size:12px;cursor:pointer;color:#fff;}" +
        ".btns button:active{opacity:.7;}" +
        ".bfix{background:linear-gradient(135deg,#f59e0b,#d97706);}" +
        ".btest{background:linear-gradient(135deg,#60a5fa,#3b82f6);}" +
        ".bsave{background:linear-gradient(135deg,#34d399,#059669);}" +
        ".breset{background:#ddd;color:#888!important;}" +
        ".info{text-align:center;padding:30px;color:#ccc;font-size:12px;}" +
        ".msg{text-align:center;padding:6px;font-size:11px;min-height:20px;flex-shrink:0;}";
    shadow.appendChild(styleEl);

    var ov = document.createElement("div"); ov.className = "ov"; shadow.appendChild(ov);
    var fab = document.createElement("div"); fab.className = "fab"; fab.innerHTML = "&#x1F430;"; shadow.appendChild(fab);
    var panel = document.createElement("div"); panel.className = "pnl";
    panel.innerHTML =
        '<div class="hdr"><span class="htitle">🔧 正则调试</span></div>' +
        '<div class="body" id="bny-body">' +
        '<div class="sel"><label>选择要调试的正则：</label><select id="bny-sel"><option value="">-- 请选择 --</option></select></div>' +
        '<div id="bny-content"><div class="info">👆 请先选择一条正则</div></div>' +
        '</div>' +
        '<div class="msg" id="bny-msg"></div>';
    shadow.appendChild(panel);

    var selEl = panel.querySelector("#bny-sel");
    var contentEl = panel.querySelector("#bny-content");
    var msgEl = panel.querySelector("#bny-msg");
    var panelOpen = false;
    var cachedRegex = [];

    panel.addEventListener("touchstart", function (e) { e.stopPropagation(); });
    panel.addEventListener("touchmove", function (e) { e.stopPropagation(); });
    panel.addEventListener("touchend", function (e) { e.stopPropagation(); });
    panel.addEventListener("mousedown", function (e) { e.stopPropagation(); });ov.addEventListener("click", function () { closeP(); });ov.addEventListener("touchstart", function (e) { e.preventDefault(); closeP(); });

    function populateSelect() {
        cachedRegex = getActiveRegex();
        selEl.innerHTML = '<option value="">-- 请选择（' + cachedRegex.length + '条启用）--</option>';
        for (var i = 0; i < cachedRegex.length; i++) {
            var opt = document.createElement("option");
            opt.value = String(i);
            opt.textContent = "[" + cachedRegex[i].source + "] " + cachedRegex[i].name;
            selEl.appendChild(opt);
        }
    }

    selEl.addEventListener("change", function (e) {
        e.stopPropagation();
        if (selEl.value === "") { contentEl.innerHTML = '<div class="info">👆 请先选择一条正则</div>'; return; }
        runAnalysis(parseInt(selEl.value));
    });
    selEl.addEventListener("mousedown", function (e) { e.stopPropagation(); });
    selEl.addEventListener("touchstart", function (e) { e.stopPropagation(); });

    function runAnalysis(idx) {
        var rx = cachedRegex[idx];
        var lastMsg = getLastAIMsg();
        if (!lastMsg) { contentEl.innerHTML = '<div class="info">❌ 没有AI消息</div>'; return; }

        var pieces = extractSkeleton(rx.findRegex);
        var reg = parseRegex(rx.findRegex);
        var directMatch = false;
        if (reg) { directMatch = reg.test(lastMsg.mes); if (reg.global) reg.lastIndex = 0; }

        var found = fuzzyFind(lastMsg.mes, pieces);
        var tLow = lastMsg.mes.toLowerCase();
        var hitPieces = [];
        var missPieces = [];
        for (var pi = 0; pi < pieces.length; pi++) {
            if (tLow.indexOf(pieces[pi].toLowerCase()) !== -1) hitPieces.push(pieces[pi]);
            else missPieces.push(pieces[pi]);
        }

        var fixes = [];
        if (found && !directMatch) {
            for (var fi = 0; fi < missPieces.length; fi++) {
                var wv = findWrongVersion(found.text, missPieces[fi]);
                if (wv) fixes.push(wv);
            }
        }

        var statusHtml;
        if (directMatch) statusHtml = '<span class="bst ok">✅ 正则匹配成功，无需修复</span>';
        else if (found && found.score >= Math.ceil(found.total * 0.3)) statusHtml = '<span class="bst warn">⚠️ 未匹配，找到相似段落（' + found.score + '/' + found.total + '）</span>';
        else statusHtml = '<span class="bst no">❌ 未找到相似内容</span>';

        var html = '<div class="box"><div class="blabel">📊 ' + statusHtml + '</div>';

        html += '<div class="blabel" style="margin-top:6px;">🧩 骨架碎片：</div><div class="pieces">';
        for (var hi = 0; hi < hitPieces.length; hi++) {
            varhs = document.createElement("span"); hs.className = "hit"; hs.textContent = "✓" + hitPieces[hi];
            html += hs.outerHTML;
        }
        for (var mi = 0; mi < missPieces.length; mi++) {
            var ms = document.createElement("span"); ms.className = "miss"; ms.textContent = "✗" + missPieces[mi];
            html += ms.outerHTML;
        }
        html += '</div></div>';

        if (fixes.length > 0) {
            html += '<div class="box"><div class="blabel">🔧 发现 ' + fixes.length + ' 处可自动修复：</div>';
            for (var fxi = 0; fxi < fixes.length; fxi++) {
                var ws = document.createElement("span"); ws.className = "fwrong"; ws.textContent = fixes[fxi].wrongText;
                var rs = document.createElement("span"); rs.className = "fright"; rs.textContent = fixes[fxi].correctText;
                html += '<div class="fix"><div class="frow">' + ws.outerHTML + '<span class="farrow"> → </span>' + rs.outerHTML + '</div></div>';
            }
            html += '</div>';
        }

        html += '<div class="box"><div class="blabel">📍 问题段落（可手动编辑）：</div><textarea id="bny-edit"></textarea></div>';
        html += '<div class="btns">';
        if (fixes.length > 0) html += '<button class="bfix" id="bny-autofix">⚡ 一键修复（' + fixes.length + '处）</button>';
        html += '<button class="btest" id="bny-test">▶️ 测试</button>';
        html += '<button class="bsave" id="bny-save">💾 保存到正文</button>';
        html += '<button class="breset" id="bny-reset">🔄 重置</button>';
        html += '</div><div id="bny-result"></div>';

        contentEl.innerHTML = html;

        var editEl = contentEl.querySelector("#bny-edit");
        editEl.value = found ? found.text : "";
        ["keydown", "keyup", "keypress", "input", "touchstart", "touchmove"].forEach(function (ev) {
            editEl.addEventListener(ev, function (e) { e.stopPropagation(); });
        });

        var autoBtn = contentEl.querySelector("#bny-autofix");
        if (autoBtn) {
            autoBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                var txt = editEl.value;
                var sorted = fixes.slice().sort(function (a, b) { return b.start - a.start; });
                for (var si = 0; si < sorted.length; si++) {
                    var f = sorted[si];
                    var before = txt.substring(0, f.start);
                    var after = txt.substring(f.end);
                    txt = before + f.correctText + after;
                }
                editEl.value = txt;msgEl.textContent = "⚡ 已自动修复 " + fixes.length + " 处！请点测试确认";
            });
        }

        contentEl.querySelector("#bny-test").addEventListener("click", function (e) {
            e.stopPropagation();
            var edited = editEl.value;
            var testReg = parseRegex(rx.findRegex);
            var ok = testReg ? testReg.test(edited) : false;
            if (testReg && testReg.global) testReg.lastIndex = 0;
            var resEl = contentEl.querySelector("#bny-result");
            if (ok) {
                var replaced = edited;
                try { var rr = parseRegex(rx.findRegex); replaced = edited.replace(rr, rx.replaceString); } catch (er) {}
                resEl.innerHTML = '<div class="box" style="margin-top:8px;"><div class="blabel"><span class="bst ok">✅ 匹配成功！</span></div><div class="blabel">替换后预览：</div><pre id="bny-prev"></pre></div>';
                contentEl.querySelector("#bny-prev").textContent = replaced.substring(0, 800);
            } else {
                resEl.innerHTML = '<div class="box" style="margin-top:8px;"><div class="blabel"><span class="bst no">❌ 仍不匹配</span></div><div style="font-size:10px;color:#999;padding:4px;">继续调整后再试</div></div>';
            }
            msgEl.textContent = ok ? "✅ 匹配成功" : "❌ 仍未匹配";
        });

        contentEl.querySelector("#bny-save").addEventListener("click", function (e) {
            e.stopPropagation();
            if (!found) { msgEl.textContent = "❌ 没有段落"; return; }
            var edited = editEl.value;
            var newMes = lastMsg.mes.substring(0, found.start) + edited + lastMsg.mes.substring(found.end);
            if (saveMsg(lastMsg.idx, newMes)) msgEl.textContent = "✅ 已保存到正文！下滑刷新查看";
            else msgEl.textContent = "❌ 保存失败";
        });

        contentEl.querySelector("#bny-reset").addEventListener("click", function (e) {
            e.stopPropagation();
            editEl.value = found ? found.text : "";
            contentEl.querySelector("#bny-result").innerHTML = "";
            msgEl.textContent = "🔄 已重置";
        });
    }

    var posX = 100, posY = 300;
    function posPanel() {
        var pw = Math.min(window.innerWidth * 0.92, 440), ph = Math.min(window.innerHeight * 0.8, 700);
        var left = posX +26- pw / 2; if (left < 5) left = 5; if (left + pw > window.innerWidth - 5) left = window.innerWidth - 5 - pw;
        var top = posY - 10 - ph > 5 ? posY - 10 - ph : posY + 62; if (top + ph > window.innerHeight - 5) top = window.innerHeight - 5 - ph;
        panel.style.left = left + "px"; panel.style.top = top + "px"; panel.style.width = pw + "px"; panel.style.height = ph + "px";
    }
    function openP() { posPanel(); panel.style.display = "flex"; ov.style.display = "block"; panelOpen = true; populateSelect(); }
    function closeP() { panel.style.display = "none"; ov.style.display = "none"; panelOpen = false; }
    function toggleP() { if (panelOpen) closeP(); else openP(); }

    var dragging = false, hasMoved = false, startX = 0, startY = 0;
    function moveTo(x, y) { posX = Math.max(0, Math.min(x, window.innerWidth - 52)); posY = Math.max(0, Math.min(y, window.innerHeight - 52)); fab.style.left = posX + "px"; fab.style.top = posY + "px"; if (panelOpen) posPanel(); }
    fab.addEventListener("touchstart", function (e) { e.preventDefault(); e.stopImmediatePropagation(); dragging = true; hasMoved = false; startX = e.touches[0].clientX - posX; startY = e.touches[0].clientY - posY; }, { passive: false });
    fab.addEventListener("touchmove", function (e) { e.preventDefault(); e.stopImmediatePropagation(); if (dragging) { hasMoved = true; moveTo(e.touches[0].clientX - startX, e.touches[0].clientY - startY); } }, { passive: false });
    fab.addEventListener("touchend", function (e) { e.preventDefault(); e.stopImmediatePropagation(); var wm = hasMoved; dragging = false; hasMoved = false; if (!wm) setTimeout(toggleP, 50); else { localStorage.setItem("bnyPosX", posX); localStorage.setItem("bnyPosY", posY); } }, { passive: false });
    fab.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopImmediatePropagation(); dragging = true; hasMoved = false; startX = e.clientX - posX; startY = e.clientY - posY; });
    document.addEventListener("mousemove", function (e) { if (dragging) { hasMoved = true; moveTo(e.clientX - startX, e.clientY - startY); } });
    document.addEventListener("mouseup", function () { if (!dragging) return; var wm = hasMoved; dragging = false; hasMoved = false; if (!wm) toggleP(); else { localStorage.setItem("bnyPosX", posX); localStorage.setItem("bnyPosY", posY); } });

    function showFab() { var sx = localStorage.getItem("bnyPosX"), sy = localStorage.getItem("bnyPosY"); if (sx && sy) { posX = parseInt(sx); posY = parseInt(sy); } moveTo(posX, posY); fab.style.display = "block"; }
    function hideFab() { fab.style.display = "none"; closeP(); }
    if (localStorage.getItem("bnyShow") === "1") { $("#bny-toggle").prop("checked", true); showFab(); $("#bny-status").text("Bunny is visible!"); }
    $("#bny-toggle").on("change", function () { var on = $(this).prop("checked"); if (on) { showFab(); $("#bny-status").text("Bunny is visible!"); } else { hideFab(); $("#bny-status").text("Bunny is hidden"); } localStorage.setItem("bnyShow", on ? "1" : "0"); });
});
