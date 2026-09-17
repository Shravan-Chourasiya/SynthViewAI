import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PasswordChecklist, passwordIsValid } from '@/pages/auth/password-checklist';

describe('Password Checklist Component', () => {
  describe('passwordIsValid function', () => {
    it('returns true for valid passwords', () => {
      // Valid password: meets all criteria
      expect(passwordIsValid('ValidPass123')).toBe(true);
      expect(passwordIsValid('Test123456')).toBe(true);
    });

    it('returns false for passwords that are too short', () => {
      expect(passwordIsValid('Short1')).toBe(false); // Only 7 chars
      expect(passwordIsValid('Hi')).toBe(false); // Too short
      expect(passwordIsValid('')).toBe(false); // Empty
    });

    it('returns false for passwords without numbers', () => {
      expect(passwordIsValid('NoNumbers')).toBe(false);
      expect(passwordIsValid('JustLetters')).toBe(false);
    });

    it('returns false for passwords without mixed case', () => {
      expect(passwordIsValid('nouppercase123')).toBe(false);
      expect(passwordIsValid('NOLOWERCASE123')).toBe(false);
    });

    it('returns true for exactly 8 characters with all criteria', () => {
      expect(passwordIsValid('Abc12345')).toBe(true);
    });
  });

  describe('PasswordChecklist component', () => {
    it('renders all password rules', () => {
      render(<PasswordChecklist value="" />);

      expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
      expect(screen.getByText('At least one number')).toBeInTheDocument();
      expect(screen.getByText('Upper & lowercase letters')).toBeInTheDocument();
    });

    it('shows unchecked rules for empty password', () => {
      render(<PasswordChecklist value="" />);

      // With empty password, all rules should be unchecked
      const rules = screen.getAllByRole('listitem');
      expect(rules).toHaveLength(3);
      
      // None should have checkmarks when password is empty
      rules.forEach(rule => {
        // Check that there are no SVG check icons
        expect(rule.querySelector('svg')).not.toBeInTheDocument();
      });
    });

    it('shows checked rules when password meets criteria', () => {
      render(<PasswordChecklist value="ValidPass123" />);

      // With valid password, all rules should be checked
      const rules = screen.getAllByRole('listitem');
      expect(rules).toHaveLength(3);
      
      // Check that each rule has exactly one SVG checkmark icon
      rules.forEach(rule => {
        const svgIcons = rule.querySelectorAll('svg');
        expect(svgIcons).toHaveLength(1);
      });
    });

    it('partially checks rules when some criteria are met', () => {
      render(<PasswordChecklist value="password" />); // Has lowercase and 8+ chars, but no number

      const rules = screen.getAllByRole('listitem');
      expect(rules).toHaveLength(3);
      
      // Count how many rules are checked by counting SVGs
      const checkedCount = Array.from(rules).filter(rule => rule.querySelector('svg')).length;
      
      // With "password", the validation would be:
      // - length: 8 chars = true ✓ (passes length test)
      // - number: no numbers = false ✗ (fails number test)
      // - case: only lowercase = false ✗ (fails case test)
      // So we expect 1 rule to be checked
      expect(checkedCount).toBe(1); // Only the length rule should be checked
    });

    it('updates when password value changes', () => {
      const { rerender } = render(<PasswordChecklist value="weak" />);
      
      // Initially weak password should have few checks
      const initialRules = screen.getAllByRole('listitem');
      const initialCheckedCount = Array.from(initialRules).filter(rule => rule.querySelector('svg')).length;
      
      // Rerender with strong password
      rerender(<PasswordChecklist value="StrongPass123" />);
      
      // Now should have more checks (all 3 rules satisfied)
      const updatedRules = screen.getAllByRole('listitem');
      const updatedCheckedCount = Array.from(updatedRules).filter(rule => rule.querySelector('svg')).length;
      
      expect(updatedCheckedCount).toBeGreaterThan(initialCheckedCount);
      expect(updatedCheckedCount).toBe(3); // All should be checked with strong password
    });
  });
});