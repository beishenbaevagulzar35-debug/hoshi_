
import { useEffect, useState } from "react";
import "./WatchPlayer.css";

const API = "https://api.aniweeb.net";

export default function WatchPlayer({ anilistId, title = "Аниме" }) {
  const [episodes, setEpisodes] = useState([]);
  const [episode, setEpisode] = useState(1);
  const [track, setTrack] = useState("sub");
  const [server, setServer] = useState(1);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!anilistId) return;

    const controller = new AbortController();

    async function loadEpisodes() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API}/episodes/${anilistId}`,
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error();

        const data = await response.json();
        setEpisodes(data.episodes || []);
        setEpisode(1);
      } catch {
        if (!controller.signal.aborted) {
          setError("Не удалось получить список серий.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadEpisodes();
    return () => controller.abort();
  }, [anilistId]);

  useEffect(() => {
    if (!anilistId) return;

    const controller = new AbortController();

    async function loadServers() {
      setServers([]);
      setServer(1);

      try {
        const response = await fetch(
          `${API}/servers/ani/${anilistId}/${episode}?track=${track}`,
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error();

        const data = await response.json();

        if (!controller.signal.aborted) {
          setServers(data.servers || []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setServers([]);
        }
      }
    }

    loadServers();
    return () => controller.abort();
  }, [anilistId, episode, track]);

  const currentEpisode = episodes.find(
    (item) => item.number === episode
  );

  const available = currentEpisode
    ? currentEpisode[track] !== false
    : true;

  const playerUrl =
    `${API}/embed/ani/${anilistId}/${episode}` +
    `?track=${track}&server=${server}`;

  return (
    <section className="watch-page">
      <div className="watch-heading">
        <div>
          <span className="watch-label">✦ HOSHI PLAYER</span>
          <h2>{title}</h2>
          <p>Серия {episode}</p>
        </div>
      </div>

      <div className="watch-layout">
        <div className="watch-main">
          <div className="watch-screen">
            {loading ? (
              <p>Загружаем серии...</p>
            ) : error ? (
              <p>{error}</p>
            ) : !available ? (
              <p>Этот вариант озвучки недоступен.</p>
            ) : (
              <iframe
                key={`${anilistId}-${episode}-${track}-${server}`}
                src={playerUrl}
                title={`${title} — серия ${episode}`}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="origin"
              />
            )}
          </div>

          <div className="watch-controls">
            <label>
              Озвучка
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value)}
              >
                <option value="sub">Субтитры</option>
                <option value="dub">Дубляж</option>
              </select>
            </label>

            <label>
              Сервер
              <select
                value={server}
                onChange={(e) => setServer(Number(e.target.value))}
              >
                {servers.map((item) => (
                  <option key={item.server} value={item.server}>
                    {item.name || `Сервер ${item.server}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="watch-navigation">
            <button
              disabled={episode <= 1}
              onClick={() => setEpisode((value) => value - 1)}
            >
              ← Назад
            </button>

            <span>Серия {episode}</span>

            <button
              disabled={
                !episodes.length ||
                episode >= Math.max(...episodes.map((item) => item.number))
              }
              onClick={() => setEpisode((value) => value + 1)}
            >
              Далее →
            </button>
          </div>
        </div>

        <aside className="watch-episodes">
          <h3>Список серий</h3>

          {episodes.map((item) => (
            <button
              key={item.number}
              className={episode === item.number ? "active" : ""}
              onClick={() => setEpisode(item.number)}
            >
              <span>{String(item.number).padStart(2, "0")}</span>
              {item.title || `Серия ${item.number}`}
            </button>
          ))}
        </aside>
      </div>
    </section>
  );
}
