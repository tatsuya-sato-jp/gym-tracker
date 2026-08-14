(() => {
  "use strict";

  const STORAGE_KEY = "workout-tracker-records-v1";

  const EXERCISES = [
    { key: "squat", label: "スクワット" },
    { key: "bench", label: "ベンチプレス" },
    { key: "deadlift", label: "デッドリフト" }
  ];

  const $ = (id) => document.getElementById(id);

  const form = $("workoutForm");
  const recordIdInput = $("recordId");
  const dateInput = $("date");
  const storeInput = $("store");
  const splitInput = $("split");
  const otherStoreInput = $("otherStore");
  const bodyWeightInput = $("bodyWeight");

  const formTitle = $("formTitle");
  const editingLabel = $("editingLabel");
  const submitButton = $("submitButton");
  const cancelEditButton = $("cancelEditButton");
  const resetButton = $("resetButton");

  const recordList = $("recordList");
  const emptyMessage = $("emptyMessage");
  const recordCount = $("recordCount");

  const filterSplit = $("filterSplit");
  const filterStore = $("filterStore");
  const importFile = $("importFile");

  const chart = $("weightChart");
  const chartEmpty = $("chartEmpty");
  const chartSummary = $("chartSummary");

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

  function normalizeSplits(value) {
    const values = Array.isArray(value)
      ? value
      : String(value || "").split(/[,、/]/);

    return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
  }

  function normalizeRecord(record) {
    return {
      ...record,
      split: normalizeSplits(record.split),
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
    const entries = Array.isArray(exercise.entries)
      ? exercise.entries.map(normalizeSetEntry).filter(hasSetValue)
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
      exercises,
      updatedAt: new Date().toISOString()
    };
  }

  function renderSetEntry(container, entry = {}) {
    const row = document.createElement("div");
    row.className = "set-entry";
    row.innerHTML = `
      <div class="exercise-inputs">
        <div class="field"><label>重量</label><div class="unit-input"><input type="number" name="weight" min="0" max="1000" step="0.5" placeholder="0" /><span class="unit">kg</span></div></div>
        <div class="field"><label>回数</label><div class="unit-input"><input type="number" name="reps" min="0" max="1000" step="1" placeholder="0" /><span class="unit">回</span></div></div>
        <div class="field"><label>セット数</label><div class="unit-input"><input type="number" name="sets" min="0" max="1000" step="1" placeholder="0" /><span class="unit">セット</span></div></div>
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

  function exerciseText(exercise) {
    if (!exercise) return "-";
    const entries = normalizeExercise(exercise).entries;
    if (!entries.length) return "-";
    return entries.map((entry) => {
      const values = [];
      if (entry.weight !== null) values.push(`${formatNumber(entry.weight)}kg`);
      if (entry.reps !== null) values.push(`${formatNumber(entry.reps)}回`);
      if (entry.sets !== null) values.push(`${formatNumber(entry.sets)}セット`);
      return values.join(" × ");
    }).join(" / ");
  }

  function getFilteredRecords() {
    const split = filterSplit.value;
    const storeKeyword = filterStore.value.trim().toLowerCase();

    return records
      .filter((record) => {
        const matchesSplit =
          !split || normalizeSplits(record.split).includes(split);
        const matchesStore =
          !storeKeyword ||
          String(record.store || "").toLowerCase().includes(storeKeyword);

        return matchesSplit && matchesStore;
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
          <div>
            <div class="record-date">${escapeHtml(formatDate(record.date))}</div>
            <div class="record-store">📍 ${escapeHtml(record.store || "店舗未入力")}</div>
          </div>
          <span class="badge">${escapeHtml(normalizeSplits(record.split).join(" / ") || "-")}</span>
        </div>

        <div class="record-details">
          <div class="detail">
            <div class="detail-label">体重</div>
            <div class="detail-value">
              ${escapeHtml(formatNumber(record.bodyWeight))}kg
            </div>
          </div>
          ${exercisesHtml}
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

    const data = records
      .filter(
        (record) =>
          record.date &&
          record.bodyWeight !== null &&
          record.bodyWeight !== undefined &&
          Number.isFinite(Number(record.bodyWeight))
      )
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    chartSummary.textContent = `${data.length}件`;

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
      bottom: 42,
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

    const labelStep = Math.max(1, Math.ceil(data.length / 5));

    data.forEach((item, index) => {
      if (
        index % labelStep !== 0 &&
        index !== data.length - 1
      ) {
        return;
      }

      const date = item.date.slice(5).replace("-", "/");
      context.fillStyle = "#6b7280";
      context.fillText(date, x(index), height - padding.bottom + 12);
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

  function getImportValue(row, headers, names) {
    const index = headers.findIndex((header) => names.includes(header));
    return index >= 0 ? row[index] || "" : "";
  }

  function normalizeImportDate(value) {
    const match = String(value || "").trim().match(
      /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?$/
    );
    if (!match) return "";
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  function createImportedRecord(data) {
    const exercises = data.exercises || {};
    const importExercise = (key, label) => {
      const source = exercises[key] || {};
      const details = source.entries ?? parseExerciseEntries(
        data[`${key}Entries`] ?? data[`${label}セット詳細(JSON)`]
      );
      return normalizeExercise({
        weight: source.weight ?? data[`${key}Weight`] ?? data[`${label}重量(kg)`],
        reps: source.reps ?? data[`${key}Reps`] ?? data[`${label}回数`],
        sets: source.sets ?? data[`${key}Sets`] ?? data[`${label}セット数`],
        entries: details
      });
    };
    const record = normalizeRecord({
      id: createId(),
      date: normalizeImportDate(data.date || data["日付"]),
      store: String(data.store || data["店舗"] || "").trim(),
      split: data.split || data.splits || data["部位"],
      bodyWeight: numberOrNull(data.bodyWeight ?? data["体重(kg)"] ?? data["体重"]),
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
    if (fileName.toLowerCase().endsWith(".json")) {
      const parsed = JSON.parse(text);
      const data = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(data)) throw new Error("JSONの記録形式が不正です");
      return data.map(createImportedRecord).filter(Boolean);
    }

    const delimiter = text.includes("\t") ? "\t" : ",";
    const rows = parseDelimited(text, delimiter);
    const headerIndex = rows.findIndex((row) => row.includes("日付") || row.includes("date"));
    if (headerIndex < 0) throw new Error("日付の見出しが見つかりません");

    const headers = rows[headerIndex].map((header) => header.replace(/^\uFEFF/, ""));
    return rows.slice(headerIndex + 1).map((row) => {
      const data = {
        date: getImportValue(row, headers, ["日付", "date"]),
        store: getImportValue(row, headers, ["店舗", "store"]),
        split: getImportValue(row, headers, ["部位", "split", "splits"]),
        bodyWeight: getImportValue(row, headers, ["体重(kg)", "体重", "bodyWeight"]),
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

  async function importRecords(file) {
    try {
      const imported = parseImportFile(await file.text(), file.name);
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
      showToast("ファイルを読み込めませんでした");
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
  filterStore.addEventListener("input", renderRecords);
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
