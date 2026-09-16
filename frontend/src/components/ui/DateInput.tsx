/**
 * DateInput
 * 
 * Purpose : A date field that only accepts digits and writes them back as YYYY-MM-DD. The numeric keypad keeps letters off the screen; the mask keeps them out of the value when a hardware keyboard or a paste gets past it.
 * Spec    : -
 * Look here when : A date field shows letters, or accepts 2026-13-40.
 */

import type { TextInputProps } from 'react-native';
import { Input } from './Input';
import { useFieldErrors } from '../../hooks/useFieldErrors';
import { dateErrors, maskDate } from '../../lib/validate';

interface Props extends Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> {
  label?: string;
  value: string;
  /** Receives the masked value, never the raw keystrokes. */
  onChangeText: (value: string) => void;
  required?: boolean;
  /** Set from a failed submit to reveal the error before the field is blurred. */
  showErrors?: boolean;
  hint?: string;
  icon?: Parameters<typeof Input>[0]['icon'];
  containerStyle?: Parameters<typeof Input>[0]['containerStyle'];
}

export function DateInput({
  label = 'Date',
  value,
  onChangeText,
  required,
  showErrors,
  hint,
  icon = 'calendar-outline',
  containerStyle,
  ...rest
}: Props) {
  const { visible, markTouched } = useFieldErrors(
    value,
    (v) => dateErrors(v, { required }),
    { showErrors },
  );

  return (
    <Input
      {...rest}
      label={label}
      required={required}
      hint={hint}
      icon={icon}
      containerStyle={containerStyle}
      value={value}
      onChangeText={(raw) => onChangeText(maskDate(raw))}
      onBlur={markTouched}
      errors={visible}
      placeholder={rest.placeholder ?? 'YYYY-MM-DD'}
      keyboardType="number-pad"
      autoCapitalize="none"
      autoCorrect={false}
      /* 8 digits plus the two dashes the mask inserts. */
      maxLength={10}
    />
  );
}
