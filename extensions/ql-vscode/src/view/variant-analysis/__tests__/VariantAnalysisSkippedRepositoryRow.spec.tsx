import * as React from 'react';
import { render as reactRender, screen } from '@testing-library/react';
import { VariantAnalysisSkippedRepositoryRow, VariantAnalysisSkippedRepositoryRowProps } from '../VariantAnalysisSkippedRepositoryRow';

describe(VariantAnalysisSkippedRepositoryRow.name, () => {
  const render = (props: VariantAnalysisSkippedRepositoryRowProps) =>
    reactRender(<VariantAnalysisSkippedRepositoryRow {...props} />);

  it('shows repository name', async () => {
    render({
      repository: {
        fullName: 'octodemo/hello-world',
      }
    });

    expect(screen.getByText('octodemo/hello-world')).toBeInTheDocument();
  });

  it('shows visibility when public', async () => {
    render({
      repository: {
        fullName: 'octodemo/hello-world',
        private: false,
      }
    });

    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });

  it('shows visibility when private', async () => {
    render({
      repository: {
        fullName: 'octodemo/hello-world',
        private: true,
      }
    });

    expect(screen.queryByText('public')).not.toBeInTheDocument();
    expect(screen.getByText('private')).toBeInTheDocument();
  });

  it('does not show visibility when unknown', async () => {
    render({
      repository: {
        fullName: 'octodemo/hello-world',
      }
    });

    expect(screen.queryByText('public')).not.toBeInTheDocument();
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });
});
