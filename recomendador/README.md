# Sistema de Recomendación Híbrido Inteligente para DCICFLIX

Sistema de recomendación de películas que combina **similitud de contenido** con **interacciones de usuario** (clicks y ratings), con **ponderación temporal** y **penalización de contenido no deseado**.

## Características

- **Recomendación por similitud**: Basada en géneros, directores, actores y argumento
- **Ponderación temporal**: Prioriza las últimas 10-15 interacciones del usuario
- **Aprendizaje de gustos Y disgustos**: Penaliza películas similares a las mal calificadas (< 3.5 estrellas)
- **Métricas de interacción**: Considera clicks (5%) y ratings (95%) de usuarios
- **Dataset dinámico**: Carga 5000+ películas de alta calidad + todas las películas con interacciones
- **Score híbrido personalizado**: Prioriza interacciones de usuario (85%) sobre calidad general (15%)

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

## Algoritmo y Funcionamiento

### 1. Similitud de Contenido (Content-Based Filtering)
Se crea una "sopa" de características combinando:
- Título de la película
- Géneros
- Directores (normalizados)
- Top 5 actores (normalizados)
- Argumento completo (fullplot)

Se usa **CountVectorizer** con:
- n-gramas (1,2) para capturar frases
- max_features=5000 para optimizar memoria
- stop_words='english' para filtrar palabras comunes

Se calcula la **similitud por coseno** entre todas las películas (matriz 5027x5027).

### 2. Métricas de Interacción de Usuario
- **Clicks**: Cada vez que un usuario hace click en una película
- **Ratings**: Calificaciones de 0.5 a 5 estrellas
- **Interaction Score**: `(clicks * 0.05) + (rating_sum * 0.95)`
  - Los ratings tienen 95% de peso (muy superior a clicks)

### 3. Rating Ponderado (Weighted Rating)
Combina ratings de IMDb con ratings de usuarios usando la fórmula de IMDb:

```
WR = (v/(v+m) * R) + (m/(v+m) * C)
```

Donde:
- `v` = votos totales (IMDb votes + user ratings + clicks)
- `m` = percentil 85 de votos (umbral de confianza)
- `R` = rating combinado: **IMDb (5%) + Usuarios (95%)**
- `C` = rating promedio del dataset

**Prioridad total a ratings de usuarios sobre IMDb.**

### 4. Funciones de Recomendación

#### `get_personalized_recommendations(user_id, n=10)`
**Recomendaciones personalizadas** basadas en gustos y disgustos del usuario.

**Proceso:**
1. Obtiene las últimas **15 calificaciones** del usuario (ordenadas por timestamp)
2. Separa en:
   - **Películas que le gustaron** (rating >= 3.5): busca similares
   - **Películas que NO le gustaron** (rating < 3.5): penaliza similares
3. **Ponderación temporal**: Las más recientes tienen más peso
   - Película más reciente: 100% peso
   - Cada posición reduce 5% el peso
   - Mínimo: 50% de peso
4. Calcula similitud con películas que le gustaron
5. Calcula **penalización** por similitud con películas que NO le gustaron
6. **Score final:**
   ```
   Score = (Similitud a lo que le gustó * 0.7) + 
           (Calidad general * 0.1) + 
           (Interacciones globales * 0.2) - 
           (Similitud a lo que NO le gustó * 0.3)
   ```

**Ejemplo:**
- Usuario califica "The Godfather" con ⭐⭐⭐⭐⭐ → recomienda más dramas mafiosos
- Usuario califica "Transformers" con ⭐ → evita películas de acción explosiva similares

#### `get_recommendations_by_favorite_genre(user_id, n=10)`
**Recomendaciones del género favorito** con penalización de géneros mal calificados.

**Proceso:**
1. Analiza las últimas **15 interacciones** del usuario
2. **Calcula score por género:**
   - Rating >= 3.5: suma puntos al género (+rating/5.0)
   - Rating < 3.5: **resta puntos** al género (penalización)
     - 1 estrella: -0.5 puntos
     - 2 estrellas: -0.3 puntos
     - 3 estrellas: -0.1 puntos
