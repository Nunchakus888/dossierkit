import settings from './settings.json';
import { activeProfile, repository, siteUrl } from '../config';

// Infrastructure must be verified before producing an enabled public build.
export const viewsEnabled = process.env.PUBLIC_VIEWS_ENABLED === 'true'
  && siteUrl.replace(/\/+$/, '') === settings.origin
  && activeProfile === 'default'
  && (!repository || repository === 'Nunchakus888/dossierkit');
export const viewsOrigin = settings.origin;
