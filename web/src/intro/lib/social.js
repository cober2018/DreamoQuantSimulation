import data from '../content/social.json'
import { SOCIAL_DRAFTS } from '../config.js'

export const SOCIAL = data.items.filter((s) => s.ready || SOCIAL_DRAFTS)
