const STORAGE_KEY = "health-manager-records";
const GOALS_KEY = "health-manager-goals";
const SYNC_META_KEY = "health-manager-sync-meta";
const MAGIC_LINK_META_KEY = "health-manager-magic-link-meta";

const metricMeta = {
  water: {
    label: "饮水",
    unit: "ml",
    color: "#2f74ff",
    type: "minimum",
    formatter: (value) => `${Math.round(value)} ml`,
  },
  sleep: {
    label: "睡眠",
    unit: "h",
    color: "#19b65a",
    type: "minimum",
    formatter: (value) => `${value.toFixed(1)} h`,
  },
  steps: {
    label: "步数",
    unit: "步",
    color: "#c56d2d",
    type: "minimum",
    formatter: (value) => `${Math.round(value)} 步`,
  },
  calories: {
    label: "热量",
    unit: "kcal",
    color: "#ff6a3d",
    type: "maximum",
    formatter: (value) => `${Math.round(value)} kcal`,
  },
  weight: {
    label: "体重",
    unit: "kg",
    color: "#16605f",
    type: "target",
    formatter: (value) => `${value.toFixed(1)} kg`,
  },
};

const metricOrder = ["water", "sleep", "steps", "calories", "weight"];

const defaultGoals = {
  water: 2000,
  sleep: 8,
  steps: 8000,
  calories: 1800,
  weight: 60,
};

const periodConfigs = {
  "7d": { label: "最近 7 天", days: 7 },
  "30d": { label: "最近 30 天", days: 30 },
  month: { label: "本月", type: "month" },
  year: { label: "今年", type: "year" },
};

let activeMetric = "calories";
let activePeriod = "7d";
let editingDate = null;
let supabaseClient = null;
let cloudSession = null;

const form = document.querySelector("#healthForm");
const goalsForm = document.querySelector("#goalsForm");
const focusCards = document.querySelector("#focusCards");
const recordsBody = document.querySelector("#recordsBody");
const reviewNotes = document.querySelector("#reviewNotes");

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

const todayHealthScore = document.querySelector("#todayHealthScore");
const heroStatusTitle = document.querySelector("#heroStatusTitle");
const heroStatusBody = document.querySelector("#heroStatusBody");
const dailyProgressBar = document.querySelector("#dailyProgressBar");
const dailyProgressText = document.querySelector("#dailyProgressText");
const latestWeight = document.querySelector("#latestWeight");
const latestCalories = document.querySelector("#latestCalories");
const recordStreakEl = document.querySelector("#recordStreak");
const goalStreakEl = document.querySelector("#goalStreak");
const encouragementText = document.querySelector("#encouragementText");
const consistencyScore = document.querySelector("#consistencyScore");
const monthCheckins = document.querySelector("#monthCheckins");

const nextActionTitle = document.querySelector("#nextActionTitle");
const nextActionBody = document.querySelector("#nextActionBody");
const highlightTitle = document.querySelector("#highlightTitle");
const highlightBody = document.querySelector("#highlightBody");

const reviewRecordedDays = document.querySelector("#reviewRecordedDays");
const reviewGoalHitRate = document.querySelector("#reviewGoalHitRate");
const reviewSleepAverage = document.querySelector("#reviewSleepAverage");
const reviewWeightChange = document.querySelector("#reviewWeightChange");
const monthRecordedDays = document.querySelector("#monthRecordedDays");
const monthCaloriesAverage = document.querySelector("#monthCaloriesAverage");
const yearRecordedDays = document.querySelector("#yearRecordedDays");
const yearGoalHitRate = document.querySelector("#yearGoalHitRate");

const chartSummary = document.querySelector("#chartSummary");
const chartCaption = document.querySelector("#chartCaption");
const trendChart = document.querySelector("#trendChart");
const trendButtons = document.querySelectorAll(".trend-button");
const periodButtons = document.querySelectorAll(".period-button");

const storageModeLabel = document.querySelector("#storageModeLabel");
const authStatusLabel = document.querySelector("#authStatusLabel");
const syncStatusLabel = document.querySelector("#syncStatusLabel");
const cloudMessage = document.querySelector("#cloudMessage");

const formStateLabel = document.querySelector("#formStateLabel");
const formFeedback = document.querySelector("#formFeedback");
const saveRecordBtn = document.querySelector("#saveRecordBtn");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const deleteEditingBtn = document.querySelector("#deleteEditingBtn");

const exportBtn = document.querySelector("#exportBtn");
const importInput = document.querySelector("#importInput");
const clearBtn = document.querySelector("#clearBtn");
const quickChips = document.querySelectorAll(".quick-chip");

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

