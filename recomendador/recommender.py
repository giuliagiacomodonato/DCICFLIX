"""
Sistema de Recomendación Híbrido para DCICFLIX
Combina similitud de contenido con interacciones de usuario (clicks y ratings)
"""

import pandas as pd
import numpy as np
from pymongo import MongoClient
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import os

# Configuración de MongoDB
MONGODB_URL = os.getenv('MONGODB_URL', 'mongodb+srv://giuliagiacomodonato1_db_user:c8Xn0eSPeCydGJGN@cluster0.9cf6z0w.mongodb.net/?appName=Cluster0')
DB_NAME = os.getenv('DB_NAME', 'peliculas')
OPINIONES_DB = os.getenv('OPINIONES_DB', 'opiniones')


class MovieRecommender:
    def __init__(self):
        """Inicializa el recomendador conectándose a MongoDB"""
        self.client = MongoClient(MONGODB_URL)
        self.movies_db = self.client[DB_NAME]
        self.movies_collection = self.movies_db['movies']
        self.opiniones_db = self.client[OPINIONES_DB]
        self.opinions_collection = self.opiniones_db['opinions']
        
        self.movies_df = None
        self.cosine_sim = None
        self.indices = None
        self.titles = None
        
    def load_movies(self, limit=None):
        """Carga las películas desde MongoDB y prepara el DataFrame"""
        print("Cargando películas desde MongoDB...", flush=True)
        
        # Aplicar límite si se especifica (útil para datasets grandes)
        if limit:
            # Cargar TODAS las películas, no solo las de alta calidad
            # Esto es importante para incluir películas nuevas de TMDB
            movies = list(self.movies_collection.find().limit(limit))
        else:
            movies = list(self.movies_collection.find())
        
        if not movies:
            raise ValueError("No se encontraron películas en la base de datos")
        
        print(f"Descargadas {len(movies)} películas de MongoDB", flush=True)
        
        # Convertir a DataFrame
        self.movies_df = pd.DataFrame(movies)
        print("DataFrame creado", flush=True)
        
        # Limpiar y preparar datos
        print("Preparando datos...", flush=True)
        self._prepare_data()
        print("Datos preparados", flush=True)
        
        # Calcular similitud de contenido
        print("Calculando similitud de contenido...", flush=True)
        self._calculate_content_similarity()
        print("Similitud calculada", flush=True)
        
        # Calcular métricas de interacción
        print("Calculando métricas de interacción...", flush=True)
        self._calculate_interaction_metrics()
        print("Métricas calculadas", flush=True)
        
        print(f"✓ Películas cargadas: {len(self.movies_df)}", flush=True)
        
    def _prepare_data(self):
        """Prepara los datos para el análisis"""
        # Convertir _id a string - manejar tanto ObjectId como strings
        self.movies_df['movie_id'] = self.movies_df['_id'].apply(
            lambda x: str(x) if hasattr(x, '__str__') else x
        )
        
        # Preparar géneros (convertir lista a string)
        self.movies_df['genres_str'] = self.movies_df['genres'].apply(
            lambda x: ' '.join(x) if isinstance(x, list) else ''
        )
        
        # Preparar directores
        self.movies_df['directors_str'] = self.movies_df['directors'].apply(
            lambda x: ' '.join([d.lower().replace(' ', '') for d in x]) if isinstance(x, list) else ''
        )
        
        # Preparar actores (top 5)
        self.movies_df['cast_str'] = self.movies_df['cast'].apply(
            lambda x: ' '.join([c.lower().replace(' ', '') for c in x[:5]]) if isinstance(x, list) else ''
        )
        
        # Crear "sopa" de características
        self.movies_df['soup'] = (
            self.movies_df['title'].fillna('') + ' ' +
            self.movies_df['genres_str'].fillna('') + ' ' +
            self.movies_df['directors_str'].fillna('') + ' ' +
            self.movies_df['cast_str'].fillna('') + ' ' +
            self.movies_df['fullplot'].fillna('')
        )
        
        # Crear índice de títulos
        self.indices = pd.Series(self.movies_df.index, index=self.movies_df['title'])
        self.titles = self.movies_df['title']
        
    def _calculate_content_similarity(self):
        """Calcula la matriz de similitud por coseno basada en contenido"""
        print("Creando vectorizador...", flush=True)
        
        count = CountVectorizer(
            analyzer='word',
            ngram_range=(1, 2),
            min_df=0.0,
            stop_words='english',
            max_features=5000  # Limitar features para reducir memoria
        )
        
        print("Vectorizando contenido...", flush=True)
        count_matrix = count.fit_transform(self.movies_df['soup'])
        print(f"Matriz de características: {count_matrix.shape}", flush=True)
        
        print("Calculando similitud coseno...", flush=True)
        self.cosine_sim = cosine_similarity(count_matrix, count_matrix)
        print(f"Matriz de similitud: {self.cosine_sim.shape}", flush=True)
        
    def _calculate_interaction_metrics(self):
        """Calcula métricas basadas en interacciones de usuarios (clicks y ratings)"""
        print("Calculando métricas de interacción...")
        
        # Obtener todas las opiniones
        opinions = list(self.opinions_collection.find())
        
        if not opinions:
            print("No hay opiniones registradas. Usando solo ratings de IMDb.")
            self.movies_df['click_count'] = 0
            self.movies_df['rating_sum'] = 0
            self.movies_df['rating_count'] = 0
            self.movies_df['avg_user_rating'] = 0
            self.movies_df['interaction_score'] = 0
            return
        
        opinions_df = pd.DataFrame(opinions)
        
        # Contar clicks por película (type == 'click')
        clicks = opinions_df[opinions_df['type'] == 'click'].groupby('movieId').size()
        
        # Calcular ratings por película (type == 'rating' y rating != null)
        ratings = opinions_df[(opinions_df['type'] == 'rating') & (opinions_df['rating'].notna())]
        
        if not ratings.empty:
            rating_stats = ratings.groupby('movieId').agg({
                'rating': ['sum', 'count', 'mean']
            })
            rating_stats.columns = ['rating_sum', 'rating_count', 'avg_user_rating']
        else:
            # Si no hay ratings, crear DataFrame vacío con las columnas necesarias
            rating_stats = pd.DataFrame(columns=['rating_sum', 'rating_count', 'avg_user_rating'])
        
        # Agregar al DataFrame de películas
        self.movies_df['click_count'] = self.movies_df['movie_id'].map(clicks).fillna(0).astype(float)
        self.movies_df['rating_sum'] = self.movies_df['movie_id'].map(
            rating_stats['rating_sum'] if not rating_stats.empty else {}
        ).fillna(0).astype(float)
        self.movies_df['rating_count'] = self.movies_df['movie_id'].map(
            rating_stats['rating_count'] if not rating_stats.empty else {}
        ).fillna(0).astype(float)
        self.movies_df['avg_user_rating'] = self.movies_df['movie_id'].map(
            rating_stats['avg_user_rating'] if not rating_stats.empty else {}
        ).fillna(0).astype(float)
        
        # Calcular score de interacción combinado
        # Fórmula: (clicks * 0.1) + (rating_sum * 0.9)
        # Los ratings tienen mucho más peso que los clicks
        self.movies_df['interaction_score'] = (
            self.movies_df['click_count'] * 0.1 + 
            self.movies_df['rating_sum'] * 0.9
        )
        
        print(f"Opiniones procesadas: {len(opinions_df)}")
        
    def _calculate_weighted_rating(self, percentile=0.85):
        """Calcula el rating ponderado usando la fórmula de IMDb"""
        # Rating ponderado que combina IMDb rating con user ratings
        
        # Extraer rating de IMDb
        self.movies_df['imdb_rating'] = self.movies_df['imdb'].apply(
            lambda x: x.get('rating', 0) if isinstance(x, dict) else 0
        )
        
        # Si hay ratings de usuarios, combinarlos con IMDb
        if 'rating_count' in self.movies_df.columns and self.movies_df['rating_count'].sum() > 0:
            # Combinar IMDb rating con user ratings (10% IMDb, 90% usuarios)
            self.movies_df['combined_rating'] = (
                self.movies_df['imdb_rating'] * 0.1 + 
                self.movies_df['avg_user_rating'] * 0.9
            )
        else:
            self.movies_df['combined_rating'] = self.movies_df['imdb_rating']
        
        # Calcular votos totales (IMDb votes + user ratings)
        self.movies_df['imdb_votes'] = self.movies_df['imdb'].apply(
            lambda x: x.get('votes', 0) if isinstance(x, dict) else 0
        )
        
        # Convertir a numérico (puede venir como string)
        self.movies_df['imdb_votes'] = pd.to_numeric(self.movies_df['imdb_votes'], errors='coerce').fillna(0)
        
        # Agregar user ratings y clicks si existen (ya deberían estar creados por _calculate_interaction_metrics)
        user_ratings = self.movies_df['rating_count'] if 'rating_count' in self.movies_df.columns else pd.Series(0, index=self.movies_df.index)
        user_clicks = self.movies_df['click_count'] if 'click_count' in self.movies_df.columns else pd.Series(0, index=self.movies_df.index)
        
        # Asegurar que todo sea numérico
        if isinstance(user_ratings, pd.Series):
            user_ratings = pd.to_numeric(user_ratings, errors='coerce').fillna(0)
        if isinstance(user_clicks, pd.Series):
            user_clicks = pd.to_numeric(user_clicks, errors='coerce').fillna(0)
        
        self.movies_df['total_votes'] = (
            self.movies_df['imdb_votes'] + 
            user_ratings + 
            user_clicks
        )
        
        # Fórmula de rating ponderado (IMDb)
        v = self.movies_df['total_votes']
        m = self.movies_df['total_votes'].quantile(percentile)
        R = self.movies_df['combined_rating']
        C = self.movies_df['combined_rating'].mean()
        
        self.movies_df['weighted_rating'] = (R * v + C * m) / (v + m)
        
    def get_recommendations(self, title, n=10, self_exclude=True, use_interactions=True):
        """
        Obtiene recomendaciones para una película dada
        
        Args:
            title: Título de la película
            n: Número de recomendaciones
            self_exclude: Excluir la película consultada
            use_interactions: Usar métricas de interacción en el scoring
        
        Returns:
            DataFrame con las películas recomendadas
        """
        try:
            idx = self.indices[title]
        except KeyError:
            return f"Película '{title}' no encontrada en la base de datos."
        
        # Obtener scores de similitud
        sim_scores = list(enumerate(self.cosine_sim[idx]))
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
        
        if self_exclude:
            sim_scores = sim_scores[1:n*3]  # Obtener más candidatos para filtrar
        else:
            sim_scores = sim_scores[0:n*3]
        
        book_indices = [i[0] for i in sim_scores]
        cosine_similarities = [i[1] for i in sim_scores]
        
        # Crear DataFrame de recomendaciones
        recommended = self.movies_df.iloc[book_indices].copy()
        recommended['cosine_sim'] = cosine_similarities
        
        # Calcular score híbrido
        if use_interactions:
            # Normalizar interaction_score (0-1)
            max_interaction = self.movies_df['interaction_score'].max()
            if max_interaction > 0:
                recommended['interaction_norm'] = recommended['interaction_score'] / max_interaction
            else:
                recommended['interaction_norm'] = 0
            
            # Calcular weighted rating
            self._calculate_weighted_rating()
            recommended['weighted_rating'] = self.movies_df.iloc[book_indices]['weighted_rating'].values
            
            # Score híbrido: 50% similitud + 30% weighted_rating + 20% interacciones
            max_rating = self.movies_df['weighted_rating'].max()
            if max_rating > 0:
                recommended['rating_norm'] = recommended['weighted_rating'] / max_rating
            else:
                recommended['rating_norm'] = 0
                
            recommended['hybrid_score'] = (
                recommended['cosine_sim'] * 0.5 +
                recommended['rating_norm'] * 0.3 +
                recommended['interaction_norm'] * 0.2
            )
        else:
            # Solo usar similitud de contenido
            recommended['hybrid_score'] = recommended['cosine_sim']
        
        # Ordenar por score híbrido
        recommended = recommended.sort_values('hybrid_score', ascending=False)
        
        # Seleccionar columnas relevantes
        columns = [
            'title', 'year', 'genres', 'directors', 'cosine_sim',
            'click_count', 'rating_count', 'avg_user_rating',
            'interaction_score', 'hybrid_score'
        ]
        
        # Filtrar columnas que existan
        available_columns = [col for col in columns if col in recommended.columns]
        
        return recommended[available_columns].head(n)
    
    def get_top_movies(self, genre=None, n=10, exclude_user_rated=None):
        """
        Obtiene las películas mejor puntuadas (rating ponderado + interacciones)
        
        Args:
            genre: Filtrar por género (opcional)
            n: Número de películas
            exclude_user_rated: ID de usuario para excluir películas ya calificadas
            
        Returns:
            DataFrame con las mejores películas
        """
        self._calculate_weighted_rating()
        
        df = self.movies_df.copy()
        
        # Excluir películas ya calificadas por el usuario
        if exclude_user_rated:
            user_rated_movies = list(self.opinions_collection.find(
                {'userId': exclude_user_rated, 'type': 'rating'}
            ))
            if user_rated_movies:
                rated_movie_ids = [movie['movieId'] for movie in user_rated_movies]
                print(f"Excluyendo {len(rated_movie_ids)} películas ya calificadas por el usuario", flush=True)
                df = df[~df['movie_id'].isin(rated_movie_ids)]
        
        # Filtrar por género si se especifica
        if genre:
            df = df[df['genres_str'].str.contains(genre, case=False, na=False)]
        
        if df.empty:
            return f"No se encontraron películas del género '{genre}'"
        
        # Ordenar por weighted_rating e interaction_score
        # Dar más peso a las interacciones de usuario (60%) que al weighted_rating (40%)
        df['final_score'] = df['weighted_rating'] * 0.3 + df['interaction_score'] * 0.7
        df = df.sort_values('final_score', ascending=False)
        
        columns = [
            'title', 'year', 'genres', 'combined_rating', 'weighted_rating',
            'click_count', 'rating_count', 'interaction_score', 'final_score'
        ]
        
        available_columns = [col for col in columns if col in df.columns]
        
        return df[available_columns].head(n)
    
    def get_personalized_recommendations(self, user_id, n=10):
        """
        Obtiene recomendaciones personalizadas basadas en las películas que el usuario ha calificado
        
        Args:
            user_id: ID del usuario
            n: Número de recomendaciones
            
        Returns:
            DataFrame con las películas recomendadas personalizadas
        """
        # Obtener películas que el usuario ha calificado positivamente (>= 3.5 estrellas)
        user_ratings = list(self.opinions_collection.find({
            'userId': user_id,
            'type': 'rating',
            'rating': {'$gte': 3.5}
        }).sort('rating', -1).limit(5))  # Top 5 mejores calificadas
        
        if not user_ratings:
            print(f"Usuario {user_id} no tiene calificaciones positivas. Usando top general.", flush=True)
            return self.get_top_movies(n=n, exclude_user_rated=user_id)
        
        print(f"Generando recomendaciones basadas en {len(user_ratings)} películas del usuario", flush=True)
        
        # Obtener títulos de las películas calificadas
        rated_movie_ids = [rating['movieId'] for rating in user_ratings]
        rated_movies = self.movies_df[self.movies_df['movie_id'].isin(rated_movie_ids)]
        
        if rated_movies.empty:
            print("No se encontraron películas calificadas en el dataset. Usando top general.", flush=True)
            return self.get_top_movies(n=n, exclude_user_rated=user_id)
        
        # Obtener recomendaciones basadas en similitud con cada película calificada
        all_recommendations = []
        
        for _, movie in rated_movies.iterrows():
            try:
                # Obtener índice de la película
                idx = self.indices[movie['title']]
                
                # Obtener scores de similitud
                sim_scores = list(enumerate(self.cosine_sim[idx]))
                sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
                
                # Excluir la película misma y obtener las más similares
                sim_scores = sim_scores[1:n*2]
                
                for i, score in sim_scores:
                    movie_id = self.movies_df.iloc[i]['movie_id']
                    
                    # No recomendar películas ya calificadas
                    if movie_id in rated_movie_ids:
                        continue
                    
                    all_recommendations.append({
                        'index': i,
                        'movie_id': movie_id,
                        'similarity_score': score,
                        'source_rating': user_ratings[[r['movieId'] for r in user_ratings].index(movie['movie_id'])]['rating']
                    })
            except (KeyError, ValueError) as e:
                continue
        
        if not all_recommendations:
            print("No se encontraron recomendaciones similares. Usando top general.", flush=True)
            return self.get_top_movies(n=n, exclude_user_rated=user_id)
        
        # Convertir a DataFrame
        recs_df = pd.DataFrame(all_recommendations)
        
        # Agrupar por película y promediar scores (si una película fue recomendada por varias)
        recs_df = recs_df.groupby('index').agg({
            'movie_id': 'first',
            'similarity_score': 'mean',
            'source_rating': 'mean'
        }).reset_index()
        
        # Obtener datos completos de las películas
        recommended_movies = self.movies_df.iloc[recs_df['index'].values].copy()
        recommended_movies['similarity_score'] = recs_df['similarity_score'].values
        recommended_movies['source_rating'] = recs_df['source_rating'].values
        
        # Calcular weighted rating
        self._calculate_weighted_rating()
        recommended_movies['weighted_rating'] = self.movies_df.iloc[recs_df['index'].values]['weighted_rating'].values
        
        # Normalizar métricas
        max_sim = recommended_movies['similarity_score'].max()
        max_rating = self.movies_df['weighted_rating'].max()
        max_interaction = self.movies_df['interaction_score'].max()
        
        recommended_movies['sim_norm'] = recommended_movies['similarity_score'] / max_sim if max_sim > 0 else 0
        recommended_movies['rating_norm'] = recommended_movies['weighted_rating'] / max_rating if max_rating > 0 else 0
        recommended_movies['interaction_norm'] = recommended_movies['interaction_score'] / max_interaction if max_interaction > 0 else 0
        
        # Score personalizado: 60% similitud con películas que le gustaron + 25% weighted rating + 15% interacciones globales
        recommended_movies['personalized_score'] = (
            recommended_movies['sim_norm'] * 0.6 +
            recommended_movies['rating_norm'] * 0.25 +
            recommended_movies['interaction_norm'] * 0.15
        )
        
        # Ordenar por score personalizado
        recommended_movies = recommended_movies.sort_values('personalized_score', ascending=False)
        
        # Seleccionar columnas relevantes
        columns = [
            'title', 'year', 'genres', 'directors', 'poster',
            'similarity_score', 'weighted_rating', 'interaction_score',
            'personalized_score', 'imdb', 'plot'
        ]
        
        available_columns = [col for col in columns if col in recommended_movies.columns]
        
        return recommended_movies[available_columns].head(n)
    
    def get_user_favorite_genre(self, user_id):
        """
        Identifica el género favorito del usuario basado en sus calificaciones e interacciones
        
        Args:
            user_id: ID del usuario
            
        Returns:
            String con el género favorito o None
        """
        # Obtener todas las interacciones del usuario (clicks y ratings)
        user_interactions = list(self.opinions_collection.find({
            'userId': user_id
        }))
        
        if not user_interactions:
            return None
        
        # Obtener los IDs de las películas con las que interactuó
        movie_ids = [interaction['movieId'] for interaction in user_interactions]
        interacted_movies = self.movies_df[self.movies_df['movie_id'].isin(movie_ids)]
        
        if interacted_movies.empty:
            return None
        
        # Contar géneros, dando más peso a las calificaciones altas
        genre_scores = {}
        
        for interaction in user_interactions:
            movie = self.movies_df[self.movies_df['movie_id'] == interaction['movieId']]
            
            if movie.empty:
                continue
            
            movie = movie.iloc[0]
            genres = movie['genres'] if isinstance(movie['genres'], list) else []
            
            # Calcular peso: ratings valen más que clicks
            if interaction['type'] == 'rating':
                weight = interaction.get('rating', 3) / 5.0  # Normalizar a 0-1
            else:  # click
                weight = 0.2
            
            # Distribuir el peso entre todos los géneros de la película
            for genre in genres:
                if genre not in genre_scores:
                    genre_scores[genre] = 0
                genre_scores[genre] += weight
        
        if not genre_scores:
            return None
        
        # Obtener el género con mayor score
        favorite_genre = max(genre_scores, key=genre_scores.get)
        print(f"Género favorito de {user_id}: {favorite_genre} (score: {genre_scores[favorite_genre]:.2f})", flush=True)
        
        return favorite_genre
    
    def get_recommendations_by_favorite_genre(self, user_id, n=10):
        """
        Obtiene recomendaciones del género favorito del usuario
        
        Args:
            user_id: ID del usuario
            n: Número de recomendaciones
            
        Returns:
            Tuple (genre, DataFrame) con el género favorito y las recomendaciones
        """
        favorite_genre = self.get_user_favorite_genre(user_id)
        
        if not favorite_genre:
            print(f"Usuario {user_id} no tiene género favorito identificado", flush=True)
            return None, None
        
        # Obtener películas ya calificadas para excluirlas
        user_rated_movies = list(self.opinions_collection.find(
            {'userId': user_id, 'type': 'rating'}
        ))
        rated_movie_ids = [movie['movieId'] for movie in user_rated_movies]
        
        # Filtrar por género favorito y excluir ya calificadas
        df = self.movies_df.copy()
        df = df[df['genres_str'].str.contains(favorite_genre, case=False, na=False)]
        df = df[~df['movie_id'].isin(rated_movie_ids)]
        
        if df.empty:
            print(f"No hay películas de {favorite_genre} sin calificar", flush=True)
            return favorite_genre, None
        
        # Calcular weighted rating
        self._calculate_weighted_rating()
        df['weighted_rating'] = self.movies_df.loc[df.index, 'weighted_rating']
        df['interaction_score'] = self.movies_df.loc[df.index, 'interaction_score']
        
        # Score combinado: priorizar calidad + interacciones
        df['genre_score'] = df['weighted_rating'] * 0.8 + df['interaction_score'] * 0.2
        df = df.sort_values('genre_score', ascending=False)
        
        columns = [
            'title', 'year', 'genres', 'directors', 'poster',
            'weighted_rating', 'interaction_score', 'genre_score',
            'imdb', 'plot'
        ]
        
        available_columns = [col for col in columns if col in df.columns]
        
        return favorite_genre, df[available_columns].head(n)
    
    def get_unfinished_movies(self, user_id, n=10):
        """
        Obtiene películas que el usuario clickeó pero no calificó (sin terminar de ver)
        
        Args:
            user_id: ID del usuario
            n: Número de películas
            
        Returns:
            DataFrame con las películas sin terminar de ver
        """
        # Verificar que el DataFrame esté cargado
        if self.movies_df is None:
            print("ERROR: movies_df is None. El recomendador no está inicializado.", flush=True)
            return None
        
        print(f"DEBUG: movies_df cargado con {len(self.movies_df)} películas", flush=True)
        
        # Obtener películas con clicks del usuario
        clicked_movies = list(self.opinions_collection.find({
            'userId': user_id,
            'type': 'click'
        }))
        
        if not clicked_movies:
            print(f"Usuario {user_id} no tiene clicks registrados", flush=True)
            return None
        
        print(f"DEBUG: Clicks encontrados: {len(clicked_movies)}", flush=True)
        print(f"DEBUG: Ejemplo de click: {clicked_movies[0] if clicked_movies else 'N/A'}", flush=True)
        
        # Obtener películas calificadas para excluirlas
        rated_movies = list(self.opinions_collection.find({
            'userId': user_id,
            'type': 'rating'
        }))
        
        rated_movie_ids = [movie['movieId'] for movie in rated_movies]
        print(f"DEBUG: Ratings encontrados: {len(rated_movies)}, IDs: {rated_movie_ids[:5] if rated_movie_ids else 'N/A'}", flush=True)
        
        # Filtrar solo las películas clickeadas pero NO calificadas
        unfinished_movie_ids = [
            movie['movieId'] for movie in clicked_movies 
            if movie['movieId'] not in rated_movie_ids
        ]
        
        print(f"DEBUG: Películas sin terminar: {len(unfinished_movie_ids)}, Ejemplos: {unfinished_movie_ids[:3] if unfinished_movie_ids else 'N/A'}", flush=True)
        
        if not unfinished_movie_ids:
            print(f"Usuario {user_id} no tiene películas sin terminar", flush=True)
            return None
        
        # DEBUG: Ver formato de IDs en el DataFrame
        print(f"DEBUG: Ejemplo movie_id en DataFrame: {self.movies_df['movie_id'].iloc[:5].tolist()}", flush=True)
        print(f"DEBUG: Total películas en DataFrame: {len(self.movies_df)}", flush=True)
        
        # Contar clicks por película para ordenar por las más clickeadas
        click_counts = {}
        for movie in clicked_movies:
            if movie['movieId'] in unfinished_movie_ids:
                click_counts[movie['movieId']] = click_counts.get(movie['movieId'], 0) + 1
        
        # Obtener datos completos de las películas
        unfinished_movies = self.movies_df[self.movies_df['movie_id'].isin(unfinished_movie_ids)].copy()
        
        print(f"DEBUG: Películas encontradas en DataFrame: {len(unfinished_movies)}", flush=True)
        
        if unfinished_movies.empty:
            print(f"No se encontraron películas sin terminar en el dataset", flush=True)
            return None
        
        # Añadir conteo de clicks
        unfinished_movies['user_clicks'] = unfinished_movies['movie_id'].map(click_counts)
        
        # Ordenar por número de clicks (las más clickeadas primero)
        unfinished_movies = unfinished_movies.sort_values('user_clicks', ascending=False)
        
        columns = [
            'title', 'year', 'genres', 'directors', 'poster',
            'user_clicks', 'imdb', 'plot'
        ]
        
        available_columns = [col for col in columns if col in unfinished_movies.columns]
        
        return unfinished_movies[available_columns].head(n)
    
    def close(self):
        """Cierra la conexión a MongoDB"""
        self.client.close()


