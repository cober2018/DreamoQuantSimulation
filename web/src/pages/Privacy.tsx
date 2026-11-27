import { PRIVACY } from '@/legal/privacy'
import { LegalPage } from './Terms'

export function Component() {
  return <LegalPage doc={PRIVACY} other={{ to: '/terms', label: '用户协议' }} />
}
