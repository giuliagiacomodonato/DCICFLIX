const express = require('express');
const cors = require('cors');
require('dotenv').config();

const ratingsRouter = require('./routes/ratings');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/calificaciones', ratingsRouter);

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Calificaciones' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🎬 Microservicio de Calificaciones ejecutándose en puerto ${PORT}`);
});

module.exports = app;
