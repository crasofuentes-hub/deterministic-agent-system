import { listPaymentAuditRecords } from "../../data-layer/payment-audit-repository";
import {
  deriveAccountManagerAlertsFromPaymentRecords,
  type AccountManagerAlert,
  type AccountManagerAlertSeverity,
  type AccountManagerAlertType,
} from "./account-manager-alerts";

export interface AccountManagerAlertQuery {
  readonly policyId?: string;
  readonly customerId?: string;
  readonly type?: AccountManagerAlertType;
  readonly severity?: AccountManagerAlertSeverity;
}

export interface AccountManagerAlertQueryResult {
  readonly query: AccountManagerAlertQuery;
  readonly alerts: readonly AccountManagerAlert[];
  readonly alertCount: number;
}

function matchesAccountManagerAlertQuery(
  alert: AccountManagerAlert,
  query: AccountManagerAlertQuery,
): boolean {
  if (query.policyId !== undefined && alert.policyId !== query.policyId) {
    return false;
  }

  if (query.customerId !== undefined && alert.customerId !== query.customerId) {
    return false;
  }

  if (query.type !== undefined && alert.type !== query.type) {
    return false;
  }

  if (query.severity !== undefined && alert.severity !== query.severity) {
    return false;
  }

  return true;
}

export function queryAccountManagerAlerts(
  query: AccountManagerAlertQuery = {},
): AccountManagerAlertQueryResult {
  const alerts = deriveAccountManagerAlertsFromPaymentRecords(listPaymentAuditRecords()).filter(
    (alert) => matchesAccountManagerAlertQuery(alert, query),
  );

  return {
    query,
    alerts,
    alertCount: alerts.length,
  };
}