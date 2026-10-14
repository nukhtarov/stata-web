import { describe, expect, it } from 'vitest';
import { fmtG, fmtF, abbrev } from '../src/stats/format';

describe('fmtG %9.0g', () => {
  const cases: [number, string][] = [
    [111.89969531, '111.8997'], [-0.31425349, '-.3142535'], [7.567834778617128e-5, '.0000757'],
    [2.47e-5, '.0000247'], [3.58e-6, '3.58e-06'], [-4670.4312, '-4670.431'], [187.98499, '187.985'],
    [35.814421, '35.81442'], [-0.68219763, '-.6821976'], [1446.1921, '1446.192'], [0, '0'], [NaN, '.'],
    [123456789, '123456789'], [1234567.89, '1234568'], [1.5e10, '1.50e+10'.replace('1.50', '1.5')], [0.5, '.5'],
    [-1039.76, '-1039.76'], [2.417277, '2.417277'],
  ];
  for (const [x, s] of cases) it(`${x} → ${s}`, () => expect(fmtG(x)).toBe(s));
});

describe('fmtG other widths', () => {
  it('%11.0g SS/MS', () => {
    expect(fmtG(126617069.604, 11)).toBe('126617070');
    expect(fmtG(33660402.93262, 11)).toBe('33660402.9');
    expect(fmtG(7913566.85025, 11)).toBe('7913566.85');
    expect(fmtG(1085819.449, 11)).toBe('1085819.45');
  });
  it('%10.5g Root MSE', () => {
    expect(fmtG(1042.0263, 10, 5)).toBe('1042');
    expect(fmtG(786.8812, 10, 5)).toBe('786.88');
  });
});

describe('fmtF', () => {
  it('t and p', () => {
    expect(fmtF(-0.0326, 2)).toBe('-0.03');
    expect(fmtF(0.0049, 3)).toBe('0.005');
    expect(fmtF(-0.001, 2)).toBe('0.00');
    expect(fmtF(0.00001, 4)).toBe('0.0000');
  });
});

it('abbrev', () => {
  expect(abbrev('Housing_stock')).toBe('Housing_st~k');
  expect(abbrev('GDP_PC_PPP')).toBe('GDP_PC_PPP');
});