function getCloudConfig() {
  const runtime = window.HEALTH_APP_CONFIG || {};
  return {
    url: runtime.supabaseUrl || "",
    anonKey: runtime.supabaseAnonKey || "",
    email: runtime.supabaseAuthEmail || "",
  };
}

function compareRecordsAsc(a, b) {
  return a.date.localeCompare(b.date);
}

function compareRecordsDesc(a, b) {
  return b.date.localeCompare(a.date);
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
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

function formatValue(key, value) {
  if (value === null || value === undefined) {
    return "-";
  }
  return metricMeta[key].formatter(Number(value));
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
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
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

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (periodConfigs[period].days - 1));
  const cutoffString = cutoff.toISOString().slice(0, 10);
  return records.filter((record) => record.date >= cutoffString);
}

function getRecordByDate(date) {
  return getRecords().find((record) => record.date === date) || null;
}

function getTodayRecord() {
  return getRecordByDate(new Date().toISOString().slice(0, 10));
}

function buildRecordFromForm() {
  return {
    date: recordDate.value,
    water: safeNumber(waterInput.value),
    sleep: safeNumber(sleepInput.value),
    steps: safeNumber(stepsInput.value),
    calories: safeNumber(caloriesInput.value),
    weight: safeNumber(weightInput.value),
    mood: moodInput.value,
    notes: notesInput.value.trim(),
  };
}

function computeMetricStatus(key, value, goal) {
  if (value === null || value === undefined) {
    return {
      achieved: false,
      progress: 0,
      status: "今天还没记录",
    };
  }

  if (metricMeta[key].type === "minimum") {
    const progress = Math.min(Math.round((Number(value) / Number(goal)) * 100), 100);
    return {
      achieved: Number(value) >= Number(goal),
      progress,
      status: Number(value) >= Number(goal) ? "已达标" : `还差 ${formatValue(key, goal - value)}`,
    };
  }

  if (metricMeta[key].type === "maximum") {
    if (Number(value) <= Number(goal)) {
      return {
        achieved: true,
        progress: 100,
        status: "控制在线",
      };
    }
    const overflow = Number(value) - Number(goal);
    const progress = Math.max(0, 100 - Math.round((overflow / Number(goal)) * 100));
    return {
      achieved: false,
      progress,
      status: `超出 ${formatValue(key, overflow)}`,
    };
  }

  const diff = Math.abs(Number(value) - Number(goal));
  const progress = Math.max(0, 100 - Math.round((diff / 3) * 100));
  return {
    achieved: diff <= 1,
    progress,
    status: diff <= 1 ? "在目标附近" : `偏差 ${diff.toFixed(1)} kg`,
  };
}

function computeDayGoalHits(record, goals) {
  return metricOrder.map((key) => computeMetricStatus(key, record?.[key] ?? null, goals[key]).achieved);
}

function computeDayScore(record, goals) {
  const hits = computeDayGoalHits(record, goals);
  return hits.filter(Boolean).length * 20;
}

