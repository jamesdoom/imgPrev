import {
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { Pool } from "pg";

export type ProductionStorageStatus = "queued" | "stored" | "skipped" | "failed";

export interface ProductionStorageFile {
  contentType: string;
  key: string;
  path: string;
  publicUrl?: string;
  sizeBytes: number;
}

export interface ProductionStorageRecord {
  files: ProductionStorageFile[];
  provider: "postgres+r2";
  status: ProductionStorageStatus;
  warnings?: string[];
}

export interface ProductionStorageInput {
  files: {
    orderJson: Buffer;
    previewPng: Buffer;
    printPdf: Buffer;
    projectJson: Buffer;
  };
  orderRecord: unknown;
  projectId: string;
  projectRecord: unknown;
  submittedAt: string;
}

interface ProductionStorageConfig {
  databaseUrl: string;
  r2: {
    accessKeyId: string;
    bucket: string;
    endpoint: string;
    prefix: string;
    publicBaseUrl?: string;
    region: string;
    secretAccessKey: string;
  };
}

let postgresPool: Pool | null = null;

export function createQueuedProductionStorageRecord(
  projectId: string
): ProductionStorageRecord {
  const missingConfig = getMissingProductionStorageConfig();

  if (missingConfig.length > 0) {
    return {
      files: [],
      provider: "postgres+r2",
      status: "skipped",
      warnings: [
        `Postgres/R2 storage skipped because the backend is missing ${missingConfig.join(
          ", "
        )}.`,
      ],
    };
  }

  return {
    files: [],
    provider: "postgres+r2",
    status: "queued",
    warnings: [`Postgres/R2 storage queued for ${projectId}.`],
  };
}

export function isProductionStorageConfigured(): boolean {
  return getMissingProductionStorageConfig().length === 0;
}

export async function persistProductionSubmissionToStorage({
  files,
  orderRecord,
  projectId,
  projectRecord,
  submittedAt,
}: ProductionStorageInput): Promise<ProductionStorageRecord> {
  const config = getProductionStorageConfig();

  if (!config) {
    return createQueuedProductionStorageRecord(projectId);
  }

  const uploadedFiles = await uploadProductionFilesToR2({
    config,
    files,
    projectId,
  });

  await upsertPostgresSubmission({
    config,
    orderRecord,
    projectId,
    projectRecord,
    storageRecord: {
      files: uploadedFiles,
      provider: "postgres+r2",
      status: "stored",
    },
    submittedAt,
  });

  return {
    files: uploadedFiles,
    provider: "postgres+r2",
    status: "stored",
  };
}

export async function closeProductionStorageConnections() {
  if (!postgresPool) {
    return;
  }

  const pool = postgresPool;
  postgresPool = null;
  await pool.end();
}

function getMissingProductionStorageConfig(): string[] {
  const requiredConfig: Array<[string, string | undefined]> = [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["R2_ACCESS_KEY_ID", process.env.R2_ACCESS_KEY_ID],
    ["R2_SECRET_ACCESS_KEY", process.env.R2_SECRET_ACCESS_KEY],
    ["R2_BUCKET", process.env.R2_BUCKET],
  ];
  const missing = requiredConfig
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (!process.env.R2_ENDPOINT && !process.env.R2_ACCOUNT_ID) {
    missing.push("R2_ENDPOINT or R2_ACCOUNT_ID");
  }

  return missing;
}

function getProductionStorageConfig(): ProductionStorageConfig | null {
  if (!isProductionStorageConfigured()) {
    return null;
  }

  const endpoint =
    process.env.R2_ENDPOINT ??
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  return {
    databaseUrl: process.env.DATABASE_URL as string,
    r2: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      bucket: process.env.R2_BUCKET as string,
      endpoint,
      prefix: normalizeStoragePrefix(process.env.R2_PREFIX) ?? "decal-sheet",
      publicBaseUrl: normalizePublicBaseUrl(process.env.R2_PUBLIC_BASE_URL),
      region: process.env.R2_REGION ?? "auto",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  };
}

async function uploadProductionFilesToR2({
  config,
  files,
  projectId,
}: {
  config: ProductionStorageConfig;
  files: ProductionStorageInput["files"];
  projectId: string;
}): Promise<ProductionStorageFile[]> {
  const client = new S3Client({
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
    endpoint: config.r2.endpoint,
    region: config.r2.region,
  });
  const candidates = [
    {
      buffer: files.printPdf,
      contentType: "application/pdf",
      path: "print.pdf",
    },
    {
      buffer: files.previewPng,
      contentType: "image/png",
      path: "preview.png",
    },
    {
      buffer: files.orderJson,
      contentType: "application/json",
      path: "order.json",
    },
    {
      buffer: files.projectJson,
      contentType: "application/json",
      path: "project.json",
    },
  ];

  return Promise.all(
    candidates.map(async (file) => {
      const key = buildStorageKey(config.r2.prefix, projectId, file.path);
      const commandInput: PutObjectCommandInput = {
        Body: file.buffer,
        Bucket: config.r2.bucket,
        ContentType: file.contentType,
        Key: key,
      };

      await client.send(new PutObjectCommand(commandInput));

      return {
        contentType: file.contentType,
        key,
        path: file.path,
        publicUrl: buildPublicUrl(config.r2.publicBaseUrl, key),
        sizeBytes: file.buffer.length,
      };
    })
  );
}

async function upsertPostgresSubmission({
  config,
  orderRecord,
  projectId,
  projectRecord,
  storageRecord,
  submittedAt,
}: {
  config: ProductionStorageConfig;
  orderRecord: unknown;
  projectId: string;
  projectRecord: unknown;
  storageRecord: ProductionStorageRecord;
  submittedAt: string;
}) {
  const pool = getPostgresPool(config.databaseUrl);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS print_submissions (
      project_id text PRIMARY KEY,
      submitted_at timestamptz NOT NULL,
      status text NOT NULL,
      project_json jsonb NOT NULL,
      order_json jsonb NOT NULL,
      storage_json jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(
    `
      INSERT INTO print_submissions (
        project_id,
        submitted_at,
        status,
        project_json,
        order_json,
        storage_json,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (project_id)
      DO UPDATE SET
        submitted_at = EXCLUDED.submitted_at,
        status = EXCLUDED.status,
        project_json = EXCLUDED.project_json,
        order_json = EXCLUDED.order_json,
        storage_json = EXCLUDED.storage_json,
        updated_at = now()
    `,
    [
      projectId,
      submittedAt,
      "submitted",
      projectRecord,
      orderRecord,
      storageRecord,
    ]
  );
}

function getPostgresPool(databaseUrl: string): Pool {
  if (!postgresPool) {
    postgresPool = new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.POSTGRES_SSL === "false"
          ? false
          : {
              rejectUnauthorized: false,
            },
    });
  }

  return postgresPool;
}

function buildStorageKey(prefix: string, projectId: string, filePath: string) {
  return [prefix, projectId, filePath]
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function buildPublicUrl(
  publicBaseUrl: string | undefined,
  key: string
): string | undefined {
  if (!publicBaseUrl) {
    return undefined;
  }

  const encodedKey = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${publicBaseUrl}/${encodedKey}`;
}

function normalizeStoragePrefix(value: string | undefined): string | null {
  const normalized = value
    ?.trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");

  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizePublicBaseUrl(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\/+$/g, "");

  return normalized && normalized.length > 0 ? normalized : undefined;
}
