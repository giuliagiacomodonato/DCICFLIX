const request = require('supertest');
const app = require('../src/index');

describe('Microservicio de Calificaciones', () => {
  
  describe('GET /health', () => {
    it('debería retornar status OK', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('Calificaciones');
    });
  });

  describe('POST /api/calificaciones', () => {
    it('debería registrar una calificación exitosamente', async () => {
      const ratingData = {
        userId: 'testUser1',
        movieId: 'movie123',
        movieTitle: 'Test Movie'
      };

      const response = await request(app)
        .post('/api/calificaciones')
        .send(ratingData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Calificación registrada exitosamente');
      expect(response.body.data.userId).toBe(ratingData.userId);
      expect(response.body.data.movieId).toBe(ratingData.movieId);
    });

    it('debería retornar error 400 si falta userId', async () => {
      const response = await request(app)
        .post('/api/calificaciones')
        .send({ movieId: 'movie123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Se requieren userId y movieId');
    });

    it('debería retornar error 400 si falta movieId', async () => {
      const response = await request(app)
        .post('/api/calificaciones')
        .send({ userId: 'user1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Se requieren userId y movieId');
    });
  });

  describe('GET /api/calificaciones/historial/:userId', () => {
    it('debería retornar el historial de un usuario', async () => {
      // Primero registrar algunas calificaciones
      await request(app)
        .post('/api/calificaciones')
        .send({ userId: 'user2', movieId: 'movie1' });
      
      await request(app)
        .post('/api/calificaciones')
        .send({ userId: 'user2', movieId: 'movie2' });

      // Obtener historial
      const response = await request(app)
        .get('/api/calificaciones/historial/user2');

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe('user2');
      expect(response.body.history.length).toBeGreaterThan(0);
    });

    it('debería retornar historial vacío para usuario sin calificaciones', async () => {
      const response = await request(app)
        .get('/api/calificaciones/historial/newUser');

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe('newUser');
      expect(response.body.totalRatings).toBe(0);
      expect(response.body.history).toEqual([]);
    });
  });

  describe('DELETE /api/calificaciones/historial/:userId', () => {
    it('debería eliminar el historial de un usuario', async () => {
      // Registrar una calificación
      await request(app)
        .post('/api/calificaciones')
        .send({ userId: 'user3', movieId: 'movie1' });

      // Eliminar historial
      const deleteResponse = await request(app)
        .delete('/api/calificaciones/historial/user3');

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.message).toContain('eliminado exitosamente');

      // Verificar que el historial esté vacío
      const getResponse = await request(app)
        .get('/api/calificaciones/historial/user3');

      expect(getResponse.body.totalRatings).toBe(0);
    });
  });
});
