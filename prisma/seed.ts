import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

/** Seed a handful of representative orders for local development. */
async function main(): Promise<void> {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();

  await prisma.order.create({
    data: {
      customerName: 'Jane Doe',
      status: OrderStatus.PENDING,
      totalAmount: 59.97,
      items: {
        create: [
          { productName: 'Wireless Mouse', quantity: 1, price: 19.99 },
          { productName: 'Mechanical Keyboard', quantity: 1, price: 39.98 },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      customerName: 'John Smith',
      status: OrderStatus.PROCESSING,
      totalAmount: 120.0,
      items: {
        create: [{ productName: 'Monitor Stand', quantity: 2, price: 60.0 }],
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log('✅ Seed data inserted');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
