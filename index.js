jQuery(() => {
    const getContainer = () => $(document.getElementById("extensions_settings"));

    getContainer().append(`
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Bunny Game</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:5px 0;">
                <input type="checkbox" id="bny-toggle" />
                <span>Show Bunny</span>
            </label>
            <div id="bny-status" style="padding:5px 0;font-size:12px;color:#888;">Bunny is hidden</div>
        </div>
    </div>`);

    var fab = document.createElement("div");
    fab.id = "bny-fab";
    fab.textContent = "\uD83D\uDC30";
    fab.style.cssText = "position:fixed;bottom:30px;right:20px;z-index:2147483647;width:52px;height:52px;font-size:24px;border-radius:50%;background:linear-gradient(135deg,#ff6b9d,#c44569);color:white;border:2px solid rgba(255,255,255,0.3);cursor:pointer;box-shadow:0 4px 15px rgba(255,107,157,0.5);display:none;align-items:center;justify-content:center;padding:0;margin:0;";
    document.body.appendChild(fab);

    var saved = localStorage.getItem("bnyShow");
    if (saved === "1") {
        $("#bny-toggle").prop("checked", true);
        fab.style.display = "flex";$("#bny-status").text("Bunny is visible!");
    }

    $("#bny-toggle").on("change", function () {
        var on = $(this).prop("checked");
        fab.style.display = on ? "flex" : "none";
        localStorage.setItem("bnyShow", on ? "1" : "0");$("#bny-status").text(on ? "Bunny is visible!" : "Bunny is hidden");
    });

    fab.addEventListener("click", function () {
        alert("Bunny is here! It works!");
    });
});
