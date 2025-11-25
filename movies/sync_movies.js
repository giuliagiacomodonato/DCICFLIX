// sync_movies.js

const { MongoClient } = require('mongodb');

const TMDB_API_KEY = "62e9afa9b26ec1658e4f7c572663a19b";
const TMDB_BASE = 'https://api.themoviedb.org/3';
const MONGO_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'peliculas';

// pequeño helper para no matar la API
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===== 1) Descubrir películas por año (lista básica) =====
async function fetchMoviesByYear(year) {
  let page = 1;
  let totalPages = 1;
  const results = [];
  const MAX_PAGES = 50; // cambiá esto si querés más/menos

  do {
    const url = `${TMDB_BASE}/discover/movie`;
    const params = new URLSearchParams({
        api_key: TMDB_API_KEY,
        language: 'es-ES',
        sort_by: 'popularity.desc',
        include_adult: 'false',
        primary_release_year: year.toString(),
        page: page.toString(),
    });

    const res = await fetch(`${url}?${params}`);
    const data = await res.json();

    if (data.results) {
        results.push(...data.results);
    }
    
    totalPages = data.total_pages;
    console.log(`  Año ${year} - página ${page}/${Math.min(totalPages, MAX_PAGES)}`);
    page += 1;
    await sleep(250); // 0.25s entre páginas
  } while (page <= totalPages && page <= MAX_PAGES);

  return results;
}

// ===== 2) Detalle completo de una película =====
async function fetchMovieDetails(tmdbId) {
  const url = `${TMDB_BASE}/movie/${tmdbId}`;
  const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: 'es-ES',
      append_to_response: 'credits',
  });
  
  const res = await fetch(`${url}?${params}`);
  return await res.json();
}

// ===== 3) Mapear detalle TMDB -> documento Mongo (similar al tuyo) =====
function mapMovie(details) {
  const genres = (details.genres || []).map((g) => g.name);

  const spokenLanguages =
    (details.spoken_languages || []).map((l) => l.iso_639_1 || l.name).filter(Boolean);

  const countries =
    (details.production_countries || []).map((c) => c.iso_3166_1 || c.name).filter(Boolean);

  // cast (primeros 10 ordenados)
  const cast =
    (details.credits?.cast || [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .slice(0, 10)
      .map((c) => c.name);

  // directores
  const crew = details.credits?.crew || [];
  const directors = crew
    .filter((p) => p.job === 'Director')
    .map((p) => p.name);

  // guionistas / escritores
  const writers = crew
    .filter((p) => ['Writer', 'Screenplay', 'Author'].includes(p.job))
    .map((p) => p.name);

  const year = details.release_date ? Number(details.release_date.slice(0, 4)) : null;

  // intento convertir el imdb_id ("tt1234567") a número como en tu ejemplo
  const imdbIdStr = details.imdb_id || null;
  let imdbIdNum = null;
  if (imdbIdStr && imdbIdStr.startsWith('tt')) {
    const numPart = imdbIdStr.slice(2);
    const parsed = parseInt(numPart, 10);
    if (!Number.isNaN(parsed)) {
      imdbIdNum = parsed;
    }
  }

  return {
    plot: details.overview || '',
    genres,
    runtime: details.runtime ?? null,
    cast,
    num_mflix_comments: 0,
    poster: details.poster_path
      ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
      : null,
    title: details.title,
    fullplot: details.overview || '',
    languages: spokenLanguages.length
      ? spokenLanguages
      : [details.original_language].filter(Boolean),
    released: details.release_date ? new Date(details.release_date) : null,
    directors,
    writers,
    awards: {
      wins: 0,
      nominations: 0,
      text: '',
    },
    lastupdated: new Date(),
    year,
    imdb: {
      rating: details.vote_average ?? null,
      votes: details.vote_count ?? 0,
      id: imdbIdNum, // puede quedar null si TMDB no da imdb_id
    },
    countries,
    type: 'movie',
    tomatoes: {}, // TMDB no da Rotten Tomatoes, lo dejamos vacío
    tmdbId: details.id, // campo explícito para TMDB
    tmdb_raw: details, // por si después querés más info
  };
}

// ===== 4) MAIN =====
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  // FIX: Usar la base de datos correcta 'peliculas'
  const db = client.db(dbName);
  const col = db.collection('movies');

  console.log(`Conectado a MongoDB: Base de datos '${dbName}', Colección 'movies'`);

  for (let year = 2024; year <= 2025; year++) {
    console.log(`\n=== Importando año ${year} ===`);
    const basicMovies = await fetchMoviesByYear(year);
    console.log(`Películas encontradas (discover): ${basicMovies.length}`);

    let count = 0;

    for (const m of basicMovies) {
      try {
        const details = await fetchMovieDetails(m.id);
        const doc = mapMovie(details);

        // upsert usando tmdbId como identificador estable
        await col.updateOne(
          { tmdbId: details.id },
          { $set: doc },
          { upsert: true },
        );

        count += 1;
        if (count % 20 === 0) {
          console.log(`  Insertadas/actualizadas: ${count}`);
        }

        await sleep(300); // 0.3s entre detalles para respetar límites de TMDB
      } catch (err) {
        console.error(`  Error con película TMDB id=${m.id}:`, err.message);
      }
    }

    console.log(`Año ${year} importado. Total procesadas: ${count}`);
  }

  await client.close();
  console.log('\nProceso terminado.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
