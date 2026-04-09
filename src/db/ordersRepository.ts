import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { NewOrderInput, OrderRecord, OrderStatus } from "../types.js";

export class OrdersRepository {
  private readonly db: DatabaseSync;

  public constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        customer_name_snapshot TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_label TEXT NOT NULL,
        service_mode TEXT NOT NULL,
        price_profile_id TEXT,
        price_profile_label TEXT,
        current_value TEXT,
        desired_value TEXT,
        package_value TEXT,
        selection_summary TEXT NOT NULL,
        native_subtotal REAL NOT NULL,
        native_total REAL NOT NULL,
        native_currency TEXT NOT NULL,
        usd_total REAL NOT NULL,
        status TEXT NOT NULL,
        ticket_channel_id TEXT NOT NULL,
        ticket_message_id TEXT NOT NULL,
        claim_message_id TEXT,
        assigned_booster_id TEXT,
        assigned_booster_name_snapshot TEXT,
        proof_attachment_url TEXT,
        proof_updated_at TEXT,
        proof_source TEXT,
        created_at TEXT NOT NULL,
        paid_at TEXT,
        assigned_at TEXT,
        completed_at TEXT,
        closed_at TEXT,
        metadata_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT,
        details TEXT,
        created_at TEXT NOT NULL
      );
    `);

    this.ensureOrderColumn("proof_updated_at", "TEXT");
    this.ensureOrderColumn("proof_source", "TEXT");
  }

  public create(input: NewOrderInput): OrderRecord {
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `
          INSERT INTO orders (
            id, customer_id, customer_name_snapshot, product_id, product_label, service_mode,
            price_profile_id, price_profile_label, current_value, desired_value, package_value,
            selection_summary, native_subtotal, native_total, native_currency, usd_total, status,
            ticket_channel_id, ticket_message_id, created_at, metadata_json
          )
          VALUES (
            @id, @customer_id, @customer_name_snapshot, @product_id, @product_label, @service_mode,
            @price_profile_id, @price_profile_label, @current_value, @desired_value, @package_value,
            @selection_summary, @native_subtotal, @native_total, @native_currency, @usd_total, 'AWAITING_PAYMENT',
            @ticket_channel_id, @ticket_message_id, @created_at, @metadata_json
          )
        `,
      )
      .run({
        id: input.id,
        customer_id: input.customerId,
        customer_name_snapshot: input.customerNameSnapshot,
        product_id: input.productId,
        product_label: input.productLabel,
        service_mode: input.serviceMode,
        price_profile_id: input.priceProfileId ?? null,
        price_profile_label: input.priceProfileLabel ?? null,
        current_value: input.currentValue ?? null,
        desired_value: input.desiredValue ?? null,
        package_value: input.packageValue ?? null,
        selection_summary: input.selectionSummary,
        native_subtotal: input.nativeSubtotal,
        native_total: input.nativeTotal,
        native_currency: input.nativeCurrency,
        usd_total: input.usdTotal,
        ticket_channel_id: input.ticketChannelId,
        ticket_message_id: input.ticketMessageId,
        created_at: createdAt,
        metadata_json: input.metadataJson,
      });

    return this.getById(input.id)!;
  }

  public getById(id: string): OrderRecord | null {
    const row = this.db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  public getByTicketChannelId(channelId: string): OrderRecord | null {
    const row = this.db
      .prepare("SELECT * FROM orders WHERE ticket_channel_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(channelId) as Record<string, unknown> | undefined;

    return row ? this.mapRow(row) : null;
  }

  public listActive(): OrderRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM orders WHERE status NOT IN ('CLOSED', 'CANCELLED') ORDER BY created_at ASC")
      .all() as Record<string, unknown>[];

    return rows.map((row) => this.mapRow(row));
  }

  public markPaid(id: string): void {
    this.db
      .prepare("UPDATE orders SET status = 'PAID', paid_at = @paid_at WHERE id = @id")
      .run({ id, paid_at: new Date().toISOString() });
  }

  public markSearchingBooster(id: string, claimMessageId: string): void {
    this.db
      .prepare("UPDATE orders SET status = 'SEARCHING_BOOSTER', claim_message_id = @claim_message_id WHERE id = @id")
      .run({ id, claim_message_id: claimMessageId });
  }

  public assignBooster(id: string, boosterId: string, boosterName: string): boolean {
    const result = this.db
      .prepare(
        `
          UPDATE orders
          SET assigned_booster_id = @booster_id,
              assigned_booster_name_snapshot = @booster_name,
              assigned_at = @assigned_at,
              status = 'IN_PROGRESS'
          WHERE id = @id
            AND assigned_booster_id IS NULL
            AND status = 'SEARCHING_BOOSTER'
        `,
      )
      .run({
        id,
        booster_id: boosterId,
        booster_name: boosterName,
        assigned_at: new Date().toISOString(),
      });

    return result.changes > 0;
  }

  public complete(
    id: string,
    proofAttachmentUrl: string,
    proofUpdatedAt = new Date().toISOString(),
    proofSource: "attachment" | "link" = "attachment",
  ): void {
    this.db
      .prepare(
        `
          UPDATE orders
          SET proof_attachment_url = @proof,
              proof_updated_at = @proof_updated_at,
              proof_source = @proof_source,
              completed_at = @completed_at,
              status = 'COMPLETED'
          WHERE id = @id
        `,
      )
      .run({
        id,
        proof: proofAttachmentUrl,
        proof_updated_at: proofUpdatedAt,
        proof_source: proofSource,
        completed_at: new Date().toISOString(),
      });
  }

  public updateProofAttachmentUrl(
    id: string,
    proofAttachmentUrl: string,
    proofUpdatedAt: string,
    proofSource: "attachment" | "link",
  ): void {
    this.db
      .prepare(
        `
          UPDATE orders
          SET proof_attachment_url = @proof,
              proof_updated_at = @proof_updated_at,
              proof_source = @proof_source
          WHERE id = @id
        `,
      )
      .run({
        id,
        proof: proofAttachmentUrl,
        proof_updated_at: proofUpdatedAt,
        proof_source: proofSource,
      });
  }

  public close(id: string): void {
    this.db
      .prepare("UPDATE orders SET status = 'CLOSED', closed_at = @closed_at WHERE id = @id")
      .run({ id, closed_at: new Date().toISOString() });
  }

  public appendAuditLog(orderId: string, action: string, actorId?: string, details?: string): void {
    this.db
      .prepare(
        `
          INSERT INTO audit_logs (order_id, action, actor_id, details, created_at)
          VALUES (@order_id, @action, @actor_id, @details, @created_at)
        `,
      )
      .run({
        order_id: orderId,
        action,
        actor_id: actorId ?? null,
        details: details ?? null,
        created_at: new Date().toISOString(),
      });
  }

  private mapRow(row: Record<string, unknown>): OrderRecord {
    return {
      id: String(row.id),
      customerId: String(row.customer_id),
      customerNameSnapshot: String(row.customer_name_snapshot),
      productId: String(row.product_id) as OrderRecord["productId"],
      productLabel: String(row.product_label),
      serviceMode: String(row.service_mode) as OrderRecord["serviceMode"],
      priceProfileId: row.price_profile_id ? String(row.price_profile_id) : null,
      priceProfileLabel: row.price_profile_label ? String(row.price_profile_label) : null,
      currentValue: row.current_value ? String(row.current_value) : null,
      desiredValue: row.desired_value ? String(row.desired_value) : null,
      packageValue: row.package_value ? String(row.package_value) : null,
      selectionSummary: String(row.selection_summary),
      nativeSubtotal: Number(row.native_subtotal),
      nativeTotal: Number(row.native_total),
      nativeCurrency: String(row.native_currency) as OrderRecord["nativeCurrency"],
      usdTotal: Number(row.usd_total),
      status: String(row.status) as OrderStatus,
      ticketChannelId: String(row.ticket_channel_id),
      ticketMessageId: String(row.ticket_message_id),
      claimMessageId: row.claim_message_id ? String(row.claim_message_id) : null,
      assignedBoosterId: row.assigned_booster_id ? String(row.assigned_booster_id) : null,
      assignedBoosterNameSnapshot: row.assigned_booster_name_snapshot ? String(row.assigned_booster_name_snapshot) : null,
      proofAttachmentUrl: row.proof_attachment_url ? String(row.proof_attachment_url) : null,
      proofUpdatedAt: row.proof_updated_at ? String(row.proof_updated_at) : null,
      proofSource:
        row.proof_source === "attachment" || row.proof_source === "link"
          ? (String(row.proof_source) as "attachment" | "link")
          : null,
      createdAt: String(row.created_at),
      paidAt: row.paid_at ? String(row.paid_at) : null,
      assignedAt: row.assigned_at ? String(row.assigned_at) : null,
      completedAt: row.completed_at ? String(row.completed_at) : null,
      closedAt: row.closed_at ? String(row.closed_at) : null,
      metadataJson: String(row.metadata_json),
    };
  }

  private ensureOrderColumn(columnName: string, definition: string): void {
    const columns = this.db.prepare("PRAGMA table_info(orders)").all() as Array<{ name?: unknown }>;
    const hasColumn = columns.some((column) => String(column.name) === columnName);
    if (!hasColumn) {
      this.db.exec(`ALTER TABLE orders ADD COLUMN ${columnName} ${definition};`);
    }
  }
}
