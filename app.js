const STORAGE_KEY = "health-manager-records";
const GOALS_KEY = "health-manager-goals";
const SYNC_META_KEY = "health-manager-sync-meta";
const MAGIC_LINK_META_KEY = "health-manager-magic-link-meta";

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

const periodConfigs = {
  "7d": { label: "最近 7 天", days: 7 },
  "30d": { label: "最近 30 天", days: 30 },
  month: { label: "本月", type: "month" },
  year: { label: "今年", type: "year" },
};

let activeMetric = "calories";
let activePeriod = "7d";
let supabaseClient = null;
let cloudSession = null;

const form = document.querySelector("#healthForm");
const goalsForm = document.querySelector("#goalsForm");
const recordsBody = document.querySelector("#recordsBody");
const insights = document.querySelector("#insights");
const reviewNotes = document.querySelector("#reviewNotes");
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
const periodButtons = document.querySelectorAll(".period-button");

const reviewRecordedDays = document.querySelector("#reviewRecordedDays");
const reviewGoalHitRate = document.querySelector("#reviewGoalHitRate");
const reviewSleepAverage = document.querySelector("#reviewSleepAverage");
const reviewWeightChange = document.querySelector("#reviewWeightChange");
const monthRecordedDays = document.querySelector("#monthRecordedDays");
const monthCaloriesAverage = document.querySelector("#monthCaloriesAverage");
const yearRecordedDays = document.querySelector("#yearRecordedDays");
const yearGoalHitRate = document.querySelector("#yearGoalHitRate");

const storageModeLabel = document.querySelector("#storageModeLabel");
const authStatusLabel = document.querySelector("#authStatusLabel");
const syncStatusLabel = document.querySelector("#syncStatusLabel");
const cloudMessage = document.querySelector("#cloudMessage");

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

function writeRecords(records) {
  writeStorage(STORAGE_KEY, records);
}

function getGoals() {
  return { ...defaultGoals, ...readStorage(GOALS_KEY, {}) };
}

function writeGoals(goals) {
  writeStorage(GOALS_KEY, goals);
}

function getCloudConfig() {
  const runtime = window.HEALTH_APP_CONFIG || {};
  return {
    url: runtime.supabaseUrl || "",
    anonKey: runtime.supabaseAnonKey || "",
    email: runtime.supabaseAuthEmail || "",
  };
}

function getSyncMeta() {
  return readStorage(SYNC_META_KEY, { lastSyncedAt: "" });
}

function writeSyncMeta(meta) {
  writeStorage(SYNC_META_KEY, meta);
}

function getMagicLinkMeta() {
  return readStorage(MAGIC_LINK_META_KEY, { requestedAt: "" });
}

