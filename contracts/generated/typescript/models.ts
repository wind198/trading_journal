/** AUTO-GENERATED — do not edit. */

export interface ConditionalOrderCreateV2 {
  schema_version: 2;
  order_id: string;
  device_id: string;
  account_id: string;
  symbol: string;
  side: "BUY" | "SELL";
  entry_price: string;
  timeframe: "3m" | "15m" | "1h" | "4h";
  trigger: {
    type: "candle_close_cross";
    price: string;
  };
  filters?: (
    | {
        type: "force_score";
        minimum: number;
        direction?: "same_as_order";
      }
    | {
        type: "pattern";
        name: "engulfing";
        direction?: "same_as_order";
        minimum_score: number;
      }
  )[];
  risk: {
    stop_loss_points: number;
    take_profit_points: number;
    max_loss_usd: string;
  };
  execution?: {
    max_deviation_points?: number;
    comment?: string;
  };
  expires_at: string;
}

/** AUTO-GENERATED — do not edit. */

export interface OrderCancelPayload {
  order_id: string;
  device_id: string;
  account_id: string;
  reason?: string;
}

/** AUTO-GENERATED — do not edit. */

export interface OrderAckPayload {
  order_id: string;
  result: "ARMED" | "REJECTED" | "WAREHOUSE_OFFLINE" | "UNKNOWN_OUTCOME" | "ROUTED" | "RECEIVED" | "CANCELLED";
  state?:
    | "SUBMITTED"
    | "ROUTED"
    | "RECEIVED"
    | "ARMED"
    | "TRIGGERED"
    | "EXECUTION_SUBMITTED"
    | "FILLED"
    | "REJECTED"
    | "FAILED"
    | "CANCELLED"
    | "EXPIRED";
  reason?: string;
  calculated_volume_lots?: string;
  stop_loss_price?: string;
  take_profit_price?: string;
  estimated_risk_usd?: string;
}

/** AUTO-GENERATED — do not edit. */

export interface HeartbeatPayload {
  device_id: string;
  account_id: string;
  online?: boolean;
  armed_order_count?: number;
}

/** AUTO-GENERATED — do not edit. */

export interface DeliveryUnavailablePayload {
  order_id?: string;
  device_id: string;
  result: "WAREHOUSE_OFFLINE";
  reason?: string;
}

/** AUTO-GENERATED — do not edit. */

export interface OrderRisk {
  stop_loss_points: number;
  take_profit_points: number;
  max_loss_usd: string;
}