function computeRecordStreak(records) {
  if (!records.length) {
    return 0;
  }
  const sorted = records.slice().sort(compareRecordsDesc);
  let streak = 1;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = new Date(`${sorted[index].date}T00:00:00`);
    const next = new Date(`${sorted[index + 1].date}T00:00:00`);
    const diff = Math.round((current - next) / 86400000);
    if (diff === 1) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function computeGoalStreak(records, goals) {
  if (!records.length) {
    return 0;
  }
  const sorted = records.slice().sort(compareRecordsDesc);
  let streak = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const record = sorted[index];
    const hitCount = computeDayGoalHits(record, goals).filter(Boolean).length;
    if (hitCount === metricOrder.length) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function computeConsistency(records, goals) {
  if (!records.length) {
    return null;
  }
  const recent = records.slice().sort(compareRecordsDesc).slice(0, 14);
  const average =
    recent.reduce((sum, record) => sum + computeDayGoalHits(record, goals).filter(Boolean).length / metricOrder.length, 0) /
    recent.length;
  return Math.round(average * 100);
}

function getHeroStatus(score) {
  if (score >= 100) {
    return { title: "状态拉满", body: "今天 5 项目标全部命中，保持这个节奏就很强。", highlight: "完整达标的一天很值得记住。" };
  }
  if (score >= 80) {
    return { title: "状态在线", body: "今天已经很接近完整达标，只差最后一点收尾。", highlight: "再补一项，你今天就会非常完整。" };
  }
  if (score >= 60) {
    return { title: "稳步推进", body: "核心状态还不错，优先补最容易完成的一项。", highlight: "比完全没节奏强很多，继续推进。" };
  }
  if (score >= 40) {
    return { title: "刚进入状态", body: "今天已经开始了，接下来补水或步行最容易拉回节奏。", highlight: "先完成一项，心理门槛会立刻变低。" };
  }
  return { title: "开始热身", body: "先记录今天的数据，系统会自动帮你判断最值得优先调整的地方。", highlight: "稳定记录本身就是进步。" };
}

function createFocusCard(key, record, goals) {
  const goal = goals[key];
  const value = record?.[key] ?? null;
  const status = computeMetricStatus(key, value, goal);
  return `
    <article class="focus-card ${status.achieved ? "is-good" : "is-warning"}">
      <div class="focus-card-header">
        <div>
          <span class="focus-card-label">${metricMeta[key].label}</span>
          <strong class="focus-card-value">${value === null ? "-" : formatValue(key, value)}</strong>
        </div>
        <span class="focus-card-target">目标 ${formatValue(key, goal)}</span>
      </div>
      <div class="focus-card-progress">
        <div style="width:${status.progress}%; background:${metricMeta[key].color};"></div>
      </div>
      <span class="focus-card-status">${status.status}</span>
    </article>
  `;
}

function renderHeroAndOverview() {
  const records = getRecords().slice().sort(compareRecordsDesc);
  const goals = getGoals();
  const todayRecord = getTodayRecord();
  const latest = records[0] || null;
  const todayScore = todayRecord ? computeDayScore(todayRecord, goals) : 0;
  const completed = todayRecord ? computeDayGoalHits(todayRecord, goals).filter(Boolean).length : 0;
  const heroStatus = getHeroStatus(todayScore);
  const recordStreak = computeRecordStreak(records);
  const goalStreak = computeGoalStreak(records, goals);
  const consistency = computeConsistency(records, goals);
  const monthRecords = records.filter((record) => isSameMonth(record.date, getMonthBounds(new Date())));

  document.documentElement.style.setProperty("--score-deg", `${Math.round((todayScore / 100) * 360)}deg`);
  todayHealthScore.textContent = `${todayScore}`;
  heroStatusTitle.textContent = heroStatus.title;
  heroStatusBody.textContent = heroStatus.body;
  dailyProgressBar.style.width = `${todayScore}%`;
  dailyProgressText.textContent = `${completed} / ${metricOrder.length} 项达标`;
  latestWeight.textContent = latest?.weight ? `${Number(latest.weight).toFixed(1)} kg` : "-";
  latestCalories.textContent = latest?.calories ? `${Math.round(Number(latest.calories))} kcal` : "-";
  recordStreakEl.textContent = `${recordStreak} 天`;
  goalStreakEl.textContent = `${goalStreak} 天`;
  consistencyScore.textContent = consistency === null ? "-" : `${consistency}%`;
  monthCheckins.textContent = `${monthRecords.length} 天`;

  if (goalStreak >= 7) {
    encouragementText.textContent = `你已经连续 ${goalStreak} 天完整达标，这就是非常强的稳定性。`;
  } else if (recordStreak >= 7) {
    encouragementText.textContent = `你已经连续 ${recordStreak} 天保持记录，习惯正在真正建立。`;
  } else {
    encouragementText.textContent = heroStatus.highlight;
  }

  focusCards.innerHTML = metricOrder.map((key) => createFocusCard(key, todayRecord, goals)).join("");
  renderAdvice(records, goals, todayRecord);
}

function renderAdvice(records, goals, todayRecord) {
  const latestSeven = records.slice(0, 7);
  const sleepAverage = computeAverage(latestSeven, "sleep");
  const waterAverage = computeAverage(latestSeven, "water");
  const stepsAverage = computeAverage(latestSeven, "steps");
  const caloriesAverage = computeAverage(latestSeven, "calories");
  const recordStreak = computeRecordStreak(records);

  let nextTitle = "先留下今天的数据";
  let nextBody = "今天的数据越完整，后面的建议和复盘就越可信。";

  if (todayRecord) {
    const statuses = metricOrder.map((key) => ({ key, ...computeMetricStatus(key, todayRecord[key], goals[key]) }));
    const pending = statuses.find((item) => !item.achieved);
    if (pending) {
      if (pending.key === "water") {
        nextTitle = "补一轮饮水最划算";
        nextBody = "今天饮水还没到位，优先补 250ml 或 500ml，最容易把节奏拉回来。";
      } else if (pending.key === "sleep") {
        nextTitle = "今晚优先把睡眠补回来";
        nextBody = "最近睡眠不足会连带影响食欲和恢复感，今晚尽量提前 30 分钟休息。";
      } else if (pending.key === "steps") {
        nextTitle = "给自己安排一次短步行";
        nextBody = "哪怕只是晚饭后 15 分钟散步，也会比完全不动好很多。";
      } else if (pending.key === "calories") {
        nextTitle = "热量先从晚餐和零食下手";
        nextBody = "今天热量偏高时，最有效的是回看晚餐和额外加餐，而不是盲目减少正餐。";
      } else {
        nextTitle = "观察体重别只看单日";
        nextBody = "体重有波动很正常，建议结合近 7 天热量和作息一起看，不要只盯今天的数字。";
      }
    } else {
      nextTitle = "今天可以当作模板日";
      nextBody = "现在这套节奏很平衡，尽量把它复制到接下来几天。";
    }
  } else if (sleepAverage !== null && sleepAverage < goals.sleep) {
    nextTitle = "本周最值得优先修的是睡眠";
    nextBody = `最近平均睡眠 ${sleepAverage.toFixed(1)} 小时，先把入睡时间稳定下来，比追求一步到位更重要。`;
  } else if (waterAverage !== null && waterAverage < goals.water) {
    nextTitle = "饮水还有最容易提升的空间";
    nextBody = "建议上午和下午各固定一杯水，让补水变成动作而不是靠想起来。";
  } else if (stepsAverage !== null && stepsAverage < goals.steps) {
    nextTitle = "活动量可以从固定时段建立";
    nextBody = "午饭后或晚饭后安排固定步行，比临时拼步数更容易长期坚持。";
  } else if (caloriesAverage !== null && caloriesAverage > goals.calories) {
    nextTitle = "热量控制要看一整天结构";
    nextBody = "如果总热量偏高，优先回看晚餐和零食，而不是过度压缩早餐。";
  }

  let highlight = "习惯还在形成";
  let highlightText = "连续记录几天后，这里会开始更明确地给出亮点总结。";

  if (recordStreak >= 14) {
    highlight = "你已经进入稳定期";
    highlightText = `连续记录 ${recordStreak} 天，说明这个工具已经开始真正融入你的日常。`;
  } else if (recordStreak >= 7) {
    highlight = "记录习惯在变稳";
    highlightText = `连续记录 ${recordStreak} 天，这是把健康管理变成习惯的关键阶段。`;
  } else if (latestSeven.length >= 4) {
    const bestMetric =
      [
        { key: "water", value: waterAverage !== null ? waterAverage / goals.water : 0 },
        { key: "sleep", value: sleepAverage !== null ? sleepAverage / goals.sleep : 0 },
        { key: "steps", value: stepsAverage !== null ? stepsAverage / goals.steps : 0 },
      ].sort((a, b) => b.value - a.value)[0] || null;
    if (bestMetric && bestMetric.value >= 1) {
      highlight = `${metricMeta[bestMetric.key].label}是你最近的强项`;
      highlightText = `最近一周 ${metricMeta[bestMetric.key].label}稳定达标，这就是你现在最值得保持的节奏。`;
    }
  }

  nextActionTitle.textContent = nextTitle;
  nextActionBody.textContent = nextBody;
  highlightTitle.textContent = highlight;
  highlightBody.textContent = highlightText;
}

function renderReview() {
  const goals = getGoals();
  const allRecords = getRecords().slice().sort(compareRecordsAsc);
  const periodRecords = getRecordsForPeriod(activePeriod);
  const monthRecords = allRecords.filter((record) => isSameMonth(record.date, getMonthBounds(new Date())));
  const yearRecords = allRecords.filter((record) => isSameYear(record.date, new Date().getFullYear()));

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
    reviewNotes.innerHTML = `
      <article class="review-note">
        <h3>还没有足够的数据</h3>
        <p>继续按天记录，系统会逐步形成周、月、年的复盘和建议。</p>
      </article>
    `;
    return;
  }

  const hitScores = periodRecords.map((record) => computeDayGoalHits(record, goals).filter(Boolean).length / metricOrder.length);
  const hitRate = Math.round((hitScores.reduce((sum, value) => sum + value, 0) / hitScores.length) * 100);
  const sleepAverage = computeAverage(periodRecords, "sleep");
  const weightRecords = periodRecords.filter((record) => safeNumber(record.weight) !== null);
  const firstWeight = weightRecords[0] ? Number(weightRecords[0].weight) : null;
  const lastWeight = weightRecords[weightRecords.length - 1] ? Number(weightRecords[weightRecords.length - 1].weight) : null;
  const weightDiff = firstWeight !== null && lastWeight !== null ? Number((lastWeight - firstWeight).toFixed(1)) : null;
  const caloriesAverage = computeAverage(periodRecords, "calories");
  const stepsAverage = computeAverage(periodRecords, "steps");
  const bestDay =
    periodRecords
      .map((record) => ({ record, score: computeDayGoalHits(record, goals).filter(Boolean).length }))
      .sort((a, b) => b.score - a.score)[0] || null;

  reviewRecordedDays.textContent = `${periodRecords.length} 天`;
  reviewGoalHitRate.textContent = `${hitRate}%`;
  reviewSleepAverage.textContent = sleepAverage !== null ? `${sleepAverage.toFixed(1)} h` : "-";
  reviewWeightChange.textContent = weightDiff === null ? "-" : `${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)} kg`;
  monthRecordedDays.textContent = `${monthRecords.length} 天`;
  monthCaloriesAverage.textContent = monthRecords.length ? `${Math.round(computeAverage(monthRecords, "calories") || 0)} kcal` : "-";
  yearRecordedDays.textContent = `${yearRecords.length} 天`;
  yearGoalHitRate.textContent = yearRecords.length
    ? `${Math.round(
        (yearRecords
          .map((record) => computeDayGoalHits(record, goals).filter(Boolean).length / metricOrder.length)
          .reduce((sum, value) => sum + value, 0) /
          yearRecords.length) *
          100
      )}%`
    : "-";

  const notes = [];
  if (bestDay) {
    notes.push({
      title: "最佳状态日",
      body: `${bestDay.record.date} 达成了 ${bestDay.score}/5 项目标，这是这一阶段节奏最完整的一天。`,
    });
  }
  if (caloriesAverage !== null) {
    notes.push({
      title: "饮食观察",
      body:
        caloriesAverage <= goals.calories
          ? `这段时间平均热量约 ${Math.round(caloriesAverage)} kcal，整体控制在目标内。`
          : `这段时间平均热量约 ${Math.round(caloriesAverage)} kcal，建议优先回看晚餐和零食结构。`,
    });
  }
  if (sleepAverage !== null) {
    notes.push({
      title: "恢复建议",
      body:
        sleepAverage >= goals.sleep
          ? "睡眠整体表现稳定，可以把这个作息作为模板继续保持。"
          : `平均睡眠只有 ${sleepAverage.toFixed(1)} 小时，下一阶段优先把入睡时间固定下来。`,
    });
  }
  if (stepsAverage !== null) {
    notes.push({
      title: "行动建议",
      body:
        stepsAverage >= goals.steps
          ? "你的活动量已经比较稳定，下一步更适合追求持续性。"
          : `当前步数均值约 ${Math.round(stepsAverage)}，适合把步行拆成每天固定两个时段。`,
    });
  }
  if (weightDiff !== null) {
    notes.push({
      title: "体重趋势",
      body:
        weightDiff === 0
          ? "体重整体比较平稳。"
          : weightDiff > 0
          ? `体重较期初增加了 ${weightDiff.toFixed(1)} kg，建议把热量和作息一起看。`
          : `体重较期初下降了 ${Math.abs(weightDiff).toFixed(1)} kg，说明近期管理开始起作用。`,
    });
  }

  reviewNotes.innerHTML = notes
    .slice(0, 4)
    .map(
      (item) => `
        <article class="review-note">
          <h3>${item.title}</h3>
          <p>${item.body}</p>
        </article>
      `
    )
    .join("");
}

function buildSmoothPath(points) {
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

function renderTrendChart() {
  const records = getRecordsForPeriod(activePeriod);
  const goals = getGoals();
  const goalValue = safeNumber(goals[activeMetric]);
  const meta = metricMeta[activeMetric];

  trendButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.metric === activeMetric);
  });
  periodButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.period === activePeriod);
  });

  if (!records.length) {
    chartSummary.textContent = `${periodConfigs[activePeriod].label}${meta.label}`;
    chartCaption.textContent = "继续记录后，这里会展示你的趋势与目标线。";
    trendChart.innerHTML = '<div class="chart-empty">还没有足够的数据来绘制趋势图。</div>';
    return;
  }

  const values = records.map((record) => Number(record[activeMetric]) || 0);
  const maxValue = Math.max(...values, goalValue || 0, 1);
  const minValue = Math.min(...values, goalValue || maxValue);
  const range = Math.max(maxValue - minValue, maxValue * 0.25, 1);
  const width = 760;
  const height = 320;
  const paddingX = 42;
  const paddingY = 26;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = values.map((value, index) => {
    const x = paddingX + (chartWidth / Math.max(values.length - 1, 1)) * index;
    const normalized = (value - minValue) / range;
    const y = height - paddingY - normalized * chartHeight;
    return { x, y, value, date: records[index].date };
  });

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const latestValue = values[values.length - 1];

  chartSummary.textContent = `${periodConfigs[activePeriod].label}${meta.label}`;
  chartCaption.textContent = `最新 ${formatValue(activeMetric, latestValue)}，平均 ${formatValue(activeMetric, average)}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = paddingY + chartHeight * ratio;
      return `<line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" class="chart-grid-line" />`;
    })
    .join("");

  const goalLine =
    goalValue && goalValue > 0
      ? (() => {
          const goalY = height - paddingY - ((goalValue - minValue) / range) * chartHeight;
          return `
            <line x1="${paddingX}" y1="${goalY}" x2="${width - paddingX}" y2="${goalY}" class="chart-goal-line" />
            <text x="${width - paddingX}" y="${Math.max(goalY - 8, 14)}" text-anchor="end" class="chart-goal-label">目标 ${goalValue}</text>
          `;
        })()
      : "";

  const labels = points
    .map(
      (point) => `
        <g>
          <circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${meta.color}" />
          <text x="${point.x}" y="${height - 4}" text-anchor="middle" class="chart-axis-label">${formatDateLabel(point.date)}</text>
        </g>
      `
    )
    .join("");

  const valueBadges = points
    .filter((_, index) => index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2))
    .map(
      (point) => `
        <text x="${point.x}" y="${Math.max(point.y - 12, 16)}" text-anchor="middle" class="chart-value-label">${Math.round(
          point.value * 10
        ) / 10}</text>
      `
    )
    .join("");

  trendChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="${meta.label}${periodConfigs[activePeriod].label}趋势图">
      ${gridLines}
      ${goalLine}
      <path d="${areaPath}" class="chart-area" fill="${meta.color}"></path>
      <path d="${linePath}" class="chart-line" stroke="${meta.color}"></path>
      ${labels}
      ${valueBadges}
    </svg>
  `;
}

function renderRecordsTable() {
  const records = getRecords().slice().sort(compareRecordsDesc);
  recordsBody.innerHTML = "";

  if (!records.length) {
    recordsBody.innerHTML = '<tr><td colspan="9" class="empty-state">还没有记录，先填写今天的数据吧。</td></tr>';
    return;
  }

  records.slice(0, 20).forEach((record) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${record.date}</td>
      <td>${formatValue("water", record.water)}</td>
      <td>${formatValue("sleep", record.sleep)}</td>
      <td>${formatValue("steps", record.steps)}</td>
      <td>${formatValue("calories", record.calories)}</td>
      <td>${formatValue("weight", record.weight)}</td>
      <td>${record.mood || "-"}</td>
      <td>${record.notes || "-"}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="row-action" data-action="edit" data-date="${record.date}">编辑</button>
          <button type="button" class="row-action danger" data-action="delete" data-date="${record.date}">删除</button>
        </div>
      </td>
    `;
    recordsBody.appendChild(tr);
  });
}

