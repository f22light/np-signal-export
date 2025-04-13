// ==UserScript==
// @name         MQL5 Signal Export Enhancer
// @namespace    https://f22light.github.io/
// @version      1.3
// @description  Download merged trading data (history + positions) from MQL5 signals
// @author       yourusername
// @match        https://www.mql5.com/*/signals/*
// @updateURL    https://f22light.github.io/np-signal-export/np-signal-export.user.js
// @downloadURL  https://f22light.github.io/np-signal-export/np-signal-export.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const signalIdMatch = window.location.href.match(/signals\/(\d+)/);
    if (!signalIdMatch) return;
    const signalId = signalIdMatch[1];

    const getSignalName = () => {
        const nameEl = document.querySelector("h1") || document.querySelector(".signal_title");
        if (!nameEl) return `trading_data_${signalId}`;
        return nameEl.textContent.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_") + `_${signalId}`;
    };

    const insertButton = () => {
        const toolbarContainer = document.querySelector("#headerToolbar > div.container.notifications-toolbar");
        if (!toolbarContainer) return;

        const btn = document.createElement("button");
        btn.textContent = "⬇ Export Trading Data";
        Object.assign(btn.style, {
            marginRight: "10px",
            padding: "6px 12px",
            fontSize: "14px",
            backgroundColor: "#1d72b8",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            transition: "background-color 0.3s ease"
        });

        btn.addEventListener("mouseenter", () => btn.style.backgroundColor = "#155d91");
        btn.addEventListener("mouseleave", () => btn.style.backgroundColor = "#1d72b8");

        btn.onclick = async () => {
            try {
                const historyURL = `https://www.mql5.com/en/signals/${signalId}/export/history`;
                const positionsURL = `https://www.mql5.com/en/signals/${signalId}/export/positions`;

                const [historyResp, positionsResp] = await Promise.all([
                    fetch(historyURL),
                    fetch(positionsURL)
                ]);

                const contentType = historyResp.headers.get("Content-Type") || "";
                if (contentType.includes("text/html")) {
                    alert("⚠️ Please log in to MQL5.com before downloading trading data.");
                    return;
                }

                const historyText = await historyResp.text();
                const positionsText = await positionsResp.text();

                const cleanCSV = (raw) => {
                    return raw
                        .replace(/^\uFEFF/, '')
                        .split("\n")
                        .filter(l => !l.includes("Balance") && !l.includes("Credit") && l.trim())
                        .map(l => {
                            const parts = l.split(";");
                            if (parts[0]?.includes('.')) parts[0] = parts[0].replaceAll('.', '/');
                            if (parts[6]?.includes('.')) parts[6] = parts[6].replaceAll('.', '/');
                            return parts.join(",");
                        });
                };

                const isValidCSV = (text) => {
                    const header = text.split("\n")[0] || "";
                    return header.includes("Symbol") && header.includes("Price") && header.includes("Volume");
                };

                if (!isValidCSV(historyText)) {
                    alert("❌ No valid trading history found for this signal.");
                    return;
                }

                const historyRows = cleanCSV(historyText);
                const positionRows = positionsText.trim().startsWith("[NotFound]") ? [] : cleanCSV(positionsText);

                const allRows = [...historyRows, ...positionRows];
                allRows.sort((a, b) => new Date(a.split(",")[0]) - new Date(b.split(",")[0]));

                const header = historyText.split("\n")[0].replace(/;/g, ",");
                const mergedCSV = [header, ...allRows].join("\n");

                const blob = new Blob([mergedCSV], { type: "text/csv;charset=utf-8" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${getSignalName()}.csv`;
                a.click();
            } catch (e) {
                alert("❌ Error downloading data: " + e.message);
            }
        };

        toolbarContainer.insertBefore(btn, toolbarContainer.firstChild);
    };

    const waitForElement = (selector, timeout = 5000) => new Promise((resolve) => {
        const interval = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(interval);
                resolve(el);
            }
        }, 100);
        setTimeout(() => clearInterval(interval), timeout);
    });

    waitForElement("#headerToolbar > div.container.notifications-toolbar").then(insertButton);
})();
