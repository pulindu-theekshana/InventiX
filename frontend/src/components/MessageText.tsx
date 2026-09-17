/**
 * Message text
 *
 * Purpose : Shows a restock message as sent, with the "Special note:" heading in bold so the shop's own note stands out.
 * Spec    : Section 6.5
 * Look here when : The note heading is not bold. The heading itself is written by backend/app/domain/message_builder.py.
 */

import { Text, type StyleProp, type TextStyle } from 'react-native';
import { fontWeight } from '../theme/typography';

const HEADING = 'Special note:';

export function MessageText({ body, style }: { body: string; style?: StyleProp<TextStyle> }) {
  const parts = body.split('\n' + HEADING + '\n');
  return (
    <Text style={style}>
      {parts.map((part, i) => (
        <Text key={i}>
          {i > 0 ? (
            <>
              {'\n'}
              <Text style={{ fontWeight: fontWeight.bold }}>{HEADING}</Text>
              {'\n'}
            </>
          ) : null}
          {part}
        </Text>
      ))}
    </Text>
  );
}