function populateForm(record) {
  recordDate.value = record.date;
  waterInput.value = record.water ?? "";
  sleepInput.value = record.sleep ?? "";
  stepsInput.value = record.steps ?? "";
  caloriesInput.value = record.calories ?? "";
  weightInput.value = record.weight ?? "";
  moodInput.value = record.mood || "精力充沛";
  notesInput.value = record.notes || "";
}

function resetForm() {
  waterInput.value = "";
  sleepInput.value = "";
  stepsInput.value = "";
  caloriesInput.value = "";
  weightInput.value = "";
  moodInput.value = "精力充沛";
  notesInput.value = "";
  setToday();
}

function renderFormState() {
  if (editingDate) {
    formStateLabel.textContent = `正在编辑 ${editingDate} 的记录`;
    formFeedback.textContent = "保存后会覆盖这一天的数据，趋势和复盘会同步更新。";
    saveRecordBtn.textContent = "保存修改";
    cancelEditBtn.classList.remove("is-hidden");
    deleteEditingBtn.classList.remove("is-hidden");
  } else {
    formStateLabel.textContent = "正在新增一条记录";
    formFeedback.textContent = "保存后会自动更新激励、建议、趋势和复盘结果。";
    saveRecordBtn.textContent = "保存今日记录";
    cancelEditBtn.classList.add("is-hidden");
    deleteEditingBtn.classList.add("is-hidden");
  }
}

