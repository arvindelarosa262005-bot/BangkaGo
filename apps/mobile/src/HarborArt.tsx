import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { harborSvg } from "@bangkago/shared";
export function HarborArt({ height = 210 }: { height?: number }) {
  return (
    <View
      accessibilityLabel="Illustration of a bangka between Philippine shores"
      accessibilityRole="image"
      style={{ height, width: "100%", overflow: "hidden" }}
    >
      <SvgXml
        xml={harborSvg}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      />
    </View>
  );
}
