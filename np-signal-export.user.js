// ==UserScript==
// @name         MQL5 Signal CSV Auto Exporter
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Auto-detect and export trading history or positions as CSV from MQL5 signal pages
// @match        https://www.mql5.com/*/signals/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    window.addEventListener('load', () => {
        const signalIdMatch = window.location.href.match(/signals\/(\d+)/);
        if (!signalIdMatch) return;

        const signalId = signalIdMatch[1];
        const langPrefix = location.pathname.split("/")[1];

        const button = document.createElement("button");
        button.textContent = "⬇ Download Signal CSV";
        Object.assign(button.style, {
            position: "fixed",
            top: "1px",
            right: "310px",
            zIndex: "9999",
            padding: "10px 16px",
            fontSize: "14px",
            backgroundColor: "#1d72b8",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            cursor: "pointer"
        });

        button.onmouseover = () => button.style.backgroundColor = "#155d91";
        button.onmouseout = () => button.style.backgroundColor = "#1d72b8";

        document.body.appendChild(button);

        button.onclick = async () => {
            try {
                const urls = {
                    history: `https://www.mql5.com/${langPrefix}/signals/${signalId}/export/history`,
                    positions: `https://www.mql5.com/${langPrefix}/signals/${signalId}/export/positions`
                };

                const [historyResp, positionsResp] = await Promise.all([
                    fetch(urls.history),
                    fetch(urls.positions)
                ]);

                const isLoggedOut = (resp) =>
                    (resp.headers.get("Content-Type") || "").includes("text/html");

                if (isLoggedOut(historyResp) || isLoggedOut(positionsResp)) {
                    alert("⚠️ Please log in to MQL5.com first.");
                    return;
                }

                const historyText = await historyResp.text();
                const positionsText = await positionsResp.text();

                const isValidCSV = (text) => {
                    const head = text.split("\n")[0];
                    return head.startsWith("Time;Type;Volume;Symbol");
                };

                const cleanCSV = (raw) => {
                    return raw
                        .replace(/^\uFEFF/, '')
                        .split("\n")
                        .filter(l => l && !l.includes("Balance") && !l.includes("Credit"))
                        .map(l => {
                            const parts = l.split(";");
                            if (parts[0]?.includes(".")) parts[0] = parts[0].replaceAll(".", "/");
                            if (parts[6]?.includes(".")) parts[6] = parts[6].replaceAll(".", "/");
                            return parts.join(",");
                        });
                };

                let lines = [];
                let fileLabel = "";
                let rows = [];

                if (isValidCSV(historyText)) {
                    const header = historyText.split("\n")[0].replace(/;/g, ",");
                    const data = cleanCSV(historyText.split("\n").slice(1).join("\n"));
                    lines = [header, ...data];
                    fileLabel = "history";
                } else if (isValidCSV(positionsText)) {
                    const header = positionsText.split("\n")[0].replace(/;/g, ",");
                    const data = cleanCSV(positionsText.split("\n").slice(1).join("\n"));
                    lines = [header, ...data];
                    fileLabel = "positions";
                } else {
                    alert("❌ No valid trading data found for this signal.");
                    return;
                }

                const signalName = document.querySelector("h1")?.textContent.trim().replace(/[\\/:*?"<>|]/g, "_") || "Signal";

                const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${signalName}_${signalId}_${fileLabel}.csv`;
                a.click();
            } catch (err) {
                alert("❌ Error during download:\n" + err.message);
                console.error(err);
            }
        };
    });
})();