function startEditing(date) {
  const record = getRecordByDate(date);
  if (!record) {
    return;
  }
  editingDate = date;
  populateForm(record);
  renderFormState();
  showCloudMessage(`已载入 ${date} 的记录，你现在可以直接修改。`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function stopEditing(message = "") {
  editingDate = null;
  resetForm();
  renderFormState();
  if (message) {
    showCloudMessage(message);
  }
}

function upsertRecord(record, previousDate = null) {
  const previous = previousDate || record.date;
  const records = getRecords().filter((item) => item.date !== previous && item.date !== record.date);
  records.push(record);
  writeRecords(records);
}

function removeRecord(date) {
  writeRecords(getRecords().filter((record) => record.date !== date));
}

function mergeRecords(localRecords, cloudRecords) {
  const map = new Map();
  cloudRecords.forEach((record) => {
    map.set(record.date, record);
  });
  localRecords.forEach((record) => {
    map.set(record.date, record);
  });
  return Array.from(map.values()).sort(compareRecordsAsc);
}

function getLocalGoalsAreCustom() {
  const goals = readStorage(GOALS_KEY, null);
  return Boolean(goals && Object.keys(goals).length);
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

async function fetchCloudSnapshot() {
  const client = supabaseClient || createSupabaseClient();
  if (!client || !cloudSession?.user) {
    return { records: [], goals: null, error: null };
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
    return { records: [], goals: null, error: recordsError };
  }
  if (goalsError && goalsError.code !== "PGRST116") {
    return { records: [], goals: null, error: goalsError };
  }

  return {
    records: (recordsData || []).map((record) => ({
      date: record.record_date,
      water: record.water,
      sleep: record.sleep,
      steps: record.steps,
      calories: record.calories,
      weight: record.weight,
      mood: record.mood || "状态稳定",
      notes: record.notes || "",
    })),
    goals: goalsData
      ? {
          water: goalsData.water,
          sleep: goalsData.sleep,
          steps: goalsData.steps,
          calories: goalsData.calories,
          weight: goalsData.weight,
        }
      : null,
    error: null,
  };
}

async function syncLocalToCloud(silent = false) {
  const client = supabaseClient || createSupabaseClient();
  if (!client) {
    if (!silent) {
      showCloudMessage("请先在 config.js 中填写 Supabase 配置。");
    }
    return false;
  }
  if (!cloudSession?.user) {
    if (!silent) {
      showCloudMessage("正在等待云端身份完成绑定。");
    }
    return false;
  }

  const recordsResult = await client.from("health_records").upsert(normalizeCloudRecords(getRecords(), cloudSession.user.id), {
    onConflict: "user_id,record_date",
  });
  if (recordsResult.error) {
    if (!silent) {
      showCloudMessage(`上传记录失败：${recordsResult.error.message}`);
    }
    return false;
  }

  const goalsResult = await client.from("health_goals").upsert(
    { user_id: cloudSession.user.id, ...getGoals() },
    { onConflict: "user_id" }
  );
  if (goalsResult.error) {
    if (!silent) {
      showCloudMessage(`上传目标失败：${goalsResult.error.message}`);
    }
    return false;
  }

  writeSyncMeta({ lastSyncedAt: new Date().toISOString() });
  updateCloudStatus();
  if (!silent) {
    showCloudMessage("数据已自动保存到云端。");
  }
  return true;
}

async function syncCloudToLocal(silent = false) {
  const client = supabaseClient || createSupabaseClient();
  if (!client) {
    if (!silent) {
      showCloudMessage("请先在 config.js 中填写 Supabase 配置。");
    }
    return false;
  }
  if (!cloudSession?.user) {
    if (!silent) {
      showCloudMessage("正在等待云端身份完成绑定。");
    }
    return false;
  }

  const snapshot = await fetchCloudSnapshot();
  if (snapshot.error) {
    if (!silent) {
      showCloudMessage(`云端拉取失败：${snapshot.error.message}`);
    }
    return false;
  }

  const localRecords = getRecords();
  const mergedRecords = mergeRecords(localRecords, snapshot.records);
  writeRecords(mergedRecords);

  if (snapshot.goals && !getLocalGoalsAreCustom()) {
    writeGoals(snapshot.goals);
  }

  writeSyncMeta({ lastSyncedAt: new Date().toISOString() });
  renderAll();

  if (snapshot.records.length === 0 && localRecords.length > 0) {
    await syncLocalToCloud(true);
  } else if (mergedRecords.length !== snapshot.records.length) {
    await syncLocalToCloud(true);
  }

  if (!silent) {
    showCloudMessage("已从云端更新到当前设备。");
  }
  return true;
}

async function maybeRequestMagicLink() {
  const client = supabaseClient || createSupabaseClient();
  const config = getCloudConfig();
  const meta = getMagicLinkMeta();
  if (!client || !config.email) {
    return;
  }

  const lastRequested = meta.requestedAt ? new Date(meta.requestedAt).getTime() : 0;
  if (lastRequested && Date.now() - lastRequested < 10 * 60 * 1000) {
    showCloudMessage("已向你的邮箱发送登录链接，完成一次授权后就会进入自动同步模式。");
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
  showCloudMessage(`已向 ${config.email} 发送一次登录链接，授权完成后会自动读写 Supabase。`);
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

async function upsertCloudRecord(record, previousDate = null) {
  const client = supabaseClient || createSupabaseClient();
  if (!client || !cloudSession?.user) {
    return;
  }

  if (previousDate && previousDate !== record.date) {
    await client.from("health_records").delete().eq("user_id", cloudSession.user.id).eq("record_date", previousDate);
  }

  await client.from("health_records").upsert(normalizeCloudRecords([record], cloudSession.user.id), {
    onConflict: "user_id,record_date",
  });
  writeSyncMeta({ lastSyncedAt: new Date().toISOString() });
  updateCloudStatus();
}

async function deleteCloudRecord(date) {
  const client = supabaseClient || createSupabaseClient();
  if (!client || !cloudSession?.user) {
    return;
  }
  await client.from("health_records").delete().eq("user_id", cloudSession.user.id).eq("record_date", date);
  writeSyncMeta({ lastSyncedAt: new Date().toISOString() });
  updateCloudStatus();
}

function renderAll() {
  fillGoalsForm();
  renderHeroAndOverview();
  renderReview();
  renderTrendChart();
  renderRecordsTable();
  renderFormState();
  updateCloudStatus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const record = buildRecordFromForm();
  const previousDate = editingDate;

  upsertRecord(record, previousDate);
  await upsertCloudRecord(record, previousDate);
  renderAll();
  stopEditing(previousDate ? `已更新 ${record.date} 的记录。` : "记录已保存，系统已经更新你的激励和建议。");
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
  await syncLocalToCloud(true);
  renderAll();
  showCloudMessage("目标已更新，后续建议会按新的目标重新判断。");
});

quickChips.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.target;
    const mode = button.dataset.mode;
    const value = Number(button.dataset.value);
    const input = document.querySelector(`#${target}`);
    if (!input) {
      return;
    }
    const current = Number(input.value) || 0;
    input.value = mode === "add" ? current + value : value;
    formFeedback.textContent = `${metricMeta[target].label}已快速填充，保存后会自动更新今日状态。`;
  });
});

