const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
const port = process.env.PORT || 3001;

const TMDB_API_KEY = "62e9afa9b26ec1658e4f7c572663a19b";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const connectionUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'peliculas';

let db;
let coll;

// Conectar a MongoDB
MongoClient.connect(connectionUrl, { useUnifiedTopology: true })
  .then(client => {
    console.log('Conectado a MongoDB');
    db = client.db(dbName);
    coll = db.collection('movies');
    
    // Iniciar servidor solo después de conectar a MongoDB
    app.listen(port, () => {
      console.log(`Microservicio Movies escuchando en puerto ${port}`);
    });
  })
  .catch(error => {
    console.error('Error conectando a MongoDB:', error);
    process.exit(1);
  });

app.use(express.json());

// Obtener tendencias de TMDB
app.get('/movies/trending', async (req, res) => {
  try {
    const response = await fetch(`${TMDB_BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}&language=en-US`);
    const data = await response.json();
    
    // Mapear datos de TMDB a la estructura de nuestra app
    const movies = data.results.map(item => ({
      _id: `tmdb_${item.id}`,
      title: item.title || item.name,
      poster: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null,
      plot: item.overview,
      year: item.release_date ? new Date(item.release_date).getFullYear() : (item.first_air_date ? new Date(item.first_air_date).getFullYear() : null),
      imdb: {
        rating: item.vote_average
      },
      genres: [], // TMDB devuelve IDs de géneros, simplificamos por ahora
      type: item.media_type
    })).slice(0, 10); // Limitar a 10

    res.json(movies);
  } catch (error) {
    console.error('Error fetching trending from TMDB:', error);
    res.status(500).json({ error: 'Error obteniendo tendencias' });
  }
});

// Obtener todas las películas
app.get('/movies', async (req, res) => {
  try {
    const movies = await coll.find({}).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo películas' });
  }
});

// Búsqueda avanzada con múltiples filtros usando query params
app.get('/movies/search', async (req, res) => {
  try {
    const query = {};
    
    // Filtros de texto (búsqueda parcial)
    if (req.query.title) query.title = { $regex: req.query.title, $options: 'i' };
    if (req.query.plot) query.plot = { $regex: req.query.plot, $options: 'i' };
    if (req.query.fullplot) query.fullplot = { $regex: req.query.fullplot, $options: 'i' };
    if (req.query.genre) query.genres = { $regex: req.query.genre, $options: 'i' };
    if (req.query.director) query.directors = { $regex: req.query.director, $options: 'i' };
    if (req.query.writer) query.writers = { $regex: req.query.writer, $options: 'i' };
    if (req.query.cast) query.cast = { $regex: req.query.cast, $options: 'i' };
    if (req.query.country) query.countries = { $regex: req.query.country, $options: 'i' };
    if (req.query.language) query.languages = { $regex: req.query.language, $options: 'i' };
    if (req.query.type) query.type = { $regex: req.query.type, $options: 'i' };
    
    // Filtros exactos
    if (req.query.year) query.year = parseInt(req.query.year);
    if (req.query.rated) query.rated = req.query.rated;
    
    // Filtros de rango
    if (req.query.minRating) query['imdb.rating'] = { ...query['imdb.rating'], $gte: parseFloat(req.query.minRating) };
    if (req.query.maxRating) query['imdb.rating'] = { ...query['imdb.rating'], $lte: parseFloat(req.query.maxRating) };
    if (req.query.minYear) query.year = { ...query.year, $gte: parseInt(req.query.minYear) };
    if (req.query.maxYear) query.year = { ...query.year, $lte: parseInt(req.query.maxYear) };
    
    let cursor = coll.find(query);

    // Sorting
    if (req.query.sort) {
      const sortOrder = req.query.desc === 'true' ? -1 : 1;
      cursor = cursor.sort({ [req.query.sort]: sortOrder });
    } else if (req.query.random === 'true') {
      // Si se pide orden aleatorio, usar sample de MongoDB
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      const movies = await coll.aggregate([
        { $match: query },
        { $sample: { size: limit } }
      ]).toArray();
      return res.json(movies);
    }

    // Limit
    if (req.query.limit) {
      const limit = parseInt(req.query.limit);
      cursor = cursor.limit(limit);
    }

    const movies = await cursor.toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error en búsqueda avanzada' });
  }
});

