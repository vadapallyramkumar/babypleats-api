import { DateTime } from 'luxon';
import { DeliveryCalculatorService } from './delivery-calculator.service';

const calculator = new DeliveryCalculatorService();

const BASE = {
  preparationMinDays: 2,
  preparationMaxDays: 3,
  transitMinDays: 3,
  transitMaxDays: 6,
  cutoffTime: '14:00',
  timezone: 'Asia/Kolkata',
  workingDays: [1, 2, 3, 4, 5, 6],
  holidayDates: [] as string[],
};

/** Build a JS Date that is `HH:mm` on the given calendar day in Asia/Kolkata. */
function ist(date: string, time: string): Date {
  return DateTime.fromISO(`${date}T${time}:00`, {
    zone: 'Asia/Kolkata',
  }).toJSDate();
}

describe('DeliveryCalculatorService', () => {
  describe('matchRegion', () => {
    const regions = [
      {
        id: 'hyd',
        name: 'Hyderabad',
        pincodePrefixes: ['500', '501'],
        transitMinDays: 2,
        transitMaxDays: 3,
        isActive: true,
      },
      {
        id: 'hyd-precise',
        name: 'Hitech City',
        pincodePrefixes: ['50008'],
        transitMinDays: 1,
        transitMaxDays: 2,
        isActive: true,
      },
      {
        id: 'inactive',
        name: 'Inactive',
        pincodePrefixes: ['500081'],
        transitMinDays: 1,
        transitMaxDays: 1,
        isActive: false,
      },
    ];

    it('uses longest-prefix matching', () => {
      const matched = calculator.matchRegion('500081', regions);
      expect(matched?.name).toBe('Hitech City');
      expect(matched?.transitMinDays).toBe(1);
    });

    it('ignores inactive regions', () => {
      const matched = calculator.matchRegion('500081', [
        regions[2],
        regions[0],
      ]);
      expect(matched?.name).toBe('Hyderabad');
    });

    it('returns null when nothing matches', () => {
      expect(calculator.matchRegion('110001', regions)).toBeNull();
    });
  });

  describe('calculate', () => {
    it('does not count order day; Monday before cutoff → prep Tue–Wed/Thu', () => {
      // Mon 2026-11-02 11:00 IST before cutoff
      const result = calculator.calculate(BASE, ist('2026-11-02', '11:00'));

      // Prep start Tue 03: day1 Tue, day2 Wed → dispatch Wed
      // Transit from Thu: 1=Thu 2=Fri 3=Sat → 2026-11-07
      // Max prep Thu dispatch; transit 6 from Fri → Fri Sat Mon Tue Wed Thu = 2026-11-12
      expect(result.from).toBe('2026-11-07');
      expect(result.to).toBe('2026-11-12');
    });

    it('moves to next day when at or after cutoff', () => {
      const before = calculator.calculate(BASE, ist('2026-11-02', '13:59'));
      const after = calculator.calculate(BASE, ist('2026-11-02', '14:00'));

      expect(after.from > before.from || after.to > before.to).toBe(true);
      // After cutoff Monday → accepted Tue → prep Wed–Thu/Fri
      // Min: dispatch Thu, transit Fri Sat Mon → 2026-11-09
      expect(after.from).toBe('2026-11-09');
    });

    it('skips Sunday when counting preparation and transit', () => {
      // Friday before cutoff
      const result = calculator.calculate(BASE, ist('2026-11-06', '10:00'));
      // Accepted Fri; prep Sat + Mon (skip Sun) → dispatch Mon for min(2)
      // Transit Tue Wed Thu → 2026-11-12
      expect(result.from).toBe('2026-11-12');
    });

    it('skips configured holidays', () => {
      const result = calculator.calculate(
        {
          ...BASE,
          holidayDates: ['2026-11-03', '2026-11-04'], // Tue, Wed
        },
        ist('2026-11-02', '11:00'),
      );
      // Accepted Mon; prep start skips Tue/Wed holidays → Thu=1, Fri=2 → dispatch Fri
      // Transit Sat Mon Tue → 2026-11-10
      expect(result.from).toBe('2026-11-10');
    });

    it('handles year-end and leap-day boundaries', () => {
      const result = calculator.calculate(
        {
          ...BASE,
          preparationMinDays: 1,
          preparationMaxDays: 1,
          transitMinDays: 1,
          transitMaxDays: 1,
        },
        ist('2027-12-31', '10:00'), // Friday
      );
      // Accepted Fri Dec 31; prep Sat Jan 1 → dispatch Sat; transit Mon Jan 3
      expect(result.from).toBe('2028-01-03');
      expect(result.to).toBe('2028-01-03');
    });

    it('treats zero transit as delivery on dispatch day', () => {
      const result = calculator.calculate(
        {
          ...BASE,
          preparationMinDays: 1,
          preparationMaxDays: 1,
          transitMinDays: 0,
          transitMaxDays: 0,
        },
        ist('2026-11-02', '11:00'),
      );
      // Prep Tue → dispatch Tue; zero transit → Tue
      expect(result.from).toBe('2026-11-03');
      expect(result.to).toBe('2026-11-03');
    });

    it('respects custom working days (weekdays only)', () => {
      const result = calculator.calculate(
        {
          ...BASE,
          workingDays: [1, 2, 3, 4, 5], // no Saturday
          preparationMinDays: 1,
          preparationMaxDays: 1,
          transitMinDays: 1,
          transitMaxDays: 1,
        },
        ist('2026-11-06', '11:00'), // Friday
      );
      // Accepted Fri; prep Mon; transit Tue
      expect(result.from).toBe('2026-11-10');
    });
  });

  describe('formatMessage', () => {
    it('formats a range', () => {
      expect(calculator.formatMessage('2026-11-05', '2026-11-07')).toBe(
        'Estimated delivery between 05 Nov and 07 Nov.',
      );
    });

    it('formats a single day', () => {
      expect(calculator.formatMessage('2026-11-05', '2026-11-05')).toBe(
        'Estimated delivery on 05 Nov.',
      );
    });
  });
});
