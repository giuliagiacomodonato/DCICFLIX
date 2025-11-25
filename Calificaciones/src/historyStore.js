// Almacenamiento en memoria del historial de calificaciones por usuario
class HistoryStore {
  constructor() {
    this.history = {}; // { userId: [{ movieId, timestamp }] }
  }

  addRating(userId, movieId) {
    if (!this.history[userId]) {
      this.history[userId] = [];
    }

    const rating = {
      movieId,
      timestamp: new Date().toISOString()
    };

    this.history[userId].push(rating);

    // Mantener solo las últimas 50 calificaciones por usuario
    if (this.history[userId].length > 50) {
      this.history[userId].shift();
    }

    return rating;
  }

  getUserHistory(userId) {
    return this.history[userId] || [];
  }

  clearUserHistory(userId) {
    delete this.history[userId];
  }

  getAllHistory() {
    return this.history;
  }
}

// Singleton
const historyStore = new HistoryStore();

module.exports = historyStore;
