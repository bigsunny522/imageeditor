export type Feature = 'retouch' | 'batch' | 'compare';

export function canUse(_feature: Feature): boolean {
  void _feature;
  return true;
}
