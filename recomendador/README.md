# Sistema de Recomendación Híbrido para DCICFLIX

Sistema de recomendación de películas que combina **similitud de contenido** con **interacciones de usuario** (clicks y ratings).

## Características

- **Recomendación por similitud**: Basada en géneros, directores y actores
- **Métricas de interacción**: Considera clicks y ratings de usuarios
- **Rating ponderado**: Usa la fórmula de IMDb combinada con ratings de usuarios
- **Score híbrido**: Combina similitud (50%) + rating ponderado (30%) + interacciones (20%)

## Instalación

```bash
pip install -r requirements.txt
```

## Uso

### Importar y usar el recomendador

```python
from recommender import MovieRecommender

# Inicializar
recommender = MovieRecommender()
recommender.load_movies()

# Obtener recomendaciones basadas en una película
recs = recommender.get_recommendations("The Godfather", n=10)
print(recs)

# Obtener top películas (todas)
top = recommender.get_top_movies(n=10)
print(top)

# Obtener top películas por género
top_drama = recommender.get_top_movies(genre='Drama', n=10)
print(top_drama)

# Cerrar conexión
recommender.close()
```

### Función rápida

```python
from recommender import get_movie_recommendations

recs = get_movie_recommendations("The Godfather", n=5)
print(recs)
```

## Configuración

El sistema lee las siguientes variables de entorno:

- `MONGODB_URL`: URL de conexión a MongoDB
- `DB_NAME`: Nombre de la base de datos de películas (default: 'peliculas')
- `OPINIONES_DB`: Nombre de la base de datos de opiniones (default: 'opiniones')

## Algoritmo

### 1. Similitud de Contenido
Se crea una "sopa" de características combinando:
- Título de la película
- Géneros
- Directores (normalizados)
- Top 5 actores (normalizados)

Se usa **CountVectorizer** con n-gramas (1,2) y se calcula la **similitud por coseno**.

### 2. Métricas de Interacción
- **Clicks**: Cada vez que un usuario hace click en una película
- **Ratings**: Calificaciones de 0.5 a 5 estrellas
- **Interaction Score**: `(clicks * 0.3) + (rating_sum * 0.7)`

### 3. Rating Ponderado
Usa la fórmula de IMDb:

```
WR = (v/(v+m) * R) + (m/(v+m) * C)
```

Donde:
- `v` = votos totales (IMDb + usuarios + clicks)
- `m` = percentil 85 de votos
- `R` = rating combinado (60% IMDb + 40% usuarios)
- `C` = rating promedio del dataset

### 4. Score Híbrido Final

```
Hybrid Score = (Similitud * 0.5) + (Rating Normalizado * 0.3) + (Interacciones Normalizadas * 0.2)
```

## Estructura de Datos

### Colección Movies (MongoDB)
```json
{
  "_id": "...",
  "title": "The Godfather",
  "year": 1972,
  "genres": ["Crime", "Drama"],
  "directors": ["Francis Ford Coppola"],
  "cast": ["Marlon Brando", "Al Pacino", ...],
  "imdb": {
    "rating": 9.2,
    "votes": 1234567
  }
}
```

### Colección Interactions (MongoDB)
```json
{
  "userId": "user_abc123",
  "movieId": "...",
  "type": "rating",  // o "click"
  "rating": 4.5,     // solo para type="rating"
  "timestamp": "..."
}
```

## Ejemplos de Salida

```
                               title  year              genres  cosine_sim  click_count  rating_count  avg_user_rating  interaction_score  hybrid_score
The Godfather: Part II              1974      [Crime, Drama]        0.85           45            12              4.2               21.4          0.78
Goodfellas                          1990      [Crime, Drama]        0.72           32             8              4.5               19.2          0.65
The Departed                        2006      [Crime, Drama]        0.68           28             6              4.0               16.8          0.61
```
