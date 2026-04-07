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

    function getAllRegex() {
        var result = [];
        try {
            var ctx = SillyTavern.getContext();
            var gr = ctx.extensionSettings.regex || [];
            for (var i = 0; i < gr.length; i++) {
                result.push({
                    source: "全局",
                    id: gr[i].id,
                    name: gr[i].scriptName || "未命名",
                    disabled: gr[i].disabled,
                    findRegex: gr[i].findRegex || "",
                    replaceString: gr[i].replaceString || "",
                    placement: gr[i].placement || [],
                    markdownOnly: !!gr[i].markdownOnly,
                    promptOnly: !!gr[i].promptOnly
                });
            }
            if (ctx.characters && ctx.characterId !== undefined) {
                var ch = ctx.characters[ctx.characterId];
                if (ch && ch.data && ch.data.extensions && ch.data.extensions.regex_scripts) {
                    var cr = ch.data.extensions.regex_scripts;
                    for (var j = 0; j < cr.length; j++) {
                        result.push({
                            source: "角色卡",
                            id: cr[j].id,
                            name: cr[j].scriptName || "未命名",
                            disabled: cr[j].disabled,
                            findRegex: cr[j].findRegex || "",
                            replaceString: cr[j].replaceString || "",
                            placement: cr[j].placement || [],
                            markdownOnly: !!cr[j].markdownOnly,
                            promptOnly: !!cr[j].promptOnly
                        });
                    }
                }
            }
        } catch (e) {}
        return result;
    }

    function getLastAIMsg() {
        try {
            var ctx = SillyTavern.getContext();
            var chat = ctx.chat;
            for (var i = chat.length - 1; i >= 0; i--) {
                if (!chat[i].is_user) return { idx: i, mes: chat[i].mes, name: chat[i].name };
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

    function testRegex(fr, text) {
        var reg = parseRegex(fr);
        if (!reg) return { err: "正则语法错误", matches: [] };
        var matches = [];
        var mx;
        if (reg.global) {
            while ((mx = reg.exec(text)) !== null) {
                matches.push({ pos: mx.index, text: mx[0].substring(0, 200) });
                if (mx.index === reg.lastIndex) reg.lastIndex++;
                if (matches.length > 50) break;
            }
        } else {
            mx = reg.exec(text);
            if (mx) matches.push({ pos: mx.index, text: mx[0].substring(0, 200) });
        }
        return { err: null, matches: matches };
    }

    function replaceInMsg(idx, oldText, newText) {
        try {
            var ctx = SillyTavern.getContext();
            ctx.chat[idx].mes = ctx.chat[idx].mes.replace(oldText, newText);
            ctx.saveChat();
            ctx.reloadCurrentChat();
            return true;
        } catch (e) { return false; }
    }

    function placementText(p) {
        var map = { 0: "用户输入", 1: "AI输出", 2: "AI显示", 3: "世界书", 4: "提示词" };
        var arr = [];
        for (var i = 0; i < p.length; i++) { arr.push(map[p[i]] || ("未知" + p[i])); }
        return arr.join(", ") || "未设置";
    }

    /* Shadow DOM */
    var host = document.createElement("div");
    host.id = "bny-host";
    host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;";
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: "open" });

    var styleEl = document.createElement("style");
    styleEl.textContent =
        "*{box-sizing:border-box;margin:0;padding:0;}" +
        "::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#e0c0c8;border-radius:4px;}" +
        ".overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1;pointer-events:auto;display:none;background:rgba(0,0,0,.2);}" +
        ".fab{position:fixed;width:52px;height:52px;font-size:24px;line-height:52px;text-align:center;border-radius:50%;background:linear-gradient(135deg,#ff6b9d,#c44569);color:#fff;border:2px solid rgba(255,255,255,.3);cursor:pointer;box-shadow:0 4px 15px rgba(255,107,157,.5);display:none;touch-action:none;user-select:none;-webkit-user-select:none;pointer-events:auto;transition:transform .15s;z-index:10;}" +
        ".fab:active{transform:scale(.9);}" +
        ".pnl{position:fixed;width:92vw;max-width:440px;height:80vh;max-height:700px;background:#fffafc;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;pointer-events:auto;border:1px solid #fde2e8;z-index:5;}" +
        ".hdr{display:flex;align-items:center;padding:12px 14px;background:linear-gradient(135deg,#ff6b9d,#c44569);color:#fff;font-size:14px;font-weight:bold;gap:8px;flex-shrink:0;}" +
        ".hdr .htitle{flex:1;}" +
        ".hdr .hbtn{background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:8px;padding:6px 10px;font-size:11px;cursor:pointer;}" +
        ".hdr .hbtn:active{opacity:.7;}" +
        ".fbar{display:flex;padding:8px 10px;background:#fff;border-bottom:1px solid #fde2e8;gap:6px;flex-shrink:0;}" +
        ".fbar input{flex:1;height:32px;border:1px solid #f0d0d8;border-radius:16px;padding:0 12px;font-size:12px;outline:none;background:#fffafc;}" +
        ".fbar input:focus{border-color:#ff6b9d;}" +
        ".fbar select{height:32px;border:1px solid #f0d0d8;border-radius:16px;padding:0 8px;font-size:11px;outline:none;background:#fffafc;color:#666;}" +
        ".rlist{flex:1;overflow-y:auto;}" +
        ".ri{display:flex;align-items:center;padding:10px 12px;gap:8px;border-bottom:1px solid #f8f0f2;cursor:pointer;transition:background .15s;}" +
        ".ri:active{background:#fff5f8;}" +
        ".ri.sel{background:#fff0f5;border-left:3px solid #ff6b9d;}" +
        ".ri .rtag{font-size:9px;padding:2px 6px;border-radius:8px;flex-shrink:0;color:#fff;}" +
        ".ri .rtag.global{background:#a855f7;}" +
        ".ri .rtag.char{background:#3b82f6;}" +
        ".ri .rname{flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
        ".ri .rname.on{color:#333;}" +
        ".ri .rname.off{color:#bbb;text-decoration:line-through;}" +
        ".ri .rstatus{font-size:18px;flex-shrink:0;}" +
        ".detail{flex:1;display:none;flex-direction:column;overflow:hidden;}" +
        ".detail.on{display:flex;}" +
        ".dback{display:flex;align-items:center;padding:10px 12px;background:#f9f0f3;border-bottom:1px solid #fde2e8;cursor:pointer;gap:6px;flex-shrink:0;}" +
        ".dback:active{background:#f0e0e6;}" +
        ".dback .darr{color:#c44569;font-size:14px;}" +
        ".dback .dname{flex:1;font-size:13px;color:#c44569;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
        ".dinfo{padding:10px 12px;background:#fff;border-bottom:1px solid #f8f0f2;flex-shrink:0;}" +
        ".dinfo .drow{display:flex;gap:6px;padding:3px 0;font-size:11px;}" +
        ".dinfo .dlabel{color:#999;flex-shrink:0;width:60px;}" +
        ".dinfo .dval{color:#555;flex:1;word-break:break-all;}" +
        ".dresult{padding:10px 12px;background:#f9fdf9;border-bottom:1px solid #e8f0e8;flex-shrink:0;}" +
        ".dresult.fail{background:#fdf5f5;border-color:#f0e0e0;}" +
        ".dresult .dtitle{font-size:12px;font-weight:bold;margin-bottom:6px;}" +
        ".dresult .dtitle.ok{color:#059669;}" +
        ".dresult .dtitle.no{color:#dc2626;}" +
        ".dmatch{background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:8px;margin:4px 0;font-size:11px;}" +
        ".dmatch .mpos{color:#999;font-size:10px;}" +
        ".dmatch .mtxt{color:#333;word-break:break-all;white-space:pre-wrap;margin-top:2px;}" +
        ".dmatch .mtxt mark{background:#fde68a;color:#333;padding:0 1px;border-radius:2px;}" +
        ".dedit{padding:10px 12px;flex:1;overflow-y:auto;}" +
        ".dedit .elabel{font-size:11px;color:#999;padding:4px 0;}" +
        ".dedit textarea{width:100%;min-height:80px;border:1px solid #f0d0d8;border-radius:8px;padding:8px;font-size:11px;outline:none;font-family:monospace;resize:vertical;}" +
        ".dedit textarea:focus{border-color:#ff6b9d;}" +
        ".dbar{display:flex;gap:6px;padding:8px 12px;background:#fff;border-top:1px solid #fde2e8;flex-shrink:0;}" +
        ".dbar .dbtn{flex:1;height:36px;border:none;border-radius:10px;font-size:12px;cursor:pointer;color:#fff;}" +
        ".dbar .dbtn:active{opacity:.7;}" +
        ".dbar .dbtn.green{background:linear-gradient(135deg,#34d399,#059669);}" +
        ".dbar .dbtn.pink{background:linear-gradient(135deg,#ff6b9d,#c44569);}" +
        ".dbar .dbtn.gray{background:#e0d5d8;color:#888;}" +
        ".dbar .dbtn.blue{background:linear-gradient(135deg,#60a5fa,#3b82f6);}" +
        ".dbar .dbtn.red{background:linear-gradient(135deg,#f87171,#dc2626);}" +
        ".pmsg{text-align:center;padding:6px;font-size:11px;color:#888;flex-shrink:0;min-height:24px;}" +
        ".empty{text-align:center;padding:30px;color:#ccc;font-size:12px;line-height:1.8;}";
    shadow.appendChild(styleEl);

    var overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.addEventListener("click", function () { closeP(); });
    overlay.addEventListener("touchstart", function (e) { e.preventDefault(); closeP(); });
    shadow.appendChild(overlay);

    var fab = document.createElement("div");
    fab.className = "fab";
    fab.innerHTML = "&#x1F430;";
    shadow.appendChild(fab);

    var panel = document.createElement("div");
    panel.className = "pnl";
    panel.innerHTML =
        '<div class="hdr"><span class="htitle">🔧 正则调试</span><button class="hbtn" id="bny-refresh">🔄 刷新</button></div>' +
        '<div class="fbar"><input type="text" id="bny-filter" placeholder="🔍 搜索正则名称..." /><select id="bny-source"><option value="all">全部</option><option value="global">全局</option><option value="char">角色卡</option></select></div>' +
        '<div class="rlist" id="bny-rlist"></div>' +
        '<div class="detail" id="bny-detail"></div>' +
        '<div class="pmsg" id="bny-msg"></div>';
    shadow.appendChild(panel);

    var filterInput = panel.querySelector("#bny-filter");
    var sourceSelect = panel.querySelector("#bny-source");
    var rlistEl = panel.querySelector("#bny-rlist");
    var detailEl = panel.querySelector("#bny-detail");
    var msgEl = panel.querySelector("#bny-msg");
    var refreshBtn = panel.querySelector("#bny-refresh");

    var panelOpen = false;
    var currentView = "list";
    var selectedRegex = null;

    filterInput.addEventListener("input", function (e) { e.stopPropagation(); renderList(); });
    filterInput.addEventListener("keydown", function (e) { e.stopPropagation(); });
    filterInput.addEventListener("keyup", function (e) { e.stopPropagation(); });
    filterInput.addEventListener("keypress", function (e) { e.stopPropagation(); });
    sourceSelect.addEventListener("change", function (e) { e.stopPropagation(); renderList(); });
    refreshBtn.addEventListener("click", function (e) { e.stopPropagation(); renderList(); msgEl.textContent = "🔄 已刷新"; });

    panel.addEventListener("touchstart", function (e) { e.stopPropagation(); });
    panel.addEventListener("touchmove", function (e) { e.stopPropagation(); });
    panel.addEventListener("touchend", function (e) { e.stopPropagation(); });
    panel.addEventListener("mousedown", function (e) { e.stopPropagation(); });

    function renderList() {
        currentView = "list";
        rlistEl.style.display = "block";
        detailEl.style.display = "none";
        detailEl.className = "detail";

        var allR = getAllRegex();
        var filter = filterInput.value.trim().toLowerCase();
        var src = sourceSelect.value;
        var lastMsg = getLastAIMsg();

        rlistEl.innerHTML = "";
        var count = 0;
        var matchCount = 0;

        for (var i = 0; i < allR.length; i++) {
            (function (rx, idx) {
                if (filter && rx.name.toLowerCase().indexOf(filter) === -1) return;
                if (src === "global" && rx.source !== "全局") return;
                if (src === "char" && rx.source !== "角色卡") return;

                var hasMarkdown = rx.placement.indexOf(2) !== -1 || rx.placement.indexOf(1) !== -1;
                var matched = false;
                var matchNum = 0;

                if (lastMsg && hasMarkdown && !rx.disabled) {
                    var tr = testRegex(rx.findRegex, lastMsg.mes);
                    if (!tr.err && tr.matches.length > 0) {
                        matched = true;
                        matchNum = tr.matches.length;
                        matchCount++;
                    }
                }

                var row = document.createElement("div");
                row.className = "ri";

                var tag = document.createElement("span");
                tag.className = "rtag " + (rx.source === "全局" ? "global" : "char");
                tag.textContent = rx.source;

                var name = document.createElement("span");
                name.className = "rname " + (rx.disabled ? "off" : "on");
                name.textContent = rx.name;

                var status = document.createElement("span");
                status.className = "rstatus";
                if (rx.disabled) {
                    status.textContent = "⏸️";
                } else if (matched) {
                    status.textContent = "✅" + matchNum;
                } else if (hasMarkdown && lastMsg) {
                    status.textContent = "❌";
                } else {
                    status.textContent = "➖";
                }

                row.appendChild(tag);
                row.appendChild(name);
                row.appendChild(status);

                row.addEventListener("click", function (e) {
                    e.stopPropagation();
                    selectedRegex = rx;
                    renderDetail();
                });

                rlistEl.appendChild(row);
                count++;
            })(allR[i], i);
        }

        if (count === 0) {
            rlistEl.innerHTML = '<div class="empty">没有找到正则<br/>试试切换筛选条件</div>';
        }msgEl.textContent = "共 " + count + " 条正则，" + matchCount + " 条匹配到最新消息";
    }
    function renderDetail() {
        currentView = "detail";
        rlistEl.style.display = "none";
        detailEl.style.display = "flex";
        detailEl.className = "detail on";

        var rx = selectedRegex;
        var lastMsg = getLastAIMsg();
        var tr = lastMsg ? testRegex(rx.findRegex, lastMsg.mes) : { err: "没有AI消息", matches: [] };

        var matchHtml = "";
        if (tr.err) {
            matchHtml = '<div class="dresult fail"><div class="dtitle no">⚠️ ' + tr.err + '</div></div>';
        } else if (tr.matches.length === 0) {
            matchHtml = '<div class="dresult fail"><div class="dtitle no">❌ 未匹配到内容</div><div style="font-size:11px;color:#999;padding:4px 0;">正则没有在最新AI消息中找到匹配项</div></div>';
        } else {
            matchHtml = '<div class="dresult"><div class="dtitle ok">✅ 匹配到 ' + tr.matches.length + ' 处</div>';
            for (var mi = 0; mi < Math.min(tr.matches.length, 10); mi++) {
                var mt = tr.matches[mi];
                var displayText = mt.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                matchHtml += '<div class="dmatch"><div class="mpos">位置: ' + mt.pos + '</div><div class="mtxt"><mark>' + displayText + '</mark></div></div>';
            }
            if (tr.matches.length > 10) matchHtml += '<div style="font-size:11px;color:#999;text-align:center;padding:4px;">还有 ' + (tr.matches.length - 10) + ' 处匹配...</div>';
            matchHtml += '</div>';
        }

        var previewText = "";
        if (lastMsg) {
            previewText = lastMsg.mes.substring(0, 500).replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        detailEl.innerHTML =
            '<div class="dback" id="bny-back"><span class="darr">← </span><span class="dname">' + rx.name + '</span></div>' +
            '<div class="dinfo">' +
            '<div class="drow"><span class="dlabel">来源</span><span class="dval">' + rx.source + '</span></div>' +
            '<div class="drow"><span class="dlabel">状态</span><span class="dval">' + (rx.disabled ? "⏸️ 已禁用" : "▶️ 启用中") + '</span></div>' +
            '<div class="drow"><span class="dlabel">作用于</span><span class="dval">' + placementText(rx.placement) + '</span></div>' +
            '<div class="drow"><span class="dlabel">查找</span><span class="dval" style="font-family:monospace;font-size:10px;">' + rx.findRegex.substring(0, 200).replace(/</g, "&lt;") + '</span></div>' +
            '<div class="drow"><span class="dlabel">替换</span><span class="dval" style="font-family:monospace;font-size:10px;">' + (rx.replaceString || "(空)").substring(0, 200).replace(/</g, "&lt;") + '</span></div>' +
            '</div>' +
            matchHtml +
            '<div class="dedit">' +
            '<div class="elabel">📝 最新AI消息预览（前500字）：</div>' +
            '<textarea id="bny-edit" readonly>' + (previewText || "没有AI消息") + '</textarea>' +
            '</div>' +
            '<div class="dbar">' +
            '<button class="dbtn blue" id="bny-copyFind">📋 复制查找</button>' +
            '<button class="dbtn green" id="bny-testEdit">🔧 手动测试</button>' +
            '<button class="dbtn gray" id="bny-back2">← 返回</button>' +
            '</div>';

        detailEl.querySelector("#bny-back").addEventListener("click", function (e) { e.stopPropagation(); renderList(); });
        detailEl.querySelector("#bny-back2").addEventListener("click", function (e) { e.stopPropagation(); renderList(); });

        detailEl.querySelector("#bny-copyFind").addEventListener("click", function (e) {
            e.stopPropagation();
            try {
                navigator.clipboard.writeText(rx.findRegex);
                msgEl.textContent = "✅ 已复制查找正则";
            } catch (err) {
                msgEl.textContent = "❌ 复制失败";
            }
        });

        detailEl.querySelector("#bny-testEdit").addEventListener("click", function (e) {
            e.stopPropagation();
            renderManualTest();
        });

        var editArea = detailEl.querySelector("#bny-edit");
        editArea.addEventListener("touchstart", function (e) { e.stopPropagation(); });
        editArea.addEventListener("touchmove", function (e) { e.stopPropagation(); });
        editArea.addEventListener("keydown", function (e) { e.stopPropagation(); });}

    function renderManualTest() {
        currentView = "test";
        var rx = selectedRegex;
        var lastMsg = getLastAIMsg();
        var msgText = lastMsg ? lastMsg.mes : "";

        detailEl.innerHTML =
            '<div class="dback" id="bny-tback"><span class="darr">← </span><span class="dname">手动测试：' + rx.name + '</span></div>' +
            '<div class="dedit" style="flex:1;overflow-y:auto;">' +
            '<div class="elabel">📐 查找正则（可修改测试）：</div>' +
            '<textarea id="bny-tfind" style="min-height:50px;">' + rx.findRegex.replace(/</g, "&lt;") + '</textarea>' +
            '<div class="elabel">📝 替换内容（可修改测试）：</div>' +
            '<textarea id="bny-treplace" style="min-height:40px;">' + (rx.replaceString || "").replace(/</g, "&lt;") + '</textarea>' +
            '<div class="elabel">📄 消息文本（可编辑）：</div>' +
            '<textarea id="bny-ttext" style="min-height:120px;">' + msgText.replace(/</g, "&lt;") + '</textarea>' +
            '<div class="elabel">🔎 测试结果：</div>' +
            '<div id="bny-tresult" style="background:#f5f5f5;border-radius:8px;padding:8px;font-size:11px;min-height:40px;word-break:break-all;white-space:pre-wrap;"></div>' +
            '<div class="elabel">📄 替换后预览：</div>' +
            '<div id="bny-tpreview" style="background:#f0fdf4;border-radius:8px;padding:8px;font-size:11px;min-height:40px;word-break:break-all;white-space:pre-wrap;"></div>' +
            '</div>' +
            '<div class="dbar">' +
            '<button class="dbtn pink" id="bny-trun">▶️ 运行测试</button>' +
            '<button class="dbtn green" id="bny-tapply">💾 替换到正文</button>' +
            '<button class="dbtn gray" id="bny-tback2">← 返回</button>' +
            '</div>';

        detailEl.querySelector("#bny-tback").addEventListener("click", function (e) { e.stopPropagation(); renderDetail(); });
        detailEl.querySelector("#bny-tback2").addEventListener("click", function (e) { e.stopPropagation(); renderDetail(); });

        var findEl = detailEl.querySelector("#bny-tfind");
        var replaceEl = detailEl.querySelector("#bny-treplace");
        var textEl = detailEl.querySelector("#bny-ttext");
        var resultEl = detailEl.querySelector("#bny-tresult");
        var previewEl = detailEl.querySelector("#bny-tpreview");

        [findEl, replaceEl, textEl].forEach(function (el) {
            el.addEventListener("keydown", function (e) { e.stopPropagation(); });
            el.addEventListener("keyup", function (e) { e.stopPropagation(); });
            el.addEventListener("keypress", function (e) { e.stopPropagation(); });el.addEventListener("input", function (e) { e.stopPropagation(); });
            el.addEventListener("touchstart", function (e) { e.stopPropagation(); });
            el.addEventListener("touchmove", function (e) { e.stopPropagation(); });});

        detailEl.querySelector("#bny-trun").addEventListener("click", function (e) {
            e.stopPropagation();
            var findStr = findEl.value;
            var replStr = replaceEl.value;
            var text = textEl.value;

            var tr = testRegex(findStr, text);
            if (tr.err) {
                resultEl.textContent = "⚠️ " + tr.err;
                previewEl.textContent = "";
                return;
            }
            if (tr.matches.length === 0) {
                resultEl.textContent = "❌ 没有匹配项";
                previewEl.textContent = text.substring(0, 500);
                return;
            }

            var info = "✅ 匹配到 " + tr.matches.length + " 处：\n";
            for (var ri = 0; ri < Math.min(tr.matches.length, 5); ri++) {
                info += "\n[" + (ri + 1) + "] 位置" + tr.matches[ri].pos + ":\n" + tr.matches[ri].text + "\n";
            }
            resultEl.textContent = info;

            try {
                var reg = parseRegex(findStr);
                var replaced = text.replace(reg, replStr);
                previewEl.textContent = replaced.substring(0, 500);
            } catch (err) {
                previewEl.textContent = "替换出错: " + err.message;
            }

            msgEl.textContent = "✅ 测试完成，匹配 " + tr.matches.length + " 处";
        });

        detailEl.querySelector("#bny-tapply").addEventListener("click", function (e) {
            e.stopPropagation();
            if (!lastMsg) { msgEl.textContent = "❌ 没有AI消息"; return; }
            var text = textEl.value;
            try {
                var ctx = SillyTavern.getContext();
                ctx.chat[lastMsg.idx].mes = text;
                ctx.saveChat();
                ctx.reloadCurrentChat();
                msgEl.textContent = "✅ 已替换到正文并保存！";
            } catch (err) {
                msgEl.textContent = "❌ 替换失败: " + err.message;
            }
        });
    }

    /* FAB 拖拽 */
    var posX = 100;
    var posY = 300;

    function posPanel() {
        var pw = Math.min(window.innerWidth * 0.92, 440);
        var ph = Math.min(window.innerHeight * 0.8, 700);
        var left = posX +26- pw / 2;
        if (left < 5) left = 5;
        if (left + pw > window.innerWidth - 5) left = window.innerWidth - 5 - pw;
        var top;
        if (posY -10 - ph > 5) { top = posY - 10 - ph; }
        else { top = posY + 62; if (top + ph > window.innerHeight - 5) top = window.innerHeight - 5 - ph; }
        panel.style.left = left + "px";
        panel.style.top = top + "px";
        panel.style.width = pw + "px";
        panel.style.height = ph + "px";
    }

    function openP() {
        posPanel();
        panel.style.display = "flex";
        overlay.style.display = "block";panelOpen = true;
        renderList();
    }
    function closeP() {
        panel.style.display = "none";
        overlay.style.display = "none";
        panelOpen = false;
    }
    function toggleP() { if (panelOpen) closeP(); else openP(); }

    var dragging = false;
    var hasMoved = false;
    var startX = 0;
    var startY = 0;

    function moveTo(x, y) {
        var mx = window.innerWidth - 52;
        var my = window.innerHeight - 52;
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > mx) x = mx;
        if (y > my) y = my;
        posX = x;
        posY = y;
        fab.style.left = x + "px";
        fab.style.top = y + "px";if (panelOpen) posPanel();
    }

    fab.addEventListener("touchstart", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dragging = true;
        hasMoved = false;
        var t = e.touches[0];
        startX = t.clientX - posX;
        startY = t.clientY - posY;
    }, { passive: false });

    fab.addEventListener("touchmove", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!dragging) return;
        hasMoved = true;
        var t = e.touches[0];
        moveTo(t.clientX - startX, t.clientY - startY);
    }, { passive: false });

    fab.addEventListener("touchend", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var wasDrag = dragging;
        var wasMoved = hasMoved;
        dragging = false;
        hasMoved = false;
        if (wasDrag && !wasMoved) setTimeout(function () { toggleP(); }, 50);
        if (wasDrag && wasMoved) {
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
        if (!dragging) return;
        hasMoved = true;
        moveTo(e.clientX - startX, e.clientY - startY);
    });

    document.addEventListener("mouseup", function () {
        if (!dragging) return;
        var wm = hasMoved;
        dragging = false;
        hasMoved = false;
        if (!wm) toggleP();
        else {
            localStorage.setItem("bnyPosX", String(posX));
            localStorage.setItem("bnyPosY", String(posY));
        }
    });

    function showFab() {
        var sx = localStorage.getItem("bnyPosX");
        var sy = localStorage.getItem("bnyPosY");
        if (sx !== null && sy !== null) { posX = parseInt(sx); posY = parseInt(sy); }
        moveTo(posX, posY);
        fab.style.display = "block";
    }
    function hideFab() { fab.style.display = "none"; closeP(); }

    var saved = localStorage.getItem("bnyShow");
    if (saved === "1") {
        $("#bny-toggle").prop("checked", true);
        showFab();
        $("#bny-status").text("Bunny is visible!");
    }
    $("#bny-toggle").on("change", function () {
        var on = $(this).prop("checked");
        if (on) { showFab(); $("#bny-status").text("Bunny is visible!"); }
        else { hideFab(); $("#bny-status").text("Bunny is hidden"); }
        localStorage.setItem("bnyShow", on ? "1" : "0");
    });
});
