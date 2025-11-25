const express = require('express');
const router = express.Router();
const Opinion = require('../models/Opinion');

// GET /api/opiniones - Obtener todas las opiniones con paginación
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const opinions = await Opinion.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Opinion.countDocuments();

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: opinions
    });
  } catch (error) {
    console.error('Error al obtener opiniones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/opiniones/usuario/:userId - Obtener opiniones de un usuario
router.get('/usuario/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const opinions = await Opinion.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json({
      userId,
      total: opinions.length,
      data: opinions
    });
  } catch (error) {
    console.error('Error al obtener opiniones del usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/opiniones/pelicula/:movieId - Obtener opiniones de una película
router.get('/pelicula/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const opinions = await Opinion.find({ movieId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    const uniqueUsers = [...new Set(opinions.map(o => o.userId))].length;

    res.json({
      movieId,
      total: opinions.length,
      uniqueUsers,
      data: opinions
    });
  } catch (error) {
    console.error('Error al obtener opiniones de la película:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/opiniones/stats - Estadísticas generales
router.get('/stats', async (req, res) => {
  try {
    const totalOpinions = await Opinion.countDocuments();
    
    const uniqueUsers = await Opinion.distinct('userId');
    const uniqueMovies = await Opinion.distinct('movieId');

    const recentOpinions = await Opinion.find()
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();

    // Top películas más vistas
    const topMovies = await Opinion.aggregate([
      { $group: { _id: '$movieId', count: { $sum: 1 }, title: { $first: '$movieTitle' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      totalOpinions,
      uniqueUsers: uniqueUsers.length,
      uniqueMovies: uniqueMovies.length,
      topMovies,
      recentOpinions
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/opiniones/usuario/:userId - Eliminar opiniones de un usuario
router.delete('/usuario/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await Opinion.deleteMany({ userId });

    res.json({
      message: `Opiniones del usuario ${userId} eliminadas`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error al eliminar opiniones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
