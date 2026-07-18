import cron, { type ScheduledTask } from 'node-cron';
import type { Logger } from 'pino';
import type { OrderService } from '../services/order.service';
import { env } from '../config/env';

/**
 * Background scheduler that periodically promotes PENDING orders to PROCESSING.
 *
 * The cron expression is configurable (defaults to every 5 minutes). A re-entry
 * guard prevents overlapping runs if a tick takes longer than the interval.
 */
export class OrderScheduler {
  private task: ScheduledTask | null = null;
  private isRunning = false;

  constructor(
    private readonly orderService: OrderService,
    private readonly logger: Logger,
    private readonly cronExpression: string = env.SCHEDULER_CRON,
  ) {}

  /** Register and start the cron job. No-op if scheduling is disabled. */
  start(): void {
    if (!env.SCHEDULER_ENABLED) {
      this.logger.warn('Order scheduler is disabled via configuration');
      return;
    }

    if (!cron.validate(this.cronExpression)) {
      throw new Error(`Invalid SCHEDULER_CRON expression: "${this.cronExpression}"`);
    }

    this.task = cron.schedule(this.cronExpression, () => {
      void this.run();
    });

    this.logger.info(
      { cron: this.cronExpression },
      'Order scheduler started (PENDING -> PROCESSING)',
    );
  }

  /**
   * Execute one promotion cycle. Exposed (and returning a value) so it can be
   * unit-tested directly and invoked on demand.
   */
  async run(): Promise<number> {
    if (this.isRunning) {
      this.logger.warn('Scheduler tick skipped: previous run still in progress');
      return 0;
    }

    this.isRunning = true;
    const startedAt = Date.now();
    try {
      const count = await this.orderService.promotePendingOrders();
      this.logger.info(
        { count, durationMs: Date.now() - startedAt },
        'Scheduler tick completed',
      );
      return count;
    } catch (error) {
      this.logger.error({ err: error }, 'Scheduler tick failed');
      return 0;
    } finally {
      this.isRunning = false;
    }
  }

  /** Stop the cron job (used on graceful shutdown). */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      this.logger.info('Order scheduler stopped');
    }
  }
}
