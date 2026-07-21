import {
  DeleteObjectsCommand,
  GetObjectCommand,
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
    previewPngs?: Buffer[];
    printPdf: Buffer;
    projectJson: Buffer;
  };
  orderRecord: unknown;
  projectId: string;
  projectRecord: unknown;
  submittedAt: string;
}

export interface DurableProductionSubmission {
  orderRecord: unknown;
  projectId: string;
  projectRecord: unknown;
  review: unknown;
  status: string;
  storageRecord: ProductionStorageRecord;
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

export function isProductionDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function listDurableProductionSubmissions(): Promise<
  DurableProductionSubmission[]
> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return [];
  }

  const pool = getPostgresPool(databaseUrl);
  await ensureProductionSubmissionTable(pool);
  const result = await pool.query(`
    SELECT project_id, submitted_at, status, project_json, order_json,
      storage_json, review_json
    FROM print_submissions
    ORDER BY submitted_at DESC
  `);

  return result.rows.map(parseDurableProductionSubmission);
}

export async function readDurableProductionSubmission(
  projectId: string
): Promise<DurableProductionSubmission | null> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return null;
  }

  const pool = getPostgresPool(databaseUrl);
  await ensureProductionSubmissionTable(pool);
  const result = await pool.query(
    `
      SELECT project_id, submitted_at, status, project_json, order_json,
        storage_json, review_json
      FROM print_submissions
      WHERE project_id = $1
    `,
    [projectId]
  );

  return result.rows[0]
    ? parseDurableProductionSubmission(result.rows[0])
    : null;
}

export async function updateDurableProductionSubmissionReview(
  projectId: string,
  review: { status: string }
): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return false;
  }

  const pool = getPostgresPool(databaseUrl);
  await ensureProductionSubmissionTable(pool);
  const result = await pool.query(
    `
      UPDATE print_submissions
      SET review_json = $2, status = $3, updated_at = now()
      WHERE project_id = $1
    `,
    [projectId, review, review.status]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function deleteDurableProductionSubmission(
  projectId: string
): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return false;
  }

  const pool = getPostgresPool(databaseUrl);
  await ensureProductionSubmissionTable(pool);
  const submission = await readDurableProductionSubmission(projectId);

  if (!submission) {
    return false;
  }

  if (submission.storageRecord.files.length > 0) {
    const config = getProductionStorageConfig();

    if (!config) {
      throw new Error(
        "R2 configuration is required to delete stored production files."
      );
    }

    const client = createR2Client(config);
    const response = await client.send(
      new DeleteObjectsCommand({
        Bucket: config.r2.bucket,
        Delete: {
          Objects: submission.storageRecord.files.map((file) => ({
            Key: file.key,
          })),
          Quiet: true,
        },
      })
    );

    if (response.Errors?.length) {
      throw new Error(
        `R2 could not delete ${response.Errors.length} production file(s).`
      );
    }
  }

  const result = await pool.query(
    "DELETE FROM print_submissions WHERE project_id = $1",
    [projectId]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function readDurableProductionFile(
  projectId: string,
  filePath: string
): Promise<{ body: Buffer; contentType: string } | null> {
  const config = getProductionStorageConfig();

  if (!config) {
    return null;
  }

  const submission = await readDurableProductionSubmission(projectId);
  const file = submission?.storageRecord.files.find(
    (candidate) => candidate.path === filePath
  );

  if (!file) {
    return null;
  }

  const client = createR2Client(config);
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.r2.bucket,
      Key: file.key,
    })
  );

  if (!response.Body) {
    return null;
  }

  return {
    body: Buffer.from(await response.Body.transformToByteArray()),
    contentType: response.ContentType ?? file.contentType,
  };
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
  const client = createR2Client(config);
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
    ...(files.previewPngs ?? []).map((buffer, index) => ({
      buffer,
      contentType: "image/png",
      path: `preview-sheet-${index + 1}.png`,
    })),
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

function createR2Client(config: ProductionStorageConfig) {
  return new S3Client({
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
    endpoint: config.r2.endpoint,
    region: config.r2.region,
  });
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

  await ensureProductionSubmissionTable(pool);
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

async function ensureProductionSubmissionTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS print_submissions (
      project_id text PRIMARY KEY,
      submitted_at timestamptz NOT NULL,
      status text NOT NULL,
      project_json jsonb NOT NULL,
      order_json jsonb NOT NULL,
      storage_json jsonb NOT NULL,
      review_json jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    ALTER TABLE print_submissions
    ADD COLUMN IF NOT EXISTS review_json jsonb
  `);
}

function parseDurableProductionSubmission(
  row: Record<string, unknown>
): DurableProductionSubmission {
  return {
    orderRecord: row.order_json,
    projectId: String(row.project_id),
    projectRecord: row.project_json,
    review: row.review_json,
    status: String(row.status),
    storageRecord: row.storage_json as ProductionStorageRecord,
    submittedAt:
      row.submitted_at instanceof Date
        ? row.submitted_at.toISOString()
        : String(row.submitted_at),
  };
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
