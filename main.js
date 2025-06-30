async function loadCSV(url) {
  const response = await fetch(url);
  const text = await response.text();
  const rows = text.trim().split('\n').map(r => r.split(','));
  const headers = rows[0];
  return rows.slice(1).map(row => Object.fromEntries(row.map((v, i) => [headers[i], v])));
}

async function buildTable() {
  const equipment = await loadCSV("https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/equipment.csv");
  const broken = await loadCSV("https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/station_parameters.csv");
  const latest = await loadCSV("https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/last6h.csv");

  const status = {};

  // Find latest time per station
  const latestTimes = {};
  latest.forEach(d => {
    const key = d.StationName;
    const t = new Date(d.ReadingDate);
    if (!latestTimes[key] || t > latestTimes[key]) latestTimes[key] = t;
  });

  // Build status per expected param
  equipment.forEach(e => {
    const key = e.StationName;
    const param = e.ParameterName;
    const cellKey = `${key}__${param}`;

    const knownDown = broken.some(b => b.StationName === key && b.ParameterName === param);
    if (knownDown) {
      status[cellKey] = "offline";
      return;
    }

    const report = latest.find(d => d.StationName === key && d.ParameterName === param &&
                                     new Date(d.ReadingDate).getTime() === latestTimes[key]?.getTime());

    if (report && report.Value !== "" && report.Value !== "-888") {
      status[cellKey] = "ok";
    } else {
      status[cellKey] = "missing";
    }
  });

  // Get all unique stations and parameters
  const stations = [...new Set(equipment.map(d => d.StationName))];
  const parameters = [...new Set(equipment.map(d => d.ParameterName))];

  // Build HTML table
  let html = `<table><thead><tr><th>Station</th><th>ReadingDate</th>`;
  parameters.forEach(p => html += `<th>${p}</th>`);
  html += `</tr></thead><tbody>`;

  stations.forEach(s => {
    html += `<tr><td>${s}</td><td>${latestTimes[s]?.toISOString().slice(0,16).replace('T',' ') || '-'}</td>`;
    parameters.forEach(p => {
      const val = status[`${s}__${p}`] || "";
      html += `<td class="${val}">${val ? "●" : ""}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;

  document.getElementById("table-container").innerHTML = html;
}

buildTable();
