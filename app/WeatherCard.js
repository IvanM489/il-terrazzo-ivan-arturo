"use client";

import { useEffect, useMemo, useState } from "react";

const WEATHER = {
  0: ["Sereno", "☀️"],
  1: ["Prevalentemente sereno", "🌤️"],
  2: ["Parzialmente nuvoloso", "⛅"],
  3: ["Coperto", "☁️"],
  45: ["Nebbia", "🌫️"],
  48: ["Nebbia con brina", "🌫️"],
  51: ["Pioviggine debole", "🌦️"],
  53: ["Pioviggine moderata", "🌦️"],
  55: ["Pioviggine intensa", "🌧️"],
  56: ["Pioviggine gelata", "🌧️"],
  57: ["Pioviggine gelata intensa", "🌧️"],
  61: ["Pioggia debole", "🌦️"],
  63: ["Pioggia moderata", "🌧️"],
  65: ["Pioggia intensa", "🌧️"],
  66: ["Pioggia gelata", "🌧️"],
  67: ["Pioggia gelata intensa", "🌧️"],
  71: ["Neve debole", "🌨️"],
  73: ["Neve moderata", "🌨️"],
  75: ["Neve intensa", "❄️"],
  77: ["Granelli di neve", "❄️"],
  80: ["Rovesci deboli", "🌦️"],
  81: ["Rovesci moderati", "🌧️"],
  82: ["Rovesci intensi", "⛈️"],
  85: ["Rovesci di neve", "🌨️"],
  86: ["Rovesci di neve intensi", "❄️"],
  95: ["Temporale", "⛈️"],
  96: ["Temporale con grandine", "⛈️"],
  99: ["Temporale con grandine", "⛈️"],
};

function weatherInfo(code) {
  return WEATHER[code] || ["Condizioni variabili", "🌤️"];
}

function dayLabel(dateString, index) {
  if (index === 0) return "Oggi";
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("it-IT", { weekday: "short" })
    .format(date)
    .replace(".", "")
    .replace(/^./, (char) => char.toUpperCase());
}

