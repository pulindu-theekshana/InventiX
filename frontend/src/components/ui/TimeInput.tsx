/**
 * TimeInput
 * 
 * Purpose : A 24-hour time field that only accepts digits and writes them back as HH:MM. Same reasoning as DateInput — numeric keypad on screen, mask behind it.
 * Spec    : -
 * Look here when : A time field shows letters, or accepts 25:70.
 */

import type { TextInputProps } from 'react-native';
import { Input } from './Input';
import { useFieldErrors } from '../../hooks/useFieldErrors';
import { maskTime, timeErrors } from '../../lib/validate';

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

export function TimeInput({
  label = 'Time',
  value,
  onChangeText,
  required,
  showErrors,
  hint,
  icon = 'time-outline',
  containerStyle,
  ...rest
}: Props) {
  const { visible, markTouched } = useFieldErrors(
    value,
    (v) => timeErrors(v, { required }),
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
      onChangeText={(raw) => onChangeText(maskTime(raw))}
      onBlur={markTouched}
      errors={visible}
      placeholder={rest.placeholder ?? 'HH:MM'}
      keyboardType="number-pad"
      autoCapitalize="none"
      autoCorrect={false}
      /* 4 digits plus the colon the mask inserts. */
      maxLength={5}
    />
  );
}
