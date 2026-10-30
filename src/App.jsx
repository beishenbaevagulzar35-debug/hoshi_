
import { useEffect, useState } from "react";
import "./App.css";

const API = "https://graphql.anilist.co";

const CATALOG_QUERY = `
  query ($page: Int!) {
    Page(page: $page, perPage: 25) {
      media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
        id
        title { romaji english native }
        description(asHtml: false)
        seasonYear
        episodes
        averageScore
        genres
        coverImage { large }
        bannerImage
        siteUrl
        streamingEpisodes { title url site thumbnail }
      }
    }
  }
`;

const DETAIL_QUERY = `
  query ($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english native }
      description(asHtml: false)
      seasonYear
      episodes
      averageScore
      genres
      coverImage { large }
      bannerImage
      siteUrl
      streamingEpisodes { title url site thumbnail }
      recommendations(page: 1, perPage: 10, sort: RATING_DESC) {
        nodes {
          mediaRecommendation {
            id
            title { romaji english native }
            description(asHtml: false)
            seasonYear
            episodes
            averageScore
            genres
            coverImage { large }
            bannerImage
            siteUrl
            streamingEpisodes { title url site thumbnail }
          }
        }
      }
    }
  }
`;

function normalizeAnime(item) {
  if (!item) return null;

  return {
    id: item.id,
    title:
      item.title?.english ||
      item.title?.romaji ||
      item.title?.native ||
      "Без названия",
    originalTitle: item.title?.romaji || "",
    description: item.description || "Описание пока отсутствует.",
    year: item.seasonYear || "Неизвестно",
    episodes: item.episodes || "Неизвестно",
    rating: item.averageScore
      ? (item.averageScore / 10).toFixed(1)
      : "—",
    genres: item.genres || [],
    image: item.coverImage?.large || "",
    banner: item.bannerImage || "",
    siteUrl: item.siteUrl || "",
    streams: (item.streamingEpisodes || []).filter(
      (episode) => episode.url
    )
  };
}

async function requestApi(query, variables, signal) {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ query, variables }),
    signal
  });

  const result = await response.json();

  if (!response.ok || result.errors?.length) {
    throw new Error(
      result.errors?.[0]?.message || `Ошибка ${response.status}`
    );
  }

  return result.data;
}

function youtubeEmbed(url) {
  try {
    const parsed = new URL(url);
    let id = "";

    if (parsed.hostname.includes("youtu.be")) {
      id = parsed.pathname.slice(1);
    } else if (parsed.hostname.includes("youtube.com")) {
      id =
        parsed.searchParams.get("v") ||
        parsed.pathname.split("/embed/")[1]?.split("/")[0] ||
        "";
    }

    return id
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : "";
  } catch {
    return "";
  }
}

function AnimeCard({ anime, onOpen, favorite, onFavorite }) {
  return (
    <article className="anime-card">
      <button
        className="poster-button"
        onClick={() => onOpen(anime)}
        aria-label={`Открыть ${anime.title}`}
      >
        <img src={anime.image} alt={anime.title} loading="lazy" />

        <span className="poster-rating">★ {anime.rating}</span>

        <span className="poster-overlay">
          <span className="poster-play">↗</span>
          Подробнее
        </span>
      </button>

      <div className="card-bottom">
        <button
          className="card-title"
          onClick={() => onOpen(anime)}
        >
          {anime.title}
        </button>

        <div className="card-subtitle">
          {anime.year} · {anime.genres[0] || "Аниме"}
        </div>
      </div>

      <button
        className={`card-heart ${favorite ? "is-favorite" : ""}`}
        onClick={() => onFavorite(anime.id)}
        aria-label="Избранное"
      >
        {favorite ? "♥" : "♡"}
      </button>
    </article>
  );
}

