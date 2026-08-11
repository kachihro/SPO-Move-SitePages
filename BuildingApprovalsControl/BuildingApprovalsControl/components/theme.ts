import { BrandVariants, createLightTheme, Theme } from "@fluentui/react-components";

/**
 * Adelaide Airport Partner Portal brand ramp (magenta/pink), approximated from the target Power Pages
 * mockup's "Create" button and BA Number link colors — not an official design-token export, so nudge
 * these hex values if brand supplies an exact palette later.
 */
const airportBrandRamp: BrandVariants = {
  10: "#FDF0F7",
  20: "#FCE0EF",
  30: "#FAC7E1",
  40: "#F7A8D0",
  50: "#F385BE",
  60: "#E965AC",
  70: "#DB4998",
  80: "#C22672",
  90: "#A81F62",
  100: "#8F1A54",
  110: "#771646",
  120: "#601138",
  130: "#4A0D2B",
  140: "#350920",
  150: "#200515",
  160: "#10020A",
};

export const airportTheme: Theme = createLightTheme(airportBrandRamp);

/** Gradient used for the primary "hero" actions (Create, Submit) to match the mockup's pill button. */
export const heroButtonGradient = "linear-gradient(135deg, #C22672 0%, #8E2B8B 100%)";
export const heroButtonGradientHover = "linear-gradient(135deg, #A81F62 0%, #7A2478 100%)";
