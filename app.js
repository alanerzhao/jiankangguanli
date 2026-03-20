const STORAGE_KEY = "health-manager-records";
const GOALS_KEY = "health-manager-goals";

const defaultGoals = {
  water: 2000,
  sleep: 8,
  steps: 8000,
  calories: 1800,
  weight: 60,
};

const chartMetrics = {
  water: { label: "饮水", unit: "ml", color: "#2f74ff" },
  sleep: { label: "睡眠", unit: "h", color: "#19b65a" },
  steps: { label: "步数", unit: "步", color: "#c56d2d" },
  calories: { label: "热量", unit: "kcal", color: "#ff6a3d" },
  weight: { label: "体重", unit: "kg", color: "#16605f" },
};

let activeMetric = "calories";

const form = document.querySelector("#healthForm");
const goalsForm = document.querySelector("#goalsForm");
const recordsBody = document.querySelector("#recordsBody");
const insights = document.querySelector("#insights");
const template = document.querySelector("#insightTemplate");

const recordDate = document.querySelector("#recordDate");
const waterInput = document.querySelector("#water");
const sleepInput = document.querySelector("#sleep");
const stepsInput = document.querySelector("#steps");
const caloriesInput = document.querySelector("#calories");
const weightInput = document.querySelector("#weight");
const moodInput = document.querySelector("#mood");
const notesInput = document.querySelector("#notes");

const goalWater = document.querySelector("#goalWater");
const goalSleep = document.querySelector("#goalSleep");
const goalSteps = document.querySelector("#goalSteps");
const goalCalories = document.querySelector("#goalCalories");
const goalWeight = document.querySelector("#goalWeight");

const avgWater = document.querySelector("#avgWater");
const avgSleep = document.querySelector("#avgSleep");
const avgSteps = document.querySelector("#avgSteps");
const avgCalories = document.querySelector("#avgCalories");
const latestWeight = document.querySelector("#latestWeight");
const latestCalories = document.querySelector("#latestCalories");
const dailyProgressBar = document.querySelector("#dailyProgressBar");
const dailyProgressText = document.querySelector("#dailyProgressText");
const chartSummary = document.querySelector("#chartSummary");
const chartCaption = document.querySelector("#chartCaption");
const trendChart = document.querySelector("#trendChart");
const trendButtons = document.querySelectorAll(".trend-button");

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
  goalCalories.value = goals.calories;
  goalWeight.value = goals.weight;
}

function formatMetric(value, suffix = "") {
  return value || value === 0 ? `${value}${suffix}` : "-";
}