function writeMagicLinkMeta(meta) {
  writeStorage(MAGIC_LINK_META_KEY, meta);
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

function formatDateTime(value) {
  if (!value) {
    return "尚未同步";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(
    2,
    "0"
  )}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function createInsight(title, body) {
  const node = template.content.cloneNode(true);
  node.querySelector(".insight-title").textContent = title;
  node.querySelector(".insight-body").textContent = body;
  insights.appendChild(node);
}

function createReviewNote(title, body) {
  const article = document.createElement("article");
  article.className = "review-note";
  article.innerHTML = `<h3>${title}</h3><p>${body}</p>`;
  reviewNotes.appendChild(article);
}

function computeAverage(records, key) {
  const values = records.map((item) => Number(item[key])).filter((value) => !Number.isNaN(value) && value > 0);
  if (!values.length) {
    return null;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function compareRecordsAsc(a, b) {
  return a.date.localeCompare(b.date);
}

function compareRecordsDesc(a, b) {
  return b.date.localeCompare(a.date);
}

function getMonthBounds(baseDate = new Date()) {
  return {
    year: baseDate.getFullYear(),
    month: baseDate.getMonth(),
  };
}

function isSameMonth(dateString, bounds) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.getFullYear() === bounds.year && date.getMonth() === bounds.month;
}

function isSameYear(dateString, year) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.getFullYear() === year;
}

function getRecordsForPeriod(period) {
  const records = getRecords().slice().sort(compareRecordsAsc);
  if (!records.length) {
    return [];
  }

  const today = new Date();
  if (period === "month") {
    const monthBounds = getMonthBounds(today);
    return records.filter((record) => isSameMonth(record.date, monthBounds));
  }

  if (period === "year") {
    return records.filter((record) => isSameYear(record.date, today.getFullYear()));
  }

  const days = periodConfigs[period].days;
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffString = cutoff.toISOString().slice(0, 10);
  return records.filter((record) => record.date >= cutoffString);
}

function computeDayGoalHits(record, goals) {
  return [
    Number(record.water) >= Number(goals.water),
    Number(record.sleep) >= Number(goals.sleep),
    Number(record.steps) >= Number(goals.steps),
    record.calories ? Number(record.calories) <= Number(goals.calories) : false,
    record.weight ? Math.abs(Number(record.weight) - Number(goals.weight)) <= 1 : false,
  ];
}

function renderRecords() {
  const records = getRecords().slice().sort(compareRecordsDesc);

  recordsBody.innerHTML = "";

  if (!records.length) {
    recordsBody.innerHTML = '<tr><td colspan="8" class="empty-state">还没有记录，先填写今天的数据吧。</td></tr>';
    latestWeight.textContent = "-";
    latestCalories.textContent = "-";
    return;
  }

  records.slice(0, 20).forEach((record) => {
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
  const records = getRecords().slice().sort(compareRecordsDesc).slice(0, 7);
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
  updateDailyProgress(computeDayGoalHits(latest, goals));

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

function renderReview() {
  const records = getRecords().slice().sort(compareRecordsAsc);
  const periodRecords = getRecordsForPeriod(activePeriod);
  const goals = getGoals();
  const today = new Date();
  const monthRecords = records.filter((record) => isSameMonth(record.date, getMonthBounds(today)));
  const yearRecords = records.filter((record) => isSameYear(record.date, today.getFullYear()));

  reviewNotes.innerHTML = "";

  if (!periodRecords.length) {
    reviewRecordedDays.textContent = "-";
    reviewGoalHitRate.textContent = "-";
    reviewSleepAverage.textContent = "-";
    reviewWeightChange.textContent = "-";
    monthRecordedDays.textContent = "-";
    monthCaloriesAverage.textContent = "-";
    yearRecordedDays.textContent = "-";
    yearGoalHitRate.textContent = "-";
    createReviewNote("还没有足够的数据", "继续按天记录，系统会逐步形成周、月、年的健康复盘。");
    return;
  }

  const dayScores = periodRecords.map((record) => {
    const hits = computeDayGoalHits(record, goals);
    return hits.filter(Boolean).length / hits.length;
  });
  const hitRate = Math.round((dayScores.reduce((sum, value) => sum + value, 0) / dayScores.length) * 100);
  const sleepAverage = computeAverage(periodRecords, "sleep");
  const weightRecords = periodRecords.filter((record) => safeNumber(record.weight) !== null);
  const firstWeight = weightRecords[0] ? Number(weightRecords[0].weight) : null;
  const lastWeight = weightRecords[weightRecords.length - 1] ? Number(weightRecords[weightRecords.length - 1].weight) : null;
  const weightDiff =
    firstWeight !== null && lastWeight !== null ? Math.round((lastWeight - firstWeight) * 10) / 10 : null;

  reviewRecordedDays.textContent = `${periodRecords.length} 天`;
  reviewGoalHitRate.textContent = `${hitRate}%`;
  reviewSleepAverage.textContent = sleepAverage !== null ? `${sleepAverage.toFixed(1)} h` : "-";
  reviewWeightChange.textContent =
    weightDiff === null ? "-" : `${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)} kg`;

  monthRecordedDays.textContent = `${monthRecords.length} 天`;
  monthCaloriesAverage.textContent = monthRecords.length
    ? `${Math.round(computeAverage(monthRecords, "calories") || 0)} kcal`
    : "-";
  yearRecordedDays.textContent = `${yearRecords.length} 天`;
  yearGoalHitRate.textContent = yearRecords.length
    ? `${Math.round(
        (yearRecords
          .map((record) => computeDayGoalHits(record, goals).filter(Boolean).length / 5)
          .reduce((sum, value) => sum + value, 0) /
          yearRecords.length) *
          100
      )}%`
    : "-";

  const bestDay = periodRecords
    .map((record) => ({ record, score: computeDayGoalHits(record, goals).filter(Boolean).length }))
    .sort((a, b) => b.score - a.score)[0];

  if (bestDay) {
    createReviewNote("最佳状态日", `${bestDay.record.date} 达成了 ${bestDay.score}/5 项目标，是这一阶段节奏最稳的一天。`);
  }

  const caloriesAverage = computeAverage(periodRecords, "calories");
  if (caloriesAverage !== null) {
    createReviewNote(
      "饮食控制",
      caloriesAverage <= goals.calories
        ? `这段时间平均热量控制在 ${Math.round(caloriesAverage)} kcal，整体比较稳。`
        : `这段时间平均热量 ${Math.round(caloriesAverage)} kcal，高于目标，适合继续观察晚餐和零食。`
    );
  }

  if (weightDiff !== null) {
    createReviewNote(
      "体重变化",
      weightDiff === 0
        ? "体重整体保持平稳。"
        : weightDiff > 0
        ? `体重较期初增加了 ${weightDiff.toFixed(1)} kg，可以结合热量和活动量一起看。`
        : `体重较期初下降了 ${Math.abs(weightDiff).toFixed(1)} kg，说明近期控制有一定效果。`
    );
  }
}

function renderTrendChart() {
  const records = getRecordsForPeriod(activePeriod);
  const goals = getGoals();
  const metricConfig = chartMetrics[activeMetric];
  const goalValue = safeNumber(goals[activeMetric]);

  trendButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.metric === activeMetric);
  });

  periodButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.period === activePeriod);
  });

  if (!records.length) {
    chartSummary.textContent = `${periodConfigs[activePeriod].label}${metricConfig.label}`;
    chartCaption.textContent = "继续记录后，这里会展示你的走势变化。";
    trendChart.innerHTML = '<div class="chart-empty">还没有足够的数据来绘制趋势图。</div>';
    return;
  }

  const values = records.map((record) => Number(record[activeMetric]) || 0);
  const maxValue = Math.max(...values, goalValue || 0, 1);
  const minValue = Math.min(...values, goalValue || maxValue);
  const range = Math.max(maxValue - minValue, maxValue * 0.25, 1);
  const width = 720;
  const height = 300;
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

  chartSummary.textContent = `${periodConfigs[activePeriod].label}${metricConfig.label}`;
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

  const labelStep = values.length > 16 ? 2 : 1;
  const valueBadges = points
    .filter((_, index) => index % labelStep === 0 || index === values.length - 1)
    .map(
      (point) => `
        <text x="${point.x}" y="${Math.max(point.y - 12, 18)}" text-anchor="middle" class="chart-value-label">${point.value}</text>
      `
    )
    .join("");

  const goalLine =
    goalValue && goalValue > 0
      ? (() => {
          const goalY = height - paddingY - ((goalValue - minValue) / range) * chartHeight;
          return `
            <line x1="${paddingX}" y1="${goalY}" x2="${width - paddingX}" y2="${goalY}" class="chart-goal-line" />
            <text x="${width - paddingX}" y="${Math.max(goalY - 8, 16)}" text-anchor="end" class="chart-goal-label">目标 ${goalValue}</text>
          `;
        })()
      : "";

  trendChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="${metricConfig.label}${periodConfigs[activePeriod].label}趋势图">
      ${gridLines}
      ${goalLine}
      <polyline points="${polyline}" class="chart-line" style="stroke:${metricConfig.color}"></polyline>
      ${labels}
      ${valueBadges}
    </svg>
  `;
}

function updateCloudStatus() {
  const config = getCloudConfig();
  const syncMeta = getSyncMeta();
  const configured = Boolean(config.url && config.anonKey);
  storageModeLabel.textContent = configured ? "本地 + 云端" : "仅本地";
  authStatusLabel.textContent = cloudSession?.user?.email || "未登录";
  syncStatusLabel.textContent = formatDateTime(syncMeta.lastSyncedAt);
}

function showCloudMessage(message) {
  cloudMessage.textContent = message;
}

function createSupabaseClient() {
  const config = getCloudConfig();
  if (!config.url || !config.anonKey || !window.supabase?.createClient) {
    supabaseClient = null;
    return null;
  }

  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  return supabaseClient;
}

async function restoreCloudSession() {
  const client = supabaseClient || createSupabaseClient();
  if (!client) {
    cloudSession = null;
    updateCloudStatus();
    return;
  }

  const { data, error } = await client.auth.getSession();
  cloudSession = error ? null : data.session;
  updateCloudStatus();
  if (cloudSession?.user) {
    writeMagicLinkMeta({ requestedAt: "" });
    await syncCloudToLocal(true);
  } else {
    await maybeRequestMagicLink();
  }

  client.auth.onAuthStateChange(async (_event, session) => {
    cloudSession = session;
    updateCloudStatus();
    if (cloudSession?.user) {
      writeMagicLinkMeta({ requestedAt: "" });
      await syncCloudToLocal(true);
    }
  });
}

function normalizeCloudRecords(records, userId) {
  return records.map((record) => ({
    user_id: userId,
    record_date: record.date,
    water: safeNumber(record.water),
    sleep: safeNumber(record.sleep),
    steps: safeNumber(record.steps),
    calories: safeNumber(record.calories),
    weight: safeNumber(record.weight),
    mood: record.mood || null,
    notes: record.notes || null,
  }));
}

async function syncLocalToCloud(silent = false) {
  const client = supabaseClient || createSupabaseClient();
  if (!client) {
    if (!silent) {
      showCloudMessage("请先在 config.js 中填写 Supabase 配置。");
    }
    return;
  }

  if (!cloudSession?.user) {
    if (!silent) {
      showCloudMessage("正在等待云端身份完成绑定。");
    }
    return;
  }

  const recordsPayload = normalizeCloudRecords(getRecords(), cloudSession.user.id);
  const goalsPayload = { user_id: cloudSession.user.id, ...getGoals() };

  const recordsResult = await client.from("health_records").upsert(recordsPayload, {
    onConflict: "user_id,record_date",
  });
  if (recordsResult.error) {
    if (!silent) {
      showCloudMessage(`上传记录失败：${recordsResult.error.message}`);
    }
    return;
  }

  const goalsResult = await client.from("health_goals").upsert(goalsPayload, {
    onConflict: "user_id",
  });
  if (goalsResult.error) {
    if (!silent) {
      showCloudMessage(`上传目标失败：${goalsResult.error.message}`);
    }
    return;
  }

  writeSyncMeta({ lastSyncedAt: new Date().toISOString() });
  updateCloudStatus();
  if (!silent) {
    showCloudMessage("数据已自动保存到云端。");
  }
}

async function syncCloudToLocal(silent = false) {
  const client = supabaseClient || createSupabaseClient();
  if (!client) {
    if (!silent) {
      showCloudMessage("请先在 config.js 中填写 Supabase 配置。");
    }
    return;
  }

  if (!cloudSession?.user) {
    if (!silent) {
      showCloudMessage("正在等待云端身份完成绑定。");
    }
    return;
  }

  const [{ data: recordsData, error: recordsError }, { data: goalsData, error: goalsError }] = await Promise.all([
    client
      .from("health_records")
      .select("record_date, water, sleep, steps, calories, weight, mood, notes")
      .eq("user_id", cloudSession.user.id)
      .order("record_date", { ascending: true }),
    client.from("health_goals").select("water, sleep, steps, calories, weight").eq("user_id", cloudSession.user.id).single(),
  ]);

  if (recordsError) {
    if (!silent) {
      showCloudMessage(`拉取记录失败：${recordsError.message}`);
    }
    return;
  }

  if (goalsError && goalsError.code !== "PGRST116") {
    if (!silent) {
      showCloudMessage(`拉取目标失败：${goalsError.message}`);
    }
    return;
  }

  const normalizedRecords = (recordsData || []).map((record) => ({
    date: record.record_date,
    water: record.water,
    sleep: record.sleep,
    steps: record.steps,
    calories: record.calories,
    weight: record.weight,
    mood: record.mood,
    notes: record.notes || "",
  }));

  writeRecords(normalizedRecords);
  if (goalsData) {
    writeGoals({
      water: goalsData.water,
      sleep: goalsData.sleep,
      steps: goalsData.steps,
      calories: goalsData.calories,
      weight: goalsData.weight,
    });
  }

  writeSyncMeta({ lastSyncedAt: new Date().toISOString() });
  renderAll();
  if (!silent) {
    showCloudMessage("已从云端更新到当前设备。");
  }
}

async function maybeRequestMagicLink() {
  const client = supabaseClient || createSupabaseClient();
  const config = getCloudConfig();
  const meta = getMagicLinkMeta();
  if (!client || !config.email) {
    return;
  }

  const lastRequested = meta.requestedAt ? new Date(meta.requestedAt).getTime() : 0;
  const now = Date.now();
  if (lastRequested && now - lastRequested < 10 * 60 * 1000) {
    showCloudMessage("已向你的邮箱发送登录链接，完成一次授权后会自动开始云同步。");
    return;
  }

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await client.auth.signInWithOtp({
    email: config.email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    showCloudMessage(`云端登录初始化失败：${error.message}`);
    return;
  }

  writeMagicLinkMeta({ requestedAt: new Date().toISOString() });
  showCloudMessage(`已向 ${config.email} 发送一次登录链接，完成后页面会自动读写 Supabase。`);
}

async function maybeAutoSyncRecord(record) {
  const client = supabaseClient || createSupabaseClient();
  if (!client || !cloudSession?.user) {
    return;
  }

  await client.from("health_records").upsert(normalizeCloudRecords([record], cloudSession.user.id), {
    onConflict: "user_id,record_date",
  });

  writeSyncMeta({ lastSyncedAt: new Date().toISOString() });
  updateCloudStatus();
  showCloudMessage("当前记录已自动保存到云端。");
}

async function maybeAutoSyncGoals(goals) {
  const client = supabaseClient || createSupabaseClient();
  if (!client || !cloudSession?.user) {
    return;
  }

  await client.from("health_goals").upsert({ user_id: cloudSession.user.id, ...goals }, { onConflict: "user_id" });
  writeSyncMeta({ lastSyncedAt: new Date().toISOString() });
  updateCloudStatus();
  showCloudMessage("目标已自动同步到云端。");
}

function upsertRecord(newRecord) {
  const records = getRecords();
  const nextRecords = records.filter((record) => record.date !== newRecord.date);
  nextRecords.push(newRecord);
  writeRecords(nextRecords);
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
  renderReview();
  renderTrendChart();
  updateCloudStatus();
}

form.addEventListener("submit", async (event) => {
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
  await maybeAutoSyncRecord(record);
  renderAll();
  resetFormForNextEntry();
  setToday();
});

goalsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nextGoals = {
    water: Number(goalWater.value) || defaultGoals.water,
    sleep: Number(goalSleep.value) || defaultGoals.sleep,
    steps: Number(goalSteps.value) || defaultGoals.steps,
    calories: Number(goalCalories.value) || defaultGoals.calories,
    weight: Number(goalWeight.value) || defaultGoals.weight,
  };
  writeGoals(nextGoals);
  await maybeAutoSyncGoals(nextGoals);
  renderAll();
});

periodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activePeriod = button.dataset.period;
    renderReview();
    renderTrendChart();
  });
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
    cloud: {
      configured: Boolean(getCloudConfig().url && getCloudConfig().anonKey),
      lastSyncedAt: getSyncMeta().lastSyncedAt || null,
    },
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
    writeRecords(parsed.records);
    writeGoals(parsed.goals);
    renderAll();
    importInput.value = "";
    showCloudMessage("本地导入成功。");
  } catch {
    alert("导入失败，请确认 JSON 文件格式正确。");
  }
});

clearBtn.addEventListener("click", () => {
  const confirmed = window.confirm("确定要清空当前浏览器中的全部健康记录和目标吗？这不会自动删除 Supabase 云端数据。");
  if (!confirmed) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(GOALS_KEY);
  localStorage.removeItem(MAGIC_LINK_META_KEY);
  fillGoalsForm();
  resetFormForNextEntry();
  renderAll();
  setToday();
  showCloudMessage("当前浏览器里的本地数据已清空。");
});

setToday();
fillGoalsForm();
createSupabaseClient();
restoreCloudSession();
renderAll();
