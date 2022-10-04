import * as React from 'react';
import { render as reactRender, screen } from '@testing-library/react';
import { VariantAnalysisRepoStatus } from '../../../remote-queries/shared/variant-analysis';
import userEvent from '@testing-library/user-event';
import { RepoRow, RepoRowProps } from '../RepoRow';

describe(RepoRow.name, () => {
  const render = (props: Partial<RepoRowProps> = {}) => {
    return reactRender(
      <RepoRow
        repository={{
          id: 1,
          fullName: 'octodemo/hello-world-1',
          private: false,
        }}
        status={VariantAnalysisRepoStatus.Pending}
        {...props}
      />
    );
  };

  it('renders the pending state', () => {
    render();

    expect(screen.getByText('octodemo/hello-world-1')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();

    expect(screen.queryByRole('img', {
      // There should not be any icons, except the expand icon
      name: (name) => name.toLowerCase() !== 'expand',
    })).not.toBeInTheDocument();

    expect(screen.getByRole<HTMLButtonElement>('button', {
      expanded: false
    })).toBeDisabled();
  });

  it('renders the in progress state', () => {
    render({
      status: VariantAnalysisRepoStatus.InProgress,
    });

    expect(screen.getByRole('img', {
      name: 'In progress',
    })).toBeInTheDocument();
    expect(screen.getByRole<HTMLButtonElement>('button', {
      expanded: false
    })).toBeDisabled();
  });

  it('renders the succeeded state', () => {
    render({
      status: VariantAnalysisRepoStatus.Succeeded,
      resultCount: 178,
    });

    expect(screen.getByRole('img', {
      name: 'Success',
    })).toBeInTheDocument();
    expect(screen.getByText('178')).toBeInTheDocument();
    expect(screen.getByRole<HTMLButtonElement>('button', {
      expanded: false
    })).toBeEnabled();
  });

  it('renders the failed state', () => {
    render({
      status: VariantAnalysisRepoStatus.Failed,
    });

    expect(screen.getByRole('img', {
      name: 'Failed',
    })).toBeInTheDocument();
    expect(screen.getByRole<HTMLButtonElement>('button', {
      expanded: false
    })).toBeEnabled();
  });

  it('renders the timed out state', () => {
    render({
      status: VariantAnalysisRepoStatus.TimedOut,
    });

    expect(screen.getByRole('img', {
      name: 'Timed out',
    })).toBeInTheDocument();
    expect(screen.getByRole<HTMLButtonElement>('button', {
      expanded: false
    })).toBeEnabled();
  });

  it('renders the canceled state', () => {
    render({
      status: VariantAnalysisRepoStatus.Canceled,
    });

    expect(screen.getByRole('img', {
      name: 'Canceled',
    })).toBeInTheDocument();
    expect(screen.getByRole<HTMLButtonElement>('button', {
      expanded: false
    })).toBeEnabled();
  });

  it('shows repository name', async () => {
    render({
      repository: {
        fullName: 'octodemo/hello-world',
      }
    });

    expect(screen.getByText('octodemo/hello-world')).toBeInTheDocument();
  });

  it('shows visibility when public', () => {
    render({
      repository: {
        id: 1,
        fullName: 'octodemo/hello-world-1',
        private: false,
      }
    });

    expect(screen.getByText('public')).toBeInTheDocument();
  });

  it('shows visibility when private', () => {
    render({
      repository: {
        id: 1,
        fullName: 'octodemo/hello-world-1',
        private: true,
      }
    });

    expect(screen.getByText('private')).toBeInTheDocument();
  });

  it('does not show visibility when unknown', () => {
    render({
      repository: {
        id: undefined,
        fullName: 'octodemo/hello-world-1',
        private: undefined,
      }
    });

    expect(screen.queryByText('public')).not.toBeInTheDocument();
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });

  it('can expand the repo item', async () => {
    render({
      status: VariantAnalysisRepoStatus.TimedOut,
    });

    await userEvent.click(screen.getByRole('button', {
      expanded: false
    }));

    screen.getByRole('button', {
      expanded: true,
    });
    screen.getByText('Error: Timed out');
  });

  it('does not allow expanding the repo item when status is undefined', async () => {
    render({
      status: undefined,
    });

    expect(screen.getByRole('button', {
      expanded: false
    })).toBeDisabled();
  });
});
