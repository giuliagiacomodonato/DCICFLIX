const mongoose = require('mongoose');

class Database {
  constructor() {
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      console.log('✅ Ya conectado a MongoDB');
      return true;
    }

    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/opiniones';

      await mongoose.connect(mongoUri);

      this.isConnected = true;
      console.log('✅ Conectado a MongoDB:', mongoUri);
      
      // Manejar eventos de conexión
      mongoose.connection.on('error', (err) => {
        console.error('❌ Error de MongoDB:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️  Desconectado de MongoDB');
        this.isConnected = false;
      });

      return true;
    } catch (error) {
      console.error('❌ Error al conectar con MongoDB:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('🔌 Desconectado de MongoDB');
    } catch (error) {
      console.error('Error al desconectar de MongoDB:', error.message);
    }
  }

  getConnection() {
    return mongoose.connection;
  }
}

// Singleton
const database = new Database();

module.exports = database;
