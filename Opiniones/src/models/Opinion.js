const mongoose = require('mongoose');

const opinionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  movieId: {
    type: String,
    required: true,
    index: true
  },
  movieTitle: {
    type: String,
    default: 'Sin título'
  },
  type: {
    type: String,
    default: 'click',
    enum: ['click', 'rating']
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  source: {
    type: String,
    default: 'calificaciones'
  }
}, {
  timestamps: true // Agrega createdAt y updatedAt automáticamente
});

// Índice compuesto para consultas frecuentes
opinionSchema.index({ userId: 1, timestamp: -1 });
opinionSchema.index({ movieId: 1, timestamp: -1 });

const Opinion = mongoose.model('Opinion', opinionSchema);

module.exports = Opinion;
