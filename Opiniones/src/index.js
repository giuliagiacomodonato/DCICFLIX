require('dotenv').config();
const express = require('express');
const cors = require('cors');
const database = require('./database');
const consumer = require('./consumer');
const opinionesRouter = require('./routes/opiniones');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/opiniones', opinionesRouter);

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Opiniones',
    mongodb: database.isConnected,
    rabbitmq: consumer.isConsuming
  });
});

// Función para iniciar el servicio
async function startService() {
  try {
    // Conectar a MongoDB
    console.log('🔌 Conectando a MongoDB...');
    const mongoConnected = await database.connect();
    
    if (!mongoConnected) {
      console.error('❌ No se pudo conectar a MongoDB. Saliendo...');
      process.exit(1);
    }

    // Conectar a RabbitMQ y comenzar a consumir
    console.log('🔌 Conectando a RabbitMQ...');
    const rabbitConnected = await consumer.connect();
    
    if (!rabbitConnected) {
      console.error('❌ No se pudo conectar a RabbitMQ. Saliendo...');
      process.exit(1);
    }

    // Iniciar consumidor
    await consumer.startConsuming();

    // Iniciar servidor Express
    app.listen(PORT, () => {
      console.log(`🎬 Microservicio de Opiniones ejecutándose en puerto ${PORT}`);
      console.log(`📊 API REST disponible en http://localhost:${PORT}/api/opiniones`);
    });

  } catch (error) {
    console.error('❌ Error al iniciar el servicio:', error);
    process.exit(1);
  }
}

// Manejar cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servicio...');
  await consumer.close();
  await database.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Cerrando servicio...');
  await consumer.close();
  await database.disconnect();
  process.exit(0);
});

// Iniciar el servicio
startService();

module.exports = app;
