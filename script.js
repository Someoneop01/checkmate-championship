
const fields = [
  ["player", "outPlayer", "PLAYER NAME"],
  ["fideId", "outFideId", "—"],
  ["eventCode", "outEventCode", ""],
  ["serial", "outSerial", "001"],
  ["state", "outState", "—"],
  ["points", "outPoints", "—"],
  ["rounds", "outRounds", "—"],
  ["rank", "outRank", "—"],
  ["dates", "outDates", "________________"],
  ["venue", "outVenue", "________________"]
];

const get = id => document.getElementById(id);

function updateCertificate() {
  fields.forEach(([inputId, outputId, fallback]) => {
    const input = get(inputId);
    const output = get(outputId);
    if (!input || !output) return;
    output.textContent = input.value.trim() || fallback;
  });
}

function parsePlayers(text) {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const p = line.split("|").map(v => v.trim());
      return {
        player: p[0] || "",
        fideId: p[1] || "",
        eventCode: p[2] || "",
        serial: p[3] || "",
        state: p[4] || "",
        points: p[5] || "",
        rounds: p[6] || "",
        rank: p[7] || ""
      };
    })
    .filter(p => p.player);
}

function makeCertificate(player = {}) {
  const page = get("certificate").cloneNode(true);
  page.removeAttribute("id");

  fields.forEach(([inputId, outputId, fallback]) => {
    const output = page.querySelector("#" + outputId);
    if (!output) return;

    const input = get(inputId);
    const value = Object.prototype.hasOwnProperty.call(player, inputId)
      ? player[inputId]
      : input?.value.trim();

    output.textContent = value || fallback;
  });

  return page;
}

// CSV parser that handles commas inside quoted values.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  text = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some(value => value !== "")) rows.push(row);
  return rows;
}

function importRows(rows) {
  const status = get("importStatus");
  const report = get("validationReport");
  const bulk = get("bulkPlayers");

  if (!bulk) return;

  if (!rows.length) {
    if (status) status.textContent = "The selected file is empty.";
    return;
  }

  const normalize = value => String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const headers = rows[0].map(normalize);
  const headerAliases = {
    player: ["name", "player", "playername", "fullname"],
    fideId: ["fideid", "fidenumber", "id"],
    eventCode: ["eventcode", "event"],
    serial: ["serial", "serialnumber", "certificateno", "certificatenumber"],
    state: ["state", "city", "statecity", "location"],
    points: ["points", "point", "score", "pointsscored"],
    rounds: ["rounds", "totalrounds", "numberofrounds"],
    rank: ["rank", "finalrank", "position", "place"]
  };

  let dataRows = rows;
  let columns = {};

  const hasHeader = headers.some(header =>
    Object.values(headerAliases).flat().includes(header)
  );

  if (hasHeader) {
    for (const [key, aliases] of Object.entries(headerAliases)) {
      columns[key] = headers.findIndex(header => aliases.includes(header));
    }
    dataRows = rows.slice(1);
  } else {
    columns = {
      player: 0, fideId: 1, eventCode: 2, serial: 3,
      state: 4, points: 5, rounds: 6, rank: 7
    };
  }

  const players = dataRows.map(row => {
    const player = {};
    for (const key of Object.keys(headerAliases)) {
      const index = columns[key];
      player[key] = index !== undefined && index >= 0
        ? String(row[index] ?? "").trim()
        : "";
    }
    return player;
  });

  const valid = players.filter(player => player.player);
  const invalidCount = players.length - valid.length;

  if (!valid.length) {
    if (status) {
      status.textContent =
        "No player names found. Check the file's Name/Player column.";
    }
    if (report) report.textContent = "";
    return;
  }

  bulk.value = valid.map(p => [
    p.player, p.fideId, p.eventCode, p.serial,
    p.state, p.points, p.rounds, p.rank
  ].join(" | ")).join("\n");

  if (status) {
    status.textContent =
      `Imported ${valid.length} player(s).` +
      (invalidCount ? ` Skipped ${invalidCount} row(s) without a name.` : "");
  }

  if (report) {
    report.textContent = invalidCount
      ? `${invalidCount} row(s) skipped because the player name was blank.`
      : "All imported rows have player names.";
  }
}

get("playerFile")?.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  const status = get("importStatus");
  const report = get("validationReport");

  if (!file) return;

  if (status) status.textContent = "Reading file...";
  if (report) report.textContent = "";

  try {
    const extension = file.name.split(".").pop().toLowerCase();
    let rows;

    if (extension === "csv") {
      rows = parseCSV(await file.text());
    } else if (["xlsx", "xls"].includes(extension)) {
      if (!window.XLSX) {
        throw new Error("Excel library did not load. Check your internet connection and reload the website.");
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      rows = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: "",
        raw: false
      });
    } else {
      throw new Error("Please select a .csv, .xlsx, or .xls file.");
    }

    importRows(rows);
  } catch (error) {
    if (status) status.textContent = "Import failed: " + error.message;
    console.error(error);
  }
});

get("downloadTemplateBtn")?.addEventListener("click", () => {
  const csv = [
    "Name,FIDE ID,Event Code,Serial,State/City,Points,Rounds,Rank",
    '"Example Player","12345678","ANG2026","","Bihar","6.5","9","1st"'
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "checkmate_players_template.csv";
  link.click();
  URL.revokeObjectURL(url);
});

get("updateBtn")?.addEventListener("click", () => {
  updateCertificate();
  if (get("status")) get("status").textContent = "Preview updated.";
});

get("generateBtn")?.addEventListener("click", () => {
  updateCertificate();

  const bulkInput = get("bulkPlayers");
  const printPages = get("printPages");
  const status = get("status");

  if (!bulkInput || !printPages) {
    if (status) status.textContent =
      "Check that bulkPlayers and printPages exist in index.html.";
    return;
  }

  const players = parsePlayers(bulkInput.value);
  printPages.replaceChildren();

  if (!players.length) {
    if (status) status.textContent =
      "Import a file or enter at least one player's details in Bulk Players.";
    return;
  }

  const startSerial = Math.max(1, parseInt(get("serial")?.value, 10) || 1);

  players.forEach((player, index) => {
    if (!player.serial) {
      player.serial = String(startSerial + index).padStart(3, "0");
    }
    printPages.appendChild(makeCertificate(player));
  });

  if (status) status.textContent =
    `${players.length} certificates ready. Click Print / Save All as PDF.`;
});

get("printBtn")?.addEventListener("click", () => {
  const printPages = get("printPages");
  if (!printPages) return;

  if (!printPages.children.length) {
    updateCertificate();
    printPages.replaceChildren(makeCertificate());
  }

  window.print();
});

get("resetBtn")?.addEventListener("click", () => {
  [
    "player", "fideId", "eventCode", "state",
    "points", "rounds", "rank", "dates", "venue"
  ].forEach(id => {
    const input = get(id);
    if (input) input.value = "";
  });

  if (get("serial")) get("serial").value = "001";
  if (get("bulkPlayers")) get("bulkPlayers").value = "";
  if (get("playerFile")) get("playerFile").value = "";
  if (get("printPages")) get("printPages").replaceChildren();
  if (get("importStatus")) get("importStatus").textContent = "";
  if (get("validationReport")) get("validationReport").textContent = "";

  updateCertificate();
  if (get("status")) get("status").textContent = "Details reset.";
});

updateCertificate();