# Función auxiliar para uso directo
def get_movie_recommendations(title, n=10):
    """
    Función helper para obtener recomendaciones rápidamente
    
    Args:
        title: Título de la película
        n: Número de recomendaciones
        
    Returns:
        DataFrame con recomendaciones
    """
    recommender = MovieRecommender()
    recommender.load_movies()
    recommendations = recommender.get_recommendations(title, n=n)
    recommender.close()
    return recommendations


if __name__ == "__main__":
    # Ejemplo de uso
    print("="*60)
    print("SISTEMA DE RECOMENDACIÓN HÍBRIDO PARA DCICFLIX")
    print("="*60)
    
    recommender = MovieRecommender()
    recommender.load_movies()
    
    # Ejemplo 1: Recomendaciones basadas en una película
    print("\n--- Recomendaciones basadas en 'The Godfather' ---")
    recs = recommender.get_recommendations("The Godfather", n=5)
    print(recs)
    
    # Ejemplo 2: Top películas
    print("\n--- Top 10 Películas Generales ---")
    top = recommender.get_top_movies(n=10)
    print(top)
    
    # Ejemplo 3: Top películas de un género
    print("\n--- Top 10 Películas de Drama ---")
    top_drama = recommender.get_top_movies(genre='Drama', n=10)
    print(top_drama)
    
    recommender.close()
