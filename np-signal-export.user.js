// ==UserScript==
// @name         MQL5 Signal Export Enhancer
// @namespace    https://f22light.github.io/
// @version      1.9
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
        const toolbarContainer = document.querySelector("#headerToolbar");
        if (!toolbarContainer) return;

        const btn = document.createElement("button");
        btn.textContent = "⬇"; // 기호만 남기기
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

                const [positionsResp, historyResp] = await Promise.all([
                    fetch(positionsURL),
                    fetch(historyURL)
                ]);

                const positionsText = positionsResp.ok ? await positionsResp.text() : null;
                let positionRows = [];

                // Check if positions file is available and contains valid data
                if (positionsText && positionsText.trim() !== "[NotFound]") {
                    positionRows = cleanCSV(positionsText);
                } else {
                    // If positions file is not available, use history file to generate positions data
                    const historyText = await historyResp.text();
                    positionRows = convertHistoryToPositions(cleanCSV(historyText));
                }

                // Sort the data based on time
                positionRows.sort((a, b) => new Date(a.split(",")[0]) - new Date(b.split(",")[0]));

                // Define fixed header for the positions CSV
                const fixedHeader = "Time,Type,Volume,Symbol,Price,Volume,Time,Price,Commission,Swap,Profit";

                const mergedCSV = [fixedHeader, ...positionRows].join("\n");

                // Remove duplicate header rows (if any)
                const finalCSV = mergedCSV.split("\n").filter((row, index, self) => {
                    return index === 0 || row !== self[0];
                }).join("\n");

                const blob = new Blob([finalCSV], { type: "text/csv;charset=utf-8" });
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

    const cleanCSV = (raw) => {
        return raw
            .replace(/^\uFEFF/, '') // BOM 제거
            .split("\n")
            .filter(l => l.trim() && !l.includes("Balance") && !l.includes("Credit"))
            .map(l => {
                const parts = l.split(";");

                // 날짜 형식 변경 (2023.06.15 -> 2023/06/15)
                if (parts[0]?.includes(':')) parts[0] = parts[0].replaceAll('.', '/');

                // 두 번째 Time 컬럼에서 날짜 형식 변경 (2023.06.15 -> 2023/06/15)
                if (parts[5]?.includes(':')) parts[5] = parts[5].replaceAll('.', '/');
                if (parts[6]?.includes(':')) parts[6] = parts[6].replaceAll('.', '/');
                if (parts[7]?.includes(':')) parts[7] = parts[7].replaceAll('.', '/');

                return parts.join(",");
            });
    };

    const convertHistoryToPositions = (historyRows) => {
        const positions = [];

        historyRows.forEach(row => {
            const parts = row.split(",");
            const time = parts[0];      // Buy/Sell Time
            const type = parts[1];      // Buy or Sell
            const volume = parts[2];    // Volume
            const symbol = parts[3];    // Symbol
            const price = parts[4];     // Price
            const sl = parts[5];        // S/L (not needed, to be removed)
            const tp = parts[6];        // T/P (not needed, to be removed)
            const closeTime = parts[7]; // Close Time
            const closePrice = parts[8]; // Close Price
            const commission = parts[9]; // Commission
            const swap = parts[10];      // Swap
            const profit = parts[11];    // Profit
            const comment = parts[12];   // Comment (to be removed)

            if (type === "Buy" || type === "Sell") {
                positions.push([
                    time,          // Buy/Sell Time
                    type,          // Buy/Sell Type
                    volume,        // Volume
                    symbol,        // Symbol
                    price,         // Open Price
                    volume,        // Volume (right column as per requirement)
                    closeTime,     // Close Time
                    closePrice,    // Close Price
                    commission,    // Commission
                    swap,          // Swap
                    profit         // Profit
                ].join(","));
            }
        });

        return positions;
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

    waitForElement("#headerToolbar").then(insertButton);
})();
