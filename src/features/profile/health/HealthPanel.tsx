import { Link } from 'react-router'
import { ChevronRightIcon } from '../../../components/icons'
import { Panel } from '../../../components/Panel'
import { HEALTH_METRIC_LABEL as METRIC_LABEL } from '../../../lib/health/bridge'
import { isAndroidApp } from '../../../lib/platform'
import { useHealthState } from '../../today/healthSync'

const linkClass =
  'flex min-h-touch items-center justify-between gap-2 border-t border-line-soft pt-3 font-display font-bold uppercase tracking-wider text-accent hover:text-text'

/** Me screen: Health Connect status, linking to Me → Health Connect. */
export function HealthPanel() {
  const state = useHealthState()
  const android = isAndroidApp()
  const connected = android && state?.connected

  return (
    <Panel title="Health Connect" aside={connected ? 'On' : undefined}>
      <div className="space-y-3">
        <p className="text-muted">
          {connected
            ? `Reading ${state.granted.map((m) => METRIC_LABEL[m].toLowerCase()).join(', ') || 'nothing yet'} from Health Connect.`
            : android
              ? 'Fill in steps, sleep and weight by themselves from your phone, watch or scale.'
              : 'Steps, sleep and weight from your phone fill in by themselves in the Android app.'}
        </p>
        <Link to="/me/health" className={linkClass}>
          {connected ? 'Manage' : android ? 'Connect' : 'Learn more'}
          <ChevronRightIcon size={18} />
        </Link>
      </div>
    </Panel>
  )
}
