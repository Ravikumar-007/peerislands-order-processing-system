import swaggerJSDoc from 'swagger-jsdoc';

/**
 * OpenAPI specification. Reusable component schemas are declared here; the
 * per-endpoint documentation lives as JSDoc annotations next to the routes.
 */
const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Order Processing System API',
      version: '1.0.0',
      description:
        'Production-quality Order Processing System built with Clean Architecture (Express + Prisma + PostgreSQL).',
    },
    servers: [{ url: '/api/v1', description: 'API v1' }],
    components: {
      schemas: {
        OrderStatus: {
          type: 'string',
          enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
        },
        OrderItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            productName: { type: 'string' },
            quantity: { type: 'integer', example: 2 },
            price: { type: 'number', example: 19.99 },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            customerName: { type: 'string' },
            status: { $ref: '#/components/schemas/OrderStatus' },
            totalAmount: { type: 'number', example: 39.98 },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateOrderRequest: {
          type: 'object',
          required: ['customerName', 'items'],
          properties: {
            customerName: { type: 'string', example: 'Jane Doe' },
            items: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['productName', 'quantity', 'price'],
                properties: {
                  productName: { type: 'string', example: 'Wireless Mouse' },
                  quantity: { type: 'integer', example: 2 },
                  price: { type: 'number', example: 19.99 },
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },
  },
  // Scan route + controller files for @openapi annotations.
  apis: ['src/routes/*.ts', 'src/controllers/*.ts', 'dist/routes/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);
