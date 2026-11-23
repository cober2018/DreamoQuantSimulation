import { useSearchParams } from 'react-router'
import { PageHead } from '@/components/shell/PageHead'
import { HaloSegmented } from '@/components/fx/halo-segmented'
import { UsersTab } from '@/components/admin/UsersTab'
import { PlansTab } from '@/components/admin/PlansTab'
import { GrantsTab } from '@/components/admin/GrantsTab'
import { RolesTab } from '@/components/admin/RolesTab'
import { InvitesTab } from '@/components/admin/InvitesTab'
import { AuditTab } from '@/components/admin/AuditTab'
import { RolePolicy } from '@/components/admin/RolePolicy'

const TABS = [
  { value: 'users', label: '用户', view: UsersTab }, { value: 'plans', label: '套餐', view: PlansTab }, { value: 'grants', label: '开通记录', view: GrantsTab },
  { value: 'policy', label: '角色权限配置', view: RolePolicy }, { value: 'roles', label: '角色', view: RolesTab }, { value: 'invites', label: '邀请码', view: InvitesTab }, { value: 'audit', label: '审计', view: AuditTab },
]

export function Component() {
  const [params, setParams] = useSearchParams()
  // 当前标签写进地址栏，刷新后留在原处
  const tab = TABS.find((t) => t.value === params.get('tab')) || TABS[0]
  const View = tab.view
  return (
    <section>
      <PageHead title="管理后台" />
      <div className="-mx-1 mb-5 overflow-x-auto px-1 py-1">
        <HaloSegmented items={TABS.map(({ value, label }) => ({ value, label }))} value={tab.value}
          onValueChange={(v) => setParams({ tab: v }, { replace: true })} translucent={false} className="w-max [&_button]:flex-none [&_button]:whitespace-nowrap" />
      </div>
      <View />
    </section>
  )
}
