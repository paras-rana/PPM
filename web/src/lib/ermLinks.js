const ERM_APP_URL = (import.meta.env.VITE_ERM_APP_URL ?? '').replace(/\/$/, '');

export function getErmRiskHref(riskId) {
  if (!ERM_APP_URL) {
    return null;
  }

  return `${ERM_APP_URL}/risks/${riskId}`;
}
