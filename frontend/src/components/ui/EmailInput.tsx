/**
 * EmailInput
 * 
 * Purpose : An email field that lists every rule the address breaks underneath itself, in small red type, rather than saying only that something is wrong.
 * Spec    : -
 * Look here when : A valid address is rejected, or the rules under the field read wrong.
 */

import type { TextInputProps } from 'react-native';
import { Input } from './Input';
import { useFieldErrors } from '../../hooks/useFieldErrors';
import { emailErrors } from '../../lib/validate';

interface Props extends Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  required?: boolean;
  /** Set from a failed submit to reveal the rules before the field is blurred. */
  showErrors?: boolean;
  hint?: string;
  icon?: Parameters<typeof Input>[0]['icon'];
  containerStyle?: Parameters<typeof Input>[0]['containerStyle'];
}

export function EmailInput({
  label = 'Email',
  value,
  onChangeText,
  required,
  showErrors,
  hint,
  icon = 'mail-outline',
  containerStyle,
  ...rest
}: Props) {
  const { visible, markTouched } = useFieldErrors(
    value,
    (v) => emailErrors(v, { required }),
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
      onChangeText={onChangeText}
      onBlur={markTouched}
      errors={visible}
      placeholder={rest.placeholder ?? 'you@example.com'}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      textContentType="emailAddress"
    />
  );
}
