import { describe, expect, it } from 'vitest';
import { fmtDate, timeAgo, fmtMinutes } from '@/lib/format';

describe('format', () => {
  describe('fmtDate', () => {
    it('should format date as short month, day, and year', () => {
      const result = fmtDate('2023-06-15T10:30:00Z');
      // The exact format depends on the locale, but should contain month/day/year
      expect(result).toMatch(/Jun|June/); // Month
      expect(result).toMatch(/\d{4}/); // Year
      expect(result).toMatch(/\d{1,2}/); // Day
    });

    it('should handle different ISO date formats', () => {
      const result = fmtDate('2023-12-25T00:00:00Z');
      expect(result).toMatch(/\w+\s\d{1,2},?\s\d{4}/);
    });
  });

  describe('timeAgo', () => {
    beforeEach(() => {
      // Mock Date.now to have consistent tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2023, 5, 15, 10, 0, 0)); // June 15, 2023, 10:00:00
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "Just now" for very recent dates', () => {
      const date = new Date(Date.now() - 30000); // 30 seconds ago
      const result = timeAgo(date.toISOString());
      expect(result).toBe('Just now');
    });

    it('should return minutes ago for recent dates', () => {
      const date = new Date(Date.now() - 5 * 60000); // 5 minutes ago
      const result = timeAgo(date.toISOString());
      expect(result).toBe('5m ago');
    });

    it('should return hours ago for dates within 24 hours', () => {
      const date = new Date(Date.now() - 3 * 3600000); // 3 hours ago
      const result = timeAgo(date.toISOString());
      expect(result).toBe('3h ago');
    });

    it('should return days ago for dates within 30 days', () => {
      const date = new Date(Date.now() - 7 * 24 * 3600000); // 7 days ago
      const result = timeAgo(date.toISOString());
      expect(result).toBe('7d ago');
    });

    it('should return formatted date for older dates', () => {
      const date = new Date(2023, 0, 15); // January 15, 2023
      const result = timeAgo(date.toISOString());
      expect(result).toMatch(/Jan|January/); // Month
      expect(result).toMatch(/\d{4}/); // Year
      expect(result).toMatch(/\d{1,2}/); // Day
    });
  });

  describe('fmtMinutes', () => {
    it('should format minutes less than 60', () => {
      expect(fmtMinutes(30)).toBe('30 min');
      expect(fmtMinutes(1)).toBe('1 min');
      expect(fmtMinutes(59)).toBe('59 min');
    });

    it('should format hours and minutes when 60 or more', () => {
      expect(fmtMinutes(60)).toBe('1h');
      expect(fmtMinutes(75)).toBe('1h 15m');
      expect(fmtMinutes(120)).toBe('2h');
      expect(fmtMinutes(135)).toBe('2h 15m');
    });

    it('should handle edge cases', () => {
      expect(fmtMinutes(0)).toBe('0 min');
      expect(fmtMinutes(45)).toBe('45 min');
    });
  });
});