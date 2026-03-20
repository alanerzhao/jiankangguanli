const STORAGE_KEY = "health-manager-records";
const GOALS_KEY = "health-manager-goals";

const defaultGoals = {
  water: 2000,
  sleep: 8,
  steps: 8000,
  weight: 60,
  systolic: 120,
};

const form = document.querySelector("#healthForm");
const goalsForm = document.querySelector("#goalsForm");
const recordsBody = document.querySelector("#recordsBody");
const insights = document.querySelector("#insights");
const template = document.querySelector("#insightTemplate");

const recordDate = document.querySelector("#recordDate");
const waterInput = document.querySelector("#water");
const sleepInput = document.querySelector("#sleep");
const stepsInput = document.querySelector("#steps");
const weightInput = document.querySelector("#weight");
const systolicInput = document.querySelector("#systolic");
const diastolicInput = document.querySelector("#diastolic");
const moodInput = document.querySelector("#mood");
const notesInput = document.querySelector("#notes");

const goalWater = document.querySelector("#goalWater");
const goalSleep = document.querySelector("#goalSleep");
const goalSteps = document.querySelector("#goalSteps");
const goalWeight = document.querySelector("#goalWeight");
const goalSystolic = document.querySelector("#goalSystolic");

const avgWater = document.querySelector("#avgWater");
const avgSleep = document.querySelector("#avgSleep");
const avgSteps = document.querySelector("#avgSteps");
const moodTrend = document.querySelector("#moodTrend");
const latestWeight = document.querySelector("#latestWeight");
const latestBloodPressure = document.querySelector("#latestBloodPressure");
const dailyProgressBar = document.querySelector("#dailyProgressBar");
const dailyProgressText = document.querySelector("#dailyProgressText");

const exportBtn = document.querySelector("#exportBtn");
const importInput = document.querySelector("#importInput");
const clearBtn = document.querySelector("#clearBtn");

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getRecords() {
  return readStorage(STORAGE_KEY, []);
}

function getGoals() {
  return { ...defaultGoals, ...readStorage(GOALS_KEY, {}) };
}

function setToday() {
  recordDate.value = new Date().toISOString().slice(0, 10);
}

function fillGoalsForm() {
  const goals = getGoals();
  goalWater.value = goals.water;
  goalSleep.value = goals.sleep;
  goalSteps.value = goals.steps;
  goalWeight.value = goals.weight;
  goalSystolic.value = goals.systolic;
}

function formatMetric(value, suffix = "") {
  return value || value === 0 ? `${value}${suffix}` : "-";
}

function createInsight(title, body) {
  const node = template.content.cloneNode(true);
  node.querySelector(".insight-title").textContent = title;
  node.querySelector(".insight-body").textContent = body;
  insights.appendChild(node);
}

