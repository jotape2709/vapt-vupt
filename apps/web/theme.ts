import type { Theme } from '../../packages/domain';
import {
 overviewBlocks, segmentLabels, type OrgSettings, type Segment, type SettingsEnvelope, type UserPreferences
} from '../../packages/domain/contracts';

/** Segmento textual da demonstração ↔ segmento do domínio. */
export function segmentFromLabel(label: string): Segment {
 const entry = Object.entries(segmentLabels).find(([, l]) => l === label);
 return (entry?.[0] as Segment) ?? 'other';
}

export type DemoExtras = Pick<OrgSettings, 'navigation' | 'overview'>;
export const defaultExtras = (): DemoExtras => ({ navigation: { landing: 'overview' }, overview: { blocks: [...overviewBlocks] } });

/** Tema v1 da demonstração (mantido no navegador) visto como configuração v2. */
export function themeToSettings(theme: Theme, segment: Segment, categories: string[], extras: DemoExtras = defaultExtras()): OrgSettings {
 const palette = theme.accent === 'navy' || theme.accent === 'sky' ? theme.accent : 'blue';
 const modules = ['overview', ...theme.modules.filter(m => m !== 'overview')] as OrgSettings['modules'];
 return {
  schemaVersion: 2,
  identity: { displayName: theme.name, segment, logoAssetId: theme.logo ? DEMO_LOGO_ID : null },
  appearance: { palette, mode: theme.mode, font: theme.font, density: theme.density },
  modules,
  navigation: modules.includes(extras.navigation.landing) ? extras.navigation : { landing: 'overview' },
  overview: extras.overview,
  catalog: { suggestedCategories: [...new Set(categories)].sort((a, b) => a.localeCompare(b, 'pt-BR')).slice(0, 30) }
 };
}

export const DEMO_LOGO_ID = '00000000-0000-4000-8000-00000000d0d0';

export function settingsToTheme(settings: OrgSettings, logo: string | undefined): Theme {
 return {
  version: 1, name: settings.identity.displayName, accent: settings.appearance.palette,
  mode: settings.appearance.mode, density: settings.appearance.density, font: settings.appearance.font,
  modules: settings.modules, ...(logo ? { logo } : {})
 };
}

/** Aparência efetiva: preferência pessoal vence a padrão da empresa, que nunca é alterada por ela. */
export function visualOf(envelope: SettingsEnvelope, prefs: UserPreferences) {
 const a = envelope.settings.appearance;
 return {
  accent: a.palette,
  mode: prefs.mode === 'organization' ? a.mode : prefs.mode,
  density: prefs.density === 'organization' ? a.density : prefs.density,
  font: a.font
 };
}
