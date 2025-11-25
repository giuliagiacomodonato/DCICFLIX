const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3002;

const MOVIES_SERVICE_URL = process.env.MOVIES_SERVICE_URL || 'http://localhost:3001';

app.use(cors());
app.use(express.json());

// Obtener N películas al azar
app.get('/random/:count?', async (req, res) => {
  try {
    const count = parseInt(req.params.count) || 10;
    
    // Obtener todas las películas del servicio Movies
    const response = await axios.get(`${MOVIES_SERVICE_URL}/movies`);
    const allMovies = response.data;
    
    if (allMovies.length === 0) {
      return res.json([]);
    }
    
    // Seleccionar películas al azar
    const randomMovies = [];
    const selectedIndices = new Set();
    const maxCount = Math.min(count, allMovies.length);
    
    while (randomMovies.length < maxCount) {
      const randomIndex = Math.floor(Math.random() * allMovies.length);
      if (!selectedIndices.has(randomIndex)) {
        selectedIndices.add(randomIndex);
        randomMovies.push(allMovies[randomIndex]);
      }
    }
    
    res.json(randomMovies);
  } catch (error) {
    console.error('Error obteniendo películas aleatorias:', error.message);
    res.status(500).json({ error: 'Error obteniendo películas aleatorias' });
  }
});

// Obtener una película al azar
app.get('/random', async (req, res) => {
  try {
    const response = await axios.get(`${MOVIES_SERVICE_URL}/movies`);
    const allMovies = response.data;
    
    if (allMovies.length === 0) {
      return res.status(404).json({ error: 'No hay películas disponibles' });
    }
    
    const randomIndex = Math.floor(Math.random() * allMovies.length);
    res.json(allMovies[randomIndex]);
  } catch (error) {
    console.error('Error obteniendo película aleatoria:', error.message);
    res.status(500).json({ error: 'Error obteniendo película aleatoria' });
  }
});

app.listen(port, () => {
  console.log(`Microservicio RandomMovies escuchando en puerto ${port}`);
});
