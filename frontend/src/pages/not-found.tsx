import { Link } from 'react-router-dom'
import { ErrorState } from '@/components/empty-state'
import { buttonVariants } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <ErrorState
      code="404"
      title="This page doesn't exist."
      body="The link may be stale, or the session it pointed at was deleted."
      actions={
        <Link to="/" className={buttonVariants({ variant: 'outline' })}>
          Back to SynthView
        </Link>
      }
    />
  )
}
