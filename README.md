# Microservicios de Películas

Aplicación dockerizada con dos microservicios para gestión de películas.

## Servicios

- **MongoDB**: Base de datos en puerto 27017
- **Movies**: API de películas en puerto 3001
- **RandomMovies**: API de películas aleatorias en puerto 3002

## Ejecutar con Docker Compose

```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v
```

## Endpoints

### Movies Service (http://localhost:3001)

- `GET /movies` - Todas las películas
- `GET /movies/:id` - Película por ID
- `GET /movies/search/title/:title` - Buscar por título
- `GET /movies/search/plot/:text` - Buscar por plot
- `GET /movies/search/fullplot/:text` - Buscar por fullplot
- `GET /movies/search/genre/:genre` - Buscar por género
- `GET /movies/search/director/:director` - Buscar por director
- `GET /movies/search/writer/:writer` - Buscar por escritor
- `GET /movies/search/cast/:actor` - Buscar por actor
- `GET /movies/search/year/:year` - Buscar por año
- `GET /movies/search/rating/:minRating` - Buscar por rating mínimo
- `GET /movies/search/country/:country` - Buscar por país
- `GET /movies/search/language/:language` - Buscar por idioma
- `GET /movies/search/type/:type` - Buscar por tipo
- `GET /movies/search?param=value` - Búsqueda avanzada
- `POST /movies/batch` - Obtener múltiples películas por IDs

### RandomMovies Service (http://localhost:3002)

- `GET /random` - Una película aleatoria
- `GET /random/:count` - N películas aleatorias

## Ejemplos de uso

```bash
# Obtener todas las películas
curl http://localhost:3001/movies

# Buscar por género
curl http://localhost:3001/movies/search/genre/Comedy

# Búsqueda avanzada
curl "http://localhost:3001/movies/search?genre=Comedy&minRating=7"

# Película aleatoria
curl http://localhost:3002/random

# 5 películas aleatorias
curl http://localhost:3002/random/5
```

## Desarrollo local (sin Docker)

### Movies Service
```bash
cd movies
npm install
npm start
```

### RandomMovies Service
```bash
cd randommovies
npm install
npm start
```