export default function WeatherCard() {
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/weather", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Meteo non disponibile");
        return response.json();
      })
      .then((data) => {
        if (active) setWeather(data);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const forecast = useMemo(() => {
    if (!weather?.daily) return [];
    return weather.daily.time.map((date, index) => ({
      date,
      label: dayLabel(date, index),
      icon: weatherInfo(weather.daily.weather_code[index])[1],
      description: weatherInfo(weather.daily.weather_code[index])[0],
      max: Math.round(weather.daily.temperature_2m_max[index]),
      min: Math.round(weather.daily.temperature_2m_min[index]),
      rain: weather.daily.precipitation_probability_max?.[index] ?? null,
    }));
  }, [weather]);

  if (error) {
    return (
      <section className="weather weatherError" aria-label="Meteo">
        <div className="weatherErrorIcon">🌤️</div>
        <div>
          <span className="weatherEyebrow">METEO · MILANO</span>
          <strong>Meteo temporaneamente non disponibile</strong>
          <p>Riproveremo automaticamente tra poco.</p>
        </div>
        <style jsx>{weatherStyles}</style>
      </section>
    );
  }

  if (!weather) {
    return (
      <section className="weather weatherLoading" aria-label="Caricamento meteo">
        <div className="weatherLoadingMain"><span className="weatherSkeletonIcon" /><div><span className="weatherSkeletonLine wide" /><span className="weatherSkeletonLine" /></div></div>
        <div className="weatherSkeletonDays"><span /><span /><span /><span /><span /></div>
        <style jsx>{weatherStyles}</style>
      </section>
    );
  }

  const [description, icon] = weatherInfo(weather.current.weather_code);
  const currentTemp = Math.round(weather.current.temperature_2m);
  const apparent = Math.round(weather.current.apparent_temperature);

  return (
    <section className="weather" aria-label="Meteo di Milano">
      <div className="weatherCurrent">
        <div className="weatherLocation"><span className="weatherEyebrow">METEO DEL TERRAZZO</span><strong>Milano</strong></div>
        <div className="weatherMain"><span className="weatherIcon">{icon}</span><div><span className="temperature">{currentTemp}°</span><span className="weatherDescription">{description}</span></div></div>
        <div className="weatherMeta">Percepita {apparent}° · Vento {Math.round(weather.current.wind_speed_10m)} km/h</div>
      </div>

      <div className="forecast" aria-label="Previsioni dei prossimi giorni">
        {forecast.map((day) => (
          <div className="forecastDay" key={day.date}>
            <span className="forecastLabel">{day.label}</span>
            <span className="forecastIcon">{day.icon}</span>
            <span className="forecastTemps"><b>{day.max}°</b> <span>{day.min}°</span></span>
            {day.rain !== null && day.rain > 0 && <span className="rainChance">💧 {day.rain}%</span>}
          </div>
        ))}
      </div>

      <div className="weatherSource">Dati meteo aggiornati automaticamente · Open-Meteo</div>
      <style jsx>{weatherStyles}</style>
    </section>
  );
}

const weatherStyles = `
.weather{position:relative;display:grid;grid-template-columns:minmax(245px,.85fr) 1.7fr;gap:20px;align-items:center;padding:22px 25px;margin-bottom:25px;background:linear-gradient(135deg,#edf3e8 0%,#f8f6ed 100%);border:1px solid #dce4d8;border-radius:25px;color:#354d3b;overflow:hidden}.weather::after{content:"";position:absolute;right:-45px;top:-65px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.42);pointer-events:none}.weatherCurrent{min-width:0}.weatherLocation{display:flex;align-items:baseline;gap:9px}.weatherLocation strong{font-family:Georgia,serif;font-size:20px}.weatherEyebrow{display:block;color:#55745b;font-size:11px;font-weight:800;letter-spacing:1.5px}.weatherMain{display:flex;align-items:center;gap:12px;margin:7px 0 2px}.weatherIcon{font-size:43px;line-height:1}.temperature{font-family:Georgia,serif;font-size:39px;font-weight:700;line-height:1}.weatherDescription{display:block;color:#687168;font-size:13px;margin-top:2px}.weatherMeta{color:#687168;font-size:11px}.forecast{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.forecastDay{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:96px;padding:8px 4px;border-left:1px solid rgba(90,110,90,.12)}.forecastLabel{font-size:11px;font-weight:700;color:#687168}.forecastIcon{font-size:25px;margin:6px 0}.forecastTemps{font-size:12px}.forecastTemps span{color:#89928a}.rainChance{font-size:9px;color:#55745b;margin-top:4px}.weatherSource{position:absolute;right:18px;bottom:7px;color:#9aa39a;font-size:8px}.weatherLoading{min-height:140px}.weatherLoadingMain{display:flex;align-items:center;gap:15px}.weatherSkeletonIcon{width:48px;height:48px;border-radius:50%;background:#e1e7dd;display:block;animation:pulse 1.2s ease-in-out infinite}.weatherSkeletonLine{display:block;width:110px;height:12px;border-radius:8px;background:#e1e7dd;margin-top:8px;animation:pulse 1.2s ease-in-out infinite}.weatherSkeletonLine.wide{width:150px;height:18px;margin-top:0}.weatherSkeletonDays{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.weatherSkeletonDays span{height:75px;border-radius:14px;background:#e5eae2;animation:pulse 1.2s ease-in-out infinite}.weatherError{display:flex;align-items:center;gap:14px;background:#f8f5ec}.weatherErrorIcon{font-size:35px}.weatherError strong{display:block;color:#354d3b;font-family:Georgia,serif;font-size:18px}.weatherError p{margin:4px 0 0;color:#687168;font-size:12px}@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}@media(max-width:760px){.weather{grid-template-columns:1fr;gap:10px;padding:19px 18px}.weatherCurrent{display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 12px}.weatherLocation{grid-column:1/-1}.weatherMain{margin:4px 0}.weatherMeta{grid-column:1/-1}.forecast{border-top:1px solid rgba(90,110,90,.12);padding-top:9px}.forecastDay{min-height:80px;border-left:0}.forecastIcon{font-size:22px;margin:5px 0}.weatherSource{position:static;text-align:right;margin-top:-2px}.weatherLoading{min-height:175px}.weatherLoadingMain{justify-content:center}.weatherSkeletonDays{gap:5px}}@media(max-width:500px){.forecastLabel{font-size:10px}.forecastTemps{font-size:11px}.rainChance{font-size:8px}.weatherIcon{font-size:37px}.temperature{font-size:34px}.weatherDescription{font-size:12px}.weatherMeta{font-size:10px}}
`;
