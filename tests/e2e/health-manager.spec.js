const { test, expect } = require("@playwright/test");

const storageKeys = ["health-manager-records", "health-manager-goals", "health-manager-sync-meta", "health-manager-magic-link-meta"];

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthFixtureDates() {
  const now = new Date();
  const today = now.getDate();
  const days = [Math.max(1, today - 6), Math.max(1, today - 3), today];

  return days.map((day) => toDateInputValue(new Date(now.getFullYear(), now.getMonth(), day)));
}

function countDatesWithinLastDays(dateValues, days) {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffValue = toDateInputValue(cutoff);

  return dateValues.filter((value) => value >= cutoffValue).length;
}

test("can save a daily record and keep it after reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((keys) => {
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
  }, storageKeys);
  await page.reload();

  const form = page.locator("#healthForm");
  await form.getByLabel("饮水量（ml）").fill("2100");
  await form.getByLabel("睡眠时长（小时）").fill("7.5");
  await form.getByLabel("步数").fill("8500");
  await form.getByLabel("饮食热量（kcal）").fill("1650");
  await form.getByLabel("体重（kg）").fill("60.2");
  await form.getByLabel("心情状态").selectOption("状态稳定");
  await form.getByLabel("备注").fill("Playwright 验收记录");
  await page.getByRole("button", { name: "保存今日记录" }).click();

  await expect(page.locator("#recordsBody")).toContainText("Playwright 验收记录");
  await expect(page.locator("#latestWeight")).toHaveText("60.2 kg");
  await expect(page.locator("#latestCalories")).toHaveText("1650 kcal");
  await expect(page.locator("#dailyProgressText")).toContainText("4 / 5");

  await page.reload();

  await expect(page.locator("#recordsBody")).toContainText("Playwright 验收记录");
  await expect(page.locator("#chartSummary")).toContainText("最近 7 天热量");
});

test("can switch review periods and trend metrics", async ({ page }) => {
  const [firstDate, secondDate, thirdDate] = getCurrentMonthFixtureDates();
  const recentRecordedDays = countDatesWithinLastDays([firstDate, secondDate, thirdDate], 7);

  await page.goto("/");
  await page.evaluate(({ firstDateValue, secondDateValue, thirdDateValue }) => {
    localStorage.removeItem("health-manager-sync-meta");
    localStorage.removeItem("health-manager-magic-link-meta");
    localStorage.setItem(
      "health-manager-records",
      JSON.stringify([
        {
          date: firstDateValue,
          water: 1800,
          sleep: 7,
          steps: 7600,
          calories: 1750,
          weight: 60.5,
          mood: "状态稳定",
          notes: "first",
        },
        {
          date: secondDateValue,
          water: 2200,
          sleep: 8,
          steps: 9100,
          calories: 1680,
          weight: 60.1,
          mood: "精力充沛",
          notes: "second",
        },
        {
          date: thirdDateValue,
          water: 2000,
          sleep: 7.5,
          steps: 8400,
          calories: 1700,
          weight: 60,
          mood: "状态稳定",
          notes: "third",
        },
      ])
    );
    localStorage.setItem(
      "health-manager-goals",
      JSON.stringify({
        water: 2000,
        sleep: 8,
        steps: 8000,
        calories: 1800,
        weight: 60,
      })
    );
  }, { firstDateValue: firstDate, secondDateValue: secondDate, thirdDateValue: thirdDate });

  await page.reload();

  await expect(page.locator("#reviewRecordedDays")).toHaveText(`${recentRecordedDays} 天`);
  await page.getByRole("button", { name: "30 天" }).click();
  await expect(page.locator("#chartSummary")).toContainText("最近 30 天热量");

  await page.getByRole("button", { name: "本月" }).click();
  await expect(page.locator("#reviewRecordedDays")).toHaveText("3 天");

  await page.getByRole("button", { name: "睡眠" }).click();
  await expect(page.locator("#chartSummary")).toContainText("本月睡眠");
  await expect(page.locator("#chartCaption")).toContainText("平均");
  await expect(page.locator("#trendChart svg")).toBeVisible();
});

test("can export and import health data as json", async ({ page }) => {
  const today = toDateInputValue(new Date());

  await page.goto("/");
  await page.evaluate((currentDate) => {
    localStorage.setItem(
      "health-manager-records",
      JSON.stringify([
        {
          date: currentDate,
          water: 2300,
          sleep: 8,
          steps: 9800,
          calories: 1720,
          weight: 59.8,
          mood: "精力充沛",
          notes: "export target",
        },
      ])
    );
    localStorage.setItem(
      "health-manager-goals",
      JSON.stringify({
        water: 2100,
        sleep: 8,
        steps: 9000,
        calories: 1750,
        weight: 60,
      })
    );
  }, today);
  await page.reload();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出数据" }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await download.createReadStream().then(async (stream) => {
    let data = "";
    for await (const chunk of stream) {
      data += chunk.toString();
    }
    return data;
  }));

  expect(exported.records).toHaveLength(1);
  expect(exported.records[0].notes).toBe("export target");
  expect(exported.goals.calories).toBe(1750);
  expect(exported.cloud).toHaveProperty("configured");
  expect(exported).toHaveProperty("exportedAt");

  await page.evaluate((keys) => {
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }, storageKeys);
  await page.reload();

  await expect(page.locator("#recordsBody")).toContainText("还没有记录");

  await page.locator("#importInput").setInputFiles({
    name: "health-data.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported, null, 2)),
  });

  await expect(page.locator("#recordsBody")).toContainText("export target");
  await expect(page.locator("#monthCaloriesAverage")).toContainText("1720 kcal");
});