// Buscar películas por título
app.get('/movies/search/title/:title', async (req, res) => {
  try {
    const movies = await coll.find({ 
      title: { $regex: req.params.title, $options: 'i' } 
    }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando películas por título' });
  }
});

// Buscar películas por plot
app.get('/movies/search/plot/:text', async (req, res) => {
  try {
    const movies = await coll.find({ 
      plot: { $regex: req.params.text, $options: 'i' } 
    }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando películas por plot' });
  }
});

// Buscar películas por fullplot
app.get('/movies/search/fullplot/:text', async (req, res) => {
  try {
    const movies = await coll.find({ 
      fullplot: { $regex: req.params.text, $options: 'i' } 
    }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando películas por fullplot' });
  }
});

// Buscar películas por género
app.get('/movies/search/genre/:genre', async (req, res) => {
  try {
    const movies = await coll.find({ 
      genres: { $regex: req.params.genre, $options: 'i' } 
    }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando películas por género' });
  }
});

// Buscar películas por director
app.get('/movies/search/director/:director', async (req, res) => {
  try {
    const movies = await coll.find({ 
      directors: { $regex: req.params.director, $options: 'i' } 
    }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando películas por director' });
  }
});

// Buscar películas por escritor (writer)
app.get('/movies/search/writer/:writer', async (req, res) => {
  try {
    const movies = await coll.find({ 
      writers: { $regex: req.params.writer, $options: 'i' } 
    }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando películas por escritor' });
  }
});

// Buscar películas por actor (cast)
app.get('/movies/search/cast/:actor', async (req, res) => {
  try {
    const movies = await coll.find({ 
      cast: { $regex: req.params.actor, $options: 'i' } 
    }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando películas por actor' });
  }
});

// Buscar películas por año
app.get('/movies/search/year/:year', async (req, res) => {
  try {
    const movies = await coll.find({ 
      year: parseInt(req.params.year) 
    }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando películas por año' });
  }
});

// Buscar películas por rating de IMDB (mayor o igual)
app.get('/movies/search/rating/:minRating', async (req, res) => {
  try {
    const movies = await coll.find({ 
      'imdb.rating': { $gte: parseFloat(req.params.minRating) } 
    }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando películas por rating' });
  }
});

// Buscar películas por país
app.get('/movies/search/country/:country', async (req, res) => {
  try {
    const movies = await coll.find({ 
      countries: { $regex: req.params.country, $options: 'i' } 
    }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando películas por país' });
  }
});

// Buscar películas por idioma
app.get('/movies/search/language/:language', async (req, res) => {
  try {
    const movies = await coll.find({ 
      languages: { $regex: req.params.language, $options: 'i' } 
    }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando películas por idioma' });
  }
});

// Buscar películas por tipo
app.get('/movies/search/type/:type', async (req, res) => {
  try {
    const movies = await coll.find({ 
      type: { $regex: req.params.type, $options: 'i' } 
    }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error buscando películas por tipo' });
  }
});

// Obtener películas por una lista de IDs
app.post('/movies/batch', async (req, res) => {
  try {
    const { ids } = req.body;
    const { ObjectId } = require('mongodb');
    const objectIds = ids.map(id => new ObjectId(id));
    const movies = await coll.find({ _id: { $in: objectIds } }).toArray();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo películas' });
  }
});

// Obtener una película por ID (debe ir al final)
app.get('/movies/:id', async (req, res) => {
  try {
    const { ObjectId } = require('mongodb');
    const movie = await coll.findOne({ _id: new ObjectId(req.params.id) });
    if (movie) {
      res.json(movie);
    } else {
      res.status(404).json({ error: 'Película no encontrada' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo película' });
  }
});