function formatDateLabel(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function createInsight(title, body) {
  const node = template.content.cloneNode(true);
  node.querySelector(".insight-title").textContent = title;
  node.querySelector(".insight-body").textContent = body;
  insights.appendChild(node);
}

function computeAverage(records, key) {
  const values = records.map((item) => Number(item[key])).filter((value) => !Number.isNaN(value) && value > 0);
  if (!values.length) {
    return null;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function renderRecords() {
  const records = getRecords()
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  recordsBody.innerHTML = "";

  if (!records.length) {
    recordsBody.innerHTML = '<tr><td colspan="8" class="empty-state">还没有记录，先填写今天的数据吧。</td></tr>';
    latestWeight.textContent = "-";
    latestCalories.textContent = "-";
    return;
  }

  records.slice(0, 10).forEach((record) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${record.date}</td>
      <td>${formatMetric(record.water, " ml")}</td>
      <td>${formatMetric(record.sleep, " h")}</td>
      <td>${formatMetric(record.steps, " 步")}</td>
      <td>${formatMetric(record.calories, " kcal")}</td>
      <td>${formatMetric(record.weight, " kg")}</td>
      <td>${record.mood || "-"}</td>
      <td>${record.notes || "-"}</td>
    `;
    recordsBody.appendChild(tr);
  });

  const latest = records[0];
  latestWeight.textContent = latest.weight ? `${latest.weight} kg` : "-";
  latestCalories.textContent = latest.calories ? `${latest.calories} kcal` : "-";
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

function renderSummary() {
  const records = getRecords()
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  const goals = getGoals();

  avgWater.textContent = records.length ? `${Math.round(computeAverage(records, "water") || 0)} ml` : "-";
  avgSleep.textContent = records.length ? `${(computeAverage(records, "sleep") || 0).toFixed(1)} h` : "-";
  avgSteps.textContent = records.length ? `${Math.round(computeAverage(records, "steps") || 0)} 步` : "-";
  avgCalories.textContent = records.length ? `${Math.round(computeAverage(records, "calories") || 0)} kcal` : "-";

  insights.innerHTML = "";

  if (!records.length) {
    createInsight("开始记录", "连续记录几天后，这里会自动生成你的饮水、睡眠、运动和热量趋势建议。");
    updateDailyProgress(null);
    return;
  }

  const latest = records[0];
  const progressItems = [
    Number(latest.water) >= Number(goals.water),
    Number(latest.sleep) >= Number(goals.sleep),
    Number(latest.steps) >= Number(goals.steps),
    latest.calories ? Number(latest.calories) <= Number(goals.calories) : false,
    latest.weight ? Math.abs(Number(latest.weight) - Number(goals.weight)) <= 1 : false,
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

  const caloriesAvg = computeAverage(records, "calories");
  if (caloriesAvg !== null) {
    createInsight(
      "饮食热量",
      caloriesAvg <= goals.calories
        ? `最近一周平均热量约 ${Math.round(caloriesAvg)} kcal，整体控制在目标内。`
        : `最近一周平均热量约 ${Math.round(caloriesAvg)} kcal，超出目标约 ${Math.round(
            caloriesAvg - goals.calories
          )} kcal。`
    );
  }

  if (latest.mood) {
    createInsight("状态记录", `最新一次心情是“${latest.mood}”，可以结合趋势图一起看作息和饮食变化。`);
  }
}

function getLastSevenDaysRecords() {
  return getRecords()
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);
}

function renderTrendChart() {
  const records = getLastSevenDaysRecords();
  const metricConfig = chartMetrics[activeMetric];

  trendButtons.forEach((button) => {
    const isActive = button.dataset.metric === activeMetric;
    button.classList.toggle("is-active", isActive);
  });

  if (!records.length) {
    chartSummary.textContent = `${metricConfig.label}趋势`;
    chartCaption.textContent = "记录 7 天后，这里会展示你的走势变化。";
    trendChart.innerHTML = '<div class="chart-empty">还没有足够的数据来绘制趋势图。</div>';
    return;
  }

  const values = records.map((record) => Number(record[activeMetric]) || 0);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values);
  const range = Math.max(maxValue - minValue, maxValue * 0.25, 1);
  const width = 640;
  const height = 260;
  const paddingX = 42;
  const paddingY = 24;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = values.map((value, index) => {
    const x = paddingX + (chartWidth / Math.max(values.length - 1, 1)) * index;
    const normalized = (value - minValue) / range;
    const y = height - paddingY - normalized * chartHeight;
    return { x, y, value, date: records[index].date };
  });

  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const average = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  const latestValue = values[values.length - 1];

  chartSummary.textContent = `最近 7 天${metricConfig.label}`;
  chartCaption.textContent = `最新 ${formatMetric(latestValue, ` ${metricConfig.unit}`)}，平均 ${average} ${metricConfig.unit}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = paddingY + chartHeight * ratio;
      return `<line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" class="chart-grid-line" />`;
    })
    .join("");

  const labels = points
    .map(
      (point) => `
        <g>
          <circle cx="${point.x}" cy="${point.y}" r="5" fill="${metricConfig.color}" />
          <text x="${point.x}" y="${height - 4}" text-anchor="middle" class="chart-axis-label">${formatDateLabel(
            point.date
          )}</text>
        </g>
      `
    )
    .join("");

  const valueBadges = points
    .map(
      (point) => `
        <text x="${point.x}" y="${Math.max(point.y - 12, 18)}" text-anchor="middle" class="chart-value-label">${point.value}</text>
      `
    )
    .join("");

  trendChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="${metricConfig.label}近 7 日趋势图">
      ${gridLines}
      <polyline points="${polyline}" class="chart-line" style="stroke:${metricConfig.color}"></polyline>
      ${labels}
      ${valueBadges}
    </svg>
  `;
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
  caloriesInput.value = "";
  weightInput.value = "";
  moodInput.value = "精力充沛";
  notesInput.value = "";
}

function renderAll() {
  fillGoalsForm();
  renderRecords();
  renderSummary();
  renderTrendChart();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const record = {
    date: recordDate.value,
    water: Number(waterInput.value) || null,
    sleep: Number(sleepInput.value) || null,
    steps: Number(stepsInput.value) || null,
    calories: Number(caloriesInput.value) || null,
    weight: Number(weightInput.value) || null,
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
    calories: Number(goalCalories.value) || defaultGoals.calories,
    weight: Number(goalWeight.value) || defaultGoals.weight,
  };
  writeStorage(GOALS_KEY, nextGoals);
  renderAll();
});

trendButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeMetric = button.dataset.metric;
    renderTrendChart();
  });
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
