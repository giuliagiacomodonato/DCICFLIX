const amqp = require('amqplib');

class RabbitMQPublisher {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.queueName = process.env.QUEUE_NAME || 'calificaciones_queue';
    this.ratingQueueName = process.env.RATINGS_QUEUE_NAME || 'calificaciones_ratings_queue';
    this.isConnecting = false;
  }

  async connect() {
    if (this.isConnecting) {
      return false;
    }

    this.isConnecting = true;
    
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      
      // Asegurar que la cola existe
      await this.channel.assertQueue(this.queueName, { durable: true });
      // Cola separada para calificaciones con estrellas
      await this.channel.assertQueue(this.ratingQueueName, { durable: true });
      
      console.log('✅ Conectado a RabbitMQ');
      this.isConnecting = false;
      return true;
    } catch (error) {
      console.warn('⚠️  RabbitMQ no disponible:', error.message);
      console.warn('⚠️  El servicio funcionará sin publicar mensajes a RabbitMQ');
      this.isConnecting = false;
      return false;
    }
  }

  async publishRating(ratingData) {
    try {
      if (!this.channel && !this.isConnecting) {
        const connected = await this.connect();
        if (!connected) {
          console.warn('⚠️  Mensaje no publicado (RabbitMQ no disponible)');
          return false;
        }
      }

      if (this.channel) {
        const message = JSON.stringify(ratingData);
        this.channel.sendToQueue(
          this.queueName,
          Buffer.from(message),
          { persistent: true }
        );

        console.log('📤 Calificación publicada a RabbitMQ:', ratingData);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error al publicar mensaje:', error.message);
      this.channel = null;
      this.connection = null;
      return false;
    }
  }

  async publishStarRating(ratingData) {
    try {
      if (!this.channel && !this.isConnecting) {
        const connected = await this.connect();
        if (!connected) {
          console.warn('⚠️  Mensaje de rating no publicado (RabbitMQ no disponible)');
          return false;
        }
      }

      if (this.channel) {
        const message = JSON.stringify(ratingData);
        this.channel.sendToQueue(
          this.ratingQueueName,
          Buffer.from(message),
          { persistent: true }
        );

        console.log('📤 Rating publicado a RabbitMQ (estrellas):', ratingData);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Error al publicar rating:', error.message);
      this.channel = null;
      this.connection = null;
      return false;
    }
  }

  async close() {
    try {
      await this.channel?.close();
      await this.connection?.close();
      console.log('🔌 Conexión con RabbitMQ cerrada');
    } catch (error) {
      console.error('Error al cerrar conexión:', error.message);
    }
  }
}

// Singleton
const publisher = new RabbitMQPublisher();

module.exports = publisher;
