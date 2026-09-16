import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('class1', 'class2', 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const result = cn('base-class', {
        'active-class': isActive,
        'inactive-class': !isActive,
      });
      expect(result).toBe('base-class active-class');
    });

    it('should merge conflicting Tailwind classes', () => {
      // Tailwind merge should prioritize the last conflicting class
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });

    it('should handle mixed inputs', () => {
      const condition = true;
      const result = cn('base', condition && 'conditional', null, undefined, 'another');
      expect(result).toBe('base conditional another');
    });

    it('should handle arrays of classes', () => {
      const result = cn(['class1', 'class2'], ['class3', 'class4']);
      expect(result).toBe('class1 class2 class3 class4');
    });
  });
});