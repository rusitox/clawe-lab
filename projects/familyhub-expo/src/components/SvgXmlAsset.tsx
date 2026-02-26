import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

/**
 * Simple wrapper to render inline SVG XML.
 * This avoids Metro SVG transformers and works across Android/Web.
 */
export function SvgXmlAsset({
  xml,
  width,
  height,
  color,
  style,
}: {
  xml: string;
  width: number;
  height: number;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={style}>
      <SvgXml xml={xml} width={width} height={height} color={color} />
    </View>
  );
}
