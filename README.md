# DCICFLIX - Sistema de Recomendación de Películas

Sistema de microservicios para visualización y recomendación inteligente de películas basado en las calificaciones del usuario.

## Descripción del Proyecto

DCICFLIX es un sistema ficticio que permite a los usuarios explorar un catálogo de películas y recibir recomendaciones personalizadas basadas en sus interacciones (clicks y calificaciones). El sistema utiliza una arquitectura de microservicios con comunicación asíncrona mediante RabbitMQ y MongoDB como base de datos principal.

## Arquitectura de Microservicios

### 🎨 Frontend (Next.js 14 - Port 3000)
Interfaz de usuario web que proporciona:
- Navegación por diferentes categorías de películas
- Visualización de posters, tramas y detalles de películas
- Sistema de calificación de 0.5 a 5 estrellas
- Secciones personalizadas:
  - **"Te va a gustar"**: Película destacada personalizada
  - **"Recomendaciones para ti"**: Basadas en gustos y disgustos
  - **"Terminar de ver"**: Películas clickeadas pero no calificadas
  - **"Porque te gusta [Género]"**: Recomendaciones del género favorito
  - Categorías generales: Tendencias, Aleatorias, Populares, Nuevos Lanzamientos, Acción, Comedia

**Tecnologías:** Next.js 14, React, CSS Modules

### 🎬 Movies (Express.js - Port 3001)
Microservicio que actúa como API Gateway para la base de datos de películas.

**Endpoints principales:**
- `GET /movies/search` - Búsqueda avanzada con filtros (género, año, rating, etc.)
- `GET /movies/trending` - Películas populares de TMDB
- `GET /movies/:id` - Detalles de una película específica

**Características:**
- Oculta la complejidad de MongoDB
- Integración con API de TMDB para películas actuales
- Caché de resultados para optimización
- Soporte para búsquedas por género, año, rating y ordenamiento

**Tecnologías:** Node.js, Express, MongoDB, Axios (para TMDB)

### 🎲 RandomMovies (Express.js - Port 3002)
Microservicio especializado en devolver colecciones aleatorias de películas del catálogo.

**Endpoints:**
- `GET /random/:count` - Devuelve N películas aleatorias

**Características:**
- Utiliza agregación de MongoDB con `$sample` para aleatoriedad eficiente
- Ideal para sección de "Descubrimiento" y variedad de contenido

**Tecnologías:** Node.js, Express, MongoDB

### ⭐ Calificación (Express.js - Port 3003)
Microservicio que procesa las interacciones del usuario (clicks y ratings).

**Endpoints:**
- `POST /api/calificaciones` - Registra clicks y calificaciones

**Flujo de trabajo:**
1. Recibe la calificación del usuario desde el frontend
2. Valida y procesa la información
3. Publica el evento en RabbitMQ (cola: `opiniones`)
4. Comunicación asíncrona con el microservicio de Opiniones

**Características:**
- Sistema de eventos basado en RabbitMQ
- Desacoplamiento mediante mensajería
- Validación de datos de entrada
- Logging de todas las interacciones

**Tecnologías:** Node.js, Express, RabbitMQ (amqplib)

### 💬 Opiniones (Express.js - Port 3004)
Microservicio consumidor que almacena las calificaciones en la base de datos.

**Características:**
- Consume mensajes de la cola RabbitMQ `opiniones`
- Persiste las opiniones en MongoDB
- Maneja dos tipos de eventos:
  - `click`: Registro de interés en una película
  - `rating`: Calificación numérica (0.5 - 5 estrellas)
- Timestamps automáticos para análisis temporal
- Base de datos independiente (`opiniones`) para escalabilidad

**Tecnologías:** Node.js, Express, RabbitMQ, MongoDB

### 🧠 Recomendador (Flask/Python - Port 3005)
Microservicio inteligente que genera recomendaciones personalizadas utilizando Machine Learning y análisis de similitud.
(La actualización de las películas recomendadas se hace una vez al levantar la aplicación docker, para ver cambios en estas secciones se deben calificar varias películas y luego volver a levantar la aplicación)

📖 **[Ver documentación completa del Recomendador](./recomendador/README.md)**

**Tecnologías:** Python 3.11, Flask, scikit-learn, pandas, numpy, pymongo

## Infraestructura

### 🗄️ MongoDB Atlas
- **Base de datos:** `peliculas` (catálogo de +5000 películas)
- **Base de datos:** `opiniones` (interacciones de usuarios)
- Esquema flexible para datos de películas (IMDb, TMDB, géneros, cast, etc.)

### 🐰 RabbitMQ
- Broker de mensajería para comunicación asíncrona
- Cola `opiniones` para eventos de calificación
- Desacoplamiento entre Calificación y Opiniones
- Persistencia de mensajes para tolerancia a fallos

### 🐳 Docker & Docker Compose
Todos los servicios están containerizados para fácil despliegue.

**Servicios en docker-compose.yml:**
- frontend
- movies
- randommovies
- calificaciones
- opiniones
- recomendador
- rabbitmq (imagen oficial)

**Red:** `microservicios-network` (bridge)

## Instalación y Ejecución

### Requisitos
- Docker Desktop
- Docker Compose
- Puertos disponibles: 3000-3005, 5672, 15672

### Ejecutar el proyecto completo

```bash
# Clonar el repositorio
git clone https://github.com/giuliagiacomodonato/DCICFLIX.git
cd DCICFLIX

# Levantar todos los servicios
docker-compose up -d

# Ver logs de todos los servicios
docker-compose logs -f

# Detener todos los servicios
docker-compose down
```

### Acceder a los servicios

- **Frontend:** http://localhost:3000
- **Movies API:** http://localhost:3001
- **RandomMovies API:** http://localhost:3002
- **Calificación API:** http://localhost:3003
- **Opiniones API:** http://localhost:3004
- **Recomendador API:** http://localhost:3005
- **RabbitMQ Management:** http://localhost:15672 (user: guest, pass: guest)