function App() {
  const [animeList, setAnimeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  const [page, setPage] = useState("Главная");
  const [search, setSearch] = useState("");
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [episodeIndex, setEpisodeIndex] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [avatar, setAvatar] = useState("");

  // Загружаем 50 аниме: две страницы по 25.
  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      setLoading(true);
      setError("");

      try {
        const pages = await Promise.all([
          requestApi(CATALOG_QUERY, { page: 1 }, controller.signal),
          requestApi(CATALOG_QUERY, { page: 2 }, controller.signal)
        ]);

        const items = pages
          .flatMap((result) => result.Page.media)
          .map(normalizeAnime)
          .filter((item) => item && item.image);

        setAnimeList(items);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setError("Не удалось загрузить каталог. Проверь интернет.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadCatalog();
    return () => controller.abort();
  }, [reload]);

  // Загружаем подробности и рекомендации при открытии карточки.
  useEffect(() => {
    if (!selectedAnime) {
      setDetail(null);
      return;
    }

    const controller = new AbortController();

    async function loadDetail() {
      setDetailLoading(true);
      setDetail(null);
      setEpisodeIndex(0);

      try {
        const result = await requestApi(
          DETAIL_QUERY,
          { id: selectedAnime.id },
          controller.signal
        );

        const media = result.Media;

        const similar = (media.recommendations?.nodes || [])
          .map((node) => normalizeAnime(node.mediaRecommendation))
          .filter((item) => item && item.image);

        if (!controller.signal.aborted) {
          setDetail({
            anime: normalizeAnime(media),
            similar
          });
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
        }
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    }

    loadDetail();
    return () => controller.abort();
  }, [selectedAnime?.id]);

  const toggleFavorite = (id) => {
    setFavorites((old) =>
      old.includes(id)
        ? old.filter((item) => item !== id)
        : [...old, id]
    );
  };

  const openAnime = (anime) => {
    setSelectedAnime(anime);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goTo = (nextPage) => {
    setPage(nextPage);
    setSelectedAnime(null);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const currentAnime = selectedAnime
  ? detail?.anime?.id === selectedAnime.id
    ? detail.anime
    : selectedAnime
  : null;

  const streams = currentAnime?.streams || [];
  const activeEpisode = streams[episodeIndex];
  const embedUrl = activeEpisode
    ? youtubeEmbed(activeEpisode.url)
    : "";

  const filteredAnime = animeList.filter((anime) => {
    const matchesSearch =
      anime.title.toLowerCase().includes(search.toLowerCase()) ||
      anime.originalTitle.toLowerCase().includes(search.toLowerCase());

    const matchesPage =
      page !== "Новинки" || Number(anime.year) >= 2024;

    const matchesFavorites =
      page !== "Избранное" || favorites.includes(anime.id);

    return matchesSearch && matchesPage && matchesFavorites;
  });

  const availableCount = animeList.filter(
    (anime) => anime.streams.length > 0
  ).length;

  return (
    <div className="hoshi">
      <div className="cosmos-stars stars-a"></div>
      <div className="cosmos-stars stars-b"></div>

      <header className="topbar">
        <button className="brand" onClick={() => goTo("Главная")}>
          <span>✦</span> HOSHI
        </button>

        <nav className="main-nav">
          {["Главная", "Каталог", "Новинки", "Избранное"].map((item) => (
            <button
              key={item}
              className={page === item && !selectedAnime ? "active" : ""}
              onClick={() => goTo(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <button className="profile-short" onClick={() => goTo("Профиль")}>
          {avatar ? <img src={avatar} alt="Профиль" /> : "H"}
        </button>
      </header>

      <main className="site-main">
        {selectedAnime && currentAnime ? (
          <section className="anime-page">
            <button
              className="back-link"
              onClick={() => setSelectedAnime(null)}
            >
              ← Вернуться в каталог
            </button>

            <div
              className="anime-banner"
              style={{
                backgroundImage: currentAnime.banner
                  ? `linear-gradient(90deg, #090a19 5%, #090a19e8 55%, #090a1970), url("${currentAnime.banner}")`
                  : "linear-gradient(120deg, #22204b, #101329)"
              }}
            >
              <img
                className="anime-cover"
                src={currentAnime.image}
                alt={currentAnime.title}
              />

              <div className="anime-heading">
                <span className="overline">HOSHI COLLECTION</span>
                <h1>{currentAnime.title}</h1>

                {currentAnime.originalTitle !== currentAnime.title && (
                  <p className="original-title">
                    {currentAnime.originalTitle}
                  </p>
                )}

                <div className="anime-meta">
                  <span>★ {currentAnime.rating}</span>
                  <span>{currentAnime.year}</span>
                  <span>{currentAnime.episodes} серий</span>
                </div>

                <div className="genre-list">
                  {currentAnime.genres.map((genre) => (
                    <span key={genre}>{genre}</span>
                  ))}
                </div>

                <button
                  className="favorite-action"
                  onClick={() => toggleFavorite(currentAnime.id)}
                >
                  {favorites.includes(currentAnime.id)
                    ? "♥ В избранном"
                    : "♡ Добавить в избранное"}
                </button>
              </div>
            </div>

            <div className="watch-area">
              <div className="watch-title">
                <div>
                  <span className="overline">HOSHI PLAYER</span>
                  <h2>Просмотр</h2>
                </div>
                <span className="episode-total">
                  {streams.length
                    ? `${streams.length} доступных ссылок`
                    : "Источники не найдены"}
                </span>
              </div>

              <div className="player">
                {detailLoading ? (
                  <div className="player-message">
                    <span className="loader-star">✦</span>
                    Загружаем страницу аниме...
                  </div>
                ) : activeEpisode && embedUrl ? (
                  <iframe
                    key={embedUrl}
                    src={embedUrl}
                    title={`Просмотр: ${currentAnime.title}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : activeEpisode ? (
                  <div className="player-message">
                    <span className="player-symbol">▶</span>
                    <h3>{activeEpisode.title || "Серия аниме"}</h3>
                    <p>
                      Этот источник не поддерживает встроенный просмотр.
                      Можно открыть его на исходной площадке.
                    </p>
                    <a
                      className="watch-button"
                      href={activeEpisode.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Открыть официальный источник ↗
                    </a>
                  </div>
                ) : (
                  <div className="player-message">
                    <span className="player-symbol">✦</span>
                    <h3>Пока нет доступных серий</h3>
                    <p>
                      Для этого аниме каталог пока не предоставляет
                      ссылок на просмотр. Можно посмотреть информацию
                      на странице правообладателя.
                    </p>
                    {currentAnime.siteUrl && (
                      <a
                        className="watch-button"
                        href={currentAnime.siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Страница аниме ↗
                      </a>
                    )}
                  </div>
                )}
              </div>

              {streams.length > 0 && (
                <div className="episode-area">
                  <div className="episode-heading">
                    <h3>Доступные серии</h3>
                    <span>{streams.length} найдено</span>
                  </div>

                  <div className="episode-list">
                    {streams.map((episode, index) => (
                      <button
                        key={`${episode.url}-${index}`}
                        className={
                          episodeIndex === index
                            ? "episode-button selected"
                            : "episode-button"
                        }
                        onClick={() => setEpisodeIndex(index)}
                      >
                        <span className="episode-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="episode-name">
                          {episode.title || `Серия ${index + 1}`}
                          <small>{episode.site || "Внешняя площадка"}</small>
                        </span>
                        <span>▶</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <section className="about-section">
              <span className="overline">THE STORY</span>
              <h2>Об этом аниме</h2>
              <p>{currentAnime.description}</p>
            </section>

            <section className="similar-section">
              <div className="section-title">
                <div>
                  <span className="overline">MORE TO EXPLORE</span>
                  <h2>Похожие аниме</h2>
                </div>
              </div>

              {detailLoading ? (
                <p className="muted">Подбираем рекомендации...</p>
              ) : detail?.similar?.length ? (
                <div className="anime-grid">
                  {detail.similar.map((anime) => (
                    <AnimeCard
                      key={anime.id}
                      anime={anime}
                      onOpen={openAnime}
                      favorite={favorites.includes(anime.id)}
                      onFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              ) : (
                <p className="muted">
                  Пока нет похожих рекомендаций.
                </p>
              )}
            </section>
          </section>
        ) : page === "Профиль" ? (
          <section className="profile-page">
            <span className="overline">YOUR COSMIC SPACE</span>
            <h1>Мой профиль</h1>

            <div className="profile-box">
              <div className="profile-avatar">
                {avatar ? <img src={avatar} alt="Аватар" /> : "✦"}
              </div>

              <h2>Звёздный пользователь</h2>
              <p>Твоя маленькая вселенная Hoshi.</p>

              <label className="upload-button">
                Загрузить фотографию
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file?.type.startsWith("image/")) {
                      setAvatar(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>

              <div className="profile-numbers">
                <div><strong>{favorites.length}</strong><span>Избранное</span></div>
                <div><strong>{animeList.length}</strong><span>Аниме</span></div>
              </div>
            </div>
          </section>
        ) : (
          <>
            {page === "Главная" && (
              <section className="home-hero">
                <div className="hero-copy">
                 
                  <h1>
                    Найди свою
                    <br />
                    <span>звезду.</span>
                  </h1>
                  <p>
                    Истории, которые остаются в сердце.
                    Открой свою следующую любимую вселенную.
                  </p>
                  <button
                    className="hero-button"
                    onClick={() => goTo("Каталог")}
                  >
                    Открыть каталог <span>↗</span>
                  </button>
                </div>

                <div className="hero-visual">
                 
                  <div className="hero-ring ring-one"></div>
                  <div className="hero-ring ring-two"></div>
                  <div className="hero-orb">
                    
                  </div>
                  <span className="hero-star star-one">✦</span>
                  <span className="hero-star star-two">✧</span>
                  <span className="hero-star star-three">✦</span>
                </div>
              </section>
            )}

            <section className="catalog-section">
              <div className="section-title">
                <div>
                 
                  <h2>
                    {page === "Избранное"
                      ? "Моё избранное"
                      : page === "Новинки"
                      ? "Новинки"
                      : page === "Каталог"
                      ? "Каталог аниме"
                      : "Популярное"}
                  </h2>
                </div>
                <span className="catalog-count">
                  {loading ? "Загрузка..." : `${filteredAnime.length} аниме`}
                </span>
              </div>

              <div className="search-field">
                <span>⌕</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Найти аниме..."
                />
              </div>

              <div className="catalog-status">
                {loading && "✦ Загружаем каталог AniList..."}
                {error && (
                  <>
                    {error}
                    <button onClick={() => setReload((value) => value + 1)}>
                      Повторить
                    </button>
                  </>
                )}
                {!loading && !error && (
                  <>
                    ✦ Загружено {animeList.length} аниме
                    <span> · </span>
                    {availableCount} с внешними ссылками на серии
                  </>
                )}
              </div>

              <div className="anime-grid">
                {filteredAnime.map((anime) => (
                  <AnimeCard
                    key={anime.id}
                    anime={anime}
                    onOpen={openAnime}
                    favorite={favorites.includes(anime.id)}
                    onFavorite={toggleFavorite}
                  />
                ))}
              </div>

              {!loading && !error && filteredAnime.length === 0 && (
                <div className="empty-state">
                  <span>✧</span>
                  <h3>Пока ничего не найдено</h3>
                  <p>Попробуй другое название.</p>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="site-footer">
        <button className="brand" onClick={() => goTo("Главная")}>
          <span>✦</span> HOSHI
        </button>
        <p>Твоя история. Твоя вселенная.</p>
      </footer>
    </div>
  );
}

export default App;