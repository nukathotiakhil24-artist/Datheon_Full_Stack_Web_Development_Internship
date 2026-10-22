"use strict";

const BASE_URL = "https://api.openweathermap.org/data/2.5";
const LAST_CITY_KEY = "datheon_last_city";
const UNIT_KEY = "datheon_unit";
const ICON_URL = (code) => `https://openweathermap.org/img/wn/${code}@2x.png`;

// ---------- DOM ----------
const $ = (selector) => document.querySelector(selector);
const searchForm = $("#search-form");
const cityInput = $("#city-input");
const unitToggle = $("#unit-toggle");
const loader = $("#loader");
const errorBox = $("#error");
const weatherSection = $("#weather");

// ---------- State ----------
let unit = safeGet(UNIT_KEY) === "F" ? "F" : "C";
let lastData = null;

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

// ---------- Helpers ----------
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTemp(celsius) {
  const value = unit === "C" ? celsius : (celsius * 9) / 5 + 32;
  return `${Math.round(value)}°${unit}`;
}

function formatWind(metersPerSecond) {
  return unit === "C"
    ? `${Math.round(metersPerSecond * 3.6)} km/h`
    : `${Math.round(metersPerSecond * 2.237)} mph`;
}

function showLoading() {
  loader.hidden = false;
  errorBox.hidden = true;
  weatherSection.hidden = true;
}

function showError(message) {
  loader.hidden = true;
  weatherSection.hidden = true;
  errorBox.textContent = message;
  errorBox.hidden = false;
}

// ---------- API ----------
async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Network error. Check your internet connection and try again.");
  }
  if (response.status === 404) throw new Error("City not found. Check the spelling and try again.");
  if (response.status === 401) {
    throw new Error(
      "Invalid API key. Open config.js and paste your OpenWeatherMap key (new keys can take up to 2 hours to activate)."
    );
  }
  if (response.status === 429) throw new Error("Too many requests. Please wait a minute and try again.");
  if (!response.ok) throw new Error(`Something went wrong (error ${response.status}).`);
  return response.json();
}

async function getWeather(city) {
  if (!API_KEY || API_KEY.startsWith("PASTE")) {
    throw new Error("API key missing. Open config.js and paste your free OpenWeatherMap API key.");
  }
  const q = encodeURIComponent(city);
  const [current, forecast] = await Promise.all([
    fetchJson(`${BASE_URL}/weather?q=${q}&units=metric&appid=${API_KEY}`),
    fetchJson(`${BASE_URL}/forecast?q=${q}&units=metric&appid=${API_KEY}`),
  ]);
  return { current, forecast };
}

// ---------- Data shaping ----------
function buildDailyForecast(forecast) {
  const offset = forecast.city.timezone; // seconds from UTC
  const days = new Map();

  for (const item of forecast.list) {
    const local = new Date((item.dt + offset) * 1000);
    const key = local.toISOString().slice(0, 10);
    if (!days.has(key)) days.set(key, { key, temps: [], entries: [] });
    const day = days.get(key);
    day.temps.push(item.main.temp_min, item.main.temp_max);
    day.entries.push({ hour: local.getUTCHours(), item });
  }

  return [...days.values()].slice(0, 5).map((day) => {
    const midday = day.entries.reduce((best, cur) =>
      Math.abs(cur.hour - 12) < Math.abs(best.hour - 12) ? cur : best
    );
    return {
      key: day.key,
      min: Math.min(...day.temps),
      max: Math.max(...day.temps),
      icon: midday.item.weather[0].icon.replace("n", "d"),
      description: midday.item.weather[0].description,
    };
  });
}

function pickTheme(current) {
  const { dt, sys } = current;
  const isNight = dt < sys.sunrise || dt > sys.sunset;
  const main = current.weather[0].main.toLowerCase();

  if (main === "thunderstorm") return "theme-thunder";
  if (main === "rain" || main === "drizzle") return "theme-rain";
  if (main === "snow") return "theme-snow";
  if (["mist", "smoke", "haze", "dust", "fog", "sand", "ash", "squall", "tornado"].includes(main)) {
    return "theme-mist";
  }
  if (main === "clouds") return isNight ? "theme-clouds-night" : "theme-clouds";
  return isNight ? "theme-night" : "theme-sunny";
}

// ---------- Rendering ----------
function renderWeather(data) {
  const { current, forecast } = data;

  document.body.className = pickTheme(current);

  $("#city-name").textContent = `${current.name}, ${current.sys.country}`;
  $("#local-time").textContent = new Date((current.dt + current.timezone) * 1000).toLocaleString("en-US", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  $("#description").textContent = current.weather[0].description;

  const icon = $("#weather-icon");
  icon.src = ICON_URL(current.weather[0].icon);
  icon.alt = current.weather[0].description;

  $("#temperature").textContent = formatTemp(current.main.temp);
  $("#feels-like").textContent = `Feels like ${formatTemp(current.main.feels_like)}`;
  $("#humidity").textContent = `${current.main.humidity}%`;
  $("#wind").textContent = formatWind(current.wind.speed);
  $("#pressure").textContent = `${current.main.pressure} hPa`;

  const days = buildDailyForecast(forecast);
  $("#forecast").innerHTML = days
    .map((day, index) => {
      const date = new Date(`${day.key}T00:00:00Z`);
      const label =
        index === 0
          ? "Today"
          : date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
      const shortDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      return `
        <div class="forecast-card">
          <div class="day">${escapeHtml(label)}</div>
          <div class="date">${escapeHtml(shortDate)}</div>
          <img src="${ICON_URL(day.icon)}" alt="${escapeHtml(day.description)}" />
          <div class="temps">${formatTemp(day.max)} <span class="low">${formatTemp(day.min)}</span></div>
          <div class="desc">${escapeHtml(day.description)}</div>
        </div>`;
    })
    .join("");

  loader.hidden = true;
  errorBox.hidden = true;
  weatherSection.hidden = false;
}

// ---------- Actions ----------
async function searchCity(city) {
  const name = city.trim();
  if (!name) return;
  showLoading();
  try {
    lastData = await getWeather(name);
    renderWeather(lastData);
    safeSet(LAST_CITY_KEY, lastData.current.name);
  } catch (err) {
    showError(err.message);
  }
}

function updateUnitButton() {
  unitToggle.textContent = `°${unit}`;
}

// ---------- Events ----------
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  searchCity(cityInput.value);
});

unitToggle.addEventListener("click", () => {
  unit = unit === "C" ? "F" : "C";
  safeSet(UNIT_KEY, unit);
  updateUnitButton();
  if (lastData) renderWeather(lastData);
});

// ---------- Init ----------
updateUnitButton();
const savedCity = safeGet(LAST_CITY_KEY);
if (savedCity) {
  cityInput.value = savedCity;
  searchCity(savedCity);
}
