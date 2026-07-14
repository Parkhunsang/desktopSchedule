// Current weather state cache
let currentWeather = { desc: "맑음", temp: 24, icon: "sun" };

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

// Fetch real weather based on user location (falls back to Seoul)
function fetchRealWeather() {
  const descEl = document.getElementById("weather-desc");
  if (descEl) descEl.textContent = "업데이트 중...";

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        getWeatherData(lat, lon);
      },
      (error) => {
        console.warn("Geolocation access denied/failed, falling back to Seoul.", error);
        // Default to Seoul coordinates (37.5665, 126.9780)
        getWeatherData(37.5665, 126.9780);
      },
      { timeout: 6000 }
    );
  } else {
    // Default to Seoul
    getWeatherData(37.5665, 126.9780);
  }
}

// Fetch weather JSON from Open-Meteo
async function getWeatherData(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Weather request failed");
    
    const data = await response.json();
    if (data && data.current_weather) {
      const temp = Math.round(data.current_weather.temperature);
      const code = data.current_weather.weathercode;
      const { desc, icon } = mapWeatherCode(code);
      
      currentWeather = { desc, temp, icon };
      renderWeather();
    }
  } catch (e) {
    console.error("Failed to parse weather details", e);
    const descEl = document.getElementById("weather-desc");
    if (descEl) descEl.textContent = "날씨 오류";
  }
}

// Map WMO Weather Interpretation Codes
function mapWeatherCode(code) {
  // 0: Clear sky
  if (code === 0) return { desc: "맑음", icon: "sun" };
  // 1, 2, 3: Mainly clear, partly cloudy, and overcast
  if (code >= 1 && code <= 3) return { desc: "구름 조금", icon: "cloud" };
  // 45, 48: Fog
  if (code === 45 || code === 48) return { desc: "안개", icon: "cloud-fog" };
  // 51, 53, 55: Drizzle
  if (code >= 51 && code <= 55) return { desc: "이슬비", icon: "cloud-drizzle" };
  // 61, 63, 65: Rain
  if (code >= 61 && code <= 65) return { desc: "비", icon: "cloud-rain" };
  // 71, 73, 75, 77: Snow
  if (code >= 71 && code <= 77) return { desc: "눈", icon: "cloud-snow" };
  // 80, 81, 82: Rain showers
  if (code >= 80 && code <= 82) return { desc: "소나기", icon: "cloud-drizzle" };
  // 95, 96, 99: Thunderstorm
  if (code >= 95 && code <= 99) return { desc: "천둥번개", icon: "cloud-lightning" };
  
  return { desc: "맑음", icon: "sun" }; // Default fallback
}

function renderWeather() {
  const tempEl = document.getElementById("weather-temp");
  const descEl = document.getElementById("weather-desc");
  const iconContainer = document.getElementById("weather-icon");

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
