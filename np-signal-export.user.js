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
        const toolbarContainer = document.querySelector("#headerToolbar > div.container.notifications-toolbar");
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

                const [historyResp, positionsResp] = await Promise.all([
                    fetch(historyURL),
                    fetch(positionsURL)
                ]);

                // Check for successful response status
                if (!historyResp.ok) {
                    alert("⚠️ Error fetching history data: " + (historyResp.statusText || "Unknown error"));
                    return;
                }

                const historyText = await historyResp.text();
                const positionsText = positionsResp.ok ? await positionsResp.text() : null;

                const cleanCSV = (raw) => {
                    return raw
                        .replace(/^\uFEFF/, '')
                        .split("\n")
                        .filter(l => l.trim() && !l.includes("Balance") && !l.includes("Credit"))
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
                let positionRows = [];
                if (positionsText && positionsText.trim() !== "[NotFound]") {
                    positionRows = cleanCSV(positionsText);
                } else {
                    // If no positions file, convert history file to positions format
                    positionRows = convertHistoryToPositions(historyRows);
                }

                const allRows = [...positionRows];
                allRows.sort((a, b) => new Date(a.split(",")[0]) - new Date(b.split(",")[0]));

                // Set the fixed header (as per your specification)
                const header = "Time,Type,Volume,Symbol,Price,Volume,Time,Price,Commission,Swap,Profit";
                
                const mergedCSV = [header, ...allRows].join("\n");

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

    const convertHistoryToPositions = (historyRows) => {
        const positions = [];
        let lastBuy = null;

        historyRows.forEach(row => {
            const parts = row.split(",");
            const time = parts[0];
            const type = parts[1]; // Buy or Sell
            const volume = parts[2];
            const symbol = parts[3];
            const price = parts[4];
            const stopLoss = parts[5];
            const takeProfit = parts[6];
            const closingTime = parts[7];
            const closingPrice = parts[8];
            const commission = parts[9];
            const swap = parts[10];
            const profit = parts[11];
            const comment = parts[12];

            if (type === "Buy") {
                // If it's a Buy trade (In)
                lastBuy = { time, volume, symbol, price, closingTime, closingPrice, commission, swap, profit, comment };
            } else if (type === "Sell" && lastBuy) {
                // If it's a Sell trade (Out), we match it with the last Buy trade
                positions.push([
                    lastBuy.time,  // Buy Time
                    "Buy",         // Buy
                    lastBuy.volume, // Buy Volume
                    lastBuy.symbol, // Symbol
                    lastBuy.price, // Buy Price
                    volume,         // Sell Volume
                    closingTime,    // Sell Time
                    closingPrice,   // Sell Price
                    commission,     // Commission
                    swap,           // Swap
                    profit          // Profit
                ].join(","));
                lastBuy = null; // Reset for next pair
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

    waitForElement("#headerToolbar > div.container.notifications-toolbar").then(insertButton);
})();
