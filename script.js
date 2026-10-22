
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
  return text
    .split(/\r?\n/)
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

    let value;

    if (Object.prototype.hasOwnProperty.call(player, inputId)) {
      value = player[inputId];
    } else {
      const input = get(inputId);
      value = input ? input.value.trim() : "";
    }

    output.textContent = value || fallback;
  });

  return page;
}

get("updateBtn")?.addEventListener("click", () => {
  updateCertificate();

  if (get("status")) {
    get("status").textContent = "Preview updated.";
  }
});

get("generateBtn")?.addEventListener("click", () => {
  updateCertificate();

  const bulkInput = get("bulkPlayers");
  const printPages = get("printPages");
  const status = get("status");

  if (!bulkInput || !printPages) {
    if (status) {
      status.textContent =
        "Check that bulkPlayers and printPages exist in index.html.";
    }
    return;
  }

  const players = parsePlayers(bulkInput.value);
  printPages.replaceChildren();

  if (!players.length) {
    status.textContent =
      "Paste at least one player's details into Bulk Players.";
    return;
  }

  const startSerial = Math.max(
    1,
    parseInt(get("serial")?.value, 10) || 1
  );

  players.forEach((player, index) => {
    if (!player.serial) {
      player.serial = String(startSerial + index).padStart(3, "0");
    }

    printPages.appendChild(makeCertificate(player));
  });

  status.textContent =
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

  if (get("printPages")) get("printPages").replaceChildren();

  updateCertificate();

  if (get("status")) {
    get("status").textContent = "Details reset.";
  }
});

updateCertificate();
