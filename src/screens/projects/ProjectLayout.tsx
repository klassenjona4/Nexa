import { Outlet, useParams } from 'react-router';
import { useAuth } from '../../app/AuthProvider';
import p from '../../app/page.module.css';
import { ErrorPanel, LoadingState } from '../../components/States';
import { codeOf } from '../../lib/api';
import { ProjectProvider, useProjectQuery } from '../../lib/project';
import { ButtonLink } from '../../components/Button';

export function ProjectLayout() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const q = useProjectQuery(projectId);

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
      <Outlet />
    </ProjectProvider>
  );
}
