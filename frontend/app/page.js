'use client';

import { useState, useEffect } from 'react';
import MovieRow from '../components/MovieRow';
import Modal from '../components/Modal';

export default function Home() {
  const [randomMovies, setRandomMovies] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [newMovies, setNewMovies] = useState([]);
  const [actionMovies, setActionMovies] = useState([]);
  const [comedyMovies, setComedyMovies] = useState([]);
  const [recommendedMovies, setRecommendedMovies] = useState([]);
  const [favoriteGenreMovies, setFavoriteGenreMovies] = useState([]);
  const [favoriteGenre, setFavoriteGenre] = useState('');
  
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllMovies = async () => {
      try {
        // 1. Trending Movies (TMDB via Movies Service)
        fetch('http://localhost:3001/movies/trending')
          .then(res => res.json())
          .then(data => setTrendingMovies(data))
          .catch(err => console.error('Error trending:', err));

        // 2. Random Movies (Servicio Random)
        fetch('http://localhost:3002/random/10')
          .then(res => res.json())
          .then(data => setRandomMovies(data))
          .catch(err => console.error('Error random:', err));

        // 3. Popular Movies (Rating > 8.5)
        fetch('http://localhost:3001/movies/search?minRating=8.5&sort=imdb.rating&desc=true&limit=10')
          .then(res => res.json())
          .then(data => setPopularMovies(data))
          .catch(err => console.error('Error popular:', err));

        // 4. New Movies (Year >= 2015)
        fetch('http://localhost:3001/movies/search?minYear=2015&sort=year&desc=true&limit=10')
          .then(res => res.json())
          .then(data => setNewMovies(data))
          .catch(err => console.error('Error new:', err));

        // 5. Action Movies (Random desde 2000)
        fetch('http://localhost:3001/movies/search?genre=Action&minYear=2000&random=true&limit=10')
          .then(res => res.json())
          .then(data => setActionMovies(data))
          .catch(err => console.error('Error action:', err));

        // 6. Comedy Movies (Random desde 2000)
        fetch('http://localhost:3001/movies/search?genre=Comedy&minYear=2000&random=true&limit=10')
          .then(res => res.json())
          .then(data => setComedyMovies(data))
          .catch(err => console.error('Error comedy:', err));

        // 7. Recommended Movies (Sistema de Recomendación)
        const userId = 'user_cl954t3ef'; // Usuario único del sistema
        fetch(`http://localhost:3005/recommendations?userId=${userId}&n=10`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            console.log('Recommendations data:', data);
            // Convertir las recomendaciones al formato esperado
            if (data.recommendations && Array.isArray(data.recommendations)) {
              const formattedRecs = data.recommendations.map(rec => ({
                _id: rec._id?.$oid || rec._id || rec.movie_id,
                title: rec.title,
                poster: rec.poster,
                year: rec.year,
                genres: rec.genres,
                plot: rec.plot,
                imdb: rec.imdb,
                final_score: rec.final_score
              }));
              setRecommendedMovies(formattedRecs);
            }
          })
          .catch(err => {
            console.error('Error recommendations:', err);
            // Si falla el recomendador, usar películas populares como fallback
            setRecommendedMovies([]);
          });

        // 8. Favorite Genre Recommendations
        fetch(`http://localhost:3005/recommendations/favorite-genre?userId=${userId}&n=10`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            console.log('Favorite genre data:', data);
            if (data.genre) {
              setFavoriteGenre(data.genre);
            }
            if (data.recommendations && Array.isArray(data.recommendations)) {
              const formattedRecs = data.recommendations.map(rec => ({
                _id: rec._id?.$oid || rec._id || rec.movie_id,
                title: rec.title,
                poster: rec.poster,
                year: rec.year,
                genres: rec.genres,
                plot: rec.plot,
                imdb: rec.imdb
              }));
              setFavoriteGenreMovies(formattedRecs);
            }
          })
          .catch(err => {
            console.error('Error favorite genre:', err);
            setFavoriteGenreMovies([]);
          });

        // Simular un pequeño delay para ver los skeletons (opcional, pero ayuda a UX si es muy rápido)
        setTimeout(() => setLoading(false), 1000);
        
      } catch (err) {
        console.error('Error fetching movies:', err);
        setLoading(false);
      }
    };

    fetchAllMovies();
  }, []);

  const handleMovieClick = (movie) => {
    setSelectedMovie(movie);
    // Enviar evento de click
    sendInteraction(movie, 'click');
  };

  const handleCloseModal = () => {
    setSelectedMovie(null);
  };

  const sendInteraction = async (movie, type, ratingValue = null) => {
    // Sistema monousuario - usar ID fijo
    const userId = 'user_cl954t3ef';

    const payload = {
      userId: userId,
      movieId: movie._id,
      movieTitle: movie.title,
      type: type
    };

    if (type === 'rating' && ratingValue !== null) {
      payload.rating = ratingValue;
    }

    try {
      await fetch('http://localhost:3003/api/calificaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      console.log(`Interaction sent: ${type} ${ratingValue || ''}`);
    } catch (error) {
      console.error('Error sending interaction:', error);
    }
  };

  return (
    <div>
      <section className="hero">
        <div className="hero-content">
          <h1>Película Destacada</h1>
          <p>Explora el universo de películas aleatorias...</p>
        </div>
      </section>

      <MovieRow 
        title="Recomendaciones para ti" 
        movies={recommendedMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      {favoriteGenre && favoriteGenreMovies.length > 0 && (
        <MovieRow 
          title={`Porque te gusta ${favoriteGenre}`}
          movies={favoriteGenreMovies} 
          loading={loading} 
          onMovieClick={handleMovieClick} 
        />
      )}

      <MovieRow 
        title="Tendencias (TMDB)" 
        movies={trendingMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      <MovieRow 
        title="Películas Aleatorias" 
        movies={randomMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      <MovieRow 
        title="Populares en DCICFLIX" 
        movies={popularMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      <MovieRow 
        title="Nuevos Lanzamientos" 
        movies={newMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      <MovieRow 
        title="Acción" 
        movies={actionMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      <MovieRow 
        title="Comedia" 
        movies={comedyMovies} 
        loading={loading} 
        onMovieClick={handleMovieClick} 
      />

      {selectedMovie && (
        <Modal 
          movie={selectedMovie} 
          onClose={handleCloseModal} 
          onRate={(rating) => sendInteraction(selectedMovie, 'rating', rating)}
        />
      )}
    </div>
  );
}
