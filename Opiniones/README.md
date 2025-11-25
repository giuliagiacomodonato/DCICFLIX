# Microservicio de Opiniones 💬

Microservicio que consume mensajes de RabbitMQ (publicados por el servicio de Calificaciones) y los almacena en MongoDB para su posterior análisis y recomendación.

## Características

- ✅ Consume mensajes de RabbitMQ de forma asíncrona
- ✅ Almacena opiniones en MongoDB con índices optimizados
- ✅ API REST para consultar opiniones almacenadas
- ✅ Estadísticas de películas más vistas
- ✅ Reconexión automática a RabbitMQ y MongoDB

## Arquitectura

```
Calificaciones → RabbitMQ → Opiniones → MongoDB
                              ↓
                          API REST para consultas
```

## Requisitos

- Node.js 14+
- MongoDB (local o Docker)
- RabbitMQ (local o Docker)

## Instalación

```bash
npm install
```

## Configuración

Copia el archivo `.env.example` a `.env` y ajusta las variables:

```
PORT=3004
MONGODB_URI=mongodb://localhost:27017/opiniones
RABBITMQ_URL=amqp://localhost:5672
QUEUE_NAME=calificaciones_queue
```

## Ejecutar MongoDB y RabbitMQ con Docker

### MongoDB

```bash
docker run -d --name mongodb -p 27017:27017 mongo:latest
```

### RabbitMQ

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

## Uso

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm start
```

## API Endpoints

### 1. Health Check

```
GET /health
```

Respuesta:
```json
{
  "status": "OK",
  "service": "Opiniones",
  "mongodb": true,
  "rabbitmq": true
}
```

### 2. Obtener todas las opiniones (con paginación)

```
GET /api/opiniones?page=1&limit=10
```

Respuesta:
```json
{
  "page": 1,
  "limit": 10,
  "total": 45,
  "totalPages": 5,
  "data": [
    {
      "_id": "...",
      "userId": "usuario1",
      "movieId": "tt0468569",
      "movieTitle": "The Dark Knight",
      "type": "click",
      "timestamp": "2025-11-13T15:30:45.123Z",
      "source": "calificaciones"
    }
  ]
}
```

### 3. Obtener opiniones de un usuario

```
GET /api/opiniones/usuario/:userId?limit=50
```

Respuesta:
```json
{
  "userId": "usuario1",
  "total": 5,
  "data": [...]
}
```

### 4. Obtener opiniones de una película

```
GET /api/opiniones/pelicula/:movieId?limit=50
```

Respuesta:
```json
{
  "movieId": "tt0468569",
  "total": 12,
  "uniqueUsers": 8,
  "data": [...]
}
```

### 5. Obtener estadísticas generales

```
GET /api/opiniones/stats
```

Respuesta:
```json
{
  "totalOpinions": 45,
  "uniqueUsers": 3,
  "uniqueMovies": 15,
  "topMovies": [
    {
      "_id": "tt0468569",
      "count": 8,
      "title": "The Dark Knight"
    }
  ],
  "recentOpinions": [...]
}
```

### 6. Eliminar opiniones de un usuario

```
DELETE /api/opiniones/usuario/:userId
```

## Ejemplos de Uso

### Con PowerShell

```powershell
# Ver todas las opiniones
Invoke-RestMethod -Uri http://localhost:3004/api/opiniones

# Ver opiniones de un usuario
Invoke-RestMethod -Uri http://localhost:3004/api/opiniones/usuario/usuario1

# Ver opiniones de una película
Invoke-RestMethod -Uri http://localhost:3004/api/opiniones/pelicula/tt0468569

# Ver estadísticas
Invoke-RestMethod -Uri http://localhost:3004/api/opiniones/stats
```

### Con JavaScript (Frontend)

```javascript
// Obtener opiniones de un usuario
async function obtenerOpiniones(userId) {
  const response = await fetch(`http://localhost:3004/api/opiniones/usuario/${userId}`);
  return await response.json();
}

