// Current weather state cache
let currentWeather = { desc: "맑음", temp: 24, icon: "sun", location: "서울 중구" };

// Format day names in Korean
const KR_DAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

export function startClockAndWeather() {
  updateTimeAndDate();
  // Update clock every second
  setInterval(updateTimeAndDate, 1000);

  // Initialize real weather fetch
  fetchRealWeather();
  // Update weather every 15 minutes
  setInterval(fetchRealWeather, 15 * 60 * 1000);

  // Allow manual weather refresh when user clicks the widget
  const weatherWidget = document.getElementById("weather-widget");
  if (weatherWidget) {
    weatherWidget.style.cursor = "pointer";
    weatherWidget.addEventListener("click", () => {
      fetchRealWeather();
      // Add a quick feedback animation
      weatherWidget.style.transform = "scale(0.95)";
      setTimeout(() => weatherWidget.style.transform = "scale(1)", 100);
    });
  }
}

// Update clock and calendar labels
function updateTimeAndDate() {
  const timeEl = document.getElementById("digital-clock");
  const dateEl = document.getElementById("digital-date");
  
  if (!timeEl || !dateEl) return;

  const now = new Date();
  
  // Hours, minutes, seconds padding
  const hrs = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  
  timeEl.textContent = `${hrs}:${mins}:${secs}`;

  // Full date string: "2026년 06월 19일 금요일"
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const dayName = KR_DAYS[now.getDay()];

  dateEl.textContent = `${year}년 ${month}월 ${date}일 ${dayName}`;
}

// Fetch real weather based on user IP location (Clean 1-step fetch, zero 403 errors)
async function fetchRealWeather() {
  const descEl = document.getElementById("weather-desc");
  if (descEl) descEl.textContent = "업데이트 중...";

  let lat = 37.5665;
  let lon = 126.9780;
  let locName = "서울 중구";

  try {
    // Single clean geolocation & reverse geocode API (Free, CORS enabled, no 403)
    const response = await fetch("https://api-bdc.io/data/reverse-geocode-client?localityLanguage=ko");
    if (response.ok) {
      const data = await response.json();
      if (data && data.latitude && data.longitude) {
        lat = data.latitude;
        lon = data.longitude;

        let region = data.principalSubdivision || "";
        let district = data.locality || data.city || "";
        region = region.replace(/(특별시|광역시|특별자치시|특별자치도|도)/g, '').trim();
        district = district.replace(/^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시)\s*/, '').trim();

        if (region && district) locName = `${region} ${district}`;
        else if (district) locName = district;
        else if (region) locName = region;
      }
    }
  } catch (e) {
    // Silent fallback to Seoul
  }

  getWeatherData(lat, lon, locName);
}

/**
 * Main Weather Fetching Function
 * Tries Korea Meteorological Administration (KMA) API first if service key is present.
 * Falls back to Open-Meteo on failure or missing API key.
 */
async function getWeatherData(lat, lon, locName = "서울 중구") {
  // Retrieve API Key from env
  const kmaServiceKey = import.meta.env.VITE_KMA_SERVICE_KEY || import.meta.env.KMA_SERVICE_KEY || "";

  if (kmaServiceKey && kmaServiceKey.trim().length > 0) {
    try {
      const kmaSuccess = await fetchKMAWeather(lat, lon, kmaServiceKey.trim());
      if (kmaSuccess) {
        currentWeather.location = locName;
        renderWeather();
        return;
      }
    } catch (e) {
      console.warn("KMA Weather API failed, switching to Open-Meteo fallback:", e);
    }
  }

  // Fallback to Open-Meteo
  await fetchOpenMeteoWeather(lat, lon);
  currentWeather.location = locName;
  renderWeather();
}

/**
 * Fetch Weather from KMA (기상청 초단기실황 API)
 */
async function fetchKMAWeather(lat, lon, serviceKey) {
  const grid = dfs_xy_conv("toXY", lat, lon);
  const nx = grid.x;
  const ny = grid.y;

  const { baseDate, baseTime } = getKMABaseDateTime();

  const encodedKey = serviceKey.includes('%') ? serviceKey : encodeURIComponent(serviceKey);
  const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${encodedKey}&numOfRows=10&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`KMA API HTTP status ${response.status}`);

  const data = await response.json();
  const items = data?.response?.body?.items?.item;

  if (!items || !Array.isArray(items)) {
    const resultCode = data?.response?.header?.resultCode;
    const resultMsg = data?.response?.header?.resultMsg;
    throw new Error(`KMA API Error Code: ${resultCode}, Msg: ${resultMsg}`);
  }

  let temp = null;
  let pty = 0; // 강수형태 (0: 없음, 1: 비, 2: 비/눈, 3: 눈, 5: 빗방울...)
  let reh = 50; // 습도 (%)

  items.forEach(item => {
    if (item.category === 'T1H') temp = parseFloat(item.obsrValue);
    if (item.category === 'PTY') pty = parseInt(item.obsrValue, 10);
    if (item.category === 'REH') reh = parseFloat(item.obsrValue);
  });

  if (temp === null || isNaN(temp)) {
    throw new Error("Temperature data missing in KMA response");
  }

  temp = Math.round(temp);
  const { desc, icon } = mapKMAWeatherCode(pty, reh);

  currentWeather.desc = desc;
  currentWeather.temp = temp;
  currentWeather.icon = icon;
  renderWeather();
  console.log(`[KMA Weather] Updated successfully. (${desc}, ${temp}°C, Grid: ${nx},${ny})`);
  return true;
}

