jQuery(() => {
    var getContainer = function () {
        return $(document.getElementById("extensions_settings"));
    };

    getContainer().append(
        '<div class="inline-drawer">' +
            '<div class="inline-drawer-toggle inline-drawer-header">' +
                '<b>Bunny Game</b>' +
                '<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>' +
            '</div>' +
            '<div class="inline-drawer-content">' +
                '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:5px 0;">' +
                    '<input type="checkbox" id="bny-toggle" />' +
                    '<span>Show Bunny</span>' +
                '</label>' +
                '<div id="bny-status" style="padding:5px 0;font-size:12px;color:#888;">Bunny is hidden</div>' +
            '</div>' +
        '</div>'
    );

    var host = document.createElement("div");
    host.id = "bny-host";
    var hs = host.style;
    hs.setProperty("position", "fixed", "important");
    hs.setProperty("top", "0", "important");
    hs.setProperty("left", "0", "important");
    hs.setProperty("width", "0", "important");
    hs.setProperty("height", "0", "important");
    hs.setProperty("overflow", "visible", "important");
    hs.setProperty("z-index", "2147483647", "important");
    hs.setProperty("pointer-events", "none", "important");
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: "open" });

    var fab = document.createElement("div");
    fab.innerHTML = "&#x1F430;";
    fab.setAttribute("style", "position:fixed;width:52px;height:52px;font-size:24px;line-height:52px;text-align:center;border-radius:50%;background:linear-gradient(135deg,#ff6b9d,#c44569);color:white;border:2px solid rgba(255,255,255,0.3);cursor:pointer;box-shadow:0 4px 15px rgba(255,107,157,0.5);display:none;touch-action:none;user-select:none;-webkit-user-select:none;pointer-events:auto;transition:transform 0.3s ease;");
    shadow.appendChild(fab);

    var dragging = false;
    var hasMoved = false;
    var startX = 0;
    var startY = 0;
    var currentX = window.innerWidth - 62;
    var currentY = window.innerHeight - 200;
    var hideTimer = null;
    var isHidden = false;

    function setFabPos(x, y) {
        var maxX = window.innerWidth - 52;
        var maxY = window.innerHeight - 52;
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > maxX) x = maxX;
        if (y > maxY) y = maxY;
        currentX = x;
        currentY = y;
        fab.style.left = x + "px";
        fab.style.top = y + "px";
    }

    function isNearEdge() {
        var maxX = window.innerWidth - 52;
        return currentX <= 10 || currentX >= maxX - 10;
    }

    function hideToEdge() {
        if (!isNearEdge()) return;
        isHidden = true;
        var maxX = window.innerWidth - 52;
        if (currentX <= 10) {
            fab.style.transform = "translateX(-36px)";
        } else if (currentX >= maxX - 10) {
            fab.style.transform = "translateX(36px)";
        }
    }

    function showFromEdge() {
        isHidden = false;
        fab.style.transform = "translateX(0)";
        resetHideTimer();
    }

    function resetHideTimer() {
        if (hideTimer) clearTimeout(hideTimer);
        if (isNearEdge()) {
            hideTimer = setTimeout(hideToEdge, 3000);
        }
    }

    fab.addEventListener("touchstart", function (e) {
        if (isHidden) {
            showFromEdge();
            e.preventDefault();
            return;
        }
        dragging = true;
        hasMoved = false;
        if (hideTimer) clearTimeout(hideTimer);
        var touch = e.touches[0];
        startX = touch.clientX - currentX;
        startY = touch.clientY - currentY;
    }, { passive: false });

    fab.addEventListener("touchmove", function (e) {
        if (!dragging) return;
        e.preventDefault();
        hasMoved = true;
        var touch = e.touches[0];
        setFabPos(touch.clientX - startX, touch.clientY - startY);
    }, { passive: false });

    fab.addEventListener("touchend", function () {
        if (!dragging) return;
        dragging = false;
        if (hasMoved) {
            localStorage.setItem("bnyPosX", String(currentX));
            localStorage.setItem("bnyPosY", String(currentY));
            resetHideTimer();
        }
    });

    fab.addEventListener("mousedown", function (e) {
        if (isHidden) {
            showFromEdge();
            return;
        }
        dragging = true;
        hasMoved = false;
        if (hideTimer) clearTimeout(hideTimer);
        startX = e.clientX - currentX;
        startY = e.clientY - currentY;
    });

    document.addEventListener("mousemove", function (e) {
        if (!dragging) return;
        hasMoved = true;
        setFabPos(e.clientX - startX, e.clientY - startY);
    });

    document.addEventListener("mouseup", function () {
        if (!dragging) return;
        dragging = false;
        if (hasMoved) {
            localStorage.setItem("bnyPosX", String(currentX));
            localStorage.setItem("bnyPosY", String(currentY));
            resetHideTimer();
        }
    });

    fab.addEventListener("click", function () {
        if (!hasMoved) {
            alert("Bunny is here! It works!");
        }
    });

    function showFab() {
        var sx = localStorage.getItem("bnyPosX");
        var sy = localStorage.getItem("bnyPosY");
        if (sx !== null && sy !== null) {
            currentX = parseInt(sx);
            currentY = parseInt(sy);
        }
        setFabPos(currentX, currentY);
        fab.style.display = "block";
        isHidden = false;
        fab.style.transform = "translateX(0)";
        resetHideTimer();
    }

    function hideFab() {
        fab.style.display = "none";
        if (hideTimer) clearTimeout(hideTimer);
    }

    var saved = localStorage.getItem("bnyShow");
    if (saved === "1") {
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
