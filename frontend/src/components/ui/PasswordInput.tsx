/**
 * PasswordInput
 * 
 * Purpose : A password field that lists its rules underneath in small red type, the same way the email field does. The minimum length lives in lib/validate, not here.
 * Spec    : -
 * Look here when : A password of the right length is rejected, or the rule under the field reads wrong.
 */

import type { TextInputProps } from 'react-native';
import { Input } from './Input';
import { useFieldErrors } from '../../hooks/useFieldErrors';
import { passwordErrors } from '../../lib/validate';

interface Props extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  required?: boolean;
  /** Set from a failed submit to reveal the rules before the field is blurred. */
  showErrors?: boolean;
  /**
   * A rule the field cannot judge alone, such as a confirmation not matching.
   * Shown alongside the length rule.
   */
  extraErrors?: string[];
  hint?: string;
  icon?: Parameters<typeof Input>[0]['icon'];
  containerStyle?: Parameters<typeof Input>[0]['containerStyle'];
}

export function PasswordInput({
  label = 'Password',
  value,
  onChangeText,
  required,
  showErrors,
  extraErrors,
  hint,
  icon = 'lock-closed-outline',
  containerStyle,
  ...rest
}: Props) {
  const { visible, markTouched } = useFieldErrors(
    value,
    (v) => passwordErrors(v, { required }),
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
      errors={[...visible, ...(extraErrors ?? [])]}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}
