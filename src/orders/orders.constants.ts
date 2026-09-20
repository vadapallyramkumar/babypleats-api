export const ORDER_ID_PREFIX = 'BP-';
export const ORDER_SEQ_START = 1001;
export const ORDER_ADVISORY_LOCK = 742001;
export const LOW_STOCK_THRESHOLD = 3;
export const DEFAULT_FREE_SHIPPING_THRESHOLD = 999;
export const DEFAULT_SHIPPING_FEE = 99;
export const DASHBOARD_RECENT_LIMIT = 8;

export const SALES_RANGES = ['today', '7d', '30d'] as const;
export type SalesRange = (typeof SALES_RANGES)[number];
