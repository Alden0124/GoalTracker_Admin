import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GoalTracker API',
      version: '1.0.0',
      description: 'GoalTracker 應用程式的 API 文檔',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production'
          ? 'https://goaltracker-admin.onrender.com/api'
          : 'http://localhost:3001/api',
        description: process.env.NODE_ENV === 'production'
          ? '生產環境 API'
          : '開發環境 API',
      },
    ],
  },
  apis: ['./routes/*.js'],
};

export const specs = swaggerJsdoc(options); 