function renderRecords() {
  const records = getRecords()
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  recordsBody.innerHTML = "";

  if (!records.length) {
    recordsBody.innerHTML = '<tr><td colspan="8" class="empty-state">还没有记录，先填写今天的数据吧。</td></tr>';
    latestWeight.textContent = "-";
    latestBloodPressure.textContent = "-";
    return;
  }

  records.slice(0, 10).forEach((record) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${record.date}</td>
      <td>${formatMetric(record.water, " ml")}</td>
      <td>${formatMetric(record.sleep, " h")}</td>
      <td>${formatMetric(record.steps)}</td>
      <td>${formatMetric(record.weight, " kg")}</td>
      <td>${record.systolic && record.diastolic ? `${record.systolic}/${record.diastolic}` : "-"}</td>
      <td>${record.mood || "-"}</td>
      <td>${record.notes || "-"}</td>
    `;
    recordsBody.appendChild(tr);
  });

  const latest = records[0];
  latestWeight.textContent = latest.weight ? `${latest.weight} kg` : "-";
  latestBloodPressure.textContent =
    latest.systolic && latest.diastolic ? `${latest.systolic}/${latest.diastolic}` : "-";
}

function computeAverage(records, key) {
  const values = records.map((item) => Number(item[key])).filter((value) => !Number.isNaN(value) && value > 0);
  if (!values.length) {
    return null;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function renderSummary() {
  const records = getRecords()
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  const goals = getGoals();

  avgWater.textContent = records.length ? `${Math.round(computeAverage(records, "water") || 0)} ml` : "-";
  avgSleep.textContent = records.length ? `${(computeAverage(records, "sleep") || 0).toFixed(1)} h` : "-";
  avgSteps.textContent = records.length ? `${Math.round(computeAverage(records, "steps") || 0)}` : "-";
  moodTrend.textContent = records.length ? records[0].mood || "-" : "-";

  insights.innerHTML = "";

  if (!records.length) {
    createInsight("开始记录", "连续记录几天后，这里会自动生成你的饮水、睡眠和运动趋势建议。");
    updateDailyProgress(null);
    return;
  }

  const latest = records[0];
  const progressItems = [
    Number(latest.water) >= Number(goals.water),
    Number(latest.sleep) >= Number(goals.sleep),
    Number(latest.steps) >= Number(goals.steps),
    latest.weight ? Math.abs(Number(latest.weight) - Number(goals.weight)) <= 1 : false,
    latest.systolic ? Number(latest.systolic) <= Number(goals.systolic) : false,
  ];

  updateDailyProgress(progressItems);

  const waterAvg = computeAverage(records, "water");
  if (waterAvg !== null) {
    createInsight(
      "饮水观察",
      waterAvg >= goals.water
        ? "最近一周饮水量基本达到目标，继续保持这个节奏。"
        : `最近一周平均饮水约 ${Math.round(waterAvg)} ml，距离目标还差 ${Math.max(
            goals.water - Math.round(waterAvg),
            0
          )} ml。`
    );
  }

  const sleepAvg = computeAverage(records, "sleep");
  if (sleepAvg !== null) {
    createInsight(
      "睡眠观察",
      sleepAvg >= goals.sleep
        ? "最近睡眠时长表现不错，恢复状态大概率更稳定。"
        : `最近一周平均睡眠 ${sleepAvg.toFixed(1)} 小时，可以考虑提前安排休息。`
    );
  }

  const stepsAvg = computeAverage(records, "steps");
  if (stepsAvg !== null) {
    createInsight(
      "活动观察",
      stepsAvg >= goals.steps
        ? "近期活动量达标，说明你的日常运动比较稳定。"
        : `最近一周平均步数约 ${Math.round(stepsAvg)}，建议给自己安排更固定的步行时间。`
    );
  }

  if (latest.systolic && latest.diastolic) {
    createInsight(
      "血压提醒",
      Number(latest.systolic) > goals.systolic
        ? `最新血压 ${latest.systolic}/${latest.diastolic}，收缩压高于你的设定上限，建议留意饮食与休息。`
        : `最新血压 ${latest.systolic}/${latest.diastolic}，目前在你的设定范围内。`
    );
  }
}

function updateDailyProgress(progressItems) {
  if (!progressItems) {
    dailyProgressBar.style.width = "0%";
    dailyProgressText.textContent = "0 / 5 项达标";
    return;
  }

  const completed = progressItems.filter(Boolean).length;
  const percentage = Math.round((completed / progressItems.length) * 100);
  dailyProgressBar.style.width = `${percentage}%`;
  dailyProgressText.textContent = `${completed} / 5 项达标`;
}

function upsertRecord(newRecord) {
  const records = getRecords();
  const nextRecords = records.filter((record) => record.date !== newRecord.date);
  nextRecords.push(newRecord);
  writeStorage(STORAGE_KEY, nextRecords);
}

function resetFormForNextEntry() {
  waterInput.value = "";
  sleepInput.value = "";
  stepsInput.value = "";
  weightInput.value = "";
  systolicInput.value = "";
  diastolicInput.value = "";
  moodInput.value = "精力充沛";
  notesInput.value = "";
}

function renderAll() {
  fillGoalsForm();
  renderRecords();
  renderSummary();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const record = {
    date: recordDate.value,
    water: Number(waterInput.value) || null,
    sleep: Number(sleepInput.value) || null,
    steps: Number(stepsInput.value) || null,
    weight: Number(weightInput.value) || null,
    systolic: Number(systolicInput.value) || null,
    diastolic: Number(diastolicInput.value) || null,
    mood: moodInput.value,
    notes: notesInput.value.trim(),
  };

  upsertRecord(record);
  renderAll();
  resetFormForNextEntry();
  setToday();
});

goalsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextGoals = {
    water: Number(goalWater.value) || defaultGoals.water,
    sleep: Number(goalSleep.value) || defaultGoals.sleep,
    steps: Number(goalSteps.value) || defaultGoals.steps,
    weight: Number(goalWeight.value) || defaultGoals.weight,
    systolic: Number(goalSystolic.value) || defaultGoals.systolic,
  };
  writeStorage(GOALS_KEY, nextGoals);
  renderSummary();
});

exportBtn.addEventListener("click", () => {
  const payload = {
    goals: getGoals(),
    records: getRecords(),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `health-manager-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.records) || !parsed.goals || typeof parsed.goals !== "object") {
      throw new Error("invalid-data");
    }
    writeStorage(STORAGE_KEY, parsed.records);
    writeStorage(GOALS_KEY, parsed.goals);
    renderAll();
    importInput.value = "";
  } catch {
    alert("导入失败，请确认 JSON 文件格式正确。");
  }
});

clearBtn.addEventListener("click", () => {
  const confirmed = window.confirm("确定要清空全部健康记录和目标吗？");
  if (!confirmed) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(GOALS_KEY);
  fillGoalsForm();
  resetFormForNextEntry();
  renderAll();
  setToday();
});

setToday();
fillGoalsForm();
renderAll();