3. **Ponderación temporal**: Las interacciones más recientes tienen 100% peso, decrece 4% por posición
4. Género con **score más alto** es el favorito
5. Si todos los géneros tienen score negativo/cero → no hay favorito

**Filtrado de recomendaciones:**
```
Score = (Calidad * 0.65) + (Interacciones * 0.35)
```

**Ejemplo:**
- 5 películas Action con ⭐⭐⭐⭐⭐ → Action +4.0
- 3 películas Horror con ⭐ → Horror -1.5
- Resultado: "Porque te gusta Action"

#### `get_unfinished_movies(user_id, n=10)`
**Películas sin terminar de ver** (clickeadas pero no calificadas).

**Proceso:**
1. Obtiene todas las películas con **clicks** del usuario
2. Excluye las que ya tienen **rating**
3. Ordena por **timestamp del último click** (más recientes primero)
4. Permite al usuario retomar donde quedó

#### `get_top_movies(genre=None, n=10, exclude_user_rated=None)`
**Top películas generales** o filtradas por género.

**Score:**
```
Final Score = (Weighted Rating * 0.15) + (Interaction Score * 0.85)
```

**Prioriza masivamente las interacciones de usuarios (85%) sobre la calidad objetiva (15%).**

### 5. Carga Dinámica de Dataset

El sistema carga:
1. **5000 películas de alta calidad** (IMDb rating >= 6.0)
2. **+ Todas las películas con interacciones de usuarios**
   - Películas de TMDB (formato `tmdb_XXXXX`)
   - Películas de MongoDB (ObjectId)

Total: ~5027 películas en memoria, garantizando que películas nuevas/clickeadas estén disponibles.

## Endpoints API (Flask)

El servicio Flask expone los siguientes endpoints:

- `GET /health` - Health check del servicio
- `GET /recommendations?userId={userId}&n={n}` - Recomendaciones personalizadas
- `GET /recommendations/favorite-genre?userId={userId}&n={n}` - Recomendaciones del género favorito
- `GET /recommendations/unfinished?userId={userId}&n={n}` - Películas sin terminar

## Resumen de Ponderaciones

| Componente | Peso | Descripción |
|------------|------|-------------|
| **Recomendaciones Personalizadas** | | |
| Similitud con gustos | 70% | Películas similares a las que calificó bien |
| Interacciones globales | 20% | Popularidad entre usuarios |
| Calidad general | 10% | Weighted rating |
| Penalización disgustos | -30% | Evita similares a mal calificadas |
| **Género Favorito** | | |
| Rating >= 3.5 | +rating/5.0 | Suma puntos al género |
| Rating < 3.5 | -0.1 a -0.5 | Resta puntos al género |
| Peso temporal | 100% → 40% | Decremento 4% por posición |
| **Top Películas** | | |
| Interacciones usuarios | 85% | Clicks + ratings |
| Calidad (weighted) | 15% | Rating ponderado |
| **Interaction Score** | | |
| Ratings | 95% | Calificaciones de usuarios |
| Clicks | 5% | Interés sin calificación |
| **Combined Rating** | | |
| Ratings usuarios | 95% | Opiniones de usuarios |
| IMDb rating | 5% | Rating objetivo |

## Ventajas del Sistema

1. **Adaptación continua**: Se actualiza con cada nueva calificación
2. **Ponderación temporal**: Las preferencias recientes tienen más peso
3. **Aprendizaje bidireccional**: Aprende de gustos Y disgustos
4. **Evita repetición**: Excluye películas ya calificadas
5. **Dataset optimizado**: Carga solo lo necesario (5000+) para rendimiento
6. **Filtrado inteligente**: Penaliza contenido no deseado en lugar de solo ignorarlo
7. **Personalización total**: 85-95% de peso en preferencias del usuario vs calidad objetiva

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
