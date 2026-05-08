import 'dotenv/config';
import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function withSchemaSearchPath(connectionString: string): string {
  const url = new URL(connectionString);
  const schema = url.searchParams.get('schema');
  const hasOptions = url.searchParams.has('options');

  if (!schema || hasOptions) {
    return connectionString;
  }

  const quotedSchema = `"${schema.replace(/"/g, '""')}"`;
  url.searchParams.set('options', `-csearch_path=${quotedSchema},public`);

  return url.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // Prisma is configured for direct Postgres access via adapter.
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not set in .env');
    }

    const adapter = new PrismaPg({
      connectionString: withSchemaSearchPath(connectionString),
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // Allows Nest to shut down cleanly after Prisma triggers beforeExit.
  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
