const amqp = require('amqplib');
const Opinion = require('./models/Opinion');

class RabbitMQConsumer {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.queueName = process.env.QUEUE_NAME || 'calificaciones_queue';
    this.ratingsQueueName = process.env.RATINGS_QUEUE_NAME || 'calificaciones_ratings_queue';
    this.isConsuming = false;
  }

  async connect() {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      
      // Asegurar que las colas existen
      await this.channel.assertQueue(this.queueName, { durable: true });
      await this.channel.assertQueue(this.ratingsQueueName, { durable: true });
      
      // Configurar prefetch para procesar un mensaje a la vez
      this.channel.prefetch(1);
      
      console.log('✅ Conectado a RabbitMQ');
      console.log(`📥 Esperando mensajes en la cola: ${this.queueName}`);
      
      // Manejar errores de conexión
      this.connection.on('error', (err) => {
        console.error('❌ Error de conexión RabbitMQ:', err.message);
        this.reconnect();
      });

      this.connection.on('close', () => {
        console.warn('⚠️  Conexión RabbitMQ cerrada. Reconectando...');
        this.reconnect();
      });

      return true;
    } catch (error) {
      console.error('❌ Error al conectar con RabbitMQ:', error.message);
      return false;
    }
  }

  async reconnect() {
    if (this.isConsuming) {
      this.isConsuming = false;
      console.log('🔄 Intentando reconectar en 5 segundos...');
      setTimeout(() => {
        this.connect().then(() => {
          if (!this.isConsuming) {
            this.startConsuming();
          }
        });
      }, 5000);
    }
  }

  async startConsuming() {
    try {
      if (!this.channel) {
        const connected = await this.connect();
        if (!connected) {
          console.error('❌ No se pudo conectar a RabbitMQ');
          return false;
        }
      }

      this.isConsuming = true;

      // Consumidor para eventos generales (clicks y otros)
      this.channel.consume(
        this.queueName,
        async (msg) => {
          if (msg) {
            try {
              const content = msg.content.toString();
              const data = JSON.parse(content);
              
              console.log('📨 Mensaje recibido (cola principal):', data);

              // Guardar en MongoDB
              const opinion = new Opinion({
                userId: data.userId,
                movieId: data.movieId,
                movieTitle: data.movieTitle || 'Sin título',
                type: data.type || 'click',
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                source: 'calificaciones'
              });

              await opinion.save();
              console.log('💾 Opinión guardada en MongoDB:', opinion._id);

              // Confirmar el mensaje (ACK)
              this.channel.ack(msg);
              console.log('✅ Mensaje procesado correctamente\n');

            } catch (error) {
              console.error('❌ Error al procesar mensaje:', error.message);
              this.channel.nack(msg, false, false);
            }
          }
        },
        {
          noAck: false // Requiere confirmación manual
        }
      );

      // Consumidor para calificaciones en estrellas (cola separada)
      this.channel.consume(
        this.ratingsQueueName,
        async (msg) => {
          if (msg) {
            try {
              const content = msg.content.toString();
              const data = JSON.parse(content);

              console.log('📨 Mensaje recibido (ratings):', data);

              // Guardar rating en MongoDB
              const opinion = new Opinion({
                userId: data.userId,
                movieId: data.movieId,
                movieTitle: data.movieTitle || 'Sin título',
                type: 'rating',
                rating: typeof data.rating === 'number' ? data.rating : data.rating ? Number(data.rating) : null,
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                source: 'calificaciones'
              });

              await opinion.save();
              console.log('💾 Rating guardado en MongoDB:', opinion._id);

              // Confirmar el mensaje (ACK)
              this.channel.ack(msg);
              console.log('✅ Mensaje de rating procesado correctamente\n');

            } catch (error) {
              console.error('❌ Error al procesar mensaje de rating:', error.message);
              this.channel.nack(msg, false, false);
            }
          }
        },
        {
          noAck: false
        }
      );

      console.log('🎧 Consumidor activo. Esperando mensajes...\n');
      return true;

    } catch (error) {
      console.error('❌ Error al iniciar consumidor:', error.message);
      this.isConsuming = false;
      return false;
    }
  }

  async close() {
    try {
      this.isConsuming = false;
      await this.channel?.close();
      await this.connection?.close();
      console.log('🔌 Conexión con RabbitMQ cerrada');
    } catch (error) {
      console.error('Error al cerrar conexión:', error.message);
    }
  }
}

// Singleton
const consumer = new RabbitMQConsumer();

module.exports = consumer;
