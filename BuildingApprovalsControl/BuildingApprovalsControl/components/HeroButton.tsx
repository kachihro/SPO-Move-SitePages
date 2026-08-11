import * as React from "react";
import { Button, ButtonProps, makeStyles, mergeClasses } from "@fluentui/react-components";
import { heroButtonGradient, heroButtonGradientHover } from "./theme";

const useStyles = makeStyles({
  root: {
    borderRadius: "999px",
    border: "none",
    paddingLeft: "24px",
    paddingRight: "24px",
    fontWeight: 600,
    backgroundImage: heroButtonGradient,
    color: "#ffffff",
    boxShadow: "0 2px 6px rgba(194, 38, 114, 0.35)",
    ":hover": {
      backgroundImage: heroButtonGradientHover,
      color: "#ffffff",
    },
    ":hover:active": {
      backgroundImage: heroButtonGradientHover,
      color: "#ffffff",
    },
    ":disabled": {
      backgroundImage: "none",
      boxShadow: "none",
    },
  },
});

/** The pink/magenta gradient pill button used for primary calls-to-action (Create, Submit). */
export const HeroButton: React.FC<ButtonProps> = (props) => {
  const styles = useStyles();
  return <Button {...props} className={mergeClasses(styles.root, props.className)} appearance="primary" />;
};
