import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// i18n: return the key so labels/assertions are stable.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr', changeLanguage: vi.fn() },
  }),
}));

// framer-motion → plain elements
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...clean(props)}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

function clean(props: Record<string, any>) {
  const invalid = ['initial', 'animate', 'exit', 'transition', 'whileInView', 'whileHover', 'viewport', 'variants'];
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(props)) if (!invalid.includes(k)) out[k] = v;
  return out;
}

import GradeCalculator from '../GradeCalculator';

describe('GradeCalculator', () => {
  it('shows no result until valid grades are entered', () => {
    render(<GradeCalculator />);
    expect(screen.queryByText('tools.grade.resultTitle')).not.toBeInTheDocument();
  });

  it('computes the weighted average and the Belgian distinction', async () => {
    const user = userEvent.setup();
    render(<GradeCalculator />);

    const grades = screen.getAllByLabelText('tools.grade.grade /20');
    const weights = screen.getAllByLabelText('tools.grade.weight');

    // (14×1 + 16×3) / 4 = 15.5 → 77.5% → distinction (ISFCE scale: 70–80%)
    await user.type(grades[0], '14');
    await user.type(grades[1], '16');
    await user.clear(weights[1]);
    await user.type(weights[1], '3');

    expect(screen.getByText('tools.grade.resultTitle')).toBeInTheDocument();
    expect(screen.getByText('15,5')).toBeInTheDocument();
    expect(screen.getByText('tools.grade.mentionDistinction')).toBeInTheDocument();
  });

  it('applies the default ⅔ TFE weighting in diploma mode', async () => {
    const user = userEvent.setup();
    render(<GradeCalculator />);

    const grades = screen.getAllByLabelText('tools.grade.grade /20');
    await user.type(grades[0], '12');

    // Toggle diploma mode by clicking the switch's label (robust across MUI role conventions).
    await user.click(screen.getByText('tools.grade.diplomaToggle'));

    const tfe = await screen.findByLabelText('tools.grade.tfeGrade /20');
    await user.type(tfe, '15');

    // final = ⅓×12 + ⅔×15 = 14 → 70% → distinction (ISFCE scale: 70–80%)
    expect(screen.getByText('tools.grade.diplomaFinal')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('tools.grade.mentionDistinction')).toBeInTheDocument();
  });
});
