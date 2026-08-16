(() => {
  "use strict";

  const STORAGE_KEY = "workout-tracker-records-v1";

  const EXERCISES = [
    { key: "bench", label: "ベンチプレス" },
    { key: "deadlift", label: "デッドリフト" },
    { key: "squat", label: "スクワット" }
  ];

  const $ = (id) => document.getElementById(id);

  const form = $("workoutForm");
  const recordIdInput = $("recordId");
  const dateInput = $("date");
  const storeInput = $("store");
  const splitInput = $("split");
  const otherStoreInput = $("otherStore");
  const bodyWeightInput = $("bodyWeight");
  const noteInput = $("note");

  const formTitle = $("formTitle");
  const editingLabel = $("editingLabel");
  const submitButton = $("submitButton");
  const cancelEditButton = $("cancelEditButton");
  const resetButton = $("resetButton");

  const recordList = $("recordList");
  const emptyMessage = $("emptyMessage");
  const recordCount = $("recordCount");

  const filterSplit = $("filterSplit");
  const importFile = $("importFile");

  const chart = $("weightChart");
  const chartEmpty = $("chartEmpty");
  const chartSummary = $("chartSummary");
  const chartRange = $("chartRange");

  const toast = $("toast");

  let records = loadRecords();
  let toastTimer = null;

  function loadRecords() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed.map(normalizeRecord)
        : [];
    } catch (error) {
      console.error("データの読み込みに失敗しました", error);
      return [];
    }
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function createId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getToday() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }

  function formatDate(dateString) {
    if (!dateString) return "-";
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;

    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short"
    }).format(date);
  }

  function numberOrNull(value) {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeSplitLabel(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return "";
    if (/^(push|プッシュ)$/.test(normalized)) return "Push";
    if (/^(pull|プル)$/.test(normalized)) return "Pull";
    if (/^(legs?|脚|足|レッグ)$/.test(normalized)) return "Legs";
    return String(value).trim();
  }

  function normalizeSplits(value) {
    const values = Array.isArray(value)
      ? value
      : String(value || "").split(/[\s,、/|｜]+/);

    return [
      ...new Set(
        values
          .map((item) => normalizeSplitLabel(item))
          .filter(Boolean)
      )
    ];
  }

  function normalizeRecord(record) {
    return {
      ...record,
      split: normalizeSplits(record.split),
      note: String(record.note || "").trim(),
      exercises: Object.fromEntries(
        EXERCISES.map((exercise) => [
          exercise.key,
          normalizeExercise(record.exercises?.[exercise.key])
        ])
      )
    };
  }

  function normalizeExercise(exercise = {}) {
    const legacyEntry = {
      weight: numberOrNull(exercise.weight),
      reps: numberOrNull(exercise.reps),
      sets: numberOrNull(exercise.sets)
    };
    const normalizedEntries = Array.isArray(exercise.entries)
      ? exercise.entries.map(normalizeSetEntry).filter(hasSetValue)
      : [];
    const entries = normalizedEntries.length
      ? normalizedEntries
      : hasSetValue(legacyEntry)
        ? [legacyEntry]
        : [];
    const first = entries[0] || legacyEntry;

    return {
      weight: first.weight,
      reps: first.reps,
      sets: entries.length
        ? entries.reduce((total, entry) => total + (entry.sets || 0), 0) || null
        : legacyEntry.sets,
      entries
    };
  }

  function normalizeSetEntry(entry = {}) {
    return {
      weight: numberOrNull(entry.weight),
      reps: numberOrNull(entry.reps),
      sets: numberOrNull(entry.sets)
    };
  }

  function hasSetValue(entry) {
    return entry.weight !== null || entry.reps !== null || entry.sets !== null;
  }

  function getSelectedSplits() {
    return [...splitInput.querySelectorAll('input[name="split"]:checked')]
      .map((input) => input.value);
  }

  function getStoreValue() {
    return storeInput.value === "その他"
      ? otherStoreInput.value.trim()
      : storeInput.value;
  }

  function updateOtherStoreVisibility() {
    const isOther = storeInput.value === "その他";
    otherStoreInput.classList.toggle("hidden", !isOther);
    otherStoreInput.required = isOther;
  }

  function getFormRecord() {
    const exercises = {};

    EXERCISES.forEach((exercise) => {
      const entries = [
        ...document.querySelectorAll(
          `[data-exercise="${exercise.key}"] .set-entry`
        )
      ].map((entry) =>
        normalizeSetEntry({
          weight: entry.querySelector('[name="weight"]').value,
          reps: entry.querySelector('[name="reps"]').value,
          sets: entry.querySelector('[name="sets"]').value
        })
      );
      exercises[exercise.key] = normalizeExercise({ entries });
    });

    return {
      id: recordIdInput.value || createId(),
      date: dateInput.value,
      store: getStoreValue(),
      split: getSelectedSplits(),
      bodyWeight: numberOrNull(bodyWeightInput.value),
      note: noteInput.value.trim(),
      exercises,
      updatedAt: new Date().toISOString()
    };
  }

  function renderSetEntry(container, entry = {}) {
    const row = document.createElement("div");
    row.className = "set-entry";
    row.innerHTML = `
      <div class="exercise-inputs">
        <div class="field"><label>重量</label><div class="unit-input"><input type="number" name="weight" class="no-spinner" inputmode="decimal" min="0" max="1000" step="0.5" placeholder="0" /><span class="unit">kg</span></div></div>
        <div class="field"><label>回数</label><div class="unit-input"><input type="number" name="reps" class="no-spinner" inputmode="numeric" min="0" max="1000" step="1" placeholder="0" /><span class="unit">回</span></div></div>
        <div class="field"><label>セット数</label><div class="unit-input"><input type="number" name="sets" class="no-spinner" inputmode="numeric" min="0" max="1000" step="1" placeholder="0" /><span class="unit">セット</span></div></div>
      </div>
      <button type="button" class="btn btn-danger btn-small remove-set-button">この重量を削除</button>
    `;
    ["weight", "reps", "sets"].forEach((key) => {
      row.querySelector(`[name="${key}"]`).value =
        entry[key] === null || entry[key] === undefined ? "" : entry[key];
    });
    container.appendChild(row);
  }

  function renderExerciseEntries(exerciseKey, entries = []) {
    const container = document.querySelector(
      `[data-exercise="${exerciseKey}"] .set-entry-list`
    );
    container.innerHTML = "";
    (entries.length ? entries : [{}]).forEach((entry) =>
      renderSetEntry(container, entry)
    );
  }

  function fillForm(record) {
    recordIdInput.value = record.id;
    dateInput.value = record.date || getToday();
    const storeExists = [...storeInput.options].some(
      (option) => option.value === record.store
    );
    storeInput.value = storeExists ? record.store : record.store ? "その他" : "";
    otherStoreInput.value = storeExists ? "" : record.store || "";
    updateOtherStoreVisibility();

    const selectedSplits = normalizeSplits(record.split);
    splitInput.querySelectorAll('input[name="split"]').forEach((input) => {
      input.checked = selectedSplits.includes(input.value);
    });
    bodyWeightInput.value =
      record.bodyWeight === null || record.bodyWeight === undefined
        ? ""
        : record.bodyWeight;
    noteInput.value = record.note || "";

    EXERCISES.forEach((exercise) => {
      renderExerciseEntries(
        exercise.key,
        normalizeExercise(record.exercises?.[exercise.key]).entries
      );
    });

    formTitle.textContent = "トレーニングを編集";
    editingLabel.textContent = "編集中";
    submitButton.textContent = "変更を保存";
    cancelEditButton.classList.remove("hidden");

    $("formCard").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function resetForm() {
    form.reset();
    recordIdInput.value = "";
    dateInput.value = getToday();
    updateOtherStoreVisibility();
    EXERCISES.forEach((exercise) => renderExerciseEntries(exercise.key));

    formTitle.textContent = "トレーニングを追加";
    editingLabel.textContent = "";
    submitButton.textContent = "記録を追加";
    cancelEditButton.classList.add("hidden");
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }
    return Number(value).toLocaleString("ja-JP");
  }

  function formatMetric(value, unit) {
    const formatted = formatNumber(value);
    return formatted === "-" ? formatted : `${formatted}${unit}`;
  }

  function exerciseText(exercise) {
    if (!exercise) return "-";
    const entries = normalizeExercise(exercise).entries;
    if (!entries.length) return "-";
    return entries.map((entry) => {
      const values = [];
      if (entry.weight !== null) values.push(`重量: ${formatMetric(entry.weight, "kg")}`);
      if (entry.reps !== null) values.push(`回数: ${formatMetric(entry.reps, "回")}`);
      if (entry.sets !== null) values.push(`セット数: ${formatMetric(entry.sets, "セット")}`);
      return values.join("、");
    }).join(" / ");
  }

  function getFilteredRecords() {
    const split = filterSplit.value;

    return records
      .filter((record) => {
        return !split || normalizeSplits(record.split).includes(split);
      })
      .sort((a, b) => {
        return String(b.date).localeCompare(String(a.date));
      });
  }

  function renderRecords() {
    const filtered = getFilteredRecords();

    recordList.innerHTML = "";
    recordCount.textContent = `${filtered.length}件`;

    if (filtered.length === 0) {
      emptyMessage.classList.remove("hidden");
      return;
    }

    emptyMessage.classList.add("hidden");

    filtered.forEach((record) => {
      const article = document.createElement("article");
      article.className = "record";

      const exercisesHtml = EXERCISES.map((exercise) => {
        return `
          <div class="detail">
            <div class="detail-label">${exercise.label}</div>
            <div class="detail-value">
              ${escapeHtml(exerciseText(record.exercises?.[exercise.key]))}
            </div>
          </div>
        `;
      }).join("");

      article.innerHTML = `
        <div class="record-header">
          <div class="record-summary">
            <div class="record-date">${escapeHtml(formatDate(record.date))}</div>
            <div class="record-store">📍 ${escapeHtml(record.store || "店舗未入力")}</div>
            <span class="badge">${escapeHtml(normalizeSplits(record.split).join(" / ") || "-")}</span>
          </div>
          <div class="record-weight">${escapeHtml(formatNumber(record.bodyWeight))}kg</div>
        </div>

        <div class="record-details">
          ${exercisesHtml}
          <div class="detail detail-note">
            <div class="detail-label">備考</div>
            <div class="detail-value">
              ${escapeHtml(record.note || "-")}
            </div>
          </div>
        </div>

        <div class="record-actions">
          <button class="btn btn-secondary btn-small edit-button" data-id="${record.id}">
            編集
          </button>
          <button class="btn btn-danger btn-small delete-button" data-id="${record.id}">
            削除
          </button>
        </div>
      `;

      recordList.appendChild(article);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function drawChart() {
    const context = chart.getContext("2d");
    const rect = chart.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const width = Math.max(320, rect.width);
    const height = Math.max(240, rect.height);

    chart.width = width * dpr;
    chart.height = height * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    context.clearRect(0, 0, width, height);

    const allData = records
      .filter(
        (record) =>
          record.date &&
          record.bodyWeight !== null &&
          record.bodyWeight !== undefined &&
          Number.isFinite(Number(record.bodyWeight))
      )
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const data = compressChartData(filterChartData(allData), width);

    chartSummary.textContent = chartRange.value === "all"
      ? `${data.length}件`
      : `${data.length}/${allData.length}件`;

    if (data.length === 0) {
      chart.classList.add("hidden");
      chartEmpty.classList.remove("hidden");
      return;
    }

    chart.classList.remove("hidden");
    chartEmpty.classList.add("hidden");

    const padding = {
      top: 20,
      right: 18,
      bottom: 52,
      left: 46
    };

    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    const values = data.map((item) => Number(item.bodyWeight));
    const minValue = Math.floor(Math.min(...values) - 1);
    const maxValue = Math.ceil(Math.max(...values) + 1);
    const range = Math.max(1, maxValue - minValue);

    const x = (index) => {
      if (data.length === 1) return padding.left + graphWidth / 2;
      return padding.left + (index / (data.length - 1)) * graphWidth;
    };

    const y = (value) => {
      return (
        padding.top +
        ((maxValue - value) / range) * graphHeight
      );
    };

    context.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
    context.textAlign = "right";
    context.textBaseline = "middle";

    const gridCount = 5;

    for (let i = 0; i <= gridCount; i++) {
      const value = minValue + (range / gridCount) * i;
      const yPosition = y(value);

      context.strokeStyle = "#e5e7eb";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(padding.left, yPosition);
      context.lineTo(width - padding.right, yPosition);
      context.stroke();

      context.fillStyle = "#6b7280";
      context.fillText(`${value.toFixed(1)}kg`, padding.left - 8, yPosition);
    }

    context.textAlign = "center";
    context.textBaseline = "top";

    const firstDate = data[0]?.date || "";
    const lastDate = data[data.length - 1]?.date || "";
    const spanDays = Math.max(
      1,
      Math.round((new Date(`${lastDate}T00:00:00`) - new Date(`${firstDate}T00:00:00`)) / 86400000)
    );
    const longRange = spanDays >= 180;
    const labelStep = Math.max(1, Math.ceil(data.length / 6));

    data.forEach((item, index) => {
      const isLast = index === data.length - 1;
      const isFirst = index === 0;
      const showByStep = index % labelStep === 0;
      const showMonthStart = longRange && item.date.endsWith("-01");
      if (longRange) {
        if (!isFirst && !isLast && !showMonthStart) return;
      } else if (!isLast && !showByStep) {
        return;
      }

      const [year, month, day] = item.date.split("-");
      const label = longRange ? `${year}/${month}` : `${year}/${month}/${day}`;
      context.fillStyle = "#6b7280";
      context.fillText(label, x(index), height - padding.bottom + 12);
    });

    context.beginPath();

    data.forEach((item, index) => {
      const pointX = x(index);
      const pointY = y(Number(item.bodyWeight));

      if (index === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    });

    context.strokeStyle = "#2563eb";
    context.lineWidth = 3;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();

    if (data.length <= 80) {
      data.forEach((item, index) => {
        const pointX = x(index);
        const pointY = y(Number(item.bodyWeight));

        context.beginPath();
        context.arc(pointX, pointY, 5, 0, Math.PI * 2);
        context.fillStyle = "#ffffff";
        context.fill();
        context.strokeStyle = "#2563eb";
        context.lineWidth = 3;
        context.stroke();
      });
    }
  }

  function filterChartData(data) {
    if (chartRange.value === "all") return data;

    const latestDate = data[data.length - 1]?.date;
    if (!latestDate) return data;

    const startDate = new Date(`${latestDate}T00:00:00`);
    const months = { "1m": 1, "3m": 3, "1y": 12 }[chartRange.value];
    if (!months) return data;
    startDate.setMonth(startDate.getMonth() - months);
    const start = startDate.toISOString().slice(0, 10);
    return data.filter((record) => record.date >= start);
  }

  function compressChartData(data, width) {
    const maxPoints = Math.max(40, Math.floor(width / 7));
    if (data.length <= maxPoints) return data;

    const anchorIndices = new Set([0, data.length - 1]);
    data.forEach((item, index) => {
      if (item.date.endsWith("-01")) anchorIndices.add(index);
    });

    const bucketCount = Math.max(
      1,
      Math.floor((maxPoints - anchorIndices.size) / 2)
    );
    const bucketSize = data.length / bucketCount;
    const candidateIndices = new Set(anchorIndices);

    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const start = Math.floor(bucket * bucketSize);
      const end = Math.min(
        data.length,
        Math.floor((bucket + 1) * bucketSize)
      );
      if (start >= end) continue;

      let minIndex = start;
      let maxIndex = start;
      for (let index = start + 1; index < end; index += 1) {
        if (Number(data[index].bodyWeight) < Number(data[minIndex].bodyWeight)) {
          minIndex = index;
        }
        if (Number(data[index].bodyWeight) > Number(data[maxIndex].bodyWeight)) {
          maxIndex = index;
        }
      }

      candidateIndices.add(minIndex);
      candidateIndices.add(maxIndex);
    }

    const allIndices = [...candidateIndices].sort((a, b) => a - b);
    if (allIndices.length <= maxPoints) {
      return allIndices.map((index) => data[index]);
    }

    const anchorList = [...anchorIndices].sort((a, b) => a - b);
    const anchorsToKeep =
      anchorList.length > maxPoints
        ? anchorList.filter((_, index) =>
            index % Math.ceil(anchorList.length / maxPoints) === 0
          )
        : anchorList;
    anchorsToKeep.push(0, data.length - 1);
    const protectedIndices = new Set(anchorsToKeep);
    const remaining = allIndices.filter((index) => !protectedIndices.has(index));
    const remainingSlots = Math.max(0, maxPoints - protectedIndices.size);

    const sampledRemaining = [];
    for (let slot = 0; slot < remainingSlots; slot += 1) {
      const pick = remaining[Math.floor((slot * remaining.length) / remainingSlots)];
      if (pick !== undefined) sampledRemaining.push(pick);
    }

    return [...new Set([...anchorsToKeep, ...sampledRemaining])]
      .sort((a, b) => a - b)
      .slice(0, maxPoints)
      .map((index) => data[index]);
  }

  function csvEscape(value) {
    const stringValue = String(value ?? "");
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    if (records.length === 0) {
      showToast("エクスポートする記録がありません");
      return;
    }

    const headers = [
      "日付",
      "店舗",
      "部位",
      "体重(kg)",
      "備考",
      "スクワット重量(kg)",
      "スクワット回数",
      "スクワットセット数",
      "スクワットセット詳細(JSON)",
      "ベンチプレス重量(kg)",
      "ベンチプレス回数",
      "ベンチプレスセット数",
      "ベンチプレスセット詳細(JSON)",
      "デッドリフト重量(kg)",
      "デッドリフト回数",
      "デッドリフトセット数",
      "デッドリフトセット詳細(JSON)"
    ];

    const rows = records
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((record) => {
        const squat = normalizeExercise(record.exercises?.squat);
        const bench = normalizeExercise(record.exercises?.bench);
        const deadlift = normalizeExercise(record.exercises?.deadlift);

        return [
          record.date,
          record.store,
          normalizeSplits(record.split).join(" / "),
          record.bodyWeight,
          record.note || "",
          squat.weight,
          squat.reps,
          squat.sets,
          JSON.stringify(squat.entries),
          bench.weight,
          bench.reps,
          bench.sets,
          JSON.stringify(bench.entries),
          deadlift.weight,
          deadlift.reps,
          deadlift.sets,
          JSON.stringify(deadlift.entries)
        ];
      });

    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(","))
    ].join("\r\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = getToday();

    link.href = url;
    link.download = `筋トレ記録_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    showToast("CSVをダウンロードしました");
  }

  function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let value = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const nextCharacter = text[index + 1];

      if (character === '"' && inQuotes && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = !inQuotes;
      } else if (character === delimiter && !inQuotes) {
        row.push(value.trim());
        value = "";
      } else if ((character === "\n" || character === "\r") && !inQuotes) {
        if (character === "\r" && nextCharacter === "\n") index += 1;
        row.push(value.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        value = "";
      } else {
        value += character;
      }
    }

    row.push(value.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  }

  function normalizeHeaderName(value) {
    return String(value ?? "").replace(/\s+/g, "").toLowerCase();
  }

  function getImportValue(row, headers, names) {
    const normalizedNames = names.map(normalizeHeaderName);
    const index = headers.findIndex((header) =>
      normalizedNames.includes(normalizeHeaderName(header))
    );
    return index >= 0 ? row[index] || "" : "";
  }

  function getDataValue(data, names) {
    const normalized = Object.entries(data || {}).reduce((result, [key, value]) => {
      result[normalizeHeaderName(key)] = value;
      return result;
    }, {});
    const found = names
      .map((name) => normalized[normalizeHeaderName(name)])
      .find((value) => value !== undefined && value !== null && value !== "");
    return found ?? "";
  }

  function toBooleanCell(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return false;
    if (["0", "false", "no", "off", "×", "✗", "✕", "-", "なし", "無"].includes(normalized)) {
      return false;
    }
    return true;
  }

  function mapSplitLabel(value) {
    return normalizeSplitLabel(value);
  }

  function getImportSplits(data) {
    const fromText = normalizeSplits(
      data.split || data.splits || data["部位"] || data["トレーニング部位"]
    )
      .map(mapSplitLabel)
      .filter((value) => ["Push", "Pull", "Legs"].includes(value));
    const fromChecks = [
      { keys: ["プッシュ", "push"], value: "Push" },
      { keys: ["プル", "pull"], value: "Pull" },
      { keys: ["脚", "legs", "leg"], value: "Legs" }
    ]
      .filter(({ keys }) => toBooleanCell(getDataValue(data, keys)))
      .map(({ value }) => value);
    return [...new Set([...fromText, ...fromChecks])];
  }

  function parseExerciseColumn(value) {
    const text = String(value ?? "").trim();
    if (!text) return undefined;

    const hasSeparator = /[\/／|｜\n]/.test(text);
    const segments = hasSeparator
      ? text.split(/[\/／|｜\n]/)
      : [text];
    const parsed = [];

    segments
      .map((segment) => segment.trim())
      .filter(Boolean)
      .forEach((segment) => {
        const numbers = (segment.match(/-?\d+(?:\.\d+)?/g) || [])
          .map(Number)
          .filter(Number.isFinite);
        if (!numbers.length) return;

        if (!hasSeparator && numbers.length > 3) {
          for (let index = 0; index < numbers.length; index += 3) {
            if (numbers[index + 2] === undefined) break;
            const entry = normalizeSetEntry({
              weight: numbers[index],
              reps: numbers[index + 1],
              sets: numbers[index + 2]
            });
            if (hasSetValue(entry)) parsed.push(entry);
          }
          return;
        }

        const entry = normalizeSetEntry({
          weight: numbers[0],
          reps: numbers[1],
          sets: numbers[2]
        });
        if (hasSetValue(entry)) parsed.push(entry);
      });

    return parsed.length ? parsed : undefined;
  }

  function normalizeImportDate(value) {
    const rawValue = String(value ?? "").trim();
    const serial = Number(rawValue);

    if (rawValue !== "" && Number.isFinite(serial) && serial > 0) {
      // Excel は日付をシリアル値（1899-12-30 起点）で保持することがある
      const date = new Date(Math.round(serial) * 86400000 + Date.UTC(1899, 11, 30));
      return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
    }

    const match = rawValue.match(
      /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?$/
    );
    if (!match) return "";
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  function parseLegacyNote(note) {
    const lines = String(note || "")
      .split(/\r?\n|\\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const storeNames = ["原宿アネックス", "銀座東京", "浜松町", "表参道", "原宿", "渋谷"];
    const store = storeNames.find((name) =>
      lines.some((line) => line.includes(name))
    ) || "";
    const header = lines[0] || "";
    const splits = header.includes("全身")
      ? ["Push", "Pull", "Legs"]
      : [
          /(プッシュ|push)/i.test(header) && "Push",
          /(プル|pull)/i.test(header) && "Pull",
          /(脚|足|レッグ|legs|leg)/i.test(header) && "Legs"
        ].filter(Boolean);
    const entriesByExercise = Object.fromEntries(
      EXERCISES.map(({ key }) => [key, []])
    );
    const unlabeledEntries = [];
    let activeExercise = "";

    lines.forEach((line) => {
      const exercise = EXERCISES.find(({ label }) => line.includes(label));
      if (exercise) {
        activeExercise = exercise.key;
        const values = line.replace(exercise.label, "").trim();
        if (/\d/.test(values)) entriesByExercise[activeExercise].push(values);
        return;
      }

      if (!/\d/.test(line)) return;
      if (activeExercise) {
        entriesByExercise[activeExercise].push(line);
      } else {
        unlabeledEntries.push(line);
      }
    });

    if (unlabeledEntries.length && splits.length === 1) {
      const exerciseBySplit = { Push: "bench", Pull: "deadlift", Legs: "squat" };
      entriesByExercise[exerciseBySplit[splits[0]]].push(...unlabeledEntries);
    }

    return {
      store,
      splits,
      exercises: Object.fromEntries(
        EXERCISES.map(({ key }) => [
          key,
          parseExerciseColumn(entriesByExercise[key].join("\n"))
        ])
      )
    };
  }

  function createImportedRecord(data) {
    const exercises = data.exercises || {};
    const note = String(getDataValue(data, ["備考", "note"])).trim();
    const legacyNote = parseLegacyNote(note);
    const splits = getImportSplits(data);
    const importExercise = (key, label) => {
      const source = exercises[key] || {};
      const details = source.entries ?? parseExerciseEntries(
        data[`${key}Entries`] ?? data[`${label}セット詳細(JSON)`]
      ) ?? parseExerciseColumn(
        data[`${key}Text`] ?? data[key] ?? data[label]
      ) ?? legacyNote.exercises[key];
      return normalizeExercise({
        weight: source.weight ?? data[`${key}Weight`] ?? data[`${label}重量(kg)`],
        reps: source.reps ?? data[`${key}Reps`] ?? data[`${label}回数`],
        sets: source.sets ?? data[`${key}Sets`] ?? data[`${label}セット数`],
        entries: details
      });
    };
    const record = normalizeRecord({
      id: createId(),
      date: normalizeImportDate(getDataValue(data, ["日付", "date", "inputDate", "inputDate (y/M/d)"])),
      note,
      store: String(getDataValue(data, ["店舗", "store"])).trim() || legacyNote.store,
      split: splits.length ? splits : legacyNote.splits,
      bodyWeight: numberOrNull(
        getDataValue(data, ["体重(kg)", "体重", "bodyWeight", "weight (kg)"])
      ),
      exercises: {
        squat: {
          ...importExercise("squat", "スクワット")
        },
        bench: {
          ...importExercise("bench", "ベンチプレス")
        },
        deadlift: {
          ...importExercise("deadlift", "デッドリフト")
        }
      },
      updatedAt: new Date().toISOString()
    });

    return record.date && record.store && record.split.length ? record : null;
  }

  function parseExerciseEntries(value) {
    if (!value) return undefined;
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  function parseImportFile(text, fileName) {
    const normalizedText = text.replace(/^\uFEFF/, "");

    if (fileName.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(normalizedText);
      const data = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(data)) throw new Error("JSONの記録形式が不正です");
      return data.map(createImportedRecord).filter(Boolean);
    }

    const delimiter = normalizedText.includes("\t") ? "\t" : ",";
    return rowsToRecords(parseDelimited(normalizedText, delimiter));
  }

  function hasImportHeader(text) {
    const normalizedDateHeaders = ["日付", "date", "inputDate", "inputDate (y/M/d)"]
      .map(normalizeHeaderName);
    const normalizedText = text.replace(/^\uFEFF/, "");
    const rows = parseDelimited(
      normalizedText,
      normalizedText.includes("\t") ? "\t" : ","
    );
    return rows.some((row) =>
      row.some((value) =>
        normalizedDateHeaders.includes(normalizeHeaderName(value))
      )
    );
  }

  async function readImportText(file) {
    const buffer = await file.arrayBuffer();
    const utf8Text = new TextDecoder("utf-8").decode(buffer);

    if (file.name.toLowerCase().endsWith(".json") || hasImportHeader(utf8Text)) {
      return utf8Text;
    }

    try {
      const shiftJisText = new TextDecoder("shift_jis").decode(buffer);
      return hasImportHeader(shiftJisText) ? shiftJisText : utf8Text;
    } catch {
      return utf8Text;
    }
  }

  function rowsToRecords(rows) {
    const normalizedDateHeaders = ["日付", "date", "inputDate", "inputDate (y/M/d)"]
      .map(normalizeHeaderName);
    const headerIndex = rows.findIndex(
      (row) =>
        row.some((value) =>
          normalizedDateHeaders.includes(normalizeHeaderName(value))
        )
    );
    if (headerIndex < 0) throw new Error("日付の見出しが見つかりません");

    const headers = rows[headerIndex].map((header) => header.replace(/^\uFEFF/, ""));
    return rows.slice(headerIndex + 1).map((row) => {
      const data = {
        date: getImportValue(row, headers, ["日付", "date", "inputDate", "inputDate (y/M/d)"]),
        note: getImportValue(row, headers, ["備考", "note"]),
        store: getImportValue(row, headers, ["店舗", "store"]),
        split: getImportValue(row, headers, ["部位", "トレーニング部位", "split", "splits"]),
        bodyWeight: getImportValue(row, headers, ["体重(kg)", "体重", "bodyWeight", "weight (kg)", "weight"]),
        push: getImportValue(row, headers, ["プッシュ", "push"]),
        pull: getImportValue(row, headers, ["プル", "pull"]),
        legs: getImportValue(row, headers, ["脚", "legs", "leg"]),
        squatText: getImportValue(row, headers, ["スクワット", "squat"]),
        benchText: getImportValue(row, headers, ["ベンチプレス", "bench"]),
        deadliftText: getImportValue(row, headers, ["デッドリフト", "deadlift"]),
        squatWeight: getImportValue(row, headers, ["スクワット重量(kg)", "squatWeight"]),
        squatReps: getImportValue(row, headers, ["スクワット回数", "squatReps"]),
        squatSets: getImportValue(row, headers, ["スクワットセット数", "squatSets"]),
        squatEntries: getImportValue(row, headers, ["スクワットセット詳細(JSON)", "squatEntries"]),
        benchWeight: getImportValue(row, headers, ["ベンチプレス重量(kg)", "benchWeight"]),
        benchReps: getImportValue(row, headers, ["ベンチプレス回数", "benchReps"]),
        benchSets: getImportValue(row, headers, ["ベンチプレスセット数", "benchSets"]),
        benchEntries: getImportValue(row, headers, ["ベンチプレスセット詳細(JSON)", "benchEntries"]),
        deadliftWeight: getImportValue(row, headers, ["デッドリフト重量(kg)", "deadliftWeight"]),
        deadliftReps: getImportValue(row, headers, ["デッドリフト回数", "deadliftReps"]),
        deadliftSets: getImportValue(row, headers, ["デッドリフトセット数", "deadliftSets"]),
        deadliftEntries: getImportValue(row, headers, ["デッドリフトセット詳細(JSON)", "deadliftEntries"])
      };
      return createImportedRecord(data);
    }).filter(Boolean);
  }

  function isExcelFile(fileName) {
    return /\.xlsx$/i.test(fileName);
  }

  function findEndOfCentralDirectory(view) {
    for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    throw new Error("Excelファイルを読み込めません");
  }

  async function inflateZipEntry(data, method) {
    if (method === 0) return new TextDecoder().decode(data);
    if (method !== 8) throw new Error("対応していない圧縮形式のExcelです");
    if (typeof DecompressionStream !== "function") {
      throw new Error("この端末ではExcelを読み込めません");
    }

    const stream = new Blob([data])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(stream).text();
  }

  async function readZipEntries(buffer, isWanted) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const eocd = findEndOfCentralDirectory(view);
    const count = view.getUint16(eocd + 10, true);
    const decoder = new TextDecoder();
    const entries = {};

    let offset = view.getUint32(eocd + 16, true);

    for (let index = 0; index < count; index += 1) {
      if (offset + 46 > view.byteLength) break;
      if (view.getUint32(offset, true) !== 0x02014b50) break;

      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = decoder.decode(
        bytes.subarray(offset + 46, offset + 46 + nameLength)
      );

      if (isWanted(name)) {
        if (compressedSize === 0xffffffff || localOffset === 0xffffffff) {
          throw new Error("対応していない形式のExcelです");
        }

        const dataStart =
          localOffset +
          30 +
          view.getUint16(localOffset + 26, true) +
          view.getUint16(localOffset + 28, true);
        entries[name] = await inflateZipEntry(
          bytes.subarray(dataStart, dataStart + compressedSize),
          method
        );
      }

      offset += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
  }

  function parseXml(text) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) {
      throw new Error("Excelの内容を解析できません");
    }
    return doc;
  }

  function parseSharedStrings(text) {
    if (!text) return [];
    return [...parseXml(text).querySelectorAll("sst > si")].map((item) =>
      [...item.querySelectorAll("t")].map((node) => node.textContent).join("")
    );
  }

  function columnIndex(reference) {
    const letters = String(reference || "").replace(/[^A-Z]/gi, "").toUpperCase();
    return [...letters].reduce(
      (total, letter) => total * 26 + (letter.charCodeAt(0) - 64),
      0
    ) - 1;
  }

  function readCellValue(cell, sharedStrings) {
    const type = cell.getAttribute("t");

    if (type === "s") {
      const index = Number(cell.querySelector("v")?.textContent);
      return sharedStrings[index] ?? "";
    }

    if (type === "inlineStr") {
      return [...cell.querySelectorAll("is t")]
        .map((node) => node.textContent)
        .join("");
    }

    return (cell.querySelector("v")?.textContent || "").trim();
  }

  async function readXlsxRows(buffer) {
    const entries = await readZipEntries(
      buffer,
      (name) =>
        name === "xl/sharedStrings.xml" ||
        /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)
    );

    const sheetName = Object.keys(entries)
      .filter((name) => name !== "xl/sharedStrings.xml")
      .sort(
        (a, b) =>
          Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1])
      )[0];
    if (!sheetName) throw new Error("Excelのシートが見つかりません");

    const sharedStrings = parseSharedStrings(entries["xl/sharedStrings.xml"]);
    const rows = [];

    parseXml(entries[sheetName])
      .querySelectorAll("sheetData > row")
      .forEach((rowNode) => {
        const cells = [];
        rowNode.querySelectorAll("c").forEach((cell) => {
          const index = columnIndex(cell.getAttribute("r"));
          if (index >= 0) cells[index] = readCellValue(cell, sharedStrings);
        });

        const row = Array.from({ length: cells.length }, (_, index) =>
          cells[index] === undefined ? "" : cells[index]
        );
        if (row.some(Boolean)) rows.push(row);
      });

    return rows;
  }

  async function importRecords(file) {
    try {
      const imported = isExcelFile(file.name)
        ? rowsToRecords(await readXlsxRows(await file.arrayBuffer()))
        : parseImportFile(await readImportText(file), file.name);
      if (imported.length === 0) {
        showToast("取り込める記録が見つかりませんでした");
        return;
      }

      records.push(...imported);
      saveRecords();
      renderRecords();
      drawChart();
      showToast(`${imported.length}件の記録を保存しました`);
    } catch (error) {
      console.error("記録の取り込みに失敗しました", error);
      showToast("ファイルを読み込めませんでした。CSV・JSON・Excel（.xlsx）形式を確認してください");
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2400);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const record = getFormRecord();

    if (!record.date || !record.store || record.split.length === 0) {
      showToast("日付・店舗・部位を入力してください");
      return;
    }

    if (
      record.bodyWeight === null ||
      record.bodyWeight <= 0
    ) {
      showToast("体重を正しく入力してください");
      return;
    }

    const existingIndex = records.findIndex(
      (item) => item.id === record.id
    );

    if (existingIndex >= 0) {
      records[existingIndex] = record;
      showToast("記録を更新しました");
    } else {
      records.push(record);
      showToast("記録を追加しました");
    }

    saveRecords();
    renderRecords();
    drawChart();
    resetForm();
  });

  cancelEditButton.addEventListener("click", () => {
    resetForm();
    showToast("編集をキャンセルしました");
  });

  resetButton.addEventListener("click", () => {
    setTimeout(resetForm, 0);
  });

  form.addEventListener("click", (event) => {
    const addButton = event.target.closest(".add-set-button");
    const removeButton = event.target.closest(".remove-set-button");

    if (addButton) {
      renderSetEntry(
        addButton.closest(".exercise-card").querySelector(".set-entry-list")
      );
    }

    if (removeButton) {
      const list = removeButton.closest(".set-entry-list");
      removeButton.closest(".set-entry").remove();
      if (!list.children.length) renderSetEntry(list);
    }
  });

  recordList.addEventListener("click", (event) => {
    const editButton = event.target.closest(".edit-button");
    const deleteButton = event.target.closest(".delete-button");

    if (editButton) {
      const record = records.find(
        (item) => item.id === editButton.dataset.id
      );

      if (record) {
        fillForm(record);
      }
    }

    if (deleteButton) {
      const id = deleteButton.dataset.id;
      const record = records.find((item) => item.id === id);

      if (!record) return;

      const confirmed = window.confirm(
        `${formatDate(record.date)}の記録を削除しますか？`
      );

      if (!confirmed) return;

      records = records.filter((item) => item.id !== id);
      saveRecords();
      renderRecords();
      drawChart();
      showToast("記録を削除しました");
    }
  });

  filterSplit.addEventListener("change", renderRecords);
  chartRange.addEventListener("change", drawChart);
  storeInput.addEventListener("change", updateOtherStoreVisibility);

  $("exportButton").addEventListener("click", exportCsv);
  $("exportTopButton").addEventListener("click", exportCsv);
  $("importButton").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    const [file] = importFile.files;
    if (file) importRecords(file);
    importFile.value = "";
  });

  $("clearAllButton").addEventListener("click", () => {
    if (records.length === 0) {
      showToast("削除する記録がありません");
      return;
    }

    const confirmed = window.confirm(
      "すべての記録を削除します。この操作は取り消せません。"
    );

    if (!confirmed) return;

    records = [];
    saveRecords();
    renderRecords();
    drawChart();
    resetForm();
    showToast("すべての記録を削除しました");
  });

  window.addEventListener("resize", drawChart);

  dateInput.value = getToday();
  updateOtherStoreVisibility();
  EXERCISES.forEach((exercise) => renderExerciseEntries(exercise.key));
  renderRecords();
  drawChart();
})();