/**
 * Calculates base_date and base_time for KMA getUltraSrtNcst
 */
function getKMABaseDateTime() {
  const now = new Date();
  if (now.getMinutes() < 10) {
    now.setHours(now.getHours() - 1);
  }

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');

  return {
    baseDate: `${year}${month}${day}`,
    baseTime: `${hours}00`
  };
}

/**
 * Maps KMA PTY (Precipitation Type) and REH (Humidity) to weather description and Lucide icon
 */
function mapKMAWeatherCode(pty, reh) {
  if (pty === 1 || pty === 5) return { desc: "비", icon: "cloud-rain" };
  if (pty === 2 || pty === 6) return { desc: "비/눈", icon: "cloud-drizzle" };
  if (pty === 3 || pty === 7) return { desc: "눈", icon: "cloud-snow" };

  if (reh >= 85) return { desc: "흐림/안개", icon: "cloud-fog" };
  if (reh >= 70) return { desc: "구름 많음", icon: "cloud" };

  return { desc: "맑음", icon: "sun" };
}

/**
 * Fetch Weather JSON from Open-Meteo (Fallback)
 */
async function fetchOpenMeteoWeather(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Open-Meteo weather request failed");
    
    const data = await response.json();
    if (data && data.current_weather) {
      const temp = Math.round(data.current_weather.temperature);
      const code = data.current_weather.weathercode;
      const { desc, icon } = mapOpenMeteoCode(code);
      
      currentWeather.desc = desc;
      currentWeather.temp = temp;
      currentWeather.icon = icon;
      renderWeather();
    }
  } catch (e) {
    console.error("Failed to fetch weather details", e);
    const descEl = document.getElementById("weather-desc");
    if (descEl) descEl.textContent = "날씨 오류";
  }
}

/**
 * Map WMO Weather Interpretation Codes for Open-Meteo
 */
function mapOpenMeteoCode(code) {
  if (code === 0) return { desc: "맑음", icon: "sun" };
  if (code >= 1 && code <= 3) return { desc: "구름 조금", icon: "cloud" };
  if (code === 45 || code === 48) return { desc: "안개", icon: "cloud-fog" };
  if (code >= 51 && code <= 55) return { desc: "이슬비", icon: "cloud-drizzle" };
  if (code >= 61 && code <= 65) return { desc: "비", icon: "cloud-rain" };
  if (code >= 71 && code <= 77) return { desc: "눈", icon: "cloud-snow" };
  if (code >= 80 && code <= 82) return { desc: "소나기", icon: "cloud-drizzle" };
  if (code >= 95 && code <= 99) return { desc: "천둥번개", icon: "cloud-lightning" };
  return { desc: "맑음", icon: "sun" };
}

/**
 * LCC DFS Coordinate Conversion (WGS84 Lat/Lon <-> KMA Grid X/Y)
 */
function dfs_xy_conv(code, v1, v2) {
  const RE = 6371.00875;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;

  const DEGRAD = Math.PI / 180.0;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  const rs = {};
  if (code === "toXY") {
    rs['lat'] = v1;
    rs['lng'] = v2;
    let ra = Math.tan(Math.PI * 0.25 + (v1) * DEGRAD * 0.5);
    ra = re * sf / Math.pow(ra, sn);
    let theta = v2 * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;
    rs['x'] = Math.floor(ra * Math.sin(theta) + XO + 0.5);
    rs['y'] = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  }
  return rs;
}

function renderWeather() {
  const locEl = document.getElementById("weather-location");
  const tempEl = document.getElementById("weather-temp");
  const descEl = document.getElementById("weather-desc");
  const iconContainer = document.getElementById("weather-icon");

  if (locEl) locEl.textContent = currentWeather.location || "서울 중구";
  if (tempEl) tempEl.textContent = `${currentWeather.temp}°C`;
  if (descEl) descEl.textContent = currentWeather.desc;

  if (iconContainer) {
    iconContainer.innerHTML = `<i data-lucide="${currentWeather.icon}"></i>`;
    
    // Trigger Lucide icon parsing for the newly added element
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({
        attrs: {
          style: 'width: 22px; height: 22px;'
        }
      });
    }
  }
}