// Obtener estadísticas
async function obtenerEstadisticas() {
  const response = await fetch('http://localhost:3004/api/opiniones/stats');
  return await response.json();
}
```

## Estructura del Proyecto

```
opiniones/
├── src/
│   ├── index.js           # Punto de entrada, servidor Express
│   ├── consumer.js        # Consumidor de RabbitMQ
│   ├── database.js        # Conexión a MongoDB
│   ├── models/
│   │   └── Opinion.js     # Modelo de datos de Mongoose
│   └── routes/
│       └── opiniones.js   # Rutas de la API
├── .env                   # Variables de entorno
├── .env.example          # Ejemplo de configuración
├── package.json
└── README.md
```

## Funcionamiento

1. El servicio se conecta a MongoDB
2. Se conecta a RabbitMQ y escucha la cola `calificaciones_queue`
3. Cuando recibe un mensaje:
   - Lo parsea y valida
   - Crea un documento Opinion en MongoDB
   - Confirma el mensaje (ACK) a RabbitMQ
4. La API REST permite consultar las opiniones almacenadas

## Modelo de Datos

### Schema de Opinion

```javascript
{
  userId: String,          // ID del usuario
  movieId: String,         // ID de la película
  movieTitle: String,      // Título de la película
  type: String,            // 'click' o 'rating'
  timestamp: Date,         // Cuándo ocurrió
  source: String,          // De dónde vino ('calificaciones')
  createdAt: Date,         // Cuándo se creó en MongoDB
  updatedAt: Date          // Última actualización
}
```

### Índices

- `userId` - Para búsquedas por usuario
- `movieId` - Para búsquedas por película
- `timestamp` - Para ordenamiento cronológico
- `userId + timestamp` (compuesto) - Para historial de usuario
- `movieId + timestamp` (compuesto) - Para historial de película

## Docker

### Dockerfile

```bash
docker build -t opiniones-service .
docker run -p 3004:3004 --env-file .env opiniones-service
```

### Docker Compose

```bash
docker-compose up
```

Esto levanta:
- MongoDB en puerto 27017
- RabbitMQ en puertos 5672 (AMQP) y 15672 (Management)
- Microservicio Opiniones en puerto 3004

## Tests

```bash
npm test
```

## Verificar Funcionamiento

### 1. Verificar que el servicio está escuchando RabbitMQ

Deberías ver en los logs:
```
✅ Conectado a RabbitMQ
📥 Esperando mensajes en la cola: calificaciones_queue
🎧 Consumidor activo. Esperando mensajes...
```

### 2. Publicar un mensaje desde Calificaciones

Desde el servicio de Calificaciones, haz un POST:
```powershell
$body = @{
    userId = "usuario1"
    movieId = "tt0468569"
    movieTitle = "The Dark Knight"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3003/api/calificaciones `
    -Method POST -Body $body -ContentType "application/json"
```

### 3. Verificar que se guardó en MongoDB

Verás en los logs de Opiniones:
```
📨 Mensaje recibido: { userId: 'usuario1', movieId: 'tt0468569', ... }
💾 Opinión guardada en MongoDB: 673ab123...
✅ Mensaje procesado correctamente
```

### 4. Consultar las opiniones

```powershell
Invoke-RestMethod -Uri http://localhost:3004/api/opiniones/stats
```

## Integración con otros Microservicios

### Calificaciones → Opiniones

Calificaciones publica mensajes a RabbitMQ que Opiniones consume automáticamente.

### Opiniones → Recomendador

El microservicio Recomendador puede:
1. Consultar la API REST de Opiniones para obtener estadísticas
2. O consultar directamente MongoDB para análisis más complejos

## Manejo de Errores

- **RabbitMQ no disponible**: El servicio intentará reconectar automáticamente cada 5 segundos
- **MongoDB no disponible**: El servicio saldrá (debe ser reiniciado por un orquestador como Docker o K8s)
- **Mensaje malformado**: Se rechaza (NACK) sin reencolar para evitar bucles infinitos

## Notas de Producción

### Dead Letter Queue (DLQ)

En producción, considera configurar una Dead Letter Queue para mensajes que fallen:

```javascript
await channel.assertQueue(queueName, {
  durable: true,
  deadLetterExchange: 'dlx',
  deadLetterRoutingKey: 'failed_messages'
});
```

### Escalabilidad

- Puedes ejecutar múltiples instancias del consumidor
- RabbitMQ distribuirá los mensajes entre ellas (round-robin)
- MongoDB soporta réplicas para alta disponibilidad

### Monitoreo

Considera agregar:
- Prometheus para métricas
- Logs estructurados (Winston o Bunyan)
- Health checks avanzados
- APM (Application Performance Monitoring)

## Troubleshooting

### Error: "No se pudo conectar a MongoDB"

**Solución**: Asegúrate de que MongoDB está corriendo:
```bash
docker ps | grep mongodb
# o
mongo --eval "db.version()"
```

### Error: "No se pudo conectar a RabbitMQ"

**Solución**: Asegúrate de que RabbitMQ está corriendo:
```bash
docker ps | grep rabbitmq
```

### Los mensajes no se consumen

**Solución**: Verifica que la cola existe en RabbitMQ:
1. Abre http://localhost:15672 (guest/guest)
2. Ve a "Queues"
3. Busca `calificaciones_queue`

---

**¡Listo para consumir y almacenar opiniones!** 🎉
