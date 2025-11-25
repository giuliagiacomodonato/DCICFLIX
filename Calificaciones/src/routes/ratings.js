const express = require('express');
const router = express.Router();
const publisher = require('../publisher');
const historyStore = require('../historyStore');

// POST /api/calificaciones - Registrar click o calificación en estrellas
router.post('/', async (req, res) => {
  try {
    const { userId, movieId, movieTitle } = req.body;
    // Aceptamos `rating` como número opcional (0 - 5, paso 0.5)
    const ratingValue = req.body.rating;

    // Validar datos requeridos
    if (!userId || !movieId) {
      return res.status(400).json({
        error: 'Se requieren userId y movieId'
      });
    }

    // Validar rating si fue enviado
    let isRating = false;
    if (ratingValue !== undefined && ratingValue !== null) {
      const num = Number(ratingValue);
      if (Number.isNaN(num)) {
        return res.status(400).json({ error: 'El campo rating debe ser un número' });
      }

      // Debe estar entre 0 y 5 y ser múltiplo de 0.5
      if (num < 0 || num > 5 || Math.round(num * 2) !== num * 2) {
        return res.status(400).json({ error: 'El rating debe estar entre 0 y 5 con incrementos de 0.5' });
      }

      isRating = true;
    }

    // Crear objeto de calificación
    const ratingData = {
      userId,
      movieId,
      movieTitle: movieTitle || 'Sin título',
      timestamp: new Date().toISOString(),
      type: isRating ? 'rating' : 'click'
    };

    if (isRating) {
      ratingData.rating = Number(ratingValue);
    }

    // Guardar en el historial local (seguimos guardando clicks/hits)
    historyStore.addRating(userId, movieId);

    // Publicar a RabbitMQ: usamos una cola separada para ratings (estrellas)
    let published = false;
    if (isRating) {
      published = await publisher.publishStarRating(ratingData);
    } else {
      published = await publisher.publishRating(ratingData);
    }

    res.status(201).json({
      message: 'Calificación registrada exitosamente',
      data: ratingData,
      publishedToQueue: published
    });
  } catch (error) {
    console.error('Error al procesar calificación:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

// GET /api/calificaciones/historial/:userId - Obtener historial de un usuario
router.get('/historial/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const history = historyStore.getUserHistory(userId);

    res.json({
      userId,
      totalRatings: history.length,
      history
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

// DELETE /api/calificaciones/historial/:userId - Limpiar historial de un usuario
router.delete('/historial/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    historyStore.clearUserHistory(userId);

    res.json({
      message: `Historial del usuario ${userId} eliminado exitosamente`
    });
  } catch (error) {
    console.error('Error al eliminar historial:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

module.exports = router;
