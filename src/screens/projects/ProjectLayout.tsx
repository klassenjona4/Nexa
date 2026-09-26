import { useQueryClient } from '@tanstack/react-query';
import { Outlet, useParams } from 'react-router';
import { formatDate } from '../../../shared/dates';
import { useAuth } from '../../app/AuthProvider';
import p from '../../app/page.module.css';
import { ErrorPanel, LoadingState } from '../../components/States';
import { api, codeOf } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { InlineNotice } from '../../components/Display';
import { useToast } from '../../components/Toast';
import { ProjectProvider, useProjectQuery } from '../../lib/project';
import { useProjectRealtime } from '../../lib/tasks';
import { Button, ButtonLink } from '../../components/Button';

export function ProjectLayout() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const q = useProjectQuery(projectId);
  useProjectRealtime(projectId ?? '');

  if (q.isPending) {
    return (
      <div className={p.content}>
        <LoadingState text="Loading the project" />
      </div>
    );
  }
  if (q.isError || !q.data || !user) {
    const missing = codeOf(q.error) === 'not_found';
    return (
      <div className={p.content}>
        <ErrorPanel
          title={missing ? 'This project could not be found' : 'The project could not be loaded'}
          body={missing ? 'The project was deleted or you are no longer a member of the group.' : 'Nexa could not reach the server. Check your connection and try again.'}
          onRetry={missing ? undefined : () => void q.refetch()}
        >
          {missing ? <ButtonLink to="/projects">Your projects</ButtonLink> : null}
        </ErrorPanel>
      </div>
    );
  }
  return (
    <ProjectProvider userId={user.id} project={q.data.project} members={q.data.members}>
      {q.data.project.deletion_warned_at ? <RetentionNotice projectId={q.data.project.id} warnedAt={q.data.project.deletion_warned_at} /> : null}
      <Outlet />
    </ProjectProvider>
  );
}

// Shown after the retention warning email: any member can keep the project.
function RetentionNotice({ projectId, warnedAt }: { projectId: string; warnedAt: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const on = formatDate(new Date(new Date(warnedAt).getTime() + 7 * 86_400_000));
  return (
    <div className={p.content} style={{ paddingBottom: 0 }}>
      <InlineNotice role="status">
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <span>There has been no recent activity. This project will be deleted on {on} unless a member keeps it.</span>
          <Button
            size="sm"
            onClick={async () => {
              try {
                await api(`/api/projects/${projectId}/keep`, { method: 'POST' });
                await qc.invalidateQueries({ queryKey: ['project', projectId] });
                toast.show('The project is kept. Deletion is cancelled.');
              } catch (err) {
                toast.show(`Error: ${errorMessage(codeOf(err))}`);
              }
            }}
          >
            Keep project
          </Button>
        </span>
      </InlineNotice>
    </div>
  );
}