cancelEditBtn.addEventListener("click", () => {
  stopEditing("已取消编辑，回到新增模式。");
});

deleteEditingBtn.addEventListener("click", async () => {
  if (!editingDate) {
    return;
  }
  const confirmed = window.confirm(`确定要删除 ${editingDate} 这条记录吗？`);
  if (!confirmed) {
    return;
  }
  removeRecord(editingDate);
  await deleteCloudRecord(editingDate);
  renderAll();
  stopEditing(`已删除 ${editingDate} 的记录。`);
});

recordsBody.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }
  const { action, date } = button.dataset;
  if (action === "edit") {
    startEditing(date);
    return;
  }
  if (action === "delete") {
    const confirmed = window.confirm(`确定要删除 ${date} 这条记录吗？`);
    if (!confirmed) {
      return;
    }
    removeRecord(date);
    await deleteCloudRecord(date);
    if (editingDate === date) {
      stopEditing();
    }
    renderAll();
    showCloudMessage(`已删除 ${date} 的记录。`);
  }
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
    await syncLocalToCloud(true);
    renderAll();
    importInput.value = "";
    showCloudMessage("本地数据已导入，若已连接云端也会自动同步。");
  } catch {
    alert("导入失败，请确认 JSON 文件格式正确。");
  }
});

clearBtn.addEventListener("click", async () => {
  const confirmed = window.confirm("确定要清空当前浏览器中的全部健康记录和目标吗？这不会自动删除 Supabase 云端数据。");
  if (!confirmed) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(GOALS_KEY);
  localStorage.removeItem(MAGIC_LINK_META_KEY);
  resetForm();
  editingDate = null;
  renderAll();
  showCloudMessage("当前浏览器里的本地数据已清空。");
});

setToday();
fillGoalsForm();
resetForm();
createSupabaseClient();
restoreCloudSession();
renderAll();
